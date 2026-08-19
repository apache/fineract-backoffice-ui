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
  'aria-allowed-attr|.has-value >> #ion-sel-*',
  'aria-allowed-attr|ion-select[name="officeId"] >> #ion-sel-*',
  'role-img-alt|ion-icon[name="add-circle-outline"]',
  'role-img-alt|.help-icon[name="help-circle-outline"]',
]);
const CREATE_OFFICE_DIALOG_BASELINE = new Set(['aria-allowed-attr|#office-parent >> #ion-sel-*']);

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

async function expectNoBlockingAccessibilityViolations(
  page: Page,
  include: string,
  baseline: ReadonlySet<string>,
): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include(include)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
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
