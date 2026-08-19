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
 * Cover for #330 — global search reaching settings and navigation pages, not just entities.
 *
 * The behaviour worth pinning end to end is the part that cannot be seen from a unit test of
 * `searchRoutes`: that a shortcut for a page the user can reach appears in the header dropdown
 * alongside entity hits, that selecting it lands on that page, and that a page the user has no
 * permission for is absent — the last one being a permission leak if it ever regresses, since
 * the label alone tells an operator the screen exists.
 *
 * Mocked throughout; the navigation tree is built client-side, so no Fineract is needed.
 */

import { test, expect, Page } from './fixtures';

const TENANT = 'default';
const USER = 'mifos';
const PASSWORD = 'password';

/** Matches the `debounceTime(300)` in HeaderComponent, with room for the round trip. */
const DEBOUNCE_MS = 300;

async function mockSession(page: Page, permissions: string[]) {
  // Registered first: Playwright matches handlers most-recently-registered first, so a
  // catch-all added later would also answer /authentication and strip the permissions
  // this spec is entirely about.
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
        username: USER,
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: 'Head Office',
        roles: [{ id: 1, name: 'Role', description: 'Role' }],
        permissions,
      }),
    });
  });

  await page.route(/\/api\/v1\/businessdate/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ type: 'BUSINESS_DATE', date: [2026, 8, 16] }]),
    });
  });

  // Entity search is not what this spec is about; an empty result set leaves only the
  // navigation shortcuts on screen, which is exactly what is being asserted.
  await page.route(/\/api\/v1\/search\?/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

async function login(page: Page, permissions: string[] = ['ALL_FUNCTIONS']) {
  await mockSession(page, permissions);
  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT);
  await page.locator('#username').fill(USER);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

const searchBox = (page: Page) => page.getByTestId('global-search').locator('input');
const results = (page: Page) => page.getByTestId('global-search-results');
const offices = (page: Page) => page.getByTestId('search-result-nav-organization-offices');

test.describe('Global search navigation shortcuts', () => {
  test('offers a settings page the entity search cannot return', async ({ page }) => {
    await login(page);

    await searchBox(page).fill('Offices');

    // The premise of #330: entity search answers nothing for "Offices", so before this
    // the dropdown stayed empty and the page was only reachable through the sidebar.
    await expect(results(page)).toBeVisible();
    await expect(offices(page)).toBeVisible();
  });

  test('navigates to the page behind a shortcut', async ({ page }) => {
    await login(page);

    await searchBox(page).fill('Offices');
    await expect(offices(page)).toBeVisible();
    await offices(page).click();

    await expect(page).toHaveURL('/organization/offices');
  });

  test('withholds a shortcut the user has no permission to reach', async ({ page }) => {
    await login(page, ['READ_CLIENT']);

    await searchBox(page).fill('Users');
    await page.waitForTimeout(DEBOUNCE_MS * 3);

    // A visible label is itself a disclosure — it tells an operator the screen exists and
    // invites a click that can only end at /forbidden.
    await expect(page.getByTestId('search-result-nav-security-users')).toBeHidden();
  });
});
