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
 * End-to-end coverage for route-level authorization.
 *
 * Until `permissionGuard` existed, every one of the application's routes was reachable by any
 * authenticated user who knew its URL — the navigation hid a screen, and the address bar handed
 * it straight back. These tests exercise the address bar, not the menu, because that is the
 * path that used to be open.
 *
 * The permission set is injected by mocking the authentication response, the same technique
 * `rbac-feature-flag.spec.ts` uses. That buys combinations which would be tedious to seed —
 * an empty permission list, a code that does not exist — and it keeps the matrix on every PR
 * rather than only where a backend is running. What it cannot show is that Fineract agrees;
 * `rbac-backend-restricted-user.spec.ts` does that against a real restricted user.
 */

import { test, expect, Page } from './fixtures';
import { landsOn } from './utils/settled-route';

// Direct URL entry is the behaviour under test, so each assertion is a real page load rather
// than a client-side navigation, and a matrix row makes several. That does not fit the suite's
// 30s default.
test.describe.configure({ timeout: 120_000 });

const API_BASE = '/api/v1';
const TENANT_DEFAULT = 'default';
const TEST_USER = 'mifos';
const TEST_PASSWORD = 'password';

const FORBIDDEN = '/forbidden';
const CLIENTS = '/clients';
const CLIENTS_CREATE = '/clients/create';
const CHART_OF_ACCOUNTS = '/accounting/chart-of-accounts';
const SECURITY_USERS = '/security/users';

interface LoginOptions {
  /** Permission codes the mocked authentication response grants. */
  permissions?: string[];
  /** Extra keys merged into the served config.json, e.g. `rbacEnabled`. */
  config?: Record<string, unknown>;
}

/** Signs in against mocked config and authentication endpoints with the given permissions. */
async function login(page: Page, options: LoginOptions = {}): Promise<void> {
  const { permissions, config = {} } = options;

  await page.route('**/config.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        fineractApiUrl: API_BASE,
        defaultTenant: TENANT_DEFAULT,
        ...config,
      }),
    });
  });

  await page.route('**/api/v1/authentication**', async (route) => {
    const session: Record<string, unknown> = {
      username: TEST_USER,
      userId: 1,
      base64EncodedAuthenticationKey: 'YmFzZTY0',
      authenticated: true,
      officeId: 1,
      officeName: 'Head Office',
      roles: [{ id: 1, name: 'Test Role', description: 'Test role' }],
    };
    // `permissions` left undefined is a distinct case from an empty array: it is what a
    // malformed or truncated session looks like, and it must not fall open.
    if (permissions !== undefined) session['permissions'] = permissions;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    });
  });

  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT_DEFAULT);
  await page.locator('#username').fill(TEST_USER);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

async function expectRefused(page: Page, url: string): Promise<void> {
  expect(await landsOn(page, url)).toBe(FORBIDDEN);
}

async function expectAdmitted(page: Page, url: string): Promise<void> {
  expect(await landsOn(page, url)).toBe(url);
}

const link = (page: Page, name: string) => page.getByRole('link', { name, exact: true });

test.describe('route authorization', () => {
  test('a superuser reaches every sampled route and sees the full navigation', async ({ page }) => {
    await login(page, { permissions: ['ALL_FUNCTIONS'] });

    for (const url of [CLIENTS, CLIENTS_CREATE, CHART_OF_ACCOUNTS, SECURITY_USERS, '/loans']) {
      await expectAdmitted(page, url);
    }
    await page.goto('/dashboard');
    await expect(link(page, 'Clients')).toBeVisible();
    await expect(link(page, 'Users')).toBeVisible();
    await expect(link(page, 'Chart of Accounts')).toBeVisible();
  });

  test('a single-module user is confined to that module', async ({ page }) => {
    await login(page, { permissions: ['READ_CLIENT'] });

    await expectAdmitted(page, CLIENTS);
    // The screens whose nav entries are hidden are also refused by URL — the point of the guard.
    await expectRefused(page, CHART_OF_ACCOUNTS);
    await expectRefused(page, SECURITY_USERS);
    await expectRefused(page, '/loans');
  });

  test('a read-only user gets the lists and not the forms', async ({ page }) => {
    // ALL_FUNCTIONS_READ satisfies a requirement only when every code in it is a READ_* one,
    // which is why list and form routes must declare different codes.
    await login(page, { permissions: ['ALL_FUNCTIONS_READ'] });

    await expectAdmitted(page, CLIENTS);
    await expectAdmitted(page, CHART_OF_ACCOUNTS);
    await expectRefused(page, CLIENTS_CREATE);
    await expectRefused(page, '/clients/edit/1');
    await expectRefused(page, '/accounting/chart-of-accounts/create');
  });

  test('a user with an empty permission list is refused everywhere and the app still works', async ({
    page,
  }) => {
    await login(page, { permissions: [] });

    await expectRefused(page, CLIENTS);
    await expectRefused(page, CHART_OF_ACCOUNTS);
    // Self-service destinations stay open, or a refused user would have nowhere to land.
    await expectAdmitted(page, '/profile');
    expect(await landsOn(page, '/dashboard')).toBe('/dashboard');
    await expect(link(page, 'Clients')).toHaveCount(0);
  });

  test('a session carrying no permissions field is treated as carrying none', async ({ page }) => {
    await login(page, {});

    await expectRefused(page, CLIENTS);
    await expectAdmitted(page, '/dashboard');
  });

  test('an unrecognised permission code grants nothing', async ({ page }) => {
    await login(page, { permissions: ['NOT_A_REAL_PERMISSION', 'ALL_FUNCTIONS_MAYBE'] });

    await expectRefused(page, CLIENTS);
    await expectRefused(page, CHART_OF_ACCOUNTS);
  });

  test('an unauthenticated visitor is asked to sign in, not told they are forbidden', async ({
    page,
  }) => {
    await page.route('**/config.json*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ fineractApiUrl: API_BASE, defaultTenant: TENANT_DEFAULT }),
      });
    });

    expect(await landsOn(page, CLIENTS)).toBe('/login');
    expect(await landsOn(page, CLIENTS_CREATE)).toBe('/login');
    expect(await landsOn(page, FORBIDDEN)).toBe('/login');
  });

  test('a deployment with RBAC turned off behaves as it did before the guard', async ({ page }) => {
    await login(page, { permissions: [], config: { rbacEnabled: false } });

    await expectAdmitted(page, CLIENTS);
    await expectAdmitted(page, CLIENTS_CREATE);
    await expectAdmitted(page, CHART_OF_ACCOUNTS);
    await expect(link(page, 'Clients')).toBeVisible();
  });
});

