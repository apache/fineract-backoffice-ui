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

import { IsoDatePipe } from './iso-date.pipe';

describe('IsoDatePipe', () => {
  const pipe = new IsoDatePipe();
  const jan2 = new Date(2025, 0, 2).toLocaleDateString();

  it('formats a YYYY-MM-DD string as that calendar date', () => {
    expect(pipe.transform('2025-01-02')).toBe(jan2);
  });

  it("formats Fineract's [year, month, day] array as that calendar date", () => {
    expect(pipe.transform([2025, 1, 2])).toBe(jan2);
  });

  it('prints a date only, without a time or a time zone', () => {
    expect(pipe.transform([2025, 1, 2])).not.toMatch(/\d{1,2}:\d{2}|GMT|UTC/);
  });

  it('returns a dash for an array with fewer than three parts', () => {
    expect(pipe.transform([2025, 1])).toBe('—');
  });

  it('returns a dash for an array whose parts are not numbers', () => {
    expect(pipe.transform(['2025', '1', '2'] as unknown as number[])).toBe('—');
  });

  it('returns a dash for an empty or missing value', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
    expect(pipe.transform('')).toBe('—');
  });

  it('returns a dash for an unparseable string', () => {
    expect(pipe.transform('not-a-date')).toBe('—');
  });
});
