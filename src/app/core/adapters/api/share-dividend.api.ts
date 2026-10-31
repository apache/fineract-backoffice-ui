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

import { FineractShareDividendApi } from './fineract-share-dividend.api';

/**
 * Where a declared dividend stands (`ShareProductDividendStatusType`). Fineract posts it to the
 * share accounts only once it is approved; `unknown` covers its INVALID value and anything newer.
 */
export type ShareDividendStatus = 'pending' | 'approved' | 'unknown';

/** Where one account's share of a dividend stands (`ShareAccountDividendStatusType`). */
export type ShareDividendPayoutStatus = 'pending' | 'posted' | 'unknown';

/** A dividend declared on a share product, as the dividend list returns it. */
export interface ShareDividend {
  readonly id: number;
  readonly amount: number | null;
  readonly status: ShareDividendStatus;
  /** `YYYY-MM-DD`, or null when Fineract sent none. */
  readonly periodStartDate: string | null;
  readonly periodEndDate: string | null;
}

/** The amount one share account receives from a dividend. */
export interface ShareDividendPayout {
  readonly id: number;
  readonly accountId: number | null;
  readonly accountNo: string;
  readonly clientName: string;
  readonly amount: number | null;
  readonly status: ShareDividendPayoutStatus;
}

/** One page of a dividend's per-account payouts, with the total the paginator needs. */
export interface ShareDividendPayoutPage {
  readonly items: readonly ShareDividendPayout[];
  readonly totalFilteredRecords: number;
}

/** How the payouts are narrowed. All optional; an omitted field is not sent. */
export interface ShareDividendPayoutQuery {
  readonly offset?: number;
  readonly limit?: number;
  /** An exact match on the share account number. */
  readonly accountNo?: string;
}

/** What came of approving a dividend. */
export interface ShareDividendApproveOutcome {
  /** Maker-checker queued the approval for `APPROVE_DIVIDEND_SHAREPRODUCT_CHECKER`. */
  readonly pendingApproval: boolean;
}

/**
 * Share product dividends, stated as the operations the dividend screens use (ADR 0006).
 * Declaring still goes through the generated client in the form.
 */
export interface ShareDividendApi {
  /** Every dividend declared on the product. This is the only source of a dividend's header. */
  list(productId: number): Observable<readonly ShareDividend[]>;
  /** One page of the amounts a dividend pays each share account. */
  get(
    productId: number,
    dividendId: number,
    query?: ShareDividendPayoutQuery,
  ): Observable<ShareDividendPayoutPage>;
  /** Approves a pending dividend, after which the posting job credits each account. */
  approve(productId: number, dividendId: number): Observable<ShareDividendApproveOutcome>;
  /** Deletes a dividend. Fineract allows this only while it is pending. */
  delete(productId: number, dividendId: number): Observable<void>;
}

/** Injection token for the active {@link ShareDividendApi}; defaults to Fineract's. */
export const SHARE_DIVIDEND_API = new InjectionToken<ShareDividendApi>('ShareDividendApi', {
  providedIn: 'root',
  factory: () => inject(FineractShareDividendApi),
});
