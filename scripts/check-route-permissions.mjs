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
 * Keeps route authorization and navigation visibility from drifting apart.
 *
 * Two places now describe the same fact. A route says which permission opens it, in its
 * `data.permissions`; the navigation tree says which permission makes its entry visible, in
 * `requiredPermissions`. When those two disagree the failure is quiet and unpleasant in both
 * directions — a menu item that leads straight to Access Denied, or a screen missing from the
 * menu that the URL still opens.
 *
 * The obvious fix, having the navigation read the router configuration at runtime, does not
 * work here: every feature is behind `loadChildren`, so a lazy feature's child routes simply
 * are not in `Router.config` until something navigates into them. The navigation is built at
 * login, long before that. So the two declarations stay independent and this check compares
 * them statically instead.
 *
 *   node scripts/check-route-permissions.mjs
 *
 * Exit 1 when a route and its navigation entry disagree, when a feature route declares no
 * permission and is not listed in UNRESTRICTED below, or when an UNRESTRICTED entry no longer
 * matches a real route — a stale exemption reads as a decision someone made, and outlives the
 * screen it was made for.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAV_FILE = 'src/app/core/services/navigation-config.service.ts';

/**
 * Routes that deliberately require no permission, and why.
 *
 * Two kinds of entry appear here, and the distinction matters when reviewing a new one:
 *
 *   - *Self-service*: the screen is about the signed-in user or their session. Gating it on a
 *     Fineract permission would be wrong, not merely unnecessary.
 *   - *No such permission*: Fineract's catalogue has no code covering the read. These are not
 *     exemptions anyone chose; they are the platform's shape. Inventing a code to fill the gap
 *     would produce a gate that no role can ever satisfy, which is worse than no gate — so the
 *     screen stays open and the backend, which is the real boundary, decides. Where the same
 *     feature *does* have CREATE/UPDATE codes, the write routes are gated even though the read
 *     route is not; that asymmetry is deliberate.
 *
 * A screen that looks unprivileged is not automatically an entry here. Check what the API it
 * calls requires first.
 */
