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

import { expect, test, type Page } from './fixtures';

const CLIENT_ID = 2001;
const CLIENT_URL = `/clients/view/${CLIENT_ID}`;

test.use({ video: 'on' });

async function signIn(page: Page): Promise<void> {
  await page.route('**/config.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fineractApiUrl: '/api/v1', defaultTenant: 'default' }),
    });
  });
  await page.route('**/api/v1/authentication**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        username: 'mifos',
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: 'Head Office',
        permissions: ['ALL_FUNCTIONS'],
      }),
    });
  });

  await page.goto('/login');
  await page.locator('#tenantId').fill('default');
  await page.locator('#username').fill('mifos');
  await page.locator('#password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

async function mockClientWithoutAccounts(page: Page): Promise<void> {
  await page.route('**/api/v1/clients/2001**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: CLIENT_ID,
        accountNo: '000002001',
        displayName: 'Empty Account Client',
        firstname: 'Empty',
        lastname: 'Client',
        officeName: 'Head Office',
        status: { id: 300, value: 'Active' },
      }),
    });
  });
  await page.route('**/api/v1/clients/2001/accounts**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ loanAccounts: [], savingsAccounts: [] }),
    });
  });
}

test('empty account tabs offer the matching creation action', async ({ page }, testInfo) => {
  await signIn(page);
  await mockClientWithoutAccounts(page);
  await page.goto(CLIENT_URL);

  await page.getByRole('tab', { name: 'Savings Accounts', exact: true }).click({ force: true });
  const savingsAction = page.getByTestId('client-create-savings-account');
  await expect(savingsAction).toBeVisible();

  const screenshot = testInfo.outputPath('empty-savings-account-cta.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('empty Savings Accounts CTA', {
    path: screenshot,
    contentType: 'image/png',
  });

  await savingsAction.click();
  await expect(page).toHaveURL('/products/savings-accounts/create?clientId=2001');

  await page.goto(CLIENT_URL);
  await page.getByRole('tab', { name: 'Loan Accounts', exact: true }).click({ force: true });
  const loanAction = page.getByTestId('client-create-loan-account');
  await expect(loanAction).toBeVisible();

  const loanScreenshot = testInfo.outputPath('empty-loan-account-cta.png');
  await page.screenshot({ path: loanScreenshot, fullPage: true });
  await testInfo.attach('empty Loan Accounts CTA', {
    path: loanScreenshot,
    contentType: 'image/png',
  });

  await loanAction.click();
  await expect(page).toHaveURL('/loans/create?clientId=2001');
});
