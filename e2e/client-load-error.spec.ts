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
 * The client detail screen's failed-load states, against `page.route()` mocks — see issue #577.
 *
 * A blank screen after an auto-dismissing toast is indistinguishable from the app doing nothing,
 * which is what these mocks are steered into: a 404/403 (the record cannot exist for this
 * caller) and a 500 (a transient failure worth retrying). Companion to
 * `client-empty-account-cta.spec.ts`, which covers the same screen's empty-but-loaded states.
 *
 *   npx playwright test e2e/client-load-error.spec.ts --project=mocked
 */

import { expect, test, type Page } from './fixtures';

const CLIENT_ID = 99999;
const CLIENT_URL = `/clients/view/${CLIENT_ID}`;
const HEAD_OFFICE = 'Head Office';
/**
 * The detail GET only — anchored so it does not also match `/clients/99999/accounts`, which
 * `loadClientAccounts()` requests separately and is not part of this fix. Failing both by
 * accident of an overly broad glob would show that call's own (pre-existing, unrelated) toast
 * in the same screenshot as the state under test here.
 */
const CLIENT_DETAIL_RE = new RegExp(`/api/v1/clients/${CLIENT_ID}(?:\\?.*)?$`);

async function mockEmptyAccounts(page: Page): Promise<void> {
  await page.route(`**/api/v1/clients/${CLIENT_ID}/accounts**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ loanAccounts: [], savingsAccounts: [] }),
    }),
  );
}

test.use({ video: 'on' });

async function signIn(page: Page): Promise<void> {
  await page.route('**/config.json*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fineractApiUrl: '/api/v1', defaultTenant: 'default' }),
    }),
  );
  await page.route('**/api/v1/authentication**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        username: 'mifos',
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: HEAD_OFFICE,
        permissions: ['ALL_FUNCTIONS'],
      }),
    }),
  );
  await page.route('**/api/v1/businessdate**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ type: 'BUSINESS_DATE', date: [2026, 9, 5] }]),
    }),
  );

  await page.goto('/login');
  await page.locator('#tenantId').fill('default');
  await page.locator('#username').fill('mifos');
  await page.locator('#password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

test('shows a not-found state and returns to the list, without an error toast', async ({
  page,
}, testInfo) => {
  await signIn(page);
  await mockEmptyAccounts(page);

  await page.route(CLIENT_DETAIL_RE, (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        developerMessage: 'The requested resource is not available.',
        defaultUserMessage: `Client with identifier ${CLIENT_ID} does not exist`,
        errors: [
          {
            developerMessage: `The requested resource is not available.`,
            defaultUserMessage: `Client not found with valuer ${CLIENT_ID}`,
            parameterName: 'id',
          },
        ],
      }),
    }),
  );

  await page.goto(CLIENT_URL);

  const errorState = page.getByTestId('client-load-error');
  await expect(errorState).toBeVisible();
  // The old behaviour: a toast carrying the raw backend body. It must not appear alongside,
  // or instead of, the in-content state.
  await expect(page.locator('ion-toast')).toHaveCount(0);

  const screenshot = testInfo.outputPath('client-not-found.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('client not-found state', { path: screenshot, contentType: 'image/png' });

  await page.getByTestId('client-load-error-action').click();
  await expect(page).toHaveURL('/clients');
});

test('offers a retry for a transient failure, and recovers on success', async ({
  page,
}, testInfo) => {
  await signIn(page);
  await mockEmptyAccounts(page);

  await page.route(CLIENT_DETAIL_RE, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );

  await page.goto(CLIENT_URL);

  const errorState = page.getByTestId('client-load-error');
  await expect(errorState).toBeVisible();
  await expect(page.locator('ion-toast')).toHaveCount(0);

  const screenshot = testInfo.outputPath('client-load-failed.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('client load-failed state', {
    path: screenshot,
    contentType: 'image/png',
  });

  await page.route(CLIENT_DETAIL_RE, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: CLIENT_ID,
        accountNo: '099999',
        displayName: 'Recovered Client',
        firstname: 'Recovered',
        lastname: 'Client',
        officeName: HEAD_OFFICE,
        status: { id: 300, value: 'Active' },
      }),
    }),
  );

  await page.getByTestId('client-load-error-action').click();
  await expect(errorState).toHaveCount(0);
  await expect(page.getByText('Recovered Client')).toBeVisible();
});
