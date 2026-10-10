/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
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

import { OFFICE_API, STAFF_API } from '../../../core/adapters';
import type { Staff } from '../../../core/adapters';

import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { of } from 'rxjs';

import { provideTranslateTesting } from '../../../testing/i18n-testing';

import { provideNoopAnimations } from '@angular/platform-browser/animations';

/** `Staff` as the adapter maps it: every field present, absence as `null`. */
function staffMember(overrides: Partial<Staff>): Staff {
  return {
    id: 7,
    firstname: 'Ada',
    lastname: 'Lovelace',
    displayName: 'Lovelace, Ada',
    officeId: 1,
    officeName: 'Head Office',
    externalId: null,
    mobileNo: null,
    emailAddress: null,
    isLoanOfficer: true,
    isActive: true,
    joiningDate: '2026-01-05',
    ...overrides,
  };
}

describe('StaffFormComponent', () => {
  let component: StaffFormComponent;

  let fixture: ComponentFixture<StaffFormComponent>;

  let staffApiSpy: SpyObj<{
    get: (id: number) => unknown;
    create: (d: unknown) => unknown;
    update: (id: number, u: unknown) => unknown;
  }>;

  let officeApiSpy: SpyObj<{ list: (all?: boolean) => unknown }>;

  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    staffApiSpy = createSpyObj(['get', 'create', 'update']);
    staffApiSpy.create.mockReturnValue(of(undefined));
    staffApiSpy.update.mockReturnValue(of(undefined));

    officeApiSpy = createSpyObj(['list']);

    routerSpy = createSpyObj(['navigate']);

    officeApiSpy.list.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [StaffFormComponent],

      providers: [
        ...provideTranslateTesting(),
        { provide: STAFF_API, useValue: staffApiSpy },

        { provide: OFFICE_API, useValue: officeApiSpy },

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
    expect(officeApiSpy.list).toHaveBeenCalled();
  });

  /**
   * The regression this file exists for.
   *
   * This used to pass `joiningDate: [2026, 1, 5]` — an array `GET /staff/{id}` never sends — and
   * so confirmed a form that rendered '-' in a browser: the component ran the real string value
   * through `formatArrayDate()`, which answers '-' for anything that is not an array. The
   * contract hands over an ISO date whichever encoding the platform used, so the component no
   * longer converts anything and the fixture no longer has to lie.
   */
  it('shows the joining date the platform actually returns', () => {
    staffApiSpy.get.mockReturnValue(of(staffMember({ joiningDate: '2026-01-05' })));

    component.staffId = 7;

    component.loadStaffData();

    expect(staffApiSpy.get).toHaveBeenCalledWith(7);

    expect(component.joiningDate()).toBe('2026-01-05');
  });

  it('leaves today standing when the staff member has no joining date', () => {
    staffApiSpy.get.mockReturnValue(of(staffMember({ joiningDate: null })));

    component.staffId = 7;
    const before = component.joiningDate();

    component.loadStaffData();

    expect(component.joiningDate()).toBe(before);
  });

  it('hands the adapter a draft, not a Fineract request body', () => {
    component.staff.set({
      officeId: 1,
      firstname: 'Ada',
      lastname: 'Lovelace',
      isLoanOfficer: true,
    });

    component.joiningDate.set('2026-01-15T12:00:00');

    component.onSubmit();

    // No dateFormat and no locale, and the date still ISO: converting it and pairing it with
    // the format Fineract parses against is the adapter's business. Asserting their absence is
    // what would catch them creeping back into the form.
    expect(staffApiSpy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        officeId: 1,
        firstname: 'Ada',
        lastname: 'Lovelace',
        joiningDate: '2026-01-15T12:00:00',
      }),
    );
    const draft = staffApiSpy.create.mock.lastCall![0] as Record<string, unknown>;
    expect('dateFormat' in draft).toBe(false);
    expect('locale' in draft).toBe(false);

    expect(staffApiSpy.update).not.toHaveBeenCalled();
  });

  it('passes the blanks through for the adapter to drop', () => {
    // The form seeds these to '' so its inputs bind. Dropping them is the adapter's promise now
    // — sending `mobileNo: ''` makes Fineract reject the whole submission — and is tested where
    // it happens, in fineract-staff.api.test.ts. What this asserts is that the form stops
    // pre-filtering, so there is exactly one place that decides.
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

    expect(staffApiSpy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        firstname: 'Ada',
        mobileNo: '',
        externalId: '',
        // false is a real value, not a blank — it must survive.
        isLoanOfficer: false,
      }),
    );
  });
});
