#!/usr/bin/env node
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Translation key checker.
 *
 * A key that does not resolve renders as its own name — `SAVINGS.CONFIRM_UNDO` where a sentence
 * belongs — with nothing in the console. Three separate mistakes produce that screen, so this
 * script runs three checks:
 *
 *   1. MISSING     a statically-referenced key that is not in the base catalogue (en.json)
 *   2. UNWRAPPED   a key-shaped literal interpolated into a template with no translate pipe,
 *                  which prints the key however complete the catalogue is
 *   3. CATALOGUES  a non-English catalogue holding a key `en.json` no longer defines, and
 *                  coverage falling below the committed baseline
 *
 * What none of them can see is a key assembled at runtime (`SAVINGS.CONFIRM_${action}`) or one
 * looked up through a wrongly-built prefix. Those are caught in the browser instead, by
 * `ReportingMissingTranslationHandler` and the `failOnMissingTranslations` e2e fixture.
 *
 * Detected reference forms (the key must be a string literal — dynamically built keys such
 * as `nav.${x}` cannot be resolved statically and are intentionally skipped):
 *   'KEY' | translate            'KEY' | appTranslate
 *   i18n.translate('KEY')        translate.instant('KEY')  .get('KEY')  .stream('KEY')
 *   [translate]="'KEY'"          [matTooltip]="'KEY' | translate"  (the literal before the pipe)
 *
 * Usage:
 *   node scripts/check-translations.mjs            # all three checks, exit 1 on any failure
 *   node scripts/check-translations.mjs --unused   # also list keys defined in en.json but never referenced
 *   node scripts/check-translations.mjs --update   # refresh the committed coverage baseline
 *
 * Exit code 1 when any check fails (CI-friendly).
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src', 'app');
const I18N_DIR = join(ROOT, 'src', 'assets', 'i18n');
const EN = join(I18N_DIR, 'en.json');
const BASELINE = join(ROOT, 'scripts', 'i18n-coverage.json');

/** Recursively collect *.ts files under a directory, excluding the generated API client and specs. */
function collectFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (p.includes(`${join('src', 'app', 'api')}`)) continue;
    const st = statSync(p);
    if (st.isDirectory()) collectFiles(p, acc);
    else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) acc.push(p);
  }
  return acc;
}

/** Flatten a nested translation object into a Set of dotted key paths. */
function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.add(key);
  }
  return out;
}

// A translation key: starts with a letter, dotted segments of word chars (matches both
// UPPER_SNAKE feature namespaces and lowerCamel nav/app namespaces).
const KEY = String.raw`([A-Za-z][\w]*(?:\.[\w]+)+)`;
const PATTERNS = [
  // Both pipes. `| appTranslate` is the one ADR 0003 mandates — it reaches the I18N adapter
  // rather than the library — and it was invisible here until it was named: `\|\s*translate`
  // does not match `| appTranslate`, so 634 references went unchecked.
  new RegExp(String.raw`['"]${KEY}['"]\s*\|\s*(?:app)?[Tt]ranslate`, 'g'),
  // `.translate('KEY')` is the adapter's own method, and the form most application code uses.
  // `.instant`/`.get`/`.stream` are ngx-translate's, reachable only from the adapter itself.
  new RegExp(String.raw`\.translate\(\s*['"]${KEY}['"]`, 'g'),
  new RegExp(String.raw`\.(?:instant|get|stream)\(\s*['"]${KEY}['"]`, 'g'),
  new RegExp(String.raw`\[translate\]\s*=\s*["']'${KEY}'`, 'g'),
  new RegExp(
    String.raw`\b(?:title|helpTextKey|label|placeholder|createButtonLabel)\s*=\s*['"]${KEY}['"]`,
    'g',
  ),
  new RegExp(
    String.raw`\[(?:title|helpTextKey|label|placeholder|createButtonLabel)\]\s*=\s*['"]'${KEY}'['"]`,
    'g',
  ),
  // Route definitions: `title: 'nav.groups'` in a *.routes.ts Routes array. Resolved as a
  // key by TranslatedTitleStrategy, so a typo here is a missing key like any other. The KEY
  // shape (dotted identifier) keeps this off ordinary `title:` properties holding a phrase.
  new RegExp(String.raw`\btitle:\s*['"]${KEY}['"]`, 'g'),
  // Navigation entries in `navigation-config.service.ts`. The field is named `labelKey`, but
  // nothing made it hold one: three top-level groups shipped with `labelKey: 'Admin'` — an
  // English word, untranslatable in every language, and shaped so unlike a key that no check
  // here could see it. This catches the dotted ones; `check:nav-labels` catches the rest.
  new RegExp(String.raw`\blabelKey:\s*['"]${KEY}['"]`, 'g'),
];

function referencedKeys(files) {
  const refs = new Map(); // key -> first "file:line"
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const re of PATTERNS) {
      for (const m of text.matchAll(re)) {
        const key = m[1];
        if (!refs.has(key)) {
          const line = text.slice(0, m.index).split('\n').length;
          refs.set(key, `${file.replace(`${ROOT}/`, '')}:${line}`);
        }
      }
    }
  }
  return refs;
}

