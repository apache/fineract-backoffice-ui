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
 * One fully branded deployment, rendered.
 *
 * `deployment-customization.spec.ts` covers each mechanism against a minimal overlay written for
 * that case. This does the opposite: it serves the *real* reference example — the same file
 * `check-reference-downstream.mjs` validates statically and `make-branding-demo.mjs` mounts for
 * local development — and asserts what an operator actually ends up looking at.
 *
 * Reading the example from disk rather than restating it is the point. A hand-copied overlay
 * drifts from the published one, and then this suite passes while the example a deployment
 * copies is broken. There is one artefact, checked three ways: resolved by CI, rendered here,
 * mounted by the demo script.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from './fixtures';

// Resolved from the repo root, which is where Playwright runs. `import.meta` is unavailable:
// the suite is transpiled to CommonJS.
const EXAMPLE = JSON.parse(
  readFileSync(join(process.cwd(), 'DOCS/examples/branding-config.example.json'), 'utf8'),
);

const TENANT = 'default';
const USER = 'mifos';
const PASSWORD = 'password';

/** The strings `make-branding-demo.mjs` writes, so the demo and this test show the same product. */
const STRING_OVERRIDES = {
  nav: { dashboard: 'Overview', loans: 'Lending' },
  app: { logout: 'Sign out' },
};

const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">' +
  '<rect width="32" height="32" rx="7" fill="#0b5f8a"/></svg>';

async function deployBrandedInstitution(page: Page): Promise<void> {
  await page.route(/\/api\/v1\//, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/config.json*', async (route) => {
    if (route.request().url().includes('/branding/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EXAMPLE),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        fineractApiUrl: '/api/v1',
        defaultTenant: TENANT,
        rbacEnabled: true,
        // This fixture always mounts an overlay, so the layer beneath it says so — which is what
        // the container entrypoint does after finding the directory the deployer copied in.
        brandingOverlayEnabled: true,
      }),
    });
  });
  // Registered before the `en.json` handler on purpose: Playwright matches routes in reverse
  // registration order, so the catch-all has to go first or it shadows the specific one.
  await page.route('**/branding/i18n/*.json', async (route) => {
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' });
  });
  await page.route('**/branding/i18n/en.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STRING_OVERRIDES),
    });
  });
  await page.route('**/branding/*.svg', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: LOGO_SVG });
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

  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT);
  await page.locator('#username').fill(USER);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

const token = (page: Page, name: string) =>
  page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    `--${name}`,
  );

const sidebar = (page: Page) => page.locator('nav.sidebar');

