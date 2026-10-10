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

import { LoanTransactionsService } from '../../../api';
import type {
  GetLoansLoanIdTransactionsTemplateResponse,
  GetLoansLoanIdTransactionsTransactionIdResponse,
  GetPaymentTypeOptions,
} from '../../../api';
import { toIsoFineractDate } from './fineract-date';
import type {
  LoanTransaction,
  LoanTransactionAdjustment,
  LoanTransactionApi,
  LoanTransactionTemplate,
  LoanTransactionType,
  PaymentTypeOption,
} from './loan-transaction.api';

/** Fineract's wire format for the dates this adapter sends. */
const DATE_FORMAT = 'yyyy-MM-dd';
const LOCALE = 'en';

/**
 * What a transaction type actually sends, where that differs from `GetLoansType`.
 *
 * `value` is additive; `description` is declared upstream and never sent, so it goes.
 */
interface TransactionTypePayload {
  readonly id?: number;
  readonly code?: string;
  /** Sent by Fineract, absent from `GetLoansType`. */
  readonly value?: string;
}

/** A transaction payload, with the type and the date corrected. */
type TransactionPayload = Omit<GetLoansLoanIdTransactionsTransactionIdResponse, 'type' | 'date'> & {
  readonly type?: TransactionTypePayload;
  /** Declared `string` upstream; sent as `[year, month, day]`. */
  readonly date?: string | number[];
};

/** A payment type option, with the fields the payload carries and the model does not declare. */
interface PaymentTypeOptionPayload extends GetPaymentTypeOptions {
  /** Sent on system-defined payment types only. */
  readonly codeName?: string;
  readonly isSystemDefined?: boolean;
}

/**
 * Maps one transaction type onto the application model.
 *
 * `displayName` falls back to `code` rather than to an empty string. A blank type in a
 * transaction table is indistinguishable from a field with no value, whereas a visible
 * `loanTransactionType.disbursement` diagnoses itself — the same reasoning the i18n adapter
 * applies to a missing translation key.
 *
 * Exported for its own test.
 */
export function mapLoanTransactionType(
  payload: TransactionTypePayload | undefined,
): LoanTransactionType {
  const code = payload?.code ?? '';
  return {
    id: payload?.id ?? null,
    code,
    displayName: payload?.value ?? code,
  };
}

/**
 * Maps one transaction payload onto the application model.
 *
 * Exported for its own test. This is where an upstream shape change is meant to surface.
 */
export function mapLoanTransaction(payload: TransactionPayload): LoanTransaction {
  return {
    // A transaction without an id cannot be adjusted — the id is the path segment — so this
    // fails loudly rather than posting to `/transactions/undefined`.
    id: required(payload.id, 'id'),
    type: mapLoanTransactionType(payload.type),
    date: toIsoFineractDate(payload.date),
    amount: payload.amount ?? 0,
    principalPortion: payload.principalPortion ?? 0,
    interestPortion: payload.interestPortion ?? 0,
    feeChargesPortion: payload.feeChargesPortion ?? 0,
    penaltyChargesPortion: payload.penaltyChargesPortion ?? 0,
    manuallyReversed: payload.manuallyReversed === true,
    receiptNumber: payload.paymentDetailData?.receiptNumber ?? null,
  };
}

/**
 * Maps one payment type option onto the application model.
 *
 * Options with no id are dropped by the caller rather than defaulted: the id is what the
 * command sends, so an option that cannot be submitted should not be offered.
 *
 * Exported for its own test.
 */
export function mapPaymentTypeOption(payload: PaymentTypeOptionPayload): PaymentTypeOption | null {
  if (payload.id === undefined || payload.id === null) return null;
  return {
    id: payload.id,
    name: payload.name ?? '',
    codeName: payload.codeName ?? null,
    isSystemDefined: payload.isSystemDefined === true,
  };
}

function required<T>(value: T | undefined, field: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Fineract returned a loan transaction with no ${field}`);
  }
  return value;
}

/**
 * {@link LoanTransactionApi} over the generated OpenAPI client.
 *
 * One of the few places allowed to import `src/app/api` — see ADR 0006 and the `files` override
 * in `eslint.config.js`.
 */
@Injectable({ providedIn: 'root' })
export class FineractLoanTransactionApi implements LoanTransactionApi {
  private readonly transactions = inject(LoanTransactionsService);

  get(loanId: number, transactionId: number): Observable<LoanTransaction> {
    return this.transactions
      .getLoansLoanIdTransactionsTransactionId(loanId, transactionId)
      .pipe(map((payload) => mapLoanTransaction(payload as TransactionPayload)));
  }

  template(loanId: number, command: string): Observable<LoanTransactionTemplate> {
    return this.transactions.getLoansLoanIdTransactionsTemplate(loanId, command).pipe(
      map((payload: GetLoansLoanIdTransactionsTemplateResponse) => ({
        paymentTypeOptions: (payload.paymentTypeOptions ?? [])
          .map((option) => mapPaymentTypeOption(option as PaymentTypeOptionPayload))
          .filter((option): option is PaymentTypeOption => option !== null),
      })),
    );
  }

  adjust(
    loanId: number,
    transactionId: number,
    adjustment: LoanTransactionAdjustment,
  ): Observable<void> {
    return this.transactions
      .postLoansLoanIdTransactionsTransactionId(loanId, transactionId, {
        transactionDate: adjustment.date,
        transactionAmount: adjustment.amount,
        note: adjustment.note,
        dateFormat: DATE_FORMAT,
        locale: LOCALE,
      })
      .pipe(map(() => undefined));
  }
}
