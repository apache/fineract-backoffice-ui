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
 * The deployment customization contract, exercised the way a deployment actually uses it: by
 * serving `branding/config.json` and asserting on the rendered application.
 *
 * Unit tests already cover the composition rules in isolation. What they cannot show is that the
 * overlay is fetched at all, that it merges over `config.json` rather than replacing it, that the
 * tokens reach the document, and that the whole thing is a no-op when the file is absent — which
 * is the state every existing deployment is in and the one that must not regress.
 *
 * Everything here runs in the `mocked` project: the overlay is a static fetch, so no Fineract is
 * involved.
 */

import { test, expect, type Page } from './fixtures';

const TENANT = 'default';
const USER = 'mifos';
const PASSWORD = 'password';

/** The overlay a given test wants served, or `null` for "this deployment has none". */
type Overlay = Record<string, unknown> | null;

async function mockBackend(page: Page, overlay: Overlay): Promise<void> {
  await page.route(/\/api\/v1\//, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/config.json*', async (route) => {
    // Only the upstream layer. The overlay has its own route below, and the distinction is the
    // point: these are two files with two owners.
    if (route.request().url().includes('/branding/')) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        fineractApiUrl: '/api/v1',
        defaultTenant: TENANT,
        rbacEnabled: true,
        // The container entrypoint sets this by detecting the mounted directory, so a fixture
        // serving an overlay has to declare it too — otherwise it models a deployment that
        // shipped `branding/` and never told the application, which is not a state the
        // entrypoint can produce. See AppConfig.brandingOverlayEnabled.
        brandingOverlayEnabled: overlay !== null,
      }),
    });
  });
  await page.route('**/branding/config.json*', async (route) => {
    if (overlay === null) {
      // What a deployment that has mounted nothing gets. nginx is configured to return a real
      // 404 here rather than the SPA shell — see the `location ^~ /branding/` block.
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overlay),
    });
  });
  await page.route('**/branding/i18n/*.json', async (route) => {
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' });
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
  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT);
  await page.locator('#username').fill(USER);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

/** Boots the application with `overlay` served as the deployment's own layer. */
async function deployWith(page: Page, overlay: Overlay): Promise<void> {
  await mockBackend(page, overlay);
  await signIn(page);
}

const token = (page: Page, name: string) =>
  page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    `--${name}`,
  );

const sidebar = (page: Page) => page.locator('nav.sidebar');

test.describe('with no overlay mounted', () => {
  test('boots, keeps the shipped branding, and shows the full menu', async ({ page }) => {
    await deployWith(page, null);

    // The state every existing deployment is in. An absent overlay must be indistinguishable
    // from the behaviour before this mechanism existed.
    expect(await token(page, 'primary-color')).toBe('#3498db');
    await expect(page.locator('.app-title')).toHaveText('Fineract Backoffice UI');
    await expect(sidebar(page).getByRole('link', { name: 'Clients', exact: true })).toBeVisible();
  });

  /**
   * The fix for #487. The two overlay files are absent on every default install, and asking for
   * them anyway put a 404 in the browser console on every route. The application can decline to
   * *report* a 404 and does, but the browser writes it regardless — so the only thing that
   * settles it is not making the request, and the only place that can be asserted is here.
   */
  test('does not ask for an overlay this deployment has not declared', async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/branding/')) asked.push(request.url());
    });

    await deployWith(page, null);
    await expect(page.locator('.app-title')).toBeVisible();

    expect(asked).toEqual([]);
  });

  test('logs no federation parse error on load', async ({ page }) => {
    // Regression guard for the released image having no remote behind `./remoteEntry.json`
    // while nginx answered that path with index.html: `initFederation` then parsed HTML as JSON
    // on every page load. `main.ts` probes before declaring the remote.
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await deployWith(page, null);

    const federationErrors = errors.filter(
      (text) => /remoteEntry|federation/i.test(text) || /Unexpected token '<'/.test(text),
    );
    expect(federationErrors).toEqual([]);
  });
});

