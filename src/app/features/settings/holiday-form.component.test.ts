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
import { HolidayFormComponent } from './holiday-form.component';
import { HOLIDAY_API, OFFICE_API, RESCHEDULING_TYPE } from '../../core/adapters';
import type { Holiday, Office } from '../../core/adapters';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, Observable } from 'rxjs';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NotificationService } from '../../core/services/notification.service';

const HEAD_OFFICE: Office = {
  id: 1,
  name: 'Head Office',
  nameDecorated: 'Head Office',
  externalId: null,
  hierarchy: '.',
  parentId: null,
  parentName: null,
  openingDate: '2009-01-01',
};

describe('HolidayFormComponent', () => {
  let component: HolidayFormComponent;
  let fixture: ComponentFixture<HolidayFormComponent>;
  let holidayApiSpy: SpyObj<{
    get: (id: number) => unknown;
    reschedulingOptions: () => unknown;
    create: (draft: unknown) => unknown;
    update: (id: number, draft: unknown) => unknown;
  }>;
  let officeApiSpy: SpyObj<{ list: (all?: boolean) => unknown }>;
  let routerSpy: SpyObj<Router>;
  let notificationsSpy: SpyObj<NotificationService>;
  /** Mutated before `configure()` to put the component into edit mode. */
  let routeParams: Record<string, string>;

  async function configure(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [HolidayFormComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: HOLIDAY_API, useValue: holidayApiSpy },
        { provide: OFFICE_API, useValue: officeApiSpy },
        { provide: Router, useValue: routerSpy },
        { provide: NotificationService, useValue: notificationsSpy },
        // The component reads the id synchronously off the snapshot, not the observable.
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(routeParams) } },
        },
        provideNoopAnimations(),
      ],
    })
      .overrideComponent(HolidayFormComponent, {
        add: {
          providers: [{ provide: NotificationService, useValue: notificationsSpy }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(HolidayFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    routeParams = {};
    holidayApiSpy = createSpyObj(['get', 'reschedulingOptions', 'create', 'update']);
    holidayApiSpy.create.mockReturnValue(of(undefined));
    holidayApiSpy.update.mockReturnValue(of(undefined));
    officeApiSpy = createSpyObj(['list']);
    routerSpy = createSpyObj(['navigate']);
    notificationsSpy = createSpyObj<NotificationService>(['success', 'error', 'show']);

    officeApiSpy.list.mockReturnValue(of([HEAD_OFFICE]) as unknown as Observable<never>);
    // The adapter already owns parsing a string template and falling back when it cannot be
    // read, so this spec just gets the options.
    holidayApiSpy.reschedulingOptions.mockReturnValue(
      of([
        { id: RESCHEDULING_TYPE.NextRepaymentDate, value: 'Reschedule to next repayment date' },
        { id: RESCHEDULING_TYPE.SpecifiedDate, value: 'Reschedule to specified date' },
      ]) as unknown as Observable<never>,
    );
  });

  it('should create and load initial templates and offices', async () => {
    await configure();

    expect(component).toBeTruthy();
    expect(component.isEditMode()).toBe(false);
    expect(officeApiSpy.list).toHaveBeenCalledWith(true);
    expect(holidayApiSpy.reschedulingOptions).toHaveBeenCalled();
    expect(component.offices()).toEqual([HEAD_OFFICE]);
    expect(component.reschedulingTypeOptions()).toHaveLength(2);
  });

  it('should submit new holiday form successfully', async () => {
    await configure();
    component.holiday = {
      name: 'Christmas',
      description: 'Merry Christmas',
    };
    component.fromDate = '2026-12-25';
    component.toDate = '2026-12-26';
    component.selectedOfficeIds = [1];
    component.reschedulingType = 2;
    component.repaymentsRescheduledTo = '2026-12-28';

    component.onSubmit();

    expect(component.isSaving()).toBe(true);
    // ISO dates and office ids, with no dateFormat and no locale: converting the dates to
    // Fineract's own format and pairing them with the format it parses against is the adapter's
    // business now, and is tested in fineract-holiday.api.test.ts.
    expect(holidayApiSpy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Christmas',
        description: 'Merry Christmas',
        fromDate: '2026-12-25',
        toDate: '2026-12-26',
        officeIds: [1],
        reschedulingType: RESCHEDULING_TYPE.SpecifiedDate,
        repaymentsRescheduledTo: '2026-12-28',
      }),
    );
    const draft = holidayApiSpy.create.mock.lastCall![0] as Record<string, unknown>;
    expect('dateFormat' in draft).toBe(false);
    expect('locale' in draft).toBe(false);
    expect(notificationsSpy.success).toHaveBeenCalledWith('Holiday created successfully');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/settings/holidays']);
  });

  it('should handle cancel action', async () => {
    await configure();

    component.onCancel();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/settings/holidays']);
  });
  /*
   * Edit was added because the list previously offered only Activate, so a holiday entered with
   * the wrong dates was permanent — and holidays move repayment dates for every loan in the
   * office.
   */
  describe('edit mode', () => {
    beforeEach(() => {
      routeParams = { id: '7' };
      // `Holiday` as the adapter maps it. The platform answers these dates as [y, m, d]
      // arrays; converting them is the mapper's job and is tested there, so this fixture no
      // longer has to carry arrays past a type that declares strings.
      holidayApiSpy.get.mockReturnValue(
        of({
          id: 7,
          name: 'Boxing Day',
          description: '',
          officeId: 3,
          fromDate: '2026-12-26',
          toDate: '2026-12-26',
          repaymentsRescheduledTo: '2026-12-28',
          status: {
            id: 100,
            code: 'holidayStatusType.pending.for.activation',
            value: 'Pending for activation',
            isPending: true,
          },
          reschedulingType: RESCHEDULING_TYPE.SpecifiedDate,
        } satisfies Holiday) as unknown as Observable<never>,
      );
    });

    it('loads the holiday and fills the form', async () => {
      await configure();

      expect(component.isEditMode()).toBe(true);
      expect(holidayApiSpy.get).toHaveBeenCalledWith(7);
      expect(component.holiday.name).toBe('Boxing Day');
      expect(component.fromDate).toBe('2026-12-26');
      expect(component.repaymentsRescheduledTo).toBe('2026-12-28');
      // Taken from the rule Fineract sends, rather than inferred from whether a reschedule date
      // happens to be set — the generated type simply did not declare it.
      expect(component.reschedulingType).toBe(RESCHEDULING_TYPE.SpecifiedDate);
      expect(component.selectedOfficeIds).toEqual([3]);
    });

    it('puts to the holiday id rather than posting a second holiday', async () => {
      await configure();

      component.onSubmit();

      expect(holidayApiSpy.create).not.toHaveBeenCalled();
      expect(holidayApiSpy.update).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          name: 'Boxing Day',
          fromDate: '2026-12-26',
          repaymentsRescheduledTo: '2026-12-28',
        }),
      );
      expect(notificationsSpy.success).toHaveBeenCalledWith('Holiday updated successfully');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/settings/holidays']);
    });
  });
});
