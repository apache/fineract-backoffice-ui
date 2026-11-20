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

import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { BUSINESS_DATE_API, type BusinessDateApi } from '../adapters/api/business-date.api';
import { formatArrayDate, toIsoDate } from '../utils/date-formatter';
import { ConfigService } from './config.service';

/**
 * Resolves "what is today, according to the platform".
 *
 * Fineract judges whether a date is in the future by its own reckoning, not the browser's: the
 * tenant's timezone, or the business date when that feature is on. A form that seeds a date from
 * `new Date()` therefore offers a day the platform may refuse. Measured (#758): a browser in
 * `Asia/Kolkata` at 11:25 local, against a tenant then on the 15th, had Create Client refused
 * with `error.msg.clients.submittedOnDate.in.the.future` and Create Loan with a `403` reading
 * "The date on which a loan is submitted cannot be in the future" — which looks like a
 * permission problem and is not one.
 *
 * The order of preference, each step measured against a running platform:
 *
 * 1. **The business date, when the feature is enabled.** Enabled is the operative word. The rows
 *    behind `GET /businessdate` persist after the feature is switched off and stop being
 *    maintained: a tenant with it disabled still reported `BUSINESS_DATE 2026-10-17` on the 18th.
 *    Seeding from that row unasked puts every date field a day in the past, which is why
 *    {@link BusinessDateApi.isBusinessDateEnabled} is consulted first.
 * 2. **The platform's own clock**, taken from the `Date` header every response carries and
 *    recorded by `serverClockInterceptor`. This is what removes the browser's clock from the
 *    decision, which is the actual defect — the browser is the one party whose opinion the
 *    platform does not share.
 * 3. **The browser's date**, when nothing has been heard from the server yet.
 *
 * There is deliberately no hardcoded tenant timezone. This service used to assume
 * `Asia/Kolkata` whenever `AppConfig.tenantTimezone` was unset, which invents a date up to a day
 * away from the platform's for every tenant that is not in that zone — the same class of guess
 * the service exists to remove. A configured timezone is still honoured, and applied to the
 * *server's* instant rather than the browser's.
 *
 * Being behind the platform is safe and being ahead is not: a date in the past is accepted
 * (back-dating is a normal operation), while a date in the future is refused. Where the two
 * sources disagree, the earlier one is the one that submits.
 */
/**
 * How long a resolved platform date is reused before being asked for again.
 *
 * Long enough that the screens opening in one interaction share a single pair of requests, short
 * enough that a session left open across close-of-business picks up the new business date.
 */
