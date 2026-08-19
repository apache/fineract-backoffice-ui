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
 * The second authentication factor, against a real Fineract that is actually demanding one.
 *
 * Needs the dedicated stack — `bash scripts/e2e-stack-2fa.sh` — because
 * `fineract.security.2fa.enabled` is process-wide. With it on, every endpoint except
 * `/v1/twofactor` answers 403 until a one-time token has been validated, which is precisely the
 * condition under test and precisely why the ordinary suite cannot share the instance.
 *
 * `two-factor-authentication.spec.ts` covers the matrix against mocks. This covers the one thing
 * mocks cannot: that the token Fineract really issues, delivered the way it really delivers it,
 * gets a real session past a platform that is really refusing everything else.
 */

import { test, expect } from './fixtures';
import { SERVER_URL, TENANT_ID, USERNAME, PASSWORD } from './utils/fineract-login';
import { clearMailbox, latestOtp } from './utils/mailpit';

const CODE_FIELD = 'two-factor-code';
const SUBMIT = 'two-factor-submit';

// Signing in twice, each waiting on an email, against a platform refusing everything else.
test.describe.configure({ mode: 'serial', timeout: 180_000 });

/** Fills in the password form. Stops where the second factor begins. */
async function submitPassword(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
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
  await page.getByRole('button', { name: 'Sign In' }).click();
}

test.describe('two-step verification against a real Fineract', () => {
  test('the platform asks for a second factor and the application stops for it', async ({
    page,
  }) => {
    await clearMailbox();
    await submitPassword(page);

    // The password was accepted — but Fineract will refuse every other endpoint until the
    // one-time token is validated, so arriving on the dashboard here would be the bug.
    await expect(page.getByTestId(CODE_FIELD)).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('a real one-time token completes sign-in and the session then works', async ({ page }) => {
    const since = Date.now();
    await clearMailbox();
    await submitPassword(page);
    await expect(page.getByTestId(CODE_FIELD)).toBeVisible({ timeout: 30_000 });

    // Read the token from the mailbox, exactly as the user would.
    const otp = await latestOtp(since);
    expect(otp).toMatch(/^[A-Za-z0-9]+$/);

    await page.getByTestId(CODE_FIELD).fill(otp);
    await page.getByTestId(SUBMIT).click();

    await expect(page).toHaveURL('/dashboard', { timeout: 30_000 });

    // The real proof: a screen whose data comes from an endpoint the platform was refusing a
    // moment ago. Without the TFA token on the request this is a page of 403s.
    await page.goto('/organization/offices');
    await expect(page.getByRole('heading', { level: 1 }).or(page.locator('table'))).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/do not have permission/i)).toHaveCount(0);
  });

  test('a wrong code is refused with the reason the platform gives', async ({ page }) => {
    await clearMailbox();
    await submitPassword(page);
    await expect(page.getByTestId(CODE_FIELD)).toBeVisible({ timeout: 30_000 });

    await page.getByTestId(CODE_FIELD).fill('ZZZZZ');
    await page.getByTestId(SUBMIT).click();

    // Fineract answers a bad code as a domain-rule violation rather than an authorization
    // failure, and its message is better than anything the client could invent.
    await expect(page.getByRole('alert')).toContainText(/one time token is invalid/i, {
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });
});
