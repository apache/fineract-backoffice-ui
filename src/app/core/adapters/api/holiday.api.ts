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

import { FineractHolidayApi } from './fineract-holiday.api';
import type { ReschedulingType } from './holiday-rescheduling-type';

/** A holiday's status, as Fineract's enum sends it. */
export interface HolidayStatus {
  readonly id: number | null;
  /** The stable key (`holidayStatusType.pending.for.activation`), safe to branch on. */
  readonly code: string;
  /** Fineract's display text. For rendering only; branch on `code` or `isPending`. */
  readonly value: string;
  /** True while the holiday still needs activating — the only state Activate is offered in. */
  readonly isPending: boolean;
}

/**
 * A holiday, as the application understands one.
 *
 * Three dates, all declared `string` by `GetHolidaysResponse` and all sent as
 * `[year, month, day]` — verified against a running instance:
 *
 * ```json
 * {"id":1,"name":"...","fromDate":[2027,1,5],"toDate":[2027,1,5],
 *  "repaymentsRescheduledTo":[2027,1,6],"status":{...},"reschedulingType":2}
 * ```
 *
 * `description` and `reschedulingType` are sent and not declared at all.
 *
 * This domain is where the cost of leaving that to each screen is clearest. The conversion
 * existed in two more copies before this adapter: `holidays-list.component.ts` had a local
 * `formatArrayDate(dateArray: unknown)`, and `holiday-form.component.ts` had `pickerDate`,
 * which is `toIsoFineractDate` rewritten line for line. Both take `unknown` or widen, because
 * the declared type cannot be used. That makes five copies of one conversion across the
 * codebase, which is the argument for this boundary in one sentence.
 */
export interface Holiday {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  /** ISO-8601 `YYYY-MM-DD`, converted from Fineract's `[year, month, day]`. */
  readonly fromDate: string | null;
  readonly toDate: string | null;
  /** Set only when the holiday reschedules to a named date. */
  readonly repaymentsRescheduledTo: string | null;
  readonly officeId: number | null;
  readonly status: HolidayStatus;
  readonly reschedulingType: ReschedulingType | null;
}

/** One option from the holiday template's rescheduling list. */
export interface ReschedulingOption {
  readonly id: number;
  readonly value: string;
}

/** What creating or editing a holiday collects. The adapter adds the date format and locale. */
export interface HolidayDraft {
  readonly name: string;
  readonly description?: string | null;
  /** ISO-8601 `YYYY-MM-DD`. Converted to Fineract's wire format by the adapter. */
  readonly fromDate: string;
  readonly toDate: string;
  readonly reschedulingType: ReschedulingType;
  /** Required by Fineract when `reschedulingType` is `SpecifiedDate`, ignored otherwise. */
  readonly repaymentsRescheduledTo?: string | null;
  /** The offices the holiday applies to. Sent on create; `PUT` does not move a holiday. */
  readonly officeIds?: readonly number[];
}

/**
 * Holidays, stated as application operations.
 *
 * `update` takes the same draft as `create` even though `PutHolidaysHolidayIdRequest` declares
 * only `name` and `description`. The generated type is wrong, not the form: verified against a
 * running instance, `PUT /holidays/{id}` answers with the dates in its `changes` block and the
 * re-read shows them applied —
 *
 * ```json
 * {"resourceId":1,"changes":{"description":"probe","fromDate":"07 January 2027",
 *   "toDate":"07 January 2027","repaymentsRescheduledTo":"08 January 2027", ...}}
 * ```
 *
 * The form was already sending all of it, through a `Record<string, unknown>` cast to a type
 * that declares none of it. That cast is what this contract removes.
 */
export interface HolidayApi {
  /** Holidays for an office, as Fineract orders them. */
  list(officeId?: number): Observable<Holiday[]>;

  /** One holiday by id, which is what the edit form loads. */
  get(holidayId: number): Observable<Holiday>;

  /**
   * The rescheduling options the platform offers.
   *
   * Falls back to the two known values when the template cannot be read, because the form
   * cannot be filled without them and they are fixed in the platform.
   */
  reschedulingOptions(): Observable<ReschedulingOption[]>;

  create(draft: HolidayDraft): Observable<void>;

  update(holidayId: number, draft: HolidayDraft): Observable<void>;

  /** Activates a pending holiday. */
  activate(holidayId: number): Observable<void>;

  remove(holidayId: number): Observable<void>;
}

/** Injection token for the active {@link HolidayApi}. Defaults to the Fineract implementation. */
export const HOLIDAY_API = new InjectionToken<HolidayApi>('HolidayApi', {
  providedIn: 'root',
  factory: () => inject(FineractHolidayApi),
});