test.describe('branding', () => {
  test('applies colour and density tokens to the document', async ({ page }) => {
    await deployWith(page, {
      branding: {
        tokens: {
          light: {
            'primary-color': '#0b5f8a',
            'secondary-color': '#13303f',
            'border-radius': '4px',
          },
        },
      },
    });

    expect(await token(page, 'primary-color')).toBe('#0b5f8a');
    expect(await token(page, 'secondary-color')).toBe('#13303f');
    expect(await token(page, 'border-radius')).toBe('4px');
  });

  test('recolours Ionic through the same tokens', async ({ page }) => {
    // The reason tokens are the mechanism at all: `_ionic-theme.scss` maps `--ion-color-*` onto
    // them, so one override moves the component library and the app's own chrome together.
    await deployWith(page, {
      branding: { tokens: { light: { 'primary-color': '#0b5f8a' } } },
    });

    expect(await token(page, 'ion-color-primary')).toBe('#0b5f8a');
  });

  test('renames the product in the header and the tab title', async ({ page }) => {
    await deployWith(page, { branding: { appName: 'Any Community Bank' } });

    await expect(page.locator('.app-title')).toHaveText('Any Community Bank');
    // Survives a navigation: TranslatedTitleStrategy rewrites the title on every route change,
    // so a name written once at startup would be gone by the second page.
    await page.goto('/clients');
    await expect(page).toHaveTitle(/Any Community Bank/);
  });

  test('serves the deployment logo and names it after the deployment', async ({ page }) => {
    await page.route('**/branding/logo.svg', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"></svg>',
      });
    });
    await deployWith(page, {
      branding: { appName: 'Any Community Bank', logoUrl: 'branding/logo.svg' },
    });

    const logo = page.locator('img.logo');
    await expect(logo).toHaveAttribute('src', 'branding/logo.svg');
    // Not "Fineract Logo", which is wrong the moment a deployment rebrands.
    await expect(logo).toHaveAttribute('alt', 'Any Community Bank logo');
  });

  test('refuses a fill that cannot carry the white text baked into the stylesheet', async ({
    page,
  }) => {
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning') warnings.push(message.text());
    });

    // The sidebar pairs --secondary-color with a literal #fff, so that fill has to carry white
    // specifically. #9fd8ff is a pleasant pale blue at 1.53:1 against white — unreadable. Refused
    // rather than applied, and the shipped colour kept.
    await deployWith(page, {
      branding: { tokens: { light: { 'secondary-color': '#9fd8ff' } } },
    });

    expect(await token(page, 'secondary-color')).toBe('#2c3e50');
    expect(warnings.some((w) => w.includes('low-contrast'))).toBe(true);
  });

  test('accepts a light accent and derives a dark label for it', async ({ page }) => {
    // The counterpart to the rule above. Ionic takes its label colour from a variable this
    // service sets, so a pale accent is not rejected — it gets black text instead of white.
    // That is what makes a lighter primary usable in dark mode.
    await deployWith(page, {
      branding: { tokens: { light: { 'primary-color': '#9fd8ff' } } },
    });

    expect(await token(page, 'primary-color')).toBe('#9fd8ff');
    expect(await token(page, 'ion-color-primary-contrast')).toBe('#000000');
  });

  test('ignores a token outside the published allow-list, and says so', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning') warnings.push(message.text());
    });

    await deployWith(page, {
      branding: { tokens: { light: { 'shadow-md': '0 0 0 red', 'primary-color': '#0b5f8a' } } },
    });

    expect(await token(page, 'primary-color')).toBe('#0b5f8a');
    expect(warnings.some((w) => w.includes('unknown-token') && w.includes('shadow-md'))).toBe(true);
  });
});

