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

import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import { CollectionSheetService } from '../../../api';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatDateToFineract,
} from '../../utils/date-formatter';
import { toIsoFineractDate } from './fineract-date';
import type {
  CollectionSheet,
  CollectionSheetApi,
  CollectionSheetClient,
  CollectionSheetGroup,
  CollectionSheetLoanDue,
  CollectionSheetRequest,
  CollectionSheetSavingsDue,
} from './collection-sheet.api';

/**
 * The payload `POST /collectionsheet?command=generate` actually answers, declared here because
 * the generated `PostCollectionSheetResponse` describes the *save* response instead.
 *
 * Traced to Fineract's own `JLGCollectionSheetData`, `JLGGroupData`, `JLGClientData`,
 * `LoanDueData` and `SavingsDueData` rather than inferred from a captured response, because on
 * an instance with no group meeting scheduled the endpoint answers 200 with an empty body and
 * the populated shape cannot be observed at all (#670). Every field is optional: this is what the
 * platform may send, not what it must.
 */
interface RawLoanDue {
  readonly loanId?: number;
  readonly accountId?: string;
  readonly productShortName?: string;
  readonly currency?: { readonly code?: string };
  readonly principalDue?: number;
  readonly interestDue?: number;
  readonly feeDue?: number;
  readonly chargesDue?: number;
  readonly totalDue?: number;
  readonly disbursementAmount?: number;
}

interface RawSavingsDue {
  readonly savingsId?: number;
  readonly accountId?: string;
  readonly productName?: string;
  readonly currency?: { readonly code?: string };
  readonly dueAmount?: number;
}

interface RawClient {
  readonly clientId?: number;
  readonly clientName?: string;
  readonly loans?: readonly RawLoanDue[];
  readonly savings?: readonly RawSavingsDue[];
}

interface RawGroup {
  readonly groupId?: number;
  readonly groupName?: string;
  readonly staffName?: string;
  readonly levelName?: string;
  readonly clients?: readonly RawClient[];
}

interface RawSheet {
  /** A `LocalDate`, which this platform sends as `[y, m, d]` on some endpoints and ISO on others. */
  readonly dueDate?: string | number[];
  readonly groups?: readonly RawGroup[];
}

const amount = (value: number | undefined): number => value ?? 0;

/** Maps one loan's dues. Exported for its own test. */
export function mapLoanDue(raw: RawLoanDue): CollectionSheetLoanDue {
  return {
    loanId: raw.loanId ?? -1,
    accountId: raw.accountId ?? '',
    productShortName: raw.productShortName ?? '',
    currencyCode: raw.currency?.code ?? '',
    principalDue: amount(raw.principalDue),
    interestDue: amount(raw.interestDue),
    feeDue: amount(raw.feeDue),
    chargesDue: amount(raw.chargesDue),
    // The platform's own total, not a sum of the parts above: it decides what is being asked
    // for, and a sheet that disagreed with it would be worse than no sheet.
    totalDue: amount(raw.totalDue),
    disbursementAmount: amount(raw.disbursementAmount),
  };
}

/** Maps one savings account's dues. Exported for its own test. */
export function mapSavingsDue(raw: RawSavingsDue): CollectionSheetSavingsDue {
  return {
    savingsId: raw.savingsId ?? -1,
    accountId: raw.accountId ?? '',
    productName: raw.productName ?? '',
    currencyCode: raw.currency?.code ?? '',
    dueAmount: amount(raw.dueAmount),
  };
}

function mapClient(raw: RawClient): CollectionSheetClient {
  const loans = (raw.loans ?? []).map(mapLoanDue);
  const savings = (raw.savings ?? []).map(mapSavingsDue);
  return {
    clientId: raw.clientId ?? -1,
    clientName: raw.clientName ?? '',
    loans,
    savings,
    totalDue:
      loans.reduce((sum, loan) => sum + loan.totalDue, 0) +
      savings.reduce((sum, account) => sum + account.dueAmount, 0),
  };
}

function mapGroup(raw: RawGroup): CollectionSheetGroup {
  const clients = (raw.clients ?? []).map(mapClient);
  return {
    groupId: raw.groupId ?? -1,
    groupName: raw.groupName ?? '',
    staffName: raw.staffName ?? '',
    levelName: raw.levelName ?? '',
    clients,
    totalDue: clients.reduce((sum, client) => sum + client.totalDue, 0),
  };
}

/**
 * Maps the generated sheet, or answers `null` when nothing is due.
 *
 * Exported for its own test. An empty body is what Fineract sends when no meeting falls on the
 * date, and it arrives as `null` — an answer, not a failure.
 */
export function mapCollectionSheet(raw: RawSheet | null | undefined): CollectionSheet | null {
  if (!raw || !raw.groups || raw.groups.length === 0) {
    return null;
  }
  const groups = raw.groups.map(mapGroup);
  return {
    dueDate: toIsoFineractDate(raw.dueDate),
    groups,
    totalDue: groups.reduce((sum, group) => sum + group.totalDue, 0),
  };
}

/**
 * {@link CollectionSheetApi} over the generated OpenAPI client.
 *
 * One of the places allowed to import `src/app/api` — see ADR 0006.
 */
@Injectable({ providedIn: 'root' })
export class FineractCollectionSheetApi implements CollectionSheetApi {
  private readonly sheets = inject(CollectionSheetService);

  generate(request: CollectionSheetRequest): Observable<CollectionSheet | null> {
    return this.sheets
      .postCollectionsheet(this.body(request), 'generate')
      .pipe(map((response) => mapCollectionSheet(response as RawSheet | null)));
  }

  save(request: CollectionSheetRequest): Observable<void> {
    return this.sheets.postCollectionsheet(this.body(request), 'save').pipe(map(() => undefined));
  }

  /** The filters both commands take. How the date is parsed is the adapter's business. */
  private body(request: CollectionSheetRequest) {
    return {
      officeId: request.officeId,
      ...(request.staffId === undefined ? {} : { staffId: request.staffId }),
      transactionDate: formatDateToFineract(request.transactionDate),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };
  }
}
