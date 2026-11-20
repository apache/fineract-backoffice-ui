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

import { FineractWorkingCapitalLoanTestToolsApi } from './fineract-working-capital-loan-test-tools.api';

/**
 * Fineract's `/v1/internal/**` commands for a working-capital loan.
 *
 * Separate from {@link WorkingCapitalLoanApi} deliberately: these are not product operations.
 * Fineract serves `/v1/internal/**` only when the backend runs with its `test` Spring profile,
 * which upstream states must not be enabled in production, so on an ordinary deployment every
 * one of them answers 404. Keeping them in their own port means the product port cannot grow a
 * dependency on a test-only endpoint by accident, and `check-internal-endpoints.mjs` has one
 * file to pin rather than a screen each.
 *
 * They exist so a test instance can be driven into states the ordinary commands cannot reach —
 * activating a loan without the approval sequence, or stepping delinquency forward a period.
 */
export interface WorkingCapitalLoanTestToolsApi {
  /** Activates a loan directly, skipping the approval and disbursement sequence. */
  activate(loanId: number, disbursementDate?: string): Observable<void>;

  /** Regenerates the projected amortization schedule from the loan's own terms. */
  regenerateAmortizationSchedule(loanId: number): Observable<void>;

  /** Steps the loan into its next delinquency period. */
  generateNextDelinquencyPeriod(loanId: number, businessDate?: string): Observable<void>;
}

export const WORKING_CAPITAL_LOAN_TEST_TOOLS_API =
  new InjectionToken<WorkingCapitalLoanTestToolsApi>('WorkingCapitalLoanTestToolsApi', {
    providedIn: 'root',
    factory: () => inject(FineractWorkingCapitalLoanTestToolsApi),
  });
