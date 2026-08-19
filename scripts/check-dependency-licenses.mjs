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
 * Classifies every dependency's licence against the ASF third-party licensing policy.
 *
 *   node scripts/check-dependency-licenses.mjs            # production + dev
 *   node scripts/check-dependency-licenses.mjs --production
 *   node scripts/check-dependency-licenses.mjs --json     # machine-readable, for release review
 *
 * The policy this enforces:
 *
 *   Category A   PASS    permissive; may be included and depended on freely
 *   Category B   REVIEW  reported, does not fail; may generally be included in binary form,
 *                        with attribution obligations the PMC must be aware of
 *   Category X   BLOCK   may not be included in an Apache product
 *   Unknown      BLOCK   a licence nobody has classified is not a licence anyone has cleared
 *
 * ## Why Unknown blocks
 *
 * The failure this check exists to prevent is not a GPL dependency arriving with a banner. It is a
 * package whose `license` field says `SEE LICENSE IN LICENSE.txt`, or nothing at all, sliding in
 * on a transitive bump and nobody noticing for two releases. Treating that as a pass makes the
 * whole check decorative, so it fails, and clearing it means either identifying the licence and
 * adding it below, or recording it in ACKNOWLEDGED with the reason.
 *
 * ## Why an ACKNOWLEDGED list exists
 *
 * The ASF's published category lists do not cover every SPDX identifier in a modern npm tree.
 * BlueOak-1.0.0 is the current example: plainly permissive, widely used, and not named in either
 * list. Silently treating it as Category A would be inventing a policy decision; blocking the
 * build over it would be theatre. So it sits in ACKNOWLEDGED with a written reason and a note that
 * the PMC should confirm — the same shape as the documented exemptions in
 * check-route-permissions.mjs, and for the same reason: an exemption that records who decided what
 * outlives the person who decided it.
 *
 * ## Scope
 *
 * `--production` is what ships. The default scan includes devDependencies, which is deliberate:
 * they are not distributed, but they are named in `package.json`, and `package.json` travels in a
 * source release. A Category X build tool is a question the PMC has to answer either way, so this
 * check surfaces it rather than scoping it out.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * ASF Category A — permissive, no restriction on inclusion.
 * https://www.apache.org/legal/resolved.html#category-a
 */
const CATEGORY_A = new Set([
  '0BSD',
  'AFL-3.0',
  'Apache-1.1',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BSL-1.0',
  'CC-BY-2.5',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MIT-0',
  'MS-PL',
  'PSF-2.0',
  'Python-2.0',
  'Unlicense',
  'W3C',
  'WTFPL',
  'Zlib',
  'ZPL-2.0',
]);

/**
 * ASF Category B — may be included in binary form, with conditions the PMC must be aware of.
 * https://www.apache.org/legal/resolved.html#category-b
 */
const CATEGORY_B = new Set([
  'CC-BY-SA-3.0',
  'CC-BY-SA-4.0',
  'CDDL-1.0',
  'CDDL-1.1',
  'CPL-1.0',
  'EPL-1.0',
  'EPL-2.0',
  'ErlPL-1.1',
  'IPA',
  'MPL-1.1',
  'MPL-2.0',
  'OSL-3.0',
  'SPL-1.0',
  'UPL-1.0',
]);

/**
 * ASF Category X — must not be included in an Apache product.
 * https://www.apache.org/legal/resolved.html#category-x
 */
const CATEGORY_X = new Set([
  'AGPL-1.0',
  'AGPL-1.0-only',
  'AGPL-1.0-or-later',
  'AGPL-3.0',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'BUSL-1.1',
  'CC-BY-NC-1.0',
  'CC-BY-NC-2.0',
  'CC-BY-NC-2.5',
  'CC-BY-NC-3.0',
  'CC-BY-NC-4.0',
  'CC-BY-NC-ND-4.0',
  'CC-BY-NC-SA-4.0',
  'CPAL-1.0',
  'Elastic-2.0',
  'GPL-1.0',
  'GPL-2.0',
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'JSON',
  'LGPL-2.0',
  'LGPL-2.0-only',
  'LGPL-2.1',
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'NPL-1.0',
  'NPL-1.1',
  'QPL-1.0',
  'SSPL-1.0',
  'Sleepycat',
]);

/**
 * Licences the ASF has not categorised, and the decision this project has recorded about each.
 *
 * An entry here is a decision, not a shortcut: it says someone looked, and why they concluded what
 * they did. Anything not here and not in a category list blocks.
 */
const ACKNOWLEDGED = new Map([
  [
    'BlueOak-1.0.0',
    'Permissive, no copyleft, no attribution obligation beyond the notice. Not named in either ' +
      'ASF category list; treated as Category A pending PMC confirmation. Build-tooling only ' +
      'today (it arrives under the ESLint and Angular CLI trees).',
  ],
]);

/** Licence strings npm publishes that carry no information. */
const UNINFORMATIVE = /^(unknown|unlicensed|see licen[cs]e|custom|none|)$/i;