const UNRESTRICTED = new Map([
  // --- self-service and session ---
  ['/login', 'Sign-in page; reached before there is a session to hold permissions'],
  ['/', 'The authenticated shell itself; its children carry the requirements'],
  [
    '/dashboard',
    'Landing page after sign-in; must stay reachable or a refused user has nowhere to go',
  ],
  ['/forbidden', 'The refusal page; gating it on a permission would make refusal itself refusable'],
  ['/auth/forgot-password', 'Password recovery; by definition reached without a usable session'],
  ['/profile', "The signed-in user's own account"],
  ['/notifications', "The signed-in user's own notifications"],
  ['/search', 'Global search; every result it links to is gated at its destination'],
  ['/fineract-mfe', 'Federation placeholder; the remote owns whatever it renders'],

  // --- Fineract defines no READ permission for these ---
  ['/products/share', 'No READ_SHAREPRODUCT in the catalogue; SHAREPRODUCT has only CREATE/UPDATE'],
  [
    '/products/shares',
    'No READ_SHAREACCOUNT in the catalogue; SHAREACCOUNT has only CREATE/UPDATE and actions',
  ],
  ['/products/shares/view/:id', 'No READ_SHAREACCOUNT in the catalogue'],
  [
    '/products/interest-rate-charts',
    'No READ_INTERESTRATECHART; the catalogue has CREATE/UPDATE/DELETE only',
  ],
  [
    '/products/collateral-management',
    'No READ_COLLATERAL_PRODUCT; the catalogue has CREATE/UPDATE/DELETE only',
  ],
  [
    '/clients/:clientId/collaterals',
    'No READ_CLIENT_COLLATERAL_PRODUCT; the catalogue has CREATE/UPDATE/DELETE only',
  ],
  ['/accounting/provisioning-categories', 'No READ_PROVISIONCATEGORY in the catalogue'],
  ['/accounting/provisioning-criteria', 'No READ_PROVISIONCRITERIA in the catalogue'],
  ['/accounting/provisioning-entries', 'No READ_PROVISIONENTRIES in the catalogue'],
  ['/tellers', 'No READ_TELLER; the cash_mgmt grouping has no read code at all'],
  ['/tellers/:tellerId/cashiers', 'No READ_TELLER, and no CASHIER entity in the catalogue'],
  [
    '/tellers/:tellerId/cashiers/:cashierId/transactions',
    'No READ_TELLER, and no CASHIER entity in the catalogue',
  ],
  ['/organization/group-levels', 'No GROUPLEVEL permission family in the catalogue'],
  [
    '/system/adhoc-query',
    'No READ_ADHOC; the authorisation grouping has CREATE/UPDATE/DELETE only',
  ],
  ['/system/entity-mapping', 'No READ_ENTITYMAPPING; the catalogue has CREATE/UPDATE/DELETE only'],
  ['/system/instance-mode', 'No permission family covers instance mode'],
  ['/system/oidc-config', 'No permission family covers the OIDC client configuration'],
  ['/system/field-configuration', 'No permission family covers field configuration'],
  [
    '/system/loan-product-details',
    'Read-only presentation of loan-product template metadata; no permission family covers it',
  ],
  [
    '/fintech/asset-owners',
    'No READ code for EXTERNAL_ASSET_OWNER; the catalogue has CREATE and CANCEL only',
  ],
  ['/fintech/asset-owners/view/:id', 'No READ code for EXTERNAL_ASSET_OWNER'],
  ['/spm/surveys', 'The survey grouping holds only REGISTER_SURVEY; no read code exists'],
  ['/spm/surveys/:surveyId/scorecards', 'No scorecard permission family in the catalogue'],
  ['/spm/poverty-line', 'No poverty-line permission family in the catalogue'],
  ['/spm/survey-responses', 'The survey grouping holds only REGISTER_SURVEY; no read code exists'],

  // --- requirement is not knowable statically ---
  [
    '/products/:accountType/:accountId/action/:command',
    'Dispatch route: the permission depends on :accountType and :command at runtime, so any ' +
      'single declaration here would be wrong for most of the commands it serves',
  ],
]);

/** Every `<feature>.routes.ts`, plus the root route table. */
function routeFiles() {
  const files = ['src/app/app.routes.ts'];
  for (const name of readdirSync(join(ROOT, 'src/app/features'))) {
    const rel = `src/app/features/${name}/${name}.routes.ts`;
    if (existsSync(join(ROOT, rel))) files.push(rel);
  }
  return files;
}

/**
 * Reads a route table into flat records carrying the brace depth each was found at.
 *
 * Deliberately textual. The alternative is loading the Angular route tables, which means
 * resolving every `loadComponent` in the tree — a build, to answer a question the source text
 * already answers. Depth is enough to rebuild the nesting afterwards.
 */
function parseRoutes(file) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const found = [];
  let depth = 0;
  let line = 1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\n') line++;
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;

    if (src.startsWith('path:', i)) {
      const m = /^path:\s*'([^']*)'/.exec(src.slice(i, i + 200));
      if (m) found.push({ path: m[1], depth, line, file, children: [] });
      continue;
    }
    if (!found.length) continue;
    const current = found[found.length - 1];

    if (src.startsWith('loadChildren:', i)) {
      current.loadChildren = /import\('([^']+)'\)/.exec(src.slice(i, i + 320))?.[1];
    } else if (src.startsWith('loadComponent:', i)) {
      current.component = /m\.(\w+)/.exec(src.slice(i, i + 320))?.[1];
    } else if (src.startsWith('component:', i)) {
      current.component = /^component:\s*(\w+)/.exec(src.slice(i, i + 120))?.[1];
    } else if (src.startsWith('redirectTo:', i)) {
      current.redirect = true;
    } else if (src.startsWith('canActivate:', i)) {
      current.canActivate = /^canActivate:\s*\[([^\]]*)\]/.exec(src.slice(i, i + 200))?.[1] ?? '';
    } else if (src.startsWith('permissions:', i)) {
      current.permissions = readPermissions(src.slice(i, i + 400));
    } else if (src.startsWith('permissionsMatchAll:', i)) {
      current.matchAll = /^permissionsMatchAll:\s*true/.test(src.slice(i, i + 60));
    }
  }
  return found;
}

