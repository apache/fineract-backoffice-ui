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
 * End-to-end coverage for issue #120 / #114 — the `ALL_FUNCTIONS_READ`
 * shortcut on `AuthService.hasPermission()`.
 *
 * A user holding `ALL_FUNCTIONS_READ` should see every READ_* gated element
 * (e.g. list/detail screens) without the app needing to enumerate every read
 * permission individually, but must never see elements gated by a write
 * permission such as `CREATE_CLIENT`. This is exercised against the real
 * "Create Client" button on the Clients list page
 * (`*appHasPermission="'CREATE_CLIENT'"` in `clients-list.component.ts`),
 * which is hidden or shown purely by `AuthService.hasPermission()`.
 */

import { mockClientTextSearch } from './utils/client-search-mock';
import { test, expect, Page } from './fixtures';

const API_BASE = '/api/v1';
const TENANT_DEFAULT = 'default';
const TEST_USER = 'mifos';
const TEST_PASSWORD = 'password';
const RESP_EMPTY_PAGINATED = JSON.stringify({ totalFilteredRecords: 0, pageItems: [] });
const CREATE_CLIENT_BUTTON = /Create Client/;

async function login(page: Page, permissions: string[]): Promise<void> {
  await page.route('**/config.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fineractApiUrl: API_BASE, defaultTenant: TENANT_DEFAULT }),
    });
  });

  await page.route('**/api/v1/authentication**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        username: TEST_USER,
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: 'Head Office',
        roles: [{ id: 1, name: 'Test Role', description: 'Test role' }],
        permissions,
      }),
    });
  });

  await mockClientTextSearch(page);

  await page.route('**/api/v1/clients*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: RESP_EMPTY_PAGINATED,
    });
  });

  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT_DEFAULT);
  await page.locator('#username').fill(TEST_USER);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

test.describe('ALL_FUNCTIONS_READ shortcut', () => {
  test('grants read access to the Clients list without any explicit READ_CLIENT permission', async ({
    page,
  }) => {
    await login(page, ['ALL_FUNCTIONS_READ']);
    await page.getByRole('link', { name: 'Clients', exact: true }).click();
    await expect(page).toHaveURL('/clients');
  });

  test('does not grant the Create Client action', async ({ page }) => {
    await login(page, ['ALL_FUNCTIONS_READ']);
    await page.getByRole('link', { name: 'Clients', exact: true }).click();
    await expect(page).toHaveURL('/clients');

    await expect(page.getByRole('button', { name: CREATE_CLIENT_BUTTON })).toHaveCount(0);
  });

  test('does not grant Create Client even combined with an explicit READ_CLIENT permission', async ({
    page,
  }) => {
    await login(page, ['ALL_FUNCTIONS_READ', 'READ_CLIENT']);
    await page.getByRole('link', { name: 'Clients', exact: true }).click();
    await expect(page).toHaveURL('/clients');

    await expect(page.getByRole('button', { name: CREATE_CLIENT_BUTTON })).toHaveCount(0);
  });

  test('a user with the real CREATE_CLIENT permission still sees the button', async ({ page }) => {
    await login(page, ['READ_CLIENT', 'CREATE_CLIENT']);
    await page.getByRole('link', { name: 'Clients', exact: true }).click();
    await expect(page).toHaveURL('/clients');

    await expect(page.getByRole('button', { name: CREATE_CLIENT_BUTTON })).toBeVisible();
  });

  test('ALL_FUNCTIONS (full superuser) still sees the Create Client button', async ({ page }) => {
    await login(page, ['ALL_FUNCTIONS']);
    await page.getByRole('link', { name: 'Clients', exact: true }).click();
    await expect(page).toHaveURL('/clients');

    await expect(page.getByRole('button', { name: CREATE_CLIENT_BUTTON })).toBeVisible();
  });
});
