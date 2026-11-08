/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
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
import { FineractCollectionSheetApi } from './fineract-collection-sheet.api';

/**
 * What one loan owes at the meeting.
 *
 * The amounts are the ones Fineract's `LoanDueData` carries. `totalDue` is its own field rather
 * than a sum computed here: the platform decides what the client is being asked for, and a sheet
 * that disagreed with the platform's own total would be worse than no sheet.
 */
export interface CollectionSheetLoanDue {
  readonly loanId: number;
  readonly accountId: string;
  readonly productShortName: string;
  readonly currencyCode: string;
  readonly principalDue: number;
  readonly interestDue: number;
  readonly feeDue: number;
  readonly chargesDue: number;
  readonly totalDue: number;
  /** Non-zero when the meeting is also where the loan is handed over. */
  readonly disbursementAmount: number;
}

/** What one savings account owes at the meeting. */
export interface CollectionSheetSavingsDue {
  readonly savingsId: number;
  readonly accountId: string;
  readonly productName: string;
  readonly currencyCode: string;
  readonly dueAmount: number;
}

/** One client's row on the sheet. */
export interface CollectionSheetClient {
  readonly clientId: number;
  readonly clientName: string;
  readonly loans: readonly CollectionSheetLoanDue[];
  readonly savings: readonly CollectionSheetSavingsDue[];
  /** Everything this client owes across loans and savings, in the sheet's currency. */
  readonly totalDue: number;
}

/** One group on the sheet, as Fineract groups the clients. */
export interface CollectionSheetGroup {
  readonly groupId: number;
  readonly groupName: string;
  readonly staffName: string;
  readonly levelName: string;
  readonly clients: readonly CollectionSheetClient[];
  readonly totalDue: number;
}

/**
 * A generated collection sheet: the document a field officer carries to a meeting.
 *
 * Shaped after Fineract's `JLGCollectionSheetData`, not after the generated
 * `PostCollectionSheetResponse` — that type describes the **save** response (`changes`,
 * `groupId`, `resourceId`) and carries nothing a sheet needs. Rendering from it is what left
 * this screen printing a JSON dump (#670), and it is the same class of mismatch as #653.
 */
export interface CollectionSheet {
  /** ISO-8601 `YYYY-MM-DD`, or `null` when Fineract sent none. */
  readonly dueDate: string | null;
  readonly groups: readonly CollectionSheetGroup[];
  /** Everything the sheet asks for, across every group. */
  readonly totalDue: number;
}

/** What generating a sheet needs. */
export interface CollectionSheetRequest {
  readonly officeId: number;
  readonly staffId?: number;
  /** ISO-8601 `YYYY-MM-DD`. */
  readonly transactionDate: string;
}

/** Collection sheets, as the application needs them. */
export interface CollectionSheetApi {
  /**
   * Generates the sheet for a meeting.
   *
   * Answers `null` when nothing is due: Fineract replies 200 with an empty body in that case,
   * which is an answer rather than a failure.
   */
  generate(request: CollectionSheetRequest): Observable<CollectionSheet | null>;

  /**
   * Submits the sheet with `command=save`.
   *
   * Carries the filters and nothing else, which is all this screen has to send: it does not yet
   * collect what was actually paid at the meeting. Fineract's save command accepts
   * `bulkRepaymentTransactions` and `bulkDisbursementTransactions`, and until the screen offers
   * fields for them a save records no collections — the remaining half of #670.
   */
  save(request: CollectionSheetRequest): Observable<void>;
}

/** Injection token for the active {@link CollectionSheetApi}. */
export const COLLECTION_SHEET_API = new InjectionToken<CollectionSheetApi>('CollectionSheetApi', {
  providedIn: 'root',
  factory: () => inject(FineractCollectionSheetApi),
});
