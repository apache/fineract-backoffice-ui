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

/**
 * Every permission code the application names must exist in Fineract's catalogue.
 *
 * ## Why this check exists
 *
 * `DOCS/RBAC.md` already says it: "Do not invent codes. A gate on a code that does not exist can
 * never be satisfied by any role, which is worse than no gate." It said so because the rule is
 * easy to break and impossible to notice — the control is simply disabled forever, for everyone
 * except a superuser, and looks exactly like a control the viewer is not entitled to.
 *
 * Two had broken it by the time this was written, both found by diffing the source against a
 * live catalogue rather than by anyone using the app:
 *
 *  - `UNDOWITHDRAW_CLIENT` on the client's undo-withdrawal action. The real code is
 *    `UNDOWITHDRAWAL_CLIENT`.
 *  - `UPDATE_LOAN_AVAILABLE_DISBURSEMENT_AMOUNT` on the loan's revise-available-amount action.
 *    No such code, and no narrower one exists — a role holding all 721 grantable codes is still
 *    refused that endpoint, so it is genuinely superuser-only.
 *
 * Note what this cannot catch: a code that exists but is **wrong for the operation**. The
 * savings cash-withdrawal button was gated on `WITHDRAW_SAVINGSACCOUNT` (withdraw the
 * application) rather than `WITHDRAWAL_SAVINGSACCOUNT` (withdraw cash); both exist, so only a
 * run against a real platform tells them apart. That is what the backend RBAC e2e specs are for.
 * This check is the cheap half, and it runs with no Fineract.
 *
 * ## The snapshot
 *
 * `scripts/permission-codes.json` is a capture of `GET /v1/permissions` from the version in
 * `deploy/docker-compose-e2e.yml`. A snapshot rather than a live call, so the check runs in CI
 * with nothing started. It drifts as Fineract adds codes — which is a false *pass*, never a
 * false failure, since the catalogue only grows. Refresh it with `npm run permissions:snapshot`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = 'scripts/permission-codes.json';

/**
 * Codes that are real but are not entries in the catalogue.
 *
 * `ALL_FUNCTIONS` is Fineract's superuser marker and `ALL_FUNCTIONS_READ` its read-only
 * counterpart; both are granted to roles and checked by `permissionsSatisfy`, but neither is
 * returned by `GET /permissions`. Naming `ALL_FUNCTIONS` as a *requirement* is how a screen says
 * "superuser only", which is the honest declaration for an endpoint no grantable code reaches.
 */
const WILDCARDS = new Set(['ALL_FUNCTIONS', 'ALL_FUNCTIONS_READ']);

/** Where a code can be named, and the pattern that finds it. */
const SOURCES = [
  ['action gate', /appRequiresPermission="([A-Z][A-Z0-9_]*)"/g],
  ['action gate', /appRequiresPermission="'([A-Z][A-Z0-9_]*)'"/g],
  ['structural gate', /appHasPermission="'([A-Z][A-Z0-9_]*)'"/g],
  ['route', /permissions:\s*'([A-Z][A-Z0-9_]*)'/g],
  ['navigation', /requiredPermissions:\s*'([A-Z][A-Z0-9_]*)'/g],
  ['data table', /createPermission="([A-Z][A-Z0-9_]*)"/g],
];

/**
 * Files whose *values* are codes, scanned separately from the patterns above.
 *
 * `command-permissions.ts` maps a command to a code, so a generic "quoted upper-snake word"
 * pattern would also pick up object keys elsewhere in the tree — `'CLIENT':` in the global
 * search's entity map is not a permission. Scoping the value scan to the one file that holds
 * codes as values keeps the check specific instead of merely noisy.
 */
const CODE_VALUE_FILES = [['command map', 'src/app/core/guards/command-permissions.ts']];

/** Walks `src/app`, skipping the generated client, which names no permissions. */
function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'api') sourceFiles(path, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(path);
    }
  }
  return out;
}

const snapshot = JSON.parse(readFileSync(join(ROOT, SNAPSHOT), 'utf8'));
const catalogue = new Set(snapshot.codes.map((code) => code.trim()));

// A snapshot that silently emptied would turn this into a check that passes on anything.
if (catalogue.size < 500) {
  console.error(
    `${SNAPSHOT} holds only ${catalogue.size} codes, which is far fewer than any Fineract ` +
      'release ships. Refusing to check against it rather than reporting a clean run.',
  );
  process.exit(1);
}

/** code -> where it is named. */
const referenced = new Map();
for (const file of sourceFiles(join(ROOT, 'src/app'))) {
  const src = readFileSync(file, 'utf8');
  const rel = file.slice(join(ROOT, '').length);
  for (const [kind, pattern] of SOURCES) {
    for (const match of src.matchAll(new RegExp(pattern.source, 'gm'))) {
      record(match[1], `${kind} in ${rel}`);
    }
  }
}

for (const [kind, rel] of CODE_VALUE_FILES) {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  for (const match of src.matchAll(/:\s*'([A-Z][A-Z0-9_]*)'/g)) {
    record(match[1], `${kind} in ${rel}`);
  }
}

function record(code, place) {
  if (!referenced.has(code)) referenced.set(code, []);
  referenced.get(code).push(place);
}

if (referenced.size === 0) {
  console.error(
    'No permission codes were found in src/app. Either they moved or the patterns above no ' +
      'longer match; failing rather than reporting a clean run over an empty set.',
  );
  process.exit(1);
}

const problems = [];
for (const [code, places] of referenced) {
  if (WILDCARDS.has(code) || catalogue.has(code)) continue;
  problems.push(
    `${code} is not in Fineract's permission catalogue.\n` +
      places.map((place) => `    named as an ${place}`).join('\n') +
      '\n    No role can ever hold it, so the control it gates is permanently refused. Find the ' +
      `real code in ${SNAPSHOT}, or declare ALL_FUNCTIONS if the operation really is ` +
      'superuser-only.',
  );
}

if (problems.length) {
  console.error(`\nPermission code check failed — ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  - ${problem}\n`);
  process.exit(1);
}

console.log(
  `✓ ${referenced.size} permission codes named across src/app all exist in Fineract's ` +
    `catalogue (${catalogue.size} codes, captured ${snapshot.capturedAt}).`,
);