const RESOLUTION_TTL_MS = 5 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PlatformDateService {
  private readonly injector = inject(Injector);
  private readonly configService = inject(ConfigService);

  /** The adapter, resolved on first use. `null` once it is known to be unavailable. */
  private api: BusinessDateApi | null | undefined;

  private readonly _businessDate = signal<string | null>(null);
  readonly businessDate = this._businessDate.asReadonly();

  /** The platform's clock, as last reported by a response's `Date` header. */
  private readonly serverTime = signal<Date | null>(null);

  /** How far the platform's clock is ahead of the browser's, as of the last response. */
  private clockSkewMs = 0;

  /** Resolved once and shared, so five screens asking do not make five requests. */
  private resolution$: Observable<string> | null = null;
  private enabled$: Observable<boolean> | null = null;
  private resolvedAt = 0;

  /**
   * The resolved platform date (`YYYY-MM-DD`), synchronously.
   *
   * The business date when one governs, otherwise today by the platform's clock. Available
   * immediately — before anything has been read it answers the browser's date, which is the
   * only thing then known.
   */
  readonly today = computed(() => this._businessDate() ?? this.getTenantToday());

  /**
   * Records the platform's clock from a response.
   *
   * Called by `serverClockInterceptor` for every response that carries a `Date` header. Taking
   * it from traffic the application already makes keeps this free: no extra request, and it
   * stays current through a long session.
   */
  recordServerTime(instant: Date): void {
    if (!Number.isNaN(instant.getTime())) {
      this.serverTime.set(instant);
      this.clockSkewMs = instant.getTime() - Date.now();
    }
  }

  /**
   * Today in the tenant's reckoning, from the most authoritative clock available.
   *
   * @param referenceDate - the instant to read. Defaults to the platform's clock when one has
   *   been seen, and to the browser's otherwise.
   */
  getTenantToday(referenceDate: Date = this.serverTime() ?? new Date()): string {
    const timeZone = this.configService.config().tenantTimezone;
    if (!timeZone) {
      return toIsoDate(referenceDate);
    }
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(referenceDate);
    } catch {
      // A misconfigured zone should not take the date with it.
      return toIsoDate(referenceDate);
    }
  }

  /**
   * The current instant by the platform's clock: the browser's, corrected by the skew seen on
   * the last response. Unlike the raw last `Date` header, it keeps moving between requests.
   */
  serverNow(): Date {
    return new Date(Date.now() + this.clockSkewMs);
  }

  /** Today's platform date as an ISO `YYYY-MM-DD` string. */
  getTodayIso(): string {
    return this.today();
  }

  /** The business date when one governs, or `null`. */
  getBusinessDate(): string | null {
    return this._businessDate();
  }

  /**
   * Resolves today, asking the platform if it has not been asked yet.
   *
   * Shared and replayed: every screen that seeds a date can call this on init, and only the
   * first call issues requests. Use it where the default must be right even on a cold load; use
   * {@link today} where a synchronous best answer is enough.
   */
  resolveToday(): Observable<string> {
    // Re-resolved after the window has passed. Caching forever would be wrong in both
    // directions: a back-office session stays open all day, and the business date moves when
    // close-of-business runs, so a value fetched at 09:00 would still be offered at 18:00.
    if (this.resolution$ && Date.now() - this.resolvedAt > RESOLUTION_TTL_MS) {
      this.resolution$ = null;
    }
    this.resolvedAt = Date.now();
    const api = this.businessDateApi();
    if (!api) {
      return of(this.today());
    }
    // The flag is tenant configuration and does not move during a session, so it is asked once
    // however many times the date itself is re-read.
    this.enabled$ ??= api.isBusinessDateEnabled().pipe(
      catchError(() => of(false)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.resolution$ ??= this.enabled$.pipe(
      switchMap((enabled) => (enabled ? this.readBusinessDate() : of(null))),
      tap((businessDate) => this._businessDate.set(businessDate)),
      map(() => this.today()),
      catchError(() => {
        this._businessDate.set(null);
        return of(this.today());
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.resolution$;
  }

  /**
   * Loads the business date, if one governs.
   *
   * Kept for the screens that called it before this service resolved the feature flag; it now
   * answers the same thing {@link resolveToday} does.
   */
  loadBusinessDate(): Observable<string> {
    return this.resolveToday();
  }

  /**
   * Forgets what was resolved, so the next caller asks the platform again.
   *
   * For a screen that has just changed the business date, or any point where waiting out the
   * five-minute window would mean offering a date the tenant has moved on from.
   */
  refresh(): void {
    this.resolution$ = null;
    this.enabled$ = null;
  }

  /**
   * Compares today's platform date with a floor date (for example `submittedOnDate` or
   * `activatedOnDate`) and returns the later of the two.
   *
   * Compared lexically: both sides are zero-padded `YYYY-MM-DD`, which orders identically to the
   * dates it spells, keeping timezone conversion out of the calculation.
   */
  getDateWithFloor(floor?: string): string {
    const today = this.today();
    if (!floor) return today;
    return floor > today ? floor : today;
  }

  /**
   * The business-date adapter, resolved on first use.
   *
   * Lazily, so that merely injecting this service does not construct the generated client
   * underneath it: every screen that defaults a date depends on this service now, and most of
   * them never reach the point of asking. A resolution failure is taken as "nothing to ask"
   * rather than propagated, so a date default cannot be what breaks a screen.
   *
   * This is not a substitute for providing the adapter in a test: an injector that *can*
   * construct it will, and the request then needs answering like any other. `provideFakeAdapters`
   * binds it to a fake for exactly that reason.
   */
  private businessDateApi(): BusinessDateApi | null {
    if (this.api === undefined) {
      try {
        this.api = this.injector.get(BUSINESS_DATE_API);
      } catch {
        this.api = null;
      }
    }
    return this.api;
  }

  private readBusinessDate(): Observable<string | null> {
    const api = this.businessDateApi();
    if (!api) return of(null);
    return api.getBusinessDates().pipe(
      map((dates) => {
        const entry = dates.find((date) => date.type === 'BUSINESS_DATE');
        if (!entry?.date) return null;
        const iso = Array.isArray(entry.date)
          ? formatArrayDate(entry.date)
          : toIsoDate(entry.date as string);
        return iso && iso !== '-' ? iso : null;
      }),
    );
  }
}
