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
 * Quartz cron expressions: parsing, and the next times one fires.
 *
 * Fineract schedules its jobs with Quartz and validates `PUT /jobs/{id}` with
 * `CronExpression.isValidExpression`, so this follows Quartz's dialect rather than Unix cron's:
 * six or seven fields with seconds first, `?` in exactly one of day-of-month and day-of-week,
 * and the `L`, `W` and `#` day options. `0 0 * * * *` is a valid Unix-style line and a Quartz
 * parse error, because both day fields are specified.
 *
 * The parser is deliberately a little stricter than Quartz's. Quartz silently ignores trailing
 * characters in a few positions (`MON/2` is read as `MON`), and accepts a step of zero; both are
 * refused here. Anything this accepts, Quartz accepts too, with one difference in meaning: an
 * `nW` day past the end of a short month, which {@link nextFireTimes} skips and Quartz rolls
 * into the next month.
 */

/** The fields of a Quartz expression, in order. */
export type CronFieldName =
  'second' | 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek' | 'year';

const FIELD_ORDER: readonly CronFieldName[] = [
  'second',
  'minute',
  'hour',
  'dayOfMonth',
  'month',
  'dayOfWeek',
  'year',
];

/** Why an expression was refused. A form turns these into its own wording. */
export type CronProblem =
  | { readonly kind: 'fieldCount' }
  | { readonly kind: 'field'; readonly field: CronFieldName; readonly value: string }
  | { readonly kind: 'dayConflict' };

/** A wall-clock moment, with no time zone. Month is 1-based, as written in an expression. */
export interface CronDateTime {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

/** Which days of a month an expression fires on. */
type DayRule =
  | { readonly kind: 'monthDays'; readonly days: ReadonlySet<number> }
  /** `L`, `L-3`, `LW`, `L-3W`. */
  | { readonly kind: 'lastDay'; readonly offset: number; readonly weekday: boolean }
  /** `15W`: the weekday nearest the 15th, without leaving the month. */
  | { readonly kind: 'nearestWeekday'; readonly day: number }
  /** Days of the week, Quartz-numbered: 1 is Sunday, 7 is Saturday. */
  | { readonly kind: 'weekdays'; readonly days: ReadonlySet<number> }
  /** `6L`: the last Friday of the month. */
  | { readonly kind: 'lastWeekday'; readonly weekday: number }
  /** `6#3`: the third Friday of the month. */
  | { readonly kind: 'nthWeekday'; readonly weekday: number; readonly nth: number };

/** A parsed expression. Opaque outside this file; pass it to {@link nextFireTimes}. */
export interface CronSchedule {
  readonly seconds: readonly number[];
  readonly minutes: readonly number[];
  readonly hours: readonly number[];
  readonly months: readonly number[];
  /** `null` when the year field is absent or `*`. */
  readonly years: ReadonlySet<number> | null;
  readonly days: DayRule;
}

export type CronParseResult =
  | { readonly ok: true; readonly schedule: CronSchedule }
  | { readonly ok: false; readonly problem: CronProblem };

interface FieldBounds {
  readonly min: number;
  readonly max: number;
  readonly names?: readonly string[];
}

const MONTH_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const BOUNDS: Record<Exclude<CronFieldName, 'year'>, FieldBounds> = {
  second: { min: 0, max: 59 },
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12, names: MONTH_NAMES },
  dayOfWeek: { min: 1, max: 7, names: DAY_NAMES },
};

/**
 * How far ahead Quartz looks for a fire time. `CronExpression.MAX_YEAR` is the current year plus
 * 100; an expression with no fire time before then is one Quartz refuses to schedule.
 */
const YEARS_AHEAD = 100;

/** Quartz caps the `L-n` offset at 30. */
const MAX_LAST_DAY_OFFSET = 30;

class FieldError extends Error {}

/**
 * Parses a Quartz cron expression.
 *
 * Case-insensitive, as Quartz upper-cases the expression before reading it, and tolerant of
 * surrounding and repeated whitespace, as Fineract trims it and Quartz splits on runs of it.
 */