/**
 * A template interpolation, and a key-shaped literal inside one.
 *
 * `{{ 'COMMON.SAVE' }}` compiles, renders `COMMON.SAVE`, and passes check (1) — the key is
 * perfectly present in en.json, nothing ever asked for it. Requiring a quoted literal whose
 * first segment is a real namespace keeps this off `{{ account.externalId }}` and off any
 * dotted string that is data rather than a key.
 */
const INTERPOLATION = /\{\{([^}]*)\}\}/g;
const LITERAL = new RegExp(String.raw`['"]${KEY}['"]`);
const TRANSLATE_PIPE = /\|\s*(?:app)?[Tt]ranslate/;

/** Interpolations that print a key instead of translating it. */
function unwrappedKeys(files, namespaces) {
  const found = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(INTERPOLATION)) {
      const body = match[1];
      const literal = LITERAL.exec(body);
      if (!literal || !namespaces.has(literal[1].split('.')[0])) continue;
      if (TRANSLATE_PIPE.test(body)) continue;
      const line = text.slice(0, match.index).split('\n').length;
      found.push([literal[1], `${file.replace(`${ROOT}/`, '')}:${line}`]);
    }
  }
  return found;
}

/**
 * Compares every shipped catalogue against en.json.
 *
 * A key the English catalogue no longer defines is dead weight at best and, when it is a
 * near-miss of a live key, a translation that will never be shown — `nav.clientSearchV2`
 * outlived `nav.clientSearch` in both catalogues here. Those are removed, not tolerated.
 *
 * Coverage is a ratchet rather than a threshold. The non-English catalogues are partial by
 * design and filling them is translator work, not a blocker for a UI change; what this stops is
 * a catalogue quietly going backwards when a key is renamed on the English side alone.
 */
function checkCatalogues(defined) {
  const langs = readdirSync(I18N_DIR)
    .filter((name) => name.endsWith('.json') && name !== 'en.json')
    .map((name) => name.slice(0, -'.json'.length))
    .sort();

  const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
  const coverage = {};
  const problems = [];

  for (const lang of langs) {
    const keys = flatten(JSON.parse(readFileSync(join(I18N_DIR, `${lang}.json`), 'utf8')));
    const stale = [...keys].filter((key) => !defined.has(key)).sort();
    const translated = keys.size - stale.length;
    coverage[lang] = translated;

    const percent = ((translated / defined.size) * 100).toFixed(1);
    console.log(`  ${lang}: ${translated}/${defined.size} keys (${percent}%)`);

    for (const key of stale) {
      problems.push(`  ${lang}.json defines ${key}, which en.json does not — remove it.`);
    }

    const was = baseline[lang];
    if (typeof was === 'number' && translated < was) {
      problems.push(
        `  ${lang}.json covers ${translated} keys, down from ${was}. A key renamed in en.json ` +
          'must be renamed here too, or its translation is lost.',
      );
    }
  }

  return { coverage, problems };
}

const defined = flatten(JSON.parse(readFileSync(EN, 'utf8')));
const files = collectFiles(SRC);
const refs = referencedKeys(files);

// 1. Referenced but undefined.
const missing = [...refs.entries()].filter(([k]) => !defined.has(k)).sort();

console.log(`Checked ${refs.size} referenced keys against ${defined.size} keys in en.json.`);
if (missing.length) {
  console.error(`\n✖ ${missing.length} key(s) referenced in code but MISSING from en.json:\n`);
  for (const [key, where] of missing) console.error(`  ${key}  (${where})`);
} else {
  console.log('✓ No missing keys.');
}

// 2. Interpolated without ever being translated.
const namespaces = new Set([...defined].map((key) => key.split('.')[0]));
const unwrapped = unwrappedKeys(files, namespaces);
if (unwrapped.length) {
  console.error(`\n✖ ${unwrapped.length} key(s) interpolated without a translate pipe:\n`);
  for (const [key, where] of unwrapped) console.error(`  ${key}  (${where})`);
  console.error('\n  Add `| appTranslate` — the key renders verbatim as it stands.');
} else {
  console.log('✓ No untranslated key interpolations.');
}

// 3. The other catalogues.
console.log('\nCatalogue coverage:');
const { coverage, problems } = checkCatalogues(defined);

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify(coverage, null, 2)}\n`);
  console.log(`\n✓ Wrote ${BASELINE.replace(`${ROOT}/`, '')}.`);
  process.exit(0);
}

if (problems.length) {
  console.error('\n✖ Catalogue problems:\n');
  for (const problem of problems) console.error(problem);
  console.error('\n  Refresh the baseline with: npm run i18n:check -- --update');
} else {
  console.log('✓ Catalogues consistent with en.json.');
}

if (process.argv.includes('--unused')) {
  const referenced = new Set(refs.keys());
  const unused = [...defined].filter((k) => !referenced.has(k)).sort();
  console.log(`\nℹ ${unused.length} key(s) defined in en.json but not statically referenced`);
  console.log('  (may be used via dynamically-built keys; review before removing).');
}

process.exit(missing.length || unwrapped.length || problems.length ? 1 : 0);
