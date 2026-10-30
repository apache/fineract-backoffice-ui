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

/** What came of approving a dividend. */
export interface ShareDividendApproveOutcome {
  /** Maker-checker queued the approval for `APPROVE_DIVIDEND_SHAREPRODUCT_CHECKER`. */
  readonly pendingApproval: boolean;
}

/**
 * Share product dividends, stated as the operations the dividend screens use (ADR 0006).
 * Declaring and deleting still go through the generated client in the list and form.
 */
export interface ShareDividendApi {
  /** Approves a pending dividend, after which the posting job credits each account. */
  approve(productId: number, dividendId: number): Observable<ShareDividendApproveOutcome>;
}

/** Injection token for the active {@link ShareDividendApi}; defaults to Fineract's. */
export const SHARE_DIVIDEND_API = new InjectionToken<ShareDividendApi>('ShareDividendApi', {
  providedIn: 'root',
  factory: () => inject(FineractShareDividendApi),
});
