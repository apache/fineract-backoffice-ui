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
 * The guided tour: what it points at, what it says it is, and how it behaves on a phone.
 *
 * Each case here stands for something that was actually wrong. The tour used to point at the
 * sidebar while describing a dashboard card; it used to hand the *dashboard* tour to every route
 * it had no copy for, so pressing Guide on Notifications welcomed you to a screen you were not
 * looking at; the card announced nothing to a screen reader and could not be dismissed from the
 * keyboard; and at a phone width a 360px card pinned bottom-right covered the thing it was
 * talking about.
 *
 * Runs in two projects. The desktop cases assert the wide layout and the phone case asserts the
 * bottom sheet, so each half is skipped at the viewport where it would assert the opposite of the
 * intended behaviour — see the `mobile` project and DUAL_VIEWPORT_SPECS in playwright.config.ts.
 */

import { test, expect, type Page } from './fixtures';

const TENANT = 'default';
const USER = 'mifos';
const PASSWORD = 'password';

/** Matches MOBILE_BREAKPOINT_PX. At or below this width the card is a full-width bottom sheet. */
const MOBILE_BREAKPOINT_PX = 768;

/**
 * The dashboard tour's opening line, quoted so the composed-tour case can assert its absence.
 *
 * This exact sentence is what a user on Notifications, Accounting or any of the other unmatched
 * routes used to be shown, which is the defect the last desktop case guards.
 */
const DASHBOARD_WELCOME = 'Welcome to Fineract Backoffice';

async function mockBackend(page: Page): Promise<void> {
  // Registered before the specific handlers below because Playwright matches routes in reverse
  // order: with the catch-all last, the sign-in call would answer `{}` and the session would
  // carry no permissions at all.
  await page.route(/\/api\/v1\//, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/config.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fineractApiUrl: '/api/v1', defaultTenant: TENANT }),
    });
  });
  await page.route('**/api/v1/authentication**', async (route) => {
    await route.fulfill({
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
    });
  });
  await page.route(/\/api\/v1\/businessdate/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ type: 'BUSINESS_DATE', date: [2026, 8, 16] }]),
    });
  });
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

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test.describe('the guided tour', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) <= MOBILE_BREAKPOINT_PX,
    'asserts the wide layout, where the Guide button sits in the header row',
  );

  test('highlights the System Status card, not the sidebar, on the dashboard tour', async ({
    page,
  }) => {
    await page.locator('.tour-btn').click();
    await expect(page.locator('app-guidance-tour')).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();
    // Scoped to the tour card specifically: the dashboard's own cards (Pending Approvals, Loan
    // Status Distribution, etc.) each have their own ion-card-title too.
    await expect(page.locator('.guidance-card ion-card-title')).toContainText(
      'System Overview & Status',
    );

    // The dashboard's System Status card is the thing the step is actually describing, and it
    // alone should carry the highlight. Waited for before the negative assertions below, so
    // those cannot pass merely because the lookup had not run yet.
    await expect(page.locator('.status-list')).toHaveClass(/guidance-highlight/);

    // The sidebar's own nav list must never carry the highlight — that was the bug: the bare
    // 'ul' selector matched it first because it sits earlier in the DOM than the dashboard.
    await expect(page.locator('.nav-list')).not.toHaveClass(/guidance-highlight/);

    // The general form of the same guarantee, which is what the 'content' scope buys: a step
    // that does not opt into 'shell' searches inside `main`, so no selector it carries — however
    // loose — can reach the header or the sidebar. Every step of the dashboard tour is
    // content-scoped, so nothing outside `main` may be outlined at any point in it.
    const highlightedOutsideMain = await page.evaluate(() =>
      [...document.querySelectorAll('.guidance-highlight')]
        .filter((el) => !el.closest('main'))
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
    );
    expect(highlightedOutsideMain).toEqual([]);
  });

  test('presents the card as a dialog named and described by its own copy', async ({ page }) => {
    await page.locator('.tour-btn').click();

    // The card carried no role and no relationships at all, so a screen reader announced an
    // unlabelled group of buttons. aria-labelledby/-describedby point at the step's own title
    // and paragraph, which is the only copy that describes what the tour is currently saying.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName(new RegExp(DASHBOARD_WELCOME));
    await expect(dialog).toHaveAccessibleDescription(/This guide will walk you through/);
  });

  test('announces the step counter as a polite live region', async ({ page }) => {
    await page.locator('.tour-btn').click();

    // Next rewrites the card in place rather than opening a new one, so without a live region
    // the only feedback that anything happened is visual.
    const progress = page.locator('.guidance-card .progress-info');
    await expect(progress).toHaveAttribute('aria-live', 'polite');
    await expect(progress).toHaveText('Step 1 of 2');

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(progress).toHaveText('Step 2 of 2');
  });

  test('closes on Escape and hands focus back to the Guide button', async ({ page }) => {
    await page.locator('.tour-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');

    // A modal-ish panel that can only be dismissed by finding and clicking Exit is a keyboard
    // trap; Escape is the expected way out of anything role="dialog".
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // And focus goes back where it came from rather than to the top of the document, so the
    // next Tab continues from the button the user pressed.
    await expect(page.locator('.tour-btn')).toBeFocused();
  });

  test('names an unmatched route after itself instead of handing it the dashboard tour', async ({
    page,
  }) => {
    // /notifications matches none of the hand-written tours, so its tour is composed: the intro
    // step is titled from the route's own `title`, and a step is added per control found on the
    // screen. Before that, every unmatched route fell through to the dashboard tour.
    await page.goto('/notifications');
    await expect(page).toHaveURL('/notifications');

    await page.locator('.tour-btn').click();

    const card = page.locator('.guidance-card');
    await expect(card.locator('ion-card-title')).toContainText('Notifications');
    // The regression itself: the dashboard's welcome copy has no business appearing on a screen
    // that is not the dashboard.
    await expect(card).not.toContainText(DASHBOARD_WELCOME);
  });
});

