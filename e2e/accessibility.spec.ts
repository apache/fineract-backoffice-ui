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

import { mockClientTextSearch } from './utils/client-search-mock';
import AxeBuilder from '@axe-core/playwright';

import { test, expect, Page } from './fixtures';

const TENANT = 'default';
const USERNAME = 'mifos';
const PASSWORD = 'password';
const HEAD_OFFICE = 'Head Office';
const LOGIN_ROUTE = '/login';
const DASHBOARD_ROUTE = '/dashboard';
const CLIENTS_ROUTE = '/clients';
const CREATE_CLIENT_ROUTE = '/clients/create';
const TENANT_INPUT_SELECTOR = '#tenantId';
const USERNAME_INPUT_SELECTOR = '#username';
const PASSWORD_INPUT_SELECTOR = '#password';
const CARD_SELECTOR = 'ion-card';
const BANNER_SELECTOR = '.header';
const CONTENT_SELECTOR = '.content-area';
const TOAST_SELECTOR = 'ion-toast';
const CARD_TITLE_SELECTOR = 'ion-card-title';
const ACTIVE_MODAL_SELECTOR = 'ion-modal:not(.ion-datetime-button-overlay)';
const BUTTON_ROLE = 'button';
const SIGN_IN_BUTTON_NAME = 'Sign In';
const ADD_NEW_OFFICE_BUTTON_NAME = 'Add New Office';
const CLIENTS_TITLE = 'Clients';
const CREATE_CLIENT_TITLE = 'Create Client';
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);
const CLIENT_LIST_BASELINE = new Set([
  'role-img-alt|ion-icon[name="add-outline"]',
  'role-img-alt|ion-icon[name="play-skip-back-outline"]',
  'role-img-alt|.flip-rtl[name="chevron-back-outline"][slot="icon-only"]',
  'role-img-alt|ion-icon[name="chevron-forward-outline"]',
  'role-img-alt|ion-icon[name="play-skip-forward-outline"]',
]);
const CLIENT_FORM_BASELINE = new Set([
  // Ionic renders `ion-select`'s inner trigger as a `button` and reflects `required` onto it as
  // `aria-required`, which ARIA does not allow on that role. One defect, but its fingerprint moves
  // with the host's state classes, because axe picks the shortest unique selector for the host:
  // `.has-value` once a value is chosen, `.has-placeholder` while empty with a placeholder set,
  // and the bare attribute selector when neither class applies.
  'aria-allowed-attr|.has-value >> #ion-sel-*',
  'aria-allowed-attr|.has-placeholder >> #ion-sel-*',
  'aria-allowed-attr|ion-select[name="officeId"] >> #ion-sel-*',
  'role-img-alt|ion-icon[name="add-circle-outline"]',
  'role-img-alt|.help-icon[name="help-circle-outline"]',
]);
const CREATE_OFFICE_DIALOG_BASELINE = new Set(['aria-allowed-attr|#office-parent >> #ion-sel-*']);
/**
 * Pre-existing failures in the banner and on the dashboard that this scan inherits rather than
 * introduces. Both are unrelated to the contrast work in #484 and want their own fix.
 *
 * `role-img-alt` is the Ionic behaviour already carried in CLIENT_LIST_BASELINE: `ion-icon`
 * renders with `role="img"` and no accessible name of its own. Every entry here is decorative
 * beside a visible text label, so it is a naming defect rather than lost information.
 *
 * `scrollable-region-focusable` on `main` is a genuine keyboard-access finding and is listed
 * here so it stays visible in the diff rather than disappearing. It is not caused by this
 * change: `.content-area` scrolls today and did before.
 */
