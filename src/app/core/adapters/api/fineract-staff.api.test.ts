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
import { of } from 'rxjs';
import { vi } from 'vitest';

import { StaffService } from '../../../api';
import { FineractStaffApi, mapStaff } from './fineract-staff.api';

/**
 * Payloads copied from `GET /staff` and `GET /staff/1` on a running `apache/fineract:latest`.
 *
 * `joiningDate` is a **string** here, which is what `StaffData` declares and what the platform
 * actually sends. That is the point of this fixture: the previous spec invented
 * `joiningDate: [2026, 1, 5]`, an array this endpoint never sends, and so confirmed a component
 * that rendered `'-'` in a browser.
 */
const LOAN_OFFICER = {
  id: 1,
  firstname: 'Field',
  lastname: 'Officer',
  displayName: 'Officer, Field',
  officeId: 1,
  officeName: 'Head Office',
  isLoanOfficer: true,
  isActive: true,
  joiningDate: '2020-01-01',
  dateFormat: 'dd MMMM yyyy',
};

describe('mapStaff', () => {
  it('reads the string date the platform actually sends', () => {
    // The regression this file exists for. `formatArrayDate()` returned '-' for this value, and
    // the staff edit form put that straight into its date picker.
    expect(mapStaff(LOAN_OFFICER).joiningDate).toBe('2020-01-01');
  });

  it('also reads the array form, so the encoding stops being the screen problem', () => {
    // GET /offices sends [y, m, d] for the same kind of field. A screen cannot tell from the
    // type which it is getting; the mapper does not need to care.
    expect(mapStaff({ ...LOAN_OFFICER, joiningDate: [2026, 1, 5] }).joiningDate).toBe('2026-01-05');
  });

  it('reports no joining date as null rather than as a dash', () => {
    // '-' stored as data cannot be compared or formatted, and hides "no date" from
    // "a date we failed to read". Turning null into a dash stays the view's job.
    expect(mapStaff({ ...LOAN_OFFICER, joiningDate: undefined }).joiningDate).toBeNull();
  });

  it('exposes emailAddress, which the generated model does not declare', () => {
    // staff-form.component.ts reached it through a Record<string, unknown> cast.
    expect(mapStaff({ ...LOAN_OFFICER, emailAddress: 'f@example.org' }).emailAddress).toBe(
      'f@example.org',
    );
  });

  it('maps a whole staff member', () => {
    expect(mapStaff(LOAN_OFFICER)).toEqual({
      id: 1,
      firstname: 'Field',
      lastname: 'Officer',
      displayName: 'Officer, Field',
      officeId: 1,
      officeName: 'Head Office',
      externalId: null,
      mobileNo: null,
      emailAddress: null,
      isLoanOfficer: true,
      isActive: true,
      joiningDate: '2020-01-01',
    });
  });

  it('builds a display name from the parts when Fineract sends none', () => {
    // Every staff picker renders displayName; a blank option is worse than an unformatted one.
    const staff = mapStaff({ ...LOAN_OFFICER, displayName: undefined });
    expect(staff.displayName).toBe('Officer, Field');
  });

  it('does not leave a stray comma when only one name part is present', () => {
    expect(
      mapStaff({ ...LOAN_OFFICER, displayName: undefined, lastname: undefined }).displayName,
    ).toBe('Field');
  });

  it('refuses a staff member with no id rather than assigning one that cannot be saved', () => {
    expect(() => mapStaff({ ...LOAN_OFFICER, id: undefined })).toThrow(/no id/);
  });

  it('defaults the flags to false rather than undefined', () => {
    const staff = mapStaff({ id: 9, firstname: 'A', lastname: 'B' });
    expect(staff.isLoanOfficer).toBe(false);
    expect(staff.isActive).toBe(false);
  });
});

