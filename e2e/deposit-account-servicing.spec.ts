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
 * Operating a term deposit account, against a real Fineract.
 *
 * Before this, the screen these actions live on did not render at all: it fetched the account
 * through a service method that does not exist, threw out of `ngOnInit`, and left the whole
 * template — wrapped in `@if (account())` — empty. So this covers two things at once, that the
 * page loads and that the ten commands behind it are reachable and accepted.
 *
 * The commands disagree about their payloads in ways only a real platform reveals:
 * `undoapproval` refuses `locale` and `dateFormat`, and closing requires an `onAccountClosureId`
 * the account's own template enumerates. Mocks would have accepted any of it.
 *
 *   npx playwright test e2e/deposit-account-servicing.spec.ts --project=backend --workers=1
 */

import { test, expect, Page, recordingTimeout } from './fixtures';
import { login } from './utils/fineract-login';
import { confirmDialog, modalFor } from './utils/ionic-locators';
import { createApiContext, seedFixedDepositAccount } from './utils/seed-api';

/** Opens the account's detail screen and waits for it to have actually rendered. */
async function openAccount(page: Page, accountId: number): Promise<void> {
  await page.goto(`/products/fixed-deposits/view/${accountId}`);
  await expect(page.getByTestId('deposit-status')).toBeVisible({ timeout: 20000 });
}

/** Runs one confirm-only action from the actions menu. */
async function runAction(page: Page, action: string): Promise<void> {
  await page.getByTestId('deposit-actions').click();
  await page.getByTestId(`deposit-action-${action}`).click();
  await confirmDialog(page).getByTestId('confirm-dialog-confirm').click();
}

test.describe('Term deposit account servicing', () => {
  // A real shared backend, and each test seeds a product and an account.
  test.describe.configure({ mode: 'serial' });

  test('an account is approved, activated and closed before maturity', async ({ page }) => {
    test.setTimeout(recordingTimeout(240000));
    await login(page);

    const api = await createApiContext();
    let accountId: number;
    try {
      ({ accountId } = await seedFixedDepositAccount(api));
    } finally {
      await api.dispose();
    }

    await openAccount(page, accountId);
    await expect(page.getByTestId('deposit-status')).toContainText(
      'Submitted and pending approval',
    );

    // --- Approve, and undo it ----------------------------------------------------------------
    await runAction(page, 'approve');
    await expect(page.getByTestId('deposit-status')).toContainText('Approved', { timeout: 20000 });

    // `undoapproval` is the one command here that refuses `locale` and `dateFormat`, so this
    // step is what proves the payload is built per command rather than uniformly.
    await runAction(page, 'undoapproval');
    await expect(page.getByTestId('deposit-status')).toContainText(
      'Submitted and pending approval',
      {
        timeout: 20000,
      },
    );

    // --- Approve and activate ----------------------------------------------------------------
    await runAction(page, 'approve');
    await expect(page.getByTestId('deposit-status')).toContainText('Approved', { timeout: 20000 });

    await runAction(page, 'activate');
    await expect(page.getByTestId('deposit-status')).toContainText('Active', { timeout: 20000 });

    // The menu follows the status: approval actions are gone, servicing actions have appeared.
    await page.getByTestId('deposit-actions').click();
    await expect(page.getByTestId('deposit-action-approve')).toHaveCount(0);
    await expect(page.getByTestId('deposit-action-prematureClose')).toBeVisible();
    await page.keyboard.press('Escape');

    // --- Close before maturity ---------------------------------------------------------------
    await page.getByTestId('deposit-actions').click();
    await page.getByTestId('deposit-action-prematureClose').click();

    const closureDialog = modalFor(page, 'app-deposit-closure-dialog');
    await expect(closureDialog).toBeVisible();
    // Priced by the platform, not by the screen: `calculatePrematureAmount` is what a teller
    // would quote.
    await expect(closureDialog.getByTestId('deposit-premature-amount')).not.toContainText('—', {
      timeout: 20000,
    });
    await closureDialog.getByTestId('deposit-closure-confirm').click();

    await expect(page.getByTestId('deposit-status')).toContainText('Premature Closed', {
      timeout: 20000,
    });
  });

  /**
   * The transactions tab and its correction path.
   *
   * Two things here only a real platform settles. The tab used to read `transactions` off the
   * account response, which never carries that key — so it was empty on every account regardless
   * of activity, and a mocked fixture that returned the key would have hidden that. And a
   * reversal must leave the row on screen: Fineract marks it `reversed` rather than deleting it,
   * and a screen that dropped it would take the audit trail with it.
   */
  test('a deposit is recorded, listed, and reversed without leaving the list', async ({ page }) => {
    test.setTimeout(recordingTimeout(240000));
    await login(page);

    const api = await createApiContext();
    let accountId: number;
    try {
      ({ accountId } = await seedFixedDepositAccount(api, 'E2ETxn'));
    } finally {
      await api.dispose();
    }

    await openAccount(page, accountId);
    await runAction(page, 'approve');
    await expect(page.getByTestId('deposit-status')).toContainText('Approved', { timeout: 20000 });
    await runAction(page, 'activate');
    await expect(page.getByTestId('deposit-status')).toContainText('Active', { timeout: 20000 });

    // --- Record a deposit --------------------------------------------------------------------
    await page.getByTestId('deposit-actions').click();
    await page.getByTestId('deposit-action-deposit').click();

    await expect(page.getByTestId('fd-transaction-amount')).toBeVisible({ timeout: 20000 });
    await page.locator('ion-input[data-testid="fd-transaction-amount"] input').fill('250');
    await page.getByTestId('fd-transaction-save').click();

    // --- It appears on the tab ---------------------------------------------------------------
    await expect(page.getByTestId('deposit-status')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('deposit-tab-transactions').click();
    const undoButtons = page.locator('[data-testid^="deposit-tx-undo-"]');
    await expect(undoButtons.first()).toBeVisible({ timeout: 20000 });
    const rowsBefore = await undoButtons.count();
    expect(rowsBefore).toBeGreaterThan(0);

    // --- Reverse it --------------------------------------------------------------------------
    await undoButtons.first().click();
    await confirmDialog(page).getByTestId('confirm-dialog-confirm').click();

    await page.getByTestId('deposit-tab-transactions').click();
    // The reversed row is still there, marked rather than removed, and no longer offers undo.
    await expect(page.getByTestId('deposit-tx-reversed').first()).toBeVisible({ timeout: 20000 });
  });

  test('an application can be rejected instead of approved', async ({ page }) => {
    test.setTimeout(recordingTimeout(240000));
    await login(page);

    const api = await createApiContext();
    let accountId: number;
    try {
      ({ accountId } = await seedFixedDepositAccount(api, 'E2EReject'));
    } finally {
      await api.dispose();
    }

    await openAccount(page, accountId);
    await runAction(page, 'reject');

    await expect(page.getByTestId('deposit-status')).toContainText('Rejected', { timeout: 20000 });
    // A rejected application is final — nothing further is offered on it.
    await page.getByTestId('deposit-actions').click();
    await expect(page.getByTestId('deposit-no-actions')).toBeVisible();
  });
});
