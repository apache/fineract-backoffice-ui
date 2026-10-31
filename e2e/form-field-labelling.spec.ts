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
 * Proof that a form field's visible label actually labels its control.
 *
 * `getByLabel` resolves a control by its accessible name coming from a real label association.
 * Before `app-form-field` the suite had **zero** such calls, and could not have had any: the
 * visible `ion-label` sat beside the control and named nothing, so every accessible name came
 * from a hand-repeated `[attr.aria-label]` instead (#287). These assertions pass only because
 * the label now lives in the control's own label slot.
 */

import { expect, test, type Page } from './fixtures';

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
    route.fulfill({ json: { name: 'enable-business-date', enabled: false } }),
  );
  await page.route('**/api/v1/businessdate**', (route) => route.fulfill({ json: [] }));
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

test.use({ viewport: { width: 1280, height: 900 } });

test('a converted field is addressable by its visible label', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/v1/offices**', (route) =>
    route.fulfill({ json: [{ id: 1, name: 'Head Office', nameDecorated: 'Head Office' }] }),
  );

  await page.goto('/organization/offices/create');

  // The association, not a hand-written aria-label: filling through the label reaches the
  // control the label is for.
  const name = page.getByLabel('Office Name');
  await expect(name).toBeVisible();
  await name.fill('Branch Alpha');
  await expect(page.getByTestId('office-name-input').locator('input')).toHaveValue('Branch Alpha');

  // The accessible name carries the label text and not the asterisk's markup, so a required
  // field is still addressable by what it is called.
  await expect(page.getByRole('textbox', { name: /Office Name/ })).toHaveCount(1);

  // The optional field converted the same way, and the select too.
  await expect(page.getByLabel('External ID')).toBeVisible();
  await expect(page.getByLabel('Parent Office')).toBeVisible();
});

test('a date field is addressable by its label', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/v1/offices**', (route) =>
    route.fulfill({ json: [{ id: 1, name: 'Head Office', nameDecorated: 'Head Office' }] }),
  );

  await page.goto('/organization/offices/create');

  // A date triad has no label slot — the control is a button whose name would otherwise be
  // whatever date it shows — so `app-date-field` names it by reference instead. This passing
  // is what proves that reference reaches the button.
  const opening = page.getByLabel('Opening Date');
  await expect(opening).toBeVisible();

  // And an unset picker says so rather than showing today, which reads as a chosen value.
  // This form defaults its opening date to the tenant's today, so the button shows a date
  // rather than the unset placeholder. The placeholder path is covered where it applies, in
  // the component's own spec.
  await expect(opening).not.toHaveText('');
});
