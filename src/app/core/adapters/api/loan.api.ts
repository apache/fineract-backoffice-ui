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

import { FineractLoanApi } from './fineract-loan.api';

/**
 * A loan's status, as the application understands one.
 *
 * `GetLoansLoanIdStatus` disagrees with the payload `GET /loans` and `GET /loans/{id}` return,
 * verified against a running instance:
 *
 *   - It does not declare `value`, which every loan status carries
 *     (`{"id":200,"code":"loanStatusType.approved","value":"Approved",...}`).
 *   - It declares `description`, which the payload does not send.
 *
 * The application already worked around this in eight places. Two of them reach the field by
 * casting the status to `Record<string, unknown>` first:
 *
 * ```ts
 * return (status as unknown as Record<string, unknown>)?.['value'] === 'Approved';
 * ```
 *
 * A cast like that is not just ugly — it is unreviewable. It compiles whatever the payload
 * does, so the day `value` goes away it keeps compiling and silently answers `false`, and the
 * Disburse button stops being offered with nothing to show why.
 *
 * `value` is kept under its Fineract name rather than renamed to something like `displayName`
 * so that `StatusLike` in `shared/components/status-badge` still matches, and because the field
 * genuinely is what Fineract calls `value`. The booleans beside it are the part callers should
 * reach for — see {@link Loan.status}.
 */
export interface LoanStatus {
  readonly id: number | null;
  /** The stable key (`loanStatusType.approved`), safe to branch on. */
  readonly code: string;
  /** Fineract's display text (`Approved`). For rendering only — see {@link Loan.status}. */
  readonly value: string;
  readonly pendingApproval: boolean;
  readonly waitingForDisbursal: boolean;
  readonly active: boolean;
  readonly closedObligationsMet: boolean;
  readonly closedWrittenOff: boolean;
  readonly closedRescheduled: boolean;
  readonly closed: boolean;
  readonly overpaid: boolean;
}

/**
 * A loan, as the application understands one.
 *
 * Only the fields the migrated screens read. ADR 0006 asks for contracts that earn their keep
 * rather than a mirror of the generated model, and `GetLoansLoanIdResponse` has 140-odd fields;
 * mapping all of them would reintroduce the coupling under a new name. Adding a field here is a
 * one-line change in {@link mapLoan} when a screen needs it.
 *
 * ## Why the status booleans matter
 *
 * `status` carries Fineract's flags, and callers deciding *what to offer* should branch on
 * those rather than on `status.value`. The loans list used to do this:
 *
 * ```html
 * @if (loan.status?.value === 'Submitted and pending approval') {
 * ```
 *
 * That is a comparison against English display text, used as control flow. It is wrong in two
 * ways. Fineract returns `value` from a localisable enum, so a platform serving another locale
 * offers neither Approve nor Disburse and gives no indication why. And the template context it
 * sits in is `any` — `let-loan` on an `<ng-template appCellTemplate>` has no declared context
 * type — so `strictTemplates` never checked the field the generated model does not declare.
 * The compiler was not going to catch this one; nothing was.
 */
export interface Loan {
  readonly id: number;
  readonly accountNo: string;
  readonly clientName: string;
  readonly clientId: number | null;
  readonly loanProductName: string;
  readonly status: LoanStatus;
}

/** One page of loans, with the total the paginator needs. */
export interface LoanPage {
  readonly items: readonly Loan[];
  readonly totalFilteredRecords: number;
}

/** How a loan query is narrowed. All optional; an omitted field is not sent. */
export interface LoanQuery {
  readonly offset?: number;
  readonly limit?: number;
  readonly orderBy?: string;
  /** `ASC` or `DESC`, as Fineract spells it. */
  readonly sortOrder?: string;
  /**
   * Fineract's `accountNo`, which is an **exact** match on the zero-padded account number.
   *
   * Named for what it is rather than `search`, because the previous call site passed its search
   * box straight into this parameter. Verified against a running instance: `accountNo=000000053`
   * returns that loan, `accountNo=0000` and `accountNo=E2E` both return zero rows. So the loans
   * list offers a search box that only answers a full account number and silently empties the
   * table for anything else — a client name, a product, a partial number. `GET /loans` has no
   * free-text parameter to point it at, so correcting that is a separate change with a product
   * decision in it; this contract at least stops the next caller assuming otherwise.
   */
  readonly accountNo?: string;
  /**
   * A Fineract loan status id as a string (`'300'` for active).
   *
   * Passed through rather than modelled as a union: the values are the platform's own and the
   * filter offers a fixed five. Fineract rejects `status=` and `status=All` outright with a 400
   * ("The Status value '...' is not supported"), so "any status" must omit the parameter
   * entirely — which is why this is `undefined` rather than an "all" sentinel.
   */
  readonly status?: string;
}

/**
 * Loans, stated as application operations.
 *
 * `list()` only, for now. It is what the loans list needs. Reading one loan stays on the
 * generated client until `loan-view.component.ts` is migrated — that component reads around a
 * hundred fields across sixteen tabs, so a `get()` here would either return a near-copy of the
 * generated response or a model nothing could use yet. Adding it before then would be the
 * speculative abstraction ADR 0006 and `AGENTS.md` both warn against.
 */
export interface LoanApi {
  /** One page of loans matching `query`. */
  list(query?: LoanQuery): Observable<LoanPage>;
}

/** Injection token for the active {@link LoanApi}. Defaults to the Fineract implementation. */
export const LOAN_API = new InjectionToken<LoanApi>('LoanApi', {
  providedIn: 'root',
  factory: () => inject(FineractLoanApi),
});
