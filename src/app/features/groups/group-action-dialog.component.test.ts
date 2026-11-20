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

import { createSpyObj, SpyObj } from '../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { GroupActionDialogComponent, GroupActionDialogData } from './group-action-dialog.component';
import { GroupsService } from '../../api';
import { BUSINESS_DATE_API, BusinessDateApi } from '../../core/adapters/api/business-date.api';
import { provideFakeAdapters } from '../../testing/adapters';
import { PlatformDateService } from '../../core/services/platform-date.service';

const ACTIVATE: GroupActionDialogData['title'] = 'GROUPS.ACTIVATE';

/**
 * The dialog's date, and specifically the floor under it.
 *
 * The floor is what keeps the browser's clock out of a command the platform validates against
 * a date it stamped itself, in the tenant's timezone. `group-membership.spec.ts` exercises the
 * same thing end to end, but only reproduces the disagreement while the two zones are on
 * different days — for a UTC runner against the stock `Asia/Kolkata` tenant, a five-and-a-half
 * hour window each evening.
 *
 * These cases hold whatever time it is, because the platform's clock is pinned rather than
 * read. It is pinned *inside* that window: `SERVER_NOW` is still the 15th in UTC and already
 * the 16th in the tenant's zone, so a dialog that defaulted to the browser's today would
 * answer the 15th here and fail. Asserting against `toIsoDate(new Date())` instead is what
 * made these two cases pass only between midnight and 18:30 UTC, and turned every evening
 * merge on `main` red.
 */
describe('GroupActionDialogComponent', () => {
  let fixture: ComponentFixture<GroupActionDialogComponent>;
  let component: GroupActionDialogComponent;
  let businessDateService: SpyObj<BusinessDateApi>;

  /**
   * The platform's clock, as `serverClockInterceptor` would have recorded it from a response.
   *
   * 20:00Z on the 15th is 01:30 on the 16th in `Asia/Kolkata`, the stock tenant zone that
   * `AppConfig.tenantTimezone` defaults to — so the two disagree about the date here.
   */
  const SERVER_NOW = new Date('2026-08-15T20:00:00Z');
  /** What the tenant calls today at `SERVER_NOW`. The browser, in UTC, would say the 15th. */
  const TENANT_TODAY = '2026-08-16';

  /** A date relative to the tenant's today, as the ISO string the dialog compares. */
  function offsetFromToday(days: number): string {
    // Anchored at midday UTC and stepped with UTC getters: a date this test names must not
    // depend on the zone the test process happens to run in.
    const date = new Date(`${TENANT_TODAY}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  /** The same date as the `[year, month, day]` the business-date endpoint answers with. */
  function fineractDate(iso: string): number[] {
    return iso.split('-').map(Number);
  }

  async function setup(data: GroupActionDialogData, businessDate?: number[]): Promise<void> {
    businessDateService = createSpyObj(['getBusinessDates', 'isBusinessDateEnabled']);
    businessDateService.isBusinessDateEnabled.mockReturnValue(of(true));
    businessDateService.getBusinessDates.mockReturnValue(
      of(businessDate ? [{ type: 'BUSINESS_DATE', date: businessDate }] : []) as never,
    );

    const groupsService = createSpyObj(['getGroupsTemplate']);
    groupsService.getGroupsTemplate.mockReturnValue(of({ closureReasons: [] }) as never);

    await TestBed.configureTestingModule({
      imports: [GroupActionDialogComponent],
      providers: [
        provideNoopAnimations(),
        ...provideFakeAdapters().providers,
        { provide: BUSINESS_DATE_API, useValue: businessDateService },
        { provide: GroupsService, useValue: groupsService },
      ],
    }).compileComponents();

    // Before the component exists: `actionDate` is seeded from `platformDate.today()` in a
    // field initialiser, so a clock recorded afterwards would arrive too late to be read.
    TestBed.inject(PlatformDateService).recordServerTime(SERVER_NOW);

    fixture = TestBed.createComponent(GroupActionDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
  }

  it('defaults to today when the platform has committed to nothing earlier', async () => {
    await setup({ title: ACTIVATE, command: 'activate' });

    expect(component.actionDate()).toBe(TENANT_TODAY);
    expect(component.minDate()).toBeUndefined();
  });

  it('moves the default up to a floor that is later than the browser thinks today is', async () => {
    // The shape of the CI failure: Fineract stamped the group's submitted-on date in a tenant
    // timezone already on tomorrow, so activating "today" is activating before submission.
    const tomorrow = offsetFromToday(1);
    await setup({ title: ACTIVATE, command: 'activate', minDate: tomorrow });

    expect(component.actionDate()).toBe(tomorrow);
    expect(component.minDate()).toBe(tomorrow);
  });

  it('leaves the default at today when the floor is already behind it', async () => {
    // A group submitted last week: activation belongs today, not on the day it was recorded.
    const lastWeek = offsetFromToday(-7);
    await setup({ title: ACTIVATE, command: 'activate', minDate: lastWeek });

    expect(component.actionDate()).toBe(TENANT_TODAY);
    // Still floored, so the picker cannot offer a date the command would refuse.
    expect(component.minDate()).toBe(lastWeek);
  });

  it('caps at the business date and defaults there', async () => {
    await setup({ title: ACTIVATE, command: 'activate' }, [2026, 3, 4]);

    expect(component.actionDate()).toBe('2026-03-04');
    expect(component.maxDate()).toBe('2026-03-04');
  });

  it('drops a business-date cap that falls below the floor rather than contradicting it', async () => {
    // Both constraints cannot hold. The floor is the one the command itself validates, so the
    // picker keeps it and lets the platform speak for the business date on submit — a range
    // with max < min is one no date satisfies.
    const tomorrow = offsetFromToday(1);
    await setup(
      { title: ACTIVATE, command: 'activate', minDate: tomorrow },
      fineractDate(offsetFromToday(-30)),
    );

    expect(component.actionDate()).toBe(tomorrow);
    expect(component.minDate()).toBe(tomorrow);
    expect(component.maxDate()).toBeUndefined();
  });
});
