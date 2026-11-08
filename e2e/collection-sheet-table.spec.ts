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
 * The generated collection sheet, rendered as a sheet (#670).
 *
 * This is mocked on purpose, and it is the only way this can be covered: the backend spec beside
 * it (`collection-sheet.spec.ts`) exercises the real endpoint, which answers 200 with an empty
 * body unless a group meeting falls on the date — so a real instance proves the empty case and
 * can say nothing about the populated one. The payload below is shaped after Fineract's own
 * `JLGCollectionSheetData`, not invented.
 */

import { expect, test, type Page } from './fixtures';

const SHEET = {
  dueDate: [2026, 11, 8],
  groups: [
    {
      groupId: 7,
      groupName: 'Mahila Mandal A',
      staffName: 'Officer, Field',
      levelName: 'Group',
      clients: [
        {
          clientId: 21,
          clientName: 'Asha Kumar',
          loans: [
            {
              loanId: 101,
              accountId: '000000101',
              productShortName: 'JLG1',
              currency: { code: 'INR' },
              principalDue: 800,
              interestDue: 120,
              feeDue: 30,
              chargesDue: 0,
              totalDue: 950,
              disbursementAmount: 0,
            },
          ],
          savings: [
            {
              savingsId: 55,
              accountId: '000000055',
              productName: 'Group Savings',
              currency: { code: 'INR' },
              dueAmount: 50,
            },
          ],
        },
        { clientId: 22, clientName: 'Bimla Devi', loans: [], savings: [] },
      ],
    },
  ],
};

async function signIn(page: Page): Promise<void> {
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

async function mockSheet(page: Page, sheet: unknown): Promise<void> {
  await page.route('**/api/v1/offices**', (route) =>
    route.fulfill({ json: [{ id: 1, name: 'Head Office' }] }),
  );
  await page.route(/\/api\/v1\/staff/, (route) =>
    route.fulfill({ json: [{ id: 4, displayName: 'Officer, Field' }] }),
  );
  await page.route(/\/api\/v1\/collectionsheet/, (route) => route.fulfill({ json: sheet }));
}

/** Fills the filters and generates. */
async function generate(page: Page): Promise<void> {
  await page.goto('/collection-sheet');
  await page
    .locator('ion-item')
    .filter({ has: page.getByText('Office', { exact: true }) })
    .locator('ion-select')
    .click();
  await page.locator('ion-popover:visible').getByRole('radio', { name: 'Head Office' }).click();
  await page.getByRole('button', { name: /generate/i }).click();
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Collection sheet rendering', () => {
  test('shows the clients, their accounts and what each owes', async ({ page }) => {
    await signIn(page);
    await mockSheet(page, SHEET);
    await generate(page);

    const results = page.getByTestId('collection-sheet-results');
    await expect(results).toBeVisible();

    // The group and its officer, as Fineract groups the clients.
    await expect(results).toContainText('Mahila Mandal A');
    await expect(results).toContainText('Officer, Field');

    // One row per account, with the platform's own total for each.
    const loanRow = page.getByRole('row', { name: /000000101/ });
    await expect(loanRow).toContainText('Asha Kumar');
    await expect(loanRow).toContainText('JLG1');
    await expect(loanRow).toContainText('950.00');

    const savingsRow = page.getByRole('row', { name: /000000055/ });
    await expect(savingsRow).toContainText('Group Savings');
    await expect(savingsRow).toContainText('50.00');

    // What this issue was filed about: a debugging view, not a sheet.
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('totals the group and the sheet', async ({ page }) => {
    await signIn(page);
    await mockSheet(page, SHEET);
    await generate(page);

    await expect(page.getByTestId('group-total-7')).toContainText('1,000.00');
    await expect(page.getByTestId('collection-sheet-total')).toContainText('1,000.00');
  });

  test('keeps a client with nothing due on the sheet', async ({ page }) => {
    await signIn(page);
    await mockSheet(page, SHEET);
    await generate(page);

    // The officer has to see who was expected at the meeting, not only who owes.
    await expect(page.getByRole('row', { name: /Bimla Devi/ })).toBeVisible();
  });

  test('still reports an empty sheet as nothing due', async ({ page }) => {
    await signIn(page);
    await mockSheet(page, null);
    await generate(page);

    await expect(page.getByTestId('collection-sheet-empty')).toBeVisible();
    await expect(page.getByTestId('collection-sheet-results')).toHaveCount(0);
  });
});
