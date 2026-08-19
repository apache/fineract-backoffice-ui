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
 * GA readiness gate.
 *
 * `security.md` opens with "This project is currently **not release-ready**." This script is
 * the machine-checkable part of what would have to change for that line to come out. Each gate
 * below states the finding it encodes in the comment above it; the trust boundaries they
 * sit on are described in `security.md`. The adapter gates are covered by
 * `DOCS/adr/0003-adapter-boundary.md`.
 *
 *   npm run ga:check              run every gate
 *   npm run ga:check -- --json    machine-readable output for CI annotation
 *
 * Exit code is the number of failed *blocking* gates, capped at 1 — so CI fails on any
 * blocker. Advisory gates report but never fail the run; they are the ones whose fix is a
 * deployment decision rather than a code change.
 *
 * A gate that cannot be decided from the repository is reported `unknown` rather than passed.
 * Reporting a security control as satisfied because nothing could be found to contradict it is
 * worse than reporting nothing at all.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const JSON_OUTPUT = process.argv.includes('--json');

/** @type {{id: string, title: string, status: 'pass'|'fail'|'unknown', blocking: boolean, detail: string, reference?: string}[]} */
const results = [];

function record(id, title, status, { blocking = true, detail = '', reference } = {}) {
  results.push({ id, title, status, blocking, detail, reference });
}

/** Reads a file, or returns '' when it is absent — an absent file is a gate's answer, not a crash. */
function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

