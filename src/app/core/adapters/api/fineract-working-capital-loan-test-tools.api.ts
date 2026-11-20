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

import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';

import { WorkingCapitalLoansService } from '../../../api';
import type { WorkingCapitalLoanTestToolsApi } from './working-capital-loan-test-tools.api';

/**
 * The `/v1/internal/**` working-capital commands, as application operations.
 *
 * This file is the single place the generated internal methods are referenced, which is what
 * `check-internal-endpoints.mjs` pins: adding a dependency on another one is then a visible
 * change to its allow-list rather than something that happens quietly in a screen.
 *
 * The responses are discarded. Each of these answers a body describing what it did on the test
 * instance, and none of it is anything a tool screen can act on — what matters to the operator
 * is whether the platform accepted the command, which is the difference between `next` and
 * `error`.
 */
@Injectable({ providedIn: 'root' })
export class FineractWorkingCapitalLoanTestToolsApi implements WorkingCapitalLoanTestToolsApi {
  private readonly loans = inject(WorkingCapitalLoansService);

  activate(loanId: number, disbursementDate?: string): Observable<void> {
    return this.loans
      .postInternalWorkingCapitalLoansLoanIdActivate(loanId, disbursementDate)
      .pipe(map(() => undefined));
  }

  regenerateAmortizationSchedule(loanId: number): Observable<void> {
    // No body: the endpoint takes the loan's own terms when none is supplied, and a tool screen
    // has no better figures to offer than the ones the loan already carries.
    return this.loans
      .postInternalWorkingCapitalLoansLoanIdAmortizationSchedule(loanId)
      .pipe(map(() => undefined));
  }

  generateNextDelinquencyPeriod(loanId: number, businessDate?: string): Observable<void> {
    return this.loans
      .postInternalWorkingCapitalLoansLoanIdGenerateNextDelinquencyPeriod(loanId, businessDate)
      .pipe(map(() => undefined));
  }
}
