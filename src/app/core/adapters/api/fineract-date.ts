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

/**
 * Fineract's inbound date forms, converted once.
 *
 * Shared by the office and loan adapters, which is why it is here rather than in either. The
 * platform declares every `LocalDate` as `string` in the OpenAPI document and sends
 * `[year, month, day]`, so each adapter that maps a dated payload needs the same conversion,
 * and a second copy of it would be a second place for the month base to be wrong.
 *
 * Accepts the array form Fineract sends and the string form the spec claims, so a corrected
 * spec upstream would need no change here.
 *
 * Named to distinguish it from `toIsoDate()` in `core/utils/date-formatter.ts`, which converts
 * a `Date` or an `ion-datetime` string on the way *out* to Fineract. This converts what comes
 * *in*.
 *
 * Deliberately not `formatArrayDate()` from the same file: that returns `'-'` for anything it
 * cannot read, which is the right answer for a table cell and the wrong one for a model. A
 * placeholder stored as data cannot be formatted, compared or sorted, and it hides the
 * difference between "no date" and "a date we failed to read". This returns `null` and lets the
 * view decide how to show that.
 */
export function toIsoFineractDate(value: string | number[] | undefined | null): string | null {
  if (value === undefined || value === null) return null;

  if (Array.isArray(value)) {
    // Fineract's month is 1-based here, unlike `Date`'s. No arithmetic, so no conversion.
    const [year, month, day] = value;
    if (typeof year !== 'number' || typeof month !== 'number' || typeof day !== 'number') {
      return null;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Already a date-shaped string; keep the date part, drop any time.
  return value === '' ? null : (value.split('T', 1)[0] ?? null);
}
