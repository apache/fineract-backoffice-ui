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
 * English sentences written straight into a template, where a translation key belongs.
 *
 * ## Why none of the existing checks see these
 *
 * `check-translations.mjs` verifies that the keys code *references* resolve, and that a `label:`
 * holds a key rather than a phrase. The runtime handler reports a key that resolves to nothing.
 * All of them need something key-shaped to exist first.
 *
 * This defect has no key at all:
 *
 *     <ion-label position="stacked">Repayments Rescheduling Rule</ion-label>
 *
 * Nothing is looked up, so nothing misses, so nothing reports it. It renders correctly in
 * English and stays English in Hindi and Korean forever. A review does not catch it because it
 * reads exactly like the working line above it, and a screenshot does not either — the
 * screenshots are in English.
 *
 * Issue #627 was three screens of this shape found by hand. This is the check that would have
 * found them, and the 71 still in the tree.
 *
 * ## What it reports
 *
 * A text node of two or more words starting with a capital, with no interpolation and no pipe.
 * Deliberately conservative:
 *
 *   - **Two or more words.** A single word is too often a unit, a code or an acronym (`USD`,
 *     `ID`, `JSON`) to flag without a large false-positive rate.
 *   - **Comments stripped first.** A JSDoc example containing `>Create Client<` is documentation,
 *     not UI. Two of these exist in `has-permission.directive.ts`.
 *
 * So it under-reports, on purpose. A check that cried wolf on acronyms would be turned off, and
 * then the 71 would have no guard at all.
 *
 * ## Modes
 *
 *   node scripts/check-template-text.mjs            fail if any file exceeds its baseline
 *   node scripts/check-template-text.mjs --list      print every occurrence
 *   node scripts/check-template-text.mjs --update    rewrite the baseline from the tree
 *
 * The baseline is per file and may only shrink, the same contract as
 * `eslint-suppressions.json` and `scripts/i18n-coverage.json`: a new one fails, and fixing one
 * requires `--update` to record the lower number.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = join(ROOT, 'src', 'app');
const BASELINE = join(HERE, 'template-text-baseline.json');

/** Recursively collect templates — inline in `.ts`, or standalone `.html`. */
function collectFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    // Generated client: no templates, and never hand-edited.
    if (p.includes(join('src', 'app', 'api'))) continue;
    if (statSync(p).isDirectory()) {
      collectFiles(p, acc);
      continue;
    }
    // A spec's inline fixture template is allowed to hold English: it asserts on rendering, and
    // is never shown to anyone.
    if (p.endsWith('.test.ts') || p.endsWith('.spec.ts')) continue;
    if (p.endsWith('.ts') || p.endsWith('.html')) acc.push(p);
  }
  return acc;
}

/**
 * Remove block comments, so documentation examples are not mistaken for UI.
 *
 * Replaced with spaces rather than deleted, so reported line numbers still match the file.
 */
function stripComments(text) {
  return text.replaceAll(/\/\*[\s\S]*?\*\//g, (match) => match.replaceAll(/[^\n]/g, ' '));
}

/**
 * A text node between two tags holding words rather than markup.
 *
 * The character class after the first word admits `&`, `/`, `'`, `(`, `)` and `-` because real
 * labels contain them — "Timeline & Balance", "Disburse / Repay", "Reason Name (Manual)".
 */
const TEXT_NODE = />\s*([A-Z][A-Za-z]+(?: [A-Za-z&'()/-]+){1,8})\s*</g;

function findText(files) {
  const found = [];
  for (const file of files) {
    const text = stripComments(readFileSync(file, 'utf8'));
    for (const match of text.matchAll(TEXT_NODE)) {
      const phrase = match[1].trim();
      // An interpolation or a pipe means the text is produced, not written.
      if (phrase.includes('{{') || phrase.includes('|')) continue;
      const line = text.slice(0, match.index).split('\n').length;
      found.push({ file: relative(ROOT, file), line, phrase });
    }
  }
  return found;
}

const files = collectFiles(SRC);
const found = findText(files);

const counts = {};
for (const { file } of found) counts[file] = (counts[file] ?? 0) + 1;

if (process.argv.includes('--list')) {
  for (const { file, line, phrase } of found) console.log(`${file}:${line}  ${phrase}`);
  console.log(
    `\n${found.length} untranslated text node(s) in ${Object.keys(counts).length} file(s).`,
  );
  process.exit(0);
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify(counts, undefined, 2)}\n`);
  console.log(
    `✓ Wrote ${relative(ROOT, BASELINE)} — ${found.length} in ${Object.keys(counts).length} file(s).`,
  );
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(
    `Missing ${relative(ROOT, BASELINE)}. Run: node scripts/check-template-text.mjs --update`,
  );
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
const problems = [];

for (const [file, count] of Object.entries(counts)) {
  const allowed = baseline[file] ?? 0;
  if (count > allowed) problems.push({ file, count, allowed });
}

/** Files that improved, so the baseline can be tightened in the same commit as the fix. */
const stale = Object.entries(baseline).filter(([file, allowed]) => (counts[file] ?? 0) < allowed);

if (problems.length) {
  console.error('\n✖ Untranslated template text above the recorded baseline:\n');
  for (const { file, count, allowed } of problems) {
    console.error(`  ${file}  ${allowed} -> ${count}`);
    for (const hit of found.filter((f) => f.file === file)) {
      console.error(`      ${hit.line}: ${hit.phrase}`);
    }
  }
  console.error('\n  Add a key to src/assets/i18n/en.json and render it with `| appTranslate`.');
  console.error('  These never miss and never show a raw key — they just stay English.');
  process.exit(1);
}

const total = found.length;
console.log(
  `✓ No new untranslated template text (${total} recorded in ${Object.keys(counts).length} file(s)).`,
);

if (stale.length) {
  console.log('\n  Baseline is now loose — run `--update` to record the improvement:');
  for (const [file, allowed] of stale)
    console.log(`    ${file}  ${allowed} -> ${counts[file] ?? 0}`);
  process.exit(1);
}