const args = new Set(process.argv.slice(2));
const productionOnly = args.has('--production');
const asJson = args.has('--json');
const selfTest = args.has('--self-test');

/**
 * The installed dependency tree, from npm itself.
 *
 * `npm ls --json` is used rather than walking `node_modules`, because it is the thing that knows
 * which packages are actually reachable from this `package.json` and which are leftovers. It exits
 * non-zero on tree problems that are not this check's business — an optional platform binary for
 * another libc, most commonly — so the exit code is ignored and only the JSON is read. A tree so
 * broken that it produces no JSON is a separate failure, and it is reported as one.
 */
function readTree() {
  const argv = ['ls', '--all', '--json', '--long'];
  if (productionOnly) argv.push('--omit=dev');
  let raw;
  try {
    raw = execFileSync('npm', argv, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (error) {
    raw = error.stdout;
  }
  if (!raw) {
    console.error('`npm ls --json` produced no output. Is the dependency tree installed?');
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch {
    console.error('`npm ls --json` produced output that is not JSON. Refusing to guess.');
    process.exit(1);
  }
}

/** Flattens npm's nested `dependencies` map into one entry per name@version. */
function flatten(tree) {
  const found = new Map();
  const visit = (node, isDirect) => {
    for (const [name, dep] of Object.entries(node.dependencies ?? {})) {
      if (dep.version) {
        const key = `${name}@${dep.version}`;
        if (!found.has(key)) {
          found.set(key, {
            name,
            version: dep.version,
            license: normaliseLicense(dep.license),
            direct: isDirect,
            dev: dep.dev === true,
            resolved: dep.resolved,
          });
        } else if (isDirect) {
          found.get(key).direct = true;
        }
      }
      visit(dep, false);
    }
  };
  visit(tree, true);
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** npm's `license` field may be a string, an object, or an array of objects. */
function normaliseLicense(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map((v) => v?.type ?? v).join(' OR ');
  if (value && typeof value === 'object') return value.type ?? '';
  return '';
}

/**
 * Classifies one SPDX expression.
 *
 * `OR` means the project may pick, so the best available verdict applies — a package offered as
 * `MIT OR GPL-3.0` can be taken under MIT. `AND` means every listed licence binds, so the worst
 * applies. Everything else is a single identifier.
 */
function classify(expression) {
  const licence = String(expression ?? '').trim();
  if (UNINFORMATIVE.test(licence)) return { verdict: 'UNKNOWN', reason: 'no licence declared' };

  const cleaned = licence.replace(/^\((.*)\)$/, '$1').trim();

  // The test must be the same shape as the split, or an expression can be detected as compound
  // and then not split, and `classify` recurses on itself until the stack goes. `\bOR\b` does
  // exactly that to `GPL-2.0-or-later`, where hyphens make `or` its own word.
  if (/\s+OR\s+/i.test(cleaned)) {
    const parts = cleaned.split(/\s+OR\s+/i).map((p) => classify(p));
    return best(parts, cleaned, 'OR');
  }
  if (/\s+AND\s+/i.test(cleaned)) {
    const parts = cleaned.split(/\s+AND\s+/i).map((p) => classify(p));
    return worst(parts, cleaned, 'AND');
  }

  // `GPL-2.0+` is the deprecated spelling of `-or-later`, and `MIT*` appears in older metadata.
  const id = cleaned.replace(/\+$/, '-or-later').replace(/\*$/, '');

  if (CATEGORY_A.has(id)) return { verdict: 'A' };
  if (CATEGORY_B.has(id)) return { verdict: 'B' };
  if (CATEGORY_X.has(id)) return { verdict: 'X' };
  if (ACKNOWLEDGED.has(id)) return { verdict: 'ACKNOWLEDGED', reason: ACKNOWLEDGED.get(id) };
  return { verdict: 'UNKNOWN', reason: `'${cleaned}' is not in any category list` };
}

const RANK = { A: 0, ACKNOWLEDGED: 1, B: 2, UNKNOWN: 3, X: 4 };

function best(parts, expression, joiner) {
  const pick = parts.reduce((a, b) => (RANK[a.verdict] <= RANK[b.verdict] ? a : b));
  return { ...pick, reason: `${expression}: taken under the ${joiner} branch that resolves best` };
}

function worst(parts, expression, joiner) {
  const pick = parts.reduce((a, b) => (RANK[a.verdict] >= RANK[b.verdict] ? a : b));
  return { ...pick, reason: `${expression}: every ${joiner} term binds, so the strictest applies` };
}

// ---------------------------------------------------------------------------------------------

/**
 * Proves the classifier still classifies, without needing a package that violates policy.
 *
 * A gate nobody has watched fail is not a gate. The tree is clean today, so a green run here says
 * nothing on its own — this is what says the rules still bite. Run by CI beside the scan itself.
 */
function runSelfTest() {
  const cases = [
    ['MIT', 'A'],
    ['Apache-2.0', 'A'],
    ['BSD-3-Clause', 'A'],
    ['0BSD', 'A'],
    ['CC-BY-4.0', 'A'],
    ['Python-2.0', 'A'],
    ['MPL-2.0', 'B'],
    ['EPL-2.0', 'B'],
    // The one this project actually removed.
    ['LGPL-3.0-only', 'X'],
    ['LGPL-3.0', 'X'],
    ['GPL-3.0-or-later', 'X'],
    ['AGPL-3.0', 'X'],
    ['SSPL-1.0', 'X'],
    ['BUSL-1.1', 'X'],
    ['Elastic-2.0', 'X'],
    ['CC-BY-NC-4.0', 'X'],
    // Deprecated `+` spelling must not slip through as unclassified-but-harmless.
    ['GPL-2.0+', 'X'],
    ['BlueOak-1.0.0', 'ACKNOWLEDGED'],
    // OR lets the project pick the better branch; AND binds every term.
    ['(MIT OR GPL-3.0)', 'A'],
    ['(MIT AND CC-BY-3.0)', 'A'],
    ['(MIT AND GPL-3.0)', 'X'],
    ['(MIT OR CC0-1.0)', 'A'],
    // Nothing useful declared.
    ['', 'UNKNOWN'],
    ['UNLICENSED', 'UNKNOWN'],
    ['SEE LICENSE IN LICENSE.txt', 'UNKNOWN'],
    ['Frobnicate-9.9', 'UNKNOWN'],
  ];

  const failures = [];
  for (const [expression, expected] of cases) {
    const actual = classify(expression).verdict;
    if (actual !== expected) {
      failures.push(`  ${JSON.stringify(expression)} → ${actual}, expected ${expected}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n✗ Licence classifier self-test failed:\n${failures.join('\n')}\n`);
    process.exit(1);
  }
  console.log(`✓ Licence classifier self-test: ${cases.length} expressions classified correctly.`);
}

if (selfTest) {
  runSelfTest();
  process.exit(0);
}

const packages = flatten(readTree());
if (packages.length === 0) {
  console.error('No dependencies were found. Failing rather than reporting a clean empty scan.');
  process.exit(1);
}

const buckets = { A: [], B: [], X: [], UNKNOWN: [], ACKNOWLEDGED: [] };
for (const pkg of packages) {
  const { verdict, reason } = classify(pkg.license);
  buckets[verdict].push({ ...pkg, reason });
}

if (asJson) {
  const { name, version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  console.log(
    JSON.stringify(
      {
        project: name,
        version,
        scope: productionOnly ? 'production' : 'production+dev',
        total: packages.length,
        counts: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
        packages: packages.map((p) => ({ ...p, ...classify(p.license) })),
      },
      null,
      2,
    ),
  );
}

const blocking = [...buckets.X, ...buckets.UNKNOWN];

if (!asJson) {
  const scope = productionOnly ? 'production' : 'production and dev';
  console.log(`\nDependency licences — ${packages.length} packages (${scope})\n`);
  console.log(`  Category A  ${String(buckets.A.length).padStart(4)}   pass`);
  console.log(`  Acknowledged${String(buckets.ACKNOWLEDGED.length).padStart(4)}   pass, recorded`);
  console.log(`  Category B  ${String(buckets.B.length).padStart(4)}   review`);
  console.log(`  Category X  ${String(buckets.X.length).padStart(4)}   block`);
  console.log(`  Unknown     ${String(buckets.UNKNOWN.length).padStart(4)}   block`);

  for (const pkg of buckets.ACKNOWLEDGED) {
    console.log(
      `\n  RECORDED  ${pkg.name}@${pkg.version}  ${pkg.license}\n            ${pkg.reason}`,
    );
  }

  for (const pkg of buckets.B) {
    const where = pkg.dev ? 'dev/build only' : 'DISTRIBUTED';
    console.log(
      `\n  REVIEW    ${pkg.name}@${pkg.version}  ${pkg.license}  (Category B, ${where})` +
        '\n            Allowed in binary form. The PMC should know it is here.',
    );
  }

  for (const pkg of blocking) {
    const kind = CATEGORY_X.has(String(pkg.license).trim()) ? 'Category X' : 'unclassified';
    const where = pkg.dev ? 'dev/build only, not distributed' : 'DISTRIBUTED';
    console.log(
      `\n  BLOCK     ${pkg.name}@${pkg.version}  ${pkg.license || '(none declared)'}` +
        `\n            ${kind}, ${pkg.direct ? 'direct' : 'transitive'}, ${where}` +
        (pkg.reason ? `\n            ${pkg.reason}` : ''),
    );
  }
}

if (blocking.length > 0) {
  if (!asJson) {
    console.error(
      `\n✗ ${blocking.length} package(s) block the build.\n` +
        '  Category X may not be included in an Apache product. An unclassified licence has not ' +
        'been\n  cleared by anyone — identify it and add it to a category list, or record it in ' +
        'ACKNOWLEDGED\n  in this script with the reason. Do not widen a category list to make ' +
        'this pass.\n',
    );
  }
  process.exit(1);
}

if (!asJson) {
  console.log('\n✓ No Category X or unclassified licences.\n');
}
