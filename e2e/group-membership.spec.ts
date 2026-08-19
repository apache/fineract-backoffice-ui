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
 * The group lifecycle against a real Fineract.
 *
 * Everything is driven through the UI — the client, the staff member and the group are all
 * created on screen. Nothing is seeded through the API, because the prerequisites *are* part of
 * what an operator has to do, and a test that arranged them behind the UI would not show that
 * the feature is reachable.
 *
 * The companion `group-detail.spec.ts` covers the same screen against mocks, where the request
 * itself can be inspected. This one answers the question mocks cannot: whether the platform
 * accepts what the screen sends.
 *
 *   npx playwright test e2e/group-membership.spec.ts --project=backend --workers=1
 */

import { test, expect, Page, recordingTimeout } from './fixtures';
import { login, uniqueSuffix } from './utils/fineract-login';
import { confirmDialog, modalFor } from './utils/ionic-locators';
import { selectInDialog } from './utils/select-in-dialog';
import { selectOption } from './utils/select-option';

const HEAD_OFFICE = 'Head Office';

/**
 * Filters a list down to `term` and returns the matching row.
 *
 * Lists paginate at ten rows and this suite adds one per run, so a freshly created record stops
 * being on the first page almost immediately. `localLogic` means the table filters rows it
 * already holds, so this reaches entries beyond the visible page.
 *
 * The searchbar's real `<input>` lives in Ionic's shadow DOM; the `data-testid` sits on the
 * host, which cannot be filled directly.
 */
async function findRow(page: Page, term: string) {
  await page.locator('ion-searchbar[data-testid="search-filter-input"] input').fill(term);
  const row = page.getByRole('row', { name: new RegExp(term) }).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  return row;
}

/**
 * Creates a client in Head Office through the client form and returns its display name.
 *
 * The form ticks "Active" by default, so the client comes out active. That matters for the
 * closure test, where the platform's rule is specifically about *active* members.
 */
async function createClient(page: Page, suffix: string): Promise<string> {
  const firstName = `E2EGroupMember${suffix}`;
  await page.goto('/clients/create');
  await selectOption(page, 'Office', HEAD_OFFICE);
  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill('Tester');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page).toHaveURL(/\/clients$/, { timeout: 20000 });
  return `${firstName} Tester`;
}

/**
 * Creates a staff member in Head Office and returns the name Fineract will display.
 *
 * A fresh one every run: staff accumulate harmlessly, and reusing one would couple this suite
 * to whatever else has assigned them.
 */
async function createStaff(page: Page, suffix: string): Promise<string> {
  const lastName = `GroupOfficer${suffix}`;
  await page.goto('/organization/staff/create');
  await selectOption(page, 'Office', HEAD_OFFICE);
  await page.locator('input[name="firstname"]').fill('E2E');
  await page.locator('input[name="lastname"]').fill(lastName);
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page).toHaveURL(/\/organization\/staff$/, { timeout: 20000 });
  // Fineract renders a staff member as "lastname, firstname".
  return `${lastName}, E2E`;
}

/**
 * Creates a group, leaving it pending so the activate command has something to do.
 *
 * The form ticks "Active" by default, which makes the platform activate the group on creation.
 * Unticking it is what a user does when the group is being registered before its opening
 * meeting, and it is the only way to reach the pending state this suite then activates out of.
 */
async function createGroup(page: Page, name: string): Promise<void> {
  await page.goto('/groups/create');
  await page.locator('input[name="name"]').fill(name);
  await selectOption(page, 'Office', HEAD_OFFICE);
  await page.locator('ion-checkbox[name="active"]').click();
  await expect(page.locator('ion-checkbox[name="active"]')).toHaveJSProperty('checked', false);
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page).toHaveURL(/\/groups$/, { timeout: 20000 });
}

/**
 * Ensures the `GroupClosureReason` code has at least one value, creating one through the
 * system screens if it does not.
 *
 * Fineract ships that code empty, and `close` rejects a request without a `closureReasonId`.
 * Populating it is a real administrator task rather than test scaffolding, which is why it is
 * done on screen — and it has to be done at all, because CI starts from a fresh database where
 * no institution has configured one.
 *
 * Idempotent: the suite runs repeatedly against the same database, and a second value would be
 * harmless but the navigation is not free.
 */
