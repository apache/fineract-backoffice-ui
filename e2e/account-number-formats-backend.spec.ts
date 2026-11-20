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
 * Account number formats against a real Fineract.
 *
 * The mocked spec beside this one proves the screen's wiring; what only a live platform can show
 * is that the three requests are shaped the way Fineract accepts, and that its rules are the ones
 * the screen is built on: one format per account type, and `PUT` taking the prefix alone.
 *
 * Self-contained by construction. The format is created through the UI and deleted through it
 * again, and the teardown removes anything left behind through the API — a format is optional
 * configuration, so an instance that had none is left with none.
 */

import { expect, test } from './fixtures';
import { login } from './utils/fineract-login';
import { API_BASE, createApiContext } from './utils/seed-api';
import { confirmDialog } from './utils/ionic-locators';

interface LiveFormat {
  id: number;
  accountType?: { id?: number; value?: string };
  prefixType?: { id?: number; value?: string };
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Account number formats against Fineract', () => {
  test('a format is created, prefixed and removed through the screen', async ({ page }) => {
    const api = await createApiContext();
    let createdId: number | undefined;

    try {
      // The template says which types the platform knows; the list says which already have a
      // format. The screen offers the difference, so the test needs the same difference to know
      // what it can create.
      const template = (await (
        await api.get(`${API_BASE}/accountnumberformats/template`)
      ).json()) as {
        accountTypeOptions?: { id: number; value: string }[];
        prefixTypeOptions?: Record<string, { id: number; value: string }[]>;
      };
      const existing = (await (await api.get(`${API_BASE}/accountnumberformats`)).json()) as
        LiveFormat[] | null;
      const taken = new Set((existing ?? []).map((format) => format.accountType?.id));
      const target = (template.accountTypeOptions ?? []).find((type) => !taken.has(type.id));
      test.skip(
        target === undefined,
        'every account type on this instance already has a format, so there is nothing to create',
      );
      const accountType = target!;

      await login(page);
      await page.goto('/system/account-number-formats');

      // Create, and watch the POST the adapter actually sends.
      const posted = page.waitForResponse(
        (response) =>
          response.url().includes('/accountnumberformats') &&
          response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: /add format/i }).click();
      const addDialog = confirmDialog(page);
      await expect(addDialog).toBeVisible();
      await addDialog.locator('[data-testid="dialog-field-accountType"]').click();
      await page
        .locator(
          'ion-alert.select-alert:not(.overlay-hidden), ion-popover.select-popover:not(.overlay-hidden)',
        )
        .getByRole('radio', { name: accountType.value, exact: true })
        .click();
      const addOk = page.locator('ion-alert.select-alert button:has-text("OK")');
      if (await addOk.count()) {
        await addOk.click();
      }
      await addDialog.locator('[data-testid="confirm-dialog-confirm"]').click();
      const createResponse = await posted;
      expect(
        createResponse.ok(),
        `POST /accountnumberformats was refused: ${createResponse.status()}`,
      ).toBe(true);

      const row = page.getByRole('row', { name: new RegExp(accountType.value) });
      await expect(row).toBeVisible({ timeout: 20000 });
      // Created without a prefix, deliberately: the platform takes it separately.
      await expect(row).toContainText('No prefix');

      // The platform's own record of what the screen just did.
      const afterCreate = (await (
        await api.get(`${API_BASE}/accountnumberformats`)
      ).json()) as LiveFormat[];
      const created = afterCreate.find((format) => format.accountType?.id === accountType.id);
      expect(created, 'the format the screen created is not in the platform list').toBeTruthy();
      createdId = created!.id;

      const prefixes = template.prefixTypeOptions?.[accountType.value] ?? [];
      if (prefixes.length > 0) {
        const putSent = page.waitForResponse(
          (response) =>
            response.url().includes('/accountnumberformats') &&
            response.request().method() === 'PUT',
        );
        await row.getByRole('button', { name: /set prefix/i }).click();
        const prefixDialog = confirmDialog(page);
        await expect(prefixDialog).toBeVisible();
        await prefixDialog.locator('[data-testid="dialog-field-prefixType"]').click();
        await page
          .locator(
            'ion-alert.select-alert:not(.overlay-hidden), ion-popover.select-popover:not(.overlay-hidden)',
          )
          .getByRole('radio', { name: prefixes[0].value, exact: true })
          .click();
        const prefixOk = page.locator('ion-alert.select-alert button:has-text("OK")');
        if (await prefixOk.count()) {
          await prefixOk.click();
        }
        await prefixDialog.locator('[data-testid="confirm-dialog-confirm"]').click();
        const putResponse = await putSent;
        expect(
          putResponse.ok(),
          `PUT /accountnumberformats/${createdId} was refused: ${putResponse.status()}`,
        ).toBe(true);

        // The prefix reached the platform, which is what the row claiming it does not prove.
        const afterPrefix = (await (
          await api.get(`${API_BASE}/accountnumberformats/${createdId}`)
        ).json()) as LiveFormat;
        expect(afterPrefix.prefixType?.id).toBe(prefixes[0].id);
      }

      // Delete, and check the platform agrees rather than only the table.
      const deleted = page.waitForResponse(
        (response) =>
          response.url().includes('/accountnumberformats') &&
          response.request().method() === 'DELETE',
      );
      await row.getByRole('button', { name: /^delete$/i }).click();
      const deleteDialog = confirmDialog(page);
      await expect(deleteDialog).toBeVisible();
      await deleteDialog.locator('[data-testid="confirm-dialog-confirm"]').click();
      const deleteResponse = await deleted;
      expect(deleteResponse.ok()).toBe(true);
      await expect(row).toHaveCount(0, { timeout: 20000 });

      const afterDelete = (await (
        await api.get(`${API_BASE}/accountnumberformats`)
      ).json()) as LiveFormat[];
      expect(
        (afterDelete ?? []).some((format) => format.id === createdId),
        'the platform still holds a format the screen deleted',
      ).toBe(false);
      createdId = undefined;
    } finally {
      // Only reached when the run left one behind; the happy path has already removed it.
      if (createdId !== undefined) {
        await api.delete(`${API_BASE}/accountnumberformats/${createdId}`);
      }
      await api.dispose();
    }
  });
});