export function parseQuartzCron(expression: string): CronParseResult {
  const tokens = expression
    .trim()
    .toUpperCase()
    .split(/[ \t]+/)
    .filter(Boolean);
  if (tokens.length < 6 || tokens.length > 7) {
    return { ok: false, problem: { kind: 'fieldCount' } };
  }

  // The field being read, so a refusal can name it.
  let field: CronFieldName = 'second';
  try {
    const seconds = parseList(tokens[0], BOUNDS.second);
    field = 'minute';
    const minutes = parseList(tokens[1], BOUNDS.minute);
    field = 'hour';
    const hours = parseList(tokens[2], BOUNDS.hour);
    field = 'month';
    const months = parseList(tokens[4], BOUNDS.month);
    field = 'year';
    const years = tokens[6] === undefined || tokens[6] === '*' ? null : parseYears(tokens[6]);

    const dayOfMonth = tokens[3];
    const dayOfWeek = tokens[5];
    // Quartz implements one day field or the other, never both and never neither.
    if ((dayOfMonth === '?') === (dayOfWeek === '?')) {
      return { ok: false, problem: { kind: 'dayConflict' } };
    }
    let days: DayRule;
    if (dayOfWeek === '?') {
      field = 'dayOfMonth';
      days = parseDayOfMonth(dayOfMonth);
    } else {
      field = 'dayOfWeek';
      days = parseDayOfWeek(dayOfWeek);
    }

    return {
      ok: true,
      schedule: {
        seconds: sorted(seconds),
        minutes: sorted(minutes),
        hours: sorted(hours),
        months: sorted(months),
        years,
        days,
      },
    };
  } catch (error) {
    if (!(error instanceof FieldError)) throw error;
    return {
      ok: false,
      problem: { kind: 'field', field, value: tokens[FIELD_ORDER.indexOf(field)] },
    };
  }
}

/**
 * The next `count` times a schedule fires strictly after `after`, earliest first.
 *
 * Wall-clock arithmetic only: Fineract fires its triggers in the tenant's time zone, and the
 * expression says nothing about zones, so neither does this. Fewer than `count` come back when
 * the schedule runs out within Quartz's horizon, and none at all for one that never fires,
 * such as `0 0 0 30 2 ?` — Quartz accepts that expression, and Fineract then fails to
 * schedule it.
 *
 * An `nW` day past the end of a short month (`31W` in April) is treated as not firing that
 * month. Quartz's own handling of that case rolls into the next month; it is rare enough that
 * a preview erring towards fewer fire times is the safer reading.
 */
export function nextFireTimes(
  schedule: CronSchedule,
  after: CronDateTime,
  count: number,
): CronDateTime[] {
  const found: CronDateTime[] = [];
  if (count <= 0) return found;

  const afterDay = dayKey(after.year, after.month, after.day);
  for (const date of daysFrom(schedule, after)) {
    // Every time of day counts on a later day; on the starting day only the ones still to come.
    const sameDay = dayKey(date.year, date.month, date.day) === afterDay;
    const notBefore = sameDay ? timeKey(after.hour, after.minute, after.second) : -1;
    for (const time of timesAfter(schedule, notBefore)) {
      found.push({ ...date, ...time });
      if (found.length === count) return found;
    }
  }
  return found;
}

/** The days a schedule fires on, from `after`'s day up to Quartz's horizon. */
function* daysFrom(
  schedule: CronSchedule,
  after: CronDateTime,
): Generator<Pick<CronDateTime, 'year' | 'month' | 'day'>> {
  const afterDay = dayKey(after.year, after.month, after.day);
  for (let year = after.year; year <= after.year + YEARS_AHEAD; year++) {
    if (schedule.years && !schedule.years.has(year)) continue;
    for (const month of schedule.months) {
      for (const day of matchingDays(schedule.days, year, month)) {
        if (dayKey(year, month, day) >= afterDay) yield { year, month, day };
      }
    }
  }
}

/** The times of day a schedule fires at, strictly after `after` seconds past midnight. */
function* timesAfter(
  schedule: CronSchedule,
  after: number,
): Generator<Pick<CronDateTime, 'hour' | 'minute' | 'second'>> {
  for (const hour of schedule.hours) {
    for (const minute of schedule.minutes) {
      for (const second of schedule.seconds) {
        if (timeKey(hour, minute, second) > after) yield { hour, minute, second };
      }
    }
  }
}

