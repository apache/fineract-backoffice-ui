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
import { vi } from 'vitest';

import { HolidaysService } from '../../../api';
import { FineractHolidayApi, mapHoliday, mapHolidayStatus } from './fineract-holiday.api';
import { RESCHEDULING_TYPE } from './holiday-rescheduling-type';

/**
 * Copied from `GET /holidays?officeId=1` on a running `apache/fineract:latest`, after seeding a
 * holiday to have one to read.
 *
 * All three dates are arrays where `GetHolidaysResponse` says `string`, and `description` and
 * `reschedulingType` are not declared at all.
 */
const PENDING_HOLIDAY = {
  id: 1,
  name: 'E2EAdapterProbe',
  description: '',
  fromDate: [2027, 1, 5],
  toDate: [2027, 1, 5],
  repaymentsRescheduledTo: [2027, 1, 6],
  status: {
    id: 100,
    code: 'holidayStatusType.pending.for.activation',
    value: 'Pending for activation',
  },
  reschedulingType: 2,
};

describe('mapHolidayStatus', () => {
  it('derives isPending from the stable code, not the display text', () => {
    // The holidays list decides whether to offer Activate from this. Deciding it from `value`
    // would break on any platform not serving English — the mistake the loans list was making.
    expect(mapHolidayStatus(PENDING_HOLIDAY.status).isPending).toBe(true);
  });

  it('reports an active holiday as not pending', () => {
    expect(
      mapHolidayStatus({ id: 300, code: 'holidayStatusType.active', value: 'Active' }).isPending,
    ).toBe(false);
  });

  it('answers a missing status without throwing', () => {
    expect(mapHolidayStatus(undefined)).toEqual({
      id: null,
      code: '',
      value: '',
      isPending: false,
    });
  });
});

describe('mapHoliday', () => {
  it('converts all three array dates the platform sends', () => {
    const holiday = mapHoliday(PENDING_HOLIDAY);
    expect(holiday.fromDate).toBe('2027-01-05');
    expect(holiday.toDate).toBe('2027-01-05');
    expect(holiday.repaymentsRescheduledTo).toBe('2027-01-06');
  });

  it('zero-pads a single-digit month and day', () => {
    // '2027-1-5' sorts and compares wrongly against a padded date.
    const holiday = mapHoliday({ ...PENDING_HOLIDAY, fromDate: [2027, 3, 7] });
    expect(holiday.fromDate).toBe('2027-03-07');
  });

  it('exposes reschedulingType, which the generated type does not declare', () => {
    // The form previously recovered this by checking whether repaymentsRescheduledTo was set.
    expect(mapHoliday(PENDING_HOLIDAY).reschedulingType).toBe(RESCHEDULING_TYPE.SpecifiedDate);
  });

  it('refuses a reschedulingType the platform does not define', () => {
    // A guard rather than a cast: an unknown value would otherwise reach a select as a
    // selection no option matches.
    expect(mapHoliday({ ...PENDING_HOLIDAY, reschedulingType: 99 }).reschedulingType).toBeNull();
  });

  it('reports no reschedule date as null, which is how the other rule arrives', () => {
    const holiday = mapHoliday({
      ...PENDING_HOLIDAY,
      repaymentsRescheduledTo: undefined,
      reschedulingType: 1,
    });
    expect(holiday.repaymentsRescheduledTo).toBeNull();
    expect(holiday.reschedulingType).toBe(RESCHEDULING_TYPE.NextRepaymentDate);
  });

  it('refuses a holiday with no id rather than activating the wrong one', () => {
    expect(() => mapHoliday({ ...PENDING_HOLIDAY, id: undefined })).toThrow(/no id/);
  });
});

