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
 * Covers the breadcrumb trail above page content — ported from web-app's shell breadcrumb,
 * built here from each activated route's existing `title` metadata rather than new route data.
 */

import { test, expect } from './fixtures';

const TENANT = 'default';
const USER = 'mifos';
const PASSWORD = 'password';

test.beforeEach(async ({ page }) => {
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
        permissions: ['ALL_FUNCTIONS'],
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

  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT);
  await page.locator('#username').fill(USER);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
});

test('a single-crumb page shows no breadcrumb trail', async ({ page }) => {
  await page.goto('/clients');
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).toHaveCount(0);
});

test('a nested page shows a trail, and the ancestor crumb navigates back', async ({ page }) => {
  await page.goto('/clients/create');

  const trail = page.locator('nav[aria-label="Breadcrumb"]');
  await expect(trail).toBeVisible();
  await expect(trail.getByRole('link', { name: 'Clients' })).toBeVisible();
  await expect(trail.locator('.current')).toHaveText('Create Client');

  await trail.getByRole('link', { name: 'Clients' }).click();
  await expect(page).toHaveURL('/clients');
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).toHaveCount(0);
});

test('a directly opened loan shows its owner trail after the record loads', async ({ page }) => {
  await page.route(
    (url) => url.pathname === '/api/v1/loans/1',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          accountNo: '000000001',
          clientId: 42,
          clientName: 'Navigation Test',
          loanProductName: 'Navigation Loan',
          status: {
            id: 100,
            code: 'loanStatusType.submitted.and.pending.approval',
            value: 'Submitted and pending approval',
            submittedAndPendingApproval: true,
          },
          currency: { code: 'USD', decimalPlaces: 2, displaySymbol: '$' },
          principal: 1000,
          repaymentSchedule: { periods: [] },
          transactions: [],
          charges: [],
        }),
      });
    },
  );

  // A full document navigation simulates opening a deep link, without visiting the owner first.
  await page.goto('/loans/view/1');

  const trail = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
  await expect(trail).toBeVisible();
  await expect(trail.getByRole('link')).toHaveText(['Clients', 'Navigation Test']);
  await expect(trail.getByRole('link', { name: 'Clients', exact: true })).toHaveAttribute(
    'href',
    '/clients',
  );
  await expect(trail.getByRole('link', { name: 'Navigation Test', exact: true })).toHaveAttribute(
    'href',
    '/clients/view/42',
  );
  await expect(trail.locator('[aria-current="page"]')).toHaveText('Loan Account 000000001');
  await expect(trail.getByRole('link', { name: 'Products', exact: true })).toHaveCount(0);
});

test('a group loan breadcrumb opens the group and restores its route trail', async ({ page }) => {
  const group = {
    id: 7,
    name: 'Navigation Test Group',
  };
  await page.route(
    (url) => url.pathname === '/api/v1/loans/2',
    (route) =>
      route.fulfill({
        json: {
          id: 2,
          accountNo: '000000002',
          group,
          loanType: { id: 2, code: 'accountType.group', value: 'Group' },
          loanProductName: 'Navigation Loan',
          status: {
            id: 100,
            value: 'Submitted and pending approval',
            submittedAndPendingApproval: true,
          },
          currency: { code: 'USD', decimalPlaces: 2, displaySymbol: '$' },
          principal: 1000,
          repaymentSchedule: { periods: [] },
          transactions: [],
          charges: [],
        },
      }),
  );
  await page.route(
    (url) => url.pathname === '/api/v1/groups/7',
    (route) =>
      route.fulfill({
        json: {
          ...group,
          accountNo: '000000007',
          active: true,
          officeName: 'Head Office',
          status: { id: 300, value: 'Active' },
          clientMembers: [],
        },
      }),
  );

  await page.goto('/loans/view/2');

  const trail = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
  await expect(trail.getByRole('link')).toHaveText(['Groups', group.name]);
  await expect(trail.locator('[aria-current="page"]')).toHaveText('Loan Account 000000002');

  await trail.getByRole('link', { name: group.name, exact: true }).click();

  await expect(page).toHaveURL('/groups/view/7');
  await expect(page.getByRole('heading', { name: group.name, exact: true })).toBeVisible();
  await expect(trail.getByRole('link')).toHaveText(['Groups']);
  await expect(trail.locator('[aria-current="page"]')).toHaveText('Group Details');
});

test('a share account breadcrumb opens the client and restores its route trail', async ({
  page,
}) => {
  const client = {
    id: 42,
    displayName: 'Navigation Test Client',
  };
  await page.route(
    (url) => url.pathname === '/api/v1/accounts/share/3',
    (route) =>
      route.fulfill({
        json: {
          id: 3,
          accountNo: '000000003',
          clientId: client.id,
          clientName: client.displayName,
          productName: 'Ordinary Shares',
          currency: { code: 'USD', displaySymbol: '$' },
          status: { id: 300, value: 'Active', active: true },
          purchasedShares: [],
        },
      }),
  );
  await page.route(
    (url) => url.pathname === '/api/v1/clients/42',
    (route) =>
      route.fulfill({
        json: {
          ...client,
          accountNo: '000000042',
          firstname: 'Navigation',
          lastname: 'Test Client',
          officeName: 'Head Office',
          status: { id: 300, value: 'Active' },
        },
      }),
  );
  await page.route(
    (url) => url.pathname === '/api/v1/clients/42/accounts',
    (route) =>
      route.fulfill({ json: { loanAccounts: [], savingsAccounts: [], shareAccounts: [] } }),
  );

  await page.goto('/products/shares/view/3');

  const trail = page.getByRole('navigation', { name: 'Breadcrumb', exact: true });
  await expect(trail.getByRole('link')).toHaveText(['Clients', client.displayName]);
  await expect(trail.locator('[aria-current="page"]')).toHaveText('Share Account 000000003');

  await trail.getByRole('link', { name: client.displayName, exact: true }).click();

  await expect(page).toHaveURL('/clients/view/42');
  await expect(page.getByRole('heading', { name: client.displayName, exact: true })).toBeVisible();
  await expect(trail.getByRole('link')).toHaveText(['Clients']);
  await expect(trail.locator('[aria-current="page"]')).toHaveText('Client Details');
});
