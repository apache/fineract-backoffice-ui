/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../core/utils/date-formatter';

/**
 * The interest rate chart a fixed or recurring deposit product carries.
 *
 * `charts` is mandatory on create *and* on update, which makes it the one part of these forms
 * that cannot simply be left out of an edit. A product's rates are the product, so the update
 * has to send back the chart it was given rather than a stand-in.
 */
export interface DepositChart {
  id?: number;
  fromDate: string;
  dateFormat: string;
  locale: string;
  chartSlabs: DepositChartSlab[];
}

export interface DepositChartSlab {
  id?: number;
  periodType: number;
  fromPeriod?: number;
  toPeriod?: number;
  annualInterestRate?: number;
  description?: string;
  locale: string;
}

/** Months, the unit the default chart is expressed in. */
const PERIOD_TYPE_MONTHS = 2;

/**
 * Turns the `activeChart` of a product response into something the update can send back.
 *
 * The ids are the point. A chart without them reads as a brand new one, and the platform answers
 * `500 Internal Server Error` rather than a validation message — which is what made editing a
 * fixed deposit product impossible. Carried back with its ids, the same chart is a no-op.
 */
export function chartFromResponse(activeChart: unknown): DepositChart | null {
  const chart = activeChart as
    | {
        id?: number;
        chartSlabs?: {
          id?: number;
          periodType?: { id?: number };
          fromPeriod?: number;
          toPeriod?: number;
          annualInterestRate?: number;
          description?: string;
        }[];
      }
    | undefined;
  if (!chart?.chartSlabs?.length) return null;

  return {
    id: chart.id,
    fromDate: formatDateToFineract(new Date()),
    dateFormat: FINERACT_DATE_FORMAT,
    locale: FINERACT_LOCALE,
    chartSlabs: chart.chartSlabs.map((slab) => ({
      id: slab.id,
      periodType: slab.periodType?.id ?? PERIOD_TYPE_MONTHS,
      fromPeriod: slab.fromPeriod,
      toPeriod: slab.toPeriod,
      annualInterestRate: slab.annualInterestRate,
      // The platform rejects a slab with no description on the way back in.
      description: slab.description || 'Interest rate',
      locale: FINERACT_LOCALE,
    })),
  };
}

/**
 * An empty slab for the editor to start from.
 *
 * Deliberately has no rate. This replaces `defaultChart()`, which handed every new product a
 * single slab at **5% for 1–60 months** that the form never showed — so an administrator
 * configuring a 7% two-year product got a 5% five-year one, and nothing on screen said so. That
 * is issue #765, and the fix is not a better default: it is that the rate is the product, so the
 * user has to enter it. An empty rate keeps the form invalid until they do.
 */
export function emptySlab(): DepositChartSlab {
  return {
    periodType: PERIOD_TYPE_MONTHS,
    fromPeriod: 1,
    locale: FINERACT_LOCALE,
  };
}

/** The slabs of a product's active chart, ready to edit. Empty for a product without one. */
export function slabsFromResponse(activeChart: unknown): DepositChartSlab[] {
  return chartFromResponse(activeChart)?.chartSlabs ?? [];
}

/**
 * Wraps edited slabs in the chart envelope a create or update sends.
 *
 * `existingChart` carries the chart's own id on an update. Without it the platform reads the
 * chart as a brand new one and answers 500 rather than a validation message, which is the defect
 * `chartFromResponse` was written for; the slab ids ride along on the slabs themselves.
 *
 * A slab with no rate is dropped rather than sent as zero. Zero is a rate an institution might
 * mean, so it cannot double as "not filled in" — the form refuses to submit an empty one
 * instead.
 */
export function chartForRequest(
  slabs: readonly DepositChartSlab[],
  existingChart: DepositChart | null = null,
): DepositChart {
  return {
    id: existingChart?.id,
    fromDate: existingChart?.fromDate ?? formatDateToFineract(new Date()),
    dateFormat: FINERACT_DATE_FORMAT,
    locale: FINERACT_LOCALE,
    chartSlabs: slabs
      .filter((slab) => slab.annualInterestRate !== undefined && slab.annualInterestRate !== null)
      .map((slab) => ({
        ...slab,
        // The platform rejects a slab with no description on the way in.
        description: slab.description || 'Interest rate',
        locale: FINERACT_LOCALE,
      })),
  };
}

/** Whether these slabs can be sent: at least one, each with a period range and a rate. */
export function slabsAreComplete(slabs: readonly DepositChartSlab[]): boolean {
  if (slabs.length === 0) return false;
  return slabs.every(
    (slab) =>
      slab.annualInterestRate !== undefined &&
      slab.annualInterestRate !== null &&
      slab.fromPeriod !== undefined &&
      slab.fromPeriod !== null,
  );
}

/**
 * The rate a chart pays for a given term.
 *
 * This is what a deposit account form needs and cannot get anywhere else. The account template
 * carries `nominalAnnualInterestRate: 0` for a product whose chart pays 7% — measured against a
 * running Fineract — so the rate has to be read out of the chart's slabs. The previous prefill
 * read the template field and wrote `0 || undefined`, which is one of the reasons issue #766
 * reported that choosing a product filled nothing in.
 *
 * A slab matches when its period type is the unit the term is expressed in and the term falls
 * inside its range. `toPeriod` is open-ended when absent, which is how the last band of a
 * tiered product is usually written.
 *
 * @param slabs - the product's chart slabs, from `accountChart` on the account template
 * @param term - the deposit period the user entered
 * @param periodTypeId - the unit that period is in, matching the slab's `periodType`
 */
export function rateForTerm(
  slabs: readonly DepositChartSlab[],
  term: number | undefined,
  periodTypeId: number | undefined,
): number | undefined {
  if (term === undefined || term === null) return undefined;
  const match = slabs.find(
    (slab) =>
      slab.periodType === periodTypeId &&
      (slab.fromPeriod ?? 0) <= term &&
      (slab.toPeriod === undefined || slab.toPeriod === null || term <= slab.toPeriod),
  );
  return match?.annualInterestRate;
}