async function ensureClosureReason(page: Page, name: string): Promise<string> {
  await page.goto('/system/codes');
  const codeRow = await findRow(page, 'GroupClosureReason');

  const responseReceived = page.waitForResponse(
    (response) => /\/codes\/\d+\/codevalues/.test(response.url()) && response.ok(),
  );
  await codeRow.getByRole('button', { name: 'Code Values' }).click();

  await expect(page).toHaveURL(/\/system\/codes\/\d+\/values$/, { timeout: 20000 });
  // Synchronised on the request and on the table's own spinner, not on the presence of rows.
  // `app-data-table` renders CDK's `*cdkNoDataRow` as a real `<tr class="no-data-row">` reading
  // "No records found.", from the moment it mounts — so a count of `tbody tr` is 1 while the
  // request is still in flight *and* 1 when the code genuinely has no values, and cannot tell
  // the two apart. Counting it as data is what broke this: the placeholder was taken for a
  // value, "No records found." was handed back as the closure reason, no value was ever
  // created, and the close dialog then offered nothing that matched. It reproduced on every CI
  // run against a fresh database, where `GroupClosureReason` really is empty, and never on a
  // developer machine, where an earlier run has already populated it.
  await responseReceived;
  await expect(page.getByTestId('data-table-spinner')).toHaveCount(0, { timeout: 20000 });

  // Excludes the placeholder, so this is the count of values the institution actually has.
  const existingValues = page.locator('app-data-table tbody tr:not(.no-data-row)');
  if ((await existingValues.count()) > 0) {
    return (await existingValues.first().locator('td').first().innerText()).trim();
  }

  await page.getByRole('button', { name: 'Add Value', exact: true }).click();
  await expect(page).toHaveURL(/\/system\/codes\/\d+\/values\/create$/, { timeout: 20000 });
  await page.locator('ion-input[name="name"] input').fill(name);
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page).toHaveURL(/\/system\/codes\/\d+\/values$/, { timeout: 20000 });
  return name;
}

/** Opens a group's detail view from the list, the way a user reaches it. */
async function openGroup(page: Page, name: string): Promise<void> {
  await page.goto('/groups');
  const row = await findRow(page, name);
  await row.locator('ion-button[data-testid^="group-view-"]').click();
  await expect(page).toHaveURL(/\/groups\/view\/\d+$/, { timeout: 20000 });
  await expect(page.getByTestId('group-name')).toHaveText(name, { timeout: 20000 });
}

