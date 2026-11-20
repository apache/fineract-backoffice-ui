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

import {
  type CronDateTime,
  type CronSchedule,
  cronDateTimeIn,
  formatCronDateTime,
  nextFireTimes,
  parseQuartzCron,
} from './quartz-cron';

/** 2026-10-26 12:00:00, a Monday. */
const NOW: CronDateTime = { year: 2026, month: 10, day: 26, hour: 12, minute: 0, second: 0 };

function schedule(expression: string): CronSchedule {
  const result = parseQuartzCron(expression);
  if (!result.ok) throw new Error(`expected ${expression} to parse: ${JSON.stringify(result)}`);
  return result.schedule;
}

function next(expression: string, count = 3, after = NOW): string[] {
  return nextFireTimes(schedule(expression), after, count).map(formatCronDateTime);
}

describe('parseQuartzCron', () => {
  it.each([
    // The expressions Fineract seeds its own jobs with.
    '0 0 0 1/1 * ? *',
    '0 1 0 1/1 * ? *',
    '0 0 12 * * ?',
    '0 0/15 * * * ?',
    '0 15 10 ? * MON-FRI',
    '0 15 10 L * ?',
    '0 15 10 L-2 * ?',
    '0 15 10 LW * ?',
    '0 15 10 15W * ?',
    '0 15 10 ? * 6L',
    '0 15 10 ? * FRI#3',
    '0 0 22-2 * * ?',
    '0 0 0 ? JAN-MAR,DEC SUN',
    '0 0 0 1 1 ? 2027-2030',
    '0 0 0 1 1 ? */2',
    '  0 0 12   * * ?  ',
    '0 0 12 * * ? ',
    '0 0 12 ? * mon',
  ])('accepts %s', (expression) => {
    expect(parseQuartzCron(expression).ok).toBe(true);
  });

  it('wants six or seven fields', () => {
    expect(parseQuartzCron('0 12 * * ?')).toEqual({ ok: false, problem: { kind: 'fieldCount' } });
    expect(parseQuartzCron('0 0 12 * * ? 2027 x')).toEqual({
      ok: false,
      problem: { kind: 'fieldCount' },
    });
    expect(parseQuartzCron('')).toEqual({ ok: false, problem: { kind: 'fieldCount' } });
  });

  it('refuses a Unix-style line that specifies both day fields, as Quartz does', () => {
    expect(parseQuartzCron('0 0 * * * *')).toEqual({
      ok: false,
      problem: { kind: 'dayConflict' },
    });
    expect(parseQuartzCron('0 0 0 ? * ?')).toEqual({
      ok: false,
      problem: { kind: 'dayConflict' },
    });
  });

  it.each([
    ['60 0 12 * * ?', 'second', '60'],
    ['0 60 12 * * ?', 'minute', '60'],
    ['0 0 24 * * ?', 'hour', '24'],
    ['0 0 12 32 * ?', 'dayOfMonth', '32'],
    ['0 0 12 * 13 ?', 'month', '13'],
    ['0 0 12 ? * 8', 'dayOfWeek', '8'],
    ['0 0 12 ? * FOO', 'dayOfWeek', 'FOO'],
    ['0 0/0 12 * * ?', 'minute', '0/0'],
    ['0 0/60 12 * * ?', 'minute', '0/60'],
    ['0 0 12 L-31 * ?', 'dayOfMonth', 'L-31'],
    ['0 0 12 ? * FRI#6', 'dayOfWeek', 'FRI#6'],
    ['0 0 12 ? * MON/2', 'dayOfWeek', 'MON/2'],
    ['0 0 12 ? * 1-FRI', 'dayOfWeek', '1-FRI'],
    ['0 0 L * * ?', 'hour', 'L'],
    ['0 0 12 * * ? 2030-2027', 'year', '2030-2027'],
    ['0 0 12 1,,2 * ?', 'dayOfMonth', '1,,2'],
  ])('refuses %s, naming the %s field', (expression, field, value) => {
    expect(parseQuartzCron(expression)).toEqual({
      ok: false,
      problem: { kind: 'field', field, value },
    });
  });
});