test.describe('a fully branded deployment', () => {
  test.beforeEach(async ({ page }) => {
    await deployBrandedInstitution(page);
  });

  test('wears the institution’s name and mark, not Fineract’s', async ({ page }) => {
    const { appName, logoUrl } = EXAMPLE.branding;

    await expect(page.locator('.app-title')).toHaveText(appName);
    await expect(page.locator('img.logo')).toHaveAttribute('src', logoUrl);
    await expect(page.locator('img.logo')).toHaveAttribute('alt', `${appName} logo`);
    await expect(page).toHaveTitle(new RegExp(appName));
    await expect(page.locator("link[rel='icon']")).toHaveAttribute(
      'href',
      EXAMPLE.branding.faviconUrl,
    );
  });

  test('carries the institution’s palette into its own chrome and into Ionic', async ({ page }) => {
    const light = EXAMPLE.branding.tokens.light;

    for (const [name, value] of Object.entries(light)) {
      expect(await token(page, name), `--${name}`).toBe(value);
    }

    // The token indirection is what makes one setting recolour both layers. Before
    // _ionic-theme.scss referenced the tokens, this stayed on the shipped blue while the
    // sidebar and buttons moved.
    expect(await token(page, 'ion-color-primary')).toBe(light['primary-color']);
    // Derived, because CSS cannot compute them from a hex.
    expect(await token(page, 'ion-color-primary-rgb')).toBe('11, 95, 138');
    expect(await token(page, 'ion-color-primary-contrast')).toBe('#ffffff');
  });

  test('drops the sections the institution does not run', async ({ page }) => {
    // Hiding is presentational: these routes stay reachable by URL and authorization remains
    // server-side. What is asserted here is only what the menu offers.
    for (const id of EXAMPLE.nav.hidden) {
      expect(id, 'the example should hide something worth asserting').toBeTruthy();
    }

    await expect(sidebar(page).getByText('Working Capital', { exact: true })).toHaveCount(0);
    await expect(sidebar(page).getByText('Interop', { exact: true })).toHaveCount(0);
    await expect(sidebar(page).getByRole('link', { name: 'Surveys', exact: true })).toHaveCount(0);

    // A neighbouring section it did not hide is untouched.
    await expect(sidebar(page).getByText('Accounting', { exact: true })).toBeVisible();
  });

  test('renames and reorders entries to the institution’s vocabulary', async ({ page }) => {
    const { clients, groups } = EXAMPLE.nav.overrides;

    await expect(sidebar(page).getByRole('link', { name: clients.labelKey })).toBeVisible();
    await expect(sidebar(page).getByRole('link', { name: groups.labelKey })).toBeVisible();
    // The upstream labels are gone, not merely duplicated.
    await expect(sidebar(page).getByRole('link', { name: 'Clients', exact: true })).toHaveCount(0);

    // `clients` carries order 10 and `groups` order 11, so they lead the menu.
    const labels = await sidebar(page).locator('a.nav-item .nav-text').allInnerTexts();
    expect(labels.slice(0, 2)).toEqual([clients.labelKey, groups.labelKey]);
  });

  test('offers the institution’s own systems beside Fineract’s screens', async ({ page }) => {
    const group = EXAMPLE.nav.items[0];
    const [crm, warehouse] = group.children;

    await expect(sidebar(page).getByText(group.labelKey, { exact: true })).toBeVisible();

    for (const entry of [crm, warehouse]) {
      const link = sidebar(page).getByRole('link', { name: new RegExp(entry.labelKey) });
      await expect(link).toHaveAttribute('href', entry.url);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  test('restates the labels the institution words differently', async ({ page }) => {
    await expect(
      sidebar(page).getByRole('link', { name: STRING_OVERRIDES.nav.dashboard, exact: true }),
    ).toBeVisible();
    await expect(
      sidebar(page).getByRole('link', { name: STRING_OVERRIDES.nav.loans, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: STRING_OVERRIDES.app.logout })).toBeVisible();
  });

  test('keeps a readable palette in dark mode, with a label colour to match', async ({ page }) => {
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

    const dark = EXAMPLE.branding.tokens.dark;
    expect(await token(page, 'primary-color')).toBe(dark['primary-color']);

    // The accent is pale, so white text on it would be unreadable. Nothing rejects it: the
    // label colour is derived from the fill and comes back black. This is the case a
    // white-only contrast rule would have forbidden outright.
    expect(await token(page, 'ion-color-primary-contrast')).toBe('#000000');
  });

  test('does not leak a light colour into the dark palette', async ({ page }) => {
    // The overlay sets --secondary-color for light and says nothing about dark. That token is the
    // sidebar ground in light and a near-white *foreground* in dark, so carrying the light value
    // over would paint navy text on a near-black page. The application's dark value has to win.
    //
    // This is specificity, not preference: the branding stylesheet is appended after the
    // application's, and a plain `:root` ties with `[data-theme='dark']`, so the later rule would
    // take dark mode too.
    expect(EXAMPLE.branding.tokens.light['secondary-color']).toBeTruthy();
    expect(EXAMPLE.branding.tokens.dark['secondary-color']).toBeUndefined();

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

    expect(await token(page, 'secondary-color')).toBe('#ecf0f1');
    // A token the application does not re-theme still carries over, in both directions.
    expect(await token(page, 'border-radius')).toBe(EXAMPLE.branding.tokens.light['border-radius']);
  });

  test('reports no configuration defects for the published example', async ({ page }) => {
    // The example is what deployments copy. If the application finds anything wrong with it,
    // every one of them inherits the mistake.
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning' && message.text().includes('[branding]')) {
        warnings.push(message.text());
      }
    });

    await page.reload();
    await expect(page.locator('.app-title')).toHaveText(EXAMPLE.branding.appName);

    expect(warnings).toEqual([]);
  });
});