/** Every hand-written `.ts` under `src`, excluding the generated OpenAPI client. */
function* sources(dir = 'src') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full.replaceAll('\\', '/').includes('src/app/api')) continue;
      yield* sources(full);
    } else if (entry.name.endsWith('.ts')) {
      yield full;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Gate 1 — HTTP security headers
//
// `deploy/nginx.conf.template` is the file that defines the server block — the container renders
// it at startup, substituting only the proxy upstream. For a core-banking UI the missing
// `frame-ancestors` is the sharp end: without it the whole application is frameable, and a
// clickjacked "Approve loan" is a real transaction.
// ---------------------------------------------------------------------------------------------
{
  const NGINX_CONF = 'deploy/nginx.conf.template';
  const conf = read(NGINX_CONF);
  const required = [
    ['Content-Security-Policy', /add_header\s+Content-Security-Policy/i],
    ['X-Content-Type-Options', /add_header\s+X-Content-Type-Options/i],
    ['Referrer-Policy', /add_header\s+Referrer-Policy/i],
    ['Strict-Transport-Security', /add_header\s+Strict-Transport-Security/i],
  ];
  // `frame-ancestors` in a CSP supersedes X-Frame-Options; either satisfies the gate.
  const framing =
    /frame-ancestors/i.test(conf) || /add_header\s+X-Frame-Options/i.test(conf)
      ? null
      : 'X-Frame-Options or CSP frame-ancestors';

  const missing = required.filter(([, re]) => !re.test(conf)).map(([name]) => name);
  if (framing) missing.push(framing);

  if (!conf) {
    record('headers', 'NGINX sets HTTP security headers', 'unknown', {
      detail: `${NGINX_CONF} not found — cannot determine what the deployment sends.`,
    });
  } else if (missing.length > 0) {
    record('headers', 'NGINX sets HTTP security headers', 'fail', {
      detail: `${NGINX_CONF} is missing: ${missing.join(', ')}.`,
      reference: 'security.md §4',
    });
  } else {
    record('headers', 'NGINX sets HTTP security headers', 'pass');
  }
}

// ---------------------------------------------------------------------------------------------
// Gate 2 — the API endpoint override is validated
//
// `ConfigService.setApiUrl()` persists whatever the login form's "Custom URL" field contained,
// and every subsequent request — including the one carrying credentials — goes there. The gate
// asks for a validator, not for the feature's removal.
// ---------------------------------------------------------------------------------------------
{
  const config = read('src/app/core/services/config.service.ts');
  const validates = /isAllowedApiUrl|validateApiUrl|allowedOrigins|apiUrlAllowList/i.test(config);
  record(
    'api-url-validation',
    'API endpoint override is validated against an allow-list',
    config ? (validates ? 'pass' : 'fail') : 'unknown',
    {
      detail: validates
        ? ''
        : 'ConfigService.setApiUrl() accepts any string. A user (or anything running as the page) can point the app, and the credentials it posts, at an arbitrary host.',
      reference: 'security.md §5a',
    },
  );
}

// ---------------------------------------------------------------------------------------------
// Gate 3 — the Authorization header is not sent cross-origin
//
// `authInterceptor` attaches `Authorization: Basic` to every outgoing HttpClient request with
// no check on the destination. Nothing in the app currently calls a third party, so this is
// pre-emptive — which is the only time it is cheap.
// ---------------------------------------------------------------------------------------------
{
  const interceptor = read('src/app/core/interceptors/auth.interceptor.ts');
  const guards = /isExternalUrl|sameOrigin|isInternalUrl|new URL\(/.test(interceptor);
  record(
    'auth-header-scope',
    'Authorization header is restricted to the API origin',
    interceptor ? (guards ? 'pass' : 'fail') : 'unknown',
    {
      detail: guards
        ? ''
        : 'authInterceptor sets Authorization on every request regardless of destination. The first third-party integration will ship banking credentials to a vendor.',
      reference: 'security.md §4',
    },
  );
}

// ---------------------------------------------------------------------------------------------
// Gate 4 — no XSS sinks
//
// There are none today, across every hand-written file. Worth gating rather than assuming:
// it is a property a single careless commit removes.
// ---------------------------------------------------------------------------------------------
{
  const sinks = [];
  const pattern = /\bbypassSecurityTrust\w*|\[innerHTML\]|\.innerHTML\s*=|document\.write\(/;
  for (const file of sources()) {
    const source = readFileSync(file, 'utf8');
    if (pattern.test(source)) sinks.push(file);
  }
  record(
    'xss-sinks',
    'No sanitizer bypasses or raw HTML sinks',
    sinks.length === 0 ? 'pass' : 'fail',
    {
      detail: sinks.length === 0 ? '' : `Found in: ${sinks.join(', ')}`,
      reference: 'security.md §5',
    },
  );
}

// ---------------------------------------------------------------------------------------------
// Gate 5 — third-party hosts are not offered on the login form
//
// The server dropdown ships `demo.mifos.io` and `apis.mifos.community`. A production build
// should not offer a teller a one-click path to type real credentials into someone else's
// demo server.
// ---------------------------------------------------------------------------------------------
{
  const login = read('src/app/features/login/login.component.ts');
  // A label followed by a dot and a real TLD, so the `https://...` placeholder in the custom
  // URL field is not mistaken for a host the form offers.
  const hosts = [...login.matchAll(/https:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})/gi)]
    .map((match) => match[1])
    .filter((host) => !host.startsWith('localhost') && !host.includes('127.0.0.1'));
  const unique = [...new Set(hosts)];
  record(
    'login-hosts',
    'Login form offers no third-party API hosts',
    login ? (unique.length === 0 ? 'pass' : 'fail') : 'unknown',
    {
      detail: unique.length === 0 ? '' : `Hard-coded in the server picker: ${unique.join(', ')}.`,
    },
  );
}

// ---------------------------------------------------------------------------------------------
// Gate 6 — adapter boundary holds
//
// Delegated to ESLint, which owns the rules. This gate asserts the suppression baseline is
// shrinking rather than growing: a new violation fails lint outright, and a fixed one must be
// pruned from the baseline so it cannot come back.
// ---------------------------------------------------------------------------------------------
{
  const raw = read('eslint-suppressions.json');
  if (!raw) {
    record('adapter-boundary', 'Adapter boundary suppressions are recorded', 'unknown', {
      detail: 'eslint-suppressions.json not found.',
    });
  } else {
    const suppressions = JSON.parse(raw);
    const boundaryRules = [
      'no-restricted-imports',
      'no-restricted-globals',
      'no-restricted-properties',
    ];
    let remaining = 0;
    for (const rules of Object.values(suppressions)) {
      for (const rule of boundaryRules) remaining += rules[rule]?.count ?? 0;
    }
    // Advisory: the backlog is real and shrinks per-component. What must not happen is growth,
    // and `npm run lint` already fails on an unrecorded violation.
    record(
      'adapter-boundary',
      'Adapter boundary migration backlog',
      remaining === 0 ? 'pass' : 'fail',
      {
        blocking: false,
        detail:
          remaining === 0
            ? ''
            : `${remaining} call sites still reach past the boundary. New ones fail 'npm run lint'; this count must only fall.`,
        reference: 'DOCS/adr/0003-adapter-boundary.md',
      },
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Gate 7 — the generated API surface still exists
// ---------------------------------------------------------------------------------------------
{
  try {
    execFileSync('node', ['scripts/check-api-surface.mjs'], { stdio: 'pipe' });
    record('api-surface', 'Generated API surface matches the manifest', 'pass');
  } catch (error) {
    record('api-surface', 'Generated API surface matches the manifest', 'fail', {
      detail: String(error.stdout ?? error.stderr ?? error.message)
        .trim()
        .split('\n')
        .slice(0, 6)
        .join('\n'),
      reference: 'DOCS/adr/0003-adapter-boundary.md',
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Gate 8 — no production dependency has a known vulnerability
//
// Scoped to `--omit=dev` on purpose. The dev tree currently carries 4 high findings, every one
// of them in build tooling that never reaches a browser; gating GA on those would train people
// to ignore the gate.
// ---------------------------------------------------------------------------------------------
{
  let audit;
  try {
    audit = JSON.parse(
      execFileSync('npm', ['audit', '--omit=dev', '--json'], { stdio: 'pipe' }).toString(),
    );
  } catch (error) {
    // `npm audit` exits non-zero when it finds something; the report is still on stdout.
    try {
      audit = JSON.parse(String(error.stdout));
    } catch {
      audit = null;
    }
  }

  if (!audit?.metadata?.vulnerabilities) {
    record('deps', 'No known vulnerabilities in production dependencies', 'unknown', {
      detail: 'npm audit produced no parseable report (offline?).',
    });
  } else {
    const counts = audit.metadata.vulnerabilities;
    const serious = (counts.critical ?? 0) + (counts.high ?? 0);
    record(
      'deps',
      'No known vulnerabilities in production dependencies',
      serious === 0 ? 'pass' : 'fail',
      {
        detail:
          serious === 0
            ? ''
            : `${counts.critical ?? 0} critical, ${counts.high ?? 0} high in the production tree.`,
      },
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Gate 5 — no external webfont dependency
//
// The UI once pulled Inter from `fonts.googleapis.com` via a <link> in `src/index.html`. That
// cost more than it looked: Angular's font inlining fetched the stylesheet at *build* time and
// failed the entire build when it was unreachable, and at *runtime* the browser fetched the
// binaries from `fonts.gstatic.com` — which `deploy/nginx.conf.template`'s `font-src 'self' data:`
// blocked, so the deployed UI silently rendered in the fallback stack. Inter is now bundled
// from `@fontsource-variable/inter` and served from this origin.
//
// This gate keeps it that way. It matches host references that carry a scheme or a
// protocol-relative prefix, so prose in a code comment does not trip it but a real <link>,
// @import or url() does. `audit/` and `DOCS/` are not scanned: they document this history and
// necessarily name the hosts.
// ---------------------------------------------------------------------------------------------
{
  const FONT_HOSTS = /(?:https?:)?\/\/fonts\.(?:googleapis|gstatic)\.com/i;
  const SCANNED_EXTENSIONS = ['.html', '.css', '.scss', '.sass', '.ts', '.js', '.json'];

  /** Walks a directory yielding files worth scanning; missing directories yield nothing. */
  function* scannable(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) yield* scannable(full);
      else if (SCANNED_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) yield full;
    }
  }

  const offenders = [];

  // Application and build inputs — what a developer would edit to reintroduce the dependency.
  for (const dir of ['src', 'public', 'projects', 'deploy']) {
    for (const file of scannable(dir)) {
      if (FONT_HOSTS.test(read(file))) offenders.push(file);
    }
  }
  for (const file of ['angular.json', 'index.html']) {
    if (existsSync(file) && FONT_HOSTS.test(read(file))) offenders.push(file);
  }

  // The built artifact, when one is present. A clean source tree that still emits a Google URL
  // would mean the build itself put it there, which is exactly what used to happen.
  let artifactChecked = false;
  for (const built of scannable('dist')) {
    artifactChecked = true;
    if (FONT_HOSTS.test(read(built))) offenders.push(built);
  }

  if (offenders.length > 0) {
    record('external-fonts', 'No external webfont dependency', 'fail', {
      detail:
        `Reference to fonts.googleapis.com or fonts.gstatic.com in: ${offenders.join(', ')}.\n` +
        'Fonts must be bundled and served from this origin — the deployment CSP blocks ' +
        'third-party font hosts, and the build must not depend on a network fetch.',
      reference: 'DOCS/FONTS.md',
    });
  } else {
    record('external-fonts', 'No external webfont dependency', 'pass', {
      detail: artifactChecked
        ? 'Source and built artifact are both clean.'
        : 'Source is clean; no dist/ present, so the artifact was not checked.',
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------

if (JSON_OUTPUT) {
  console.log(JSON.stringify({ results }, null, 2));
} else {
  const mark = { pass: '  PASS', fail: '  FAIL', unknown: '  ????' };
  console.log('\nGA readiness — fineract-backoffice-ui\n');
  for (const result of results) {
    const suffix = result.blocking ? '' : ' (advisory)';
    console.log(`${mark[result.status]}  ${result.title}${suffix}`);
    if (result.detail) {
      for (const line of result.detail.split('\n')) console.log(`          ${line}`);
    }
    if (result.reference && result.status !== 'pass') {
      console.log(`          see ${result.reference}`);
    }
  }
  const failed = results.filter((r) => r.status === 'fail' && r.blocking);
  const unknown = results.filter((r) => r.status === 'unknown');
  console.log(
    `\n${results.filter((r) => r.status === 'pass').length}/${results.length} gates pass; ` +
      `${failed.length} blocking failure(s), ${unknown.length} undetermined.\n`,
  );
}

// An undetermined blocking gate fails alongside an outright failure. `unknown` means the check
// could not read what it needed — a renamed file, a moved config — and the honest reading of "I
// could not tell" is not "yes". This repository has already had a release gate that existed and
// never ran; a gate that silently stops checking is the same failure wearing a green tick.
process.exit(
  results.some((r) => r.blocking && (r.status === 'fail' || r.status === 'unknown')) ? 1 : 0,
);
