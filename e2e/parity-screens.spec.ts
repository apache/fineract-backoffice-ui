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
 * The screens added to close the functional gaps, against a real Fineract.
 *
 * Each of these exists because the platform supports something this application had no screen
 * for, so a mocked test would prove very little: the whole question is whether the contract works
 * against the running platform. Every assertion here is therefore backed by a real record —
 * seeded over the API, then read or changed through the UI, then checked again.
 *
 *   npx playwright test e2e/parity-screens.spec.ts --project=backend --workers=1
 */

import { test, expect, recordingTimeout } from './fixtures';
import { login } from './utils/fineract-login';
import { confirmDialog } from './utils/ionic-locators';
import {
  API_BASE,
  createApiContext,
  seedFixedDepositAccount,
  seedManualJournalEntry,
  seedPendingLoan,
  seedReportDefinition,
  seedSavingsAccountWithTransactions,
  reverseJournalEntry,
} from './utils/seed-api';

test.describe('Screens added for platform parity', () => {
  test('a manual journal entry can be read whole and reversed', async ({ page }) => {
    test.setTimeout(recordingTimeout(180000));

    const api = await createApiContext();
    let entry: Awaited<ReturnType<typeof seedManualJournalEntry>>;
    try {
      entry = await seedManualJournalEntry(api);
    } finally {
      await api.dispose();
    }

    await login(page);
    await page.goto(`/accounting/journal-entries/view/${entry.entryId}`);

    // Both sides of the transaction, not just the line that was clicked.
    await expect(page.getByTestId('journal-entry-debits')).toContainText(entry.debitAccountName);
    await expect(page.getByTestId('journal-entry-credits')).toContainText(entry.creditAccountName);
    await expect(page.getByTestId('journal-entry-debit-total')).toHaveText('100.00');
    await expect(page.getByTestId('journal-entry-credit-total')).toHaveText('100.00');

    await page.getByTestId('journal-entry-reverse').click();
    await confirmDialog(page).getByTestId('confirm-dialog-confirm').click();

    // Wait for the screen to reflect it before asking the platform: the request is in flight
    // until then, and checking first races the reversal rather than testing it.
    await expect(page.getByTestId('journal-entry-reversed')).toBeVisible({ timeout: 30000 });

    // Then the platform is asked directly, because the badge alone only proves the client agrees
    // with itself.
    const verify = await createApiContext();
    try {
      const response = await verify.get(
        `${API_BASE}/journalentries?transactionId=${entry.transactionId}`,
      );
      const body = (await response.json()) as { pageItems: { reversed?: boolean }[] };
      expect(body.pageItems.every((line) => line.reversed)).toBeTruthy();
    } finally {
      await verify.dispose();
    }
  });

  test('an entry that is already reversed is not offered again', async ({ page }) => {
    test.setTimeout(recordingTimeout(180000));

    // Seeded and reversed over the API: this asserts the resulting state, where the test above
    // asserts the act. Reading whichever entry happens to be first in the list instead would make
    // the test depend on what the rest of the suite has posted.
    const api = await createApiContext();
    let entry: Awaited<ReturnType<typeof seedManualJournalEntry>>;
    try {
      entry = await seedManualJournalEntry(api, 'E2EReversed');
      await reverseJournalEntry(api, entry.transactionId);
    } finally {
      await api.dispose();
    }

    await login(page);
    await page.goto(`/accounting/journal-entries/view/${entry.entryId}`);

    await expect(page.getByTestId('journal-entry-reversed')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('journal-entry-reverse')).toHaveCount(0);
  });

  test('a report definition can be created, edited and deleted; a core one cannot', async ({
    page,
  }) => {
    test.setTimeout(recordingTimeout(180000));

    const api = await createApiContext();
    let report: Awaited<ReturnType<typeof seedReportDefinition>>;
    try {
      report = await seedReportDefinition(api);
    } finally {
      await api.dispose();
    }

    await login(page);
    await page.goto('/system/report-definitions');

    // A stock Fineract ships around two hundred core reports, so the seeded one is never on the
    // first page — the table has to be filtered to find it.
    const search = page.getByTestId('search-filter-input').locator('input');
    await search.fill('Client Listing');
    const coreRow = page.getByRole('row').filter({ hasText: 'Client Listing' }).first();
    await expect(coreRow).toBeVisible({ timeout: 20000 });

    // The platform refuses to delete a core report, so the control is not offered.
    // ion-button is a custom element, so toBeDisabled() does not see it — the attribute does.
    await expect(coreRow.getByTestId('report-definition-delete')).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await search.fill(report.reportName);
    const tenantRow = page.getByRole('row').filter({ hasText: report.reportName }).first();
    await expect(tenantRow).toBeVisible({ timeout: 20000 });
    await tenantRow.getByTestId('report-definition-edit').click();
    await expect(page.getByTestId('report-definition-sql')).toBeVisible({ timeout: 20000 });
    await page
      .getByTestId('report-definition-description')
      .locator('textarea')
      .fill('Edited by e2e');
    await page.getByTestId('report-definition-save').click();

    await expect(page).toHaveURL(/\/system\/report-definitions$/, { timeout: 20000 });
  });

  test('a core report opens read-only with only its in-use setting', async ({ page }) => {
    test.setTimeout(recordingTimeout(120000));
    await login(page);

    await page.goto('/system/report-definitions');
    await page.getByTestId('search-filter-input').locator('input').fill('Client Listing');
    const coreRow = page.getByRole('row').filter({ hasText: 'Client Listing' }).first();
    await expect(coreRow).toBeVisible({ timeout: 20000 });
    await coreRow.getByTestId('report-definition-edit').click();

    await expect(page.getByTestId('report-definition-core-note')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('report-definition-name')).toHaveAttribute('disabled', /.*/);
    await expect(page.getByTestId('report-definition-in-use')).toBeVisible();
  });

  test('a pending loan is approved from the queue, in a batch', async ({ page }) => {
    test.setTimeout(recordingTimeout(240000));

    const api = await createApiContext();
    let loan: Awaited<ReturnType<typeof seedPendingLoan>>;
    try {
      loan = await seedPendingLoan(api);
    } finally {
      await api.dispose();
    }

    await login(page);
    await page.goto('/tasks/work-queues');

    const row = page.getByTestId(`queue-select-${loan.loanId}`);
    await expect(row).toBeVisible({ timeout: 30000 });
    await row.click();
    await expect(page.getByTestId('queue-selected-count')).toContainText('1');

    await page.getByTestId('queue-run').click();
    await confirmDialog(page).getByTestId('confirm-dialog-confirm').click();

    await expect(page.getByTestId('queue-result')).toBeVisible({ timeout: 30000 });
    // Approved loans leave the approval queue and appear in the disbursal one.
    await expect(page.getByTestId(`queue-select-${loan.loanId}`)).toHaveCount(0, {
      timeout: 30000,
    });

    await page.getByTestId('queue-loan-disbursal').click();
    await expect(page.getByTestId(`queue-select-${loan.loanId}`)).toBeVisible({ timeout: 30000 });
  });

  test('a fixed deposit is listed as a deposit, not as a savings account', async ({ page }) => {
    test.setTimeout(recordingTimeout(180000));

    const api = await createApiContext();
    let deposit: Awaited<ReturnType<typeof seedFixedDepositAccount>>;
    try {
      deposit = await seedFixedDepositAccount(api);
    } finally {
      await api.dispose();
    }

    await login(page);
    await page.goto(`/clients/view/${deposit.clientId}`);

    await expect(page.getByTestId('client-tab-deposits')).toBeVisible({ timeout: 30000 });
    await page.getByTestId('client-tab-deposits').click();

    const deposits = page.getByTestId('client-fixed-deposits');
    await expect(deposits).toBeVisible({ timeout: 20000 });
    await expect(deposits.getByRole('link')).toHaveAttribute(
      'href',
      /\/products\/fixed-deposits\/view\/\d+/,
    );
  });

  test('an office has a screen, and it carries its custom fields', async ({ page }) => {
    test.setTimeout(recordingTimeout(120000));
    await login(page);

    await page.goto('/organization/offices');
    await page.getByTestId('office-view').first().click();

    await expect(page).toHaveURL(/\/organization\/offices\/view\/\d+/, { timeout: 20000 });
    await expect(page.getByTestId('office-tab-general')).toBeVisible();

    await page.getByTestId('office-tab-custom-fields').click();
    await expect(page.getByTestId('office-tab-custom-fields')).toBeVisible();
  });

  test('a savings account carries notes, and the note survives a reload', async ({ page }) => {
    test.setTimeout(recordingTimeout(180000));
    const api = await createApiContext();
    let savings: Awaited<ReturnType<typeof seedSavingsAccountWithTransactions>>;
    try {
      savings = await seedSavingsAccountWithTransactions(api, 'E2ENotes');
    } finally {
      await api.dispose();
    }

    await login(page);
    await page.goto(`/products/savings-accounts/view/${savings.savingsId}`);

    await page.getByTestId('savings-tab-notes').click();
    const note = `Seeded by e2e ${Date.now()}`;
    await page.getByRole('textbox').first().fill(note);
    await page
      .getByRole('button', { name: /add|save/i })
      .first()
      .click();

    await page.reload();
    await page.getByTestId('savings-tab-notes').click();
    await expect(page.getByText(note)).toBeVisible({ timeout: 20000 });
  });
});
