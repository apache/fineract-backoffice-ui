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

import {
  PostTellersRequest,
  PostTellersTellerIdCashiersCashierIdAllocateRequest,
  PostTellersTellerIdCashiersRequest,
  PutTellersRequest,
  TellerCashManagementService,
} from '../../../api';
import type {
  CashierData,
  CashierTransactionData,
  GetTellersResponse,
  GetTellersTellerIdCashiersCashiersIdTransactionsTemplateResponse,
  GetTellersTellerIdCashiersCashiersIdSummaryAndTransactionsResponse,
} from '../../../api';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatDateToFineract,
} from '../../utils/date-formatter';
import { toIsoFineractDate } from './fineract-date';
import type {
  Cashier,
  CashierDraft,
  CashierSummary,
  CashierTransaction,
  CashierTransactionTemplate,
  CashTransactionDraft,
  Teller,
  TellerApi,
  TellerDraft,
  TellerStatus,
  TellerUpdate,
} from './teller.api';

/**
 * What a teller payload sends, where that differs from `GetTellersResponse`.
 *
 * `startDate` is widened, not corrected. The type says `string` and `GET /tellers` sends one;
 * accepting `[y, m, d]` as well is what keeps this mapper indifferent to which encoding a given
 * endpoint uses, the same stance as the staff and office adapters.
 *
 * `description` is sent and not declared, which `teller-form.component.ts` used to reach
 * through a `Record<string, unknown>` cast.
 */
type TellerPayload = Omit<GetTellersResponse, 'startDate'> & {
  readonly startDate?: string | number[];
  readonly description?: string;
};

/**
 * What a cashier payload sends. `CashierData` declares both dates as strings, and the
 * platform has been seen sending `[y, m, d]` for teller-area dates elsewhere, so both encodings
 * are accepted here as they are for `TellerPayload`.
 */
type CashierPayload = Omit<CashierData, 'startDate' | 'endDate'> & {
  readonly startDate?: string | number[];
  readonly endDate?: string | number[];
};

/**
 * What a ledger entry sends. `txnDate` is widened for the same reason as `TellerPayload`.
 */
type TransactionPayload = Omit<CashierTransactionData, 'txnDate'> & {
  readonly txnDate?: string | number[];
};

/**
 * Maps one teller payload onto the application model.
 *
 * Exported for its own test. This is where an upstream shape change is meant to surface.
 */
export function mapTeller(payload: TellerPayload): Teller {
  return {
    // A teller without an id cannot be navigated to or have cashiers allocated to it, and
    // defaulting it would point somewhere wrong, so this fails loudly rather than plausibly.
    id: required(payload.id, 'id'),
    name: payload.name ?? '',
    description: payload.description ?? null,
    officeId: payload.officeId ?? null,
    officeName: payload.officeName ?? '',
    status: payload.status ?? null,
    startDate: toIsoFineractDate(payload.startDate),
  };
}

/** Maps one cashier payload onto the application model. */
export function mapCashier(payload: CashierPayload): Cashier {
  return {
    id: required(payload.id, 'id'),
    staffId: payload.staffId ?? null,
    staffName: payload.staffName ?? '',
    isFullDay: payload.isFullDay === true,
    startDate: toIsoFineractDate(payload.startDate),
    endDate: toIsoFineractDate(payload.endDate),
  };
}

/** Maps one ledger entry. The transaction type is an object in the payload; the UI shows its text. */
export function mapCashierTransaction(payload: TransactionPayload): CashierTransaction {
  return {
    type: payload.txnType?.value ?? null,
    amount: payload.txnAmount ?? 0,
    date: toIsoFineractDate(payload.txnDate),
    note: payload.txnNote ?? null,
  };
}

/** Maps the summary-and-transactions response. */
export function mapCashierSummary(
  payload: GetTellersTellerIdCashiersCashiersIdSummaryAndTransactionsResponse,
): CashierSummary {
  return {
    cashierName: payload.cashierName ?? '',
    tellerName: payload.tellerName ?? '',
    allocated: payload.sumCashAllocation ?? 0,
    settled: payload.sumCashSettlement ?? 0,
    netCash: payload.netCash ?? 0,
    transactions: (payload.cashierTransactions?.pageItems ?? []).map(mapCashierTransaction),
  };
}

/** Maps the transaction-form template. */
export function mapCashierTransactionTemplate(
  payload: GetTellersTellerIdCashiersCashiersIdTransactionsTemplateResponse,
): CashierTransactionTemplate {
  return {
    cashierName: payload.cashierName ?? '',
    tellerName: payload.tellerName ?? '',
    currencies: (payload.currencyOptions ?? []).map((currency) => ({
      code: currency.code ?? '',
      // The same fallback the form used to apply itself: the display label, then the name.
      label: currency.displayLabel || currency.name || currency.code || '',
    })),
  };
}

