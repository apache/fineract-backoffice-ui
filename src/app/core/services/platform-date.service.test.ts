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

import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  BUSINESS_DATE_API,
  BusinessDateApi,
  BusinessDateEntry,
} from '../adapters/api/business-date.api';
import { createSpyObj, SpyObj } from '../../testing/mocks';
import { toIsoDate } from '../utils/date-formatter';
import { ConfigService } from './config.service';
import { PlatformDateService } from './platform-date.service';

describe('PlatformDateService', () => {
  let service: PlatformDateService;
  let businessDateApiSpy: SpyObj<BusinessDateApi>;
  let tenantTimezone = 'Asia/Kolkata';

  /**
   * @param dates - what `GET /businessdate` answers, or `'error'`.
   * @param enabled - whether the tenant has the business-date feature switched on. Defaults to
   *   `true` so the cases below read as they did; the disabled case is its own test, because a
   *   disabled feature leaves stale rows behind and that is the trap this service exists to
   *   avoid.
   */
  function setup(dates: BusinessDateEntry[] | 'error' = [], enabled = true): void {
    businessDateApiSpy = createSpyObj(['getBusinessDates', 'isBusinessDateEnabled']);
    businessDateApiSpy.isBusinessDateEnabled.mockReturnValue(of(enabled));
    if (dates === 'error') {
      businessDateApiSpy.getBusinessDates.mockReturnValue(throwError(() => new Error('403')));
    } else {
      businessDateApiSpy.getBusinessDates.mockReturnValue(of(dates));
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PlatformDateService,
        { provide: BUSINESS_DATE_API, useValue: businessDateApiSpy },
        {
          provide: ConfigService,
          useValue: {
            config: () => ({ tenantTimezone }),
          },
        },
      ],
    });

    service = TestBed.inject(PlatformDateService);
  }

  beforeEach(() => {
    tenantTimezone = 'Asia/Kolkata';
    setup();
  });

  describe('tenant timezone date resolution', () => {
    // Only the fallback case moves the browser's clock, but the timers are installed for the
    // whole block so no case can leave a fake clock behind for the next one.
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('does not read the business date at all when the feature is off', () => {
      // Measured: the rows persist after the feature is disabled and stop being maintained — a
      // tenant with it off still reported `BUSINESS_DATE 2026-10-17` on the 18th, and
      // `POST /businessdate` refused to move it with `business.date.is.not.enabled`. Seeding
      // from that row put every date field a day in the past.
      setup([{ type: 'BUSINESS_DATE', date: '2026-10-17' }], false);

      let emitted: string | undefined;
      service.resolveToday().subscribe((date) => (emitted = date));

      expect(businessDateApiSpy.getBusinessDates).not.toHaveBeenCalled();
      expect(service.getBusinessDate()).toBeNull();
      expect(emitted).toBe(service.getTenantToday());
    });

    it('prefers the platform clock over the browser clock', () => {
      // The browser is the one party whose opinion about "today" the platform does not share.
      //
      // With no tenant timezone configured the service renders the recorded instant in the
      // browser's own zone — deliberately, since there is no other zone to render it in. So
      // what this case can assert is that rendering of the *platform's* instant, not a fixed
      // day: written as the literal '2026-08-15' it asserted the runner's UTC offset as well,
      // and failed at UTC+14 (`Pacific/Kiritimati`), where 10:00Z is already the 16th.
      //
      // The browser's clock is moved to a different day than the platform's so the case still
      // fails if the service ever reads `new Date()` in place of what the platform last said.
      // That is the regression it exists for, and at the real clock it caught it only by
      // accident of the two dates differing.
      tenantTimezone = '';
      setup();
      const platformNow = new Date('2026-08-15T10:00:00Z');
      vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
      service.recordServerTime(platformNow);

      expect(service.getTenantToday()).toBe(toIsoDate(platformNow));
      expect(service.today()).toBe(toIsoDate(platformNow));
      expect(service.today()).not.toBe(toIsoDate(new Date()));
    });

    it('ignores an unreadable Date header rather than taking NaN for a date', () => {
      tenantTimezone = '';
      setup();
      service.recordServerTime(new Date('not a date'));

      expect(service.today()).toBe(toIsoDate(new Date()));
    });

    it('reads the platform clock in the tenant timezone when one is configured', () => {
      // 2026-08-15 20:00Z is already the 16th in Asia/Kolkata (UTC+5:30).
      setup();
      service.recordServerTime(new Date('2026-08-15T20:00:00Z'));

      expect(service.today()).toBe('2026-08-16');
    });

    it('does not invent a timezone when none is configured', () => {
      // This service used to assume Asia/Kolkata, which is a date up to a day away from the
      // platform's for every tenant that is not in that zone — the same guess it exists to
      // remove.
      tenantTimezone = '';
      setup();
      const instant = new Date('2026-08-15T20:00:00Z');

      expect(service.getTenantToday(instant)).toBe(toIsoDate(instant));
    });

    it('resolves once however many screens ask', () => {
      // Five places used to read `GET /businessdate` for themselves.
      setup([{ type: 'BUSINESS_DATE', date: '2026-03-04' }]);

      service.resolveToday().subscribe();
      service.resolveToday().subscribe();
      service.loadBusinessDate().subscribe();

      expect(businessDateApiSpy.isBusinessDateEnabled).toHaveBeenCalledTimes(1);
      expect(businessDateApiSpy.getBusinessDates).toHaveBeenCalledTimes(1);
    });

    it('defaults to the tenant timezone today when business date is not set', () => {
      const now = new Date();
      const expected = service.getTenantToday(now);
      expect(service.today()).toBe(expected);
      expect(service.getTodayIso()).toBe(expected);
      expect(service.getBusinessDate()).toBeNull();
    });

    it('resolves the tenant date ahead of UTC during evening hours (issue #358 reproduction)', () => {
      // 2026-08-15 20:00:00 UTC is 2026-08-16 01:30:00 in Asia/Kolkata (UTC+5:30)
      const eveningUtc = new Date('2026-08-15T20:00:00Z');
      const kolkataDate = service.getTenantToday(eveningUtc);

      expect(kolkataDate).toBe('2026-08-16');
      // The browser UTC date was 2026-08-15, but tenant is 2026-08-16
      expect(eveningUtc.toISOString().slice(0, 10)).toBe('2026-08-15');
    });

    it('falls back to local date when timezone formatting throws', () => {
      tenantTimezone = 'Invalid/Timezone_Name';
      const now = new Date();
      expect(service.getTenantToday(now)).toBe(toIsoDate(now));
    });
  });

  describe('business date resolution', () => {
    it('updates today to the configured business date when loaded as an array', () => {
      setup([
        {
          type: 'BUSINESS_DATE',
          date: [2026, 3, 4],
        },
      ]);

      let emitted: string | undefined;
      service.loadBusinessDate().subscribe((d) => (emitted = d));

      expect(emitted).toBe('2026-03-04');
      expect(service.today()).toBe('2026-03-04');
      expect(service.getBusinessDate()).toBe('2026-03-04');
    });

    it('updates today to the configured business date when loaded as an ISO string', () => {
      setup([
        {
          type: 'BUSINESS_DATE',
          date: '2026-04-10',
        },
      ]);

      let emitted: string | undefined;
      service.loadBusinessDate().subscribe((d) => (emitted = d));

      expect(emitted).toBe('2026-04-10');
      expect(service.today()).toBe('2026-04-10');
      expect(service.getBusinessDate()).toBe('2026-04-10');
    });

    it('falls back to tenant timezone today when getBusinessdate returns empty array', () => {
      setup([]);

      let emitted: string | undefined;
      service.loadBusinessDate().subscribe((d) => (emitted = d));

      expect(emitted).toBe(service.getTenantToday());
      expect(service.today()).toBe(service.getTenantToday());
      expect(service.getBusinessDate()).toBeNull();
    });

    it('falls back to tenant timezone today when getBusinessdate fails', () => {
      setup('error');

      let emitted: string | undefined;
      service.loadBusinessDate().subscribe((d) => (emitted = d));

      expect(emitted).toBe(service.getTenantToday());
      expect(service.today()).toBe(service.getTenantToday());
      expect(service.getBusinessDate()).toBeNull();
    });

    it('ignores COB_DATE entries and only takes BUSINESS_DATE', () => {
      setup([
        {
          type: 'COB_DATE',
          date: [2026, 1, 1],
        },
      ]);

      let emitted: string | undefined;
      service.loadBusinessDate().subscribe((d) => (emitted = d));

      expect(emitted).toBe(service.getTenantToday());
      expect(service.getBusinessDate()).toBeNull();
    });
  });

  describe('getDateWithFloor', () => {
    it('returns today when no floor is provided', () => {
      expect(service.getDateWithFloor()).toBe(service.today());
      expect(service.getDateWithFloor(undefined)).toBe(service.today());
    });

    it('returns floor when floor is later than today', () => {
      setup([
        {
          type: 'BUSINESS_DATE',
          date: '2026-08-15',
        },
      ]);
      service.loadBusinessDate().subscribe();

      expect(service.getDateWithFloor('2026-08-16')).toBe('2026-08-16');
      expect(service.getDateWithFloor('2026-09-01')).toBe('2026-09-01');
    });

    it('returns today when floor is earlier than today', () => {
      setup([
        {
          type: 'BUSINESS_DATE',
          date: '2026-08-15',
        },
      ]);
      service.loadBusinessDate().subscribe();

      expect(service.getDateWithFloor('2026-08-10')).toBe('2026-08-15');
      expect(service.getDateWithFloor('2025-12-31')).toBe('2026-08-15');
    });

    it('compares lexically to preserve exact calendar dates', () => {
      setup([
        {
          type: 'BUSINESS_DATE',
          date: '2026-01-05',
        },
      ]);
      service.loadBusinessDate().subscribe();

      expect(service.getDateWithFloor('2026-01-04')).toBe('2026-01-05');
      expect(service.getDateWithFloor('2026-01-06')).toBe('2026-01-06');
    });
  });
});
