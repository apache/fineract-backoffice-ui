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

import { test, expect } from './fixtures';

test.describe('Reporting', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept config.json
    await page.route('**/config.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fineractApiUrl: '/api/v1',
          defaultTenant: 'default',
        }),
      });
    });

    // Intercept Authentication API
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
          roles: [{ id: 1, name: 'Super User', description: 'Super user' }],
          permissions: ['ALL_FUNCTIONS'],
        }),
      });
    });

    // Intercept Reports API
    await page.route('**/api/v1/reports**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            reportName: 'Active Clients Summary',
            reportType: 'Table',
            reportSubType: 'Detailed',
            reportCategory: 'Client',
            useReport: true,
          },
          {
            id: 2,
            reportName: 'Active Loans Summary',
            reportType: 'Table',
            reportSubType: 'Detailed',
            reportCategory: 'Loan',
            useReport: true,
          },
        ]),
      });
    });

    await page.route('**/api/v1/runreports/FullParameterList**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/login');
    await page.locator('#tenantId').fill('default');
    await page.locator('#username').fill('mifos');
    await page.locator('#password').fill('password');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display list of reports', async ({ page }) => {
    // Navigate to Reporting
    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page).toHaveURL('/reporting');
    await expect(page.locator('ion-card-title').first()).toContainText('Reports');

    // Verify some report types are visible
    await expect(page.locator('table')).toContainText('Client');
    await expect(page.locator('table')).toContainText('Loan');
  });

  test('should navigate to run report page', async ({ page }) => {
    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page).toHaveURL('/reporting');

    // Click on the first report's Run button
    await page.getByRole('button', { name: 'Run' }).first().click();

    // Should be on run-report page
    await expect(page).toHaveURL(/\/reporting\/run\//);
    await expect(page.locator('ion-card-title')).toContainText('Active Clients Summary');
  });
});
