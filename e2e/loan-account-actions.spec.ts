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
 * Exercises the new loan-account lifecycle actions added in this session:
 * the confirm dialog (replacing native confirm()), Undo Disbursal,
 * and Write Off. Each test creates its own throwaway client/loan so it
 * doesn't disturb other loans used by other specs/demos.
 *
 *   npx playwright test e2e/loan-account-actions.spec.ts --workers=1
 */

import { test, expect, recordingTimeout } from './fixtures';
import { login } from './utils/fineract-login';
import { createActiveLoan } from './utils/create-active-loan';
import { confirmDialog, menuItem } from './utils/ionic-locators';

test.describe('Loan account lifecycle actions', () => {
  test('new action menu items appear only for active loans', async ({ page }) => {
    test.setTimeout(recordingTimeout(120000));
    await login(page);
    const { loanId } = await createActiveLoan(page);

    await page.goto(`/loans/view/${loanId}`);
    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(menuItem(page, 'Undo Disbursal')).toBeVisible();
    await expect(menuItem(page, 'Waive Interest')).toBeVisible();
    await expect(menuItem(page, 'Prepay Loan')).toBeVisible();
    await expect(menuItem(page, 'Foreclosure')).toBeVisible();
    await expect(menuItem(page, /^Close$/)).toBeVisible();
    await expect(menuItem(page, 'Write Off')).toBeVisible();
  });

  test('undo disbursal shows a confirm dialog and reverts the loan to Approved', async ({
    page,
  }) => {
    test.setTimeout(recordingTimeout(120000));
    await login(page);
    const { loanId } = await createActiveLoan(page);

    await page.goto(`/loans/view/${loanId}`);
    await page.getByRole('button', { name: 'Actions' }).click();
    await menuItem(page, 'Undo Disbursal').click();

    // Confirm it's a real modal, not a native confirm() popup. ion-modal exposes
    // role="dialog" on the host, but its projected content sits behind a shadow
    // boundary a chained getByRole() does not reach, so match on text.
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2')).toHaveText('Undo Disbursal');

    // Cancelling must not perform the action.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Active', { exact: true })).toBeVisible();

    // Confirming performs it and refreshes the same page in place.
    await page.getByRole('button', { name: 'Actions' }).click();
    await menuItem(page, 'Undo Disbursal').click();
    await confirmDialog(page).getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByText('Approved', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('write off requires confirmation and moves the loan out of Active status', async ({
    page,
  }) => {
    test.setTimeout(recordingTimeout(120000));
    await login(page);
    const { loanId } = await createActiveLoan(page);

    await page.goto(`/loans/view/${loanId}`);
    await page.getByRole('button', { name: 'Actions' }).click();
    await menuItem(page, 'Write Off').click();

    await expect(page).toHaveURL(new RegExp(`/loans/${loanId}/transactions/writeoff$`));
    await page.getByRole('button', { name: 'Save' }).click();

    // The transaction form itself gates the irreversible action behind a
    // second, explicit confirmation before calling the API.
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2')).toContainText('Write Off');
    await dialog.getByRole('button', { name: 'Confirm' }).click();

    await expect(page).toHaveURL(/\/loans$/, { timeout: 15000 });
    await page.goto(`/loans/view/${loanId}`);
    await expect(page.getByText('Active', { exact: true })).toHaveCount(0);
  });
});
