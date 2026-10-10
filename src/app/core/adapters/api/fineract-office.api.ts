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

import { OfficesService } from '../../../api';
import type { GetOfficesResponse } from '../../../api';
import { toIsoFineractDate } from './fineract-date';
import type { Office, OfficeApi, OfficeDraft } from './office.api';

/**
 * What `GET /offices` actually sends, where that differs from the generated type.
 *
 * Writing the disagreement down as a type is the point: `openingDate` has to be widened through
 * `Omit`, because declaring `string | number[]` on a subtype of a `string` field is not a legal
 * override — which is TypeScript stating, correctly, that the generated type and the payload
 * are not compatible. See issue #653 for the captured payloads.
 */
type OfficePayload = Omit<GetOfficesResponse, 'openingDate'> & {
  /** Declared `string` upstream; sent as `[year, month, day]`. */
  readonly openingDate?: string | number[];
  /** Sent by Fineract, absent from the generated model. */
  readonly parentId?: number;
  readonly parentName?: string;
};

/**
 * Maps one office payload onto the application model.
 *
 * Exported for its own test. This is where an upstream shape change is meant to surface.
 */
export function mapOffice(payload: OfficePayload): Office {
  return {
    // Fineract always sends both; an office with no id cannot be navigated to, and defaulting
    // it would route somewhere wrong, so it fails loudly instead of plausibly.
    id: required(payload.id, 'id'),
    name: payload.name ?? '',
    // Falls back to the plain name rather than an empty string: this is what a tree view
    // renders, and an empty cell is worse than an unindented one.
    nameDecorated: payload.nameDecorated ?? payload.name ?? '',
    externalId: payload.externalId ?? null,
    hierarchy: payload.hierarchy ?? '',
    parentId: payload.parentId ?? null,
    parentName: payload.parentName ?? null,
    openingDate: toIsoFineractDate(payload.openingDate),
  };
}

function required<T>(value: T | undefined, field: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Fineract returned an office with no ${field}`);
  }
  return value;
}

/**
 * The three fields Fineract needs to read a date out of a request body.
 *
 * Fineract parses a date strictly against the `dateFormat` it is told to use, so a request that
 * sends one without the other does not fail validation — it fails to parse, and answers 500.
 * The two screens that used to set these themselves are exactly why this belongs here: that is
 * rule 2 in `DOCS/ADAPTERS.md`, and a form that owns a transport detail is a form that can get
 * it wrong.
 *
 * `yyyy-MM-dd` rather than the `dd MMMM yyyy` other screens use: both call sites already sent
 * the ISO form, and it needs no month-name localisation to round-trip.
 */
function dateFields(openingDate: string): {
  openingDate: string;
  dateFormat: string;
  locale: string;
} {
  return { openingDate, dateFormat: 'yyyy-MM-dd', locale: 'en' };
}

/**
 * {@link OfficeApi} over the generated OpenAPI client.
 *
 * One of the few places allowed to import `src/app/api` — see ADR 0006 and the `files` override
 * in `eslint.config.js`.
 */
@Injectable({ providedIn: 'root' })
export class FineractOfficeApi implements OfficeApi {
  private readonly offices = inject(OfficesService);

  list(includeAllOffices?: boolean): Observable<Office[]> {
    return this.offices.getOffices(includeAllOffices).pipe(
      // `|| []` rather than `?? []`: this endpoint has been seen to return an empty body, which
      // arrives as `null` through HttpClient, and the previous call sites all guarded for it.
      map((payloads) => (payloads || []).map((payload) => mapOffice(payload as OfficePayload))),
    );
  }

  get(officeId: number): Observable<Office> {
    return this.offices
      .getOfficesOfficeId(officeId)
      .pipe(map((payload) => mapOffice(payload as OfficePayload)));
  }

  create(draft: OfficeDraft): Observable<number> {
    return this.offices
      .postOffices({
        name: draft.name,
        externalId: draft.externalId ?? undefined,
        ...(draft.parentId === undefined || draft.parentId === null
          ? {}
          : { parentId: draft.parentId }),
        ...dateFields(draft.openingDate),
      })
      .pipe(map((response) => required(response.resourceId, 'resourceId')));
  }

  update(officeId: number, draft: Omit<OfficeDraft, 'parentId'>): Observable<void> {
    return this.offices
      .putOfficesOfficeId(officeId, {
        name: draft.name,
        externalId: draft.externalId ?? undefined,
        ...dateFields(draft.openingDate),
      })
      .pipe(map(() => undefined));
  }
}
