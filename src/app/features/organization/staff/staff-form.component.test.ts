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

import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StaffFormComponent } from './staff-form.component';
import { StaffService, OfficesService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../../core/utils/date-formatter';

describe('StaffFormComponent', () => {
  let component: StaffFormComponent;
  let fixture: ComponentFixture<StaffFormComponent>;
  let staffServiceSpy: SpyObj<StaffService>;
  let officesServiceSpy: SpyObj<OfficesService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    staffServiceSpy = createSpyObj([
      'getStaffStaffId',
      'putStaffStaffId',
      'postStaff',
    ]);
    officesServiceSpy = createSpyObj(['getOffices']);
    routerSpy = createSpyObj(['navigate']);

    officesServiceSpy.getOffices.mockReturnValue(
      of([]) as unknown as ReturnType<OfficesService['getOffices']>,
    );

    await TestBed.configureTestingModule({
      imports: [StaffFormComponent, provideTranslateTesting()],
      providers: [
        { provide: StaffService, useValue: staffServiceSpy },
        { provide: OfficesService, useValue: officesServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load offices on init', () => {
    expect(officesServiceSpy.getOffices).toHaveBeenCalled();
  });

  it('should format the joining date returned by the API', () => {
    staffServiceSpy.getStaffStaffId.mockReturnValue(
      of({ joiningDate: [2026, 1, 5] }) as unknown as ReturnType<StaffService['getStaffStaffId']>,
    );
    component.staffId = 7;

    component.loadStaffData();

    expect(staffServiceSpy.getStaffStaffId).toHaveBeenCalledWith(7);
    expect(component.joiningDate()).toBe('2026-01-05');
  });

  it('should create staff with a StaffCreateRequest payload on submit', () => {
    staffServiceSpy.postStaff.mockReturnValue(
      of({}) as unknown as ReturnType<StaffService['postStaff']>,
    );
    component.staff.set({
      officeId: 1,
      firstname: 'Ada',
      lastname: 'Lovelace',
      isLoanOfficer: true,
    });
    component.joiningDate.set('2026-01-15');

    component.onSubmit();

    expect(staffServiceSpy.postStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        officeId: 1,
        firstname: 'Ada',
        lastname: 'Lovelace',
        joiningDate: formatDateToFineract(new Date(2026, 0, 15)),
        dateFormat: FINERACT_DATE_FORMAT,
        locale: FINERACT_LOCALE,
      }),
    );
    expect(staffServiceSpy.putStaffStaffId).not.toHaveBeenCalled();
  });

  it('omits optional fields the user left blank', () => {
    staffServiceSpy.postStaff.mockReturnValue(
      of({}) as unknown as ReturnType<StaffService['postStaff']>,
    );
    // The form seeds these to '' so the inputs bind. Sending the empty string made Fineract
    // reject the whole submission with "mobileNo must contain only digits", naming a field the
    // user had deliberately left blank — so a staff member could not be created without one.
    component.staff.set({
      officeId: 1,
      firstname: 'Ada',
      lastname: 'Lovelace',
      mobileNo: '',
      externalId: '',
      isLoanOfficer: false,
    });
    component.joiningDate.set('2026-01-15');

    component.onSubmit();

    const payload = staffServiceSpy.postStaff.mock.lastCall![0] as unknown as Record<
      string,
      unknown
    >;
    expect('mobileNo' in payload).toBe(false);
    expect('externalId' in payload).toBe(false);
    expect(payload['firstname']).toBe('Ada');
    // false is a real value, not a blank — it must survive.
    expect(payload['isLoanOfficer']).toBe(false);
  });
});
