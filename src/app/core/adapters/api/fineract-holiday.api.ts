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
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';
import type { Observable } from 'rxjs';

import { HolidaysService } from '../../../api';
import type { GetHolidaysResponse } from '../../../api';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatDateToFineract,
} from '../../utils/date-formatter';
import { toIsoFineractDate } from './fineract-date';
import { RESCHEDULING_TYPE } from './holiday-rescheduling-type';
import type { ReschedulingType } from './holiday-rescheduling-type';
import type {
  Holiday,
  HolidayApi,
  HolidayDraft,
  HolidayStatus,
  ReschedulingOption,
} from './holiday.api';

/**
 * What a holiday actually sends, where that differs from `GetHolidaysResponse`.
 *
 * All three dates are declared `string` and arrive as `[year, month, day]`, so all three are
 * widened through `Omit`. `description` and `reschedulingType` are sent and never declared.
 */
type HolidayPayload = Omit<
  GetHolidaysResponse,
  'fromDate' | 'toDate' | 'repaymentsRescheduledTo' | 'status'
> & {
  readonly fromDate?: string | number[];
  readonly toDate?: string | number[];
  readonly repaymentsRescheduledTo?: string | number[];
  readonly status?: { id?: number; code?: string; value?: string };
  /** Sent by Fineract, absent from the generated model. */
  readonly description?: string;
  readonly reschedulingType?: number;
};

/** The two values Fineract accepts, as a guard rather than a cast. */
function toReschedulingType(value: number | undefined): ReschedulingType | null {
  return value === RESCHEDULING_TYPE.NextRepaymentDate || value === RESCHEDULING_TYPE.SpecifiedDate
    ? value
    : null;
}

/**
 * Maps one holiday status onto the application model.
 *
 * `isPending` is derived once here rather than inferred per screen. The holidays list decides
 * whether to offer Activate from it, and deciding that from the display text would break on any
 * platform not serving English — the mistake the loans list was making before `LOAN_API`.
 */
export function mapHolidayStatus(payload: HolidayPayload['status']): HolidayStatus {
  const code = payload?.code ?? '';
  return {
    id: payload?.id ?? null,
    code,
    value: payload?.value ?? '',
    isPending: code.includes('pending'),
  };
}

/**
 * Maps one holiday payload onto the application model.
 *
 * Exported for its own test. This is where an upstream shape change is meant to surface.
 */
export function mapHoliday(payload: HolidayPayload): Holiday {
  return {
    // A holiday without an id cannot be activated or deleted — the id is the path segment.
    id: required(payload.id, 'id'),
    name: payload.name ?? '',
    description: payload.description ?? '',
    fromDate: toIsoFineractDate(payload.fromDate),
    toDate: toIsoFineractDate(payload.toDate),
    repaymentsRescheduledTo: toIsoFineractDate(payload.repaymentsRescheduledTo),
    officeId: payload.officeId ?? null,
    status: mapHolidayStatus(payload.status),
    reschedulingType: toReschedulingType(payload.reschedulingType),
  };
}

function required<T>(value: T | undefined, field: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Fineract returned a holiday with no ${field}`);
  }
  return value;
}

/** The two options the platform has, used when the template cannot be read. */
const FALLBACK_OPTIONS: readonly ReschedulingOption[] = [
  { id: RESCHEDULING_TYPE.NextRepaymentDate, value: 'Reschedule to next repayment date' },
  { id: RESCHEDULING_TYPE.SpecifiedDate, value: 'Reschedule to specified date' },
];

/**
 * Builds the body a create or update sends.
 *
 * `repaymentsRescheduledTo` is omitted unless the rule asks for it: Fineract rejects a holiday
 * that names a reschedule date under the "next repayment date" rule, and the form's own guard
 * already refused to submit one.
 */
function draftBody(draft: HolidayDraft): Record<string, unknown> {
  const needsDate = draft.reschedulingType === RESCHEDULING_TYPE.SpecifiedDate;
  return {
    name: draft.name,
    description: draft.description ?? undefined,
    fromDate: formatDateToFineract(draft.fromDate),
    toDate: formatDateToFineract(draft.toDate),
    reschedulingType: draft.reschedulingType,
    ...(needsDate && draft.repaymentsRescheduledTo
      ? { repaymentsRescheduledTo: formatDateToFineract(draft.repaymentsRescheduledTo) }
      : {}),
    ...(draft.officeIds === undefined
      ? {}
      : { offices: draft.officeIds.map((officeId) => ({ officeId })) }),
    dateFormat: FINERACT_DATE_FORMAT,
    locale: FINERACT_LOCALE,
  };
}

/**
 * {@link HolidayApi} over the generated OpenAPI client.
 *
 * One of the few places allowed to import `src/app/api` — see ADR 0006 and the `files` override
 * in `eslint.config.js`.
 */
@Injectable({ providedIn: 'root' })
export class FineractHolidayApi implements HolidayApi {
  private readonly holidays = inject(HolidaysService);

  list(officeId?: number): Observable<Holiday[]> {
    return this.holidays.getHolidays(officeId).pipe(
      // `|| []` rather than `?? []`: an office with no holidays answers with an empty body,
      // which arrives as `null` through HttpClient. Verified against a running instance.
      map((payloads) => (payloads || []).map((payload) => mapHoliday(payload as HolidayPayload))),
    );
  }

  get(holidayId: number): Observable<Holiday> {
    return this.holidays
      .getHolidaysHolidayId(holidayId)
      .pipe(map((payload) => mapHoliday(payload as HolidayPayload)));
  }

  reschedulingOptions(): Observable<ReschedulingOption[]> {
    return this.holidays.getHolidaysTemplate().pipe(
      map((data) => {
        // This endpoint has been seen to answer with a JSON *string* rather than a parsed body,
        // so the previous caller parsed defensively. That is a transport quirk and belongs here.
        const parsed: unknown = typeof data === 'string' ? JSON.parse(data) : data;
        return Array.isArray(parsed) && parsed.length > 0
          ? (parsed as ReschedulingOption[])
          : [...FALLBACK_OPTIONS];
      }),
      catchError(() => of([...FALLBACK_OPTIONS])),
    );
  }

  create(draft: HolidayDraft): Observable<void> {
    return this.holidays.postHolidays(draftBody(draft)).pipe(map(() => undefined));
  }

  update(holidayId: number, draft: HolidayDraft): Observable<void> {
    // The generated request type declares only `name` and `description`; the endpoint accepts
    // the dates too. See the note on `HolidayApi.update`.
    return this.holidays
      .putHolidaysHolidayId(holidayId, draftBody(draft))
      .pipe(map(() => undefined));
  }

  activate(holidayId: number): Observable<void> {
    return this.holidays
      .postHolidaysHolidayId(holidayId, {}, 'activate')
      .pipe(map(() => undefined));
  }

  remove(holidayId: number): Observable<void> {
    return this.holidays.deleteHolidaysHolidayId(holidayId).pipe(map(() => undefined));
  }
}
