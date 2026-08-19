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
 * The center detail view, end to end against a real Fineract.
 *
 * A center could be created and renamed and nothing else: `centers.routes.ts` declared list,
 * create and edit, so its groups could not be seen, staff could not be assigned, and it could not
 * be activated. For centre-based lending the center is the unit of daily work.
 *
 * Three things here are specific to centers and are why this is its own suite:
 *
 * - The read must name the association. `associations=all` returns *nothing* extra on a center,
 *   so the groups tab would be empty by construction under the parameter that sounds right.
 * - Staff assignment is a `PUT` carrying the unchanged `name`, not a command — the platform
 *   exposes no `assignStaff` for a center, and rejects the update without a name.
 * - Unassignment is reachable only through the *groups* resource, because a center is a group at
 *   a higher level. The center endpoint has no such command, `staffId: null` is ignored and
 *   `staffId: -1` is refused for not being greater than zero.
 *
 *   npx playwright test e2e/center-servicing.spec.ts --project=backend --workers=1
 */

import { expect, test, recordingTimeout } from './fixtures';
import { login, uniqueSuffix } from './utils/fineract-login';
import { ionSelect } from './utils/ionic-locators';
import { captureJson } from './utils/capture-response';
import { createApiContext, seedCenter, seedGroup, seedStaff } from './utils/seed-api';

