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
import { Injector } from '@angular/core';
import { WorkingDaysComponent } from './working-days.component';
import { WorkingDaysService } from '../../api';
import { of } from 'rxjs';
import {
  provideTranslateTesting,
  setTranslateTestingTranslations,
} from '../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NotificationService } from '../../core/services/notification.service';
import { expectLookedUp } from '../../testing/translated-text';

describe('WorkingDaysComponent', () => {
  let component: WorkingDaysComponent;
  let fixture: ComponentFixture<WorkingDaysComponent>;
  let workingDaysServiceSpy: SpyObj<WorkingDaysService>;

  beforeEach(async () => {
    workingDaysServiceSpy = createSpyObj([
      'getWorkingdays',
      'getWorkingdaysTemplate',
      'putWorkingdays',
    ]);
    workingDaysServiceSpy.getWorkingdays.mockReturnValue(
      of({
        repaymentRescheduleType: { id: 1 },
        extendTermForDailyRepayments: false,
        recurrence: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR',
      }) as unknown as ReturnType<WorkingDaysService['getWorkingdays']>,
    );
    workingDaysServiceSpy.getWorkingdaysTemplate.mockReturnValue(
      of({ repaymentRescheduleOptions: [] }) as unknown as ReturnType<
        WorkingDaysService['getWorkingdaysTemplate']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [WorkingDaysComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: WorkingDaysService, useValue: workingDaysServiceSpy },
        {
          provide: NotificationService,
          useValue: createSpyObj<NotificationService>(['success', 'error', 'show']),
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    setTranslateTestingTranslations(TestBed.inject(Injector), 'test', {
      COMMON: {
        MONDAY: 'Mon-test',
        TUESDAY: 'Tue-test',
        WEDNESDAY: 'Wed-test',
        THURSDAY: 'Thu-test',
        FRIDAY: 'Fri-test',
        SATURDAY: 'Sat-test',
        SUNDAY: 'Sun-test',
      },
    });

    fixture = TestBed.createComponent(WorkingDaysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load working days on init', () => {
    expect(component).toBeTruthy();
    expect(workingDaysServiceSpy.getWorkingdays).toHaveBeenCalled();
  });

  it('renders weekday labels through the translation adapter', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Mon-test');
    expect(text).toContain('Sun-test');
    expect(text).not.toContain('COMMON.MONDAY');
  });

  it('renders its headings and rules through the translation adapter', () => {
    expectLookedUp(fixture.nativeElement, [
      'WORKING_DAYS.TITLE',
      'WORKING_DAYS.REPAYMENTS_RESCHEDULING_RULE',
      'WORKING_DAYS.EXTEND_TERM_DAILY_REPAYMENTS',
      'WORKING_DAYS.EXTEND_TERM_HOLIDAY_REPAYMENTS',
    ]);
  });

  it('should submit a WorkingDaysUpdateRequest on save', () => {
    workingDaysServiceSpy.putWorkingdays.mockReturnValue(
      of({}) as unknown as ReturnType<WorkingDaysService['putWorkingdays']>,
    );

    component.onSubmit();

    expect(workingDaysServiceSpy.putWorkingdays).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'en' }),
    );
  });
});
