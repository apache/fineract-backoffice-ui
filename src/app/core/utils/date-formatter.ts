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

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** The date-only form ECMAScript specifies as UTC: exactly `YYYY-MM-DD`, nothing more. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Builds a local `Date` from calendar parts, rejecting a value that is merely well-shaped.
 *
 * `new Date(2026, 12, 45)` does not fail — it rolls forward to 14 February 2027. Handing a
 * malformed string back as a real date is worse than refusing it, since the caller sends the
 * result to the platform as the user's chosen date, so the parts are read back and compared.
 */
function localDate(year: number, month: number, day: number): Date {
  const d = new Date(year, month - 1, day);
  const rolled = d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day;
  return rolled ? new Date(Number.NaN) : d;
}

/**
 * Formats a Date object (or date-like string/array) into the Fineract-preferred
 * 'dd Month yyyy' format (e.g., '15 January 2026', '02 August 2026').
 *
 * The day is zero-padded to two digits because every caller sends this alongside
 * `FINERACT_DATE_FORMAT`, which declares `dd`. Fineract parses the value strictly against the
 * format it is told to use, so an unpadded '2 August 2026' does not merely fail validation — it
 * fails to parse at all and the request comes back 500. That made every dated submission in the
 * application fail on the 1st through the 9th of any month, and succeed for the rest of it.
 *
 * A **date-only** string is read through its parts rather than handed to `new Date()`. ECMAScript
 * reads `'2026-01-15'` as UTC midnight while the getters below read local time, so west of
 * Greenwich the two disagree and the output lands a day early — `'2026-01-15'` formats as
 * `14 January 2026` in `America/New_York`. Every screen that pre-fills a date from an API
 * response and is saved without re-picking that field went out with the wrong day.
 *
 * A string carrying a time (`'2026-01-15T00:00:00'`, what `ion-datetime` emits) or an explicit
 * zone (`'...Z'`) is left to `new Date()`, which already reads both correctly.
 *
 * @param date - The date to format.
 * @returns The formatted date string, or empty string if invalid.
 */
export function formatDateToFineract(date: Date | string | number[] | null | undefined): string {
  if (!date) return '';

  let d: Date;
  if (Array.isArray(date)) {
    if (date.length >= 3) {
      d = new Date(date[0], date[1] - 1, date[2]);
    } else {
      return '';
    }
  } else if (typeof date === 'string') {
    const parts = DATE_ONLY.exec(date);
    d = parts ? localDate(+parts[1], +parts[2], +parts[3]) : new Date(date);
  } else {
    d = date;
  }

  if (Number.isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();

  return `${day} ${month} ${year}`;
}

export const FINERACT_DATE_FORMAT = 'dd MMMM yyyy';
export const FINERACT_LOCALE = 'en';

/**
 * Formats a Fineract array date (`[year, month, day]`) into a `YYYY-MM-DD` string for table display.
 *
 * @param value - The raw value from the API (expected to be a 3+ element number array).
 * @returns The formatted `YYYY-MM-DD` string, or `'-'` when the value is not a valid array date.
 */
export function formatArrayDate(value: unknown): string {
  if (!Array.isArray(value) || value.length < 3) {
    return '-';
  }
  return `${value[0]}-${String(value[1]).padStart(2, '0')}-${String(value[2]).padStart(2, '0')}`;
}

/**
 * Formats a date as `YYYY-MM-DD` in **local** time, the wire format Fineract expects
 * alongside `dateFormat: 'yyyy-MM-dd'`.
 *
 * Deliberately not `Date.prototype.toISOString()`, which converts to UTC and can shift the
 * date by a day for users east or west of Greenwich.
 *
 * @param date - A Date, or an ISO string such as the value emitted by `ion-datetime`.
 * @returns The `YYYY-MM-DD` string, or empty string when the input is not a valid date.
 */
export function toIsoDate(date: Date | string | null | undefined): string {
  if (!date) return '';

  if (typeof date === 'string') {
    // ion-datetime emits a full local ISO timestamp; the date part is already correct.
    return date.split('T', 1)[0];
  }

  if (Number.isNaN(date.getTime())) return '';

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
