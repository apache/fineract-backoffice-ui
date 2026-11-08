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
 * Account number formats, against mocked endpoints.
 *
 * The screen's shape comes from two platform rules, and these tests hold it to them: Add is
 * withheld once every account type has a format, and the prefix is set per row from the
 * prefixes that row's own account type allows.
 */

import { expect, test, type Page } from './fixtures';
import { confirmDialog } from './utils/ionic-locators';

const CLIENT_FORMAT = {
  id: 1,
  accountType: { id: 1, code: 'accountType.client', value: 'CLIENT' },
};

const TEMPLATE = {
  accountTypeOptions: [
    { id: 1, code: 'accountType.client', value: 'CLIENT' },
    { id: 2, code: 'accountType.loan', value: 'LOAN' },
  ],
  prefixTypeOptions: {
    CLIENT: [{ id: 1, code: 'accountNumberPrefixType.officeName', value: 'OFFICE_NAME' }],
    LOAN: [
      { id: 101, code: 'accountNumberPrefixType.productShortName', value: 'PRODUCT_SHORT_NAME' },
    ],
  },
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

/** What the screen sent, so the assertions are about the request rather than the UI. */
interface Sent {
  posts: Record<string, unknown>[];
  puts: { url: string; body: Record<string, unknown> }[];
  deletes: string[];
}

async function mockFormats(page: Page, formats: unknown[] = [CLIENT_FORMAT]): Promise<Sent> {
  const sent: Sent = { posts: [], puts: [], deletes: [] };
  await page.route(/\/api\/v1\/accountnumberformats/, async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === 'POST') {
      sent.posts.push(request.postDataJSON() as Record<string, unknown>);
      return route.fulfill({ json: { resourceId: 9 } });
    }
    if (method === 'PUT') {
      sent.puts.push({
        url: request.url(),
        body: request.postDataJSON() as Record<string, unknown>,
      });
      return route.fulfill({ json: { resourceId: 1 } });
    }
    if (method === 'DELETE') {
      sent.deletes.push(request.url());
      return route.fulfill({ json: { resourceId: 1 } });
    }
    return request.url().includes('/template')
      ? route.fulfill({ json: TEMPLATE })
      : route.fulfill({ json: formats });
  });
  return sent;
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Account number formats', () => {
  test('lists a format with no prefix, and offers Add for the type that has none', async ({
    page,
  }) => {
    await signIn(page);
    await mockFormats(page);
    await page.goto('/system/account-number-formats');

    const row = page.getByRole('row', { name: /CLIENT/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText('No prefix');
    // LOAN has no format yet, so the button is offered.
    await expect(page.getByRole('button', { name: /add format/i })).toBeVisible();
  });

  test('withholds Add once every account type is configured', async ({ page }) => {
    await signIn(page);
    await mockFormats(page, [
      CLIENT_FORMAT,
      { id: 2, accountType: { id: 2, code: 'accountType.loan', value: 'LOAN' } },
    ]);
    await page.goto('/system/account-number-formats');

    await expect(page.getByRole('row', { name: /LOAN/ })).toBeVisible();
    // Fineract refuses a second format for a type, so the action is not offered at all.
    await expect(page.getByRole('button', { name: /add format/i })).toHaveCount(0);
  });

  test('sets a prefix from the options the row own type allows', async ({ page }) => {
    await signIn(page);
    const sent = await mockFormats(page);
    await page.goto('/system/account-number-formats');

    await page
      .getByRole('row', { name: /CLIENT/ })
      .getByRole('button', { name: /set prefix/i })
      .click();

    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    // Confirm stays disabled until the prefix is chosen: the dialog's fields are required by
    // default, which is right for a value the platform demands.
    //
    // Addressed by test id, not by `ion-select[name=...]` as `selectInDialog` does. The shared
    // dialog binds `[name]` rather than setting a static attribute, and Ionic keeps `name` as a
    // property without reflecting it, so there is no attribute to match.
    await dialog.locator('[data-testid="dialog-field-prefixType"]').click();
    await page
      .locator(
        'ion-alert.select-alert:not(.overlay-hidden), ion-popover.select-popover:not(.overlay-hidden)',
      )
      .getByRole('radio', { name: 'OFFICE_NAME', exact: true })
      .click();
    // An alert-style select needs its OK; a popover closes on choice and has none.
    const ok = page.locator('ion-alert.select-alert button:has-text("OK")');
    if (await ok.count()) {
      await ok.click();
    }
    await dialog.locator('[data-testid="confirm-dialog-confirm"]').click();

    await expect.poll(() => sent.puts.length).toBe(1);
    expect(sent.puts[0].url).toContain('/accountnumberformats/1');
    // The prefix, and only the prefix: the account type cannot change.
    expect(Object.keys(sent.puts[0].body)).toEqual(['prefixType']);
  });

  test('deleting asks first, and declining sends nothing', async ({ page }) => {
    await signIn(page);
    const sent = await mockFormats(page);
    await page.goto('/system/account-number-formats');

    const row = page.getByRole('row', { name: /CLIENT/ });
    await row.getByRole('button', { name: /^delete$/i }).click();
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-testid="confirm-dialog-cancel"]').click();
    expect(sent.deletes).toEqual([]);

    await row.getByRole('button', { name: /^delete$/i }).click();
    await confirmDialog(page).locator('[data-testid="confirm-dialog-confirm"]').click();

    await expect.poll(() => sent.deletes.length).toBe(1);
    expect(sent.deletes[0]).toContain('/accountnumberformats/1');
  });
});
