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
 * The second authentication factor, driven against mocked endpoints.
 *
 * Fineract only serves `/v1/twofactor/**` when it runs with `fineract.security.2fa.enabled`, and
 * enabling that is process-wide — it cannot be turned on for one test. Mocking the four calls
 * gives the whole matrix on every pull request: the refusals, the expiry, the channel choice and,
 * most importantly, the case where the platform asks for no second factor at all.
 *
 * `two-factor-backend.spec.ts` proves the same flow against a real Fineract with a real one-time
 * token; this proves the client behaves sensibly around it.
 */

import { test, expect, Page } from './fixtures';
import { landsOn } from './utils/settled-route';

const API_BASE = '/api/v1';
const TENANT = 'default';
const USER = 'mifos';
const PASSWORD = 'password';

const CODE_FIELD = 'two-factor-code';
const SUBMIT = 'two-factor-submit';

interface MockOptions {
  /** What `/v1/authentication` reports. Omitted means no second factor is wanted. */
  twoFactorRequired?: boolean;
  /** Channels `GET /v1/twofactor` offers. */
  methods?: { name: string; target: string }[];
  /** Whether `POST /v1/twofactor` succeeds. */
  canSend?: boolean;
  /** The code `POST /v1/twofactor/validate` will accept. */
  validCode?: string;
}

async function mockPlatform(page: Page, options: MockOptions = {}): Promise<void> {
  const {
    twoFactorRequired = true,
    methods = [{ name: 'email', target: 'a***@example.org' }],
    canSend = true,
    validCode = 'NMKH4',
  } = options;

  await page.route('**/config.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fineractApiUrl: API_BASE, defaultTenant: TENANT }),
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
        permissions: ['ALL_FUNCTIONS'],
        ...(twoFactorRequired ? { isTwoFactorAuthenticationRequired: true } : {}),
      }),
    });
  });

  // Order matters: the more specific routes are registered first, because Playwright matches
  // the most recently registered handler and `**/twofactor**` would otherwise swallow them.
  await page.route('**/api/v1/twofactor/validate**', async (route) => {
    const submitted = new URL(route.request().url()).searchParams.get('token');
    if (submitted === validCode) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'tfa-token-123', validFrom: 0, validTo: 1 }),
      });
      return;
    }
    // Exactly what Fineract answers for a wrong code: a 403 that is a domain-rule violation
    // rather than an authorization failure.
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        userMessageGlobalisationCode: 'validation.msg.domain.rule.violation',
        defaultUserMessage: 'Errors contain reason for domain rule violation.',
        errors: [{ defaultUserMessage: 'The provided one time token is invalid' }],
      }),
    });
  });

  await page.route('**/api/v1/twofactor?**', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(methods),
      });
      return;
    }
    if (!canSend) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      return;
    }
    const method = new URL(route.request().url()).searchParams.get('deliveryMethod');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        requestTime: Date.now(),
        tokenLiveTimeInSec: 300,
        extendedAccessToken: false,
        deliveryMethod: methods.find((m) => m.name === method) ?? methods[0],
      }),
    });
  });

  await page.route('**/api/v1/twofactor', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(methods),
    });
  });
}

/** Fills in the password form and submits it. */
async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT);
  await page.locator('#username').fill(USER);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

