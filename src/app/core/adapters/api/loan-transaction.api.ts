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

import { FineractLoanTransactionApi } from './fineract-loan-transaction.api';

/**
 * A loan transaction's type, as the application understands one.
 *
 * The generated client has two different types for this one payload, and they disagree with
 * each other as well as with the wire. `GetLoansLoanIdLoanTransactionEnumData` (used on the
 * loan response) declares `value`; `GetLoansType` (used on the single-transaction response)
 * does not, and declares `description`, which the payload never sends. Both are the same JSON
 * — verified against a running instance:
 *
 * ```json
 * {"id":1,"code":"loanTransactionType.disbursement","value":"Disbursement","disbursement":true,...}
 * ```
 *
 * `transaction-detail-dialog.component.ts` carried the workaround, and a comment naming the
 * cause, which is how this one was found:
 *
 * ```ts
 * const type = tx.type as unknown as Record<string, unknown> | undefined;
 * return (type?.['value'] as string) || (type?.['description'] as string) || ...
 * ```
 *
 * The three-way fallback is reasonable code written against an unreliable type. With the shape
 * stated once, `displayName` is just a string.
 */
export interface LoanTransactionType {
  readonly id: number | null;
  /** The stable key (`loanTransactionType.disbursement`), safe to branch on. */
  readonly code: string;
  /** Fineract's display text (`Disbursement`), already fallen back to `code` when absent. */
  readonly displayName: string;
}

/**
 * A loan transaction, as the application understands one.
 *
 * `date` is the field this model exists for. It is declared `string` on every generated loan
 * transaction type and arrives as `[2026, 10, 2]`, which left one file converting it twice, two
 * different ways, for two different purposes:
 *
 * ```ts
 * formatDate(dates: unknown) { const arr = dates as number[]; ... new Date(arr[0], arr[1] - 1, arr[2]).toLocaleDateString() }
 * // and, for the adjust form's date picker:
 * const dateArray = data.date as unknown as number[];
 * if (Array.isArray(dateArray)) this.adjustDate.set(formatArrayDate(dateArray));
 * ```
 *
 * Both take `unknown` or cast, because the declared type cannot be used. Converting once, here,
 * is what lets the view hold a date and decide how to show it.
 */
export interface LoanTransaction {
  readonly id: number;
  readonly type: LoanTransactionType;
  /** ISO-8601 `YYYY-MM-DD`, converted from Fineract's `[year, month, day]`. */
  readonly date: string | null;
  readonly amount: number;
  readonly principalPortion: number;
  readonly interestPortion: number;
  readonly feeChargesPortion: number;
  readonly penaltyChargesPortion: number;
  readonly manuallyReversed: boolean;
  /** The receipt number off `paymentDetailData`, flattened — the only field read from it. */
  readonly receiptNumber: string | null;
}

/**
 * A payment type the platform will accept for a transaction.
 *
 * `GetPaymentTypeOptions` declares `id`, `name` and `position`. The payload also carries
 * `description`, `isCashPayment`, `isSystemDefined` and — on system-defined types only —
 * `codeName`:
 *
 * ```json
 * {"id":2,"name":"Repayment Adjustment Chargeback","codeName":"REPAYMENT_ADJUSTMENT_CHARGEBACK","isSystemDefined":true,...}
 * ```
 *
 * `codeName` is the one that matters, because the chargeback dialog selects its default payment
 * type by it and had to cast to reach it: `(o as { codeName?: string }).codeName`. That lookup
 * does work today — option 2 carries the field — so this is not a bug being fixed, it is a cast
 * being removed from a line whose correctness nothing else was checking.
 */
export interface PaymentTypeOption {
  readonly id: number;
  readonly name: string;
  /** The stable key on system-defined types (`REPAYMENT_ADJUSTMENT_CHARGEBACK`), else `null`. */
  readonly codeName: string | null;
  readonly isSystemDefined: boolean;
}

/** What `GET /loans/{id}/transactions/template` offers for a command. */
export interface LoanTransactionTemplate {
  readonly paymentTypeOptions: readonly PaymentTypeOption[];
}

/** The fields an adjustment sends. The date is `YYYY-MM-DD`; the adapter adds the format. */
export interface LoanTransactionAdjustment {
  readonly date: string;
  readonly amount: number;
  readonly note?: string;
}

/**
 * Loan transactions, stated as application operations.
 *
 * Three operations, all with callers: the detail dialog reads one and adjusts it, and the
 * chargeback dialog reads a command template for its payment types.
 */
export interface LoanTransactionApi {
  /** One transaction by id. */
  get(loanId: number, transactionId: number): Observable<LoanTransaction>;

  /**
   * The template for a command on this loan.
   *
   * @param command - Fineract's `command` query parameter (`repayment`, ...). There is no
   *   chargeback template — the endpoint answers "unsupported value" for it — so callers that
   *   need chargeback's payment types ask for the repayment one.
   */
  template(loanId: number, command: string): Observable<LoanTransactionTemplate>;

  /** Corrects a transaction's date and amount. */
  adjust(
    loanId: number,
    transactionId: number,
    adjustment: LoanTransactionAdjustment,
  ): Observable<void>;
}

/**
 * Injection token for the active {@link LoanTransactionApi}. Defaults to the Fineract
 * implementation.
 */
export const LOAN_TRANSACTION_API = new InjectionToken<LoanTransactionApi>('LoanTransactionApi', {
  providedIn: 'root',
  factory: () => inject(FineractLoanTransactionApi),
});
