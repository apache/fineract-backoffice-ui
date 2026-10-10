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

import { AccountingClosureService } from '../../../api';
import type { GetGlClosureResponse } from '../../../api';
import type {
  AccountingClosure,
  AccountingClosureApi,
  NewAccountingClosure,
} from './accounting-closure.api';

/**
 * The date format Fineract expects alongside any date it is sent.
 *
 * This is a transport detail, and keeping it here is a large part of the point: before this
 * adapter, the closure form set `dateFormat` and `locale` on the request object itself, so a
 * screen knew how Fineract parses dates. Every screen that posts a date repeats that, and an
 * upstream change to the accepted format would have to be found in each of them.
 */
const FINERACT_DATE_FORMAT = 'yyyy-MM-dd';
const FINERACT_LOCALE = 'en';

/**
 * Maps one generated closure response onto the application model.
 *
 * Exported for its own test. The mapping is where an upstream shape change is *meant* to
 * surface: if `closingDate` becomes an array of date parts, or `deleted` is renamed, this
 * function stops compiling or its tests fail, and no feature code is involved.
 */
export function mapAccountingClosure(response: GetGlClosureResponse): AccountingClosure {
  return {
    // Every field on the generated response is optional because the spec marks nothing
    // required, so the mapper is what decides the application's answer when one is absent.
    // `id` and `officeId` cannot meaningfully default, and Fineract always sends them; -1
    // would be a plausible-looking lie, so an absent one is reported rather than smoothed over.
    id: required(response.id, 'id'),
    officeId: required(response.officeId, 'officeId'),
    officeName: response.officeName ?? '',
    closingDate: response.closingDate ?? null,
    comments: response.comments ?? null,
    // See `AccountingClosure.isClosed`: Fineract has no such field, and the screen that assumed
    // one rendered every closed period as "Open".
    isClosed: response.deleted !== true,
  };
}

function required<T>(value: T | undefined, field: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Fineract returned a GL closure with no ${field}`);
  }
  return value;
}

/**
 * {@link AccountingClosureApi} over the generated OpenAPI client.
 *
 * One of two places in the application allowed to import `src/app/api` — see ADR 0006 and the
 * `files` override in `eslint.config.js`.
 */
@Injectable({ providedIn: 'root' })
export class FineractAccountingClosureApi implements AccountingClosureApi {
  private readonly closures = inject(AccountingClosureService);

  list(): Observable<AccountingClosure[]> {
    return this.closures
      .getGlclosures()
      .pipe(map((responses) => responses.map((response) => mapAccountingClosure(response))));
  }

  create(closure: NewAccountingClosure): Observable<void> {
    return this.closures
      .postGlclosures({
        officeId: closure.officeId,
        closingDate: closure.closingDate,
        comments: closure.comments,
        dateFormat: FINERACT_DATE_FORMAT,
        locale: FINERACT_LOCALE,
      })
      .pipe(map(() => undefined));
  }

  remove(id: number): Observable<void> {
    return this.closures.deleteGlclosuresGlClosureId(id).pipe(map(() => undefined));
  }
}
