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

import { FineractOfficeApi } from './fineract-office.api';

/**
 * An office, as the application understands one.
 *
 * ADR 0006's second worked example, and the one that shows why the boundary is about *shapes*
 * rather than names. `GetOfficesResponse` disagrees with the payload `GET /offices` returns in
 * two ways, both verified against a running instance (see issue #653):
 *
 *   - It declares `openingDate?: string`. Fineract sends `[2009, 1, 1]` — a `[year, month, day]`
 *     array, month 1-based.
 *   - It does not declare `parentId` or `parentName`, which the payload carries. It offers
 *     `allowedParents?: Array<GetOfficesResponse>` instead, which `GET /offices` does not send.
 *
 * The application already knew about the first one, 35 times over: `formatArrayDate()` in
 * `core/utils/date-formatter.ts` takes `unknown` precisely because the declared type cannot be
 * used, and fixtures write `openingDate: [2026, 6, 16] as unknown as number[]` to get a
 * realistic value past the compiler. `offices-list.component.ts` carried a third copy of that
 * conversion inline.
 *
 * Converting once, here, is what makes `openingDate` a date everywhere downstream instead of a
 * value every screen has to re-interpret — and makes an upstream change to it a failing mapper
 * test rather than a `'-'` in a table.
 */
export interface Office {
  readonly id: number;
  readonly name: string;
  /** The hierarchy-indented name Fineract builds for display (`....Branch`). */
  readonly nameDecorated: string;
  readonly externalId: string | null;
  readonly hierarchy: string;
  /** `null` for the head office, which has no parent. Undeclared by the generated type. */
  readonly parentId: number | null;
  readonly parentName: string | null;
  /** ISO-8601 `YYYY-MM-DD`, converted from Fineract's `[year, month, day]`. */
  readonly openingDate: string | null;
}

/** What creating or editing an office collects. The adapter adds the date format and locale. */
export interface OfficeDraft {
  readonly name: string;
  readonly externalId?: string | null;
  /** ISO-8601 `YYYY-MM-DD`. Converted to Fineract's wire format by the adapter. */
  readonly openingDate: string;
  /** Omitted when creating the head office, which has no parent. */
  readonly parentId?: number | null;
}

/**
 * Offices, stated as application operations.
 *
 * `get`, `create` and `update` were added when `office-form.component.ts` and
 * `create-office-dialog.component.ts` were migrated — the condition the previous version of
 * this comment set for adding them. Adding them earlier would have been the speculative
 * abstraction ADR 0006 and `AGENTS.md` both warn against; adding them now is what lets those
 * two screens stop knowing that Fineract parses `openingDate` against a format it is told.
 */
export interface OfficeApi {
  /**
   * Every office the current user may see.
   *
   * @param includeAllOffices - Fineract's `includeAllOffices`, which widens the result past the
   *   user's own office hierarchy. Passed through rather than hidden: it changes *which* offices
   *   come back, which is an application-level question, not a transport detail.
   */
  list(includeAllOffices?: boolean): Observable<Office[]>;

  /** One office by id, which is what the edit form loads. */
  get(officeId: number): Observable<Office>;

  /**
   * Creates an office and answers its id.
   *
   * The id is returned rather than discarded because `create-office-dialog` hands it straight
   * back to whatever opened it — a client or group form that then selects the office it just
   * made. A `void` here would have quietly broken that.
   */
  create(draft: OfficeDraft): Observable<number>;

  /**
   * Updates an office.
   *
   * `parentId` is deliberately not accepted: `PUT /offices/{id}` does not move an office in the
   * hierarchy, and the form has never offered it on the edit path. Taking a field the platform
   * ignores would be a contract that lies.
   */
  update(officeId: number, draft: Omit<OfficeDraft, 'parentId'>): Observable<void>;
}

/** Injection token for the active {@link OfficeApi}. Defaults to the Fineract implementation. */
export const OFFICE_API = new InjectionToken<OfficeApi>('OfficeApi', {
  providedIn: 'root',
  factory: () => inject(FineractOfficeApi),
});
