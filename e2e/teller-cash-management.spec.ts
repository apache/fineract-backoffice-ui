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
 * Teller cash management against a real Fineract.
 *
 * Everything is driven through the UI, including the accounting configuration the platform
 * requires before a cashier may hold cash — that configuration is part of what an operator has
 * to do, so a test that seeded it through the API would not prove the feature is reachable.
 *
 *   npx playwright test e2e/teller-cash-management.spec.ts --project=backend --workers=1
 */

import { test, expect, Page, recordingTimeout } from './fixtures';
import { login, uniqueSuffix } from './utils/fineract-login';
import { selectOption } from './utils/select-option';

const HEAD_OFFICE = 'Head Office';

/**
 * Filters a list down to `term` and returns the matching row.
 *
 * The tellers list paginates at ten rows and this suite adds one per run, so a freshly created
 * teller stops being on the first page almost immediately. Searching for it keeps the test
 * independent of how much the database has accumulated. `localLogic` means the table filters
 * rows it already holds, so this reaches entries beyond the visible page.
 *
 * The searchbar's real `<input>` lives in Ionic's shadow DOM; the `data-testid` sits on the
 * host, which cannot be filled directly.
 */
async function findRow(page: Page, term: string) {
  await page.locator('ion-searchbar[data-testid="search-filter-input"] input').fill(term);
  const row = page.getByRole('row', { name: new RegExp(term) }).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  return row;
}

/**
 * Ensures the two financial-activity mappings the platform demands before a cashier can
 * transact, creating them only when absent.
 *
 * `POST /tellers/{id}/cashiers/{id}/allocate` answers 404 —
 * "Financial Activity account with for the financial Activity with Id 101 does not exist" —
 * until both **Cash at Main Vault (101)** and **Cash at Teller (102)** are mapped to GL
 * accounts. The message names the activity by id and says nothing about tellers, so the
 * prerequisite is easy to mistake for a bug in the allocation itself.
 *
 * Mappings are singletons per activity: creating one that already exists is rejected. The run
 * therefore has to be idempotent, because the suite runs repeatedly against the same database.
 */
async function ensureCashMappings(page: Page): Promise<void> {
  // Decided from the response the page itself fetches, not from the rendered table. The table
  // shows "No records found." while the request is still in flight, so reading the DOM makes
  // "not configured yet" and "not loaded yet" the same observation — and the setup then tries to
  // create mappings that already exist, which the platform rejects.
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/financialactivityaccounts') && r.request().method() === 'GET',
      { timeout: 30000 },
    ),
    page.goto('/accounting/financial-activity-mappings'),
  ]);

  const mapped = (await response.json()) as { financialActivityData?: { id?: number } }[];
  const mappedIds = new Set((mapped ?? []).map((entry) => entry.financialActivityData?.id));

  const CASH_AT_MAIN_VAULT = 101;
  const CASH_AT_TELLER = 102;
  const needed: { activity: string; label: string }[] = [];
  if (!mappedIds.has(CASH_AT_MAIN_VAULT)) {
    needed.push({ activity: 'cashAtMainVault', label: 'Vault' });
  }
  if (!mappedIds.has(CASH_AT_TELLER)) {
    needed.push({ activity: 'cashAtTeller', label: 'Teller' });
  }

  for (const item of needed) {
    // A mapping needs a GL account to point at, and the account must be an ASSET the platform
    // will accept for a detail posting.
    //
    // Named per run rather than with a fixed code. A GL code is unique platform-wide, so a fixed
    // one turns any failure after the account is created — but before its mapping is — into a
    // permanent one: the next run finds the mapping still absent, tries to create the account
    // again, and is refused for a duplicate code before it ever reaches the mapping.
    const suffix = uniqueSuffix();
    const account = `E2E ${item.label} Cash ${suffix}`;
    const code = `E2E-${item.label.toUpperCase()}-${suffix}`;

    await page.goto('/accounting/chart-of-accounts/create');
    await page.locator('input[name="name"]').fill(account);
    await page.locator('input[name="glCode"]').fill(code);
    await selectOption(page, 'Account Type', 'Asset');
    await selectOption(page, 'Account Usage', 'Detail');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page).toHaveURL(/\/accounting\/chart-of-accounts$/, { timeout: 20000 });

    await page.goto('/accounting/financial-activity-mappings/create');
    await selectOption(page, 'Financial Activity', item.activity);
    await selectOption(page, 'GL Account', `${account} (${code})`);
    // "Define", not "Save": this form names its submit for the action rather than the verb the
    // rest of the app uses, and an unmatched name times the click out rather than failing fast.
    await page.getByRole('button', { name: /^define$/i }).click();
    await expect(page).toHaveURL(/\/accounting\/financial-activity-mappings$/, { timeout: 20000 });
  }
}

