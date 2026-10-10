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
 * The account that is authenticated and authorized for nothing.
 *
 * It is a real state, not a contrived one: a role created and not yet granted anything, or one
 * whose grants were revoked, leaves a user who signs in perfectly well and is refused by every
 * portfolio endpoint. Fineract hands such a session a single code — `FACTOR_PASSWORD`, which
 * every user holds — so this is also the clearest demonstration available that authentication
 * and authorization are separate questions.
 *
 * `rbac-route-protection.spec.ts` covers an empty permission set against a mocked session, which
 * proves the guard reads an empty array correctly. What it cannot show is what Fineract does
 * with such a user, and that turns out to matter: some of what the navigation offers this
 * account genuinely works. Fineract's catalogue has no READ code for tellers, share products or
 * share accounts (see `DOCS/RBAC.md`, the `UNRESTRICTED` allow-list), so those endpoints answer
 * 200 to anybody signed in. The navigation a permissionless user is left with is therefore not
 * a wall of dead links, and this spec checks that both ways round — what is withheld is refused
 * by the platform, and what is offered actually loads.
 */

import { test, expect } from './fixtures';
import { landsOn } from './utils/settled-route';
import { loginAsSeededUser } from './utils/fineract-login';
import {
  createApiContext,
  seedRestrictedUser,
  statusAs,
  SeededRestrictedUser,
} from './utils/seed-api';

test.describe.configure({ mode: 'serial', timeout: 180_000 });

let permissionless: SeededRestrictedUser;

test.beforeAll(async () => {
  const api = await createApiContext();
  try {
    // A role granted nothing at all. `seedRole` creates it empty and applies the (empty) grant
    // map as a delta, so this is genuinely a user with no permissions rather than one with few.
    permissionless = await seedRestrictedUser(api, []);
  } finally {
    await api.dispose();
  }
});

test.describe('an account whose role grants nothing', () => {
  test('is authenticated by Fineract and authorized by it for nothing', async () => {
    expect(permissionless.permissions).toEqual([]);

    // Authentication succeeds. This is the distinction the whole spec rests on, and asserting it
    // first stops a later 403 being read as "the credentials were wrong".
    expect(
      await statusAs(permissionless, 'POST', '/authentication', {
        username: permissionless.username,
        password: permissionless.password,
      }),
    ).toBe(200);

    for (const path of [
      '/clients?limit=1',
      '/loans?limit=1',
      '/glaccounts',
      '/offices',
      '/users',
    ]) {
      expect(await statusAs(permissionless, 'GET', path), `GET ${path}`).toBe(403);
    }
  });

  test('is signed in and landed on a screen rather than stranded at the login form', async ({
    page,
  }) => {
    // The failure this guards against is the application treating "no permissions" as "no
    // session" — bouncing back to /login, or redirecting to /forbidden for the one route that
    // must never refuse anyone. `/dashboard` is self-service and carries no permission of its
    // own; see DOCS/RBAC.md on the UNRESTRICTED allow-list.
    await loginAsSeededUser(page, permissionless);
    expect(await landsOn(page, '/dashboard')).toBe('/dashboard');
    await expect(page.locator('.app-container')).toBeVisible();
    await expect(page.getByText('System Operational Status')).toBeVisible();
  });

  test('is offered no permission-gated module, and refused each one by URL and by Fineract', async ({
    page,
  }) => {
    await loginAsSeededUser(page, permissionless);

    for (const label of ['Clients', 'Loans', 'Chart of Accounts', 'Users', 'Offices']) {
      await expect(
        page.getByRole('link', { name: label, exact: true }),
        `navigation offers ${label}`,
      ).toHaveCount(0);
    }

    expect(await landsOn(page, '/clients')).toBe('/forbidden');
    expect(await landsOn(page, '/loans')).toBe('/forbidden');
    expect(await landsOn(page, '/security/users')).toBe('/forbidden');
    expect(await landsOn(page, '/organization/offices')).toBe('/forbidden');

    // And the refusals are the platform's, not a client-side pose.
    expect(await statusAs(permissionless, 'GET', '/clients?limit=1')).toBe(403);
    expect(await statusAs(permissionless, 'GET', '/loans?limit=1')).toBe(403);
    expect(await statusAs(permissionless, 'GET', '/users')).toBe(403);
  });

  test('is left a navigation whose entries actually work', async ({ page }) => {
    // The other half, and the one worth having. A screen with no permission code behind it is
    // shown to everybody, so if Fineract refused those reads too, this account would be handed a
    // menu of guaranteed failures — a worse outcome than being shown nothing. It does not: the
    // endpoints behind these entries have no READ code to check.
    expect(await statusAs(permissionless, 'GET', '/products/share')).toBe(200);
    expect(await statusAs(permissionless, 'GET', '/tellers')).toBe(200);

    await loginAsSeededUser(page, permissionless);

    const shareProducts = page.getByRole('link', { name: 'Share Products', exact: true });
    await expect(shareProducts).toBeVisible();

    expect(await landsOn(page, '/products/share')).toBe('/products/share');
    // The list renders. `data-table-error` replaces the table on a failed load, so its absence
    // is the assertion that the screen worked rather than merely opened.
    await expect(page.getByTestId('data-table-error')).toHaveCount(0);
    await expect(page.locator('.data-table')).toBeVisible();
  });
});
