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
 * Signing in through an identity provider, driven against mocked endpoints.
 *
 * The button is switched on by `oidcLoginEnabled` plus a complete `oidc` block in `config.json`.
 * This pins both halves. First, everything around the feature: a deployment that never set the
 * keys sees exactly the screen it always saw, and username and password stay a way in unless the
 * deployment turns the form off, which only takes effect with a working OIDC configuration.
 * Second, the round trip: discovery, the redirect with PKCE, the code exchange, and the session
 * built from `GET /v1/userdetails`, including the answer that must never open a session, the 404
 * Fineract gives when it does not load that endpoint for OIDC federation.
 *
 * `oidc-login-backend.spec.ts` proves the password half against a real Fineract; this covers the
 * matrix a real one cannot vary per test, above all the configurations that must show nothing.
 */

import { test, expect, Page } from './fixtures';

const API_BASE = '/api/v1';
const TENANT = 'default';
const USER = 'mifos';
const PASSWORD = 'password';

const SSO_BUTTON = 'login-sso-button';

const ISSUER = 'https://idp.example.test/realms/bank';
const CLIENT_ID = 'backoffice-ui';
const AUTHORIZE = `${ISSUER}/protocol/openid-connect/auth`;
const TOKEN = `${ISSUER}/protocol/openid-connect/token`;
const OIDC_CONFIG = { issuer: ISSUER, clientId: CLIENT_ID };

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

interface MockOptions {
  /**
   * What `config.json` says for `oidcLoginEnabled`. Left out entirely, the key is absent, which is
   * every `config.json` that predates the flag.
   */
  oidcLoginEnabled?: unknown;
  /** What `config.json` says for `oidc`. Defaults to a complete block when the flag is given. */
  oidc?: unknown;
  /** What `config.json` says for `passwordLoginEnabled`. */
  passwordLoginEnabled?: unknown;
  /** Whether `/v1/authentication` asks for a second factor after the password. */
  twoFactorRequired?: boolean;
  /** The status `/v1/userdetails` answers with. Defaults to 200 and a user. */
  userDetailsStatus?: number;
}

interface Mocked {
  /** Every request the page made to the authentication endpoint. */
  authenticationRequests: string[];
  /** The query of the request that reached the provider's authorization endpoint, if any. */
  authorizeQuery: () => URLSearchParams | null;
  /** The `Authorization` header of each `/v1/userdetails` request. */
  userDetailsAuthorization: string[];
}

