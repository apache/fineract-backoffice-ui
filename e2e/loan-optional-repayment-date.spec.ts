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

  // Dashboard summaries are outside this journey; keep every request synthetic.
  await page.route(/\/api\/v1\/(clients|loans|savingsaccounts)\?/, (route) =>
    route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } }),
  );

  await page.goto('/login');
  await page.locator('#tenantId').fill('default');
  await page.locator('#username').fill('mifos');
  await page.locator('#password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

const pickerId = 'repaymentsStartingFromDate-picker';
const dateButton = (page: Page) => page.locator(`ion-datetime-button[datetime="${pickerId}"]`);
const product = {
  id: 3,
  name: 'Synthetic Loan',
  principal: 1000,
  numberOfRepayments: 12,
  repaymentEvery: 1,
  repaymentFrequencyType: { id: 2 },
  interestRatePerPeriod: 10,
  interestType: { id: 0 },
  amortizationType: { id: 1 },
  interestCalculationPeriodType: { id: 1 },
  transactionProcessingStrategyCode: 'mifos-standard-strategy',
};

async function openForm(page: Page) {
  await page.goto('/loans/create?clientId=7');
  await page.locator('ion-select[name="productId"]').click();
  await page
    .locator('ion-popover, ion-alert')
    .getByRole('radio', { name: 'Synthetic Loan', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
}

async function submit(page: Page) {
  const request = page.waitForRequest(
    (r) => r.method() === 'POST' && /\/loans(?:\?|$)/.test(r.url()),
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  return (await request).postDataJSON();
}

test.use({ video: 'on' });
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`optional repayment date at ${viewport.width}px`, () => {
    test.use({ viewport });
    test('edit dates reflect the stored value without silently submitting it', async ({
      page,
    }, testInfo) => {
      await signIn(page);
      await page.route('**/api/v1/clients/7**', (route) =>
        route.fulfill({ json: { id: 7, displayName: 'Synthetic Client' } }),
      );
      await page.route('**/api/v1/loanproducts**', (route) =>
        route.fulfill({
          json: /\/loanproducts\/3(?:\?|$)/.test(route.request().url()) ? product : [product],
        }),
      );
      let storedDate: number[] | null = [2026, 4, 30];
      await page.route('**/api/v1/loans/7**', (route) =>
        route.fulfill({
          json:
            route.request().method() === 'PUT'
              ? { loanId: 7 }
              : {
                  ...product,
                  id: 7,
                  accountNo: 'SYNTHETIC7',
                  clientId: 7,
                  clientName: 'Synthetic Client',
                  loanProductId: 3,
                  termFrequency: 12,
                  termPeriodFrequencyType: { id: 2 },
                  status: { id: 100, value: 'Submitted' },
                  timeline: {
                    submittedOnDate: [2026, 4, 1],
                    expectedDisbursementDate: [2026, 4, 2],
                  },
                  expectedFirstRepaymentOnDate: storedDate,
                  summary: {},
                },
        }),
      );
      const saveEdit = async () => {
        const update = page.waitForRequest(
          (request) => request.method() === 'PUT' && /\/loans\/7(?:\?|$)/.test(request.url()),
        );
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        const body = (await update).postDataJSON();
        await expect(page).toHaveURL(/\/loans\/view\/7$/);
        return body;
      };

      await page.goto('/loans/edit/7');
      await expect(dateButton(page).getByRole('button')).toContainText('2026');
      await dateButton(page).click();
      const picker = page.getByTestId(pickerId);
      await expect(picker.getByRole('button', { name: /Thursday, April 30/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await page.keyboard.press('Escape');
      await expect(picker).not.toBeVisible();
      await page
        .locator('ion-item')
        .filter({ has: dateButton(page) })
        .screenshot({
          path: testInfo.outputPath('stored-edit-repayment-date.png'),
        });
      expect(await saveEdit()).not.toHaveProperty('repaymentsStartingFromDate');

      await page.goto('/loans/edit/7');
      await dateButton(page).click();
      await picker.getByRole('button', { name: /Wednesday, April 29/ }).click();
      await page.keyboard.press('Escape');
      await expect(picker).not.toBeVisible();
      expect(await saveEdit()).toHaveProperty('repaymentsStartingFromDate', '29 April 2026');

      storedDate = null;
      await page.goto('/loans/edit/7');
      await expect(
        dateButton(page).getByRole('button', { name: 'Not set', exact: true }),
      ).toBeVisible();
      await expect(page.getByTestId('clear-repayment-start-date')).toHaveCount(0);
      await page
        .locator('ion-item')
        .filter({ has: dateButton(page) })
        .screenshot({
          path: testInfo.outputPath('unset-edit-repayment-date.png'),
        });
    });

    test('unset, selected and cleared create dates match their submitted fields', async ({
      page,
    }, testInfo) => {
      await signIn(page);
      await page.route('**/api/v1/clients/7**', (route) =>
        route.fulfill({
          json: {
            id: 7,
            displayName: 'Synthetic Client',
            firstname: 'Synthetic',
            lastname: 'Client',
          },
        }),
      );
      await page.route('**/api/v1/loanproducts**', (route) =>
        route.fulfill({
          json: /\/loanproducts\/3(?:\?|$)/.test(route.request().url()) ? product : [product],
        }),
      );
      let attempts = 0;
      await page.route(/\/api\/v1\/loans(?:\?.*)?$/, (route) => {
        attempts++;
        return route.fulfill(
          attempts === 1
            ? { status: 400, json: { defaultUserMessage: 'Synthetic rejected create' } }
            : { json: { loanId: 7 } },
        );
      });
      await page.route('**/api/v1/loans/7**', (route) =>
        route.fulfill({
          json: {
            id: 7,
            accountNo: 'SYNTHETIC7',
            clientId: 7,
            clientName: 'Synthetic Client',
            status: { id: 100, value: 'Submitted' },
            summary: {},
            timeline: {},
          },
        }),
      );
      await openForm(page);
      await expect(
        dateButton(page).getByRole('button', { name: 'Not set', exact: true }),
      ).toBeVisible();
      await dateButton(page).click();
      await expect(page.getByTestId(pickerId)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId(pickerId)).not.toBeVisible();
      await expect(
        dateButton(page).getByRole('button', { name: 'Not set', exact: true }),
      ).toBeVisible();
      await dateButton(page).click();
      await page.locator(`#${pickerId} button.calendar-day-today`).click();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId(pickerId)).not.toBeVisible();
      await expect(
        dateButton(page).getByRole('button', { name: 'Not set', exact: true }),
      ).toHaveCount(0);
      const expected = await page.evaluate(() =>
        new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(
          new Date(),
        ),
      );
      await page
        .getByRole('button', { name: 'Clear repayment start date', exact: true })
        .scrollIntoViewIfNeeded();
      await page
        .locator('ion-item')
        .filter({ has: dateButton(page) })
        .screenshot({ path: testInfo.outputPath('selected-date-field.png') });
      await page.screenshot({
        path: testInfo.outputPath('selected-repayment-date.png'),
        fullPage: true,
      });
      expect(await submit(page)).toHaveProperty('repaymentsStartingFromDate', expected);
      await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Clear repayment start date', exact: true }).click();
      await expect(
        dateButton(page).getByRole('button', { name: 'Not set', exact: true }),
      ).toBeVisible();
      expect(attempts).toBe(1);
      const size = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
      await page
        .locator('ion-item')
        .filter({ has: dateButton(page) })
        .screenshot({ path: testInfo.outputPath('unset-date-field.png') });
      await page.screenshot({
        path: testInfo.outputPath('unset-repayment-date.png'),
        fullPage: true,
      });
      expect(await submit(page)).not.toHaveProperty('repaymentsStartingFromDate');
      await expect(page).toHaveURL('/loans/view/7');
      await page.goBack();
      await expect(
        dateButton(page).getByRole('button', { name: 'Not set', exact: true }),
      ).toBeVisible();
      await dateButton(page).click();
      await expect(page.getByTestId(pickerId)).toBeVisible();
    });
  });
}
