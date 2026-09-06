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

import os from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

/**
 * The specs that talk to a real Fineract rather than mocking with page.route().
 *
 * They are the slow half of the suite and the only half that needs the docker
 * stack, so they are split into their own project: CI runs the mocked half
 * without bringing Fineract up at all, and the two halves run concurrently.
 *
 * A spec belongs here if it contains no page.route() mocks.
 */
/** Runs only against the dedicated two-factor stack; see the `two-factor` project. */
const TWO_FACTOR_SPECS = ['two-factor-backend.spec.ts'];

/**
 * Specs that only mean anything at a narrow viewport, and so run in the `mobile` project rather
 * than `mocked`. Kept out of `mocked` because asserting a drawer on a 1280px desktop would
 * assert the opposite of the behaviour.
 */
const MOBILE_SPECS = ['mobile-shell.spec.ts'];

/**
 * Specs that have something to assert at *both* viewports, and so run in `mocked` and in
 * `mobile`.
 *
 * Not members of MOBILE_SPECS, because that list is also `mocked`'s testIgnore — joining it
 * would take the desktop half of these specs out of the run entirely. Each one carries
 * describe-level viewport guards, so the half that does not apply at the current width is
 * skipped rather than asserting the opposite of the intended behaviour.
 */
const DUAL_VIEWPORT_SPECS = ['guidance-tour.spec.ts'];

const BACKEND_SPECS = [
  'batch-api-operations.spec.ts',
  'center-servicing.spec.ts',
  'parity-screens.spec.ts',
  'rbac-backend-restricted-user.spec.ts',
  'rbac-multi-permission.spec.ts',
  'client-transfer.spec.ts',
  'deposit-account-servicing.spec.ts',
  'deposit-product-configuration.spec.ts',
  'full-demo.spec.ts',
  'group-membership.spec.ts',
  'loan-account-actions.spec.ts',
  'loan-charge-off.spec.ts',
  'loan-lifecycle.spec.ts',
  'loan-product-accounting.spec.ts',
  'loan-schedule-type.spec.ts',
  'loan-servicing.spec.ts',
  'share-account-servicing.spec.ts',
  'login.spec.ts',
  'report-parameter-backend.spec.ts',
  'savings-transaction-correction.spec.ts',
  'share-product-accounting.spec.ts',
  'teller-cash-management.spec.ts',
];

