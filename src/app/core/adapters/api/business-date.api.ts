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

import { FineractBusinessDateApi } from './fineract-business-date.api';

/**
 * A business date entry as returned by the platform.
 */
export interface BusinessDateEntry {
  readonly type: string;
  readonly date: string | readonly number[];
}

/**
 * Business dates, stated as application operations.
 */
export interface BusinessDateApi {
  /**
   * Retrieves configured business dates from the platform.
   */
  getBusinessDates(): Observable<BusinessDateEntry[]>;
}

/** Injection token for the active {@link BusinessDateApi}. Defaults to the Fineract implementation. */
export const BUSINESS_DATE_API = new InjectionToken<BusinessDateApi>('BusinessDateApi', {
  providedIn: 'root',
  factory: () => inject(FineractBusinessDateApi),
});