describe('FineractStaffApi', () => {
  let generated: {
    getStaff: ReturnType<typeof vi.fn>;
    getStaffStaffId: ReturnType<typeof vi.fn>;
    postStaff: ReturnType<typeof vi.fn>;
    putStaffStaffId: ReturnType<typeof vi.fn>;
  };
  let api: FineractStaffApi;

  beforeEach(() => {
    generated = {
      getStaff: vi.fn().mockReturnValue(of([LOAN_OFFICER])),
      getStaffStaffId: vi.fn().mockReturnValue(of(LOAN_OFFICER)),
      postStaff: vi.fn().mockReturnValue(of({})),
      putStaffStaffId: vi.fn().mockReturnValue(of({})),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: StaffService, useValue: generated }],
    });
    api = TestBed.inject(FineractStaffApi);
  });

  it('places each filter in the positional slot the generated signature expects', () => {
    // officeId, staffInOfficeHierarchy, loanOfficersOnly, status. Getting this wrong is silent:
    // every parameter is optional, so a misplaced argument is still a valid call.
    api.list({ officeId: 3, loanOfficersOnly: true, status: 'all' }).subscribe();
    expect(generated.getStaff).toHaveBeenCalledWith(3, undefined, true, 'all');
  });

  it('survives the empty body an office with no staff returns', async () => {
    generated.getStaff.mockReturnValue(of(null));
    const staff = await new Promise((resolve) => api.list().subscribe(resolve));
    expect(staff).toEqual([]);
  });

  it('sends the joining date in the format it tells Fineract to parse against', async () => {
    // Fineract parses strictly against `dateFormat`, so the pair has to travel together or the
    // request answers 500 rather than a validation error. The day is zero-padded because `dd`
    // demands it — unpadded, every submission on the 1st to the 9th of a month failed.
    api
      .create({
        officeId: 1,
        firstname: 'New',
        lastname: 'Hire',
        isLoanOfficer: false,
        isActive: true,
        joiningDate: '2026-03-07',
      })
      .subscribe();

    expect(generated.postStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        joiningDate: '07 March 2026',
        dateFormat: 'dd MMMM yyyy',
        locale: 'en',
      }),
    );
  });

  it('omits the optional text fields the user left blank', () => {
    // Not cosmetic. Sending `mobileNo: ''` makes Fineract reject the whole submission with
    // "mobileNo must contain only digits", naming a field deliberately left empty — so a staff
    // member could not be created without a phone number. The form used to strip these itself.
    api
      .create({
        officeId: 1,
        firstname: 'New',
        lastname: 'Hire',
        mobileNo: '',
        externalId: '',
        emailAddress: null,
        isLoanOfficer: false,
        isActive: true,
        joiningDate: '2026-03-07',
      })
      .subscribe();

    const body = generated.postStaff.mock.calls[0][0] as Record<string, unknown>;
    // `in`, not a truthiness check: an `undefined` value under a present key would pass the
    // latter while still being a key this adapter promised not to send.
    expect('mobileNo' in body).toBe(false);
    expect('externalId' in body).toBe(false);
    expect('emailAddress' in body).toBe(false);
    // `false` is a real value, not a blank, and must survive.
    expect(body['isLoanOfficer']).toBe(false);
  });

  it('keeps the optional fields the user did fill in', () => {
    api
      .create({
        officeId: 1,
        firstname: 'New',
        lastname: 'Hire',
        mobileNo: '0712345678',
        emailAddress: 'hire@example.org',
        isLoanOfficer: false,
        isActive: true,
        joiningDate: '2026-03-07',
      })
      .subscribe();

    expect(generated.postStaff).toHaveBeenCalledWith(
      expect.objectContaining({ mobileNo: '0712345678', emailAddress: 'hire@example.org' }),
    );
  });

  it('sends only what the edit form may change', () => {
    api.update(7, { externalId: 'EX-7', isLoanOfficer: true }).subscribe();
    expect(generated.putStaffStaffId).toHaveBeenCalledWith(7, {
      externalId: 'EX-7',
      isLoanOfficer: true,
    });
  });
});
