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
 * Escaping and sanitising rules for the two scripts that render pull-request comments.
 *
 *   node --test "scripts/*.test.mjs"
 *
 * These are not incidental helpers. Both scripts turn test titles, file paths and class names
 * — none of which this repository controls on a fork's branch — into Markdown that gets posted
 * as a comment. `cell()` shipped with exactly the bug this file now pins: it escaped the pipe
 * but not the backslash, so `a\|b` became `a\\|b`, which Markdown renders as a literal
 * backslash followed by a live pipe that ends the table cell. CodeQL caught it; a test is what
 * stops it coming back.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cell, classifyStatus, humanDuration } from './e2e-summary.mjs';
import { safeId, safeText, escapeRegExp } from './pr-sequence-diagram.mjs';

test('cell escapes a pipe so it cannot end the table cell', () => {
  assert.equal(cell('a|b'), 'a\\|b');
});

test('cell escapes backslashes as well as pipes', () => {
  // The regression. Escaping only the pipe leaves a literal backslash followed by a live
  // pipe, which Markdown reads as the end of the cell.
  assert.equal(cell('a\\|b'), 'a\\\\\\|b');
  assert.equal(cell('C:\\path'), 'C:\\\\path');
});

test('cell leaves no unescaped pipe, whatever the input', () => {
  for (const input of ['a|b', 'a\\|b', '\\\\|', '||', '\\', 'C:\\path\\|x']) {
    const escaped = cell(input);
    // Walk the result: every pipe must be preceded by an odd number of backslashes.
    for (let index = 0; index < escaped.length; index += 1) {
      if (escaped[index] !== '|') continue;
      let slashes = 0;
      for (let back = index - 1; back >= 0 && escaped[back] === '\\'; back -= 1) slashes += 1;
      assert.equal(slashes % 2, 1, `unescaped pipe at ${index} in ${JSON.stringify(escaped)}`);
    }
  }
});

test('cell collapses newlines, which would end the whole table row', () => {
  assert.equal(cell('line1\nline2'), 'line1 line2');
  assert.equal(cell('  padded \t value '), 'padded value');
});

test('humanDuration reads without conversion at every scale', () => {
  assert.equal(humanDuration(340), '340ms');
  assert.equal(humanDuration(1200), '1.2s');
  assert.equal(humanDuration(812345), '13m 32s');
});

test('safeId yields a usable Mermaid identifier', () => {
  assert.match(safeId('RolesService'), /^[A-Za-z_][A-Za-z0-9_]*$/);
  assert.match(safeId('99Numeric'), /^_/);
  assert.equal(safeId(''), 'Participant');
  assert.ok(safeId('A'.repeat(300)).length <= 40);
});

test('safeText cannot break out of the mermaid fence', () => {
  const hostile = 'Foo`\n```\n## Injected heading';
  const text = safeText(hostile);
  assert.doesNotMatch(text, /[`\r\n;<>|"']/);
});

test('safeText cannot forge a sequence arrow', () => {
  // `>` is stripped, so `-->>` cannot be reconstructed to invent an interaction.
  assert.doesNotMatch(safeText('Baz-->>Victim: forged'), />/);
});

test('escapeRegExp neutralises the metacharacters an identifier may contain', () => {
  // `$` is legal in a TypeScript identifier and an anchor in a regular expression.
  assert.ok(new RegExp(escapeRegExp('Foo$Service')).test('Foo$Service'));
  assert.ok(!new RegExp(escapeRegExp('Foo$Service')).test('FooService'));
});

test('importing either script renders nothing', async () => {
  // Both guard `main()` behind an argv check so these imports stay side-effect free. If that
  // guard regressed, the test output would be full of Markdown rather than failing cleanly.
  const summary = await import('./e2e-summary.mjs');
  const diagram = await import('./pr-sequence-diagram.mjs');
  assert.equal(typeof summary.cell, 'function');
  assert.equal(typeof diagram.safeId, 'function');
});

test('classifyStatus keeps an asserted failure out of the failure count', () => {
  // The regression this guards: reading result.status alone reported "1 failing" on a run
  // Playwright exited zero for, which trains people to ignore the report.
  assert.equal(classifyStatus('failed', 'failed'), 'expectedFailure');
  assert.equal(classifyStatus('timedOut', 'failed'), 'expectedFailure');
});

test('classifyStatus flags a test.fail() case that has started passing', () => {
  // Playwright fails the run when this happens, so the report has to agree with the exit code
  // rather than quietly counting it as a pass and leaving a stale marker in place.
  assert.equal(classifyStatus('passed', 'failed'), 'unexpectedPass');
});

test('classifyStatus leaves ordinary results untouched', () => {
  assert.equal(classifyStatus('passed', 'passed'), 'passed');
  assert.equal(classifyStatus('failed', 'passed'), 'failed');
  assert.equal(classifyStatus('timedOut', 'passed'), 'timedOut');
  assert.equal(classifyStatus('skipped', 'skipped'), 'skipped');
});
