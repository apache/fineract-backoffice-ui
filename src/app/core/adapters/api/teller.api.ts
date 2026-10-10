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

import { FineractTellerApi } from './fineract-teller.api';

/**
 * A teller's status, as the platform names it.
 *
 * Branch on this, never on a display string. The generated `GetTellersResponse.StatusEnum` is
 * a real enum, so the model exposes it as one rather than as text a template compares.
 */
export type TellerStatus = 'INVALID' | 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'CLOSED';

/**
 * A teller, as the application understands one.
 *
 * The generated type is not wrong about `startDate` — it declares a string and `GET /tellers`
 * sends one, `"2026-10-02"`. The defect was on the screen: the teller list ran that value
 * through `formatArrayDate()`, which answers `'-'` for anything that is not a `[y, m, d]` array,
 * so every teller showed a dash in its Start Date column. The edit form had the same blind
 * spot in a worse form, converting the string as if it were an array and saving the result,
 * which is how an edit could write a start date of 1901-12-02. Both are fixed by reading the
 * date once, here, in {@link toIsoFineractDate}'s two encodings.
 */
export interface Teller {
  readonly id: number;
  readonly name: string;
  /** Sent by Fineract, absent from the generated model. */
  readonly description: string | null;
  readonly officeId: number | null;
  readonly officeName: string;
  readonly status: TellerStatus | null;
  /** ISO-8601 `YYYY-MM-DD`. `null` when Fineract sent none. */
  readonly startDate: string | null;
}

/** What creating a teller collects. The adapter adds the wire format and the locale. */
export interface TellerDraft {
  readonly name: string;
  readonly officeId: number;
  readonly description?: string | null;
  readonly status: TellerStatus;
  /** ISO-8601 `YYYY-MM-DD`. */
  readonly startDate: string;
}

/**
 * What editing a teller can change.
 *
 * No office: the edit form disables the office picker, and `PUT /tellers/{id}` is not asked to
 * move a teller between offices.
 */
export interface TellerUpdate {
  readonly name: string;
  readonly description?: string | null;
  readonly status: TellerStatus;
  /** ISO-8601 `YYYY-MM-DD`. The edit form sends back the date it loaded. */
  readonly startDate: string;
}

/** A cashier allocated to a teller. */
export interface Cashier {
  readonly id: number;
  readonly staffId: number | null;
  readonly staffName: string;
  readonly isFullDay: boolean;
  /** ISO-8601 `YYYY-MM-DD`. */
  readonly startDate: string | null;
  /** ISO-8601 `YYYY-MM-DD`. */
  readonly endDate: string | null;
}

/** What allocating a cashier to a teller collects. */
export interface CashierDraft {
  readonly staffId: number;
  readonly isFullDay: boolean;
  readonly description?: string | null;
  /** ISO-8601 `YYYY-MM-DD`. */
  readonly startDate: string;
  /** ISO-8601 `YYYY-MM-DD`. */
  readonly endDate: string;
}

/** A currency a cashier may transact in. Fineract scopes this list to the teller's office. */
export interface CashierCurrency {
  readonly code: string;
  /** Fineract's display label, or the currency name when it sends none. */
  readonly label: string;
}

/** What a cashier's transaction form needs before it can be filled in. */
export interface CashierTransactionTemplate {
  readonly cashierName: string;
  readonly tellerName: string;
  readonly currencies: CashierCurrency[];
}

/** One entry in a cashier's ledger. */
export interface CashierTransaction {
  /** Fineract's transaction type, such as "Allocate Cash". */
  readonly type: string | null;
  readonly amount: number;
  /** ISO-8601 `YYYY-MM-DD`. */
  readonly date: string | null;
  readonly note: string | null;
}

/** The running cash position for one cashier in one currency, and the entries behind it. */
export interface CashierSummary {
  readonly cashierName: string;
  readonly tellerName: string;
  readonly allocated: number;
  readonly settled: number;
  readonly netCash: number;
  readonly transactions: CashierTransaction[];
}

/**
 * Cash moved to or from a cashier.
 *
 * Allocation and settlement take the same payload and differ only in direction, so they share
 * one draft.
 */
export interface CashTransactionDraft {
  readonly currencyCode: string;
  readonly amount: number;
  /** ISO-8601 `YYYY-MM-DD`. Converted to Fineract's wire format by the adapter. */
  readonly date: string;
  readonly note: string;
}

/** Tellers and the cashiers allocated to them, stated as application operations. */
export interface TellerApi {
  /**
   * Every teller, optionally narrowed to one office.
   *
   * @param officeId - Fineract's `officeId`. Omitted, the list is whatever the user may see.
   */
  list(officeId?: number): Observable<Teller[]>;

  /** One teller by id, which is what the edit form loads. */
  get(tellerId: number): Observable<Teller>;

  /** Creates a teller. */
  create(draft: TellerDraft): Observable<void>;

  /** Updates a teller. */
  update(tellerId: number, update: TellerUpdate): Observable<void>;

  /**
   * The cashiers allocated to a teller.
   *
   * Read from `/tellers/{id}/cashiers` rather than the top-level `/cashiers` collection, which
   * answers `204 No Content` for every combination of filters. See `cashiers-list.component.ts`.
   */
  listCashiers(tellerId: number): Observable<Cashier[]>;

  /** Allocates a cashier to a teller. */
  createCashier(tellerId: number, draft: CashierDraft): Observable<void>;

  /** Removes a cashier's allocation. */
  removeCashier(tellerId: number, cashierId: number): Observable<void>;

  /** What the cashier's transaction forms need: names, and the currencies on offer. */
  cashierTransactionTemplate(
    tellerId: number,
    cashierId: number,
  ): Observable<CashierTransactionTemplate>;

  /**
   * The cashier's totals and ledger in one currency.
   *
   * `currencyCode` is required in practice. Without it the platform answers `200` with every
   * total at zero and no transactions, which is indistinguishable from a cashier who never
   * transacted.
   */
  cashierSummary(
    tellerId: number,
    cashierId: number,
    currencyCode: string,
  ): Observable<CashierSummary>;

  /** Moves cash from the vault to the cashier. */
  allocateCash(tellerId: number, cashierId: number, draft: CashTransactionDraft): Observable<void>;

  /** Moves cash from the cashier back to the vault. */
  settleCash(tellerId: number, cashierId: number, draft: CashTransactionDraft): Observable<void>;
}

/** Injection token for the active {@link TellerApi}. Defaults to the Fineract implementation. */
export const TELLER_API = new InjectionToken<TellerApi>('TellerApi', {
  providedIn: 'root',
  factory: () => inject(FineractTellerApi),
});
