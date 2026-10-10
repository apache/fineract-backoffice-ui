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

import { StaffService } from '../../../api';
import type { StaffData } from '../../../api';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatDateToFineract,
} from '../../utils/date-formatter';
import { toIsoFineractDate } from './fineract-date';
import type { Staff, StaffApi, StaffDraft, StaffQuery, StaffUpdate } from './staff.api';

/**
 * What a staff payload actually sends, where that differs from `StaffData`.
 *
 * `joiningDate` is widened rather than corrected: the type says `string`, the instance checked
 * sends a string, and `GET /offices` proves the platform is willing to send an array for the
 * same kind of field. Accepting both is what makes the mapper indifferent to which arrives —
 * see the long note on {@link Staff}.
 *
 * `emailAddress` is sent and not declared, which `staff-form.component.ts` reached through a
 * `Record<string, unknown>` cast.
 */
type StaffPayload = Omit<StaffData, 'joiningDate'> & {
  readonly joiningDate?: string | number[];
  /** Sent by Fineract, absent from the generated model. */
  readonly emailAddress?: string;
};

/**
 * Maps one staff payload onto the application model.
 *
 * Exported for its own test. This is where an upstream shape change is meant to surface.
 */
export function mapStaff(payload: StaffPayload): Staff {
  const firstname = payload.firstname ?? '';
  const lastname = payload.lastname ?? '';
  return {
    // A staff member without an id cannot be navigated to or assigned, and defaulting it would
    // point somewhere wrong, so this fails loudly rather than plausibly.
    id: required(payload.id, 'id'),
    firstname,
    lastname,
    // Falls back to the name parts rather than an empty string: this is what every picker
    // renders, and a blank option is worse than an unformatted one.
    displayName: payload.displayName ?? `${lastname}, ${firstname}`.replace(/^, |, $/, ''),
    officeId: payload.officeId ?? null,
    officeName: payload.officeName ?? '',
    externalId: payload.externalId ?? null,
    mobileNo: payload.mobileNo ?? null,
    emailAddress: payload.emailAddress ?? null,
    isLoanOfficer: payload.isLoanOfficer === true,
    isActive: payload.isActive === true,
    joiningDate: toIsoFineractDate(payload.joiningDate),
  };
}

function required<T>(value: T | undefined, field: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Fineract returned a staff member with no ${field}`);
  }
  return value;
}

/**
 * Includes an optional text field only when the user actually filled it in.
 *
 * Sending `mobileNo: ''` does not leave the field blank — Fineract rejects the whole submission
 * with "mobileNo must contain only digits", naming a field the user deliberately left empty, so
 * no staff member could be created without a phone number. The form used to strip these itself.
 *
 * An omitted key rather than an `undefined` one: `JSON.stringify` would drop `undefined`
 * anyway, but relying on that makes the behaviour an accident of the serializer rather than
 * something this adapter promises and its spec checks.
 */
function ifPresent(field: string, value: string | null | undefined): Record<string, string> {
  return value === null || value === undefined || value === '' ? {} : { [field]: value };
}

/**
 * Fineract needs a date and the format to read it against in the same body.
 *
 * It parses strictly against the `dateFormat` it is told to use, so a request carrying one
 * without the other does not fail validation — it fails to parse, and answers 500. That pairing
 * is a transport detail, which is why it lives here and not in the form (rule 2 in
 * `DOCS/ADAPTERS.md`).
 *
 * `formatDateToFineract` is the project's own converter, reused rather than reimplemented: it
 * zero-pads the day, which Fineract's `dd` requires, and reads a date-only string through its
 * parts so the value does not land a day early west of Greenwich. Both of those are bugs this
 * repository has already shipped and fixed once; see the comment on that function.
 */
/**
 * {@link StaffApi} over the generated OpenAPI client.
 *
 * One of the few places allowed to import `src/app/api` — see ADR 0006 and the `files` override
 * in `eslint.config.js`.
 */
@Injectable({ providedIn: 'root' })
export class FineractStaffApi implements StaffApi {
  private readonly staff = inject(StaffService);

  list(query: StaffQuery = {}): Observable<Staff[]> {
    return (
      this.staff
        // Positional, in the generated signature's order:
        // officeId, staffInOfficeHierarchy, loanOfficersOnly, status.
        // `staffInOfficeHierarchy` is not a filter any screen offers.
        .getStaff(query.officeId, undefined, query.loanOfficersOnly, query.status)
        .pipe(
          // `|| []` rather than `?? []`: an empty body arrives as `null` through HttpClient, and
          // an office with no staff is an ordinary state for this endpoint.
          map((payloads) => (payloads || []).map((payload) => mapStaff(payload as StaffPayload))),
        )
    );
  }

  get(staffId: number): Observable<Staff> {
    return this.staff
      .getStaffStaffId(staffId)
      .pipe(map((payload) => mapStaff(payload as StaffPayload)));
  }

  create(draft: StaffDraft): Observable<void> {
    return this.staff
      .postStaff({
        officeId: draft.officeId,
        firstname: draft.firstname,
        lastname: draft.lastname,
        ...ifPresent('externalId', draft.externalId),
        ...ifPresent('mobileNo', draft.mobileNo),
        ...ifPresent('emailAddress', draft.emailAddress),
        isLoanOfficer: draft.isLoanOfficer,
        isActive: draft.isActive,
        ...(draft.forceStatus === undefined ? {} : { forceStatus: draft.forceStatus }),
        joiningDate: formatDateToFineract(draft.joiningDate),
        dateFormat: FINERACT_DATE_FORMAT,
        locale: FINERACT_LOCALE,
      })
      .pipe(map(() => undefined));
  }

  update(staffId: number, update: StaffUpdate): Observable<void> {
    return this.staff
      .putStaffStaffId(staffId, {
        ...ifPresent('externalId', update.externalId),
        isLoanOfficer: update.isLoanOfficer,
      })
      .pipe(map(() => undefined));
  }
}
