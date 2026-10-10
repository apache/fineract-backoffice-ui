/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  See the License for the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
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
import { HolidaysListComponent } from './holidays-list.component';
import { HOLIDAY_API, OFFICE_API } from '../../core/adapters';
import type { Holiday, Office } from '../../core/adapters';
import { Router } from '@angular/router';
import { of, throwError, Observable } from 'rxjs';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NotificationService } from '../../core/services/notification.service';

import { provideIonicTesting } from '../../testing/ionic-testing';
import { DialogService } from '../../core/services/dialog.service';

/** `Holiday` as the adapter maps it, pending activation unless told otherwise. */
function holiday(overrides: Partial<Holiday>): Holiday {
  return {
    id: 1,
    name: 'A holiday',
    description: '',
    fromDate: '2027-01-05',
    toDate: '2027-01-05',
    repaymentsRescheduledTo: '2027-01-06',
    officeId: 1,
    status: {
      id: 100,
      code: 'holidayStatusType.pending.for.activation',
      value: 'Pending for activation',
      isPending: true,
    },
    reschedulingType: 2,
    ...overrides,
  };
}

describe('HolidaysListComponent', () => {
  let component: HolidaysListComponent;
  let fixture: ComponentFixture<HolidaysListComponent>;
  let holidayApiSpy: SpyObj<{
    list: (officeId?: number) => unknown;
    activate: (id: number) => unknown;
  }>;
  let officeApiSpy: SpyObj<{ list: (all?: boolean) => unknown }>;
  let routerSpy: SpyObj<Router>;
  let dialogSpy: SpyObj<DialogService>;
  let notificationsSpy: SpyObj<NotificationService>;

  beforeEach(async () => {
    holidayApiSpy = createSpyObj(['list', 'activate']);
    officeApiSpy = createSpyObj(['list']);
    routerSpy = createSpyObj(['navigate']);
    dialogSpy = createSpyObj<DialogService>(['open', 'confirm']);
    notificationsSpy = createSpyObj<NotificationService>(['success', 'error', 'show']);

    const headOffice: Office = {
      id: 1,
      name: 'Head Office',
      nameDecorated: 'Head Office',
      externalId: null,
      hierarchy: '.',
      parentId: null,
      parentName: null,
      openingDate: '2009-01-01',
    };
    officeApiSpy.list.mockReturnValue(of([headOffice]) as unknown as Observable<never>);
    holidayApiSpy.list.mockReturnValue(of([]) as unknown as Observable<never>);

    await TestBed.configureTestingModule({
      imports: [HolidaysListComponent],
      providers: [
        ...provideTranslateTesting(),
        provideIonicTesting(),
        { provide: HOLIDAY_API, useValue: holidayApiSpy },
        { provide: OFFICE_API, useValue: officeApiSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogSpy },
        { provide: NotificationService, useValue: notificationsSpy },
        provideNoopAnimations(),
      ],
    })
      .overrideComponent(HolidaysListComponent, {
        add: {
          providers: [
            { provide: DialogService, useValue: dialogSpy },
            { provide: NotificationService, useValue: notificationsSpy },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(HolidaysListComponent);
    component = fixture.componentInstance;
  });

  it('should create and load offices and holidays on init', () => {
    // `Holiday` as the adapter maps it. The previous fixture wrote
    // `fromDate: [2026, 1, 1] as unknown as number[]` to get a realistic value past a type that
    // declares `string`; the dates are ISO strings here because that is what the mapper produces.
    const mockHolidays = [
      holiday({ id: 1, name: 'New Year', fromDate: '2026-01-01', toDate: '2026-01-01' }),
    ];
    holidayApiSpy.list.mockReturnValue(of(mockHolidays) as unknown as Observable<never>);

    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(officeApiSpy.list).toHaveBeenCalledWith(true);
    expect(holidayApiSpy.list).toHaveBeenCalledWith(1);
    expect(component.holidays()).toEqual(mockHolidays);
  });

  it('should load holidays for a different office on change', () => {
    fixture.detectChanges();
    component.onOfficeChange(5);
    expect(component.selectedOfficeId()).toBe(5);
    expect(holidayApiSpy.list).toHaveBeenCalledWith(5);
  });

  it('should navigate to create holiday page', () => {
    component.onCreateHoliday();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/settings/holidays/create']);
  });

  it('should activate holiday on dialog confirmation', async () => {
    fixture.detectChanges();
    const pending = holiday({ id: 10, name: 'Holiday to activate' });
    const modalControllerSpy = createSpyObj(['afterClosed']);
    modalControllerSpy.afterClosed.mockReturnValue(of(true));
    dialogSpy.open.mockResolvedValue(true);
    holidayApiSpy.activate.mockReturnValue(of(undefined) as unknown as Observable<never>);

    await component.onActivateHoliday(pending);

    expect(dialogSpy.open).toHaveBeenCalled();
    expect(holidayApiSpy.activate).toHaveBeenCalledWith(10);
    expect(notificationsSpy.success).toHaveBeenCalledWith('Holiday activated successfully');
  });

  it('should handle activation error', async () => {
    fixture.detectChanges();
    const pending = holiday({ id: 10, name: 'Holiday to activate' });
    const modalControllerSpy = createSpyObj(['afterClosed']);
    modalControllerSpy.afterClosed.mockReturnValue(of(true));
    dialogSpy.open.mockResolvedValue(true);
    holidayApiSpy.activate.mockReturnValue(
      throwError(() => new Error('Error')) as unknown as Observable<never>,
    );
    vi.spyOn(console, 'error');

    await component.onActivateHoliday(pending);

    expect(console.error).toHaveBeenCalled();
    expect(notificationsSpy.error).toHaveBeenCalledWith('Failed to activate holiday');
  });
});
