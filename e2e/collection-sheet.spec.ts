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
 * The Collection Sheet filter, against a real Fineract.
 *
 * Three defects this pins, all found by driving the running screen:
 *
 *   1. Staff was an `<ion-input type="number">` — it asked a branch operator for a staff member's
 *      database id. It is a select over `GET /staff?officeId=N` now.
 *   2. Whatever was entered never left the browser. `staffId` is a field of its own and
 *      `buildBody()` spread only the request object, so the control did nothing at all. This
 *      reads the outgoing request body rather than the form, because the form was never the
 *      part that was broken.
 *   3. `command=generate` answers 200 with an empty body when nothing is due, and the screen
 *      rendered the literal word "null" under "Collection Results" with a live Save button
 *      beneath it.
 *
 * The populated-sheet path is deliberately absent: it needs a group with a meeting calendar and
 * repayments falling on the meeting date, and the shape Fineract returns for it is not the one
 * the generated client declares. See #670.
 */

import { test, expect, recordingTimeout } from './fixtures';
import { login } from './utils/fineract-login';
import { createApiContext, seedStaff } from './utils/seed-api';
import { isIonSelectDisabled } from './utils/ionic-locators';
import { selectOption } from './utils/select-option';

test.describe('Collection Sheet', () => {
  test('scopes staff to the office, sends the choice, and reports an empty sheet', async ({
    page,
  }) => {
    test.setTimeout(recordingTimeout(180000));
    const api = await createApiContext();

    try {
      // A staff member of our own, so the assertion does not depend on what else is seeded.
      const staff = await seedStaff(api, 'E2ESheetOfficer');
      await login(page);
      await page.goto('/collection-sheet');

      // Fineract scopes staff by office, so there is nothing to choose from until one is
      // picked. Read through the helper: ion-select keeps its disabled state in the shadow root,
      // so toBeDisabled() reads the host as enabled and fails misleadingly.
      expect(await isIonSelectDisabled(page, 'Staff')).toBe(true);

      const staffLoaded = page.waitForResponse(
        (response) => /\/staff\?/.test(response.url()) && response.request().method() === 'GET',
      );
      await selectOption(page, 'Office', 'Head Office');
      await staffLoaded;

      expect(await isIonSelectDisabled(page, 'Staff')).toBe(false);
      await selectOption(page, 'Staff', staff.staffName);

      // The point of the whole spec: the chosen staff member reaches the wire.
      const generated = page.waitForRequest(
        (request) => request.url().includes('/collectionsheet') && request.method() === 'POST',
      );
      await page.getByRole('button', { name: 'Generate' }).click();
      const body = (await generated).postDataJSON() as Record<string, unknown>;
      expect(body).toMatchObject({ officeId: 1, staffId: staff.staffId });

      // Nothing is due on a seeded instance with no meeting calendars, so this is the empty
      // branch — which used to render the word "null" and still offer Save.
      await expect(page.getByTestId('collection-sheet-empty')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('collection-sheet-results')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Save Collection Sheet/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
    } finally {
      await api.dispose();
    }
  });
});
