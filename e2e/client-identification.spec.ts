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
        permissions: ['READ_CLIENT'],
      }),
    });
  });
  await page.route('**/api/v1/businessdate**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ type: 'BUSINESS_DATE', date: [2026, 9, 5] }]),
    });
  });

  await page.goto('/login');
  await page.locator('#tenantId').fill('default');
  await page.locator('#username').fill('mifos');
  await page.locator('#password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`client identification at ${viewport.width}px`, () => {
    test.use({ viewport, timezoneId: 'America/New_York' });
    test('a reader sees saved contact details and no stale values on the next client', async ({
      page,
    }, testInfo) => {
      const writes: string[] = [];
      page.on('request', (request) => {
        if (/\/api\/v1\/clients\//.test(request.url()) && request.method() !== 'GET')
          writes.push(request.method());
      });
      await page.route('**/api/v1/clients/**', (route) => {
        if (/\/accounts(?:\?|$)/.test(route.request().url()))
          return route.fulfill({ json: { loanAccounts: [], savingsAccounts: [] } });
        const id = Number(/\/clients\/(\d+)/.exec(route.request().url())?.[1]);
        return route.fulfill({
          json: {
            id,
            accountNo: `SYNTHETIC-${id}`,
            displayName: 'Synthetic Profile',
            firstname: 'Synthetic',
            lastname: 'Profile',
            officeName: 'Synthetic Office',
            status: { id: 300, value: 'Active' },
            ...(id === 2002
              ? {}
              : {
                  mobileNo: '+1 202 555 0147',
                  dateOfBirth: id === 2003 ? '1990-05-15' : [1990, 5, 15],
                }),
          },
        });
      });
      await signIn(page);
      await page.goto(CLIENT_URL);
      const expectedDOB = await page.evaluate(() => new Date(1990, 4, 15).toLocaleDateString());
      await expect(page.getByTestId('client-mobile-number')).toHaveText('+1 202 555 0147');
      await expect(page.getByTestId('client-date-of-birth')).toHaveText(expectedDOB);
      await page.getByTestId('client-date-of-birth').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath('saved-identification.png'),
        fullPage: true,
      });
      await page.getByTestId('client-mobile-number').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('saved-contact.png'), fullPage: true });
      const size = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
      await page.goto('/clients/view/2002');
      await expect(page.getByTestId('client-mobile-number')).toHaveText('—');
      await expect(page.getByTestId('client-date-of-birth')).toHaveText('—');
      await page.screenshot({
        path: testInfo.outputPath('missing-identification.png'),
        fullPage: true,
      });
      await page.goto('/clients/view/2003');
      await expect(page.getByTestId('client-date-of-birth')).toHaveText(expectedDOB);
      expect(writes).toEqual([]);
    });
  });
}
