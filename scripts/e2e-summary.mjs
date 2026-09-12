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
 * Renders the Playwright JSON report as Markdown for the run summary and the PR
 * comment. Prints to stdout; the workflow redirects it.
 *
 * ## What it reports, and why
 *
 * The first version printed totals and, on failure, the failures. That answers "did it pass"
 * and nothing else — a green run said `188 passed` and left no record of *what* passed, so
 * a spec that quietly stopped running (renamed, `test.skip`ped, dropped from a project's
 * `testMatch`) looked exactly like a spec that ran and passed. Sharding makes that worse:
 * a test can now vanish because a shard died before reaching it, and the total is the only
 * place that would show it.
 *
 * So this reports three things beyond the verdict:
 *
 *   - a per-spec-file table, always visible, so a file that produced no tests is obvious;
 *   - the full per-test list, folded into a <details> block so it does not bury the verdict;
 *   - the slowest tests, which is what the shard counts should be tuned against.
 *
 * ## Size
 *
 * A GitHub PR comment caps at 65536 characters and the API rejects anything longer, so a
 * suite large enough to overflow would silently lose its comment entirely — the workflow
 * step is `continue-on-error`. `E2E_SUMMARY_MAX_BYTES` bounds the output: sections are
 * dropped from the least important upward until it fits, and **what was dropped is always
 * stated**. A summary that silently omits half the suite is worse than one that admits it.
 *
 * Never exits non-zero: this is reporting, and it runs with `if: always()`, so a missing or
 * malformed report must not turn a passing run red or mask a real failure with a crash here.
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REPORT = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? 'playwright-results.json';

/** Output budget. The default is generous; the PR-comment invocation passes a smaller one. */
const MAX_BYTES = Number(process.env.E2E_SUMMARY_MAX_BYTES ?? 60000);

/** How many tests the folded full listing will name before it truncates. */
const MAX_LISTED = Number(process.env.E2E_SUMMARY_MAX_LISTED ?? 400);

const ICON = {
  passed: '✅',
  failed: '❌',
  timedOut: '⏱️',
  skipped: '⏭️',
  interrupted: '⚠️',
  expectedFailure: '🔒',
  unexpectedPass: '❌',
};

/**
 * Reconciles what a test *did* with what it was *asked* to do.
 *
 * A `test.fail()` case documents a known bug: Playwright runs it, requires it to fail, and
 * exits zero when it does. Reading `result.status` alone renders that as a failure, so a green
 * run reports "1 failing" — and a report that cries wolf on a passing suite is one nobody reads.
 *
 * The inverse matters just as much. When such a test starts passing, the marker is stale and
 * Playwright fails the run; that must surface as a failure here too, not as a quiet pass, or
 * the report would disagree with the exit code.
 */
export function classifyStatus(resultStatus, expectedStatus) {
  const didFail = resultStatus === 'failed' || resultStatus === 'timedOut';
  if (expectedStatus === 'failed') {
    if (didFail) return 'expectedFailure';
    if (resultStatus === 'passed') return 'unexpectedPass';
  }
  return resultStatus;
}

/**
 * Strips ANSI escape sequences.
 *
 * Playwright embeds terminal colour codes in `error.message` — an assertion failure arrives as
 * `Error: \x1b[2mexpect(\x1b[22m...`. They are invisible in a terminal and unreadable
 * everywhere else, and GitHub renders them literally.
 */
// eslint-disable-next-line no-control-regex -- escape sequences are exactly the target
const ANSI = /\u001B\[[0-9;]*m/g;

/**
 * Flattens the suite tree, accumulating `describe` titles.
 *
 * The root suite's title is the spec's file path, which is already the heading every test is
 * rendered under, so including it would print `client.spec.ts › client.spec.ts › creates a
 * client`. Ancestry below that is kept: a nested `describe` is context worth having.
 */
function collect(suite, out, titlePath = []) {
  const file = suite.file ?? '';
  const isFileSuite = !suite.title || suite.title === file || suite.title === suite.location?.file;
  const path = isFileSuite ? titlePath : [...titlePath, suite.title];

  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const result = test.results?.[test.results.length - 1];
      out.push({
        title: [...path, spec.title].join(' › '),
        file: spec.file ?? suite.file ?? '',
        project: test.projectName ?? '',
        status:
          test.status === 'skipped'
            ? 'skipped'
            : classifyStatus(result?.status ?? test.status, test.expectedStatus),
        expected: test.expectedStatus,
        // A test that failed and then passed on retry is green overall but worth surfacing:
        // it is the shape a flake takes, and flakes are what a sharded suite hides best.
        retries: Math.max(0, (test.results?.length ?? 1) - 1),
        durationMs: result?.duration ?? 0,
        error: (result?.error?.message ?? '').replace(ANSI, ''),
      });
    }
  }
  for (const child of suite.suites ?? []) collect(child, out, path);
}

