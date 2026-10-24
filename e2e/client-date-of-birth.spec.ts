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
  await page.route('**/api/v1/configurations/name/enable-business-date**', (route) =>
    route.fulfill({ json: { name: 'enable-business-date', enabled: false } }),
  );
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

async function openPersonalDetails(page: Page): Promise<void> {
  await page.route('**/api/v1/offices**', (route) =>
    route.fulfill({
      json: [
        {
          id: 1,
          name: 'Synthetic Office',
          nameDecorated: 'Synthetic Office',
          hierarchy: '.',
          openingDate: [2009, 1, 1],
        },
      ],
    }),
  );
  await page.route('**/api/v1/clients**', (route) =>
    route.fulfill({
      json:
        route.request().method() === 'POST'
          ? { clientId: 2001 }
          : {
              id: 2001,
              firstname: 'Synthetic',
              lastname: 'Client',
              legalFormId: 1,
              officeId: 1,
              active: true,
              loanAccounts: [],
              savingsAccounts: [],
            },
    }),
  );
  await page.goto('/clients/create');
  await expect(page.locator('ion-card-title').getByTestId('help-icon')).toHaveAccessibleName(
    'Create a client by choosing a type and office, then entering their details.',
  );
  await page.locator('ion-select[name="legalFormId"]').click();
  await page.locator('ion-alert, ion-popover').getByRole('radio', { name: 'Person' }).click();
  await page.locator('ion-select[name="officeId"]').click();
  await page.locator('ion-alert, ion-popover').getByRole('radio').first().click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
}

const dobButton = (page: Page) =>
  page.locator('ion-datetime-button[datetime="dateOfBirth-picker"]');
const dobPicker = (page: Page) => page.getByTestId('dateOfBirth-picker');

async function chooseToday(page: Page): Promise<void> {
  await dobButton(page).click();
  await page.locator('#dateOfBirth-picker button.calendar-day-today').click();
  await page.keyboard.press('Escape');
  await expect(dobPicker(page)).not.toBeVisible();
}

async function submitSyntheticClient(page: Page) {
  await page.locator('input[name="firstname"]').fill('Synthetic');
  await page.locator('input[name="lastname"]').fill('Client');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const submitted = page.waitForRequest(
    (request) => request.method() === 'POST' && /\/clients(?:\?|$)/.test(request.url()),
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  return (await submitted).postDataJSON();
}

test.use({ video: 'on' });
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`optional client DOB at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('unset, dismissed and cleared DOB stays absent, including on revisit', async ({
      page,
    }, testInfo) => {
      await signIn(page);
      await openPersonalDetails(page);
      await expect(
        dobButton(page).getByRole('button', { name: 'Not set', exact: true }),
      ).toBeVisible();
      // Merely opening and dismissing a picker must not fabricate a DOB.
      await dobButton(page).click();
      await expect(dobPicker(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dobPicker(page)).not.toBeVisible();
      await expect(
        dobButton(page).getByRole('button', { name: 'Not set', exact: true }),
      ).toBeVisible();
      await chooseToday(page);
      // Clear after a rejected save, when the request object already contains a DOB.
      let attempts = 0;
      await page.route(/\/api\/v1\/clients(?:\?.*)?$/, (route) => {
        attempts++;
        return route.fulfill(
          attempts === 1
            ? { status: 400, json: { defaultUserMessage: 'Synthetic validation failure' } }
            : { json: { clientId: 2001 } },
        );
      });
      expect(await submitSyntheticClient(page)).toHaveProperty('dateOfBirth');
      await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      const clear = page.getByRole('button', { name: 'Clear date of birth', exact: true });
      await expect(clear).toBeVisible();
      await clear.click();
      await expect(
        dobButton(page).getByRole('button', { name: 'Not set', exact: true }),
      ).toBeVisible();
      await expect(page).toHaveURL('/clients/create');
      const size = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
      await page.screenshot({ path: testInfo.outputPath('empty-dob.png'), fullPage: true });
      expect(await submitSyntheticClient(page)).not.toHaveProperty('dateOfBirth');
      await expect(page).toHaveURL('/clients/view/2001');
      // Navigate in-app, so Ionic's cached picker chunks exercise its revisit lifecycle.
      await page.goBack();
      await expect(page).toHaveURL('/clients/create');
      await page.locator('ion-select[name="legalFormId"]').click();
      await page.locator('ion-alert, ion-popover').getByRole('radio', { name: 'Person' }).click();
      await page.locator('ion-select[name="officeId"]').click();
      await page.locator('ion-alert, ion-popover').getByRole('radio').first().click();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(
        dobButton(page).getByRole('button', { name: 'Not set', exact: true }),
      ).toBeVisible();
      await dobButton(page).click();
      await expect(dobPicker(page)).toBeVisible();
    });

    test('an explicitly chosen DOB keeps its calendar day in the submitted payload', async ({
      page,
    }, testInfo) => {
      await signIn(page);
      await openPersonalDetails(page);
      await chooseToday(page);
      await expect(
        dobButton(page).getByRole('button', { name: 'Not set', exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Clear date of birth', exact: true }),
      ).toBeVisible();
      const expectedDate = await page.evaluate(() =>
        new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(
          new Date(),
        ),
      );
      await page.screenshot({ path: testInfo.outputPath('selected-dob.png'), fullPage: true });
      expect(await submitSyntheticClient(page)).toHaveProperty('dateOfBirth', expectedDate);
    });
  });
}