describe('nextFireTimes', () => {
  it('fires daily at midnight, as the seeded jobs do', () => {
    expect(next('0 0 0 1/1 * ? *')).toEqual([
      '2026-10-27 00:00:00',
      '2026-10-28 00:00:00',
      '2026-10-29 00:00:00',
    ]);
  });

  it('includes a later time today and excludes the current second', () => {
    expect(next('0 0 12,18 * * ?', 2)).toEqual(['2026-10-26 18:00:00', '2026-10-27 12:00:00']);
  });

  it('steps through minutes', () => {
    expect(next('0 0/20 * * * ?')).toEqual([
      '2026-10-26 12:20:00',
      '2026-10-26 12:40:00',
      '2026-10-26 13:00:00',
    ]);
  });

  it('wraps a backwards hour range past midnight', () => {
    expect(next('0 0 23-1 * * ?')).toEqual([
      '2026-10-26 23:00:00',
      '2026-10-27 00:00:00',
      '2026-10-27 01:00:00',
    ]);
  });

  it('uses Quartz day numbering, where 1 is Sunday', () => {
    expect(next('0 0 9 ? * 1', 1)).toEqual(['2026-11-01 09:00:00']);
    expect(next('0 0 9 ? * MON-FRI', 3)).toEqual([
      '2026-10-27 09:00:00',
      '2026-10-28 09:00:00',
      '2026-10-29 09:00:00',
    ]);
  });

  it('reads L in day-of-month as the last day, leap years included', () => {
    expect(next('0 0 0 L * ?', 5)).toEqual([
      '2026-10-31 00:00:00',
      '2026-11-30 00:00:00',
      '2026-12-31 00:00:00',
      '2027-01-31 00:00:00',
      '2027-02-28 00:00:00',
    ]);
    expect(
      next('0 0 0 L 2 ?', 1, { year: 2028, month: 1, day: 1, hour: 0, minute: 0, second: 0 }),
    ).toEqual(['2028-02-29 00:00:00']);
  });

  it('reads L alone in day-of-week as Saturday, as Quartz does', () => {
    expect(next('0 0 9 ? * L', 1)).toEqual(['2026-10-31 09:00:00']);
  });

  it('finds the last weekday of the month for LW', () => {
    // 2027-01-31 is a Sunday, so the last weekday is Friday the 29th.
    expect(
      next('0 0 9 LW * ?', 1, { year: 2027, month: 1, day: 1, hour: 0, minute: 0, second: 0 }),
    ).toEqual(['2027-01-29 09:00:00']);
  });

  it('moves nW to the nearest weekday without leaving the month', () => {
    // 2026-11-01 is a Sunday: 1W is Monday the 2nd, not Friday in October.
    expect(
      next('0 0 9 1W * ?', 1, { year: 2026, month: 11, day: 1, hour: 0, minute: 0, second: 0 }),
    ).toEqual(['2026-11-02 09:00:00']);
    // 2026-11-14 is a Saturday: 14W is Friday the 13th.
    expect(
      next('0 0 9 14W * ?', 1, { year: 2026, month: 11, day: 1, hour: 0, minute: 0, second: 0 }),
    ).toEqual(['2026-11-13 09:00:00']);
  });

  it('finds the last and the nth weekday of a month', () => {
    expect(next('0 0 9 ? * 6L', 2)).toEqual(['2026-10-30 09:00:00', '2026-11-27 09:00:00']);
    expect(next('0 0 9 ? * MON#1', 2)).toEqual(['2026-11-02 09:00:00', '2026-12-07 09:00:00']);
  });

  it('skips a short month for 31W, and finds nothing when only February is allowed', () => {
    expect(next('0 0 9 31W * ?', 2)).toEqual(['2026-10-30 09:00:00', '2026-12-31 09:00:00']);
    expect(next('0 0 9 31W 2 ?')).toEqual([]);
  });

  it('honours the year field', () => {
    expect(next('0 0 0 1 1 ? 2028', 3)).toEqual(['2028-01-01 00:00:00']);
    // Quartz starts a year step at 1970, so */4 lands on 2026, 2030, 2034.
    expect(next('0 0 0 1 1 ? */4', 2)).toEqual(['2030-01-01 00:00:00', '2034-01-01 00:00:00']);
  });

  it('returns nothing for a schedule that never fires', () => {
    expect(next('0 0 0 30 2 ?')).toEqual([]);
    expect(next('0 0 0 1 1 ? 2020')).toEqual([]);
  });
});

describe('cronDateTimeIn', () => {
  const instant = new Date(Date.UTC(2026, 9, 26, 20, 30, 15));

  it('reads the wall clock in the given zone', () => {
    expect(cronDateTimeIn(instant, 'Asia/Kolkata')).toEqual({
      year: 2026,
      month: 10,
      day: 27,
      hour: 2,
      minute: 0,
      second: 15,
    });
    expect(cronDateTimeIn(instant, 'UTC').hour).toBe(20);
  });

  it('falls back to the browser zone for an unknown one', () => {
    expect(cronDateTimeIn(instant, 'Not/AZone')).toEqual(cronDateTimeIn(instant, null));
  });
});
