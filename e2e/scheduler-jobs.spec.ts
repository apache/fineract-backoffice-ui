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
 * Covers the bulk-select + "Run Selected" affordance on the Scheduler Jobs list — ported from
 * web-app, which offers the same bulk trigger over its job list — and editing a job's schedule.
 * Mocked throughout.
 */

import { test, expect, Page } from './fixtures';
import { confirmDialog } from './utils/ionic-locators';

const TENANT = 'default';
const USER = 'mifos';
const PASSWORD = 'password';

async function mockSchedulerJobs(page: Page) {
  await page.route(/\/api\/v1\//, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/config.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fineractApiUrl: '/api/v1', defaultTenant: TENANT }),
    });
  });
  await page.route('**/api/v1/authentication**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        username: USER,
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: 'Head Office',
        roles: [{ id: 1, name: 'Role', description: 'Role' }],
        permissions: ['ALL_FUNCTIONS'],
      }),
    });
  });
  await page.route(/\/api\/v1\/businessdate/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ type: 'BUSINESS_DATE', date: [2026, 8, 16] }]),
    });
  });

  await page.route('**/api/v1/scheduler', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ active: true }),
    });
  });
  await page.route('**/api/v1/jobs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { jobId: 1, displayName: 'Update Loan Summary', active: true, nextRunTime: '01 Jan 2026' },
        { jobId: 2, displayName: 'Update NPA', active: true, nextRunTime: '01 Jan 2026' },
      ]),
    });
  });
  await page.route(/\/api\/v1\/jobs\/\d+(\?|$)/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT);
  await page.locator('#username').fill(USER);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

test.describe('Scheduler Jobs bulk run', () => {
  test.beforeEach(async ({ page }) => {
    await mockSchedulerJobs(page);
    await login(page);
    await page.goto('/system/scheduler-jobs');
    await expect(page.getByRole('cell', { name: 'Update Loan Summary' })).toBeVisible();
  });

  test('Run Selected is disabled until a job is checked', async ({ page }) => {
    const runSelected = page.getByRole('button', { name: /Run Selected/ });
    await expect(runSelected).toBeDisabled();

    await page
      .getByRole('row', { name: /Update Loan Summary/ })
      .locator('ion-checkbox')
      .click();
    await expect(runSelected).toBeEnabled();
  });

  test('Select All checks every job, and running confirms then triggers each one', async ({
    page,
  }) => {
    await page.locator('ion-checkbox[aria-label="Select All"]').click();

    const runRequests: string[] = [];
    await page.route(/\/api\/v1\/jobs\/\d+(\?|$)/, async (route) => {
      runRequests.push(new URL(route.request().url()).pathname);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.getByRole('button', { name: /Run Selected/ }).click();
    await confirmDialog(page).getByTestId('confirm-dialog-confirm').click();

    await expect.poll(() => runRequests.length).toBe(2);
    expect(runRequests).toContain('/api/v1/jobs/1');
    expect(runRequests).toContain('/api/v1/jobs/2');

    // Selection clears once the run completes.
    await expect(page.getByRole('button', { name: /Run Selected/ })).toBeDisabled();
  });

  test('declining the confirmation runs nothing', async ({ page }) => {
    await page
      .getByRole('row', { name: /Update NPA/ })
      .locator('ion-checkbox')
      .click();

    let ran = false;
    await page.route(/\/api\/v1\/jobs\/\d+(\?|$)/, async (route) => {
      ran = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.getByRole('button', { name: /Run Selected/ }).click();
    await confirmDialog(page).getByTestId('confirm-dialog-cancel').click();

    expect(ran).toBe(false);
  });
});

test.describe('Scheduler Jobs edit', () => {
  test("changes a job's schedule and active flag, refusing an invalid expression first", async ({
    page,
  }) => {
    await mockSchedulerJobs(page);
    const job = {
      jobId: 1,
      displayName: 'Update Loan Summary',
      cronExpression: '0 0 0 1/1 * ? *',
      active: true,
      currentlyRunning: false,
    };
    let sent: unknown;
    await page.route(/\/api\/v1\/jobs\/1(\?|$)/, async (route) => {
      if (route.request().method() === 'PUT') {
        sent = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ resourceId: 1, changes: {} }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(job),
      });
    });
    await login(page);
    await page.goto('/system/scheduler-jobs');

    await page
      .getByRole('row', { name: /Update Loan Summary/ })
      .getByTestId('scheduler-job-edit')
      .click();
    await expect(page).toHaveURL('/system/scheduler-jobs/1/edit');

    const cron = page.getByTestId('scheduler-job-cron');
    await expect(cron).toHaveValue('0 0 0 1/1 * ? *');
    await expect(page.getByTestId('scheduler-job-next-runs').locator('li')).toHaveCount(3);

    // A Unix-style line: valid there, refused by Quartz because both day fields are set.
    await cron.fill('0 30 1 * * *');
    await expect(page.getByTestId('scheduler-job-cron-error')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

    await cron.fill('0 30 1 * * ?');
    await page.getByTestId('scheduler-job-active').uncheck();
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL('/system/scheduler-jobs');
    // Only what changed: the name was left alone, so it is not sent back.
    expect(sent).toEqual({ cronExpression: '0 30 1 * * ?', active: false });
  });

  test('stays on the form when Fineract refuses the change', async ({ page }) => {
    await mockSchedulerJobs(page);
    const job = {
      jobId: 1,
      displayName: 'Update Loan Summary',
      cronExpression: '0 0 0 1/1 * ? *',
      active: true,
      currentlyRunning: false,
    };
    await page.route(/\/api\/v1\/jobs\/1(\?|$)/, async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            httpStatusCode: '400',
            defaultUserMessage: 'Validation errors exist.',
            errors: [
              {
                userMessageGlobalisationCode: 'validation.msg.schedulerjob.cronExpression.invalid',
                defaultUserMessage:
                  'The parameter `cronExpression` value is not a valid cron expression',
                parameterName: 'cronExpression',
              },
            ],
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(job),
      });
    });
    await login(page);
    await page.goto('/system/scheduler-jobs/1/edit');

    await page.getByTestId('scheduler-job-active').uncheck();
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL('/system/scheduler-jobs/1/edit');
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
