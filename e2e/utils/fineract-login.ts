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
 * Shared real-backend login helper for e2e specs that exercise the app
 * end-to-end against an actual Fineract instance (not page.route() mocks).
 *
 * Points at the local docker stack by default. A different instance can be
 * supplied through the environment, but never from CI — these specs create real
 * data, so assertLocalBackend() refuses anything non-local there:
 *
 *   FINERACT_SERVER_URL="https://localhost:8443/fineract-provider/api/v1" \
 *   FINERACT_TENANT_ID=default FINERACT_USERNAME=mifos FINERACT_PASSWORD=password \
 *   npx playwright test
 */

import { Page, expect } from '@playwright/test';

// Re-exported rather than read here, so the browser-facing SERVER_URL and the
// Node-facing API_BASE in seed-api.ts cannot drift onto two different instances.
// See backend-env.ts for why they are derived from one another.
import { PASSWORD, SERVER_URL, TENANT_ID, USERNAME, assertLocalBackend } from './backend-env';

export { PASSWORD, SERVER_URL, TENANT_ID, USERNAME };

export async function login(page: Page): Promise<void> {
  // Covers the specs that log in but never seed, so nothing reaches a public
  // instance from CI. See assertLocalBackend.
  assertLocalBackend();

  await page.goto('/login');

  if (page.url().includes('/dashboard') || (await page.locator('#app-navigation').isVisible())) {
    return;
  }

  const serverSelect = page.locator('#serverUrl');
  await serverSelect.waitFor({ state: 'visible' });
  const presetCount = await serverSelect.locator(`option[value="${SERVER_URL}"]`).count();
  if (presetCount > 0) {
    await serverSelect.selectOption(SERVER_URL);
  } else {
    await serverSelect.selectOption('custom');
    await page.locator('#customUrl').fill(SERVER_URL);
  }

  await page.locator('#tenantId').fill(TENANT_ID);
  await page.locator('#username').fill(USERNAME);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Successful login lands on a page with the main sidebar navigation. Checked by id rather
  // than role: SidebarComponent's `role` attribute is `navigation` on a wide viewport but
  // `dialog` on a narrow one (it becomes a modal drawer there), so a role-based check would
  // never resolve for a mobile-viewport caller of this helper.
  await expect(page.locator('#app-navigation')).toBeVisible({
    timeout: 30000,
  });
}

export function uniqueSuffix(): string {
  return Date.now().toString(36).slice(-6);
}
