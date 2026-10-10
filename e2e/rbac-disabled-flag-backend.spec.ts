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
 * `rbacEnabled: false`, against a user Fineract really does restrict.
 *
 * The flag is the deployment switch that turns every client-side gate off — the guard admits,
 * the navigation shows everything, the structural directives render. `rbac-route-protection`
 * and the directive unit tests cover that it does so. What none of them can cover is the claim
 * that makes the flag safe to ship at all, stated in `security.md` §5a and `DOCS/RBAC.md`: it
 * changes nothing server-side.
 *
 * That claim needs a real restricted session to be worth anything. Mocking the authentication
 * response and then also mocking the data endpoints would be asserting a decision this spec made
 * itself. So the user here is seeded, holds exactly `READ_CLIENT`, and the only thing stubbed is
 * the deployment's own `config.json` — a file a deployment edits by hand, which is the honest
 * way to switch the flag. Everything after it is Fineract's answer.
 *
 * The second half of the spec is about what the user is then shown. With the gates off they can
 * reach screens whose reads will be refused, and "this list could not be loaded, try again" is
 * the wrong thing to say about a refusal: the retry is a loop that cannot end.
 */

import { test, expect, Page } from './fixtures';
import { landsOn } from './utils/settled-route';
import { loginAsSeededUser } from './utils/fineract-login';
import {
  createApiContext,
  seedRestrictedUser,
  statusAs,
  SeededRestrictedUser,
} from './utils/seed-api';

test.describe.configure({ mode: 'serial', timeout: 180_000 });

let restricted: SeededRestrictedUser;

test.beforeAll(async () => {
  const api = await createApiContext();
  try {
    restricted = await seedRestrictedUser(api, ['READ_CLIENT']);
  } finally {
    await api.dispose();
  }
});

/**
 * Serves the deployment's real `config.json` with RBAC switched off.
 *
 * Fetched and rewritten rather than replaced, so everything else the file says — the API URL the
 * login form offers, the branding — stays as the deployment set it. Same approach as
 * `oidc-login-backend.spec.ts`, and the same reason: the flag is not something Fineract reports,
 * so a deployment choosing it is a change to this file and nothing else.
 */
async function disableClientSideRbac(page: Page): Promise<void> {
  await page.route('**/config.json*', async (route) => {
    const response = await route.fetch();
    const config = (await response.json()) as Record<string, unknown>;
    await route.fulfill({ response, json: { ...config, rbacEnabled: false } });
  });
}

test.beforeEach(async ({ page }) => {
  await disableClientSideRbac(page);
});

test.describe('rbacEnabled: false, with a user who holds only READ_CLIENT', () => {
  test('is shown the whole navigation, including modules their role does not cover', async ({
    page,
  }) => {
    await loginAsSeededUser(page, restricted);

    // With the flag on, `rbac-backend-restricted-user.spec.ts` asserts these are absent for a
    // user in exactly this position. The flag is what moves them.
    await expect(page.getByRole('link', { name: 'Chart of Accounts', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Loans', exact: true })).toBeVisible();
  });

  test('is admitted by the route guard to a screen their role does not cover', async ({ page }) => {
    await loginAsSeededUser(page, restricted);
    // Not /forbidden. The guard short-circuits to "admit" when the flag is off, which is the
    // pre-RBAC behaviour the flag exists to preserve.
    expect(await landsOn(page, '/accounting/chart-of-accounts')).toBe(
      '/accounting/chart-of-accounts',
    );
    expect(await landsOn(page, '/clients/create')).toBe('/clients/create');
  });

  test('is still refused by Fineract, which the flag does not reach', async () => {
    // The point of the whole spec. The client-side gates are off; the boundary is unmoved.
    expect(await statusAs(restricted, 'GET', '/glaccounts')).toBe(403);
    expect(await statusAs(restricted, 'GET', '/loans?limit=1')).toBe(403);
    expect(await statusAs(restricted, 'GET', '/users')).toBe(403);
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

    // And what they do hold still works, so the 403s above are about the missing codes rather
    // than about the account being broken.
    expect(await statusAs(restricted, 'GET', '/clients?limit=1')).toBe(200);
  });

  test('is told the list is beyond their role, and not offered a retry that cannot succeed', async ({
    page,
  }) => {
    await loginAsSeededUser(page, restricted);
    expect(await landsOn(page, '/accounting/chart-of-accounts')).toBe(
      '/accounting/chart-of-accounts',
    );

    const error = page.getByTestId('data-table-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('Your role does not cover this list.');
    // A refused read is refused identically on every attempt. The generic failure state offers
    // "Try again", which is right for a timeout and a dead end here.
    await expect(page.getByTestId('data-table-retry')).toHaveCount(0);
  });

  test('gets the same treatment on a second refused list, not a one-screen fix', async ({
    page,
  }) => {
    await loginAsSeededUser(page, restricted);
    expect(await landsOn(page, '/loans')).toBe('/loans');

    const error = page.getByTestId('data-table-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('Your role does not cover this list.');
    await expect(page.getByTestId('data-table-retry')).toHaveCount(0);
  });

  test('still loads the list their role does cover, with no failure state at all', async ({
    page,
  }) => {
    // The counterweight. If the refusal state appeared on a list the user can read, the change
    // above would have replaced one wrong message with another.
    await loginAsSeededUser(page, restricted);
    expect(await landsOn(page, '/clients')).toBe('/clients');
    await expect(page.getByTestId('data-table-error')).toHaveCount(0);
    await expect(page.locator('.data-table')).toBeVisible();
  });
});
