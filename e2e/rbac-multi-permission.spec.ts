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
 * RBAC dimensions `rbac-backend-restricted-user.spec.ts` does not reach: a route that
 * declares more than one permission code (OR semantics), the ALL_FUNCTIONS_READ shortcut
 * against Fineract's own permission catalogue rather than a mocked session, a second
 * real-backend action-level gate distinct from loan repayment, and whether a restricted
 * session's permissions survive an actual page reload rather than only a fresh login.
 *
 * Same shape as that spec for the same reason: every refusal is checked both as "the router
 * sent them to Access Denied" and as "Fineract itself returned 403", because the guard is
 * defence-in-depth and showing only the first would invite the wrong conclusion.
 */

import { test, expect } from './fixtures';
import { landsOn } from './utils/settled-route';
import { loginAsSeededUser } from './utils/fineract-login';
import {
  createApiContext,
  ensureReferenceData,
  generatePassword,
  seedPendingLoan,
  seedRestrictedUser,
  seedSuffix,
  statusAs,
  SeededRestrictedUser,
} from './utils/seed-api';

test.describe.configure({ mode: 'serial', timeout: 180_000 });

test.describe('a route declaring more than one permission code (OR semantics)', () => {
  // /tasks/work-queues declares data: { permissions: ['READ_LOAN', 'READ_CLIENT'] } with no
  // permissionsMatchAll — the guard's own OR default, so either code alone must admit.
  let loanOnly: SeededRestrictedUser;
  let clientOnly: SeededRestrictedUser;
  let neither: SeededRestrictedUser;

  test.beforeAll(async () => {
    const api = await createApiContext();
    try {
      loanOnly = await seedRestrictedUser(api, ['READ_LOAN']);
      clientOnly = await seedRestrictedUser(api, ['READ_CLIENT']);
      neither = await seedRestrictedUser(api, ['READ_AUDIT']);
    } finally {
      await api.dispose();
    }
  });

  test('is admitted by either declared code alone', async ({ page }) => {
    await loginAsSeededUser(page, loanOnly);
    expect(await landsOn(page, '/tasks/work-queues')).toBe('/tasks/work-queues');
  });

  test('is admitted by the other declared code alone', async ({ page }) => {
    await loginAsSeededUser(page, clientOnly);
    expect(await landsOn(page, '/tasks/work-queues')).toBe('/tasks/work-queues');
  });

  test('is refused when holding neither declared code, by the router and by the backend', async ({
    page,
  }) => {
    await loginAsSeededUser(page, neither);
    expect(await landsOn(page, '/tasks/work-queues')).toBe('/forbidden');

    // The screen's own reads are refused too — an OR-admitted route is not itself a grant of
    // either underlying permission.
    expect(await statusAs(neither, 'GET', '/loans?limit=1')).toBe(403);
    expect(await statusAs(neither, 'GET', '/clients?limit=1')).toBe(403);
  });
});