test.describe('the guided tour at a phone viewport', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? Number.POSITIVE_INFINITY) > MOBILE_BREAKPOINT_PX,
    'asserts the bottom sheet and the overflow menu, neither of which exists on a wide screen',
  );

  test('opens from the overflow menu as a full-width bottom sheet', async ({ page }) => {
    const width = page.viewportSize()?.width ?? 0;
    // Guards the project config: if the `mobile` device were widened past the breakpoint, every
    // assertion below would silently start describing the desktop layout.
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(MOBILE_BREAKPOINT_PX);

    // There is no room for the header row's controls at this width, so they move into the
    // overflow menu wholesale. The Guide button has to still be reachable there — a tour nobody
    // can open on a phone is the same as no tour.
    await expect(page.locator('.header-actions .tour-btn')).toHaveCount(0);
    await page.locator('#header-overflow').click();
    const guide = page.locator('ion-popover .tour-btn');
    await expect(guide).toBeVisible();
    await guide.click();

    // Located by class rather than by role: the header's overflow menu is an ion-popover, which
    // is itself a role="dialog", so at this width the role alone is ambiguous.
    await expect(page.locator('.guidance-overlay')).toBeVisible();
    await expect(page.locator('.guidance-overlay')).toHaveAttribute('role', 'dialog');
    // The class is what gives the scroll container room to lift the highlighted control clear of
    // the sheet; without it the step points at something the card is covering.
    await expect(page.locator('body')).toHaveClass(/guidance-active/);

    // A fixed panel is the usual way a page starts scrolling sideways, and the phone layout has
    // no horizontal scroll anywhere else.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // Bottom sheet, not a floating card: edge to edge, and sitting on the bottom of the viewport.
    const box = await page.locator('.guidance-card').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(width - 1);
    expect(box!.x).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Exit' }).click();
    // The padding the class adds is only correct while a step is on screen, so leaving the tour
    // has to take it off again.
    await expect(page.locator('body')).not.toHaveClass(/guidance-active/);
  });
});
