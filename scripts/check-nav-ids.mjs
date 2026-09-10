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
 * Guards the navigation ids a deployment's config is allowed to name.
 *
 * Those ids are a published contract. A deployment writes `"hidden": ["nav.spm"]` into a file
 * this repository never sees, and the only thing keeping that working across releases is that
 * the id does not move. So three properties have to hold, and none of them is visible in a code
 * review of a one-line nav change:
 *
 *   1. every non-divider entry has an id            — an entry without one cannot be addressed
 *   2. ids are unique                               — a duplicate makes an override ambiguous
 *   3. no id disappears without a deprecation entry — a removal silently breaks deployments
 *
 * (3) is checked against `scripts/nav-ids.json`, a committed snapshot of the ids that shipped.
 * Adding an id updates the snapshot automatically with `--update`; removing one requires saying
 * so out loud in DEPRECATED below, which is the point.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SOURCE = join(ROOT, 'src/app/core/services/navigation-config.service.ts');
const SNAPSHOT = join(HERE, 'nav-ids.json');

/**
 * Ids intentionally retired, with the release that retired them.
 *
 * An id lands here when the screen behind it is genuinely gone. It stays for at least one minor
 * release so a deployment that names it gets a startup defect rather than a menu that quietly
 * stops matching, and so the removal appears in a changelog someone reads.
 */
const DEPRECATED = {
  'clients.search': {
    removedIn: 'unreleased',
    note: 'Folded into clients; /clients/search redirects to /clients.',
  },
};

/** Ids as they appear in NAV_CONFIG, in source order. */
function extractIds(source) {
  const start = source.indexOf('const NAV_CONFIG');
  if (start < 0) {
    throw new Error('NAV_CONFIG not found — has the constant been renamed?');
  }
  const body = source.slice(start);
  // Not anchored to line start: prettier keeps short entries on one line, so three of them
  // carry `{ id: 'dashboard', route: ... }` inline and an anchored pattern silently skips them.
  return [...body.matchAll(/\bid: '([^']+)'/g)].map((match) => match[1]);
}

/** Entries that declare a labelKey but no id, excluding dividers. */
function findIdlessEntries(source) {
  const start = source.indexOf('const NAV_CONFIG');
  const body = source.slice(start, source.indexOf('\n];', start));
  const offenders = [];

  // Objects are matched by their opening brace through the first labelKey at any depth. A
  // divider carries `divider: true` and no id, which is correct and skipped.
  for (const match of body.matchAll(/\{([^{}]*labelKey:[^{}]*)\}/g)) {
    const fields = match[1];
    if (fields.includes('divider: true')) continue;
    if (!/\bid:\s*'/.test(fields)) {
      const label = /labelKey:\s*'([^']*)'/.exec(fields)?.[1] ?? '(unknown)';
      offenders.push(label);
    }
  }
  return offenders;
}

const source = readFileSync(SOURCE, 'utf8');
const ids = extractIds(source);
const problems = [];

// 1 — presence
const idless = findIdlessEntries(source);
for (const label of idless) {
  problems.push(`Nav entry "${label}" has no id. Every non-divider entry needs one.`);
}

// 2 — uniqueness
const counts = new Map();
for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
for (const [id, n] of counts) {
  if (n > 1) {
    problems.push(`Nav id "${id}" is used ${n} times. Ids must be unique.`);
  }
}

// 3 — stability
const previous = existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, 'utf8')).ids : null;
if (previous) {
  const current = new Set(ids);
  for (const id of previous) {
    if (!current.has(id) && !DEPRECATED[id]) {
      problems.push(
        `Nav id "${id}" was removed. Deployments may name it in their config, so add an entry ` +
          `to DEPRECATED in ${'scripts/check-nav-ids.mjs'} before removing it, or restore the id.`,
      );
    }
  }
}

if (process.argv.includes('--update')) {
  writeFileSync(
    SNAPSHOT,
    `${JSON.stringify({ ids: [...ids].sort((a, b) => a.localeCompare(b)) }, null, 2)}\n`,
  );
  console.log(`Updated ${SNAPSHOT} with ${ids.length} ids.`);
  process.exit(problems.length > 0 ? 1 : 0);
}

if (problems.length > 0) {
  console.error('✗ Navigation id check failed:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\nAfter adding new entries, refresh the snapshot with:');
  console.error('  npm run check:nav-ids -- --update\n');
  process.exit(1);
}

const added = previous ? ids.filter((id) => !previous.includes(id)) : [];
if (added.length > 0) {
  console.error(`✗ ${added.length} new nav id(s) are not in the snapshot: ${added.join(', ')}`);
  console.error('  Refresh it with: npm run check:nav-ids -- --update');
  process.exit(1);
}

console.log(`✓ ${ids.length} nav ids: all present, unique and stable.`);
