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
 * The generated collection sheet: rendering it, and recording what was collected on it (#670).
 *
 * This is mocked on purpose, and it is the only way either half can be covered: the backend spec
 * beside it (`collection-sheet.spec.ts`) exercises the real endpoint, which answers 200 with an
 * empty body unless a group meeting falls on the date — so a real instance proves the empty case
 * and can say nothing about the populated one. The payload below is shaped after Fineract's own
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
              // A display phrase, not the enum id the save command takes — see the save cases.
              depositAccountType: 'Saving Deposit',
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

/**
 * Answers the filters and the sheet, and collects the bodies of any `command=save`.
 *
 * The returned array is how the save cases assert on the request that left the browser, which
 * is where the `officeId` the platform refuses came from.
 */
async function mockSheet(page: Page, sheet: unknown): Promise<Record<string, unknown>[]> {
  const saved: Record<string, unknown>[] = [];
  await page.route('**/api/v1/offices**', (route) =>
    route.fulfill({ json: [{ id: 1, name: 'Head Office' }] }),
  );
  await page.route(/\/api\/v1\/staff/, (route) =>
    route.fulfill({ json: [{ id: 4, displayName: 'Officer, Field' }] }),
  );
  await page.route(/\/api\/v1\/collectionsheet/, (route) => {
    if (route.request().url().includes('command=save')) {
      saved.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({ json: { officeId: 1, resourceId: 7 } });
    }
    return route.fulfill({ json: sheet });
  });
  return saved;
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

/**
 * The other half of #670: the sheet showed what was owed, and Save posted the generate filters.
 *
 * The filters are what makes these worth asserting on the request rather than the screen.
 * `command=save` routes to Fineract's `saveIndividualCollectionSheet`, whose validator runs
 * `checkForUnsupportedParameters` against a set holding neither `officeId` nor `staffId`, so the
 * save was refused outright — the button could not have worked.
 */
test.describe('Recording collections', () => {
  /** The inner native input: ion-input re-emits its events, and the host has no value to fill. */
  const amount = (page: Page, testId: string) => page.getByTestId(testId).locator('input');

  async function openSheet(page: Page, sheet: unknown = SHEET) {
    await signIn(page);
    const saved = await mockSheet(page, sheet);
    await generate(page);
    await expect(page.getByTestId('collection-sheet-results')).toBeVisible();
    return saved;
  }

  async function save(page: Page, saved: Record<string, unknown>[]) {
    await page.getByRole('button', { name: /Save Collection Sheet/i }).click();
    await expect.poll(() => saved.length).toBe(1);
    return saved[0];
  }

  test('seeds each box with what is due, which is what is usually paid', async ({ page }) => {
    await openSheet(page);

    await expect(amount(page, 'collect-loan-101')).toHaveValue('950');
    await expect(amount(page, 'collect-savings-55')).toHaveValue('50');
    await expect(page.getByTestId('group-collected-7')).toHaveText('1,000.00');
  });

  test('posts what the operator entered, and no filters with it', async ({ page }) => {
    const saved = await openSheet(page);
    await amount(page, 'collect-loan-101').fill('400');
    await expect(page.getByTestId('group-collected-7')).toHaveText('450.00');

    const body = await save(page, saved);
    // 400, not the 950 the sheet asked for: what is posted is the officer's figure.
    expect(body['bulkRepaymentTransactions']).toEqual([{ loanId: 101, transactionAmount: 400 }]);
    // 'Saving Deposit' resolved to the DepositAccountType id the save command takes.
    expect(body['bulkSavingsDueTransactions']).toEqual([
      { savingsId: 55, transactionAmount: 50, depositAccountType: 100 },
    ]);
    expect(body).not.toHaveProperty('officeId');
    expect(body).not.toHaveProperty('staffId');
  });

  test('leaves out an account nobody paid', async ({ page }) => {
    const saved = await openSheet(page);
    await amount(page, 'collect-loan-101').fill('0');
    await amount(page, 'collect-savings-55').fill('0');

    const body = await save(page, saved);
    expect(body['bulkRepaymentTransactions']).toEqual([]);
    expect(body['bulkSavingsDueTransactions']).toEqual([]);
  });

  /**
   * 'Current Deposit' is the `ELSE` of the platform's own CASE expression, so it covers
   * FIXED_DEPOSIT and CURRENT_DEPOSIT alike and names neither. A deposit posted without a type
   * is accepted and then silently does nothing, so there is nothing to type here.
   */
  test('offers no box for a savings account whose deposit type is ambiguous', async ({ page }) => {
    const ambiguous = structuredClone(SHEET);
    ambiguous.groups[0].clients[0].savings[0].depositAccountType = 'Current Deposit';
    await openSheet(page, ambiguous);

    await expect(page.getByTestId('collect-savings-55')).toHaveCount(0);
    await expect(page.getByTestId('collect-savings-blocked-55')).toBeVisible();
    // The amount due is still on the sheet: the officer has to see what the client owes even
    // where this screen cannot record the payment.
    await expect(page.getByRole('row', { name: /000000055/ })).toContainText('50.00');
  });

  test('clears what was entered when the operator goes back to the filters', async ({ page }) => {
    await openSheet(page);
    await amount(page, 'collect-loan-101').fill('400');

    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: /generate/i }).click();

    await expect(amount(page, 'collect-loan-101')).toHaveValue('950');
  });
});
