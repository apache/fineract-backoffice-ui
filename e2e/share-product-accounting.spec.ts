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
 * Share product accounting, end to end against a real Fineract.
 *
 * The form pinned `accountingRule: 1` on both create and load, so every share product this
 * application made was unaccounted and editing an accounted one reset it. Share capital is the
 * members' stake in the institution — the one balance-sheet line that cannot be reconstructed
 * after the fact.
 *
 * Two things here are specific to share products and are why this is a separate suite:
 *
 * - `shareEquityId` is the only **equity** slot in the application, and the share template omits
 *   `equityAccountOptions` entirely until the tenant holds an equity account. The equity account
 *   is therefore created through the chart of accounts first, like the other three.
 * - The share template carries no `accountingRuleOptions`, so the rule selector is the one in the
 *   application whose options the form supplies rather than the platform.
 *
 *   npx playwright test e2e/share-product-accounting.spec.ts --project=backend --workers=1
 */

import { test, expect, Page, recordingTimeout } from './fixtures';
import { login, uniqueSuffix } from './utils/fineract-login';
import { captureJson } from './utils/capture-response';
import { selectOption } from './utils/select-option';

/**
 * The four slots cash accounting requires on a share product, and the class each draws from.
 *
 * From the platform, not from documentation: posting a share product with `accountingRule: 2`
 * and no mappings answers 400 naming exactly these four.
 */
const CASH_SLOTS = [
  { label: 'Share Reference', accountClass: 'Asset' },
  { label: 'Share Suspense Control', accountClass: 'Liability' },
  { label: 'Share Equity', accountClass: 'Equity' },
  { label: 'Income from fees', accountClass: 'Income' },
] as const;

const ACCOUNT_CLASSES = ['Asset', 'Liability', 'Equity', 'Income'] as const;

/** Creates one GL account through the chart of accounts and returns its display name. */
async function createGlAccount(page: Page, type: string, suffix: string): Promise<string> {
  const name = `E2E ${type} ${suffix}`;
  const glCode = `E2E-${type.toUpperCase()}-${suffix}`;

  await page.goto('/accounting/chart-of-accounts/create');
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="glCode"]').fill(glCode);
  await selectOption(page, 'Account Type', type);
  await selectOption(page, 'Account Usage', 'Detail');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page).toHaveURL(/\/accounting\/chart-of-accounts$/, { timeout: 20000 });

  return `${glCode} — ${name}`;
}

test.describe('Share product accounting', () => {
  test.describe.configure({ mode: 'serial' });

  test('a share product is mapped to equity and round-trips on edit', async ({ page }) => {
    test.setTimeout(recordingTimeout(480000));
    await login(page);

    const suffix = uniqueSuffix();

    const accounts: Record<string, string> = {};
    for (const type of ACCOUNT_CLASSES) {
      accounts[type] = await createGlAccount(page, type, suffix);
    }

    // --- Create -------------------------------------------------------------------------------
    const productName = `E2E Share Acc ${suffix}`;
    const shortName = suffix.slice(-4).toUpperCase();

    await page.goto('/products/share/create');
    await expect(page.getByTestId('product-accounting-rule')).toBeVisible({ timeout: 20000 });

    await page.locator('input[name="name"]').fill(productName);
    await page.locator('input[name="shortName"]').fill(shortName);
    // Mandatory on the platform even though the form does not mark it so — a share product
    // posted without one is refused with validation.msg.shareproduct.description.cannot.be.blank.
    await page.locator('textarea[name="description"]').fill('Seeded for accounting coverage');

    // Nothing accounting-related is on screen under the default rule.
    await expect(page.getByTestId('accounting-shareEquityId')).toHaveCount(0);

    // Accrual is deliberately absent: the platform accepts rule 3 on a share product, asks for no
    // mappings, and stores an empty mapping set — a product that looks configured and posts
    // nothing. Only the two rules that mean what they say are offered.
    await selectOption(page, 'Accounting rule', 'Cash');

    await expect(page.getByTestId('accounting-shareEquityId')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('accounting-group-equity')).toBeVisible();

    for (const slot of CASH_SLOTS) {
      await selectOption(page, slot.label, accounts[slot.accountClass]);
    }

    const created = await captureJson<{ resourceId: number }>(
      page,
      /\/products\/share$/,
      'POST',
      () => page.getByRole('button', { name: /^save$/i }).click(),
    );
    expect(created.resourceId).toBeGreaterThan(0);
    await expect(page).toHaveURL(/\/products\/share$/, { timeout: 20000 });

    // --- Edit must not blank the ledger -------------------------------------------------------
    //
    // This is the regression the issue is about: the rule was pinned to 1 on load, so opening a
    // configured share product and saving it silently unaccounted it.
    await page.goto(`/products/share/edit/${created.resourceId}`);
    await expect(page.getByTestId('product-accounting-rule')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('accounting-shareEquityId')).toContainText(accounts['Equity'], {
      timeout: 20000,
    });
    await expect(page.getByTestId('accounting-shareReferenceId')).toContainText(accounts['Asset']);

    await page.locator('input[name="name"]').fill(`${productName} v2`);
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page).toHaveURL(/\/products\/share$/, { timeout: 20000 });

    await page.goto(`/products/share/edit/${created.resourceId}`);
    await expect(page.getByTestId('accounting-shareEquityId')).toContainText(accounts['Equity'], {
      timeout: 20000,
    });
  });
});
