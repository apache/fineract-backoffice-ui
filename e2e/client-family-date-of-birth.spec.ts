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
  await page.route(
    /\/(?:fineract-provider\/)?api\/v1\/(?:clients|loans|savingsaccounts)(?:\?|$)/,
    (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } })
        : route.fallback(),
  );
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

const familyButton = (page: Page) =>
  page.locator('ion-datetime-button[datetime="family-dob-picker"]');
test.use({ video: 'on' });
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`family DOB and edit help at ${viewport.width}px`, () => {
    test.use({ viewport });
    test('edit shows the loaded or unset DOB and preserves the existing save contract', async ({
      page,
    }, testInfo) => {
      await page.route('**/api/v1/loans/due**', (route) =>
        route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } }),
      );
      await page.route('**/api/v1/runreports/**', (route) =>
        route.fulfill({ json: { columnHeaders: [], data: [] } }),
      );
      await signIn(page);
      await page.route('**/api/v1/clients/**', (route) =>
        route.fulfill({
          json: {
            id: 7,
            firstname: 'Synthetic',
            lastname: 'Client',
            legalFormId: 1,
            officeId: 1,
            active: true,
          },
        }),
      );
      await page.route('**/api/v1/clients/7/familymembers/template**', (route) =>
        route.fulfill({
          json: {
            relationshipIdOptions: [{ id: 1, name: 'Sibling' }],
          },
        }),
      );
      let storedDate: number[] | null = [1980, 4, 30];
      await page.route(/\/api\/v1\/clients\/7\/familymembers\/8(?:\?.*)?$/, (route) =>
        route.fulfill({
          json:
            route.request().method() === 'PUT'
              ? { resourceId: 8 }
              : {
                  id: 8,
                  firstName: 'Synthetic',
                  lastName: 'Sibling',
                  relationshipId: 1,
                  dateOfBirth: storedDate,
                },
        }),
      );
      const saveEdit = async () => {
        const request = page.waitForRequest(
          (request) => request.method() === 'PUT' && /familymembers\/8(?:\?|$)/.test(request.url()),
        );
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        const payload = (await request).postDataJSON();
        await expect(page).toHaveURL('/clients/view/7');
        return payload;
      };
      const picker = page.getByTestId('family-dob-picker');
      await page.goto('/clients/7/family-members/edit/8');
      await expect(familyButton(page)).toContainText(/Apr.*30.*1980/);
      await familyButton(page).click();
      await expect(picker.getByRole('button', { name: /Wednesday, April 30/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await page.keyboard.press('Escape');
      await expect(picker).not.toBeVisible();
      await page
        .locator('ion-item')
        .filter({ has: familyButton(page) })
        .screenshot({ path: testInfo.outputPath('stored-family-edit-dob.png') });
      expect(await saveEdit()).toHaveProperty('dateOfBirth', '30 April 1980');
      await page.goto('/clients/7/family-members/edit/8');
      await familyButton(page).click();
      await picker.getByRole('button', { name: /Tuesday, April 29/ }).click();
      await page.keyboard.press('Escape');
      await expect(picker).not.toBeVisible();
      expect(await saveEdit()).toHaveProperty('dateOfBirth', '29 April 1980');
      storedDate = null;
      await page.goto('/clients/7/family-members/edit/8');
      const unset = familyButton(page).getByRole('button', { name: 'Not set', exact: true });
      await expect(unset).toBeVisible();
      await expect(page.getByTestId('clear-family-date-of-birth')).toHaveCount(0);
      await familyButton(page).click();
      await page.keyboard.press('Escape');
      await expect(picker).not.toBeVisible();
      await expect(unset).toBeVisible();
      await page
        .locator('ion-item')
        .filter({ has: familyButton(page) })
        .screenshot({ path: testInfo.outputPath('unset-family-edit-dob.png') });
      const size = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
      expect(await saveEdit()).not.toHaveProperty('dateOfBirth');
    });
    test('unset, chosen and cleared family DOB matches the submitted field; edit help describes editing', async ({
      page,
    }, testInfo) => {
      await signIn(page);
      await page.route('**/api/v1/offices**', (route) =>
        route.fulfill({
          json: [{ id: 1, name: 'Synthetic Office', nameDecorated: 'Synthetic Office' }],
        }),
      );
      await page.route('**/api/v1/clients/**', (route) =>
        route.fulfill({
          json: {
            id: 7,
            firstname: 'Synthetic',
            lastname: 'Client',
            legalFormId: 1,
            officeId: 1,
            active: true,
            submittedOnDate: [2026, 9, 5],
            activationDate: [2026, 9, 5],
          },
        }),
      );
      await page.route('**/api/v1/clients/7/familymembers/template**', (route) =>
        route.fulfill({ json: { relationshipIdOptions: [{ id: 1, name: 'Sibling' }] } }),
      );
      let attempts = 0;
      await page.route(/\/api\/v1\/clients\/7\/familymembers(?:\?.*)?$/, (route) => {
        if (route.request().method() !== 'POST') return route.fulfill({ json: [] });
        attempts++;
        return route.fulfill(
          attempts === 1
            ? { status: 400, json: { defaultUserMessage: 'Synthetic failed save' } }
            : { json: { resourceId: 8 } },
        );
      });
      await page.goto('/clients/7/family-members/create');
      const unset = () => familyButton(page).getByRole('button', { name: 'Not set', exact: true });
      await expect(unset()).toBeVisible();
      await familyButton(page).click();
      await expect(page.getByTestId('family-dob-picker')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('family-dob-picker')).not.toBeVisible();
      await expect(unset()).toBeVisible();
      await familyButton(page).click();
      await page.locator('#family-dob-picker button.calendar-day-today').click();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('family-dob-picker')).not.toBeVisible();
      await expect(unset()).toHaveCount(0);
      const expectedDate = await page.evaluate(() =>
        new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(
          new Date(),
        ),
      );
      await page
        .locator('ion-item')
        .filter({ has: familyButton(page) })
        .screenshot({ path: testInfo.outputPath('selected-family-dob.png') });
      await page.locator('#family-first-name-input input').fill('Synthetic');
      await page.locator('#family-last-name-input input').fill('Sibling');
      await page.getByTestId('family-relationship-select').click();
      await page.locator('ion-alert, ion-popover').getByRole('radio', { name: 'Sibling' }).click();
      const first = page.waitForRequest(
        (request) => request.method() === 'POST' && /familymembers(?:\?|$)/.test(request.url()),
      );
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      expect((await first).postDataJSON()).toHaveProperty('dateOfBirth', expectedDate);
      await expect.poll(() => attempts).toBe(1);
      await page.getByRole('button', { name: 'Clear date of birth', exact: true }).click();
      await expect(unset()).toBeVisible();
      expect(attempts).toBe(1);
      await page
        .locator('ion-item')
        .filter({ has: familyButton(page) })
        .screenshot({ path: testInfo.outputPath('unset-family-dob.png') });
      const size = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
      const retry = page.waitForRequest(
        (request) => request.method() === 'POST' && /familymembers(?:\?|$)/.test(request.url()),
      );
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      expect((await retry).postDataJSON()).not.toHaveProperty('dateOfBirth');
      await expect(page).toHaveURL('/clients/view/7');
      await page.goto('/clients/edit/7');
      await expect(page.locator('ion-card-title').getByTestId('help-icon')).toHaveAccessibleName(
        "Update this client's details.",
      );
      await page
        .locator('ion-card-title')
        .screenshot({ path: testInfo.outputPath('edit-help.png') });
    });
  });
}