test.describe('two-step verification', () => {
  test('asks for a code and lets the user in once it is accepted', async ({ page }) => {
    await mockPlatform(page);
    await signIn(page);

    // Not on the dashboard yet: the password was accepted but the platform would refuse
    // everything until the second factor is done.
    await expect(page.getByTestId(CODE_FIELD)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await page.getByTestId(CODE_FIELD).fill('NMKH4');
    await page.getByTestId(SUBMIT).click();

    await expect(page).toHaveURL('/dashboard');
  });

  test('sends the token on every later request', async ({ page }) => {
    await mockPlatform(page);
    await signIn(page);
    await page.getByTestId(CODE_FIELD).fill('NMKH4');

    const nextRequest = page.waitForRequest(
      (request) => request.url().includes('/api/v1/') && !request.url().includes('/twofactor'),
    );
    await page.getByTestId(SUBMIT).click();

    // Without this header Fineract answers 403 to everything, so its absence would be the whole
    // bug reappearing.
    expect((await nextRequest).headers()['fineract-platform-tfa-token']).toBe('tfa-token-123');
  });

  test('keeps the user on the step when the code is wrong, and says why', async ({ page }) => {
    await mockPlatform(page);
    await signIn(page);

    await page.getByTestId(CODE_FIELD).fill('WRONG');
    await page.getByTestId(SUBMIT).click();

    await expect(page.getByRole('alert')).toContainText('The provided one time token is invalid');
    await expect(page.getByTestId(CODE_FIELD)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('accepts a correct code after a wrong one', async ({ page }) => {
    await mockPlatform(page);
    await signIn(page);

    await page.getByTestId(CODE_FIELD).fill('WRONG');
    await page.getByTestId(SUBMIT).click();
    await expect(page.getByRole('alert')).toBeVisible();

    await page.getByTestId(CODE_FIELD).fill('NMKH4');
    await page.getByTestId(SUBMIT).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('offers the choice when there is more than one channel', async ({ page }) => {
    await mockPlatform(page, {
      methods: [
        { name: 'email', target: 'a***@example.org' },
        { name: 'sms', target: '+44 *** 1234' },
      ],
    });
    await signIn(page);

    await expect(page.getByTestId('two-factor-method-email')).toBeVisible();
    await expect(page.getByTestId('two-factor-method-sms')).toBeVisible();
    await expect(page.getByTestId(CODE_FIELD)).toHaveCount(0);

    await page.getByTestId('two-factor-method-sms').click();
    await expect(page.getByTestId(CODE_FIELD)).toBeVisible();
  });

  test('says so when the account has no channel configured', async ({ page }) => {
    // There is no way to finish signing in; an empty list would leave the user guessing.
    await mockPlatform(page, { methods: [] });
    await signIn(page);

    await expect(page.getByText(/no delivery method/i)).toBeVisible();
    await expect(page.getByTestId(CODE_FIELD)).toHaveCount(0);
  });

  test('returns to the choice when the code could not be sent', async ({ page }) => {
    await mockPlatform(page, {
      methods: [
        { name: 'email', target: 'a***@example.org' },
        { name: 'sms', target: '+44 *** 1234' },
      ],
      canSend: false,
    });
    await signIn(page);

    await page.getByTestId('two-factor-method-email').click();
    await expect(page.getByRole('alert')).toBeVisible();
    // Another channel can still be tried, rather than being stranded on a form for a code that
    // was never sent.
    await expect(page.getByTestId('two-factor-method-sms')).toBeVisible();
  });

  test('does not let a half-finished session reach the application', async ({ page }) => {
    await mockPlatform(page);
    await signIn(page);
    await expect(page.getByTestId(CODE_FIELD)).toBeVisible();

    // Typing a URL is exactly how someone would try to skip this.
    expect(await landsOn(page, '/clients')).toBe('/login');
  });

  test('backing out returns to the password form', async ({ page }) => {
    await mockPlatform(page);
    await signIn(page);
    await expect(page.getByTestId(CODE_FIELD)).toBeVisible();

    await page.getByTestId('two-factor-cancel').click();

    await expect(page.locator('#username')).toBeVisible();
    await expect(page.getByTestId(CODE_FIELD)).toHaveCount(0);
  });

  test('a deployment without a second factor signs in exactly as before', async ({ page }) => {
    // The regression that protects every existing installation.
    await mockPlatform(page, { twoFactorRequired: false });
    await signIn(page);

    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByTestId(CODE_FIELD)).toHaveCount(0);
  });
});
