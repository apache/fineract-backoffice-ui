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

import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';

import { BUSINESS_DATE_API } from '../adapters';
import { ConfigService } from './config.service';
import { formatArrayDate, toIsoDate } from '../utils/date-formatter';

/**
 * Resolves the platform's current date according to Fineract's configured business date,
 * falling back to the tenant's current local date (based on tenant timezone, defaulting to
 * 'Asia/Kolkata'), and finally to the browser's local clock only as a last resort.
 */
@Injectable({
  providedIn: 'root',
})
export class PlatformDateService {
  private readonly configService = inject(ConfigService);
  private readonly businessDateApi = inject(BUSINESS_DATE_API);

  private readonly todaySignal = signal<string>(this.computeTenantToday());
  private cachedToday$: Observable<string> | null = null;

  /**
   * Synchronous reactive signal of the platform's current date (ISO 'YYYY-MM-DD').
   * Initialized immediately with the tenant timezone's current date, and updated once
   * the backend business date is retrieved.
   */
  readonly today = this.todaySignal.asReadonly();

  /**
   * Asynchronously resolves the platform's business date (ISO 'YYYY-MM-DD').
   * Results are cached via shareReplay(1) so subsequent subscribers receive the same value.
   */
  getToday(): Observable<string> {
    if (!this.cachedToday$) {
      this.cachedToday$ = this.businessDateApi.getBusinessDates().pipe(
        map((dates) => {
          const entry = dates.find((d) => d.type === 'BUSINESS_DATE');
          if (entry?.date) {
            if (Array.isArray(entry.date)) {
              return formatArrayDate(entry.date as number[]);
            }
            if (typeof entry.date === 'string') {
              return entry.date;
            }
          }
          return this.computeTenantToday();
        }),
        catchError(() => of(this.computeTenantToday())),
        tap((resolved) => this.todaySignal.set(resolved)),
        shareReplay(1),
      );
    }
    return this.cachedToday$;
  }

  /**
   * Clears the cached observable, prompting the next call to re-query the business date.
   */
  refresh(): void {
    this.cachedToday$ = null;
  }

  /**
   * Computes the current date formatted as 'YYYY-MM-DD' in the tenant's timezone.
   */
  private computeTenantToday(): string {
    const config = this.configService.config();
    const timeZone = config?.defaultTimezone || 'Asia/Kolkata';

    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(new Date());
    } catch {
      return toIsoDate(new Date());
    }
  }
}
