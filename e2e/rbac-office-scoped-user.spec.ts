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
 * The authorization dimension the other RBAC specs do not touch: **office scope**.
 *
 * `rbac-backend-restricted-user.spec.ts` and `rbac-multi-permission.spec.ts` both vary the
 * permission *codes* a user holds and keep them in Head Office, where the hierarchy admits
 * everything. Fineract decides with two things, though, and the second one is the office the
 * user belongs to: every portfolio query is scoped to the subtree beneath it. Two users with a
 * byte-identical role therefore see different records, and nothing in the permission catalogue
 * says so.
 *
 * That makes it a dimension the client cannot reason about at all. There is no permission code
 * to gate on, no route to refuse, and no button to hide — the UI asks for a list and is handed a
 * shorter one. So this spec is not about what the application withholds; it is about whether
 * what it shows is the platform's answer, and about the one screen where a scoped-out record is
 * reachable by typing its URL.
 *
 * Both halves are checked, as everywhere else in this suite: what the user sees, and what
 * Fineract answers when asked the same question as that user.
 */

import { test, expect } from './fixtures';
import { landsOn } from './utils/settled-route';
import { loginAsSeededUser } from './utils/fineract-login';
import {
  createApiContext,
  seedClient,
  seedOffice,
  seedRestrictedUser,
  statusAs,
  SeededClient,
  SeededOffice,
  SeededRestrictedUser,
} from './utils/seed-api';

// Seeding an office, two clients and two users, then several sign-ins.
test.describe.configure({ mode: 'serial', timeout: 180_000 });

/** Enough to list clients and to open the Offices screen; nothing that writes. */
const SCOPE_TEST_PERMISSIONS = ['READ_CLIENT', 'READ_OFFICE'];

let branch: SeededOffice;
let branchClient: SeededClient;
let headOfficeClient: SeededClient;
/** In the branch. */
let branchUser: SeededRestrictedUser;
/** In Head Office, holding the identical codes — the control for every assertion below. */
let headOfficeUser: SeededRestrictedUser;

test.beforeAll(async () => {
  const api = await createApiContext();
  try {
    branch = await seedOffice(api, 'E2EScoped');
    headOfficeClient = await seedClient(api, 'E2EScopeHO', 1);
    branchClient = await seedClient(api, 'E2EScopeBR', branch.officeId);
    branchUser = await seedRestrictedUser(api, SCOPE_TEST_PERMISSIONS, branch.officeId);
    headOfficeUser = await seedRestrictedUser(api, SCOPE_TEST_PERMISSIONS, 1);
  } finally {
    await api.dispose();
  }
});

