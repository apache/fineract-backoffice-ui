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
 * Changing your own password from `/profile` (#492).
 *
 * The issue's evidence was a DOM query: the screen held zero buttons, inputs or links, so a
 * signed-in user had no way to rotate their own credential and had to ask an administrator —
 * who then necessarily knew it. The first case here runs that same query and expects it to
 * find something.
 *
 * Mocked rather than driven against a real Fineract, deliberately: a successful change against
 * the shared stack would rotate the credential every other backend spec signs in with, and the
 * run would fail from that point on. What is left to mock is thin — the platform's part is one
 * `POST /users/{id}/pwd`, and this asserts on the body of it.
 *
 * The tenant is given the **strong** policy, because its rules are where this screen earns its
 * keep: the platform refuses a non-conforming password with every rule listed and none of them
 * named, and the clause that catches people out — no character may repeat consecutively — is
 * invisible in that refusal unless you read `args`.
 */

import { expect, test, type Page } from './fixtures';

const USER = {
  id: 1,
  username: 'mifos',
  firstname: 'App',
  lastname: 'Administrator',
  email: 'admin@example.invalid',
  officeId: 1,
  officeName: 'Head Office',
  selectedRoles: [{ id: 1, name: 'Super user' }],
};

/** `GET /passwordpreferences`, with the strong policy active. */
const PASSWORD_PREFERENCES = [
  {
    id: 1,
    description: 'Password most contain 6 to 50 characters',
    key: 'simple',
    active: false,
  },
  {
    id: 2,
    description:
      'Password must be at least 12 characters, with an upper case, a lower case, a digit and a special character, and no character repeated consecutively',
    key: 'strong',
    active: true,
  },
];

async function signIn(page: Page): Promise<void> {
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
    route.fulfill({ json: { name: 'enable-business-date', enabled: true } }),
  );
  await page.route('**/api/v1/businessdate**', (route) =>
    route.fulfill({ json: [{ type: 'BUSINESS_DATE', date: [2026, 10, 15] }] }),
  );
  await page.route(/\/api\/v1\/(?:clients|loans|savingsaccounts)(?:\?|$)/, (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } })
      : route.fallback(),
  );
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

test.describe('Profile: change your own password', () => {
  /** Bodies of every password change that reached the platform. */
  let changes: { url: string; body: Record<string, unknown> }[];

  test.beforeEach(async ({ page }) => {
    changes = [];
    await signIn(page);

    // One handler for the whole `/users` prefix: a glob for `/users/1` matches `/users/1/pwd`
    // too, and two handlers racing over the same URL is a worse thing to debug than a branch.
    await page.route('**/api/v1/users/**', (route) => {
      const request = route.request();
      if (request.method() === 'POST' && request.url().includes('/pwd')) {
        changes.push({
          url: request.url(),
          body: request.postDataJSON() as Record<string, unknown>,
        });
        return route.fulfill({ json: { resourceId: 1 } });
      }
      return route.fulfill({ json: USER });
    });
    await page.route('**/api/v1/passwordpreferences**', (route) =>
      route.fulfill({ json: PASSWORD_PREFERENCES }),
    );

    await page.goto('/profile');
    await expect(page.getByText('admin@example.invalid')).toBeVisible();
  });

  /** The inner native input: ion-input re-emits its events, and the host has no value to fill. */
  const newPassword = (page: Page) => page.getByTestId('profile-new-password').locator('input');
  const repeatPassword = (page: Page) =>
    page.getByTestId('profile-repeat-password').locator('input');

  /**
   * Read through `aria-disabled` rather than `toBeDisabled()`.
   *
   * `ion-button` carries both `disabled` and `aria-disabled="true"`, but it declares no role, so
   * Playwright computes it as generic and honours neither — `toBeDisabled()` reports a visibly
   * disabled button as enabled. The rest of this suite reads the attribute for the same reason.
   */
  const submit = (page: Page) => page.getByTestId('profile-password-submit');

  async function openForm(page: Page): Promise<void> {
    await page.getByTestId('profile-change-password').click();
    await expect(page.getByTestId('profile-new-password')).toBeVisible();
  }

  /**
   * The issue's own evidence, re-run. It counted the interactive elements on this screen and
   * found none, which is what made an administrator the only route to a password change.
   */
  test('offers an action at all, which it did not', async ({ page }) => {
    const interactive = await page.evaluate(
      () =>
        document.querySelectorAll(
          'main button, main a, main ion-button, main input, main ion-input, main select, main [role="button"]',
        ).length,
    );
    expect(interactive).toBeGreaterThan(0);
    await expect(page.getByTestId('profile-change-password')).toBeVisible();
  });

  test('shows the tenant policy once the form is open', async ({ page }) => {
    await openForm(page);
    await expect(page.getByTestId('profile-password-policy')).toContainText('12 characters');
  });

  /**
   * Named before anything is sent. The platform's own refusal lists every rule and names none
   * of them, and it used to carry the submitted password back in clear text (#752).
   */
  test('names the rule a password still fails, and will not submit it', async ({ page }) => {
    await openForm(page);
    // Twelve characters, upper, lower, digit, special — and `ss`, which the strong policy
    // refuses and nothing on the platform's side would have told the user about.
    await newPassword(page).fill('Passsword1!x');
    await repeatPassword(page).fill('Passsword1!x');

    await expect(page.getByTestId('profile-password-rule-noRepeat')).toBeVisible();
    // Only the rule it fails. A list that showed every rule whatever was typed would be the
    // platform's own refusal again, which is the thing this screen exists to improve on.
    await expect(page.getByTestId('profile-password-rule-length')).toHaveCount(0);
    await expect(page.getByTestId('profile-password-rule-digit')).toHaveCount(0);
    await expect(submit(page)).toHaveAttribute('aria-disabled', 'true');

    // Clicked anyway, through the disabled state, so the assertion is that nothing was sent
    // rather than that the button looked unavailable.
    await submit(page).click({ force: true });
    expect(changes).toEqual([]);
  });

  test('refuses a confirmation that does not match', async ({ page }) => {
    await openForm(page);
    await newPassword(page).fill('Xq7!tveRm2zd');
    await repeatPassword(page).fill('Xq7!tveRm2zf');

    await expect(page.getByTestId('profile-password-mismatch')).toBeVisible();
    await expect(submit(page)).toHaveAttribute('aria-disabled', 'true');
  });

  test('posts the new password for the signed-in user and closes the form', async ({ page }) => {
    await openForm(page);
    await newPassword(page).fill('Xq7!tveRm2zd');
    await repeatPassword(page).fill('Xq7!tveRm2zd');

    await expect(submit(page)).not.toHaveAttribute('aria-disabled', 'true');
    await submit(page).click();

    await expect.poll(() => changes.length).toBe(1);
    // The session's own user id, from the authentication response — not a value the form asks
    // for, which is the whole point of this being self-service.
    expect(changes[0].url).toContain('/users/1/pwd');
    expect(changes[0].body).toEqual({
      password: 'Xq7!tveRm2zd',
      repeatPassword: 'Xq7!tveRm2zd',
    });

    // Closed again, so the typed credential is not left on screen.
    await expect(page.getByTestId('profile-new-password')).toHaveCount(0);
  });

  test('discards what was typed when the form is cancelled', async ({ page }) => {
    await openForm(page);
    await newPassword(page).fill('Xq7!tveRm2zd');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await openForm(page);
    await expect(newPassword(page)).toHaveValue('');
    expect(changes).toEqual([]);
  });
});
