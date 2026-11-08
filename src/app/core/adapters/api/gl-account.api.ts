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
import { FineractGlAccountApi } from './fineract-gl-account.api';

/**
 * One account in the chart of accounts.
 *
 * `type` and `usage` are flattened to their labels here. The payload sends each as
 * `{ id, code, value }`, and the chart screen bound `usage` straight into a table cell, which
 * interpolated the object and printed `[object Object]` in every row. Flattening on the way in
 * is the job ADR 0006 describes: the screen asks for a label and gets a label.
 */
export interface GlAccount {
  readonly id: number;
  readonly glCode: string;
  readonly name: string;
  /** Fineract's own label, such as `Asset` or `Liability`. `''` when it sent none. */
  readonly type: string;
  /** `Detail` or `Header`. `''` when Fineract sent none. */
  readonly usage: string;
  /** Whether the account is switched off, so it stays in the chart but not in the pickers. */
  readonly disabled: boolean;
  readonly manualEntriesAllowed: boolean;
  /** `null` for a top-level account. */
  readonly parentId: number | null;
}

/** The chart of accounts, as the application needs it. */
export interface GlAccountApi {
  /** Every GL account, in the order Fineract returns them. */
  list(): Observable<GlAccount[]>;

  /**
   * Deletes a GL account.
   *
   * Fineract refuses an account with child accounts, journal entries or product mappings, and
   * the refusal names which — so callers show the platform's own words rather than inventing a
   * reason. Disabling through the edit form is the alternative for an account already in use.
   */
  delete(glAccountId: number): Observable<void>;
}

/** Injection token for the active {@link GlAccountApi}. Defaults to the Fineract implementation. */
export const GL_ACCOUNT_API = new InjectionToken<GlAccountApi>('GlAccountApi', {
  providedIn: 'root',
  factory: () => inject(FineractGlAccountApi),
});