test.describe('an account scoped to a branch office', () => {
  test('differs from a head-office account in office alone, not in permissions', async () => {
    // Guards everything after it. If the two roles diverged, every later difference could be
    // explained by a permission rather than by the hierarchy, and the spec would prove nothing
    // about scope.
    expect(branchUser.permissions).toEqual(SCOPE_TEST_PERMISSIONS);
    expect(headOfficeUser.permissions).toEqual(SCOPE_TEST_PERMISSIONS);
    expect(branchUser.officeId).toBe(branch.officeId);
    expect(headOfficeUser.officeId).toBe(1);
    expect(branch.officeId).not.toBe(1);

    // Both hold the code, so neither refusal below can be a permission refusal.
    expect(await statusAs(branchUser, 'GET', '/clients?limit=1')).toBe(200);
    expect(await statusAs(headOfficeUser, 'GET', '/clients?limit=1')).toBe(200);
  });

  test('is shown only its own office in the client list, and told which office it is in', async ({
    page,
  }) => {
    await loginAsSeededUser(page, branchUser);

    // The header names the office the session belongs to. Without it the list below is just
    // "fewer clients than someone else sees", with nothing on screen explaining why.
    await expect(page.getByText(branch.officeName, { exact: false }).first()).toBeVisible();

    expect(await landsOn(page, '/clients')).toBe('/clients');
    const table = page.locator('.data-table');
    await expect(table.getByText(branchClient.displayName)).toBeVisible();
    await expect(table.getByText(headOfficeClient.displayName)).toHaveCount(0);
  });

  test('sees a shorter list than an identically-permissioned head-office account', async ({
    page,
  }) => {
    // The same assertion from the other side. On its own, "the branch user cannot see the
    // head-office client" is also what a broken list, an empty database or a bad filter look
    // like; this is what makes it specifically about scope.
    await loginAsSeededUser(page, headOfficeUser);
    expect(await landsOn(page, '/clients')).toBe('/clients');

    const search = page.getByPlaceholder('Type to search...').first();
    await search.fill(headOfficeClient.firstName);
    await expect(page.locator('.data-table').getByText(headOfficeClient.displayName)).toBeVisible();
  });

  test('is refused another office’s client by the platform, and told so once', async ({ page }) => {
    // Fineract answers 404 rather than 403 for a record outside the hierarchy: the row is not
    // merely forbidden, it is not in this user's world at all. Asserted as 404 on purpose — a
    // change to 403 would be a change in what the platform discloses, and worth noticing.
    expect(await statusAs(branchUser, 'GET', `/clients/${headOfficeClient.clientId}`)).toBe(404);
    expect(await statusAs(branchUser, 'GET', `/clients/${branchClient.clientId}`)).toBe(200);

    await loginAsSeededUser(page, branchUser);
    const url = `/clients/view/${headOfficeClient.clientId}`;
    // Not /forbidden: no permission code is missing, so there is nothing for the route guard to
    // refuse. The screen is reached and has to handle it.
    expect(await landsOn(page, url)).toBe(url);

    await expect(page.getByTestId('client-load-error')).toBeVisible();
    await expect(
      page.getByText("This client doesn't exist, or you don't have permission to view it."),
    ).toBeVisible();

    // Told *once*. The accounts request used to run beside the client one and did not suppress
    // its toast, so this page carried Fineract's raw wording ("[id] Client not found with valuer
    // 35.") on top of the sentence above — the duplicate the client request's own
    // `skipErrorToast` exists to prevent.
    await expect(page.locator('ion-toast')).toHaveCount(0);
  });

  test('can still open the record that is in its own office', async ({ page }) => {
    // The refusal above has to be about the other office, not about the screen being broken for
    // this user generally.
    await loginAsSeededUser(page, branchUser);
    const url = `/clients/view/${branchClient.clientId}`;
    expect(await landsOn(page, url)).toBe(url);
    await expect(page.getByTestId('client-load-error')).toHaveCount(0);
    await expect(page.getByText(branchClient.displayName).first()).toBeVisible();
  });

  test('is not offered an edit it would be refused for on the Offices screen', async ({ page }) => {
    // Worth stating plainly, because it is the opposite of the client list above: the Offices
    // screen asks for `includeAllOffices=true`, so this branch user is shown the whole tree even
    // though Fineract's default answer to them is their own office alone. Both statuses below
    // are 200 — the difference is in the body, and it is the client that chooses the wider one.
    // That is Fineract's disclosure to make and the screen is a register, so this spec records
    // the asymmetry rather than asserting it away; what it does assert is that being shown a row
    // is not the same as being offered to change it.
    expect(await statusAs(branchUser, 'GET', '/offices')).toBe(200);
    expect(await statusAs(branchUser, 'GET', '/offices?includeAllOffices=true')).toBe(200);

    await loginAsSeededUser(page, branchUser);
    expect(await landsOn(page, '/organization/offices')).toBe('/organization/offices');

    // Filtered rather than read off the first page. The table is `localLogic` with the shared
    // ten-row default, and offices accumulate on an instance that is not torn down between runs,
    // so the office seeded moments ago is not necessarily on the page that renders first. The
    // name is unique per run, so the filter leaves exactly the row this test is about.
    const table = page.locator('.data-table');
    await page.getByPlaceholder('Type to search...').fill(branch.officeName);
    await expect(table.getByText(branch.officeName).first()).toBeVisible();

    // READ_OFFICE is held, so viewing is offered...
    await expect(page.getByTestId('office-view').first()).toBeVisible();
    // ...and UPDATE_OFFICE is not, so editing is withheld rather than left to lead to Access
    // Denied. The route declares UPDATE_OFFICE; before this gate the button was offered to every
    // reader on every row, including rows outside their own office.
    await expect(page.getByTestId('office-edit')).toHaveCount(0);
    expect(await landsOn(page, `/organization/offices/edit/${branch.officeId}`)).toBe('/forbidden');

    // And the platform refuses the update the button would have started — which is the half that
    // matters. Withholding a control is presentation, never authorization; see security.md.
    expect(
      await statusAs(branchUser, 'PUT', `/offices/${branch.officeId}`, {
        name: `${branch.officeName} Renamed`,
        locale: 'en',
      }),
    ).toBe(403);
  });
});
