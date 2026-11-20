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
 * The chart of accounts' row actions, against mocked endpoints.
 *
 * Deleting a GL account is destructive and had no browser-level cover at all. These tests assert
 * the parts that need no backend: the confirmation is a dialog rather than the browser's
 * `confirm()`, nothing is sent until it is accepted, and the Usage column shows a label — it
 * printed `[object Object]` before the contract flattened it (#789).
 */

import { expect, test, type Page } from './fixtures';
import { confirmDialog } from './utils/ionic-locators';

const CASH_AT_VAULT = {
  id: 12,
  name: 'Cash at Vault',
  glCode: '10101',
  disabled: false,
  manualEntriesAllowed: true,
  type: { id: 1, code: 'accountType.asset', value: 'Asset' },
  usage: { id: 1, code: 'accountUsage.detail', value: 'Detail' },
  parentId: 4,
};

async function signIn(page: Page): Promise<void> {
  await page.route('**/config.json*', (route) =>
    route.fulfill({ json: { fineractApiUrl: '/api/v1', defaultTenant: 'default' } }),
  );
  await page.route('**/api/v1/authentication**', (route) =>
    route.fulfill({
      json: {
        username: 'mifos',
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: 'Head Office',
        permissions: ['ALL_FUNCTIONS'],
      },
    }),
  );
  await page.route('**/api/v1/configurations/name/enable-business-date**', (route) =>
    route.fulfill({ json: { name: 'enable-business-date', enabled: true } }),
  );
  await page.route('**/api/v1/businessdate**', (route) =>
    route.fulfill({ json: [{ type: 'BUSINESS_DATE', date: [2026, 10, 15] }] }),
  );
  await page.route(/\/api\/v1\/(?:clients|loans|savingsaccounts)(?:\?|$)/, (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } })
      : route.fallback(),
  );
  await page.route('**/api/v1/loans/due**', (route) =>
    route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } }),
  );
  await page.route('**/api/v1/runreports/**', (route) =>
    route.fulfill({ json: { columnHeaders: [], data: [] } }),
  );
  await page.goto('/login');
  await page.locator('#tenantId').fill('default');
  await page.locator('#username').fill('mifos');
  await page.locator('#password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

/** Collects what the screen sent, so the assertions are about the request, not the UI. */
interface Sent {
  deletes: string[];
}

async function mockGlAccounts(page: Page): Promise<Sent> {
  const sent: Sent = { deletes: [] };
  await page.route(/\/api\/v1\/glaccounts/, async (route) => {
    const request = route.request();
    if (request.method() === 'DELETE') {
      sent.deletes.push(request.url());
      return route.fulfill({ json: { resourceId: CASH_AT_VAULT.id } });
    }
    return route.fulfill({ json: [CASH_AT_VAULT] });
  });
  return sent;
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Chart of accounts row actions', () => {
  test('shows the usage label, not the object the payload carries', async ({ page }) => {
    await signIn(page);
    await mockGlAccounts(page);
    await page.goto('/accounting/chart-of-accounts');

    const row = page.getByRole('row', { name: /Cash at Vault/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Detail');
    await expect(row).not.toContainText('[object Object]');
  });

  test('deleting an account confirms through the shared dialog, then sends the DELETE', async ({
    page,
  }) => {
    await signIn(page);
    const sent = await mockGlAccounts(page);
    await page.goto('/accounting/chart-of-accounts');

    const row = page.getByRole('row', { name: /Cash at Vault/ });
    await row.getByRole('button', { name: 'Delete Account' }).click();

    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    // Nothing leaves the screen until the dialog is answered.
    expect(sent.deletes).toEqual([]);

    await dialog.locator('[data-testid="confirm-dialog-confirm"]').click();

    await expect.poll(() => sent.deletes.length).toBe(1);
    expect(sent.deletes[0]).toContain('/glaccounts/12');
  });

  test('declining the dialog deletes nothing', async ({ page }) => {
    await signIn(page);
    const sent = await mockGlAccounts(page);
    await page.goto('/accounting/chart-of-accounts');

    await page
      .getByRole('row', { name: /Cash at Vault/ })
      .getByRole('button', { name: 'Delete Account' })
      .click();
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-testid="confirm-dialog-cancel"]').click();

    await expect(dialog).toHaveCount(0);
    expect(sent.deletes).toEqual([]);
  });
});
