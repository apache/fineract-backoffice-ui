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
 * A refused read is a permission problem, not an empty dataset (#751).
 *
 * Four screens swallowed a 403 into an empty list or an apparently usable form, so a user who
 * may not read collateral types or group levels was told the institution has none configured.
 * That is the silent-failure class the issue calls the serious one: nothing looks broken, so
 * nobody reports it.
 *
 * Route gating, the issue's other option, is not available for three of the four: the
 * permission catalogue carries no READ code for group levels, surveys or interest-rate charts,
 * so a guard would have to name a code that does not exist — the mistake #696 and #691 record.
 * Reporting the platform's refusal honestly is what is available.
 */

import { expect, test, type Page } from './fixtures';

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

/** Refuses one endpoint with a 403, as Fineract does for a role without the code. */
async function forbid(page: Page, pattern: RegExp): Promise<void> {
  await page.route(pattern, (route) =>
    route.fulfill({ status: 403, json: { developerMessage: 'not permitted' } }),
  );
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('A refused list read reports a permission problem', () => {
  const FORBIDDEN = /Your role does not cover this list/;
  const EMPTY = /No records found/;
  const RETRY = /try again/i;

  test('collateral management does not claim there are no collateral types', async ({ page }) => {
    await signIn(page);
    await forbid(page, /\/api\/v1\/collateral-management/);
    await page.goto('/products/collateral-management');

    await expect(page.getByText(FORBIDDEN)).toBeVisible();
    // The old behaviour, and the reason this issue was filed.
    await expect(page.getByText(EMPTY)).toHaveCount(0);
    // No retry: the same request is refused again, so a button would offer a loop.
    await expect(page.getByRole('button', { name: RETRY })).toHaveCount(0);
  });

  test('group levels does not claim there are none configured', async ({ page }) => {
    await signIn(page);
    await forbid(page, /\/api\/v1\/grouplevels/);
    await page.goto('/organization/group-levels');

    await expect(page.getByText(FORBIDDEN)).toBeVisible();
    await expect(page.getByText(EMPTY)).toHaveCount(0);
    await expect(page.getByRole('button', { name: RETRY })).toHaveCount(0);
  });

  test('interest rate charts reports the refusal rather than offering a retry', async ({
    page,
  }) => {
    await signIn(page);
    // The chart list reads its deposit products first; that read is what Fineract refuses.
    await forbid(page, /\/api\/v1\/recurringdepositproducts/);
    await forbid(page, /\/api\/v1\/fixeddepositproducts/);
    await page.goto('/products/interest-rate-charts');

    await expect(page.getByText(FORBIDDEN)).toBeVisible();
    await expect(page.getByRole('button', { name: RETRY })).toHaveCount(0);
  });

  test('survey responses withholds the form it cannot support', async ({ page }) => {
    await signIn(page);
    await forbid(page, /\/api\/v1\/survey(\?|$|\/)/);
    await page.goto('/spm/survey-responses');

    await expect(page.getByTestId('survey-responses-load-error')).toBeVisible();
    // The form was shown with an empty survey picker, which read as "no surveys exist".
    await expect(page.getByRole('button', { name: /load responses/i })).toHaveCount(0);
  });

  test('a transient failure still offers a retry', async ({ page }) => {
    await signIn(page);
    await page.route(/\/api\/v1\/grouplevels/, (route) => route.fulfill({ status: 500, json: {} }));
    await page.goto('/organization/group-levels');

    // Not a permission problem, so the retry is the right offer here.
    await expect(page.getByRole('button', { name: RETRY })).toBeVisible();
    await expect(page.getByText(FORBIDDEN)).toHaveCount(0);
  });
});
