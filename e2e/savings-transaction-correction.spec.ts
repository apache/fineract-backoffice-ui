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
 * Correcting a savings transaction, against a real Fineract.
 *
 * The screen could already record a deposit and place a hold; it could undo neither. A hold in
 * particular was a one-way door — money could be earmarked against a claim and never freed from
 * this application.
 *
 * The two commands behave differently in ways that decide how the buttons are gated, and only a
 * real platform shows it. `undo` is lenient: it answers 200 against a transaction that is already
 * reversed, and against a hold, doing nothing useful either time — so the screen has to be
 * stricter than the server or a teller gets a button that reports success and changes nothing.
 * `releaseAmount` is the opposite, refusing a second release with
 * `validation.msg.amount.is.not.on.hold`.
 *
 *   npx playwright test e2e/savings-transaction-correction.spec.ts --project=backend --workers=1
 */

import { test, expect, recordingTimeout } from './fixtures';
import { login } from './utils/fineract-login';
import { confirmDialog } from './utils/ionic-locators';
import { createApiContext, seedSavingsAccountWithTransactions } from './utils/seed-api';

test.describe('Savings transaction correction', () => {
  test.describe.configure({ mode: 'serial' });

  test('a deposit is reversed and a hold is released', async ({ page }) => {
    test.setTimeout(recordingTimeout(240000));
    await login(page);

    const api = await createApiContext();
    let savingsId: number;
    try {
      ({ savingsId } = await seedSavingsAccountWithTransactions(api));
    } finally {
      await api.dispose();
    }

    await page.goto(`/products/savings-accounts/view/${savingsId}`);
    await expect(page.getByTestId('savings-actions')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('savings-tab-transactions').click();

    // --- The hold offers release, and only release -------------------------------------------
    const releaseButtons = page.locator('[data-testid^="savings-tx-release-"]');
    await expect(releaseButtons.first()).toBeVisible({ timeout: 20000 });

    await releaseButtons.first().click();
    await confirmDialog(page).getByTestId('confirm-dialog-confirm').click();

    // Released, so nothing is left to release — a second attempt would be refused outright.
    await page.getByTestId('savings-tab-transactions').click();
    await expect(releaseButtons).toHaveCount(0, { timeout: 20000 });

    // --- The deposit reverses, and stays on screen --------------------------------------------
    const undoButtons = page.locator('[data-testid^="savings-tx-undo-"]');
    await expect(undoButtons.first()).toBeVisible({ timeout: 20000 });

    await undoButtons.first().click();
    await confirmDialog(page).getByTestId('confirm-dialog-confirm').click();

    await page.getByTestId('savings-tab-transactions').click();
    // Marked rather than removed: deleting it would take the audit trail with it.
    await expect(page.getByTestId('savings-tx-reversed').first()).toBeVisible({ timeout: 20000 });
  });
});
