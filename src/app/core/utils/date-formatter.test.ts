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
  FINERACT_DATE_FORMAT,
  formatArrayDate,
  formatDateToFineract,
  toIsoDate,
} from './date-formatter';

const JAN_5_2026 = '2026-01-05';

describe('date-formatter', () => {
  describe('toIsoDate', () => {
    it('formats a Date as YYYY-MM-DD', () => {
      expect(toIsoDate(new Date(2026, 0, 5))).toBe(JAN_5_2026);
    });

    it('zero-pads single-digit months and days', () => {
      expect(toIsoDate(new Date(2026, 8, 9))).toBe('2026-09-09');
    });

    // toISOString() would convert to UTC and roll a late-evening local date back a day.
    it('uses local time rather than UTC', () => {
      expect(toIsoDate(new Date(2026, 2, 15, 23, 30))).toBe('2026-03-15');
    });

    it('takes the date part of an ion-datetime ISO string', () => {
      expect(toIsoDate('2026-07-26T14:30:00')).toBe('2026-07-26');
    });

    it('returns empty string for nullish or invalid input', () => {
      expect(toIsoDate(null)).toBe('');
      expect(toIsoDate(undefined)).toBe('');
      expect(toIsoDate('')).toBe('');
      expect(toIsoDate(new Date('nonsense'))).toBe('');
    });
  });

  describe('formatArrayDate', () => {
    it('formats a Fineract [year, month, day] array', () => {
      expect(formatArrayDate([2026, 1, 5])).toBe(JAN_5_2026);
    });

    it('returns a dash for anything that is not an array date', () => {
      expect(formatArrayDate(null)).toBe('-');
      expect(formatArrayDate([2026])).toBe('-');
      expect(formatArrayDate(JAN_5_2026)).toBe('-');
    });
  });

  describe('formatDateToFineract', () => {
    it('formats a Date in the display format', () => {
      expect(formatDateToFineract(new Date(2026, 0, 15))).toBe('15 January 2026');
    });

    it('accepts a Fineract array date', () => {
      expect(formatDateToFineract([2026, 1, 15])).toBe('15 January 2026');
    });

    it('pads a single-digit day to two digits', () => {
      // Callers send this alongside FINERACT_DATE_FORMAT ('dd MMMM yyyy'). Fineract parses the
      // value strictly against that format, so '2 August 2026' fails to parse and the request
      // comes back 500 — every dated submission in the application broke on the 1st to the 9th.
      expect(formatDateToFineract(new Date(2026, 7, 2))).toBe('02 August 2026');
      expect(formatDateToFineract(new Date(2026, 0, 1))).toBe('01 January 2026');
      expect(formatDateToFineract(new Date(2026, 0, 9))).toBe('09 January 2026');
    });

    it('pads a single-digit day from an array date too', () => {
      expect(formatDateToFineract([2026, 8, 2])).toBe('02 August 2026');
    });

    it('leaves a two-digit day alone', () => {
      expect(formatDateToFineract(new Date(2026, 0, 10))).toBe('10 January 2026');
      expect(formatDateToFineract(new Date(2026, 11, 31))).toBe('31 December 2026');
    });

    it('agrees with the format string it is always sent with', () => {
      // The guarantee that actually matters: day and month are fixed-width, matching 'dd'.
      expect(FINERACT_DATE_FORMAT).toBe('dd MMMM yyyy');
      for (let day = 1; day <= 28; day++) {
        expect(formatDateToFineract(new Date(2026, 0, day)).split(' ', 1)[0]).toHaveLength(2);
      }
    });

    /**
     * These are the cases that motivated the date-only branch. They only *fail* at a negative
     * UTC offset, so CI runs the whole unit suite a second time under `TZ=America/New_York` —
     * see the "Run unit tests west of Greenwich" step in `ci.yml`. Under UTC they still pin the
     * behaviour; they just cannot detect its absence.
     */
    describe('a date-only string', () => {
      it('is read as the calendar date it spells, not as UTC midnight', () => {
        expect(formatDateToFineract('2026-01-15')).toBe('15 January 2026');
        expect(formatDateToFineract('2026-04-01')).toBe('01 April 2026');
      });

      it('does not roll back across a month or a year boundary', () => {
        // The 1st is the case that exposes the shift most sharply: a day early crosses into the
        // previous month, and on 1 January into the previous year.
        expect(formatDateToFineract('2026-01-01')).toBe('01 January 2026');
        expect(formatDateToFineract('2026-03-01')).toBe('01 March 2026');
      });

      it('agrees with the array form of the same date', () => {
        for (const iso of ['2026-01-01', '2026-06-15', '2026-12-31']) {
          const [year, month, day] = iso.split('-').map(Number);
          expect(formatDateToFineract(iso)).toBe(formatDateToFineract([year, month, day]));
        }
      });
    });

    it('leaves a string carrying a time to the platform parser', () => {
      // What ion-datetime emits. `new Date()` already reads a local timestamp as local, and an
      // explicit `Z` as UTC — neither needs the date-only branch, and both would be wrong if it
      // claimed them.
      expect(formatDateToFineract('2026-07-26T14:30:00')).toBe('26 July 2026');
    });

    it('returns empty string for invalid input', () => {
      expect(formatDateToFineract(null)).toBe('');
      expect(formatDateToFineract([2026])).toBe('');
      expect(formatDateToFineract('not-a-date')).toBe('');
      expect(formatDateToFineract('2026-13-45')).toBe('');
    });
  });
});