test.describe('ALL_FUNCTIONS_READ, against the real Fineract permission catalogue', () => {
  // The mocked equivalent (all-functions-read-shortcut.spec.ts) proves the client is
  // self-consistent about this shortcut; this proves Fineract's own semantics agree with it.
  let readOnlySuperuser: SeededRestrictedUser;

  test.beforeAll(async () => {
    const api = await createApiContext();
    try {
      readOnlySuperuser = await seedRestrictedUser(api, ['ALL_FUNCTIONS_READ']);
    } finally {
      await api.dispose();
    }
  });

  test('reaches read screens across modules it holds no specific code for', async ({ page }) => {
    await loginAsSeededUser(page, readOnlySuperuser);
    expect(await landsOn(page, '/clients')).toBe('/clients');
    expect(await landsOn(page, '/loans')).toBe('/loans');
    expect(await landsOn(page, '/accounting/chart-of-accounts')).toBe(
      '/accounting/chart-of-accounts',
    );
  });

  test('is refused every write screen, and the writes themselves', async ({ page }) => {
    await loginAsSeededUser(page, readOnlySuperuser);

    expect(await landsOn(page, '/clients/create')).toBe('/forbidden');
    expect(await landsOn(page, '/accounting/journal-entries/create')).toBe('/forbidden');

    expect(
      await statusAs(readOnlySuperuser, 'POST', '/clients', {
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
});

test.describe('a restricted session across a real page reload', () => {
  let restricted: SeededRestrictedUser;

  test.beforeAll(async () => {
    const api = await createApiContext();
    try {
      restricted = await seedRestrictedUser(api, ['READ_CLIENT']);
    } finally {
      await api.dispose();
    }
  });

  test('keeps the same permission boundary after reloading, not just after a fresh login', async ({
    page,
  }) => {
    await loginAsSeededUser(page, restricted);
    expect(await landsOn(page, '/clients')).toBe('/clients');

    await page.reload();
    await page.locator('.app-container').waitFor({ state: 'visible' });

    // A stale or dropped session here would show up as either an unwanted trip back to
    // /login (session lost) or as reaching a screen the seeded role never held (session
    // read back looser than it was granted) — auth.service.spec.ts's "normalizes a dirty
    // session read back from sessionStorage" case, checked here against a real reload
    // rather than a constructed storage value.
    expect(await landsOn(page, '/accounting/chart-of-accounts')).toBe('/forbidden');
    expect(await landsOn(page, '/clients')).toBe('/clients');
    expect(await statusAs(restricted, 'GET', '/glaccounts')).toBe(403);
  });
});

test.describe('a second real action-level gate, distinct from loan repayment', () => {
  test('is shown the Approve action disabled and naming what it needs, refused by the backend too', async ({
    page,
  }) => {
    const api = await createApiContext();
    let approver: SeededRestrictedUser;
    let loan: { loanId: number };
    try {
      await ensureReferenceData(api);
      loan = await seedPendingLoan(api);
      // Holds enough to open the loan, but not to approve it.
      approver = await seedRestrictedUser(api, ['READ_LOAN', 'READ_CLIENT']);
    } finally {
      await api.dispose();
    }

    await loginAsSeededUser(page, approver);
    expect(await landsOn(page, `/loans/view/${loan.loanId}`)).toBe(`/loans/view/${loan.loanId}`);

    // getByRole would resolve to Ionic's internal shadow-DOM native <button>, which does not
    // inherit the host ion-button's `title` attribute — only `aria-label` gets forwarded.
    // data-testid targets the host directly, same as the existing repayment-action assertion.
    const approve = page.getByTestId('loan-approve-action');
    await expect(approve).toBeVisible();
    await expect(approve).toHaveAttribute('disabled', /.*/);
    await expect(approve).toHaveAttribute('title', /APPROVE_LOAN/);

    expect(
      await statusAs(approver, 'POST', `/loans/${loan.loanId}?command=approve`, {
        locale: 'en',
        dateFormat: 'dd MMMM yyyy',
        approvedOnDate: '01 January 2026',
      }),
    ).toBe(403);
  });
});

test.describe('Security module writes (users, roles), against the real backend', () => {
  // Not covered anywhere else at this level: rbac-route-protection.spec.ts refuses
  // /security/users and /security/roles by URL, but only against a mocked session. This is
  // the audit's own "action-level authorization" list (user management, role management) —
  // checked here against Fineract's actual permission catalogue instead.
  let restricted: SeededRestrictedUser;

  test.beforeAll(async () => {
    const api = await createApiContext();
    try {
      restricted = await seedRestrictedUser(api, ['READ_USER', 'READ_ROLE']);
    } finally {
      await api.dispose();
    }
  });

  test('reaches the list screens but is refused the write screens', async ({ page }) => {
    await loginAsSeededUser(page, restricted);
    expect(await landsOn(page, '/security/users')).toBe('/security/users');
    expect(await landsOn(page, '/security/roles')).toBe('/security/roles');
    expect(await landsOn(page, '/security/users/create')).toBe('/forbidden');
    expect(await landsOn(page, `/security/roles/edit/${restricted.roleId}`)).toBe('/forbidden');
  });

  test('is refused creating a user and modifying a role, by the backend itself', async () => {
    // Generated rather than written down, for the same reason seedRestrictedUser's own
    // password is: a literal here would be a credential-shaped string sitting in the tree,
    // and the request is refused before Fineract ever looks at this field.
    const throwawayPassword = generatePassword();
    expect(
      await statusAs(restricted, 'POST', '/users', {
        username: `e2eShouldNotExist${seedSuffix()}`,
        firstname: 'Should',
        lastname: 'NotBeCreated',
        email: 'should-not-be-created@example.invalid',
        officeId: 1,
        roles: [restricted.roleId],
        sendPasswordToEmail: false,
        password: throwawayPassword,
        repeatPassword: throwawayPassword,
      }),
    ).toBe(403);

    // Targets their *own* role on purpose: lacking UPDATE_ROLE refuses the write regardless
    // of whose role is named, including an attempt to grant themselves more than they hold.
    expect(
      await statusAs(restricted, 'PUT', `/roles/${restricted.roleId}/permissions`, {
        permissions: { ALL_FUNCTIONS: true },
      }),
    ).toBe(403);
  });
});