describe('FineractHolidayApi', () => {
  let generated: {
    getHolidays: ReturnType<typeof vi.fn>;
    getHolidaysHolidayId: ReturnType<typeof vi.fn>;
    getHolidaysTemplate: ReturnType<typeof vi.fn>;
    postHolidays: ReturnType<typeof vi.fn>;
    putHolidaysHolidayId: ReturnType<typeof vi.fn>;
    postHolidaysHolidayId: ReturnType<typeof vi.fn>;
    deleteHolidaysHolidayId: ReturnType<typeof vi.fn>;
  };
  let api: FineractHolidayApi;

  const DRAFT = {
    name: 'Founders Day',
    fromDate: '2027-01-05',
    toDate: '2027-01-05',
    reschedulingType: RESCHEDULING_TYPE.SpecifiedDate,
    repaymentsRescheduledTo: '2027-01-06',
    officeIds: [1, 2],
  } as const;

  beforeEach(() => {
    generated = {
      getHolidays: vi.fn().mockReturnValue(of([PENDING_HOLIDAY])),
      getHolidaysHolidayId: vi.fn().mockReturnValue(of(PENDING_HOLIDAY)),
      getHolidaysTemplate: vi.fn().mockReturnValue(of([{ id: 1, value: 'Next repayment date' }])),
      postHolidays: vi.fn().mockReturnValue(of({})),
      putHolidaysHolidayId: vi.fn().mockReturnValue(of({})),
      postHolidaysHolidayId: vi.fn().mockReturnValue(of({})),
      deleteHolidaysHolidayId: vi.fn().mockReturnValue(of({})),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: HolidaysService, useValue: generated }],
    });
    api = TestBed.inject(FineractHolidayApi);
  });

  function options(): Promise<unknown> {
    return new Promise((resolve) => api.reschedulingOptions().subscribe(resolve));
  }

  it('survives the empty body an office with no holidays returns', async () => {
    generated.getHolidays.mockReturnValue(of(null));
    const holidays = await new Promise((resolve) => api.list().subscribe(resolve));
    expect(holidays).toEqual([]);
  });

  it('sends the dates in the format it tells Fineract to parse against', () => {
    api.create(DRAFT).subscribe();

    expect(generated.postHolidays).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Founders Day',
        fromDate: '05 January 2027',
        toDate: '05 January 2027',
        repaymentsRescheduledTo: '06 January 2027',
        reschedulingType: RESCHEDULING_TYPE.SpecifiedDate,
        offices: [{ officeId: 1 }, { officeId: 2 }],
        dateFormat: 'dd MMMM yyyy',
        locale: 'en',
      }),
    );
  });

  it('omits the reschedule date under the rule that does not use one', () => {
    // Fineract rejects a holiday that names a reschedule date under the "next repayment date"
    // rule, so sending one left over from a changed selection would be a guaranteed 400.
    api.create({ ...DRAFT, reschedulingType: RESCHEDULING_TYPE.NextRepaymentDate }).subscribe();

    expect(generated.postHolidays.mock.calls[0][0]).not.toHaveProperty('repaymentsRescheduledTo');
  });

  it('sends the dates on update too, which the generated request type does not declare', () => {
    // Verified against a running instance: PUT /holidays/{id} applies them and reports them in
    // its `changes` block. The generated type declares only name and description.
    api.update(1, DRAFT).subscribe();

    expect(generated.putHolidaysHolidayId).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ fromDate: '05 January 2027', toDate: '05 January 2027' }),
    );
  });

  it('activates through the command the platform expects', () => {
    api.activate(1).subscribe();
    expect(generated.postHolidaysHolidayId).toHaveBeenCalledWith(1, {}, 'activate');
  });

  it('passes the template options through when there are some', async () => {
    expect(await options()).toEqual([{ id: 1, value: 'Next repayment date' }]);
  });

  it('parses a template that arrives as a JSON string', async () => {
    // This endpoint has been seen to answer with a string rather than a parsed body.
    generated.getHolidaysTemplate.mockReturnValue(of('[{"id":2,"value":"Specified date"}]'));
    expect(await options()).toEqual([{ id: 2, value: 'Specified date' }]);
  });

  it('falls back to the platform two when the template cannot be read', async () => {
    // The form cannot be filled without them and they are fixed in the platform, so an empty
    // list would be worse than the known answer.
    generated.getHolidaysTemplate.mockReturnValue(throwError(() => new Error('boom')));
    expect(await options()).toEqual([
      { id: RESCHEDULING_TYPE.NextRepaymentDate, value: 'Reschedule to next repayment date' },
      { id: RESCHEDULING_TYPE.SpecifiedDate, value: 'Reschedule to specified date' },
    ]);
  });

  it('falls back when the template is unparseable rather than propagating a SyntaxError', async () => {
    generated.getHolidaysTemplate.mockReturnValue(of('not json'));
    expect(await options()).toHaveLength(2);
  });
});
