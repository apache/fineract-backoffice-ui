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

/** One exportable column: `key` reads the row, `label` is the header cell. */
export interface CsvColumn {
  key: string;
  label: string;
}

/**
 * Quotes a CSV field per RFC 4180: wrapped in `"..."` whenever it contains a comma, quote, or
 * newline, with internal `"` doubled. Left bare otherwise, so simple exports stay readable.
 */
function csvField(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Renders `rows` as CSV text, headered by `columns` — the same shape a table renders on screen.
 *
 * Takes any object, not just `Record<string, unknown>`, so an adapter's interface-typed rows can
 * be exported without being retyped first.
 */
export function toCsv(columns: CsvColumn[], rows: readonly object[]): string {
  const header = columns.map((c) => csvField(c.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => csvField((row as Record<string, unknown>)[c.key])).join(','),
  );
  return [header, ...lines].join('\r\n');
}