/** `permissions: 'X'` or `permissions: ['X', 'Y']` -> a sorted array of codes. */
function readPermissions(text) {
  const single = /^permissions:\s*'([^']+)'/.exec(text);
  if (single) return [single[1]];
  const many = /^permissions:\s*\[([^\]]*)\]/.exec(text);
  if (many) return [...many[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  return undefined;
}

/** Rebuilds nesting from the depth markers and walks it into absolute URLs. */
function toTree(flat) {
  const roots = [];
  const stack = [];
  for (const item of flat) {
    while (stack.length && stack[stack.length - 1].depth >= item.depth) stack.pop();
    if (stack.length) stack[stack.length - 1].children.push(item);
    else roots.push(item);
    stack.push(item);
  }
  return roots;
}

const routes = [];
function collect(items, prefix) {
  for (const item of items) {
    const url = `${prefix}/${item.path}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
    routes.push({ ...item, url });
    if (item.children.length) collect(item.children, url);
    if (item.loadChildren) {
      const child = `src/app/${item.loadChildren.replace(/^\.\//, '')}.ts`;
      collect(toTree(parseRoutes(child)), url);
    }
  }
}
collect(toTree(parseRoutes('src/app/app.routes.ts')), '');

// A parser that silently matches nothing would turn this check into a rubber stamp.
if (routes.length === 0) {
  console.error(
    'No routes were parsed from src/app/app.routes.ts.\n' +
      'Either the route tables moved, or their shape changed enough that this parser no longer ' +
      'recognises them. Failing rather than reporting a clean run over an empty set.',
  );
  process.exit(1);
}

/** Routes that actually render something — a redirect or wildcard has nothing to protect. */
const screens = routes.filter((r) => r.component && !r.redirect && r.path !== '**');

const problems = [];

// ---------------------------------------------------------------------------------------------
// 1. Every screen either declares a permission or is a documented exemption.
// ---------------------------------------------------------------------------------------------
for (const route of screens) {
  if (route.permissions?.length) continue;
  if (UNRESTRICTED.has(route.url)) continue;
  problems.push(
    `${route.file}:${route.line}  ${route.url}\n` +
      `    renders ${route.component} but declares no data.permissions.\n` +
      '    Add one, or record it in UNRESTRICTED in this script with the reason it needs none.',
  );
}

// ---------------------------------------------------------------------------------------------
// 2. A permission is only enforced if permissionGuard actually runs.
// ---------------------------------------------------------------------------------------------
for (const route of screens) {
  if (!route.permissions?.length) continue;
  const guards = route.canActivate ?? '';
  if (!guards.includes('permissionGuard')) {
    problems.push(
      `${route.file}:${route.line}  ${route.url}\n` +
        `    declares permissions ${JSON.stringify(route.permissions)} but no permissionGuard, ` +
        'so nothing enforces them.',
    );
  } else if (!/\bauthGuard\b\s*,\s*permissionGuard/.test(guards)) {
    problems.push(
      `${route.file}:${route.line}  ${route.url}\n` +
        `    guards are [${guards}]. authGuard must come first, or a signed-out visitor is told ` +
        'they are forbidden instead of being asked to sign in.',
    );
  }
}

// ---------------------------------------------------------------------------------------------
// 3. No stale exemptions.
// ---------------------------------------------------------------------------------------------
const urls = new Set(screens.map((r) => r.url));
for (const [url, reason] of UNRESTRICTED) {
  if (urls.has(url)) continue;
  problems.push(
    `UNRESTRICTED entry '${url}' matches no route.\n` +
      `    Recorded reason: ${reason}\n` +
      '    The screen was renamed or removed; drop the entry rather than leaving it to imply a ' +
      'decision about a route that no longer exists.',
  );
}

// ---------------------------------------------------------------------------------------------
// 4. Navigation agrees with the routes.
// ---------------------------------------------------------------------------------------------
const navSource = readFileSync(join(ROOT, NAV_FILE), 'utf8');
const navStart = navSource.indexOf('const NAV_CONFIG');
const navBody = navSource.slice(navStart, navSource.indexOf('\n];', navStart));
if (navStart < 0 || !navBody) {
  console.error(`Could not locate NAV_CONFIG in ${NAV_FILE}; failing rather than skipping.`);
  process.exit(1);
}

const routePermissions = new Map(screens.map((r) => [r.url, r.permissions ?? null]));
const routeMatchAll = new Map(screens.map((r) => [r.url, r.matchAll === true]));
let navEntries = 0;

// Each chunk starts at a `route:` and runs to the next one, which is enough to keep an entry's
// own `requiredPermissions` from being read off a sibling.
for (const chunk of navBody.split(/(?=route:\s*')/).slice(1)) {
  const entry = chunk.split(/\n\s*\},?/)[0];
  const url = /^route:\s*'([^']+)'/.exec(entry)[1];
  navEntries++;

  if (!routePermissions.has(url)) {
    problems.push(
      `${NAV_FILE}  nav entry '${url}' points at no route.\n` +
        '    Either the route was removed and the entry should go, or the path is a typo — the ' +
        'menu item would render and lead nowhere.',
    );
    continue;
  }

  const navPerms = readNavPermissions(entry);
  const expected = routePermissions.get(url);
  if (JSON.stringify(navPerms) !== JSON.stringify(expected)) {
    problems.push(
      `${NAV_FILE}  nav entry '${url}' disagrees with its route.\n` +
        `    navigation: ${describe(navPerms)}\n` +
        `    route:      ${describe(expected)}  (${routePermissions.has(url) ? findFile(url) : '?'})\n` +
        '    The two must match, or the menu hides a reachable screen or offers an unreachable one.',
    );
    continue;
  }

  const navAll = /requiredAllPermissions:\s*true/.test(entry);
  if (navAll !== routeMatchAll.get(url)) {
    problems.push(
      `${NAV_FILE}  nav entry '${url}' disagrees with its route on AND/OR semantics.\n` +
        `    navigation requiredAllPermissions: ${navAll}\n` +
        `    route permissionsMatchAll:        ${routeMatchAll.get(url)}`,
    );
  }
}

if (navEntries === 0) {
  console.error(`No routed entries were parsed from NAV_CONFIG in ${NAV_FILE}; failing.`);
  process.exit(1);
}

function readNavPermissions(entry) {
  const single = /requiredPermissions:\s*'([^']+)'/.exec(entry);
  if (single) return [single[1]];
  const many = /requiredPermissions:\s*\[([^\]]*)\]/.exec(entry);
  if (many) return [...many[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  return null;
}

function describe(permissions) {
  return permissions?.length ? permissions.join(' , ') : '(none)';
}

function findFile(url) {
  const route = screens.find((r) => r.url === url);
  return route ? `${route.file}:${route.line}` : '?';
}

if (problems.length) {
  console.error(`\nRoute permission check failed — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  - ${p}\n`);
  process.exit(1);
}

console.log(
  `\u2713 ${screens.length} screens, ${navEntries} navigation entries: route permissions, ` +
    'guard order and navigation visibility all agree.',
);
console.log(
  `  ${screens.length - UNRESTRICTED.size} gated, ${UNRESTRICTED.size} documented as unrestricted.`,
);