test.describe('Group membership and lifecycle', () => {
  test('a group is activated, staffed, given members and a committee, then emptied', async ({
    page,
  }) => {
    test.setTimeout(recordingTimeout(240000));
    await login(page);

    const suffix = uniqueSuffix();
    const groupName = `E2E Group ${suffix}`;

    const clientName = await createClient(page, suffix);
    const staffName = await createStaff(page, suffix);
    await createGroup(page, groupName);
    await openGroup(page, groupName);

    // --- Activate -------------------------------------------------------------------------
    await expect(page.getByTestId('group-status')).toContainText('Pending');

    await page.getByTestId('group-actions').click();
    await page.getByTestId('group-action-activate').click();
    const activateDialog = modalFor(page, 'app-group-action-dialog');
    await expect(activateDialog).toBeVisible();
    // Confirmed without touching the date. That default has to be one the platform accepts
    // from a browser whose clock disagrees with the tenant's about what day it is — this run
    // is UTC in CI against a tenant on `Asia/Kolkata`, which are different days after 18:30.
    await activateDialog.getByTestId('group-action-confirm').click();

    await expect(page.getByTestId('group-status')).toContainText('Active', { timeout: 20000 });
    // Proves the screen re-read the group rather than patching its own copy: the activation date
    // is stamped by the platform and was not in the request.
    await expect(page.getByTestId('group-tab-general')).toBeVisible();

    // --- Assign staff ---------------------------------------------------------------------
    await page.getByTestId('group-actions').click();
    await page.getByTestId('group-action-assign-staff').click();
    const staffDialog = modalFor(page, 'app-group-staff-dialog');
    await expect(staffDialog).toBeVisible();
    // Scoped to the group's office; staff from elsewhere are refused by `assignStaff`.
    await selectInDialog(page, staffDialog, 'staffId', staffName);
    await staffDialog.getByTestId('group-staff-confirm').click();

    await expect(page.getByTestId('group-staff-name')).toHaveText(staffName, { timeout: 20000 });

    // --- Add a member ---------------------------------------------------------------------
    await expect(page.getByTestId('group-member-count')).toHaveText('0');

    await page.getByTestId('group-tab-members').click();
    await page.getByTestId('group-add-members').click();
    const membersDialog = modalFor(page, 'app-group-members-dialog');
    await expect(membersDialog).toBeVisible();

    // The dialog does not filter candidates by client status. `associateClients` accepts a
    // pending client — a group that forms before its members are activated is the ordinary case
    // in group lending — which is why the status filter was removed from the search. This client
    // happens to be active, because the client form ticks Active by default.
    await membersDialog
      .locator('ion-searchbar[data-testid="group-member-search"] input')
      .fill(clientName);
    const candidate = membersDialog.locator('ion-checkbox').filter({ hasText: clientName });
    await expect(candidate).toBeVisible({ timeout: 20000 });
    await candidate.click();
    await membersDialog.getByTestId('group-members-confirm').click();

    await expect(page.getByRole('cell', { name: clientName })).toBeVisible({ timeout: 20000 });
    await page.getByTestId('group-tab-general').click();
    await expect(page.getByTestId('group-member-count')).toHaveText('1');

    // --- Assign a committee role ----------------------------------------------------------
    await page.getByTestId('group-tab-committee').click();
    await page.getByTestId('group-assign-role').click();
    const roleDialog = modalFor(page, 'app-group-role-dialog');
    await expect(roleDialog).toBeVisible();
    await selectInDialog(page, roleDialog, 'clientId', clientName);
    // 'Leader' is the one value Fineract ships in the GROUPROLE code.
    await selectInDialog(page, roleDialog, 'roleId', 'Leader');
    await roleDialog.getByTestId('group-role-confirm').click();

    const roleRow = page.getByRole('row', { name: new RegExp(clientName) }).first();
    await expect(roleRow).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('cell', { name: 'Leader' })).toBeVisible();

    // --- Unassign the role ----------------------------------------------------------------
    //
    // The assignment carries its own id, distinct from the role's code-value id, and
    // `unassignRole` takes the former as a query parameter. Sending the latter answers 404 for
    // a group role that plainly exists, so a real backend is the only thing that proves this
    // right — the request looks well-formed either way.
    await roleRow.locator('ion-button[data-testid^="group-unassign-role-"]').click();
    await confirmDialog(page).getByTestId('confirm-dialog-confirm').click();
    await expect(page.getByRole('cell', { name: 'Leader' })).toHaveCount(0, { timeout: 20000 });

    // --- Remove the member ----------------------------------------------------------------
    await page.getByTestId('group-tab-members').click();
    await page.getByTestId('group-remove-members').click();
    const removeDialog = modalFor(page, 'app-group-members-dialog');
    await expect(removeDialog).toBeVisible();
    await removeDialog.locator('ion-checkbox').filter({ hasText: clientName }).click();
    await removeDialog.getByTestId('group-members-confirm').click();

    await expect(page.getByRole('cell', { name: clientName })).toHaveCount(0, { timeout: 20000 });
    await page.getByTestId('group-tab-general').click();
    await expect(page.getByTestId('group-member-count')).toHaveText('0', { timeout: 20000 });
  });

  test('notes are recorded against the group and can be removed again', async ({ page }) => {
    test.setTimeout(recordingTimeout(180000));
    await login(page);

    const suffix = uniqueSuffix();
    const groupName = `E2E Notes Group ${suffix}`;
    const noteText = `Formed at the ward meeting ${suffix}`;

    await createGroup(page, groupName);
    await openGroup(page, groupName);

    await page.getByTestId('group-tab-notes').click();
    await page.getByTestId('group-add-note').click();
    await expect(page).toHaveURL(/\/groups\/\d+\/notes\/create$/, { timeout: 20000 });

    // The textarea's real element is inside Ionic's shadow DOM.
    await page.locator('ion-textarea[data-testid="group-note-textarea"] textarea').fill(noteText);
    await page.getByTestId('group-note-submit').click();
    await expect(page).toHaveURL(/\/groups\/view\/\d+$/, { timeout: 20000 });

    await page.getByTestId('group-tab-notes').click();
    const noteRow = page.getByRole('row', { name: new RegExp(suffix) }).first();
    await expect(noteRow).toBeVisible({ timeout: 20000 });

    // Deleting confirms through the app dialog rather than window.confirm, which Playwright
    // would have to intercept and which cannot be translated.
    await noteRow.getByRole('button', { name: /delete/i }).click();
    await confirmDialog(page).getByTestId('confirm-dialog-confirm').click();
    await expect(page.getByRole('row', { name: new RegExp(suffix) })).toHaveCount(0, {
      timeout: 20000,
    });
  });

  test('an empty group is closed with a reason, and a group with members is refused', async ({
    page,
  }) => {
    test.setTimeout(recordingTimeout(240000));
    await login(page);

    const suffix = uniqueSuffix();
    const groupName = `E2E Close Group ${suffix}`;

    const reason = await ensureClosureReason(page, `E2E Disbanded ${suffix}`);
    const clientName = await createClient(page, suffix);
    await createGroup(page, groupName);
    await openGroup(page, groupName);

    // Activate first: close is only offered for an active group, and a pending one is deleted
    // rather than closed.
    await page.getByTestId('group-actions').click();
    await page.getByTestId('group-action-activate').click();
    await modalFor(page, 'app-group-action-dialog').getByTestId('group-action-confirm').click();
    await expect(page.getByTestId('group-status')).toContainText('Active', { timeout: 20000 });

    // Give it a member, so the first close attempt hits the platform's rule.
    await page.getByTestId('group-tab-members').click();
    await page.getByTestId('group-add-members').click();
    const addDialog = modalFor(page, 'app-group-members-dialog');
    await addDialog
      .locator('ion-searchbar[data-testid="group-member-search"] input')
      .fill(clientName);
    const candidate = addDialog.locator('ion-checkbox').filter({ hasText: clientName });
    await expect(candidate).toBeVisible({ timeout: 20000 });
    await candidate.click();
    await addDialog.getByTestId('group-members-confirm').click();
    await expect(page.getByRole('cell', { name: clientName })).toBeVisible({ timeout: 20000 });

    // Fineract refuses: "Group cannot be closed because of active clients associated with it."
    // The screen does not pre-empt that rule — the platform is the authority on it — so what
    // matters is that the refusal reaches the user and the group is left alone.
    //
    // Asserting on the toast *appearing* rather than on its text, deliberately. Fineract returns
    // 403 for a domain-rule violation, and `errorInterceptor` treats every 403 as an
    // authorization failure, so today the user is told "You do not have permission to perform
    // this action" instead of the reason. That is issue #258. Pinning the current wording here
    // would cement the bug; pinning the correct wording would fail until #258 lands. So this
    // asserts what is true either way, and #258 carries the assertion on the message.
    await page.getByTestId('group-actions').click();
    await page.getByTestId('group-action-close').click();
    const refusedDialog = modalFor(page, 'app-group-action-dialog');
    await selectInDialog(page, refusedDialog, 'closureReasonId', reason);
    await refusedDialog.getByTestId('group-action-confirm').click();

    // Scoped to `.error-toast`: success toasts from the activate and add-member steps are still
    // on screen at this point, and a bare `ion-toast` locator trips strict mode against them.
    await expect(page.locator('ion-toast.error-toast')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('group-status')).toContainText('Active');

    // Remove the member, and the same command now succeeds.
    await page.getByTestId('group-tab-members').click();
    await page.getByTestId('group-remove-members').click();
    const removeDialog = modalFor(page, 'app-group-members-dialog');
    await removeDialog.locator('ion-checkbox').filter({ hasText: clientName }).click();
    await removeDialog.getByTestId('group-members-confirm').click();
    await expect(page.getByRole('cell', { name: clientName })).toHaveCount(0, { timeout: 20000 });

    await page.getByTestId('group-actions').click();
    await page.getByTestId('group-action-close').click();
    const closeDialog = modalFor(page, 'app-group-action-dialog');
    await selectInDialog(page, closeDialog, 'closureReasonId', reason);
    await closeDialog.getByTestId('group-action-confirm').click();

    await expect(page.getByTestId('group-status')).toContainText('Closed', { timeout: 20000 });
    // Closed groups offer no further lifecycle commands.
    await page.getByTestId('group-actions').click();
    await expect(page.getByTestId('group-action-close')).toHaveCount(0);
    await expect(page.getByTestId('group-action-assign-staff')).toHaveCount(0);
  });
});