function required<T>(value: T | undefined, field: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Fineract returned a teller record with no ${field}`);
  }
  return value;
}

/**
 * Includes an optional field only when it was given.
 *
 * An omitted key rather than an `undefined` one, so the adapter's promise is checked by its spec
 * rather than left to `JSON.stringify` dropping `undefined` values.
 */
function ifDefined(field: string, value: string | null | undefined): Record<string, string> {
  return value === null || value === undefined ? {} : { [field]: value };
}

/**
 * The status code the teller endpoints take on write.
 *
 * Fineract accepts the numeric code, not the `StatusEnum` string the generated request type
 * declares, and the form has always sent it this way: `ACTIVE` is `300`, and anything else is
 * `400`. The generated type cannot express that, hence the cast in each write below.
 */
function toWireStatus(status: TellerStatus): number {
  return status === 'ACTIVE' ? 300 : 400;
}

/**
 * The date format the teller and cashier writes declare.
 *
 * These endpoints take ISO dates, and the cash transactions below do not: they use
 * `FINERACT_DATE_FORMAT`. Each endpoint's format lives here, next to the call that sends it,
 * because Fineract parses strictly against the format it is told.
 */
const ISO_DATE_FORMAT = 'yyyy-MM-dd';

/**
 * {@link TellerApi} over the generated OpenAPI client.
 *
 * One of the few places allowed to import `src/app/api` — see ADR 0006 and the `files` override
 * in `eslint.config.js`.
 */
@Injectable({ providedIn: 'root' })
export class FineractTellerApi implements TellerApi {
  private readonly tellers = inject(TellerCashManagementService);

  list(officeId?: number): Observable<Teller[]> {
    return this.tellers.getTellers(officeId).pipe(
      // `|| []` rather than `?? []`: an empty body arrives as `null` through HttpClient, and
      // a branch with no tellers is an ordinary state.
      map((payloads) => (payloads || []).map(mapTeller)),
    );
  }

  get(tellerId: number): Observable<Teller> {
    return this.tellers.getTellersTellerId(tellerId).pipe(map(mapTeller));
  }

  create(draft: TellerDraft): Observable<void> {
    return this.tellers
      .postTellers({
        name: draft.name,
        officeId: draft.officeId,
        ...ifDefined('description', draft.description),
        // The generated type declares the enum; see `toWireStatus`.
        status: toWireStatus(draft.status) as unknown as PostTellersRequest['status'],
        startDate: draft.startDate,
        dateFormat: ISO_DATE_FORMAT,
        locale: FINERACT_LOCALE,
      })
      .pipe(map(() => undefined));
  }

  update(tellerId: number, update: TellerUpdate): Observable<void> {
    return this.tellers
      .putTellersTellerId(tellerId, {
        name: update.name,
        ...ifDefined('description', update.description),
        status: toWireStatus(update.status) as unknown as PutTellersRequest['status'],
        startDate: update.startDate,
        dateFormat: ISO_DATE_FORMAT,
        locale: FINERACT_LOCALE,
      })
      .pipe(map(() => undefined));
  }

  listCashiers(tellerId: number): Observable<Cashier[]> {
    return this.tellers.getTellersTellerIdCashiers(tellerId).pipe(
      // The response describes the teller and carries its cashiers inside it. The teller fields
      // are already known to the caller, so only the cashiers are returned.
      map((envelope) => (envelope?.cashiers ?? []).map((payload) => mapCashier(payload))),
    );
  }

  createCashier(tellerId: number, draft: CashierDraft): Observable<void> {
    const body: PostTellersTellerIdCashiersRequest = {
      staffId: draft.staffId,
      isFullDay: draft.isFullDay,
      ...ifDefined('description', draft.description),
      startDate: draft.startDate,
      endDate: draft.endDate,
      dateFormat: ISO_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };
    return this.tellers.postTellersTellerIdCashiers(tellerId, body).pipe(map(() => undefined));
  }

  removeCashier(tellerId: number, cashierId: number): Observable<void> {
    return this.tellers
      .deleteTellersTellerIdCashiersCashierId(tellerId, cashierId)
      .pipe(map(() => undefined));
  }

  cashierTransactionTemplate(
    tellerId: number,
    cashierId: number,
  ): Observable<CashierTransactionTemplate> {
    return this.tellers
      .getTellersTellerIdCashiersCashierIdTransactionsTemplate(tellerId, cashierId)
      .pipe(map(mapCashierTransactionTemplate));
  }

  cashierSummary(
    tellerId: number,
    cashierId: number,
    currencyCode: string,
  ): Observable<CashierSummary> {
    return this.tellers
      .getTellersTellerIdCashiersCashierIdSummaryandtransactions(tellerId, cashierId, currencyCode)
      .pipe(map(mapCashierSummary));
  }

  allocateCash(tellerId: number, cashierId: number, draft: CashTransactionDraft): Observable<void> {
    return this.tellers
      .postTellersTellerIdCashiersCashierIdAllocate(tellerId, cashierId, cashTransactionBody(draft))
      .pipe(map(() => undefined));
  }

  settleCash(tellerId: number, cashierId: number, draft: CashTransactionDraft): Observable<void> {
    return this.tellers
      .postTellersTellerIdCashiersCashierIdSettle(tellerId, cashierId, cashTransactionBody(draft))
      .pipe(map(() => undefined));
  }
}

/**
 * The body shared by allocation and settlement.
 *
 * Fineract parses `txnDate` strictly against the `dd` in `FINERACT_DATE_FORMAT`, so an unpadded
 * day fails to parse and answers 500 rather than a validation message. `formatDateToFineract`
 * pads it and reads the ISO date through its parts, so a date does not land a day early.
 */
function cashTransactionBody(
  draft: CashTransactionDraft,
): PostTellersTellerIdCashiersCashierIdAllocateRequest {
  return {
    currencyCode: draft.currencyCode,
    txnAmount: draft.amount,
    txnDate: formatDateToFineract(draft.date),
    txnNote: draft.note,
    dateFormat: FINERACT_DATE_FORMAT,
    locale: FINERACT_LOCALE,
  };
}
