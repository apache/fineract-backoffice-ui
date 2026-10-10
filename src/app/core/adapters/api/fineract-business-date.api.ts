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

import { BusinessDateManagementService } from '../../../api';
import type { BusinessDateApi, BusinessDateEntry } from './business-date.api';

/**
 * {@link BusinessDateApi} over the generated OpenAPI client.
 *
 * One of the few places allowed to import `src/app/api` — see ADR 0006 and the `files` override
 * in `eslint.config.js`.
 */
@Injectable({ providedIn: 'root' })
export class FineractBusinessDateApi implements BusinessDateApi {
  private readonly businessDateService = inject(BusinessDateManagementService);

  getBusinessDates(): Observable<readonly BusinessDateEntry[]> {
    return this.businessDateService.getBusinessdate().pipe(
      map((dates) =>
        (dates || []).map((d) => ({
          type: d.type ?? '',
          date: d.date ?? null,
        })),
      ),
    );
  }
}
