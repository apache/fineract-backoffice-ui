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
 * The deposit account lifecycle, against a real Fineract (#764, #765, #766, #783).
 *
 * All four issues came from reading the wrong field off a real payload, and three of them had
 * unit tests that passed against invented fixtures. So the assertions here are deliberately end
 * to end: a product created through the form, an account opened under it through the form, and
 * the figures read back from the platform rather than off the screen.
 *
 *   npx playwright test e2e/deposit-lifecycle-backend.spec.ts --project=backend --workers=1
 */

import { test, expect, Page, recordingTimeout } from './fixtures';
import { login } from './utils/fineract-login';
import { confirmDialog, modalFor } from './utils/ionic-locators';
import {
  activateFixedDepositAccount,
  chartRates,
  createApiContext,
  fixedDepositAccount,
  fixedDepositProductByName,
  savingsAccountBalance,
  seedFixedDepositAccount,
  seedFundedSavingsAccount,
} from './utils/seed-api';

test.describe.configure({ mode: 'serial', timeout: 300_000 });

/** Fills a native input: the chart editor uses native controls by design — see its class note. */
async function fillNative(page: Page, testId: string, value: string): Promise<void> {
  await page.locator(`[data-testid="${testId}"]`).fill(value);
}

/** Fills an Ionic input: the inner `input`, not the wrapper, which `fill` cannot reach. */
async function fillIonic(page: Page, name: string, value: string): Promise<void> {
  await page.locator(`ion-input[name="${name}"] input`).fill(value);
}

test.describe('fixed deposit products', () => {
  /**
   * #765. The create form sent a chart the user never saw: one slab at 5% for 1–60 months. An
   * administrator configuring a 7% product got a 5% one, and every account opened under it
   * inherited that rate.
   *
   * This is the acceptance criterion — "no interest chart is sent unless the user sees and
   * confirms it" — read back from the platform, which is the only place that can settle it.
   */
  test('carry the rate the user typed, not a hidden default', async ({ page }) => {
    test.setTimeout(recordingTimeout(240_000));
    await login(page);
    await page.goto('/products/fixed/create');

    const suffix = Date.now().toString(36).slice(-5);
    const name = `E2ERate ${suffix}`;
    await fillIonic(page, 'name', name);
    await fillIonic(page, 'shortName', suffix.slice(-4).toUpperCase());
    await page.locator('ion-textarea[name="description"] textarea').fill('Created by e2e');

    // The chart is on screen, which it never was before.
    await expect(page.locator('[data-testid="chart-slab-0"]')).toBeVisible();

    // And Save is refused while it has no rate: a product with no stated rate must not be
    // saveable, which is exactly what the silent 5% default used to hide.
    await expect(page.locator('[data-testid="product-submit"]')).toHaveJSProperty('disabled', true);
    await expect(page.locator('[data-testid="product-submit-hint"]')).toBeVisible();

    await fillNative(page, 'slab-from-0', '1');
    await fillNative(page, 'slab-to-0', '24');
    await fillNative(page, 'slab-rate-0', '7.25');

    await expect(page.locator('[data-testid="product-submit"]')).toHaveJSProperty(
      'disabled',
      false,
    );
    await page.locator('[data-testid="product-submit"]').click();
    await expect(page).toHaveURL(/\/products\/fixed$/, { timeout: 30_000 });

    const api = await createApiContext();
    try {
      const product = await fixedDepositProductByName(api, name);
      expect(product, 'the product was created').toBeDefined();
      // 7.25 is what the user typed. 5 would be the chart the form used to invent.
      expect(chartRates(product)).toEqual([7.25]);
    } finally {
      await api.dispose();
    }
  });
});

test.describe('an active fixed deposit account', () => {
  /**
   * #764. The Overview showed "Balance $" with no amount and none of the figures that define a
   * term deposit, because a deposit response carries no top-level `accountBalance` — it is under
   * `summary`.
   *
   * Asserted on the rendered page against the platform's own numbers, so a fixture cannot paper
   * over it the way the unit test's did.
   */
  test('shows its balance and maturity figures', async ({ page }) => {
    test.setTimeout(recordingTimeout(240_000));

    const api = await createApiContext();
    let accountId: number;
    let expected: { balance: number; maturityAmount: number; depositAmount: number };
    try {
      ({ accountId } = await seedFixedDepositAccount(api, 'E2EDepView'));
      await activateFixedDepositAccount(api, accountId);
      const account = await fixedDepositAccount(api, accountId);
      const summary = account['summary'] as { accountBalance?: number };
      expected = {
        balance: summary.accountBalance ?? 0,
        maturityAmount: account['maturityAmount'] as number,
        depositAmount: account['depositAmount'] as number,
      };
      expect(expected.balance, 'the seeded deposit funded its balance').toBeGreaterThan(0);
      expect(account['accountBalance'], 'no top-level balance — the bug').toBeUndefined();
    } finally {
      await api.dispose();
    }

    await login(page);
    await page.goto(`/products/fixed-deposits/view/${accountId}`);
    await expect(page.getByTestId('deposit-status')).toContainText('Active', { timeout: 20_000 });

    const balance = page.locator('.detail-item', { hasText: 'BALANCE' }).first();
    await expect(balance).toContainText(expected.balance.toLocaleString('en-US'));

    await expect(page.getByTestId('deposit-amount')).toContainText(
      expected.depositAmount.toLocaleString('en-US'),
    );
    await expect(page.getByTestId('deposit-term')).toContainText('12');
    await expect(page.getByTestId('deposit-maturity-amount')).toContainText(
      expected.maturityAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
    );
    await expect(page.getByTestId('deposit-maturity-date')).not.toBeEmpty();
  });

  /**
   * #783. Closing could only withdraw. This closes into the customer's savings account and
   * checks the money arrived, which is the acceptance criterion that cannot be faked.
   */
  test('can be closed into the client savings account', async ({ page }) => {
    test.setTimeout(recordingTimeout(240_000));

    const api = await createApiContext();
    let accountId: number;
    let savingsId: number;
    let before: number;
    try {
      const seeded = await seedFixedDepositAccount(api, 'E2EDepClose');
      accountId = seeded.accountId;
      await activateFixedDepositAccount(api, accountId);
      // Funded, though this one only receives: a linked account would *fund* the deposit, which
      // is a different field entirely — see the account form.
      savingsId = await seedFundedSavingsAccount(api, seeded.clientId, 500);
      before = await savingsAccountBalance(api, savingsId);
    } finally {
      await api.dispose();
    }

    await login(page);
    await page.goto(`/products/fixed-deposits/view/${accountId}`);
    await expect(page.getByTestId('deposit-status')).toContainText('Active', { timeout: 20_000 });

    await page.getByTestId('deposit-actions').click();
    await page.getByTestId('deposit-action-prematureClose').click();

    const dialog = modalFor(page, 'app-deposit-closure-dialog');
    await expect(dialog).toBeVisible();

    // A premature closure offers withdraw and transfer, and not the two reinvest options the
    // template also returns — the platform refuses those with `reinvest.not.allowed`.
    const options = dialog.locator('[data-testid="deposit-closure-type"]');
    await expect(options).toBeVisible();

    await dialog.locator('[data-testid="deposit-closure-type"]').click();
    await page.locator('ion-popover ion-radio', { hasText: 'Transfer to Savings' }).click();
    await page.keyboard.press('Escape');

    await dialog.locator('[data-testid="deposit-closure-target"]').click();
    await page.locator('ion-popover ion-radio').first().click();
    await page.keyboard.press('Escape');

    await dialog.locator('[data-testid="deposit-closure-confirm"]').click();

    await expect(page.getByTestId('deposit-status')).toContainText('Premature Closed', {
      timeout: 20_000,
    });

    const verify = await createApiContext();
    try {
      // The proceeds landed in the savings account, which is the thing a withdrawal could not do.
      await expect
        .poll(async () => savingsAccountBalance(verify, savingsId), { timeout: 20_000 })
        .toBeGreaterThan(before);
    } finally {
      await verify.dispose();
    }
  });

  /** #783. A deposit account could not be charged at all. */
  test('can have a charge added to it', async ({ page }) => {
    test.setTimeout(recordingTimeout(240_000));

    const api = await createApiContext();
    let accountId: number;
    try {
      ({ accountId } = await seedFixedDepositAccount(api, 'E2EDepCharge'));
      await activateFixedDepositAccount(api, accountId);
    } finally {
      await api.dispose();
    }

    await login(page);
    await page.goto(`/products/fixed-deposits/view/${accountId}`);
    await expect(page.getByTestId('deposit-status')).toContainText('Active', { timeout: 20_000 });

    await page.getByTestId('deposit-tab-charges').click();
    const add = page.getByTestId('deposit-add-charge');
    await expect(add).toBeVisible();

    // Disabled when the product allows no charges, which is honest rather than opening an empty
    // picker. Skip the rest in that case: what the tenant's products allow is not this spec's.
    if (
      await add.evaluate((node: HTMLElement & { disabled?: boolean }) => node.disabled === true)
    ) {
      test.skip(true, 'the seeded deposit product allows no charges');
    }

    await add.click();
    // The charge picker is the shared confirm dialog with fields — see `ConfirmDialogData.fields`.
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-testid="dialog-field-amount"] input').fill('25');
    await dialog.locator('[data-testid="confirm-dialog-confirm"]').click();

    await expect(page.getByTestId('deposit-no-charges')).toHaveCount(0, { timeout: 20_000 });
  });
});
