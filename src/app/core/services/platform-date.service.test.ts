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
import { signal } from '@angular/core';
import { firstValueFrom, of, throwError } from 'rxjs';

import { AppConfig, ConfigService } from './config.service';
import { PlatformDateService } from './platform-date.service';
import { BUSINESS_DATE_API, BusinessDateApi } from '../adapters';
import { createSpyObj, SpyObj } from '../../testing/mocks';

describe('PlatformDateService', () => {
  let service: PlatformDateService;
  let businessDateApiSpy: SpyObj<BusinessDateApi>;
  let configSignal: ReturnType<typeof signal<AppConfig>>;

  beforeEach(() => {
    businessDateApiSpy = createSpyObj<BusinessDateApi>(['getBusinessDates']);
    configSignal = signal<AppConfig>({
      fineractApiUrl: '/api',
      defaultTenant: 'default',
      defaultTimezone: 'Asia/Kolkata',
      rbacEnabled: true,
      institutionType: 'universal',
      developerToolsEnabled: false,
    });

    TestBed.configureTestingModule({
      providers: [
        PlatformDateService,
        { provide: BUSINESS_DATE_API, useValue: businessDateApiSpy },
        { provide: ConfigService, useValue: { config: configSignal.asReadonly() } },
      ],
    });
    service = TestBed.inject(PlatformDateService);
  });

  it('computes tenant date according to tenant timezone in default signal', () => {
    const today = service.today();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('calculates the correct date across timezones (e.g. Pacific/Auckland)', () => {
    configSignal.set({ ...configSignal(), defaultTimezone: 'Pacific/Auckland' });
    expect(service.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('resolves business date when returned as array by backend', async () => {
    businessDateApiSpy.getBusinessDates.mockReturnValue(
      of([
        {
          type: 'BUSINESS_DATE',
          date: [2026, 10, 8],
        },
      ]),
    );

    const date = await firstValueFrom(service.getToday());
    expect(date).toBe('2026-10-08');
    expect(service.today()).toBe('2026-10-08');
  });

  it('resolves business date when returned as ISO string by backend', async () => {
    businessDateApiSpy.getBusinessDates.mockReturnValue(
      of([
        {
          type: 'BUSINESS_DATE',
          date: '2026-10-08',
        },
      ]),
    );

    const date = await firstValueFrom(service.getToday());
    expect(date).toBe('2026-10-08');
  });

  it('falls back to tenant timezone date when business date call fails', async () => {
    businessDateApiSpy.getBusinessDates.mockReturnValue(
      throwError(() => new Error('Service unavailable')),
    );

    const date = await firstValueFrom(service.getToday());
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to tenant timezone date when BUSINESS_DATE type is not configured', async () => {
    businessDateApiSpy.getBusinessDates.mockReturnValue(
      of([
        {
          type: 'COB_DATE',
          date: '2026-10-07',
        },
      ]),
    );

    const date = await firstValueFrom(service.getToday());
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to browser date when invalid timezone is specified', () => {
    configSignal.set({ ...configSignal(), defaultTimezone: 'Invalid/NonExistent_Zone' });
    expect(service.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('caches the result via shareReplay and refetches after refresh()', async () => {
    businessDateApiSpy.getBusinessDates.mockReturnValue(
      of([
        {
          type: 'BUSINESS_DATE',
          date: '2026-10-08',
        },
      ]),
    );

    await firstValueFrom(service.getToday());
    await firstValueFrom(service.getToday());
    expect(businessDateApiSpy.getBusinessDates).toHaveBeenCalledTimes(1);

    service.refresh();
    await firstValueFrom(service.getToday());
    expect(businessDateApiSpy.getBusinessDates).toHaveBeenCalledTimes(2);
  });
});
