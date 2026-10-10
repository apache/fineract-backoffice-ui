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

import { FineractStaffApi } from './fineract-staff.api';

/**
 * A staff member, as the application understands one.
 *
 * ## The disagreement here is the opposite of the usual one
 *
 * `StaffData` declares `joiningDate?: string`, and that is **correct** — verified against a
 * running instance, `GET /staff/{id}` really does send a string:
 *
 * ```
 * GET /staff/1  → "joiningDate":"2020-01-01"     ← string
 * GET /offices  → "openingDate":[2009,1,1]       ← array
 * ```
 *
 * Two endpoints in the same Organization area, two date encodings. So the application
 * distrusted the type that happened to be right, and `staff-form.component.ts` read the field
 * through the array converter:
 *
 * ```ts
 * this.joiningDate.set(formatArrayDate(data.joiningDate));
 * ```
 *
 * `formatArrayDate()` returns the literal string `'-'` for anything that is not a `[y, m, d]`
 * array, so the staff edit form showed `'-'` where the joining date should be. The control is
 * `[disabled]` in edit mode and `onSubmit()` does not send it, so nothing was persisted wrongly
 * — it is a display defect, not data loss.
 *
 * Its spec passed throughout, because the fixture invented an array the endpoint never sends:
 *
 * ```ts
 * of({ joiningDate: [2026, 1, 5] }) as unknown as ReturnType<StaffService['getStaffStaffId']>
 * ```
 *
 * That is the failure mode ADR 0006 names: a fixture built from a generated type inherits the
 * spec's blind spots. The lesson is not "trust the type" — it is that a screen cannot tell from
 * the type which encoding it is getting, and should not have to. `toIsoFineractDate()` accepts
 * both forms, so this model is an ISO string either way and a platform that changes its mind
 * needs no change here.
 */
export interface Staff {
  readonly id: number;
  readonly firstname: string;
  readonly lastname: string;
  /** The `Lastname, Firstname` form Fineract builds for display. */
  readonly displayName: string;
  readonly officeId: number | null;
  readonly officeName: string;
  readonly externalId: string | null;
  readonly mobileNo: string | null;
  readonly emailAddress: string | null;
  readonly isLoanOfficer: boolean;
  readonly isActive: boolean;
  /** ISO-8601 `YYYY-MM-DD`, whichever encoding Fineract used. */
  readonly joiningDate: string | null;
}

/** How a staff query is narrowed. */
export interface StaffQuery {
  /**
   * Fineract's `officeId`. Staff are scoped by office and the platform refuses one from
   * elsewhere, so a picker that offers staff must choose an office first.
   */
  readonly officeId?: number;
  /** Fineract's `loanOfficersOnly`, for the pickers that may only offer loan officers. */
  readonly loanOfficersOnly?: boolean;
  /**
   * Fineract's `status`: `active` (its default), `inactive` or `all`.
   *
   * Passed through rather than modelled as a union of our own — these are the platform's own
   * values and it validates them. Worth knowing that omitting it is *not* "any status": the
   * default hides inactive staff, which is why the staff list asks for `all` explicitly.
   */
  readonly status?: string;
}

/** What creating a staff member collects. The adapter adds the date format and locale. */
export interface StaffDraft {
  readonly officeId: number;
  readonly firstname: string;
  readonly lastname: string;
  readonly externalId?: string | null;
  readonly mobileNo?: string | null;
  readonly emailAddress?: string | null;
  readonly isLoanOfficer: boolean;
  readonly isActive: boolean;
  readonly forceStatus?: boolean;
  /** ISO-8601 `YYYY-MM-DD`. Converted to Fineract's wire format by the adapter. */
  readonly joiningDate: string;
}

/**
 * What editing a staff member can change.
 *
 * Only these two, because only these two are what `staff-form.component.ts` sends on the edit
 * path — Fineract's update endpoint accepts more, but nothing here asks it to, and a contract
 * wider than its callers is the speculative abstraction ADR 0006 warns against.
 */
export interface StaffUpdate {
  readonly externalId?: string | null;
  readonly isLoanOfficer?: boolean;
}

/** Staff, stated as application operations. */
export interface StaffApi {
  /** Staff matching `query`, as Fineract orders them. */
  list(query?: StaffQuery): Observable<Staff[]>;

  /** One staff member by id, which is what the edit form loads. */
  get(staffId: number): Observable<Staff>;

  /** Creates a staff member. */
  create(draft: StaffDraft): Observable<void>;

  /** Updates a staff member. */
  update(staffId: number, update: StaffUpdate): Observable<void>;
}

/** Injection token for the active {@link StaffApi}. Defaults to the Fineract implementation. */
export const STAFF_API = new InjectionToken<StaffApi>('StaffApi', {
  providedIn: 'root',
  factory: () => inject(FineractStaffApi),
});