/** `1.2s`, or `340ms` below a second — a duration nobody has to convert in their head. */
function humanDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  return `${minutes}m ${Math.round((ms % 60000) / 1000)}s`;
}

/**
 * Escapes a value for a Markdown table cell.
 *
 * Both replacements are load-bearing, and the order they happen in is why this is one pass
 * rather than two:
 *
 *   - **Backslash, then pipe.** Escaping only the pipe leaves `a\\|b` — a literal backslash
 *     followed by an *unescaped* pipe, which ends the cell. Escaping backslashes in a second
 *     `.replace` would then double the ones this call just added. A single pass over a
 *     character class avoids both traps.
 *   - **Whitespace collapse.** A newline in a test title ends the table row, not just the
 *     cell, so the rest of the table renders as prose.
 *
 * Reported by CodeQL as an incomplete escaping, which it was.
 */
function cell(text) {
  return String(text).replace(/\s+/g, ' ').replace(/[\\|]/g, '\\$&').trim();
}

function firstErrorLine(error) {
  const line = error.split('\n').find((l) => l.trim()) ?? '';
  return line.replace(/\s+/g, ' ').slice(0, 200);
}

/** Groups tests by spec file, preserving first-seen order so it matches the run. */
function byFile(tests) {
  const files = new Map();
  for (const test of tests) {
    if (!files.has(test.file)) files.set(test.file, []);
    files.get(test.file).push(test);
  }
  return files;
}

function failureSection(failed) {
  if (!failed.length) return [];
  const lines = ['### ❌ Failures', ''];
  for (const test of failed.slice(0, 20)) {
    lines.push(`- **${test.title}** — \`${test.file}\``);
    const first = firstErrorLine(test.error);
    if (first) lines.push(`  - ${first}`);
  }
  if (failed.length > 20) lines.push(`- …and ${failed.length - 20} more, in the HTML report.`);
  lines.push('');
  return lines;
}

/**
 * Known failures are green, but they are not nothing: each one is a bug someone chose to
 * document rather than fix, and an undated list of them is how a `test.fail()` becomes
 * permanent. Naming them keeps the cost visible on every run.
 */
function knownFailureSection(knownFailures) {
  if (!knownFailures.length) return [];
  const lines = [
    '### 🔒 Known failures',
    '',
    'Marked `test.fail()`: the suite asserts the bug is still present, and turns red when it',
    'is fixed so the marker can be removed.',
    '',
  ];
  for (const test of knownFailures.slice(0, 15)) {
    lines.push(`- **${cell(test.title)}** — \`${cell(test.file)}\``);
  }
  if (knownFailures.length > 15) lines.push(`- …and ${knownFailures.length - 15} more.`);
  lines.push('');
  return lines;
}

function flakySection(flaky) {
  if (!flaky.length) return [];
  const lines = [
    '### ⚠️ Passed on retry',
    '',
    'Green overall, but these needed more than one attempt — the shape a flake takes.',
    '',
  ];
  for (const test of flaky.slice(0, 15)) {
    lines.push(`- **${test.title}** — \`${test.file}\` (${test.retries} retry/retries)`);
  }
  if (flaky.length > 15) lines.push(`- …and ${flaky.length - 15} more.`);
  lines.push('');
  return lines;
}

function perFileSection(files) {
  const lines = [
    '### By spec file',
    '',
    '| Spec | ✅ | ❌ | ⏭️ | 🔒 | Time |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const [file, tests] of files) {
    const pass = tests.filter((t) => t.status === 'passed').length;
    const fail = tests.filter(
      (t) => t.status === 'failed' || t.status === 'timedOut' || t.status === 'unexpectedPass',
    ).length;
    const skip = tests.filter((t) => t.status === 'skipped').length;
    // Carried in its own column rather than folded into ❌ or ⏭️: a known failure is neither a
    // broken run nor a test that did not run, and the per-file counts must still add up.
    const known = tests.filter((t) => t.status === 'expectedFailure').length;
    const ms = tests.reduce((total, t) => total + t.durationMs, 0);
    // A file whose tests all failed is worth spotting from the table alone.
    const name = fail ? `**${cell(file)}**` : cell(file);
    lines.push(`| ${name} | ${pass} | ${fail} | ${skip} | ${known} | ${humanDuration(ms)} |`);
  }
  lines.push('');
  return lines;
}