const SHELL_BASELINE = new Set([
  'role-img-alt|.flip-rtl',
  'role-img-alt|ion-icon[name="moon-outline"]',
  'role-img-alt|ion-icon[name="settings-outline"]',
  'role-img-alt|ion-icon[name="people-outline"]',
  'role-img-alt|ion-icon[name="wallet-outline"]',
  'role-img-alt|ion-icon[name="card-outline"]',
  'role-img-alt|ion-icon[name="hardware-chip-outline"]',
  'role-img-alt|ion-icon[name="time-outline"]',
  'role-img-alt|ion-icon[name="checkmark-circle-outline"]',
  'role-img-alt|.chart-card:nth-child(1) > ion-card-header > ion-card-title > ion-icon[name="pie-chart-outline"]',
  'role-img-alt|.chart-card:nth-child(2) > ion-card-header > ion-card-title > ion-icon[name="pie-chart-outline"]',
  'scrollable-region-focusable|main',
]);

function targetParts(target: unknown): string[] {
  if (Array.isArray(target)) {
    return target.flatMap(targetParts);
  }
  return [String(target)];
}

function violationFingerprint(ruleId: string, target: unknown): string {
  const stableTarget = targetParts(target)
    .map((part) =>
      part.replace(/#ion-sel-\d+/g, '#ion-sel-*').replace(/\[_ngcontent-ng-c\d+=""\]/g, ''),
    )
    .join(' >> ');
  return `${ruleId}|${stableTarget}`;
}

async function mockSession(page: Page): Promise<void> {
  // Everything the dashboard widgets ask for beyond the specific routes below. Without it their
  // requests fail, the app raises an error toast per failure, and the toast overlay sits on top
  // of the page: axe then reports `color-contrast` as *incomplete* ("background color could not
  // be determined because it is overlapped by another element") for almost every node rather
  // than passing or failing it. A scan that cannot see the page is not a scan, which is what
  // `expectScanWasNotBlind` below exists to catch.
  //
  // Registered first on purpose. Playwright matches routes in reverse registration order, so a
  // catch-all added last would swallow the authentication and offices mocks too.
  await page.route(/\/api\/v1\//, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/config.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fineractApiUrl: '/api/v1', defaultTenant: TENANT }),
    });
  });

  await page.route('**/api/v1/authentication**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        username: USERNAME,
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: HEAD_OFFICE,
        roles: [{ id: 1, name: 'Super User', description: 'Super user' }],
        permissions: ['ALL_FUNCTIONS'],
      }),
    });
  });

  await page.route('**/api/v1/offices*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          name: HEAD_OFFICE,
          nameDecorated: HEAD_OFFICE,
          externalId: '1',
          openingDate: [2009, 1, 1],
          hierarchy: '.',
        },
      ]),
    });
  });

  await mockClientTextSearch(page);

  await page.route(/\/api\/v1\/clients(\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalFilteredRecords: 0, pageItems: [] }),
    });
  });
}

async function login(page: Page): Promise<void> {
  await mockSession(page);
  await page.goto(LOGIN_ROUTE);
  await page.locator(TENANT_INPUT_SELECTOR).fill(TENANT);
  await page.locator(USERNAME_INPUT_SELECTOR).fill(USERNAME);
  await page.locator(PASSWORD_INPUT_SELECTOR).fill(PASSWORD);
  await page.getByRole(BUTTON_ROLE, { name: SIGN_IN_BUTTON_NAME }).click();
  await expect(page).toHaveURL(DASHBOARD_ROUTE);
}

/**
 * Asserts the scan actually evaluated the page rather than giving up on it.
 *
 * axe reports a rule it could not resolve as *incomplete* rather than as a pass or a violation,
 * and an overlay covering the page puts almost every node there — the run then comes back with
 * an empty `violations` array and asserts nothing at all. That is the failure mode this suite is
 * most exposed to, because Ionic renders error toasts as full-width overlays and one unmocked
 * request is enough to raise them.
 *
 * A green run with zero passes is the signature. Checking for passes turns it from a silent
 * false negative into a failure that names the cause.
 */
function expectScanWasNotBlind(results: { passes: unknown[]; incomplete: unknown[] }): void {
  expect(
    results.passes.length,
    'axe evaluated nothing on this page, so a green result here means nothing. An overlay ' +
      '(usually an ion-toast from an unmocked request) is the usual cause; see mockSession.',
  ).toBeGreaterThan(0);
}

