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

import { GetLoansLoanIdDelinquencyPausePeriod } from '../../../api';
import { canResume, toIsoDay } from './loan-delinquency-action.model';

/**
 * A pause period as the platform sends it. The generated model types the dates as strings, but
 * `LocalDate` arrives as `[year, month, day]`, so the fixture is cast rather than typed.
 */
function pause(
  active: boolean,
  start: unknown,
  end: unknown,
): GetLoansLoanIdDelinquencyPausePeriod {
  return { active, pausePeriodStart: start, pausePeriodEnd: end } as never;
}

describe('toIsoDay', () => {
  it('reads the [year, month, day] array Fineract actually sends', () => {
    expect(toIsoDay([2026, 10, 5])).toBe('2026-10-05');
  });

  it('reads the ISO string the generated model declares', () => {
    expect(toIsoDay('2026-10-05')).toBe('2026-10-05');
  });

  it('drops the time from a timestamp, as ion-datetime emits', () => {
    expect(toIsoDay('2026-10-05T00:00:00')).toBe('2026-10-05');
  });

  it.each([undefined, null, '', [], [2026], 20_261_005])('is empty for %j', (value) => {
    expect(toIsoDay(value)).toBe('');
  });
});

describe('canResume', () => {
  const BUSINESS_DATE = '2026-10-01';
  const period = (active: boolean, end: unknown) => pause(active, [2026, 9, 20], end);

  it('offers a resume for a pause that is in effect and has days left', () => {
    expect(canResume([period(true, [2026, 10, 15])], BUSINESS_DATE)).toBe(true);
  });

  it('does not offer one once the pause has been cut short to today', () => {
    // After a resume the platform moves the pause's end to the resume date, which is the business
    // date. The period still reads as active that day; a second resume is refused.
    expect(canResume([period(true, [2026, 10, 1])], BUSINESS_DATE)).toBe(false);
  });

  it('does not offer one for a pause that is not in effect', () => {
    expect(canResume([period(false, [2026, 10, 15])], BUSINESS_DATE)).toBe(false);
  });

  it('does not offer one with no pauses at all', () => {
    expect(canResume([], BUSINESS_DATE)).toBe(false);
  });

  it('finds the one that qualifies among several', () => {
    const ended = pause(false, [2026, 8, 1], [2026, 8, 10]);
    expect(canResume([ended, period(true, '2026-10-15')], BUSINESS_DATE)).toBe(true);
  });

  it('does not guess when the business date is not known', () => {
    expect(canResume([period(true, [2026, 10, 15])], undefined)).toBe(false);
  });
});