export default defineConfig({
  testDir: './e2e',
  // Kept outside the project directory. The dev server under test watches the
  // repo, and Playwright creates and deletes .playwright-artifacts-* directories
  // inside outputDir continuously while a run is in progress. Vite's watcher
  // races those deletions and dies on an ENOENT scandir, which takes the whole
  // server down mid-suite — every test after that point fails with
  // ERR_CONNECTION_REFUSED, including retries, for reasons unrelated to the code.
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? path.join(os.tmpdir(), 'fineract-e2e-output'),
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  // The app is served by `ng serve`, which compiles lazy route chunks on demand,
  // so a first paint can exceed Playwright's 5s default. Assertions that use
  // .fill()/.click() already wait ~30s via actionability; this brings plain
  // expect() into the same range instead of failing on a slow-but-correct page.
  expect: { timeout: 15000 },
  // Recording paces every action, so a flow that fits comfortably at test speed needs a larger
  // budget while it is being filmed.
  timeout: process.env.DEMO_RECORD === '1' ? 900000 : 30000,
  use: {
    baseURL: 'https://localhost:4200',
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
    // Pinned to the e2e tenant's own timezone, which is what makes the suite deterministic
    // rather than a function of the hour it runs at.
    //
    // Fineract stamps and validates dates in the *tenant's* zone -- `m_tenants.timezone_id`,
    // which its seed data sets to Asia/Kolkata -- while the application fills date fields from
    // the *browser's* clock. Between 18:30 and 24:00 UTC those disagree by a day, so a UTC
    // runner would send 15 August for a record the platform had already stamped 16 August and
    // be refused: "Submitted on date cannot be after the activation date". A suite whose result
    // depends on what time of day it starts is not a signal.
    //
    // This makes the *harness* deterministic. It does not fix the underlying behaviour, which
    // affects any deployment whose users are not in the tenant's timezone -- see #358. Remove
    // this pin when that is fixed; the suite passing without it is the proof.
    timezoneId: 'Asia/Kolkata',
    // `DEMO_RECORD=1` records every spec, not just the ones that fail — the suites *are* the
    // flows, so recording them is what produces a demo of the application rather than a separate
    // script that could drift from what the app actually does. See DOCS/DEMO.md.
    video: process.env.DEMO_RECORD === '1' || process.env.CI ? 'on' : 'retain-on-failure',
    // A recording of a test suite is unwatchable at test speed: every click, fill and navigation
    // lands instantly, so a viewer sees the result of an action without ever seeing the action.
    // `slowMo` pauses before each Playwright operation, which puts a beat on the action itself
    // rather than uniformly slowing the footage in post — the difference between following what
    // is happening and watching a fast-forward. Recording only; the suite runs at full speed
    // otherwise, so this costs CI nothing.
    launchOptions: {
      slowMo: process.env.DEMO_RECORD === '1' ? Number(process.env.DEMO_SLOW_MO ?? 450) : 0,
    },
  },
  projects: [
    // Seeds the reference data the real-backend specs need — enabled currencies, a
    // datatable on m_loan, a collateral type. Running it as a dependency rather
    // than as a CI step means a local run gets the same baseline for free, which is
    // what allows those specs to run unconditionally instead of behind an env gate.
    { name: 'setup', testMatch: /backend\.setup\.ts/ },
    // Populates a demo dataset for manual testing. Deliberately its own project rather than
    // a member of BACKEND_SPECS or a dependency of it: nothing here is an assertion, so it
    // must never run as a side effect of `--project=backend` in CI, only when asked for by
    // name (`--project=demo-seed`, or `npm run seed:demo-data`).
    { name: 'demo-seed', testMatch: /demo-data\.setup\.ts/ },
    {
      // Everything that mocks its own backend with page.route(). Needs no Fineract
      // and no seeding, so CI can run it without the docker stack and in parallel
      // with the slower half — see .github/workflows/e2e.yml.
      name: 'mocked',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [...BACKEND_SPECS, ...TWO_FACTOR_SPECS, ...MOBILE_SPECS],
    },
    {
      // The narrow layout, on a real mobile emulation rather than a resized desktop: Pixel 7
      // brings the touch flags and the device pixel ratio with it, and `hasTouch` is what makes
      // Playwright dispatch taps instead of clicks — which is the difference between testing the
      // drawer and testing a mouse.
      //
      // 412x915 sits below MOBILE_BREAKPOINT_PX (768). If that constant moves, this has to move
      // with it or the project silently starts exercising the wide layout;
      // scripts/check-responsive.mjs holds the CSS side of the same agreement.
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: [...MOBILE_SPECS, ...DUAL_VIEWPORT_SPECS],
    },
    {
      // Drives a real Fineract end to end. Slow, and the only half that needs the
      // stack up.
      name: 'backend',
      use: { ...devices['Desktop Chrome'] },
      testMatch: BACKEND_SPECS,
      dependencies: ['setup'],
      // These flows submit real forms and wait on real persistence, so they need
      // more than the 30s default. Set here rather than per test because
      // test.setTimeout() does not cover beforeEach, and logging in against a
      // cold lazy-loaded route was already exceeding the default in that hook.
      //
      // This project setting overrides the root one, so it is what governs a recording run —
      // where every action carries a deliberate pause and the same flow takes far longer.
      timeout: process.env.DEMO_RECORD === '1' ? 900000 : 120000,
    },
    {
      // Two-factor authentication, against the stack `scripts/e2e-stack-2fa.sh` brings up.
      //
      // Its own project because `fineract.security.2fa.enabled` is process-wide: with it on,
      // every endpoint except /v1/twofactor answers 403 until a one-time token has been
      // validated, so this cannot share an instance with the `backend` project and must stay
      // out of the default run. No `setup` dependency for the same reason — the seeding it
      // performs would be refused.
      name: 'two-factor',
      use: { ...devices['Desktop Chrome'] },
      testMatch: TWO_FACTOR_SPECS,
      // Each case waits on an email round-trip through the catcher on top of the usual form work.
      timeout: 180000,
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, dependencies: ['setup'] },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, dependencies: ['setup'] },
  ],
  webServer: {
    command: 'npm start',
    url: 'https://localhost:4200',
    reuseExistingServer: true,
    ignoreHTTPSErrors: true,
    timeout: 300000,
  },
});
