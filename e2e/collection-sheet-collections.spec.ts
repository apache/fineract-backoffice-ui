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
 * Recording collections on a populated collection sheet.
 *
 * Mocked rather than driven against a real Fineract, and that is forced rather than preferred:
 * `POST /collectionsheet?command=generate` answers 200 with an empty body unless a group has a
 * meeting calendar with repayments falling on the meeting date, and no instance in CI has one.
 * `collection-sheet.spec.ts` covers the filter and the empty answer against the real platform;
 * this covers the half that only exists once a sheet comes back populated.
 *
 * What it holds the screen to, all of it about the request that leaves the browser:
 *
 *   1. Each box is seeded with what is due, since that is what is usually paid.
 *   2. What the operator types is what gets posted, not what was due.
 *   3. The save carries no `officeId` or `staffId`. `command=save` routes to Fineract's
 *      `saveIndividualCollectionSheet`, whose validator runs `checkForUnsupportedParameters`
 *      against a set holding neither, so a save that carried the generate filters was refused
 *      outright — the screen's Save button could not have worked (#670).
 *   4. A savings row whose deposit type the sheet reports as 'Current Deposit' offers no box at
 *      all: that label is the `ELSE` of the platform's own CASE expression and covers two
 *      account types, and a deposit posted without a type is accepted and then silently does
 *      nothing.
 */

import { expect, test, type Page } from './fixtures';
import { selectOption } from './utils/select-option';

/**
 * A sheet as `JLGCollectionSheetData` → `LoanDueData` / `SavingsDueData` carry it, including
 * `depositAccountType` as the phrase the platform's SQL builds rather than the enum id its save
 * command wants.
 */
const SHEET = {
  dueDate: [2026, 10, 15],
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
              interestDue: 150,
              totalDue: 950,
            },
          ],
          savings: [
            {
              savingsId: 55,
              accountId: '000000055',
              productName: 'Group Savings',
              currency: { code: 'INR' },
              dueAmount: 50,
              depositAccountType: 'Saving Deposit',
            },
            {
              savingsId: 56,
              accountId: '000000056',
              productName: 'Fixed Deposit',
              currency: { code: 'INR' },
              dueAmount: 60,
              depositAccountType: 'Current Deposit',
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

test.describe('Collection Sheet collections', () => {
  /** Bodies of every `command=save` request, in the order they went out. */
  let saved: Record<string, unknown>[];

  test.beforeEach(async ({ page }) => {
    saved = [];
    await signIn(page);

    await page.route('**/api/v1/offices**', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: [{ id: 1, name: 'Head Office' }] })
        : route.fallback(),
    );
    await page.route('**/api/v1/staff**', (route) =>
      route.fulfill({ json: [{ id: 4, displayName: 'Officer, Field' }] }),
    );
    await page.route('**/api/v1/collectionsheet**', (route) => {
      const url = route.request().url();
      if (url.includes('command=save')) {
        saved.push(route.request().postDataJSON() as Record<string, unknown>);
        return route.fulfill({ json: { officeId: 1, resourceId: 7 } });
      }
      return route.fulfill({ json: SHEET });
    });

    await page.goto('/collection-sheet');
    await selectOption(page, 'Office', 'Head Office');
    await page.getByRole('button', { name: 'Generate' }).click();
    await expect(page.getByTestId('collection-sheet-results')).toBeVisible();
  });

  /** The inner native input: ion-input re-emits its events, and the host has no value to fill. */
  function amountBox(page: Page, testId: string) {
    return page.getByTestId(testId).locator('input');
  }

  test('seeds every box with what is due and totals what would be collected', async ({ page }) => {
    await expect(amountBox(page, 'collect-loan-101')).toHaveValue('950');
    await expect(amountBox(page, 'collect-savings-55')).toHaveValue('50');

    // 950 + 50. The 60 due on account 56 is not in it: that row cannot be posted at all.
    await expect(page.getByTestId('group-collected-7')).toHaveText('1,000.00');
    await expect(page.getByTestId('collection-sheet-collected-total')).toContainText('1,000.00');
    await expect(page.getByTestId('collection-sheet-total')).toContainText('1,060.00');
  });

  test('posts what the operator entered, and no filters with it', async ({ page }) => {
    await amountBox(page, 'collect-loan-101').fill('400');
    await amountBox(page, 'collect-savings-55').fill('50');
    await expect(page.getByTestId('group-collected-7')).toHaveText('450.00');

    await page.getByRole('button', { name: /Save Collection Sheet/i }).click();
    await expect.poll(() => saved.length).toBe(1);

    const body = saved[0];
    // 400, not the 950 the sheet asked for: the amounts posted are the officer's, not the
    // platform's.
    expect(body['bulkRepaymentTransactions']).toEqual([{ loanId: 101, transactionAmount: 400 }]);
    expect(body['bulkSavingsDueTransactions']).toEqual([
      { savingsId: 55, transactionAmount: 50, depositAccountType: 100 },
    ]);
    expect(body).not.toHaveProperty('officeId');
    expect(body).not.toHaveProperty('staffId');
  });

  test('leaves out an account nobody paid', async ({ page }) => {
    await amountBox(page, 'collect-loan-101').fill('0');
    await amountBox(page, 'collect-savings-55').fill('0');

    await page.getByRole('button', { name: /Save Collection Sheet/i }).click();
    await expect.poll(() => saved.length).toBe(1);

    expect(saved[0]['bulkRepaymentTransactions']).toEqual([]);
    expect(saved[0]['bulkSavingsDueTransactions']).toEqual([]);
  });

  test('offers no box for a savings account whose deposit type is ambiguous', async ({ page }) => {
    await expect(page.getByTestId('collect-savings-56')).toHaveCount(0);
    await expect(page.getByTestId('collect-savings-blocked-56')).toBeVisible();
    // Its due amount is still on the sheet: the officer has to see what the client owes even
    // where this screen cannot record the payment.
    const sheet = page.getByTestId('collection-sheet-results');
    await expect(sheet.getByRole('cell', { name: 'Fixed Deposit', exact: true })).toBeVisible();
    await expect(sheet.getByRole('cell', { name: '60.00', exact: true })).toBeVisible();
  });

  test('clears what was entered when the operator goes back to the filters', async ({ page }) => {
    await amountBox(page, 'collect-loan-101').fill('400');
    await page.getByRole('button', { name: 'Back' }).click();

    await page.getByRole('button', { name: 'Generate' }).click();
    await expect(amountBox(page, 'collect-loan-101')).toHaveValue('950');
  });
});
