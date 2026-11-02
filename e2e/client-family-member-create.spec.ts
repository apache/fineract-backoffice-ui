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
 * What the add-family-member form tells the operator before the platform is involved.
 *
 * Three things that used to be left to guesswork: which fields are holding Save, which birth
 * dates Fineract will entertain, and whether the save landed. The business date is mocked to a
 * day no runner will be on, so the picker's bound can only have come from the platform — a
 * bound read off the browser's clock fails here at every hour of the day, which is the point:
 * for a tenant east of the operator the two are different days every evening (#758).
 */

import { expect, test, type Page } from './fixtures';
import { selectOption } from './utils/select-option';

/** Mid-month, so the day after it is still in the same calendar page. */
const BUSINESS_DATE = '2026-10-15';

async function signIn(page: Page): Promise<void> {
  await page.route(
    /\/(?:fineract-provider\/)?api\/v1\/(?:clients|loans|savingsaccounts)(?:\?|$)/,
    (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } })
        : route.fallback(),
  );
  await page.route('**/config.json*', (route) =>
    route.fulfill({ json: { fineractApiUrl: '/api/v1', defaultTenant: 'default' } }),
  );
  await page.route('**/api/v1/authentication**', (route) =>
    route.fulfill({
      json: {
        username: 'mifos',
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: 'Head Office',
        permissions: ['ALL_FUNCTIONS'],
      },
    }),
  );
  await page.route('**/api/v1/configurations/name/enable-business-date**', (route) =>
    route.fulfill({ json: { name: 'enable-business-date', enabled: true } }),
  );
  await page.route('**/api/v1/businessdate**', (route) =>
    route.fulfill({ json: [{ type: 'BUSINESS_DATE', date: [2026, 10, 15] }] }),
  );
  await page.route('**/api/v1/loans/due**', (route) =>
    route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } }),
  );
  await page.route('**/api/v1/runreports/**', (route) =>
    route.fulfill({ json: { columnHeaders: [], data: [] } }),
  );
  await page.goto('/login');
  await page.locator('#tenantId').fill('default');
  await page.locator('#username').fill('mifos');
  await page.locator('#password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

interface Created {
  payloads: Record<string, unknown>[];
}

async function mockClient(page: Page): Promise<Created> {
  const created: Created = { payloads: [] };
  await page.route(/\/api\/v1\/clients\/7(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        id: 7,
        firstname: 'Synthetic',
        lastname: 'Client',
        legalFormId: 1,
        officeId: 1,
        active: true,
      },
    }),
  );
  await page.route('**/api/v1/clients/7/familymembers/template**', (route) =>
    route.fulfill({
      json: {
        relationshipIdOptions: [{ id: 1, name: 'Sibling' }],
        genderIdOptions: [{ id: 5, name: 'Female' }],
      },
    }),
  );
  await page.route(/\/api\/v1\/clients\/7\/familymembers(?:\?.*)?$/, (route) => {
    if (route.request().method() !== 'POST') {
      return route.fulfill({ json: [] });
    }
    created.payloads.push(route.request().postDataJSON() as Record<string, unknown>);
    // The id Fineract answers with belongs to the member, not the client.
    return route.fulfill({ json: { clientId: 7, resourceId: 44 } });
  });
  return created;
}

const submit = (page: Page) => page.getByTestId('family-submit-btn');

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Add family member', () => {
  test('names the fields holding Save, and stops once they are filled', async ({ page }) => {
    await signIn(page);
    await mockClient(page);
    await page.goto('/clients/7/family-members/create');

    // First name, last name and relationship: the three this form insists on. Not the
    // platform's rules — it accepts a member with no first name and keeps no rule about the
    // last one; see client-family-member-backend.spec.ts, which measures that.
    await expect(page.locator('.required-marker')).toHaveCount(3);
    await expect(page.getByTestId('family-submit-hint')).toBeVisible();
    // ion-button is a custom element, so its disabled state is a property, not the attribute
    // Playwright's toBeDisabled() reads.
    await expect(submit(page)).toHaveJSProperty('disabled', true);

    // Leaving a required field untouched says nothing; leaving it empty says so.
    await expect(page.getByTestId('family-first-name-error')).toHaveCount(0);
    await page.getByTestId('family-first-name-input').locator('input').click();
    await page.getByTestId('family-last-name-input').locator('input').click();
    await expect(page.getByTestId('family-first-name-error')).toBeVisible();

    await page.getByTestId('family-first-name-input').locator('input').fill('Asha');
    await page.getByTestId('family-last-name-input').locator('input').fill('Kumar');
    await expect(submit(page)).toHaveJSProperty('disabled', true);

    await selectOption(page, 'Relationship', 'Sibling');

    await expect(page.getByTestId('family-submit-hint')).toHaveCount(0);
    await expect(submit(page)).toHaveJSProperty('disabled', false);
  });

  test("offers no birth date after the platform's day, and confirms the save", async ({ page }) => {
    // The calendar renders the *browser's* month, while `max` comes from the platform. Pinned,
    // because this test names cells in October: unpinned it passed every day of October 2026
    // and then failed on 1 November, when the picker began opening on November and the cells
    // below stopped existing. `setFixedTime` for the reason given in
    // `tenant-date-defaults-backend.spec.ts` — it changes what `new Date()` answers without
    // replacing the timer queue Angular and Ionic run on.
    //
    // Deliberately a different day from BUSINESS_DATE, and after it: if the form ever took its
    // ceiling from the browser instead of the platform, `max` would read 2026-10-20 and the
    // assertion below would catch it.
    await page.clock.setFixedTime(new Date('2026-10-20T10:00:00'));

    await signIn(page);
    const created = await mockClient(page);
    await page.goto('/clients/7/family-members/create');

    const picker = page.getByTestId('family-dob-picker');
    await expect
      .poll(() => picker.evaluate((element: HTMLElement & { max?: string }) => element.max))
      .toBe(BUSINESS_DATE);

    await page.locator('ion-datetime-button[datetime="family-dob-picker"]').click();
    await expect(picker).toBeVisible();
    // The business date itself is a birth date Fineract accepts; the day after it is not.
    await expect(picker.getByRole('button', { name: /Friday, October 16/ })).toBeDisabled();
    await picker.getByRole('button', { name: /Thursday, October 15/ }).click();
    await page.keyboard.press('Escape');

    await page.getByTestId('family-first-name-input').locator('input').fill('Asha');
    await page.getByTestId('family-last-name-input').locator('input').fill('Kumar');
    await selectOption(page, 'Relationship', 'Sibling');

    await submit(page).click();

    // ion-toast carries its text as a property, not an attribute or light-DOM text.
    await expect(page.locator('ion-toast.success-toast')).toHaveJSProperty(
      'message',
      'Family member added.',
    );
    // The client's page, not /clients/view/44 — that resourceId is the member's.
    await expect(page).toHaveURL('/clients/view/7');
    expect(created.payloads).toHaveLength(1);
    expect(created.payloads[0]).toMatchObject({
      firstName: 'Asha',
      lastName: 'Kumar',
      relationshipId: 1,
      dateOfBirth: '15 October 2026',
    });
  });
});