async function expectNoBlockingAccessibilityViolations(
  page: Page,
  include: string | readonly string[],
  baseline: ReadonlySet<string>,
): Promise<void> {
  const builder = new AxeBuilder({ page });
  for (const selector of typeof include === 'string' ? [include] : include) {
    builder.include(selector);
  }
  const results = await builder.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expectScanWasNotBlind(results);
  const violations = results.violations
    .filter((violation) => violation.impact != null && BLOCKING_IMPACTS.has(violation.impact))
    .map((violation) => ({
      ...violation,
      nodes: violation.nodes.filter(
        (node) => !baseline.has(violationFingerprint(violation.id, node.target)),
      ),
    }))
    .filter((violation) => violation.nodes.length > 0);

  if (violations.length > 0) {
    await test.info().attach('axe-accessibility-violations', {
      body: JSON.stringify(violations, null, 2),
      contentType: 'application/json',
    });
  }

  const summary = violations
    .map(
      (violation) =>
        `${violation.impact}: ${violation.id} - ${violation.help}\n` +
        violation.nodes.map((node) => `  ${node.target.join(' ')}`).join('\n'),
    )
    .join('\n');

  expect(violations, summary || 'No serious or critical accessibility violations').toEqual([]);
}

test.describe('Runtime accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('client list has no blocking violations', async ({ page }) => {
    await page.goto(CLIENTS_ROUTE);
    await expect(page.locator(CARD_TITLE_SELECTOR).first()).toContainText(CLIENTS_TITLE);

    await expectNoBlockingAccessibilityViolations(page, CARD_SELECTOR, CLIENT_LIST_BASELINE);
  });

  test('client form has no blocking violations', async ({ page }) => {
    await page.goto(CREATE_CLIENT_ROUTE);
    await expect(page.locator(CARD_TITLE_SELECTOR).first()).toContainText(CREATE_CLIENT_TITLE);

    await expectNoBlockingAccessibilityViolations(page, CARD_SELECTOR, CLIENT_FORM_BASELINE);
  });

  /**
   * The banner and the routed content on the dashboard.
   *
   * The other tests here scope their scan to `ion-card` or to an open modal, so nothing outside a
   * card had ever been scanned: not the header, and not the dashboard route at all.
   * `color-contrast` is part of `wcag2aa` and has been running the whole time — it was simply
   * never pointed anywhere it could see the application chrome, which is how six AA contrast
   * failures in the shipped light theme went unreported (#484).
   *
   * `app-sidebar` is deliberately not in scope. It has two pre-existing blocking failures that
   * have nothing to do with this change and should not be baselined away silently here:
   * `role-img-alt` on around sixty `ion-icon` nav glyphs, the same Ionic behaviour already
   * carried in CLIENT_LIST_BASELINE, and `scrollable-region-focusable` on the nav's own scroll
   * container, which is a real keyboard-access bug. Both want their own issue and their own fix.
   */
  test('banner and dashboard content have no blocking violations', async ({ page }) => {
    await page.goto(DASHBOARD_ROUTE);
    await expect(page.locator(BANNER_SELECTOR)).toBeVisible();
    await expect(page.locator(CARD_TITLE_SELECTOR).first()).toBeVisible();
    // An overlay would put color-contrast into axe's `incomplete` bucket for the whole page and
    // the assertion below would pass without having looked at anything.
    await expect(page.locator(TOAST_SELECTOR)).toHaveCount(0);

    await expectNoBlockingAccessibilityViolations(
      page,
      [BANNER_SELECTOR, CONTENT_SELECTOR],
      SHELL_BASELINE,
    );
  });

  test('create office dialog has no blocking violations', async ({ page }) => {
    await page.goto(CREATE_CLIENT_ROUTE);
    await page.getByRole(BUTTON_ROLE, { name: ADD_NEW_OFFICE_BUTTON_NAME }).click();
    await expect(page.locator(ACTIVE_MODAL_SELECTOR)).toBeVisible();

    await expectNoBlockingAccessibilityViolations(
      page,
      ACTIVE_MODAL_SELECTOR,
      CREATE_OFFICE_DIALOG_BASELINE,
    );
  });
});