function fullListingSection(files, total) {
  const lines = ['<details>', `<summary><b>All ${total} tests</b> — click to expand</summary>`, ''];
  let listed = 0;
  let truncated = false;
  for (const [file, tests] of files) {
    if (listed >= MAX_LISTED) {
      truncated = true;
      break;
    }
    lines.push(`**\`${file}\`**`, '');
    for (const test of tests) {
      if (listed >= MAX_LISTED) {
        truncated = true;
        break;
      }
      const icon = ICON[test.status] ?? '•';
      const retry = test.retries ? ` _(retried ${test.retries}×)_` : '';
      lines.push(`- ${icon} ${test.title} — \`${humanDuration(test.durationMs)}\`${retry}`);
      listed += 1;
    }
    lines.push('');
  }
  if (truncated) {
    lines.push(
      `_Listing stopped at ${listed} of ${total} tests. The rest are in the HTML report artifact._`,
      '',
    );
  }
  lines.push('</details>', '');
  return lines;
}

function slowestSection(tests) {
  const slowest = [...tests]
    .filter((t) => t.status !== 'skipped')
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10);
  if (slowest.length < 2) return [];
  const lines = [
    '<details>',
    '<summary><b>Slowest 10</b> — what the shard counts should be tuned against</summary>',
    '',
    '| Test | Spec | Time |',
    '| --- | --- | ---: |',
  ];
  for (const test of slowest) {
    lines.push(
      `| ${cell(test.title)} | \`${cell(test.file)}\` | ${humanDuration(test.durationMs)} |`,
    );
  }
  lines.push('', '</details>', '');
  return lines;
}

function main() {
  let report;
  try {
    report = JSON.parse(readFileSync(REPORT, 'utf8'));
  } catch {
    console.log(
      '## 🎭 E2E Tests\n\nNo Playwright JSON report was produced. ' +
        'That is itself a result: the run did not get far enough to write one.',
    );
    return;
  }

  const tests = [];
  for (const suite of report.suites ?? []) collect(suite, tests);

  if (!tests.length) {
    console.log(
      '## 🎭 E2E Tests\n\n' +
        '**⚠️ The report contains no tests.** A suite that runs nothing reports the same ' +
        '"0 failed" as a suite that passes, so this is called out rather than rendered as green.',
    );
    return;
  }

  const failed = tests.filter(
    (t) => t.status === 'failed' || t.status === 'timedOut' || t.status === 'unexpectedPass',
  );
  const passed = tests.filter((t) => t.status === 'passed' && t.expected !== 'skipped').length;
  const skipped = tests.filter((t) => t.status === 'skipped').length;
  const knownFailures = tests.filter((t) => t.status === 'expectedFailure');
  const flaky = tests.filter((t) => t.status === 'passed' && t.retries > 0);
  const seconds = Math.round((report.stats?.duration ?? 0) / 1000);
  const files = byFile(tests);

  const verdict = failed.length === 0 ? '✅ All green' : `❌ ${failed.length} failing`;

  const header = [
    '## 🎭 E2E Tests',
    '',
    `**${verdict}** — ${passed} passed · ${failed.length} failed · ${skipped} skipped` +
      `${knownFailures.length ? ` · ${knownFailures.length} known-failing` : ''}` +
      `${flaky.length ? ` · ${flaky.length} flaky` : ''}, ` +
      `across ${files.size} spec files in ${humanDuration(seconds * 1000)}.`,
    '',
  ];

  // Ordered most to least important. Sections are dropped from the end until the whole
  // thing fits the budget, and the drop is always announced.
  const sections = [
    { name: 'failures', lines: failureSection(failed) },
    { name: 'known failures', lines: knownFailureSection(knownFailures) },
    { name: 'flaky', lines: flakySection(flaky) },
    { name: 'the per-file table', lines: perFileSection(files) },
    { name: 'the full test listing', lines: fullListingSection(files, tests.length) },
    { name: 'the slowest-10 table', lines: slowestSection(tests) },
  ];

  const render = (kept) =>
    [...header, ...kept.flatMap((section) => section.lines)].join('\n').trimEnd();

  let kept = sections;
  const dropped = [];
  while (kept.length > 1 && Buffer.byteLength(render(kept), 'utf8') > MAX_BYTES) {
    dropped.unshift(kept[kept.length - 1].name);
    kept = kept.slice(0, -1);
  }

  let output = render(kept);
  if (dropped.length) {
    output +=
      `\n\n_Omitted to fit the comment size limit: ${dropped.join(', ')}. ` +
      'All of it is in the HTML report artifact._';
  }

  console.log(output);
}

export { cell, humanDuration, firstErrorLine };

// Only render when invoked as a command; importing this module (the tests do) must not print.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
