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
 * The group detail screen, against `page.route()` mocks.
 *
 * This is the half of the coverage that runs without Fineract: it pins down what the screen
 * *sends* — which command, with which body, with which query parameter — for cases the real
 * backend cannot be steered into cheaply, and for the two the platform gets to refuse before
 * the UI is ever at fault (a failed load, an empty closure-reason code).
 *
 * The companion `group-membership.spec.ts` drives the same screen against a real backend.
 * Neither replaces the other: mocks prove the request, the backend proves the request is right.
 *
 *   npx playwright test e2e/group-detail.spec.ts --project=mocked
 */

import { Page, Request } from '@playwright/test';
import { test, expect } from './fixtures';
import { confirmDialog, modalFor } from './utils/ionic-locators';
import { selectInDialog } from './utils/select-in-dialog';
import { selectUiTab } from './utils/ui-locators';

const HEAD_OFFICE = 'Head Office';
const GROUP_ID = 7;

interface GroupBody {
  status: { id: number; code: string; value: string };
  staffId?: number;
  staffName?: string;
  clientMembers: Record<string, unknown>[];
  groupRoles: Record<string, unknown>[];
}

/** The group the mocks serve, rebuilt per test so a command in one cannot leak into another. */
function group(overrides: Partial<GroupBody> = {}) {
  return {
    id: GROUP_ID,
    accountNo: '000000007',
    name: 'Kibera Womens Group',
    status: { id: 300, code: 'clientStatusType.active', value: 'Active' },
    active: true,
    activationDate: [2026, 1, 15],
    officeId: 1,
    officeName: HEAD_OFFICE,
    staffId: 4,
    staffName: 'Okoth, Grace',
    hierarchy: '.7.',
    groupLevel: '2',
    clientMembers: [
      {
        id: 11,
        accountNo: '000000011',
        displayName: 'Amina Yusuf',
        status: { id: 300, code: 'clientStatusType.active', value: 'Active' },
        officeName: HEAD_OFFICE,
      },
      {
        id: 12,
        accountNo: '000000012',
        displayName: 'Beatrice Wanjiru',
        status: { id: 100, code: 'clientStatusType.pending', value: 'Pending' },
        officeName: HEAD_OFFICE,
      },
    ],
    // Only one of the two. The screen must not read this list — see the members assertion.
    activeClientMembers: [{ id: 11, displayName: 'Amina Yusuf' }],
    groupRoles: [
      { id: 3, role: { id: 13, name: 'Leader' }, clientId: 11, clientName: 'Amina Yusuf' },
    ],
    timeline: { submittedOnDate: [2026, 1, 1] },
    ...overrides,
  };
}

function json(body: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) };
}

/**
 * Stands up the whole mocked backend and signs in.
 *
 * Returns the commands the page issued, so a test asserts on the request rather than on a toast
 * — a toast proves the UI is pleased with itself, not that the platform was asked the right
 * thing.
 */
async function setup(
  page: Page,
  options: { groupOverrides?: Partial<GroupBody> } = {},
): Promise<{ commands: { command: string | null; roleId: string | null; body: unknown }[] }> {
  const commands: { command: string | null; roleId: string | null; body: unknown }[] = [];

  await page.route('**/config.json*', (route) =>
    route.fulfill(json({ fineractApiUrl: '/api/v1', defaultTenant: 'default' })),
  );

  await page.route('**/api/v1/authentication**', (route) =>
    route.fulfill(
      json({
        username: 'mifos',
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: HEAD_OFFICE,
        roles: [{ id: 1, name: 'Super User', description: 'Super user' }],
        permissions: ['ALL_FUNCTIONS'],
      }),
    ),
  );

  await page.route('**/api/v1/offices**', (route) =>
    route.fulfill(json([{ id: 1, name: HEAD_OFFICE, nameDecorated: HEAD_OFFICE, hierarchy: '.' }])),
  );

  // The candidate search behind "Add Members". Client 11 is already a member and is returned
  // deliberately: the dialog is responsible for filtering them out, not the search.
  await page.route('**/api/v1/clients**', (route) =>
    route.fulfill(
      json({
        totalFilteredRecords: 2,
        pageItems: [
          { id: 11, accountNo: '000000011', displayName: 'Amina Yusuf' },
          { id: 21, accountNo: '000000021', displayName: 'Chidi Okonkwo' },
        ],
      }),
    ),
  );

  await page.route('**/api/v1/groups/template**', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('command') === 'close') {
      return route.fulfill(json({ closureReasons: [{ id: 55, name: 'Group disbanded' }] }));
    }
    return route.fulfill(
      json({
        officeId: 1,
        officeOptions: [{ id: 1, name: HEAD_OFFICE }],
        staffOptions: [{ id: 4, displayName: 'Okoth, Grace' }],
        availableRoles: [{ id: 13, name: 'Leader', active: true }],
      }),
    );
  });

  await page.route('**/api/v1/groups/7/notes**', (route) => route.fulfill(json([])));

  await page.route('**/api/v1/groups/7**', async (route, request: Request) => {
    if (request.method() === 'POST') {
      const url = new URL(request.url());
      commands.push({
        command: url.searchParams.get('command'),
        roleId: url.searchParams.get('roleId'),
        body: JSON.parse(request.postData() || '{}'),
      });
      return route.fulfill(json({ officeId: 1, groupId: GROUP_ID, resourceId: GROUP_ID }));
    }
    return route.fulfill(json(group(options.groupOverrides)));
  });

  await page.goto('/login');
  if (!page.url().includes('/dashboard')) {
    await page.locator('#tenantId').fill('default');
    await page.locator('#username').fill('mifos');
    await page.locator('#password').fill('password');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/dashboard');
  }

  return { commands };
}

