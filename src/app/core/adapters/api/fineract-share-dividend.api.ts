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

import { SelfDividendService } from '../../../api';
import { formatArrayDate } from '../../utils/date-formatter';
import { isMakerCheckerPending } from '../../utils/mutation-response';
import type {
  ShareDividend,
  ShareDividendApi,
  ShareDividendApproveOutcome,
  ShareDividendPayout,
  ShareDividendPayoutPage,
  ShareDividendPayoutQuery,
  ShareDividendPayoutStatus,
  ShareDividendStatus,
} from './share-dividend.api';

/** What Fineract sends for an enum: `{ id, code, value }`. */
interface WireEnum {
  readonly id?: number;
}

/** `ShareProductDividendPayOutData`, as far as the screens read it. */
interface WireDividend {
  readonly id?: number;
  readonly amount?: number;
  readonly status?: WireEnum;
  readonly dividendPeriodStartDate?: unknown;
  readonly dividendPeriodEndDate?: unknown;
}

/** `ShareAccountDividendData`; its account is a lookup carrying only ids, number and client. */
interface WirePayout {
  readonly id?: number;
  readonly amount?: number;
  readonly status?: WireEnum;
  readonly accountData?: {
    readonly id?: number;
    readonly accountNo?: string;
    readonly clientName?: string;
  };
}

interface WirePage<T> {
  readonly totalFilteredRecords?: number;
  readonly pageItems?: readonly T[];
}

/** {@link ShareDividendApi} over the generated OpenAPI client. */
@Injectable({ providedIn: 'root' })
export class FineractShareDividendApi implements ShareDividendApi {
  private readonly dividends = inject(SelfDividendService);

  list(productId: number): Observable<readonly ShareDividend[]> {
    // Both reads are typed as a string by the generated client; the body is the JSON page.
    return this.dividends
      .getShareproductProductIdDividend(productId)
      .pipe(map((data) => (parsePage<WireDividend>(data).pageItems ?? []).map(toDividend)));
  }

  get(
    productId: number,
    dividendId: number,
    query: ShareDividendPayoutQuery = {},
  ): Observable<ShareDividendPayoutPage> {
    // The generated method takes the dividend id first, unlike every other dividend call.
    return this.dividends
      .getShareproductProductIdDividendDividendId(
        dividendId,
        productId,
        query.offset,
        query.limit,
        undefined,
        undefined,
        query.accountNo || undefined,
      )
      .pipe(
        map((data) => {
          const page = parsePage<WirePayout>(data);
          return {
            items: (page.pageItems ?? []).map(toPayout),
            totalFilteredRecords: page.totalFilteredRecords ?? 0,
          };
        }),
      );
  }

  approve(productId: number, dividendId: number): Observable<ShareDividendApproveOutcome> {
    // The generated signature types the body as a string; the command carries no fields.
    return this.dividends
      .putShareproductProductIdDividendDividendId(productId, dividendId, 'approve', '{}')
      .pipe(map((response) => ({ pendingApproval: isQueued(response) })));
  }

  delete(productId: number, dividendId: number): Observable<void> {
    return this.dividends
      .deleteShareproductProductIdDividendDividendId(productId, dividendId)
      .pipe(map(() => undefined));
  }
}

/**
 * Whether maker-checker queued the command. Fineract answers a queued command with
 * `rollbackTransaction: true` and the command's entity id as `resourceId`
 * (`RollbackTransactionNotApprovedException`), and for approve that id is the dividend's, so the
 * shared resource-id check alone reads a queued approval as applied.
 */
function isQueued(response: unknown): boolean {
  const rollback = (response as { rollbackTransaction?: unknown } | null)?.rollbackTransaction;
  return rollback === true || isMakerCheckerPending(response);
}

function parsePage<T>(data: unknown): WirePage<T> {
  const parsed: unknown = typeof data === 'string' ? (data ? JSON.parse(data) : {}) : data;
  if (Array.isArray(parsed))
    return { pageItems: parsed as T[], totalFilteredRecords: parsed.length };
  return (parsed ?? {}) as WirePage<T>;
}

function toDividend(row: WireDividend): ShareDividend {
  return {
    id: row.id ?? 0,
    amount: row.amount ?? null,
    status: dividendStatus(row.status?.id),
    periodStartDate: isoDate(row.dividendPeriodStartDate),
    periodEndDate: isoDate(row.dividendPeriodEndDate),
  };
}

function toPayout(row: WirePayout): ShareDividendPayout {
  return {
    id: row.id ?? 0,
    accountId: row.accountData?.id ?? null,
    accountNo: row.accountData?.accountNo ?? '',
    clientName: row.accountData?.clientName ?? '',
    amount: row.amount ?? null,
    status: payoutStatus(row.status?.id),
  };
}

function dividendStatus(id: number | undefined): ShareDividendStatus {
  if (id === 100) return 'pending';
  if (id === 300) return 'approved';
  return 'unknown';
}

function payoutStatus(id: number | undefined): ShareDividendPayoutStatus {
  if (id === 100) return 'pending';
  if (id === 300) return 'posted';
  return 'unknown';
}

function isoDate(value: unknown): string | null {
  const formatted = formatArrayDate(value);
  return formatted === '-' ? null : formatted;
}
