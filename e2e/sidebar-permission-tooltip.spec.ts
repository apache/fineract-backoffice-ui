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
 * What a sidebar item tells you about your own access (#138).
 *
 * The tooltip is computed from the codes the signed-in user actually holds for that entity, not
 * from the single code the item is gated on — holding `READ_CLIENT` and `CREATE_CLIENT` should
 * read as both. Mocked, because the subject is the permission set: putting an arbitrary one in
 * the authentication response is the whole fixture, where seeding a role per case against a real
 * Fineract would cost minutes to assert on a `title` attribute.
 */

import { expect, test, type Page } from './fixtures';

async function signIn(page: Page, permissions: string[]): Promise<void> {
  await page.route('**/config.json*', (route) =>
    route.fulfill({ json: { fineractApiUrl: '/api/v1', defaultTenant: 'default' } }),
  );
  await page.route('**/api/v1/authentication**', (route) =>
    route.fulfill({
      json: {
        username: 'mifos',
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: 'Head Office',
        roles: [{ id: 1, name: 'Branch Clerk', description: 'Branch clerk' }],
        permissions,
      },
    }),
  );
  await page.route('**/api/v1/configurations/name/enable-business-date**', (route) =>
    route.fulfill({ json: { name: 'enable-business-date', enabled: true } }),
  );
  await page.route('**/api/v1/businessdate**', (route) =>
    route.fulfill({ json: [{ type: 'BUSINESS_DATE', date: [2026, 10, 15] }] }),
  );
  await page.route(/\/api\/v1\/(?:clients|loans|savingsaccounts)(?:\?|$)/, (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } })
      : route.fallback(),
  );
  await page.route('**/api/v1/loans/due**', (route) =>
    route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } }),
  );
  await page.route('**/api/v1/runreports/**', (route) =>
    route.fulfill({ json: { columnHeaders: [], data: [] } }),
  );

  await page.goto('/login');
  await page.locator('#tenantId').fill('default');
  await page.locator('#username').fill('mifos');
  await page.locator('#password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

const clientsItem = (page: Page) => page.getByRole('link', { name: 'Clients', exact: true });

test.describe('Sidebar permission tooltip', () => {
  test('says what the signed-in user can do in that module', async ({ page }) => {
    await signIn(page, ['READ_CLIENT', 'CREATE_CLIENT']);

    await expect(clientsItem(page)).toHaveAttribute('title', /view and create clients/i);
  });

  /**
   * The point of computing it rather than restating the gate: the item is reachable on
   * `READ_CLIENT` alone, and the tooltip has to stop claiming the create.
   */
  test('narrows as the permission set narrows', async ({ page }) => {
    await signIn(page, ['READ_CLIENT']);

    const title = await clientsItem(page).getAttribute('title');
    expect(title).toMatch(/view clients/i);
    expect(title).not.toMatch(/create/i);
  });

  /**
   * A superuser holds `ALL_FUNCTIONS` rather than the individual codes, so there is nothing
   * specific to enumerate and "you can do everything" on every item is noise.
   */
  test('says nothing to a superuser, who has nothing specific to be told', async ({ page }) => {
    await signIn(page, ['ALL_FUNCTIONS']);

    await expect(clientsItem(page)).toBeVisible();
    await expect(clientsItem(page)).not.toHaveAttribute('title', /./);
  });

  /**
   * The issue asked for a refused item to read "Contact admin to request: CREATE_LOAN". The
   * sidebar does something else on purpose: a refused entry is filtered out rather than shown
   * greyed, because a menu is a list of destinations and one that is not yours is not a
   * destination. So there is no item to hover, and this pins that choice rather than the
   * wording that was proposed for it.
   */
  test('omits a module the user cannot reach, rather than explaining it', async ({ page }) => {
    await signIn(page, ['READ_CLIENT']);

    await expect(clientsItem(page)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Loans', exact: true })).toHaveCount(0);
  });
});