test.describe('the Access Denied page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, { permissions: ['READ_CLIENT'] });
    // Compare the path, not the whole URL: the guard appends the permissions the route wanted
    // as a query parameter, and `toHaveURL` matches the query string too.
    expect(await landsOn(page, CHART_OF_ACCOUNTS)).toBe(FORBIDDEN);
  });

  test('says what happened, under a single heading', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toBeVisible();
    await expect(heading).not.toBeEmpty();
  });

  test('moves focus to the heading, since the user did not ask to come here', async ({ page }) => {
    await expect(page.locator('h1')).toBeFocused();
  });

  test('announces itself politely', async ({ page }) => {
    // Scoped by role rather than by `[aria-live]`: an error toast from the refused page's own
    // API call is also a live region, and it is the announcement of the page that matters here.
    const region = page.getByRole('alert');
    await expect(region).toHaveAttribute('aria-live', 'polite');
    await expect(region).toContainText(/./);
  });

  test('names the permissions the screen wanted, so the user can ask for them', async ({
    page,
  }) => {
    // Everyone here is authenticated back-office staff, so the codes are actionable rather than
    // a hint to an outsider: they are what the user tells an administrator to grant.
    await expect(page.getByTestId('access-denied-required')).toContainText('READ_GLACCOUNT');
  });

  test('offers a way back that the user is allowed to take', async ({ page }) => {
    await page.getByTestId('access-denied-dashboard').click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('is reachable by keyboard alone', async ({ page }) => {
    // The heading holds focus on arrival, so one Tab must reach the only action on the page.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('permission feedback', () => {
  test('a visible nav entry says what the user can do in that module', async ({ page }) => {
    // The label is one word; what "Clients" means for this particular role is not obvious from
    // it, and the tooltip is derived from the codes the user actually holds rather than from
    // the single code the entry is gated on.
    await login(page, { permissions: ['READ_CLIENT', 'CREATE_CLIENT'] });

    const clients = link(page, 'Clients');
    await expect(clients).toBeVisible();
    await expect(clients).toHaveAttribute('title', /view and create clients/i);
  });

  test('a nav entry carries no hint when there is nothing specific to say', async ({ page }) => {
    // A superuser holds ALL_FUNCTIONS rather than the individual codes, so enumerating is
    // impossible and "you can do everything" on every item is noise.
    await login(page, { permissions: ['ALL_FUNCTIONS'] });

    await expect(link(page, 'Clients')).not.toHaveAttribute('title', /./);
  });
});

test.describe('navigation and routes agree', () => {
  test('a hidden menu entry is also refused by URL, and a shown one is not', async ({ page }) => {
    await login(page, { permissions: ['READ_USER'] });

    await expect(link(page, 'Users')).toBeVisible();
    await expectAdmitted(page, SECURITY_USERS);

    // Roles sits in the same group but needs READ_ROLE. Hidden, and refused by URL too —
    // hiding alone was the old behaviour and is what this guard exists to stop relying on.
    await page.goto('/dashboard');
    await expect(link(page, 'Roles')).toHaveCount(0);
    await expectRefused(page, '/security/roles');
  });

  test('the create button is withheld from a user whose create route would refuse them', async ({
    page,
  }) => {
    await login(page, { permissions: ['READ_CLIENT'] });
    await page.goto(CLIENTS);

    await expect(page.getByTestId('data-table-create')).toHaveCount(0);
    await expectRefused(page, CLIENTS_CREATE);
  });
});
