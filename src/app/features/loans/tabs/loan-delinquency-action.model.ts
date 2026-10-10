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

import { GetLoansLoanIdDelinquencyPausePeriod } from '../../../api';
import { formatArrayDate, toIsoDate } from '../../../core/utils/date-formatter';

/**
 * The delinquency actions Fineract accepts on a regular loan.
 *
 * Only these two. A Working Capital loan has a longer set (reschedule, reset, disable, ...),
 * but `POST /loans/{id}/delinquency-actions` answers anything else with
 * `validation.msg.loanDelinquencyAction.action.invalid.action`, so offering the longer set here
 * would be a list of ways to get a 400.
 */
export const DELINQUENCY_ACTION = { Pause: 'pause', Resume: 'resume' } as const;

/** What the pause dialog is given. */
export interface LoanDelinquencyPauseDialogData {
  /** The platform's current business date (`YYYY-MM-DD`): where a pause normally starts. */
  businessDate?: string;
}

/** What the pause dialog hands back, as `YYYY-MM-DD`. */
export interface LoanDelinquencyPauseResult {
  startDate: string;
  endDate: string;
}

/**
 * Reads a date from a Fineract response as `YYYY-MM-DD`, or `''` when there is none.
 *
 * The generated models type every date as a `string`, because that is what the OpenAPI document
 * declares, but the platform actually sends `LocalDate` as `[year, month, day]`. Both shapes are
 * accepted rather than trusting either, which is also what keeps a table that prints the value
 * as it arrives from showing `2026,10,15`.
 */
export function toIsoDay(value: unknown): string {
  if (Array.isArray(value)) {
    const iso = formatArrayDate(value);
    return iso === '-' ? '' : iso;
  }
  return typeof value === 'string' ? toIsoDate(value) : '';
}

/**
 * Whether there is a pause that a resume could end today.
 *
 * Fineract refuses a resume that does not fall inside a pause, and requires it to be dated on
 * the business date itself. A period's `active` flag is not enough to decide that, because it is
 * inclusive of the last day: once a loan has been resumed, the pause's end is moved to the
 * resume date, which is the business date, so the period still reads as active until the
 * business date moves on. Offering Resume then would be an offer the platform refuses
 * ("There is an existing Resume Delinquency Action on this date"). A pause that has days left
 * after today is the one a resume actually shortens.
 *
 * Without a business date the question cannot be answered, so the answer is no: a resume dated
 * by guesswork would be refused too.
 */
export function canResume(
  periods: readonly GetLoansLoanIdDelinquencyPausePeriod[],
  businessDate: string | undefined,
): boolean {
  if (!businessDate) return false;
  return periods.some((period) => period.active && toIsoDay(period.pausePeriodEnd) > businessDate);
}
