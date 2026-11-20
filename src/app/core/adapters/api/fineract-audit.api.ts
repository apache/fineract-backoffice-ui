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

import { AuditsService } from '../../../api';
import type { AuditData } from '../../../api';
import type { AuditApi, AuditEntry, AuditPage, AuditQuery, AuditSearchTemplate } from './audit.api';

/**
 * The entry as Fineract sends it, which is not what `AuditData` declares.
 *
 * - `madeOnDate` and `checkedOnDate` are declared `date-time` strings. The list is serialised by
 *   Fineract's Gson helper, which writes a `ZonedDateTime` as epoch milliseconds; the single-entry
 *   read goes through Jackson. Both forms, and the array form other dates use, are accepted.
 * - `officeId`, `groupId` and `savingsAccountId` are sent by current Fineract (FINERACT-2186) and
 *   not declared. Older servers omit them, so every link built on them is optional.
 */
type AuditPayload = Omit<AuditData, 'madeOnDate' | 'checkedOnDate'> & {
  readonly madeOnDate?: WireDateTime;
  readonly checkedOnDate?: WireDateTime;
  readonly officeId?: number;
  readonly groupId?: number;
  readonly savingsAccountId?: number;
};

type WireDateTime = string | number | number[] | null;

interface WirePage {
  readonly totalFilteredRecords?: number;
  readonly pageItems?: readonly AuditPayload[];
}

interface WireSearchTemplate {
  readonly appUsers?: readonly { readonly id?: number; readonly username?: string }[];
  readonly actionNames?: readonly string[];
  readonly entityNames?: readonly string[];
  readonly statuses?: readonly { readonly id?: number; readonly processingResult?: string }[];
}

@Injectable({ providedIn: 'root' })
export class FineractAuditApi implements AuditApi {
  private readonly audits = inject(AuditsService);

  list(query: AuditQuery): Observable<AuditPage> {
    // The status filter is sent twice on purpose. Fineract 1.11 reads it from
    // `processingResult` as an integer; current Fineract reads `status` and ignores
    // `processingResult`. Each version drops the parameter it does not know.
    const status = query.statusId === undefined ? undefined : String(query.statusId);
    // `getAudits` takes forty-one positional parameters, and the November 2026 spec sync
    // inserted eighteen of them between `locale` and `offset` — which moved `offset` into
    // `productId` and `limit` into `transactionId`. That was caught only because the types
    // happened to differ; had the inserted parameters been numbers, this would have gone on
    // compiling and sent the page size as a transaction id.
    //
    // So the arguments are built as the method's own parameter tuple. `Parameters<>` gives the
    // arity and the per-position types, so a future insertion fails here instead of silently
    // querying the wrong field, and the names below say which slot each value is filling.
    const args: Parameters<AuditsService['getAudits']> = [
      query.actionName,
      query.entityName,
      query.resourceId,
      query.makerId,
      query.madeFrom ? `${query.madeFrom} 00:00:00` : undefined,
      // Fineract compares the timestamp column against this string, so a bare date would stop
      // at midnight and drop the last day of the range.
      query.madeTo ? `${query.madeTo} 23:59:59` : undefined,
      query.checkerId,
      undefined, // checkerDateTimeFrom
      undefined, // checkerDateTimeTo
      status,
      query.clientId,
      query.loanId,
      undefined, // officeId
      undefined, // groupId
      undefined, // savingsAccountId
      status, // processingResult — see the note above on sending the status twice
      undefined, // dateFormat
      undefined, // locale
      undefined, // productId
      undefined, // transactionId
      undefined, // subresourceId
      undefined, // resourceExternalId
      undefined, // subresourceExternalId
      undefined, // loanExternalId
      undefined, // submittedOfficeId
      undefined, // submittedGroupId
      undefined, // submittedClientId
      undefined, // submittedLoanId
      undefined, // submittedSavingsAccountId
      undefined, // submittedProductId
      undefined, // submittedTransactionId
      undefined, // submittedResourceId
      undefined, // submittedResourceExternalId
      undefined, // submittedSubresourceId
      undefined, // submittedSubresourceExternalId
      undefined, // submittedLoanExternalId
      query.offset,
      query.limit,
      query.orderBy,
      query.sortOrder,
      true, // paged
    ];
    return this.audits.getAudits(...args).pipe(
      map((data) => {
        const page = parsePage(data);
        return {
          items: (page.pageItems ?? []).map(toEntry),
          totalFilteredRecords: page.totalFilteredRecords ?? 0,
        };
      }),
    );
  }

  get(auditId: number): Observable<AuditEntry> {
    return this.audits
      .getAuditsAuditId(auditId)
      .pipe(map((data) => toEntry(data as unknown as AuditPayload)));
  }

  searchTemplate(): Observable<AuditSearchTemplate> {
    return this.audits.getAuditsSearchtemplate().pipe(
      map((data) => {
        const wire = (data ?? {}) as WireSearchTemplate;
        return {
          users: (wire.appUsers ?? [])
            .filter((user) => typeof user.id === 'number')
            .map((user) => ({ id: user.id as number, username: user.username ?? '' })),
          actionNames: wire.actionNames ?? [],
          entityNames: wire.entityNames ?? [],
          statuses: (wire.statuses ?? [])
            .filter((status) => typeof status.id === 'number')
            .map((status) => ({ id: status.id as number, name: status.processingResult ?? '' })),
        };
      }),
    );
  }
}

/** The list is typed as a string by the generated client; the body is the JSON page. */
function parsePage(data: unknown): WirePage {
  const parsed: unknown = typeof data === 'string' ? (data ? JSON.parse(data) : {}) : data;
  if (Array.isArray(parsed)) {
    return { pageItems: parsed as AuditPayload[], totalFilteredRecords: parsed.length };
  }
  return (parsed ?? {}) as WirePage;
}

function toEntry(row: AuditPayload): AuditEntry {
  return {
    id: row.id ?? 0,
    actionName: row.actionName ?? '',
    entityName: row.entityName ?? '',
    resourceId: row.resourceId ?? null,
    subresourceId: row.subresourceId ?? null,
    maker: row.maker ?? '',
    madeOnDate: toIsoDateTime(row.madeOnDate),
    checker: row.checker ?? '',
    checkedOnDate: toIsoDateTime(row.checkedOnDate),
    processingResult: row.processingResult ?? '',
    officeId: row.officeId ?? null,
    officeName: row.officeName ?? '',
    groupId: row.groupId ?? null,
    groupName: row.groupName ?? '',
    clientId: row.clientId ?? null,
    clientName: row.clientName ?? '',
    loanId: row.loanId ?? null,
    loanAccountNo: row.loanAccountNo ?? '',
    savingsAccountId: row.savingsAccountId ?? null,
    savingsAccountNo: row.savingsAccountNo ?? '',
    commandAsJson: row.commandAsJson ?? null,
  };
}

/**
 * Normalises a Fineract timestamp to an ISO string.
 *
 * Epoch milliseconds and ISO strings name an instant. The array form carries no zone, so it is
 * read as local time; it is only a fallback for servers that serialise that way.
 */
export function toIsoDateTime(value: WireDateTime | undefined): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'string') return value;

  const [year, month, day, hour = 0, minute = 0, second = 0] = value;
  if (typeof year !== 'number' || typeof month !== 'number' || typeof day !== 'number') {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`;
}
