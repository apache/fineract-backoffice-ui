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
 * The shell at a phone viewport.
 *
 * Runs only in the `mobile` project (Pixel 7, 412x915, touch), because every assertion here is
 * about behaviour that exists *because* the viewport is narrow. Running it at 1280px would
 * assert the opposite of what the application should do.
 *
 * The static half of this contract — one breakpoint, no `100vh`, no unbounded fixed widths —
 * is `scripts/check-responsive.mjs`. This is the half a regex cannot see: that the drawer is
 * actually modal, that following a link dismisses it, that a table has stopped being a table.
 */

import { test, expect, type Page } from './fixtures';

const TENANT = 'default';
const USER = 'mifos';
const PASSWORD = 'password';

/** Matches MOBILE_BREAKPOINT_PX. A viewport at or under this gets the narrow layout. */
const MOBILE_BREAKPOINT_PX = 768;

/** The smallest reliable touch target. Anything under it is a mis-tap waiting to happen. */
const MIN_TAP_TARGET_PX = 44;

async function mockBackend(page: Page): Promise<void> {
  // Registration order is load-bearing: Playwright matches routes in *reverse* order, so the
  // catch-all has to be registered first or it shadows every specific handler below it. With it
  // last, the authentication call returns `{}`, the session carries no permissions, and RBAC
  // quietly filters the navigation down to its ungated entries — which reads as a layout bug.
  await page.route(/\/api\/v1\//, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.route('**/branding/**', (r) =>
    r.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' }),
  );
  await page.route('**/config.json*', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fineractApiUrl: '/api/v1', defaultTenant: TENANT, rbacEnabled: true }),
    }),
  );
  await page.route(/\/api\/v1\/businessdate/, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ type: 'BUSINESS_DATE', date: [2026, 8, 16] }]),
    }),
  );
  await page.route('**/api/v1/authentication**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        username: USER,
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: 'Head Office',
        roles: [{ id: 1, name: 'Role', description: 'Role' }],
        permissions: ['ALL_FUNCTIONS'],
      }),
    }),
  );
}

async function signIn(page: Page): Promise<void> {
  await mockBackend(page);
  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT);
  await page.locator('#username').fill(USER);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

const drawer = (page: Page) => page.locator('nav.sidebar');
const hamburger = (page: Page) => page.locator('button.toggle-btn');

test.describe('the shell at a phone viewport', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('runs at a viewport the narrow layout actually applies to', async ({ page }) => {
    // Guards the project config itself. If someone widens the `mobile` device, every assertion
    // below would quietly start testing the desktop shell and still pass.
    const width = page.viewportSize()?.width ?? 0;
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(MOBILE_BREAKPOINT_PX);
  });

  test('does not scroll sideways', async ({ page }) => {
    // The single most common mobile defect, and the one users notice first.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('fills the visible viewport rather than running under the browser chrome', async ({
    page,
  }) => {
    // The 100dvh assertion, from the outside: the shell is exactly as tall as the viewport.
    const { shell, viewport } = await page.evaluate(() => ({
      shell: document.querySelector('.app-container')?.getBoundingClientRect().height ?? 0,
      viewport: window.innerHeight,
    }));
    expect(Math.abs(shell - viewport)).toBeLessThanOrEqual(1);
  });

  test('stacks dashboard columns on a phone viewport', async ({ page }) => {
    const layout = page.locator('.dashboard-layout');
    await expect(layout).toBeVisible();

    const columns = await layout.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns,
    );
    expect(columns.trim().split(/\s+/)).toHaveLength(1);
  });

  describe_drawer();

  test('renders tables as cards instead of a sideways scroll', async ({ page }) => {
    // The generic `/api/v1/` mock returns `{}`, which renders an empty state rather than a
    // table — so this case has to supply rows before it can assert on how they are laid out.
    await page.route(/\/api\/v1\/clients/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalFilteredRecords: 2,
          pageItems: [
            {
              id: 1,
              accountNo: '000000001',
              displayName: 'Aisha Rahman',
              status: { value: 'Active' },
              officeName: 'Head Office',
            },
            {
              id: 2,
              accountNo: '000000002',
              displayName: 'Boubacar Diallo',
              status: { value: 'Pending' },
              officeName: 'Head Office',
            },
          ],
        }),
      }),
    );
    await page.goto('/clients');
    const table = page.locator('table.data-table').first();
    await expect(table).toBeVisible();

    // The header row carries the column labels on a wide viewport; in card mode each cell
    // renders its own, so the header is hidden and the labels move into the cells.
    await expect(table.locator('tr[cdk-header-row]')).toBeHidden();

    const cell = table.locator('td[cdk-cell]').first();
    await expect(cell).toBeVisible();
    // Stacked, not columnar: a card cell spans the row it lives in.
    const [cellBox, rowBox] = await Promise.all([
      cell.boundingBox(),
      table.locator('tr[cdk-row]').first().boundingBox(),
    ]);
    expect(cellBox && rowBox).toBeTruthy();
    expect(cellBox!.width).toBeGreaterThan(rowBox!.width * 0.8);
  });

  test('expands search inside the bar, not over the page', async ({ page }) => {
    // The field is positioned against the header, which only works while the header is itself a
    // containing block. When it was not, this rendered in the page content over the dashboard
    // cards — and every other case here still passed, because none of them asks where it went.
    await page.locator('button.icon-btn').first().tap();

    const field = page.locator('ion-searchbar#global-search');
    await expect(field).toBeVisible();

    const [fieldBox, headerBox] = await Promise.all([
      field.boundingBox(),
      page.locator('.header').boundingBox(),
    ]);
    expect(fieldBox && headerBox).toBeTruthy();
    expect(fieldBox!.y).toBeGreaterThanOrEqual(headerBox!.y - 1);
    expect(fieldBox!.y + fieldBox!.height).toBeLessThanOrEqual(
      headerBox!.y + headerBox!.height + 1,
    );
  });

  test('gives every header control a thumb-sized target', async ({ page }) => {
    const controls = page.locator('.header button:visible');
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index++) {
      const box = await controls.nth(index).boundingBox();
      expect(box, `header control ${index} has no box`).toBeTruthy();
      const smallest = Math.min(box!.width, box!.height);
      expect(smallest, `header control ${index} is ${smallest}px`).toBeGreaterThanOrEqual(
        MIN_TAP_TARGET_PX,
      );
    }
  });
});

