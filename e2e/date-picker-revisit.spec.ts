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

import { test, expect } from './fixtures';

const HEAD_OFFICE = 'Head Office';

/**
 * Regression cover for #541, rolled out across the routed forms.
 *
 * `ion-datetime-button` resolves its `ion-datetime` once, at load, and never retries, so a form
 * reached a second time through the router used to render blank, dead date controls. The failure
 * needs a *revisit* to show up — the first visit is masked by the lazy Ionic chunk load — which is
 * why each page here is entered three times without a reload in between.
 *
 * Runs at both viewports (see DUAL_VIEWPORT_SPECS in playwright.config.ts): the defect is a
 * lifecycle race rather than a layout concern, so it reproduces identically at phone width, and
 * the mobile shell reaches these forms through the same list-page buttons.
 */
test.describe('Date pickers on revisited forms', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/config.json*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ fineractApiUrl: '/api/v1', defaultTenant: 'default' }),
      }),
    );

    await page.route('**/api/v1/authentication**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          username: 'mifos',
          userId: 1,
          base64EncodedAuthenticationKey: 'YmFzZTY0',
          authenticated: true,
          officeId: 1,
          officeName: HEAD_OFFICE,
          roles: [{ id: 1, name: 'Super User', description: 'Super user' }],
          permissions: ['ALL_FUNCTIONS'],
        }),
      }),
    );

    await page.route('**/api/v1/offices**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            name: HEAD_OFFICE,
            nameDecorated: HEAD_OFFICE,
            externalId: '1',
            openingDate: [2009, 1, 1],
            hierarchy: '.',
          },
        ]),
      }),
    );

    // The list pages these forms are reached through only need to render; an empty collection is
    // enough, and keeps each new page from dragging in its own fixture.
    for (const collection of [
      'staff',
      'floatingrates',
      'holidays',
      'tellers',
      'glclosures',
      'currencies',
    ]) {
      await page.route(`**/api/v1/${collection}**`, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
      );
    }

    await page.goto('/login');
    if (!page.url().includes('/dashboard')) {
      await page.locator('#tenantId').fill('default');
      await page.locator('#username').fill('mifos');
      await page.locator('#password').fill('password');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL('/dashboard');
    }
  });

  /**
   * Ionic renders a datetime button's text into its shadow root, so the host's `textContent` is
   * always empty and cannot tell a bound control from a dead one.
   */
  const blankPickers = (page: import('@playwright/test').Page) =>
    page.evaluate(
      () =>
        Array.from(document.querySelectorAll('ion-datetime-button')).filter(
          (button) => (button.shadowRoot?.textContent ?? '').trim() === '',
        ).length,
    );

  const cases = [
    {
      name: 'office',
      listUrl: '/organization/offices',
      createButton: 'Create Office',
      // The shared list header renders its create action as a button; the staff list wires its
      // own `ion-button` to a routerLink, which Ionic renders as an anchor.
      createRole: 'button' as const,
    },
    {
      name: 'staff',
      listUrl: '/organization/staff',
      createButton: 'Create Staff Member',
      createRole: 'link' as const,
    },
    {
      name: 'holiday',
      listUrl: '/settings/holidays',
      createButton: 'Create Holiday',
      createRole: 'button' as const,
    },
    {
      name: 'teller',
      listUrl: '/tellers',
      createButton: 'Create Teller',
      createRole: 'button' as const,
    },
    {
      name: 'accounting closure',
      listUrl: '/accounting/closures',
      createButton: 'Close Period',
      createRole: 'button' as const,
    },
    {
      name: 'floating rate',
      listUrl: '/products/floating-rates',
      createButton: 'Create Floating Rate',
      createRole: 'button' as const,
      // This form's pickers live inside a @for over rate periods, so they are created after the
      // first render rather than with the page. The button and its modal then mount in the same
      // change-detection pass and the button binds to nothing -- #548, which `createPickersReady`
      // does not reach because the flag is already true by the time a row is added. Expected to
      // fail until that is fixed; when it starts passing, drop the marker with the fix.
      knownBroken: true,
      prepare: async (page: import('@playwright/test').Page) => {
        await page.getByRole('button', { name: 'Add Period', exact: true }).click();
      },
    },
  ];

  for (const { name, listUrl, createButton, createRole, prepare, knownBroken } of cases) {
    test(`${name} form keeps its pickers usable on every visit`, async ({ page }) => {
      if (knownBroken) test.fail();

      const pickerErrors: string[] = [];
      page.on('console', (message) => {
        const text = message.text();
        if (text.includes('[ion-datetime-button]')) pickerErrors.push(text);
      });

      await page.goto(listUrl);

      for (const visit of [1, 2, 3]) {
        await page.getByRole(createRole, { name: createButton, exact: true }).click();
        await expect(page).toHaveURL(`${listUrl}/create`);
        await prepare?.(page);
        await expect(page.locator('ion-datetime-button').first()).toBeAttached();

        await expect
          .poll(() => blankPickers(page), { message: `visit ${visit} left a picker unbound` })
          .toBe(0);

        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(page).toHaveURL(listUrl);
      }

      expect(pickerErrors).toEqual([]);
    });
  }
});