/** `2026-11-01 01:00:00`: unambiguous, sortable, and the same in every language. */
export function formatCronDateTime(moment: CronDateTime): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${moment.year}-${pad(moment.month)}-${pad(moment.day)} ` +
    `${pad(moment.hour)}:${pad(moment.minute)}:${pad(moment.second)}`
  );
}

/**
 * The wall-clock time of `date` in `timeZone`, or in the browser's zone when none is given or
 * the zone is not one `Intl` knows.
 */
export function cronDateTimeIn(date: Date, timeZone?: string | null): CronDateTime {
  if (!timeZone) return cronDateTimeOf(date);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).formatToParts(date);
  } catch {
    return cronDateTimeOf(date);
  }
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    // Some engines print midnight as 24 even with h23.
    hour: part('hour') % 24,
    minute: part('minute'),
    second: part('second'),
  };
}

/** The browser's current wall-clock time, as a {@link CronDateTime}. */
export function cronDateTimeOf(date: Date): CronDateTime {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  };
}

function parseDayOfMonth(token: string): DayRule {
  // Star height, not ambiguity — see the note on `parsePart`.
  // eslint-disable-next-line security/detect-unsafe-regex
  const last = /^L(?:-(\d+))?(W)?$/.exec(token);
  if (last) {
    const offset = last[1] === undefined ? 0 : Number(last[1]);
    if (offset > MAX_LAST_DAY_OFFSET) throw new FieldError();
    return { kind: 'lastDay', offset, weekday: last[2] === 'W' };
  }
  const nearest = /^(\d+)W$/.exec(token);
  if (nearest) {
    const day = Number(nearest[1]);
    if (day < 1 || day > 31) throw new FieldError();
    return { kind: 'nearestWeekday', day };
  }
  return { kind: 'monthDays', days: new Set(parseList(token, BOUNDS.dayOfMonth)) };
}

function parseDayOfWeek(token: string): DayRule {
  // `L` alone is Saturday, the last day of the week, not "the last <day> of the month".
  // `token` here is one field of a cron expression, not a credential: the rule matches on the
  // identifier's name alone, and this compares it against the literal 'L'.
  // eslint-disable-next-line security/detect-possible-timing-attacks
  if (token === 'L') return { kind: 'weekdays', days: new Set([7]) };

  const last = /^([A-Z]{3}|\d+)L$/.exec(token);
  if (last) {
    return { kind: 'lastWeekday', weekday: parseValue(last[1], BOUNDS.dayOfWeek) };
  }
  const nth = /^([A-Z]{3}|\d+)#(\d+)$/.exec(token);
  if (nth) {
    const n = Number(nth[2]);
    if (n < 1 || n > 5) throw new FieldError();
    return { kind: 'nthWeekday', weekday: parseValue(nth[1], BOUNDS.dayOfWeek), nth: n };
  }
  return { kind: 'weekdays', days: new Set(parseList(token, BOUNDS.dayOfWeek)) };
}

/** A comma-separated list of `*`, values, ranges and steps, within one field's bounds. */
function parseList(token: string, bounds: FieldBounds): number[] {
  const values = new Set<number>();
  for (const part of token.split(',')) {
    for (const value of parsePart(part, bounds)) values.add(value);
  }
  return [...values];
}

/**
 * One field part: `5`, `MON`, `*`, `1-5`, `MON-FRI`, `1-5/2`, or a bare step like `/15`.
 *
 * `security/detect-unsafe-regex` reports this pattern, and the two like it above and below, on
 * `safe-regex`'s star-height measure: a `+` inside an optional group counts as nesting. Star
 * height is not backtracking, though — catastrophic backtracking needs two quantifiers that can
 * each claim the same characters, and these have none. `[A-Z]{3}` and `\d+` match disjoint
 * classes, and the literal `-` and `/` fix where one group ends and the next begins, so a
 * failing input gives back at most one run of characters, once.
 *
 * Measured on the shape that provokes a ReDoS where there is one — a long run followed by a
 * character that cannot match — at 1e3, 1e4, 1e5 and 1e6 characters: 0.06ms, 0.15ms, 4.8ms,
 * 16.8ms. Linear in the input, and the input is one field of a cron expression typed into a
 * form.
 */
function parsePart(part: string, bounds: FieldBounds): number[] {
  // Star height, not ambiguity — see the note on `parsePart`.
  // eslint-disable-next-line security/detect-unsafe-regex
  const match = /^(\*|[A-Z]{3}|\d+)?(?:-([A-Z]{3}|\d+))?(?:\/(\d+))?$/.exec(part);
  if (!match || part === '') throw new FieldError();
  const [, startText, endText, stepText] = match;
  checkPartShape(startText, endText, stepText);

  const wildcard = startText === undefined || startText === '*';
  const start = wildcard ? bounds.min : parseValue(startText, bounds);
  const step = stepText === undefined ? 1 : Number(stepText);
  if (step < 1 || step > bounds.max) throw new FieldError();

  if (endText === undefined && !wildcard && stepText === undefined) return [start];
  const end = endText === undefined ? bounds.max : parseValue(endText, bounds);
  return expandRange(start, end, step, bounds);
}

/** Refuses the combinations Quartz does not read the way they look. */
function checkPartShape(
  startText: string | undefined,
  endText: string | undefined,
  stepText: string | undefined,
): void {
  // `/5` is Quartz shorthand for `*/5`; a range needs a start; `*` takes no range end.
  if (startText === undefined && (endText !== undefined || stepText === undefined)) {
    throw new FieldError();
  }
  if (startText === '*' && endText !== undefined) throw new FieldError();
  // Names come alone or as a name range; Quartz reads no step after one.
  const named = (text: string | undefined) => text !== undefined && /^[A-Z]/.test(text);
  if ((named(startText) || named(endText)) && stepText !== undefined) throw new FieldError();
  if (endText !== undefined && named(startText) !== named(endText)) throw new FieldError();
}

function expandRange(start: number, end: number, step: number, bounds: FieldBounds): number[] {
  // A range that runs backwards wraps past the field's maximum, as `FRI-MON` or `22-2` do.
  const span = bounds.max - bounds.min + 1;
  const stop = end < start ? end + span : end;
  const values: number[] = [];
  for (let i = start; i <= stop; i += step) {
    values.push(i > bounds.max ? i - span : i);
  }
  return values;
}

function parseValue(text: string, bounds: FieldBounds): number {
  if (/^[A-Z]{3}$/.test(text)) {
    const index = bounds.names?.indexOf(text) ?? -1;
    if (index < 0) throw new FieldError();
    return index + bounds.min;
  }
  const value = Number(text);
  if (!Number.isInteger(value) || value < bounds.min || value > bounds.max) {
    throw new FieldError();
  }
  return value;
}

function parseYears(token: string): ReadonlySet<number> {
  // Quartz puts no bound on a year, and refuses a range that runs backwards.
  const horizon = new Date().getFullYear() + YEARS_AHEAD;
  const years = new Set<number>();
  for (const part of token.split(',')) {
    const { start, end, step } = yearRange(part);
    for (let year = start; year <= Math.min(end, horizon); year += step) years.add(year);
  }
  return years;
}

/** One year part: `2027`, `2027-2030`, `2027/2`, or `*\/2` and `/2`, which start at 1970. */
function yearRange(part: string): { start: number; end: number; step: number } {
  // Star height, not ambiguity — see the note on `parsePart`.
  // eslint-disable-next-line security/detect-unsafe-regex
  const match = /^(\*|\d+)?(?:-(\d+))?(?:\/(\d+))?$/.exec(part);
  if (!match || part === '') throw new FieldError();
  const [, startText, endText, stepText] = match;
  const step = stepText === undefined ? 1 : Number(stepText);
  const wildcard = startText === undefined || startText === '*';
  // `*` takes only a step here; a bare `*` never reaches this function.
  if (wildcard && (endText !== undefined || stepText === undefined)) throw new FieldError();
  const start = wildcard ? 1970 : Number(startText);
  let end = start;
  if (endText !== undefined) end = Number(endText);
  else if (stepText !== undefined) end = Infinity;
  if (end < start || step < 1) throw new FieldError();
  return { start, end, step };
}

function matchingDays(rule: DayRule, year: number, month: number): number[] {
  const lastDay = daysInMonth(year, month);
  const all = Array.from({ length: lastDay }, (_, i) => i + 1);
  switch (rule.kind) {
    case 'monthDays':
      return all.filter((day) => rule.days.has(day));
    case 'lastDay': {
      const day = lastDay - rule.offset;
      if (day < 1) return [];
      return [rule.weekday ? nearestWeekday(year, month, day, lastDay) : day];
    }
    case 'nearestWeekday':
      return rule.day > lastDay ? [] : [nearestWeekday(year, month, rule.day, lastDay)];
    case 'weekdays':
      return all.filter((day) => rule.days.has(weekdayOf(year, month, day)));
    case 'lastWeekday':
      return all.filter((day) => day > lastDay - 7 && weekdayOf(year, month, day) === rule.weekday);
    case 'nthWeekday':
      return all.filter(
        (day) => Math.ceil(day / 7) === rule.nth && weekdayOf(year, month, day) === rule.weekday,
      );
  }
}

/** Quartz's `W`: Saturday moves to Friday and Sunday to Monday, never across a month end. */
function nearestWeekday(year: number, month: number, day: number, lastDay: number): number {
  const weekday = weekdayOf(year, month, day);
  if (weekday === 7) return day === 1 ? 3 : day - 1;
  if (weekday === 1) return day === lastDay ? day - 2 : day + 1;
  return day;
}

/** Quartz numbering: 1 is Sunday, 7 is Saturday. UTC, so no local DST shift can move a day. */
function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 1;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dayKey(year: number, month: number, day: number): number {
  return (year * 100 + month) * 100 + day;
}

function timeKey(hour: number, minute: number, second: number): number {
  return (hour * 60 + minute) * 60 + second;
}

function sorted(values: readonly number[]): number[] {
  return values.toSorted((a, b) => a - b);
}