test.describe('Teller cash management', () => {
  test('a cashier is listed, receives an allocation, and settles cash back', async ({ page }) => {
    test.setTimeout(recordingTimeout(240000));
    await login(page);
    await ensureCashMappings(page);

    const suffix = uniqueSuffix();
    const staffLast = `Cashier${suffix}`;
    const tellerName = `Teller${suffix}`;

    // A fresh staff member every run, deliberately. Fineract refuses to allocate a cashier whose
    // date range overlaps one they already hold — on any teller, not just this one — so reusing
    // an existing employee makes the test pass once and fail on every later run.
    await page.goto('/organization/staff/create');
    await selectOption(page, 'Office', HEAD_OFFICE);
    await page.locator('input[name="firstname"]').fill('E2E');
    await page.locator('input[name="lastname"]').fill(staffLast);
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page).toHaveURL(/\/organization\/staff$/, { timeout: 20000 });

    await page.goto('/tellers/create');
    await page.locator('input[name="name"]').fill(tellerName);
    await selectOption(page, 'Office', HEAD_OFFICE);
    await selectOption(page, 'Status', 'Active');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page).toHaveURL(/\/tellers$/, { timeout: 20000 });

    // Reach the cashiers through the teller row, the way a user does.
    const tellerRow = await findRow(page, tellerName);
    await tellerRow.locator('ion-button[data-testid^="manage-cashiers-btn-"]').click();
    await expect(page).toHaveURL(/\/tellers\/\d+\/cashiers$/, { timeout: 20000 });

    await page.getByRole('button', { name: /allocate cashier/i }).click();
    await expect(page).toHaveURL(/\/tellers\/\d+\/cashiers\/create$/, { timeout: 20000 });
    // Fineract renders a staff member as "lastname, firstname".
    await selectOption(page, 'Staff Member', `${staffLast}, E2E`);
    await page.locator('ion-button[data-testid="cashier-submit-btn"]').click();
    await expect(page).toHaveURL(/\/tellers\/\d+\/cashiers$/, { timeout: 20000 });

    // The cashier must actually appear. The list used to read the top-level /cashiers
    // collection, which answers 204 for every query, so it rendered empty however many
    // cashiers existed — and an empty list looks exactly like a teller with none.
    const cashierRow = page.getByRole('row', { name: new RegExp(staffLast) }).first();
    await expect(cashierRow).toBeVisible({ timeout: 20000 });

    await cashierRow.locator('ion-button[data-testid^="cashier-transactions-btn-"]').click();
    await expect(page).toHaveURL(/\/tellers\/\d+\/cashiers\/\d+\/transactions$/, {
      timeout: 20000,
    });
    await expect(page.getByTestId('cashier-sum-allocated')).toHaveText('0', { timeout: 20000 });

    // Allocate.
    await page.getByTestId('cashier-allocate-btn').click();
    await expect(page).toHaveURL(/\/transactions\/allocate$/, { timeout: 20000 });
    await expect(page.getByTestId('cashier-txn-title')).toContainText(/allocate/i);
    await page.locator('input[name="txnAmount"]').fill('5000');
    await page.locator('textarea[name="txnNote"]').fill('Opening float');
    const [allocateResponse] = await Promise.all([
      page.waitForResponse(
        (r) => /\/cashiers\/\d+\/allocate$/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 30000 },
      ),
      page.locator('ion-button[data-testid="cashier-txn-submit-btn"]').click(),
    ]);
    expect(allocateResponse.status()).toBe(200);

    await expect(page).toHaveURL(/\/transactions$/, { timeout: 30000 });
    // Proves the summary was requested with a currencyCode: without one the endpoint answers
    // 200 with every total at zero, so this would still read '0' after a real allocation.
    await expect(page.getByTestId('cashier-sum-allocated')).toHaveText('5000', { timeout: 20000 });
    await expect(page.getByTestId('cashier-net-cash')).toHaveText('5000');
    await expect(page.getByRole('row', { name: /Allocate Cash/ }).first()).toBeVisible();

    // Settle part of it back.
    await page.getByTestId('cashier-settle-btn').click();
    await expect(page).toHaveURL(/\/transactions\/settle$/, { timeout: 20000 });
    await expect(page.getByTestId('cashier-txn-title')).toContainText(/settle/i);
    await page.locator('input[name="txnAmount"]').fill('1200');
    await page.locator('textarea[name="txnNote"]').fill('Returned to vault');

    // Asserted on the response rather than on the rendered total, deliberately.
    //
    // `GET .../summaryandtransactions` does not report a settlement reliably on this platform
    // build: the same sequence — allocate then settle, same cashier, same amounts — sometimes
    // returns `sumCashSettlement: 1200` with both rows, and sometimes `0` with the allocation
    // alone. It is not the transaction date, the cashier's date range, or the balance; the
    // settlement is created either way and `POST .../settle` answers 200 with a `subResourceId`
    // every time. The same endpoint also answers for a cashier id paired with the wrong teller
    // id in the path, so it appears to key on the cashier alone.
    //
    // Asserting the total here would make this suite fail intermittently for a platform
    // behaviour the UI does not control. What the UI is responsible for — sending the command
    // and having it accepted — is what is checked.
    const [settleResponse] = await Promise.all([
      page.waitForResponse(
        (r) => /\/cashiers\/\d+\/settle$/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 30000 },
      ),
      page.locator('ion-button[data-testid="cashier-txn-submit-btn"]').click(),
    ]);
    expect(settleResponse.status()).toBe(200);
    await expect(page).toHaveURL(/\/transactions$/, { timeout: 30000 });
  });

  test('settling more than the cashier holds is refused and the form stays usable', async ({
    page,
  }) => {
    test.setTimeout(recordingTimeout(240000));
    await login(page);
    await ensureCashMappings(page);

    const suffix = uniqueSuffix();
    const staffLast = `Short${suffix}`;
    const tellerName = `ShortTeller${suffix}`;

    await page.goto('/organization/staff/create');
    await selectOption(page, 'Office', HEAD_OFFICE);
    await page.locator('input[name="firstname"]').fill('E2E');
    await page.locator('input[name="lastname"]').fill(staffLast);
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page).toHaveURL(/\/organization\/staff$/, { timeout: 20000 });

    await page.goto('/tellers/create');
    await page.locator('input[name="name"]').fill(tellerName);
    await selectOption(page, 'Office', HEAD_OFFICE);
    await selectOption(page, 'Status', 'Active');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page).toHaveURL(/\/tellers$/, { timeout: 20000 });

    const tellerRow = await findRow(page, tellerName);
    await tellerRow.locator('ion-button[data-testid^="manage-cashiers-btn-"]').click();
    await page.getByRole('button', { name: /allocate cashier/i }).click();
    // Fineract renders a staff member as "lastname, firstname".
    await selectOption(page, 'Staff Member', `${staffLast}, E2E`);
    await page.locator('ion-button[data-testid="cashier-submit-btn"]').click();

    const cashierRow = page.getByRole('row', { name: new RegExp(staffLast) }).first();
    await expect(cashierRow).toBeVisible({ timeout: 20000 });
    await cashierRow.locator('ion-button[data-testid^="cashier-transactions-btn-"]').click();

    // Nothing has been allocated, so any settlement exceeds the balance.
    await page.getByTestId('cashier-settle-btn').click();
    await expect(page).toHaveURL(/\/transactions\/settle$/, { timeout: 20000 });
    await page.locator('input[name="txnAmount"]').fill('50');
    await page.locator('ion-button[data-testid="cashier-txn-submit-btn"]').click();

    // The platform rejects it. The user must stay on the form with the button live again,
    // rather than being navigated away as though the settlement had been recorded.
    await expect(page).toHaveURL(/\/transactions\/settle$/, { timeout: 20000 });
    await expect(page.locator('ion-button[data-testid="cashier-txn-submit-btn"]')).toBeEnabled({
      timeout: 20000,
    });
  });
});
