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

import { FineractAccountingClosureApi } from './fineract-accounting-closure.api';

/**
 * An accounting period closure, as the application understands one.
 *
 * This is ADR 0006's worked example, and it was chosen because the screen built on the
 * generated type had a bug that the generated type could not prevent.
 *
 * `GetGlClosureResponse` declares twelve fields and every one of them is optional, because the
 * spec marks nothing required. The list screen bound `closure.isClosed` through an untyped
 * `ng-template` context — and there is no `isClosed` on that response, nor in the payload
 * Fineract actually returns. The expression was `undefined` on every row, so every closed
 * period rendered as "Open". `strictTemplates` is on and could not see it; no unit test caught
 * it either, because the fixtures were built from the same generated type.
 *
 * So the model below is not a rename of the generated one. It differs in the three ways that
 * matter: the fields a screen needs are non-optional, absence is `null` rather than `undefined`
 * so a template cannot silently read past it, and `isClosed` is *derived* in one tested place
 * rather than assumed at each call site.
 */
export interface AccountingClosure {
  readonly id: number;
  readonly officeId: number;
  readonly officeName: string;
  /** ISO-8601 date, as Fineract returns it (`2026-09-01`), or `null` when unset. */
  readonly closingDate: string | null;
  readonly comments: string | null;
  /**
   * Whether the period is closed.
   *
   * Fineract has no such field. A GL closure row *is* the closure of a period, and re-opening
   * deletes the row, so a row that is present and not deleted means the period is closed. That
   * inference belongs here, once, rather than in a template expression.
   */
  readonly isClosed: boolean;
}

/** What the application needs in order to close a period. */
export interface NewAccountingClosure {
  readonly officeId: number;
  /** ISO-8601 date; the adapter is responsible for whatever format Fineract wants. */
  readonly closingDate: string;
  readonly comments?: string;
}

/**
 * Accounting-period closures, stated as application operations.
 *
 * Deliberately narrow: three methods, because three are used. ADR 0001 rejected a facade that
 * mirrored ~54 generated services, and ADR 0006 keeps that rejection — a contract earns its
 * place by removing a coupling that has cost something, not by existing for symmetry.
 */
export interface AccountingClosureApi {
  /** Every closure, most recent first as Fineract orders them. */
  list(): Observable<AccountingClosure[]>;

  /** Closes a period. */
  create(closure: NewAccountingClosure): Observable<void>;

  /** Re-opens a period by removing its closure. */
  remove(id: number): Observable<void>;
}

/**
 * Injection token for the active {@link AccountingClosureApi}.
 *
 * Defaults to the Fineract implementation, so nothing needs configuring for it to work — the
 * same shape as `STORAGE`, `I18N` and the other ADR 0003 tokens.
 */
export const ACCOUNTING_CLOSURE_API = new InjectionToken<AccountingClosureApi>(
  'AccountingClosureApi',
  {
    providedIn: 'root',
    factory: () => inject(FineractAccountingClosureApi),
  },
);
