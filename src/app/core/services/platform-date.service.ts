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

import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { BUSINESS_DATE_API } from '../adapters/api/business-date.api';
import { formatArrayDate, toIsoDate } from '../utils/date-formatter';
import { ConfigService } from './config.service';

/**
 * Resolves "what is today, according to the platform".
 *
 * Fineract validates and stamps records in the *tenant's* timezone (conventionally `Asia/Kolkata`),
 * or according to its configured business date (`GET /v1/businessdate`). If a client seeds date
 * fields from the browser's clock (`new Date()`), users in a timezone behind the tenant (such as UTC)
 * will offer yesterday's date during the evening hours (e.g., 18:30 to 24:00 UTC). When activating
 * or closing records, the platform refuses the submission with:
 * `error.msg.group.submittedOnDate.after.activation.date`.
 *
 * This service acts as the single source of truth for platform date seeding across dialogs:
 * 1. If configured on the tenant, the active business date (`type === 'BUSINESS_DATE'`).
 * 2. If the business date module is unconfigured (returns `[]` or 403), the current calendar date
 *    in the tenant's timezone (`Asia/Kolkata`, or configured in `AppConfig.tenantTimezone`).
 * 3. The local browser date as the ultimate fallback.
 */
@Injectable({ providedIn: 'root' })
export class PlatformDateService {
  private readonly businessDateApi = inject(BUSINESS_DATE_API);
  private readonly configService = inject(ConfigService);

  private readonly _businessDate = signal<string | null>(null);
  readonly businessDate = this._businessDate.asReadonly();

  /**
   * The resolved platform date string (`YYYY-MM-DD`).
   * Reflects the configured business date if available, or today in the tenant's timezone.
   */
  readonly today = computed(() => this._businessDate() ?? this.getTenantToday());

  /**
   * Returns the current date according to the tenant's timezone.
   *
   * @param referenceDate - Optional reference date to format; defaults to `new Date()`.
   */
  getTenantToday(referenceDate: Date = new Date()): string {
    const timeZone = this.configService.config().tenantTimezone ?? 'Asia/Kolkata';
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(referenceDate);
    } catch {
      return toIsoDate(referenceDate);
    }
  }

  /**
   * Returns today's platform date as an ISO `YYYY-MM-DD` string.
   */
  getTodayIso(): string {
    return this.today();
  }

  /**
   * Returns the active business date string (`YYYY-MM-DD`), or `null` if not configured.
   */
  getBusinessDate(): string | null {
    return this._businessDate();
  }

  /**
   * Loads the configured business date from the platform.
   * If present, stores it in the internal signal and emits the resolved date.
   * If the endpoint returns empty, an error, or no BUSINESS_DATE, falls back to the tenant today.
   */
  loadBusinessDate(): Observable<string> {
    return this.businessDateApi.getBusinessDates().pipe(
      map((dates) => {
        const bd = dates.find((d) => d.type === 'BUSINESS_DATE');
        if (bd && bd.date) {
          const iso = Array.isArray(bd.date)
            ? formatArrayDate(bd.date)
            : toIsoDate(bd.date as string);
          if (iso && iso !== '-') {
            this._businessDate.set(iso);
            return iso;
          }
        }
        this._businessDate.set(null);
        return this.getTenantToday();
      }),
      catchError(() => {
        this._businessDate.set(null);
        return of(this.getTenantToday());
      }),
    );
  }

  /**
   * Compares today's platform date with a floor date (e.g. `submittedOnDate` or `activatedOnDate`)
   * and returns the later of the two.
   *
   * Compared lexically: both sides are zero-padded `YYYY-MM-DD`, which orders identically to the
   * dates it spells, keeping browser timezone translation out of the calculation.
   */
  getDateWithFloor(floor?: string): string {
    const today = this.today();
    if (!floor) return today;
    return floor > today ? floor : today;
  }
}
