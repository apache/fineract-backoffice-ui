#!/usr/bin/env node
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
 * Stops Fineract's test-only endpoints from re-entering the product surface unnoticed.
 *
 * Fineract serves `/v1/internal/**` only when the backend runs with its `test` Spring profile,
 * which upstream states must not be enabled in production. On a normal deployment every one of
 * those endpoints answers 404, so a screen built on them cannot work for a real user.
 *
 * The application keeps a small number of such screens deliberately, as tooling for a test
 * instance. They are gated behind `developerToolsEnabled` in `config.json` — hidden from the
 * navigation and unreachable by URL unless a deployment opts in. This check does not ban the
 * pattern; it pins the list, so that adding a *new* dependency on an internal endpoint is a
 * decision someone makes on purpose rather than a thing that quietly happens.
 *
 * Discovery is done from the generated client rather than from a hardcoded list of names: each
 * generated method carries an `@endpoint <verb> <path>` tag, so the set of internal methods is
 * derived from whatever the current spec says, and follows it when the spec changes.
 *
 *   node scripts/check-internal-endpoints.mjs
 *
 * Exit 1 on an unapproved reference, or on an allow-list entry that no longer references one —
 * a stale entry is as misleading as a missing one.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED_API = join(ROOT, 'src', 'app', 'api');

/**
 * Files permitted to call an internal endpoint, and why.
 *
 * Every entry must be gated by `developerToolsEnabled` — through the route guard, the navigation
 * flag, or a template condition. Adding a file here without gating it defeats the point.
 */
const ALLOWED = new Map([
  [
    'src/app/features/admin/cob-tools/cob-tools.component.ts',
    'COB tooling for a test instance; route gated by developerToolsGuard',
  ],
  [
    'src/app/features/admin/wc-cob-tools/wc-cob-tools.component.ts',
    'Working-capital COB tooling for a test instance; route gated by developerToolsGuard',
  ],
  [
    'src/app/features/admin/external-events/external-events.component.ts',
    'Internal external-event log for a test instance; route gated by developerToolsGuard',
  ],
  [
    'src/app/features/admin/progressive-loan/progressive-loan-model.component.ts',
    'Progressive-loan schedule model, described by the spec as internal; route gated by developerToolsGuard',
  ],
  [
    'src/app/features/working-capital/loans/wc-account-lock/wc-loan-account-lock.component.ts',
    'Places a working-capital loan lock; route gated by developerToolsGuard',
  ],
  [
    'src/app/features/loans/loan-account-lock/loan-account-lock.component.ts',
    'Lock listing is supported and ungated; only the place-lock action is gated in the template',
  ],
]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

/** Generated method names whose `@endpoint` tag points under `/v1/internal/`. */
function internalMethods() {
  const methods = new Map();
  for (const file of walk(join(GENERATED_API, 'api'))) {
    const src = readFileSync(file, 'utf8');
    const re = /@endpoint\s+(\w+)\s+(\/v1\/internal\/\S*)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const after = src.slice(m.index, m.index + 3000);
      const name = /public (\w+)\(/.exec(after);
      if (name) methods.set(name[1], `${m[1].toUpperCase()} ${m[2]}`);
    }
  }
  return methods;
}

const methods = internalMethods();
if (methods.size === 0) {
  console.error(
    'No /v1/internal/ operations found in the generated client.\n' +
      'Either the spec no longer exposes them — in which case this check and the screens that ' +
      'depend on them should be revisited — or the client layout changed and this script needs ' +
      'updating. Failing rather than passing silently.',
  );
  process.exit(1);
}

const sources = walk(join(ROOT, 'src', 'app')).filter(
  (f) => !f.startsWith(GENERATED_API) && !f.endsWith('.spec.ts'),
);

const used = new Map();
for (const file of sources) {
  const src = readFileSync(file, 'utf8');
  for (const [name, endpoint] of methods) {
    if (new RegExp(`\\b${name}\\b`).test(src)) {
      const rel = relative(ROOT, file);
      if (!used.has(rel)) used.set(rel, []);
      used.get(rel).push(endpoint);
    }
  }
}

const unapproved = [...used.keys()].filter((f) => !ALLOWED.has(f)).sort();
const stale = [...ALLOWED.keys()].filter((f) => !used.has(f)).sort();

console.log(
  `Checked ${sources.length} files against ${methods.size} internal operations; ` +
    `${used.size} file(s) reference one.`,
);

if (unapproved.length) {
  console.error('\n✖ Files calling a /v1/internal/ endpoint without approval:\n');
  for (const f of unapproved) {
    console.error(`  ${f}`);
    for (const ep of used.get(f)) console.error(`      ${ep}`);
  }
  console.error(
    '\nThese endpoints exist only under the backend test profile and answer 404 in production.\n' +
      'Either drop the dependency, or gate the screen behind developerToolsEnabled and add it to\n' +
      'ALLOWED in this script with the reason.',
  );
}

if (stale.length) {
  console.error('\n✖ Allow-list entries that no longer call an internal endpoint:\n');
  for (const f of stale) console.error(`  ${f}`);
  console.error('\nRemove them from ALLOWED so the list keeps describing the code.');
}

if (unapproved.length || stale.length) process.exit(1);
console.log('✓ Every internal-endpoint call site is approved and gated.');