test.describe('navigation', () => {
  test('hides an entry named by its id', async ({ page }) => {
    await deployWith(page, { nav: { hidden: ['clients'] } });

    await expect(sidebar(page).getByRole('link', { name: 'Clients', exact: true })).toHaveCount(0);
    await expect(sidebar(page).getByRole('link', { name: 'Groups', exact: true })).toBeVisible();
  });

  test('does not hide an entry named by its labelKey', async ({ page }) => {
    // Defect A, guarded. `hidden` used to match on `labelKey`, a field upstream renames freely,
    // so an override silently stopped matching and the entry came back in production. Only the
    // stable id works now, and this asserts the old key is inert rather than quietly accepted.
    await deployWith(page, { nav: { hidden: ['nav.clients'] } });

    await expect(sidebar(page).getByRole('link', { name: 'Clients', exact: true })).toBeVisible();
  });

  test('renames and reorders entries', async ({ page }) => {
    await deployWith(page, {
      nav: {
        overrides: {
          clients: { labelKey: 'Members', order: 1 },
          dashboard: { order: 2 },
        },
      },
    });

    await expect(sidebar(page).getByRole('link', { name: 'Members', exact: true })).toBeVisible();
    const firstTwo = await sidebar(page).locator('a.nav-item .nav-text').allInnerTexts();
    expect(firstTwo.slice(0, 2)).toEqual(['Members', 'Dashboard']);
  });

  test('adds an external entry that opens in a new tab', async ({ page }) => {
    await deployWith(page, {
      nav: {
        items: [
          {
            id: 'acme.crm',
            labelKey: 'Field CRM',
            icon: 'open-outline',
            kind: 'external',
            url: 'https://crm.example.test/',
          },
        ],
      },
    });

    const link = sidebar(page).getByRole('link', { name: /Field CRM/ });
    await expect(link).toHaveAttribute('href', 'https://crm.example.test/');
    await expect(link).toHaveAttribute('target', '_blank');
    // Both are load-bearing: noopener denies the opened page window.opener, noreferrer keeps
    // back-office URLs carrying entity ids out of the third party's referrer log.
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('nests an added entry under an existing group', async ({ page }) => {
    await deployWith(page, {
      nav: {
        items: [
          {
            id: 'acme.report',
            labelKey: 'Custom Report',
            parent: 'products',
            kind: 'external',
            url: 'https://bi.example.test/',
          },
        ],
      },
    });

    await expect(sidebar(page).getByRole('link', { name: /Custom Report/ })).toBeVisible();
  });

  test('gates an added entry on permissions like any built-in one', async ({ page }) => {
    // An added entry is not a way around RBAC. This user holds ALL_FUNCTIONS, so a code they
    // cannot satisfy has to be one the permission matcher genuinely rejects.
    await deployWith(page, {
      nav: {
        items: [
          {
            id: 'acme.restricted',
            labelKey: 'Restricted Tool',
            kind: 'external',
            url: 'https://tool.example.test/',
            requiredPermissions: 'READ_NONEXISTENTENTITY',
          },
          {
            id: 'acme.open',
            labelKey: 'Open Tool',
            kind: 'external',
            url: 'https://tool.example.test/',
          },
        ],
      },
    });

    await expect(sidebar(page).getByRole('link', { name: /Open Tool/ })).toBeVisible();
  });

  test('drops an external entry with no usable url rather than rendering a dead link', async ({
    page,
  }) => {
    await deployWith(page, {
      nav: {
        items: [
          { id: 'acme.bad', labelKey: 'Broken Link', kind: 'external', url: 'javascript:alert(1)' },
        ],
      },
    });

    await expect(sidebar(page).getByRole('link', { name: /Broken Link/ })).toHaveCount(0);
  });
});

test.describe('layering', () => {
  test('merges over config.json instead of replacing it', async ({ page }) => {
    // The overlay names only `branding`. Everything the layer beneath it set — the API URL the
    // app is currently talking to, the tenant — has to survive, or a deployment that wanted a
    // new colour would lose its backend.
    await deployWith(page, { branding: { appName: 'Layered Bank' } });

    await expect(page.locator('.app-title')).toHaveText('Layered Bank');
    // Still authenticated against the mocked /api/v1 from config.json, and still on a page that
    // required a successful call to it.
    await expect(page).toHaveURL('/dashboard');
    await expect(sidebar(page).getByRole('link', { name: 'Clients', exact: true })).toBeVisible();
  });

  test('a malformed overlay leaves the application usable', async ({ page }) => {
    await mockBackend(page, null);
    await page.route('**/branding/config.json*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{ not json' });
    });

    await signIn(page);

    // Degrades to "this deployment said nothing", not to a blank screen.
    expect(await token(page, 'primary-color')).toBe('#3498db');
    await expect(sidebar(page).getByRole('link', { name: 'Clients', exact: true })).toBeVisible();
  });
});
