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
    d = new Date(date);
  } else {
    d = date;
  }

  if (isNaN(d.getTime())) return '';

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

  if (isNaN(date.getTime())) return '';

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
