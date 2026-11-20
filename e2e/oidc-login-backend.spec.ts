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
 * The identity-provider route on the login page, in front of a real Fineract.
 *
 * The one thing this alters is the deployment's own `config.json`, which gets `oidcLoginEnabled`
 * and an `oidc` block added to whatever it already says. That is what a deployment does by hand —
 * the settings are not read from Fineract — so it is the honest way to switch the route on.
 * Everything after it is real: the credentials, the platform's answer and the session that results.
 *
 * `oidc-login.spec.ts` covers the matrix and the provider round trip against mocks. This covers
 * what mocks cannot: that offering the route leaves a real sign-in working, and that pressing it
 * with a provider that cannot be reached does not reach Fineract at all.
 */

import { test, expect, Page } from './fixtures';
import { assertLocalBackend } from './utils/backend-env';
import { SERVER_URL, TENANT_ID, USERNAME, PASSWORD } from './utils/fineract-login';

const SSO_BUTTON = 'login-sso-button';
const ISSUER = 'https://idp.example.test/realms/bank';

/**
 * Signs in through the password form, which the route sits above.
 *
 * Not the shared `login()` helper: that one finds the button by the name `Sign In`, which the
 * identity-provider button ("Sign in with your identity provider") also matches, so with the route
 * offered it would find two. Matching exactly is the whole difference; the guard against a
 * non-local backend is kept.
 */
async function signInWithPassword(page: Page): Promise<void> {
  assertLocalBackend();

  const serverSelect = page.locator('#serverUrl');
  await serverSelect.waitFor({ state: 'visible' });
  const preset = await serverSelect.locator(`option[value="${SERVER_URL}"]`).count();
  if (preset > 0) {
    await serverSelect.selectOption(SERVER_URL);
  } else {
    await serverSelect.selectOption('custom');
    await page.locator('#customUrl').fill(SERVER_URL);
  }
  await page.locator('#tenantId').fill(TENANT_ID);
  await page.locator('#username').fill(USERNAME);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();

  // The sidebar only renders for a session the platform has accepted. Checked by id rather than
  // role, as the shared helper does: its role differs between a wide and a narrow viewport.
  await expect(page.locator('#app-navigation')).toBeVisible({ timeout: 30_000 });
}

/** Serves the deployment's real `config.json`, with the identity-provider route switched on. */
async function offerIdentityProviderRoute(page: Page): Promise<void> {
  await page.route('**/config.json*', async (route) => {
    const response = await route.fetch();
    const config = (await response.json()) as Record<string, unknown>;
    await route.fulfill({
      response,
      json: {
        ...config,
        oidcLoginEnabled: true,
        oidc: { issuer: ISSUER, clientId: 'backoffice-ui' },
      },
    });
  });
}

test.describe('identity-provider route against a real Fineract', () => {
  test.beforeEach(async ({ page }) => {
    await offerIdentityProviderRoute(page);
  });

  test('is offered beside the password form, and an unreachable provider sends nothing to Fineract', async ({
    page,
  }) => {
    await page.route(`${ISSUER}/**`, (route) => route.abort());
    const authenticationRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/authentication')) {
        authenticationRequests.push(request.url());
      }
    });

    await page.goto('/login');
    await expect(page.getByTestId(SSO_BUTTON)).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();

    await page.getByTestId(SSO_BUTTON).click();

    await expect(page.getByTestId('login-sso-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect(authenticationRequests).toEqual([]);
  });

  test('a real password sign-in still gets a session with the route offered', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId(SSO_BUTTON)).toBeVisible();

    // Fills in the same form the route sits above, and waits for the real platform to let the
    // session in.
    await signInWithPassword(page);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId(SSO_BUTTON)).toHaveCount(0);
  });
});
