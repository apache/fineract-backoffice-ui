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
 * The closures list's two row actions, against mocked endpoints.
 *
 * This file exists because of what its absence cost. `accounting-closure-backend.spec.ts` drove
 * the re-open through `page.once('dialog')`, so when the list moved from the browser's
 * `confirm()` to the shared dialog (#789) nothing failed until the backend shard ran, twelve
 * minutes in, on a stack a local run does not have. The wiring these tests assert — a dialog
 * appears, confirming it sends the DELETE, and editing sends a PUT carrying comments alone —
 * needs no backend to check.
 */

import { expect, test, type Page } from './fixtures';
import { confirmDialog } from './utils/ionic-locators';

const CLOSURE = {
  id: 5,
  officeId: 1,
  officeName: 'Head Office',
  closingDate: '2026-09-30',
  comments: 'Year-end close',
  deleted: false,
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

/** Collects what the screen sent, so the assertions can be about the request rather than the UI. */
interface Sent {
  deletes: string[];
  puts: Record<string, unknown>[];
}

async function mockClosures(page: Page): Promise<Sent> {
  const sent: Sent = { deletes: [], puts: [] };
  await page.route(/\/api\/v1\/glclosures/, async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === 'DELETE') {
      sent.deletes.push(request.url());
      return route.fulfill({ json: { officeId: 1, resourceId: CLOSURE.id } });
    }
    if (method === 'PUT') {
      sent.puts.push(request.postDataJSON() as Record<string, unknown>);
      return route.fulfill({ json: { officeId: 1, resourceId: CLOSURE.id } });
    }
    // `/glclosures/5` answers the one closure; `/glclosures` answers the list.
    return /glclosures\/\d+/.test(request.url())
      ? route.fulfill({ json: CLOSURE })
      : route.fulfill({ json: [CLOSURE] });
  });
  return sent;
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Accounting closure row actions', () => {
  test('re-opening a period confirms through the shared dialog, then sends the DELETE', async ({
    page,
  }) => {
    await signIn(page);
    const sent = await mockClosures(page);
    await page.goto('/accounting/closures');

    const row = page.getByRole('row', { name: /Head Office/ });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: 'Re-open Period' }).click();
    // The point of the test: a dialog, not the browser's confirm(). Nothing is sent until it is
    // accepted.
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    expect(sent.deletes).toEqual([]);

    await dialog.locator('[data-testid="confirm-dialog-confirm"]').click();

    await expect.poll(() => sent.deletes.length).toBe(1);
    expect(sent.deletes[0]).toContain('/glclosures/5');
  });

  test('declining the dialog re-opens nothing', async ({ page }) => {
    await signIn(page);
    const sent = await mockClosures(page);
    await page.goto('/accounting/closures');

    await page
      .getByRole('row', { name: /Head Office/ })
      .getByRole('button', { name: 'Re-open Period' })
      .click();
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-testid="confirm-dialog-cancel"]').click();

    await expect(dialog).toHaveCount(0);
    expect(sent.deletes).toEqual([]);
  });

  test('editing a closure sends comments alone, and offers no editable date', async ({ page }) => {
    await signIn(page);
    const sent = await mockClosures(page);
    await page.goto('/accounting/closures');

    await page
      .getByRole('row', { name: /Head Office/ })
      .getByRole('button', { name: 'Edit Comments' })
      .click();
    await expect(page).toHaveURL('/accounting/closures/edit/5');

    // Read-only, because `PUT /glclosures/{id}` carries comments and nothing else.
    await expect(page.getByTestId('closure-closing-date-readonly')).toBeVisible();
    await expect(page.getByTestId('closure-office-readonly')).toBeVisible();
    await expect(page.locator('[data-testid="closingDate-picker"]')).toHaveCount(0);

    const comments = page.locator('textarea[name="comments"]');
    await expect(comments).toHaveValue('Year-end close');
    await comments.fill('Corrected: year-end close');
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect.poll(() => sent.puts.length).toBe(1);
    expect(sent.puts[0]).toEqual({ comments: 'Corrected: year-end close' });
    await expect(page).toHaveURL('/accounting/closures');
  });
});
