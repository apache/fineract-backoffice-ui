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
 * Scans the application source for STATIC ngx-translate key references and verifies that
 * every referenced key exists in the base English catalog (src/assets/i18n/en.json).
 * Missing keys render as raw key strings in the UI, so this guards against that.
 *
 * Detected reference forms (the key must be a string literal — dynamically built keys such
 * as `nav.${x}` cannot be resolved statically and are intentionally skipped):
 *   'KEY' | translate            "KEY" | translate
 *   translate.instant('KEY')     translate.get('KEY')     translate.stream('KEY')
 *   [translate]="'KEY'"          [matTooltip]="'KEY' | translate"  (the literal before `| translate`)
 *
 * Usage:
 *   node scripts/check-translations.mjs            # report missing-in-en keys, exit 1 if any
 *   node scripts/check-translations.mjs --unused   # also list keys defined in en.json but never referenced
 *
 * Exit code 1 when any referenced key is missing from en.json (CI-friendly).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src', 'app');
const EN = join(ROOT, 'src', 'assets', 'i18n', 'en.json');

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
  new RegExp(String.raw`['"]${KEY}['"]\s*\|\s*translate`, 'g'),
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

const defined = flatten(JSON.parse(readFileSync(EN, 'utf8')));
const refs = referencedKeys(collectFiles(SRC));

const missing = [...refs.entries()].filter(([k]) => !defined.has(k)).sort();

console.log(`Checked ${refs.size} referenced keys against ${defined.size} keys in en.json.`);
if (missing.length) {
  console.error(`\n✖ ${missing.length} key(s) referenced in code but MISSING from en.json:\n`);
  for (const [key, where] of missing) console.error(`  ${key}  (${where})`);
} else {
  console.log('✓ No missing keys.');
}

if (process.argv.includes('--unused')) {
  const referenced = new Set(refs.keys());
  const unused = [...defined].filter((k) => !referenced.has(k)).sort();
  console.log(`\nℹ ${unused.length} key(s) defined in en.json but not statically referenced`);
  console.log('  (may be used via dynamically-built keys; review before removing).');
}

process.exit(missing.length ? 1 : 0);
