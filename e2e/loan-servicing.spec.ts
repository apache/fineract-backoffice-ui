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
 * Exercises the loan-account servicing features added in this session: the
 * Notes tab (audit-trail add/delete) and the Transactions tab's detail
 * dialog with transaction adjustment (correcting a mis-entered repayment).
 * Each test configures its own Office/Client/Loan Product/Loan so it runs
 * independently of other specs and of data left by earlier runs.
 *
 *   npx playwright test e2e/loan-servicing.spec.ts --workers=1
 */

import { test, expect, recordingTimeout } from './fixtures';
import { login } from './utils/fineract-login';
import { createActiveLoan } from './utils/create-active-loan';
import { confirmDialog, modalFor, selectTab } from './utils/ionic-locators';
import { createApiContext, seedRepayment } from './utils/seed-api';

test.describe('Loan servicing: notes and transaction adjustment', () => {
  test('notes can be added and removed, with a confirm dialog on delete', async ({ page }) => {
    test.setTimeout(recordingTimeout(120000));
    await login(page);
    const { loanId } = await createActiveLoan(page, 'NotesDemo');

    await page.goto(`/loans/view/${loanId}`);
    await selectTab(page, 'Notes');
    await expect(page.getByText('No notes recorded for this loan yet.')).toBeVisible();

    const noteText = `E2E note ${Date.now()}`;
    await page.locator('textarea[name="newNote"]').fill(noteText);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(noteText)).toBeVisible({ timeout: 10000 });

    // Deleting must go through the confirm dialog, not a native confirm().
    await page.locator('ion-button:has(ion-icon[name="trash-outline"])').first().click();
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/delete this note/i)).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(noteText)).toBeVisible();

    await page.locator('ion-button:has(ion-icon[name="trash-outline"])').first().click();
    await confirmDialog(page).getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText(noteText)).toHaveCount(0);
    await expect(page.getByText('No notes recorded for this loan yet.')).toBeVisible();
  });

  test('a repayment transaction can be viewed and adjusted with a corrected amount', async ({
    page,
  }) => {
    test.setTimeout(recordingTimeout(120000));
    await login(page);
    const { loanId } = await createActiveLoan(page, 'AdjustDemo');

    // Seed the repayment over the API. Recording it through the form is covered
    // elsewhere; here it is only the precondition for viewing and adjusting.
    const api = await createApiContext();
    try {
      await seedRepayment(api, loanId, 100);
    } finally {
      await api.dispose();
    }

    await page.goto(`/loans/view/${loanId}`);
    await selectTab(page, 'Transactions');
    const repaymentRow = page.getByRole('row', { name: /Repayment/ }).first();
    await expect(repaymentRow).toBeVisible({ timeout: 10000 });

    // View: shows a full breakdown, not just the raw enum code.
    // Click the ion-button, not the ion-icon inside it: the button's shadow-DOM
    // native element sits above the icon and swallows the pointer event.
    await repaymentRow.locator('ion-button:has(ion-icon[name="eye-outline"])').click();
    const dialog = modalFor(page, 'app-transaction-detail-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Repayment', { exact: true })).toBeVisible({ timeout: 10000 });
    // The amount appears twice: the transaction total and its principal portion.
    await expect(dialog.getByText('$100.00').first()).toBeVisible();

    // Adjust: correct the amount, which reverses the original and posts a
    // new transaction — a common real-world "fix the mis-entered receipt"
    // workflow that previously had no in-app path at all.
    await dialog.getByRole('button', { name: 'Adjust Transaction' }).click();
    await dialog.locator('input[name="adjustAmount"]').fill('75');
    await dialog
      .locator('textarea[name="adjustNote"]')
      .fill('E2E: corrected mis-entered repayment amount');

    await dialog.getByRole('button', { name: 'Adjust Transaction' }).click();

    const confirm = confirmDialog(page);
    await expect(confirm.getByText(/reverse the original transaction/i)).toBeVisible();

    const [adjustResponse] = await Promise.all([
      page.waitForResponse(
        (res) => /\/transactions\/\d+$/.test(res.url()) && res.request().method() === 'POST',
      ),
      confirm.getByRole('button', { name: 'Confirm' }).click(),
    ]);
    expect(adjustResponse.ok()).toBeTruthy();

    await page.goto(`/loans/view/${loanId}`);
    await selectTab(page, 'Transactions');
    await expect(page.getByText('+ $75.00')).toBeVisible({ timeout: 10000 });
  });
});