function base64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function mockPlatform(page: Page, options: MockOptions = {}): Promise<Mocked> {
  const authenticationRequests: string[] = [];
  const userDetailsAuthorization: string[] = [];
  let authorizeQuery: URLSearchParams | null = null;

  const config: Record<string, unknown> = { fineractApiUrl: API_BASE, defaultTenant: TENANT };
  if ('oidcLoginEnabled' in options) {
    config['oidcLoginEnabled'] = options.oidcLoginEnabled;
    config['oidc'] = 'oidc' in options ? options.oidc : OIDC_CONFIG;
  }
  if ('passwordLoginEnabled' in options) {
    config['passwordLoginEnabled'] = options.passwordLoginEnabled;
  }

  await page.route('**/config.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(config),
    });
  });

  await page.route('**/api/v1/authentication**', async (route) => {
    authenticationRequests.push(route.request().url());
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
        permissions: ['ALL_FUNCTIONS'],
        ...(options.twoFactorRequired ? { isTwoFactorAuthenticationRequired: true } : {}),
      }),
    });
  });

  // Only reached when a second factor is required: one channel, so the code field is what the
  // person is left looking at.
  await page.route('**/api/v1/twofactor**', async (route) => {
    const body =
      route.request().method() === 'POST'
        ? {
            requestTime: Date.now(),
            tokenLiveTimeInSec: 300,
            extendedAccessToken: false,
            deliveryMethod: { name: 'email', target: 'a***@example.org' },
          }
        : [{ name: 'email', target: 'a***@example.org' }];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  // The identity provider. Discovery names the endpoints, all on the issuer's origin.
  await page.route(`${ISSUER}/.well-known/openid-configuration`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify({
        issuer: ISSUER,
        authorization_endpoint: AUTHORIZE,
        token_endpoint: TOKEN,
        end_session_endpoint: `${ISSUER}/protocol/openid-connect/logout`,
      }),
    });
  });

  // The provider "signs the person in" at once and sends the browser back with a code and the
  // state it was given.
  await page.route(`${AUTHORIZE}**`, async (route) => {
    authorizeQuery = new URL(route.request().url()).searchParams;
    const redirect = new URL(authorizeQuery.get('redirect_uri') ?? '');
    redirect.searchParams.set('code', 'the-code');
    redirect.searchParams.set('state', authorizeQuery.get('state') ?? '');
    await route.fulfill({ status: 302, headers: { location: redirect.toString() } });
  });

  await page.route(TOKEN, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const nonce = authorizeQuery?.get('nonce');
    const now = Math.floor(Date.now() / 1000);
    const idToken = [
      base64Url({ alg: 'none' }),
      base64Url({ iss: ISSUER, aud: CLIENT_ID, nonce, iat: now, exp: now + 300 }),
      'signature',
    ].join('.');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify({
        access_token: 'the-access-token',
        refresh_token: 'the-refresh-token',
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 300,
        refresh_expires_in: 1800,
      }),
    });
  });

  await page.route('**/api/v1/userdetails**', async (route) => {
    userDetailsAuthorization.push((await route.request().headerValue('authorization')) ?? '');
    const status = options.userDetailsStatus ?? 200;
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(
        status === 200
          ? {
              username: USER,
              userId: 1,
              officeId: 1,
              officeName: 'Head Office',
              authenticated: true,
              roles: [{ id: 1, name: 'Super user', description: 'all', disabled: false }],
              permissions: ['ALL_FUNCTIONS'],
            }
          : { developerMessage: 'No static resource', httpStatusCode: String(status) },
      ),
    });
  });

  return { authenticationRequests, authorizeQuery: () => authorizeQuery, userDetailsAuthorization };
}

/**
 * The password form's own button. `exact` matters here: the identity-provider button is called
 * "Sign in with your identity provider", which a plain `Sign In` name matches too.
 */
function passwordSignInButton(page: Page) {
  return page.getByRole('button', { name: 'Sign In', exact: true });
}

/** Fills in the password form and submits it. */
async function signIn(page: Page): Promise<void> {
  await page.locator('#tenantId').fill(TENANT);
  await page.locator('#username').fill(USER);
  await page.locator('#password').fill(PASSWORD);
  await passwordSignInButton(page).click();
}