/** The drawer cases, grouped so the shared `beforeEach` above still applies. */
function describe_drawer(): void {
  test('starts with the navigation closed', async ({ page }) => {
    await expect(drawer(page)).toHaveClass(/drawer/);
    await expect(drawer(page)).not.toHaveClass(/open/);
    await expect(hamburger(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('opens on a tap, and reports itself as a modal', async ({ page }) => {
    await hamburger(page).tap();

    await expect(drawer(page)).toHaveClass(/open/);
    await expect(hamburger(page)).toHaveAttribute('aria-expanded', 'true');
    // It covers the page, so it has to say so — otherwise the reading order runs straight
    // through content the drawer is hiding.
    await expect(drawer(page)).toHaveAttribute('role', 'dialog');
    await expect(drawer(page)).toHaveAttribute('aria-modal', 'true');
  });

  test('moves focus into itself when it opens', async ({ page }) => {
    await hamburger(page).tap();
    await expect(drawer(page)).toHaveClass(/open/);

    const focusInside = await page.evaluate(() => {
      const panel = document.querySelector('nav.sidebar');
      return !!panel && !!document.activeElement && panel.contains(document.activeElement);
    });
    expect(focusInside).toBe(true);
  });

  test('closes on the backdrop, on Escape, and on its own control', async ({ page }) => {
    for (const dismiss of ['backdrop', 'escape', 'close-button'] as const) {
      await hamburger(page).tap();
      await expect(drawer(page)).toHaveClass(/open/);

      if (dismiss === 'backdrop') {
        // The drawer covers the left of the backdrop, so its centre — where tap() aims by
        // default — is behind the panel. Aim at the exposed strip instead.
        const box = (await page.locator('.drawer-backdrop').boundingBox())!;
        await page.locator('.drawer-backdrop').tap({ position: { x: box.width - 12, y: 80 } });
      }
      if (dismiss === 'escape') await page.keyboard.press('Escape');
      if (dismiss === 'close-button') await page.locator('button.drawer-close').tap();

      await expect(drawer(page), `dismissing via ${dismiss}`).not.toHaveClass(/open/);
    }
  });

  test('closes when a destination is chosen', async ({ page }) => {
    await hamburger(page).tap();
    await drawer(page).getByRole('link', { name: 'Clients', exact: true }).tap();

    await expect(page).toHaveURL(/\/clients/);
    // Otherwise the page the user asked for renders behind the menu they used to ask for it.
    await expect(drawer(page)).not.toHaveClass(/open/);
  });

  test('is out of the tab order while closed', async ({ page }) => {
    // `inert` is what keeps a closed off-canvas panel from being a long run of invisible tab
    // stops — the classic keyboard trap of a CSS-only drawer.
    await expect(drawer(page)).toHaveAttribute('inert', '');

    await hamburger(page).tap();
    await expect(drawer(page)).not.toHaveAttribute('inert', '');
  });
}
