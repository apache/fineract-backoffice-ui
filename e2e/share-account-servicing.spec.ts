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
 * Operating a share account, against a real Fineract.
 *
 * Share accounts could be created and edited but never opened — there was no detail screen and
 * no route to one — so approving, activating, buying more shares, redeeming some and closing
 * were all unreachable.
 *
 * The nine commands disagree about their date field (`approvedDate`, `activatedDate`,
 * `rejectedDate`, `closedDate`, `requestedDate`) and the endpoint does not enumerate them the way
 * the group and deposit resources do, so a real platform is the only thing that confirms the
 * screen sends what each one wants.
 *
 * Reached by route rather than through the accounts list, which is empty for reasons outside
 * this screen: `GET /accounts/share` answers `totalFilteredRecords: 0` under every parameter
 * combination even with accounts present, while `GET /clients/{id}/accounts` returns them. The
 * list screen therefore has nothing to click, and re-sourcing it is its own change.
 *
 *   npx playwright test e2e/share-account-servicing.spec.ts --project=backend --workers=1
 */

import { test, expect, Page, recordingTimeout } from './fixtures';
import { login } from './utils/fineract-login';
import { confirmDialog, modalFor } from './utils/ionic-locators';
import { createApiContext, seedShareAccount } from './utils/seed-api';

async function openAccount(page: Page, accountId: number): Promise<void> {
  await page.goto(`/products/shares/view/${accountId}`);
  await expect(page.getByTestId('share-account-status')).toBeVisible({ timeout: 20000 });
}

/** Runs one confirm-only action from the actions menu. */
async function runAction(page: Page, action: string): Promise<void> {
  await page.getByTestId('share-actions').click();
  await page.getByTestId(`share-action-${action}`).click();
  await confirmDialog(page).getByTestId('confirm-dialog-confirm').click();
}

async function seed(prefix?: string): Promise<number> {
  const api = await createApiContext();
  try {
    const { accountId } = await seedShareAccount(api, prefix);
    return accountId;
  } finally {
    await api.dispose();
  }
}

test.describe('Share account servicing', () => {
  test.describe.configure({ mode: 'serial' });

  test('an account is approved, activated, traded and closed', async ({ page }) => {
    test.setTimeout(recordingTimeout(240000));
    await login(page);

    const accountId = await seed();
    await openAccount(page, accountId);
    await expect(page.getByTestId('share-account-status')).toContainText(
      'Submitted and pending approval',
    );
    // 100 shares were applied for and none approved yet.
    await expect(page.getByTestId('share-total-pending')).toHaveText('100');

    await runAction(page, 'approve');
    await expect(page.getByTestId('share-account-status')).toContainText('Approved', {
      timeout: 20000,
    });

    // Takes an empty body — the command exists to erase a date rather than carry one.
    await runAction(page, 'undoapproval');
    await expect(page.getByTestId('share-account-status')).toContainText(
      'Submitted and pending approval',
      { timeout: 20000 },
    );

    await runAction(page, 'approve');
    await runAction(page, 'activate');
    await expect(page.getByTestId('share-account-status')).toContainText('Active', {
      timeout: 20000,
    });
    await expect(page.getByTestId('share-total-approved')).toHaveText('100');

    // --- Buy more shares ---------------------------------------------------------------------
    await page.getByTestId('share-actions').click();
    await page.getByTestId('share-action-apply').click();
    const applyDialog = modalFor(page, 'app-share-quantity-dialog');
    await expect(applyDialog).toBeVisible();
    await applyDialog.locator('input[name="requestedShares"]').fill('50');
    await applyDialog.getByTestId('share-quantity-confirm').click();

    // The purchase lands on the shares tab as a pending row.
    await page.getByTestId('share-tab-shares').click();
    await expect(page.locator('.share-table')).toContainText('50', { timeout: 20000 });

    // --- Redeem some -------------------------------------------------------------------------
    await page.getByTestId('share-actions').click();
    await page.getByTestId('share-action-redeem').click();
    const redeemDialog = modalFor(page, 'app-share-quantity-dialog');
    await expect(redeemDialog).toBeVisible();
    // The holding is on screen, so the ceiling is visible before a number is committed to.
    await expect(redeemDialog.getByTestId('share-quantity-held')).toContainText('100');
    await redeemDialog.locator('input[name="requestedShares"]').fill('10');
    await redeemDialog.getByTestId('share-quantity-confirm').click();
    await expect(page.getByTestId('share-account-status')).toBeVisible({ timeout: 20000 });

    // --- Close -------------------------------------------------------------------------------
    await runAction(page, 'close');
    await expect(page.getByTestId('share-account-status')).toContainText('Closed', {
      timeout: 20000,
    });

    // A closed account offers nothing further.
    await page.getByTestId('share-actions').click();
    await expect(page.getByTestId('share-no-actions')).toBeVisible();
  });

  test('an application can be rejected', async ({ page }) => {
    test.setTimeout(recordingTimeout(240000));
    await login(page);

    const accountId = await seed('E2EShareReject');
    await openAccount(page, accountId);

    await runAction(page, 'reject');
    await expect(page.getByTestId('share-account-status')).toContainText('Rejected', {
      timeout: 20000,
    });
  });
});
