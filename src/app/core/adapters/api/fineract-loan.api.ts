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

import { LoansService } from '../../../api';
import type { GetLoansLoanIdResponse, GetLoansLoanIdStatus } from '../../../api';
import type { Loan, LoanApi, LoanPage, LoanQuery, LoanStatus } from './loan.api';

/**
 * What a loan status actually sends, where that differs from the generated type.
 *
 * `value` is additive, so an intersection states it; `description` is declared upstream and
 * never sent, so it is dropped with `Omit` rather than left to look available.
 */
type LoanStatusPayload = Omit<GetLoansLoanIdStatus, 'description'> & {
  /** Sent by Fineract on every loan status, absent from the generated model. */
  readonly value?: string;
};

/** A loan payload, with the status corrected. */
type LoanPayload = Omit<GetLoansLoanIdResponse, 'status'> & {
  readonly status?: LoanStatusPayload;
};

/**
 * `GET /loans` answers a page, not an array.
 *
 * The generated client types this operation's response as `GetLoansResponse`, whose `pageItems`
 * the previous call site had to cast — `response.pageItems as unknown as
 * GetLoansLoanIdResponse[]` — because the declared item type is not the one a list row needs.
 * The cast is gone; the shape it was papering over is written down instead.
 */
interface LoanPagePayload {
  readonly totalFilteredRecords?: number;
  readonly pageItems?: readonly LoanPayload[];
}

/**
 * Maps one loan status onto the application model.
 *
 * Every flag defaults to `false` rather than `undefined`. A status that arrives without
 * `active` is not an active loan, and leaving the field optional would push an `=== true`
 * onto every caller — which is exactly the kind of per-screen re-interpretation this boundary
 * exists to remove.
 *
 * Exported for its own test. This is where an upstream shape change is meant to surface.
 */
export function mapLoanStatus(payload: LoanStatusPayload | undefined): LoanStatus {
  return {
    id: payload?.id ?? null,
    code: payload?.code ?? '',
    value: payload?.value ?? '',
    pendingApproval: payload?.pendingApproval === true,
    waitingForDisbursal: payload?.waitingForDisbursal === true,
    active: payload?.active === true,
    closedObligationsMet: payload?.closedObligationsMet === true,
    closedWrittenOff: payload?.closedWrittenOff === true,
    closedRescheduled: payload?.closedRescheduled === true,
    closed: payload?.closed === true,
    overpaid: payload?.overpaid === true,
  };
}

/**
 * Maps one loan payload onto the application model.
 *
 * Exported for its own test.
 */
export function mapLoan(payload: LoanPayload): Loan {
  return {
    // Fineract always sends an id; a loan without one cannot be navigated to, and defaulting it
    // would route somewhere wrong, so it fails loudly instead of plausibly.
    id: required(payload.id, 'id'),
    accountNo: payload.accountNo ?? '',
    clientName: payload.clientName ?? '',
    clientId: payload.clientId ?? null,
    loanProductName: payload.loanProductName ?? '',
    status: mapLoanStatus(payload.status),
  };
}

function required<T>(value: T | undefined, field: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Fineract returned a loan with no ${field}`);
  }
  return value;
}

/**
 * {@link LoanApi} over the generated OpenAPI client.
 *
 * One of the few places allowed to import `src/app/api` — see ADR 0006 and the `files` override
 * in `eslint.config.js`.
 */
@Injectable({ providedIn: 'root' })
export class FineractLoanApi implements LoanApi {
  private readonly loans = inject(LoansService);

  list(query: LoanQuery = {}): Observable<LoanPage> {
    return (
      this.loans
        // Positional, in the generated signature's order:
        // externalId, offset, limit, orderBy, sortOrder, accountNo, associations, clientId, status.
        // `externalId`, `associations` and `clientId` are not filters this list offers.
        .getLoans(
          undefined,
          query.offset,
          query.limit,
          query.orderBy,
          query.sortOrder,
          query.accountNo,
          undefined,
          undefined,
          query.status,
        )
        .pipe(
          map((response) => {
            const page = response as unknown as LoanPagePayload;
            return {
              items: (page.pageItems ?? []).map((payload) => mapLoan(payload)),
              totalFilteredRecords: page.totalFilteredRecords ?? 0,
            };
          }),
        )
    );
  }
}