test.describe('identity-provider route on the login page', () => {
  test('a deployment that never set the flag sees the screen it always saw', async ({ page }) => {
    // The regression that protects every existing installation: their config.json has no such key.
    await mockPlatform(page);
    await page.goto('/login');

    await expect(page.locator('#username')).toBeVisible();
    await expect(page.getByTestId(SSO_BUTTON)).toHaveCount(0);
  });

  // The flag is read strictly. A hand-edited config.json is exactly where "true" ends up quoted,
  // and a button that appears for a value nobody meant as on would be worse than one that does not.
  for (const value of [false, 'true', 1]) {
    test(`does not offer the route when the flag is ${JSON.stringify(value)}`, async ({ page }) => {
      await mockPlatform(page, { oidcLoginEnabled: value });
      await page.goto('/login');

      await expect(page.locator('#username')).toBeVisible();
      await expect(page.getByTestId(SSO_BUTTON)).toHaveCount(0);
    });
  }

  test('does not offer the route when the oidc block is missing, and keeps the form', async ({
    page,
  }) => {
    await mockPlatform(page, {
      oidcLoginEnabled: true,
      oidc: undefined,
      passwordLoginEnabled: false,
    });
    await page.goto('/login');

    // passwordLoginEnabled: false must not lock everyone out when there is no way to sign in
    // through the provider.
    await expect(page.getByTestId(SSO_BUTTON)).toHaveCount(0);
    await expect(page.locator('#username')).toBeVisible();
  });

  test('offers the route above the password form, which stays in place', async ({ page }) => {
    await mockPlatform(page, { oidcLoginEnabled: true });
    await page.goto('/login');

    const button = page.getByTestId(SSO_BUTTON);
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Sign in with your identity provider');

    // Beside the form rather than instead of it.
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(passwordSignInButton(page)).toBeVisible();

    const buttonBox = await button.boundingBox();
    const usernameBox = await page.locator('#username').boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(usernameBox).not.toBeNull();
    expect(buttonBox!.y).toBeLessThan(usernameBox!.y);
  });

  test('removes the password form only when the deployment asks and OIDC is configured', async ({
    page,
  }) => {
    await mockPlatform(page, { oidcLoginEnabled: true, passwordLoginEnabled: false });
    await page.goto('/login');

    await expect(page.getByTestId(SSO_BUTTON)).toBeVisible();
    await expect(page.locator('#username')).toHaveCount(0);
    await expect(page.locator('#password')).toHaveCount(0);
  });

  test('username and password still sign in when the route is offered', async ({ page }) => {
    await mockPlatform(page, { oidcLoginEnabled: true });
    await page.goto('/login');

    await signIn(page);

    await expect(page).toHaveURL('/dashboard');
  });

  test('is not offered while a second factor is being asked for', async ({ page }) => {
    await mockPlatform(page, { oidcLoginEnabled: true, twoFactorRequired: true });
    await page.goto('/login');
    await expect(page.getByTestId(SSO_BUTTON)).toBeVisible();

    await signIn(page);

    // The password was accepted, so this is the second step of that sign-in. A route to a
    // different sign-in here would abandon a half-finished one.
    await expect(page.getByTestId('two-factor-code')).toBeVisible();
    await expect(page.getByTestId(SSO_BUTTON)).toHaveCount(0);
  });
});

test.describe('signing in through the identity provider', () => {
  test('sends the browser to the provider with PKCE S256, then opens a session from userdetails', async ({
    page,
  }) => {
    const mocked = await mockPlatform(page, { oidcLoginEnabled: true });
    await page.goto('/login');

    await page.getByTestId(SSO_BUTTON).click();

    await expect(page).toHaveURL('/dashboard');

    const query = mocked.authorizeQuery();
    expect(query).not.toBeNull();
    expect(query!.get('client_id')).toBe(CLIENT_ID);
    expect(query!.get('response_type')).toBe('code');
    expect(query!.get('code_challenge_method')).toBe('S256');
    expect(query!.get('code_challenge')).toBeTruthy();
    expect(query!.get('redirect_uri')).toMatch(/\/auth\/callback$/);
    expect(query!.get('scope')).toBe('openid profile');
    expect(query!.get('scope')).not.toContain('offline_access');

    // The user context is the Bearer-authenticated userdetails answer; the password endpoint is
    // never involved.
    expect(mocked.userDetailsAuthorization).toEqual(['Bearer the-access-token']);
    expect(mocked.authenticationRequests).toEqual([]);
  });

  test('does not open a session when the server does not serve userdetails (404)', async ({
    page,
  }) => {
    const mocked = await mockPlatform(page, { oidcLoginEnabled: true, userDetailsStatus: 404 });
    await page.goto('/login');

    await page.getByTestId(SSO_BUTTON).click();

    // A clear message and a way back, not a half-signed-in application.
    const error = page.getByTestId('oidc-callback-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('cannot identify users who sign in through an identity');
    await expect(page).toHaveURL(/\/auth\/callback/);
    expect(mocked.userDetailsAuthorization).toEqual(['Bearer the-access-token']);

    await page.getByTestId('oidc-callback-back').click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId(SSO_BUTTON)).toBeVisible();
  });

  test('does not open a session when the callback state does not match', async ({ page }) => {
    await mockPlatform(page, { oidcLoginEnabled: true });
    await page.goto('/auth/callback?code=stolen&state=not-the-one-we-sent');

    await expect(page.getByTestId('oidc-callback-error')).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});
