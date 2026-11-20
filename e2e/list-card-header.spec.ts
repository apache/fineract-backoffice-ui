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

import { expect, test, type Page } from './fixtures';

async function signIn(page: Page, permissions = ['ALL_FUNCTIONS']): Promise<void> {
  await page.route('**/config.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fineractApiUrl: '/api/v1', defaultTenant: 'default' }),
    });
  });
  await page.route('**/api/v1/authentication**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        username: 'mifos',
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: 'Head Office',
        permissions,
      }),
    });
  });
  await page.route('**/api/v1/businessdate**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ type: 'BUSINESS_DATE', date: [2026, 9, 5] }]),
    });
  });

  await page.goto('/login');
  await page.locator('#tenantId').fill('default');
  await page.locator('#username').fill('mifos');
  await page.locator('#password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`shared list header ${viewport.width}px`, () => {
    test.use({ viewport });
    for (const target of [
      { path: '/clients', label: 'Create Client', next: '/clients/create' },
      { path: '/centers', label: 'Create Center', next: '/centers/create' },
    ]) {
      test(`${target.path} insets and aligns its primary action`, async ({ page }, testInfo) => {
        await page.route('**/api/v1/clients**', (route) =>
          route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } }),
        );
        await page.route('**/api/v2/clients/search**', (route) =>
          route.fulfill({ json: { content: [], totalElements: 0 } }),
        );
        await page.route('**/api/v1/centers**', (route) =>
          route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } }),
        );
        await page.route('**/api/v1/offices**', (route) => route.fulfill({ json: [] }));
        await signIn(page);
        await page.goto(target.path);
        const card = page.getByTestId('data-table-card');
        const title = card.getByTestId('data-table-title');
        const button = card.getByRole('button', { name: target.label, exact: true });
        await expect(title).toBeVisible();
        await expect(button).toBeVisible();
        const c = await card.boundingBox(),
          t = await title.boundingBox(),
          b = await button.boundingBox();
        if (!c || !t || !b) throw new Error('Expected visible header geometry');
        expect(t.x - c.x).toBeGreaterThanOrEqual(15.5);
        expect(b.x - c.x).toBeGreaterThanOrEqual(15.5);
        expect(c.x + c.width - b.x - b.width).toBeGreaterThanOrEqual(15.5);
        expect(t.y - c.y).toBeGreaterThanOrEqual(15.5);
        if (viewport.width > 768) {
          expect(Math.abs(t.y + t.height / 2 - b.y - b.height / 2)).toBeLessThanOrEqual(1);
          expect(t.x + t.width).toBeLessThanOrEqual(b.x);
        } else expect(b.y).toBeGreaterThanOrEqual(t.y + t.height);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: testInfo.outputPath(target.path.slice(1) + '-header.png'),
          fullPage: true,
        });
        await button.focus();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(target.next);
      });
    }
    test('a title-only reader header has no empty action gap', async ({ page }) => {
      await page.route('**/api/v1/clients**', (route) =>
        route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } }),
      );
      await page.route('**/api/v2/clients/search**', (route) =>
        route.fulfill({ json: { content: [], totalElements: 0 } }),
      );
      await signIn(page, ['READ_CLIENT']);
      await page.goto('/clients');
      const card = page.getByTestId('data-table-card'),
        title = card.getByTestId('data-table-title');
      await expect(title).toBeVisible();
      await expect(card.getByRole('button', { name: 'Create Client', exact: true })).toHaveCount(0);
      const c = await card.boundingBox(),
        t = await title.boundingBox(),
        h = await card.getByTestId('data-table-header').boundingBox();
      if (!c || !t || !h) throw new Error('Expected visible title-only header geometry');
      expect(t.x - c.x).toBeGreaterThanOrEqual(15.5);
      expect(h.height).toBeLessThanOrEqual(t.height + 33);
    });
  });
}
