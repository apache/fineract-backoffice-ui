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
 * The working-capital portfolio overview, and opening a loan by its external id.
 *
 * The overview is the module's only cross-loan screen, so what it asserts is that the totals on
 * it are the ones the platform reported per loan — added up, banded, and shown beside the charts
 * that summarise them.
 */

import { expect, test, type Page } from './fixtures';

async function signIn(page: Page): Promise<void> {
  await page.route(
    /\/(?:fineract-provider\/)?api\/v1\/(?:clients|loans|savingsaccounts)(?:\?|$)/,
    (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } })
        : route.fallback(),
  );
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
        permissions: ['ALL_FUNCTIONS'],
      },
    }),
  );
  await page.route('**/api/v1/configurations/name/enable-business-date**', (route) =>
    route.fulfill({ json: { name: 'enable-business-date', enabled: false } }),
  );
  await page.route('**/api/v1/businessdate**', (route) => route.fulfill({ json: [] }));
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

/** Three loans: one current, one a month down, one long overdue, all in one currency. */
const BOOK = {
  content: [
    {
      id: 1,
      accountNo: '000000001',
      client: { id: 7, displayName: 'Alpha Trading' },
      status: { value: 'Active', active: true },
      currency: { code: 'USD' },
      approvedPrincipal: 10_000,
      summary: { totalOutstanding: 6000 },
      delinquent: { delinquentAmount: 0, delinquentDays: 0 },
      balance: { breachPastDueAmount: 0 },
    },
    {
      id: 2,
      accountNo: '000000002',
      client: { id: 8, displayName: 'Beta Supplies' },
      status: { value: 'Active', active: true },
      currency: { code: 'USD' },
      approvedPrincipal: 5000,
      summary: { totalOutstanding: 2500 },
      delinquent: { delinquentAmount: 400, delinquentDays: 45 },
      balance: { breachPastDueAmount: 150 },
    },
    {
      id: 3,
      accountNo: '000000003',
      client: { id: 9, displayName: 'Gamma Freight' },
      status: { value: 'Closed', closed: true },
      currency: { code: 'USD' },
      approvedPrincipal: 2000,
      summary: { totalOutstanding: 0 },
      delinquent: { delinquentAmount: 0, delinquentDays: 0 },
      chargedOff: true,
      balance: { breachPastDueAmount: 0 },
    },
  ],
  totalElements: 3,
};

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Working-capital portfolio', () => {
  test('totals the book, bands its delinquency and charts both', async ({ page }) => {
    await signIn(page);
    await page.route(/\/api\/v1\/working-capital-loans(?:\?.*)?$/, (route) =>
      route.fulfill({ json: BOOK }),
    );

    await page.goto('/working-capital/overview');

    // 6000 + 2500 + 0, in the one currency the book shares.
    await expect(page.getByTestId('wc-tile-outstanding')).toContainText('8,500.00');
    await expect(page.getByTestId('wc-tile-outstanding')).toContainText('USD');
    await expect(page.getByTestId('wc-tile-loans')).toContainText('3');
    await expect(page.getByTestId('wc-tile-delinquent')).toContainText('400.00');
    await expect(page.getByTestId('wc-tile-breach-past-due')).toContainText('150.00');
    await expect(page.getByTestId('wc-tile-flagged')).toContainText('1');

    // The 45-day loan lands in one band and nowhere else.
    await expect(page.getByTestId('wc-aging-d31to60')).toContainText('2,500.00');
    await expect(page.getByTestId('wc-aging-current')).toContainText('6,000.00');

    // Each chart is paired with the table carrying the same figures, which is what makes the
    // reading independent of colour.
    await expect(page.getByTestId('wc-aging-chart')).toBeVisible();
    await expect(page.getByTestId('wc-status-chart')).toBeVisible();
    await expect(page.getByTestId('wc-portfolio-aging')).toBeVisible();
    await expect(page.getByTestId('wc-portfolio-status')).toBeVisible();
  });

  test('says so when an external reference matches no loan', async ({ page }) => {
    await signIn(page);
    await page.route(/\/api\/v1\/working-capital-loans(?:\?.*)?$/, (route) =>
      route.fulfill({ json: BOOK }),
    );
    await page.route('**/api/v1/working-capital-loans/external-id/**', (route) =>
      route.fulfill({ status: 404, json: { developerMessage: 'not found' } }),
    );

    await page.goto('/working-capital/loans');
    await page.getByTestId('wc-external-id-input').fill('REF-NOT-A-LOAN');
    await page.getByTestId('wc-external-id-open').click();

    await expect(page).toHaveURL('/working-capital/loans/external/REF-NOT-A-LOAN');
    // The reference is named back, so the operator can see what was actually looked up.
    await expect(page.getByTestId('wc-external-id-not-found')).toContainText('REF-NOT-A-LOAN');
  });
});
