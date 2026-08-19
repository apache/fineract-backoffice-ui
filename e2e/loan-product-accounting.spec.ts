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
 * Product accounting, end to end against a real Fineract.
 *
 * This is the test that decides whether the feature works. Everything else — the unit specs, the
 * mocked runs — proves the form renders and posts a body; only a real platform proves the body is
 * one it accepts, and only the journal entries prove the product it created actually reaches the
 * general ledger.
 *
 * Driven entirely through the screens, including the four GL accounts. Seeding those through the
 * API would skip the one step an institution actually has to do first, and the chart of accounts
 * is where a tenant that cannot configure accounting gets stuck.
 *
 *   npx playwright test e2e/loan-product-accounting.spec.ts --project=backend --workers=1
 */

import { test, expect, Page, recordingTimeout } from './fixtures';
import { login, uniqueSuffix } from './utils/fineract-login';
import { captureJson } from './utils/capture-response';
import { ionSelect } from './utils/ionic-locators';
import { selectOption } from './utils/select-option';

/** The four account classes a cash-accounting loan product draws on. */
const ACCOUNT_CLASSES = [
  { type: 'Asset', label: 'Asset' },
  { type: 'Liability', label: 'Liability' },
  { type: 'Income', label: 'Income' },
  { type: 'Expense', label: 'Expense' },
] as const;

/**
 * The nine slots cash accounting requires, and the class each draws from.
 *
 * Not copied from documentation: posting a loan product with a rule and no mappings answers 400
 * naming every missing parameter, which is where this list comes from.
 */
const CASH_SLOTS = [
  { label: 'Fund source', accountClass: 'Asset' },
  { label: 'Loan portfolio', accountClass: 'Asset' },
  { label: 'Transfers in suspense', accountClass: 'Asset' },
  { label: 'Interest on loans', accountClass: 'Income' },
  { label: 'Income from fees', accountClass: 'Income' },
  { label: 'Income from penalties', accountClass: 'Income' },
  { label: 'Income from recovery repayments', accountClass: 'Income' },
  { label: 'Losses written off', accountClass: 'Expense' },
  { label: 'Overpayment liability', accountClass: 'Liability' },
] as const;

/** Creates one GL account through the chart of accounts and returns its display name. */
async function createGlAccount(page: Page, type: string, suffix: string): Promise<string> {
  const name = `E2E ${type} ${suffix}`;
  const glCode = `E2E-${type.toUpperCase()}-${suffix}`;

  await page.goto('/accounting/chart-of-accounts/create');
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="glCode"]').fill(glCode);
  await selectOption(page, 'Account Type', type);
  // Usage has no default and the form is invalid without it. Detail, not Header: only a detail
  // account can be posted to, and a product mapping is a posting instruction.
  await selectOption(page, 'Account Usage', 'Detail');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page).toHaveURL(/\/accounting\/chart-of-accounts$/, { timeout: 20000 });

  // The picker labels each option with its code, which is how an accountant reads a chart.
  return `${glCode} — ${name}`;
}

test.describe('Loan product accounting', () => {
  // A real shared backend, and each test creates a product and a loan. Serial, like the other
  // product-creating suites, so a pass does not overload it.
  test.describe.configure({ mode: 'serial' });

  test('a cash-accounting product is configured, round-trips on edit, and posts to the ledger', async ({
    page,
  }) => {
    test.setTimeout(recordingTimeout(480000));
    await login(page);

    const suffix = uniqueSuffix();

    // --- The institution's chart of accounts -------------------------------------------------
    //
    // A fresh tenant has none of these, and the product template omits an option list entirely
    // for a class with no accounts — which is what the section's empty-state note is about.
    const accounts: Record<string, string> = {};
    for (const { type } of ACCOUNT_CLASSES) {
      accounts[type] = await createGlAccount(page, type, suffix);
    }

    // --- A loan product that posts to the ledger ---------------------------------------------
    const productName = `E2E Accounting ${suffix}`;
    const shortName = suffix.slice(-4).toUpperCase();

    await page.goto('/products/loan/create');
    await expect(
      ionSelect(page, 'Repayment Strategy').locator('ion-select-option').first(),
    ).toBeAttached({ timeout: 20000 });

    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(productName);
    await page.getByRole('textbox', { name: 'Short Name' }).fill(shortName);
    await page.getByRole('spinbutton', { name: 'Principal' }).fill('1000');
    await page.getByRole('spinbutton', { name: 'Interest Rate' }).fill('10');
    await page.getByRole('spinbutton', { name: 'Number of Repayments' }).fill('3');
    await page.getByRole('spinbutton', { name: 'Repayment Every' }).fill('1');

    // Nothing accounting-related is on screen until a rule is chosen — the point of defaulting
    // to NONE is that an existing product form behaves exactly as it did.
    await expect(page.getByTestId('accounting-fundSourceAccountId')).toHaveCount(0);

    await selectOption(page, 'Accounting rule', 'CASH BASED');

    // The nine slots appear, grouped by account class, and no receivable does.
    await expect(page.getByTestId('accounting-fundSourceAccountId')).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByTestId('accounting-receivableInterestAccountId')).toHaveCount(0);
    await expect(page.getByTestId('accounting-group-asset')).toBeVisible();

    for (const slot of CASH_SLOTS) {
      await selectOption(page, slot.label, accounts[slot.accountClass]);
    }

    // --- One payment channel routed to its own fund source ------------------------------------
    //
    // Without this override every collection lands in the same fund source, and a till cannot be
    // reconciled at close of day. The two charge tables are not exercised here: this form has no
    // charge picker, so a product it creates carries none, and the tables correctly say so.
    await expect(page.getByTestId('payment-channel-add')).toBeVisible();
    await page.getByTestId('payment-channel-add').click();
    await page.getByTestId('payment-channel-type-0').click();
    await page.locator('ion-popover ion-radio, ion-popover ion-select-option').first().click();
    // Both this row and the base slot are labelled "Fund source", so the row is scoped by its
    // own test id rather than by the label text.
    await page.getByTestId('payment-channel-account-0').click();
    await page
      .locator('ion-popover ion-radio')
      .filter({ hasText: accounts['Asset'] })
      .first()
      .click();
    await page.keyboard.press('Escape');

    const created = await captureJson<{ resourceId: number }>(page, /\/loanproducts$/, 'POST', () =>
      page.getByRole('button', { name: /^save$/i }).click(),
    );
    await expect(page).toHaveURL(/\/products\/loan$/, { timeout: 20000 });
    const productId = created.resourceId;

    // --- Editing must not blank the ledger ---------------------------------------------------
    //
    // The failure mode this guards is silent: the form rebuilds its payload field by field, so a
    // mapping it does not read back is a mapping the next save drops.
    await page.goto(`/products/loan/edit/${productId}`);
    await expect(page.getByTestId('product-accounting-rule')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('accounting-fundSourceAccountId')).toContainText(
      accounts['Asset'],
      { timeout: 20000 },
    );
    await expect(page.getByTestId('accounting-overpaymentLiabilityAccountId')).toContainText(
      accounts['Liability'],
    );

    // Change one unrelated field and save.
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(`${productName} v2`);
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page).toHaveURL(/\/products\/loan$/, { timeout: 20000 });

    await page.goto(`/products/loan/edit/${productId}`);
    await expect(page.getByTestId('accounting-fundSourceAccountId')).toContainText(
      accounts['Asset'],
      { timeout: 20000 },
    );
  });
});