test.describe('Center servicing', () => {
  test('a center is activated, staffed and given a group', async ({ page }) => {
    test.setTimeout(recordingTimeout(240000));

    const api = await createApiContext();
    const suffix = uniqueSuffix();
    const center = await seedCenter(api, `E2ECenter ${suffix}`);
    const group = await seedGroup(api, `E2ECenterGroup ${suffix}`);
    // Seeded rather than assumed: a fresh instance has no staff at all, so the picker — which is
    // scoped to the office because the platform refuses staff from another one — would be empty.
    const staff = await seedStaff(api, 'E2ECenterStaff');
    await api.dispose();

    await login(page);
    await page.goto(`/centers/view/${center.centerId}`);

    await expect(page.getByTestId('center-name')).toContainText(center.centerName, {
      timeout: 20000,
    });
    await expect(page.getByTestId('center-status')).toContainText(/pending/i);
    await expect(page.getByTestId('center-group-count')).toHaveText('0');

    // --- Activate ------------------------------------------------------------------------------
    //
    // The response is captured rather than only the resulting badge. A refused activation leaves
    // the badge on "Pending" and the assertion then reports nothing beyond that, which says
    // neither what was sent nor why the platform objected — the difference between a diagnosable
    // failure and one that has to be reproduced before it can be read.
    const activation = await captureJson<Record<string, unknown>>(
      page,
      new RegExp(`/centers/${center.centerId}(\\?|$)`),
      'POST',
      async () => {
        await page.getByTestId('center-actions').click();
        await page.getByTestId('center-action-activate').click();
        await page.getByTestId('center-action-confirm').click();
      },
    );
    expect(
      activation['resourceId'],
      `activation was refused; the platform answered: ${JSON.stringify(activation)}`,
    ).toBeDefined();

    await expect(page.getByTestId('center-status')).toContainText(/active/i, { timeout: 20000 });

    // --- Assign staff --------------------------------------------------------------------------
    //
    // The assignment goes out as a PUT carrying the center's unchanged name. Without it the
    // platform answers validation.msg.center.name.cannot.be.blank, which reads like a form bug.
    await page.getByTestId('center-actions').click();
    await page.getByTestId('center-action-assign-staff').click();
    // Not `selectOption`: it waits for every overlay to close first, and this page keeps a
    // declarative <ion-popover trigger="…"> mounted for the actions menu, so that never holds.
    // The radio is addressed by name instead — the actions popover has none.
    await ionSelect(page, 'Staff').click();
    await page
      .locator('ion-alert, ion-popover, ion-action-sheet')
      .getByRole('radio', { name: staff.staffName, exact: true })
      .click();
    await page.getByTestId('center-staff-confirm').click();

    // Asserted by name, not merely by "not Unassigned": that proves the chosen officer is the one
    // the update carried, which is the whole point of scoping the picker to the office.
    await expect(page.getByTestId('center-staff-name')).toHaveText(staff.staffName, {
      timeout: 20000,
    });

    // --- Attach a group ------------------------------------------------------------------------
    //
    // Candidates come from `orphansOnly=true`, the platform's own filter for groups that do not
    // already belong to a center — a group has at most one parent.
    await page.getByTestId('center-actions').click();
    await page.getByTestId('center-action-attach-groups').click();
    await page.getByTestId(`center-group-${group.groupId}`).click();
    await page.getByTestId('center-groups-confirm').click();

    await expect(page.getByTestId('center-group-count')).toHaveText('1', { timeout: 20000 });
    await expect(page.getByTestId('center-groups-table')).toContainText(group.groupName);

    // The group links to its own detail view, which is the point of listing it here.
    await expect(page.getByTestId('center-group-link').first()).toHaveAttribute(
      'href',
      new RegExp(`/groups/view/${group.groupId}$`),
    );

    // --- Unassign staff, through the groups resource --------------------------------------------
    await page.getByTestId('center-actions').click();
    await page.getByTestId('center-action-unassign-staff').click();
    await page.getByRole('button', { name: /^(confirm|yes|ok)$/i }).click();
    await expect(page.getByTestId('center-staff-name')).toHaveText('Unassigned', {
      timeout: 20000,
    });

    // --- Detach the group ----------------------------------------------------------------------
    await page.getByTestId('center-actions').click();
    await page.getByTestId('center-action-detach-groups').click();
    await page.getByTestId(`center-group-${group.groupId}`).click();
    await page.getByTestId('center-groups-confirm').click();
    await expect(page.getByTestId('center-group-count')).toHaveText('0', { timeout: 20000 });

    // --- Schedule the meeting -------------------------------------------------------------------
    //
    // Only offered on an active center: a meeting that starts before the activation date is
    // refused with validation.msg.calendar.cannot.be.before.centers.activation.date.
    await expect(page.getByTestId('center-meeting')).toHaveText('—');
    await page.getByTestId('center-actions').click();
    await page.getByTestId('center-action-meeting').click();
    // Fill the native input Ionic renders, which is what carries the `name` and what the
    // ngModel binding listens to; filling the ion-input host does not update the model.
    await page.locator('input[name="title"]').fill('Weekly collection');
    await page.getByTestId('center-meeting-confirm').click();

    await expect(page.getByTestId('center-meeting')).toContainText('Weekly collection', {
      timeout: 20000,
    });
  });

  /**
   * Notes are read and written through the groups resource: `/centers/{id}/notes` answers 404
   * "Note does not support resource centers", while `/groups/{centerId}/notes` stores one.
   */
  test('notes are recorded against the center', async ({ page }) => {
    test.setTimeout(recordingTimeout(180000));

    const api = await createApiContext();
    const center = await seedCenter(api, `E2ECenterNotes ${uniqueSuffix()}`);
    await api.dispose();

    await login(page);
    await page.goto(`/centers/view/${center.centerId}`);
    await expect(page.getByTestId('center-name')).toContainText(center.centerName, {
      timeout: 20000,
    });

    await page.getByTestId('center-tab-notes').click();
    await expect(page.getByTestId('center-notes')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('group-add-note').click();
    // The form is the group one, reused because the endpoint is the group one — but it must come
    // back to the center rather than to a group view that would not exist.
    await expect(page).toHaveURL(new RegExp(`/centers/${center.centerId}/notes/create$`), {
      timeout: 20000,
    });
    await page.locator('textarea[name="note"]').fill('Recorded from the center view');
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page).toHaveURL(new RegExp(`/centers/view/${center.centerId}$`), {
      timeout: 20000,
    });
    await page.getByTestId('center-tab-notes').click();
    await expect(page.getByTestId('center-notes')).toContainText('Recorded from the center view', {
      timeout: 20000,
    });
  });
});
