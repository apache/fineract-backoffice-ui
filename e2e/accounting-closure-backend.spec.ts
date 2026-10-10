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
 * Proves accounting period closures against a real Fineract instance.
 *
 * The closures screen had no backend cover at all, and the gap hid a defect the mocked tests
 * could not see: the list bound `closure.isClosed`, a field that exists on neither the generated
 * model nor the live payload, through an untyped cell-template context. Every closed period
 * rendered as "Open", and `strictTemplates` cannot see into an untyped context to say so. The
 * status assertion below is the regression guard for that.
 *
 * The second half is the part only a real backend can give. A row appearing in a list proves the
 * POST was accepted; it does not prove the period is actually closed. So this also asks Fineract
 * to post a manual journal entry dated inside the closed period, expects the refusal, re-opens
 * the period through the UI, and expects the same posting to succeed. That round trip is what
 * makes the screen's claim true rather than merely rendered.
 *
 * Every closure here is scoped to a freshly seeded branch office. A closure applies to an
 * office's whole subtree, so closing Head Office would make the platform refuse the postings the
 * loan, savings and teller specs depend on.
 */

import { test, expect } from './fixtures';
import { login } from './utils/fineract-login';
import { selectOption } from './utils/select-option';
import {
  attemptJournalEntry,
  createApiContext,
  deleteAccountingClosure,
  seedAccountingClosure,
  seedGlAccountPair,
  seedOffice,
} from './utils/seed-api';

/** `closingDate` on the form prefills to today, which is the date the postings below use. */
const CLOSURE_COMMENT = 'Closed by the e2e suite';

/**
 * Fineract names the rule it refused on in `errors[].userMessageGlobalisationCode`. Asserting the
 * code rather than the status alone keeps this from passing on an unrelated refusal — a 403 for a
 * missing permission would otherwise look identical.
 */
const CLOSURE_RULE = 'error.msg.glJournalEntry.invalid.accounting.closed';

/** Escapes a seeded name for use inside a row-name regex. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Widens the page so a seeded row is on it.
 *
 * The closures list is `localLogic` with the shared 10-row default, and closures accumulate on a
 * long-lived instance, so the row this spec just created is not necessarily on the first page.
 */
async function showAllRows(page: import('@playwright/test').Page): Promise<void> {
  const pageSize = page.getByTestId('paginator-page-size');
  if (
    (await pageSize.evaluate((select: HTMLElement & { value: unknown }) => select.value)) !== 100
  ) {
    await pageSize.click();
    await page.locator('ion-popover').getByRole('radio', { name: '100' }).click();
  }
}

test.describe('Accounting closures against Fineract', () => {
  test('a closed period reads as Closed, and the platform refuses a posting inside it', async ({
    page,
  }) => {
    const api = await createApiContext();
    const branch = await seedOffice(api, 'E2EClosure');
    const pair = await seedGlAccountPair(api, 'E2EClosure');

    // Before anything is closed, the posting this spec uses as its probe succeeds. Established
    // first so the refusal later cannot be blamed on the accounts or the office.
    const beforeClosing = await attemptJournalEntry(api, {
      pair,
      officeId: branch.officeId,
      comments: 'Probe before the period was closed',
    });
    expect(
      beforeClosing.ok(),
      `a posting in an open period should be accepted, got ${beforeClosing.status()}: ${(
        await beforeClosing.text()
      ).slice(0, 300)}`,
    ).toBe(true);

    await login(page);
    await page.goto('/accounting/closures/create');

    await selectOption(page, 'Office', branch.officeName);
    await page.locator('textarea[name="comments"]').fill(CLOSURE_COMMENT);

    const [created] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/glclosures') && response.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Close Period' }).click(),
    ]);
    // The adapter owns the date format and locale the platform parses. A 400 here means it sent
    // something Fineract does not accept, which is exactly the coupling this spec exists to catch.
    expect(
      created.ok(),
      `closure POST rejected: ${created.status()} ${(await created.text()).slice(0, 300)}`,
    ).toBe(true);
    const { resourceId: closureId } = (await created.json()) as { resourceId: number };

    try {
      await expect(page).toHaveURL('/accounting/closures');
      await showAllRows(page);

      const row = page.getByRole('row', { name: new RegExp(escapeRegExp(branch.officeName)) });
      await expect(row).toBeVisible({ timeout: 20000 });
      await expect(row).toContainText(CLOSURE_COMMENT);
      // The regression guard. `isClosed` is derived by the adapter from the payload's `deleted`
      // flag; before that existed this cell read "Open" for every closed period on the screen.
      // Asserted on the chip itself rather than the row: the row also holds a "Re-open Period"
      // control, so a looser text match could pass on the wrong element.
      await expect(row.locator('.status-chip')).toHaveText('Closed');

      // What the row claims, checked against the platform rather than against the screen.
      const refused = await attemptJournalEntry(api, {
        pair,
        officeId: branch.officeId,
        comments: 'Probe inside the closed period',
      });
      expect(refused.ok()).toBe(false);
      expect(await refused.text()).toContain(CLOSURE_RULE);

      // Re-open through the UI. The list guards this with a native confirm().
      page.once('dialog', (dialog) => dialog.accept());
      const [removed] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes('/glclosures') && response.request().method() === 'DELETE',
        ),
        row.getByRole('button', { name: 'Re-open Period' }).click(),
      ]);
      expect(removed.ok()).toBe(true);
      await expect(row).toHaveCount(0, { timeout: 20000 });

      // And the refusal lifts, which is what makes the re-open real rather than cosmetic.
      const afterReopening = await attemptJournalEntry(api, {
        pair,
        officeId: branch.officeId,
        comments: 'Probe after the period was re-opened',
      });
      expect(
        afterReopening.ok(),
        `a posting should be accepted once the period is re-opened, got ${afterReopening.status()}`,
      ).toBe(true);
    } finally {
      await deleteAccountingClosure(api, closureId);
      await api.dispose();
    }
  });

  test('the form keeps the user on the page and names the reason when Fineract refuses', async ({
    page,
  }) => {
    const api = await createApiContext();
    const branch = await seedOffice(api, 'E2EClosureDup');
    // The platform refuses a closure dated on or before the office's latest one, so an existing
    // closure for today makes the form's submission fail for a reason it cannot pre-empt.
    const existing = await seedAccountingClosure(api, branch.officeId);

    try {
      await login(page);
      await page.goto('/accounting/closures/create');

      await selectOption(page, 'Office', branch.officeName);

      const [rejected] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes('/glclosures') && response.request().method() === 'POST',
        ),
        page.getByRole('button', { name: 'Close Period' }).click(),
      ]);
      expect(rejected.ok()).toBe(false);

      // The form's own error handler only clears the saving flag, so the global interceptor's
      // toast is the whole of the feedback. If it ever stops firing here, the screen silently
      // re-enables the button and says nothing about why the period was not closed.
      await expect(page.locator('ion-toast.error-toast')).toBeVisible({ timeout: 20000 });
      await expect(page).toHaveURL('/accounting/closures/create');
      await expect(page.getByRole('button', { name: 'Close Period' })).toBeEnabled();
    } finally {
      await deleteAccountingClosure(api, existing.closureId);
      await api.dispose();
    }
  });
});