async function openGroup(page: Page): Promise<void> {
  await page.goto(`/groups/view/${GROUP_ID}`);
  await expect(page.getByTestId('group-name')).toHaveText('Kibera Womens Group');
}

test.describe('Group detail', () => {
  for (const width of [1280, 390]) {
    test(`custom field tabs expose the app keyboard and panel contract at ${width}px`, async ({
      page,
    }) => {
      await setup(page);
      const fetched: string[] = [];
      await page.route(/\/api\/v1\/datatables(?:\?|$)/, (route) =>
        route.fulfill(
          json([
            { registeredTableName: 'GroupStats', columnHeaderData: [{ columnName: 'value' }] },
            { registeredTableName: 'GroupNotes', columnHeaderData: [{ columnName: 'value' }] },
          ]),
        ),
      );
      await page.route(/\/api\/v1\/datatables\/Group(?:Stats|Notes)\/7(?:\?|$)/, (route) => {
        const table = new URL(route.request().url()).pathname.split('/')[4];
        fetched.push(table);
        return route.fulfill(
          json([{ value: table === 'GroupStats' ? 'Recorded statistics' : 'Recorded notes' }]),
        );
      });
      await openGroup(page);
      await page.getByTestId('group-tab-custom-fields').click();
      const scope = page.getByTestId('entity-datatables-tabs');
      const stats = scope.getByRole('tab', { name: 'GroupStats', exact: true });
      const notes = scope.getByRole('tab', { name: 'GroupNotes', exact: true });
      await expect(page.getByRole('cell', { name: 'Recorded statistics' })).toBeVisible();
      await page.setViewportSize({ width, height: 844 });
      await stats.focus();
      await stats.press('ArrowRight');
      await expect(notes).toBeFocused();
      await expect(stats).toHaveAttribute('aria-selected', 'true');
      expect(fetched).toEqual(['GroupStats']);
      await notes.press('Enter');
      await expect(notes).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('cell', { name: 'Recorded notes' })).toBeVisible();
      await notes.press('Tab');
      await expect(page.getByRole('tabpanel', { name: 'GroupNotes', exact: true })).toBeFocused();
      await selectUiTab(scope, 'GroupStats');
      await expect(page.getByRole('cell', { name: 'Recorded statistics' })).toBeVisible();
      await notes.focus();
      await notes.press('Space');
      await expect(notes).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('cell', { name: 'Recorded notes' })).toBeVisible();
      expect(fetched).toEqual(['GroupStats', 'GroupNotes', 'GroupStats', 'GroupNotes']);
    });
  }

  test('asks for the associations, and shows every member rather than only the active ones', async ({
    page,
  }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/groups/7') && request.method() === 'GET') {
        requested.push(request.url());
      }
    });

    await setup(page);
    await openGroup(page);

    // Without associations=all the platform answers with the summary alone and both the members
    // and committee tabs are empty for every group.
    expect(requested.some((url) => url.includes('associations=all'))).toBe(true);

    await expect(page.getByTestId('group-status')).toContainText('Active');
    await expect(page.getByTestId('group-staff-name')).toHaveText('Okoth, Grace');
    await expect(page.getByTestId('group-member-count')).toHaveText('2');

    await page.getByTestId('group-tab-members').click();
    await expect(page.getByRole('cell', { name: 'Amina Yusuf' })).toBeVisible();
    // The pending member. `activeClientMembers` omits her, and a screen reading that list would
    // hide the one member an officer most needs to see.
    await expect(page.getByRole('cell', { name: 'Beatrice Wanjiru' })).toBeVisible();
  });

  test('closes a group with the reason id and a Fineract-formatted date', async ({ page }) => {
    const { commands } = await setup(page);
    await openGroup(page);

    await page.getByTestId('group-actions').click();
    await page.getByTestId('group-action-close').click();

    const dialog = modalFor(page, 'app-group-action-dialog');
    await expect(dialog).toBeVisible();
    // selectInDialog, not selectOption: the latter presses Escape between attempts, which
    // dismisses the modal this select lives in. See its doc comment.
    await selectInDialog(page, dialog, 'closureReasonId', 'Group disbanded');
    await dialog.getByTestId('group-action-confirm').click();

    await expect.poll(() => commands.length).toBeGreaterThan(0);
    const sent = commands[0];
    expect(sent.command).toBe('close');
    const body = sent.body as Record<string, unknown>;
    expect(body['closureReasonId']).toBe(55);
    expect(body['dateFormat']).toBe('dd MMMM yyyy');
    // Zero-padded day. Fineract parses strictly against the format it is told to use, so an
    // unpadded '9 March 2026' does not fail validation — it 500s.
    expect(String(body['closureDate'])).toMatch(/^\d{2} [A-Z][a-z]+ \d{4}$/);
  });

  test('does not offer a client who is already a member, and associates the one it does', async ({
    page,
  }) => {
    const { commands } = await setup(page);
    await openGroup(page);

    await page.getByTestId('group-tab-members').click();
    await page.getByTestId('group-add-members').click();

    const dialog = modalFor(page, 'app-group-members-dialog');
    await expect(dialog).toBeVisible();

    // Client 11 comes back from the search and is already in the group; associating them twice
    // is rejected by the platform, so the dialog has to filter them out.
    await expect(dialog.getByTestId('group-member-11')).toHaveCount(0);
    await dialog.getByTestId('group-member-21').click();
    await dialog.getByTestId('group-members-confirm').click();

    await expect.poll(() => commands.length).toBeGreaterThan(0);
    expect(commands[0].command).toBe('associateClients');
    expect((commands[0].body as Record<string, unknown>)['clientMembers']).toEqual([21]);
  });

  test('unassigns a committee role by the assignment id, not the role id', async ({ page }) => {
    const { commands } = await setup(page);
    await openGroup(page);

    await page.getByTestId('group-tab-committee').click();
    await expect(page.getByRole('cell', { name: 'Leader' })).toBeVisible();

    await page.getByTestId('group-unassign-role-3').click();
    await confirmDialog(page).getByTestId('confirm-dialog-confirm').click();

    await expect.poll(() => commands.length).toBeGreaterThan(0);
    expect(commands[0].command).toBe('unassignRole');
    // 3 is the assignment; 13 is the role's code value. Sending 13 answers 404 naming a group
    // role that plainly exists, which reads like the feature is broken rather than misaddressed.
    expect(commands[0].roleId).toBe('3');
  });

  test('offers a retry when the group cannot be loaded', async ({ page }) => {
    await setup(page);

    await page.route('**/api/v1/groups/7**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    );
    await page.goto(`/groups/view/${GROUP_ID}`);

    // A blank screen is indistinguishable from a group with nothing in it, which is the failure
    // mode issue #223 is about.
    await expect(page.getByTestId('group-load-error')).toBeVisible();
    await expect(page.getByTestId('group-name')).toHaveCount(0);
  });

  test('says so when no closure reason has been defined', async ({ page }) => {
    await setup(page);
    await page.route('**/api/v1/groups/template**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('command') === 'close') {
        return route.fulfill(json({ closureReasons: [] }));
      }
      return route.fulfill(json({ officeId: 1, availableRoles: [] }));
    });

    await openGroup(page);
    await page.getByTestId('group-actions').click();
    await page.getByTestId('group-action-close').click();

    const dialog = modalFor(page, 'app-group-action-dialog');
    // The GroupClosureReason code ships empty. Confirm stays disabled rather than posting a
    // request the platform will refuse for a missing mandatory parameter.
    await expect(dialog.getByTestId('group-no-closure-reasons')).toBeVisible();
    // `toBeDisabled()` does not apply to ion-button, which is a custom element rather than a
    // native control; assert on the property Ionic actually reflects.
    await expect(dialog.getByTestId('group-action-confirm')).toHaveJSProperty('disabled', true);
  });
});
