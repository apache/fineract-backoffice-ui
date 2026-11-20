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

import { InjectionToken, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { FineractWorkingCapitalLoanApi } from './fineract-working-capital-loan.api';

/**
 * One working-capital loan, reduced to what a portfolio-level view can state.
 *
 * Narrower than the generated `GetWorkingCapitalLoansLoanIdResponse` on purpose: that type has
 * 80-odd optional fields, and a screen that aggregates across every loan in the book needs a
 * handful of them to be present and numeric rather than `number | undefined`. Summing
 * `undefined` is `NaN`, and a portfolio total that silently reads `NaN` is worse than one that
 * reads zero, so absence is resolved here, once, instead of at each `+`.
 */
export interface WorkingCapitalLoanSnapshot {
  readonly id: number;
  readonly accountNo: string;
  readonly clientId: number | null;
  readonly clientName: string | null;
  /** The platform's own label for the status, or `null` when it sends none. */
  readonly status: string | null;
  readonly currencyCode: string | null;
  /** Approved principal where there is one, else what was proposed. */
  readonly principal: number;
  /** `summary.totalOutstanding`, the figure the loan view shows as outstanding. */
  readonly outstanding: number;
  /** `delinquent.delinquentAmount`: what the platform considers delinquent today. */
  readonly delinquentAmount: number;
  /** `delinquent.delinquentDays`, as the platform counts them. */
  readonly delinquentDays: number;
  /**
   * `balance.breachPastDueAmount` — the platform's own named figure.
   *
   * Deliberately *not* accompanied by an `inBreach` flag. Nothing in this payload states that a
   * loan is currently in breach: `breach` is the breach definition attached to the loan and
   * `breachStartDate` is a date whose meaning this project has never had to pin down, because
   * every existing screen reads breach as per-loan *actions* through
   * `WorkingCapitalLoanBreachActionsService` instead. Inferring a breach flag here would put a
   * risk claim the module does not make into a screen that looks authoritative.
   */
  readonly breachPastDueAmount: number;
  readonly chargedOff: boolean;
  readonly fraud: boolean;
}

/**
 * Working-capital loans, as a portfolio.
 *
 * One read, because one is used. ADR 0001 rejected a facade mirroring the generated services and
 * ADR 0006 keeps that rejection; this exists because the overview screen needs the list without
 * importing the generated client, and because the arithmetic below has to live somewhere tested.
 */
export interface WorkingCapitalLoanApi {
  /** Every working-capital loan the user may see, in the order Fineract returns them. */
  listLoans(): Observable<WorkingCapitalLoanSnapshot[]>;

  /**
   * The loan carrying this institution-assigned external id, or `null` when none does.
   *
   * Fineract addresses every working-capital command twice — once by its own numeric id and
   * once by the external id the institution set — and this application only ever used the
   * numeric half, so an operator holding their own reference had no way in. `null` rather than
   * an error for "no such loan": a typed reference not matching is an ordinary outcome of a
   * lookup, not a failure to report.
   */
  findByExternalId(externalId: string): Observable<WorkingCapitalLoanSnapshot | null>;
}

export const WORKING_CAPITAL_LOAN_API = new InjectionToken<WorkingCapitalLoanApi>(
  'WorkingCapitalLoanApi',
  {
    providedIn: 'root',
    factory: () => inject(FineractWorkingCapitalLoanApi),
  },
);

/**
 * Delinquency aging bands, in the order a portfolio view reads them.
 *
 * Thirty-day bands because that is what the platform's own delinquency buckets use and what a
 * collections officer reads; `from`/`to` are inclusive day counts, `to: null` being open-ended.
 */
export const DELINQUENCY_AGING_BANDS = [
  { key: 'current', labelKey: 'WC_PORTFOLIO.AGING_CURRENT', from: 0, to: 0 },
  { key: 'd1to30', labelKey: 'WC_PORTFOLIO.AGING_1_30', from: 1, to: 30 },
  { key: 'd31to60', labelKey: 'WC_PORTFOLIO.AGING_31_60', from: 31, to: 60 },
  { key: 'd61to90', labelKey: 'WC_PORTFOLIO.AGING_61_90', from: 61, to: 90 },
  { key: 'd90plus', labelKey: 'WC_PORTFOLIO.AGING_90_PLUS', from: 91, to: null },
] as const;

export type DelinquencyAgingKey = (typeof DELINQUENCY_AGING_BANDS)[number]['key'];

/** One aging band, counted and totalled. */
export interface DelinquencyAgingRow {
  readonly key: DelinquencyAgingKey;
  readonly labelKey: string;
  readonly loans: number;
  readonly outstanding: number;
  readonly delinquentAmount: number;
}

/** One status, counted and totalled. */
export interface PortfolioStatusRow {
  readonly status: string;
  readonly loans: number;
  readonly outstanding: number;
}

/** What the overview screen states about the book. */
export interface WorkingCapitalPortfolioSummary {
  readonly loans: number;
  readonly principal: number;
  readonly outstanding: number;
  readonly delinquentAmount: number;
  readonly delinquentLoans: number;
  readonly breachPastDueAmount: number;
  readonly breachPastDueLoans: number;
  readonly chargedOffLoans: number;
  readonly fraudLoans: number;
  /** Null when the book is empty or spans more than one currency — see {@link summarisePortfolio}. */
  readonly currencyCode: string | null;
  readonly aging: readonly DelinquencyAgingRow[];
  readonly byStatus: readonly PortfolioStatusRow[];
}

/** The band a day count falls in. */
export function agingBandOf(delinquentDays: number): DelinquencyAgingKey {
  const band = DELINQUENCY_AGING_BANDS.find(
    (candidate) =>
      delinquentDays >= candidate.from && (candidate.to === null || delinquentDays <= candidate.to),
  );
  // Negative day counts are not a shape Fineract sends, and treating one as "current" would
  // hide it. The first band is the honest answer for 0; anything below it is still counted
  // somewhere rather than dropped from the totals.
  return band?.key ?? 'current';
}

/**
 * Totals the book.
 *
 * A pure function rather than a method on the component, because these figures are the screen's
 * whole claim and a template cannot be asked to prove them. Every number here is one the
 * platform states per loan; nothing is inferred beyond addition and the day-count banding.
 *
 * The currency is reported only when the whole book shares one. Summing amounts across
 * currencies produces a number with no meaning, so a mixed book gets `null` and the screen
 * shows the figures without a currency rather than labelling them with the first one it saw.
 */
export function summarisePortfolio(
  loans: readonly WorkingCapitalLoanSnapshot[],
): WorkingCapitalPortfolioSummary {
  const currencies = new Set(
    loans.map((loan) => loan.currencyCode).filter((code) => code !== null),
  );

  const aging = DELINQUENCY_AGING_BANDS.map((band) => {
    const inBand = loans.filter((loan) => agingBandOf(loan.delinquentDays) === band.key);
    return {
      key: band.key,
      labelKey: band.labelKey,
      loans: inBand.length,
      outstanding: sum(inBand, (loan) => loan.outstanding),
      delinquentAmount: sum(inBand, (loan) => loan.delinquentAmount),
    };
  });

  const statuses = new Map<string, WorkingCapitalLoanSnapshot[]>();
  for (const loan of loans) {
    const key = loan.status ?? '';
    statuses.set(key, [...(statuses.get(key) ?? []), loan]);
  }

  return {
    loans: loans.length,
    principal: sum(loans, (loan) => loan.principal),
    outstanding: sum(loans, (loan) => loan.outstanding),
    delinquentAmount: sum(loans, (loan) => loan.delinquentAmount),
    delinquentLoans: loans.filter((loan) => loan.delinquentAmount > 0).length,
    breachPastDueAmount: sum(loans, (loan) => loan.breachPastDueAmount),
    breachPastDueLoans: loans.filter((loan) => loan.breachPastDueAmount > 0).length,
    chargedOffLoans: loans.filter((loan) => loan.chargedOff).length,
    fraudLoans: loans.filter((loan) => loan.fraud).length,
    currencyCode: currencies.size === 1 ? [...currencies][0] : null,
    aging,
    byStatus: [...statuses.entries()]
      .map(([status, group]) => ({
        status,
        loans: group.length,
        outstanding: sum(group, (loan) => loan.outstanding),
      }))
      .toSorted(
        (left, right) => right.loans - left.loans || left.status.localeCompare(right.status),
      ),
  };
}

function sum<T>(items: readonly T[], of: (item: T) => number): number {
  return items.reduce((total, item) => total + of(item), 0);
}
