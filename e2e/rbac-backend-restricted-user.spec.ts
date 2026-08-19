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
 * Route authorization, against a genuinely restricted Fineract user.
 *
 * `rbac-route-protection.spec.ts` covers the permission matrix by mocking the authentication
 * response, which is fast and exhaustive but proves only that the client is self-consistent.
 * This spec seeds a real role, grants it real permission codes, creates a real user, and signs
 * in as them — so the session under test is the platform's own answer rather than a fixture.
 *
 * Every refusal is then checked twice: once as "the router sent them to Access Denied", and
 * once as "Fineract returned 403 for the same operation". The second assertion is the reason
 * this spec exists. The Angular guard is defence-in-depth and does not replace server-side
 * authorization; showing that the two agree is worth something, and showing only the first
 * would quietly invite the opposite conclusion.
 */

import { test, expect, Page } from './fixtures';
import { landsOn } from './utils/settled-route';
import { login, PASSWORD, SERVER_URL, TENANT_ID, USERNAME } from './utils/fineract-login';
import {
  createApiContext,
  ensureReferenceData,
  seedActiveLoan,
  seedRestrictedUser,
  statusAs,
  SeededRestrictedUser,
} from './utils/seed-api';

// Seeding a role and a user, then two full sign-ins and several direct navigations.
test.describe.configure({ mode: 'serial', timeout: 180_000 });

let restricted: SeededRestrictedUser;

test.beforeAll(async () => {
  const api = await createApiContext();
  try {
    // READ_CLIENT and nothing else: enough to reach the client list, not enough for the client
    // form, and nothing at all for accounting.
    restricted = await seedRestrictedUser(api, ['READ_CLIENT']);
  } finally {
    await api.dispose();
  }
});

/** Signs in as a seeded restricted user rather than as the suite's superuser. */
async function loginAs(page: Page, user: SeededRestrictedUser): Promise<void> {
  await page.goto('/login');
  const serverSelect = page.locator('#serverUrl');
  await serverSelect.waitFor({ state: 'visible' });
  const preset = await serverSelect.locator(`option[value="${SERVER_URL}"]`).count();
  if (preset > 0) {
    await serverSelect.selectOption(SERVER_URL);
  } else {
    await serverSelect.selectOption('custom');
    await page.locator('#customUrl').fill(SERVER_URL);
  }
  await page.locator('#tenantId').fill(TENANT_ID);
  await page.locator('#username').fill(user.username);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('navigation', { name: 'Main Navigation' })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('a genuinely restricted Fineract user', () => {
  test('holds exactly the permissions their role was granted', async () => {
    // Guards the rest of the spec: were the seed to grant more than asked, every later
    // assertion would still pass and prove nothing.
    expect(restricted.permissions).toEqual(['READ_CLIENT']);
    expect(await statusAs(restricted, 'GET', '/clients')).toBe(200);
  });

  test('reaches the screen their permission covers', async ({ page }) => {
    await loginAs(page, restricted);
    expect(await landsOn(page, '/clients')).toBe('/clients');
    await expect(page.getByRole('link', { name: 'Clients', exact: true })).toBeVisible();
  });

  test('is refused a screen their permission does not cover, by URL and by the backend', async ({
    page,
  }) => {
    await loginAs(page, restricted);

    // The client refuses the navigation...
    expect(await landsOn(page, '/accounting/chart-of-accounts')).toBe('/forbidden');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // ...and Fineract refuses the request that screen would have made. Both must hold: the
    // first alone would be a client that merely looks strict.
    expect(await statusAs(restricted, 'GET', '/glaccounts')).toBe(403);
    expect(await statusAs(restricted, 'GET', '/offices')).toBe(403);
  });

  test('is refused a write screen they can read the list for, and the write itself', async ({
    page,
  }) => {
    await loginAs(page, restricted);

    // READ_CLIENT opens the list but not the form: the two routes declare different codes.
    expect(await landsOn(page, '/clients')).toBe('/clients');
    expect(await landsOn(page, '/clients/create')).toBe('/forbidden');

    // And the create the form would have posted is refused by the platform too.
    expect(
      await statusAs(restricted, 'POST', '/clients', {
        officeId: 1,
        firstname: 'Should',
        lastname: 'NotBeCreated',
        legalFormId: 1,
        active: false,
        locale: 'en',
        dateFormat: 'dd MMMM yyyy',
        submittedOnDate: '01 January 2026',
      }),
    ).toBe(403);
  });

  test('is not offered the actions it would be refused for', async ({ page }) => {
    await loginAs(page, restricted);
    await page.goto('/clients');
    await page.locator('.app-container').waitFor({ state: 'visible' });

    // The create button is withheld rather than left to lead to Access Denied.
    await expect(page.getByTestId('data-table-create')).toHaveCount(0);
    // Screens the user cannot open are absent from the navigation as well as from the router.
    await expect(page.getByRole('link', { name: 'Chart of Accounts', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
  });

  test('is shown an action it cannot take, disabled and saying what it needs', async ({ page }) => {
    // A different restricted user from the one the rest of this spec uses: this one can open a
    // loan, which is the whole point — the action belongs to the record in front of them, so
    // hiding it would read as a missing feature rather than as a limit on their role.
    const api = await createApiContext();
    let loanViewer: SeededRestrictedUser;
    let loan: { loanId: number };
    try {
      await ensureReferenceData(api);
      loan = await seedActiveLoan(api);
      loanViewer = await seedRestrictedUser(api, ['READ_LOAN', 'READ_CLIENT']);
    } finally {
      await api.dispose();
    }

    await loginAs(page, loanViewer);
    expect(await landsOn(page, `/loans/view/${loan.loanId}`)).toBe(`/loans/view/${loan.loanId}`);

    const repayment = page.getByTestId('loan-repayment-action');
    await expect(repayment).toBeVisible();
    await expect(repayment).toHaveAttribute('disabled', /.*/);
    await expect(repayment).toHaveAttribute('title', /REPAYMENT_LOAN/);

    // And the platform agrees: the operation the button would have started is refused.
    expect(
      await statusAs(loanViewer, 'POST', `/loans/${loan.loanId}/transactions?command=repayment`, {
        locale: 'en',
        dateFormat: 'dd MMMM yyyy',
        transactionDate: '01 January 2026',
        transactionAmount: 1,
      }),
    ).toBe(403);
  });

  test('the superuser the rest of the suite uses is unaffected', async ({ page }) => {
    // Regression guard: the whole backend suite signs in as this user, so a route permission
    // written wrongly would show up here first.
    expect(USERNAME).toBeTruthy();
    expect(PASSWORD).toBeTruthy();
    await login(page);
    expect(await landsOn(page, '/clients')).toBe('/clients');
    expect(await landsOn(page, '/accounting/chart-of-accounts')).toBe(
      '/accounting/chart-of-accounts',
    );
    expect(await landsOn(page, '/security/users')).toBe('/security/users');
  });
});
