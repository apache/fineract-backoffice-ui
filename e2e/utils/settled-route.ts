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

import { Page } from '@playwright/test';

/**
 * Types a URL into the address bar and reports where the router actually settled.
 *
 * `page.goto` resolves on the `load` event, which for this application is before the runtime
 * config fetch, the bootstrap and the route guards have run. Reading `page.url()` there gives
 * back whatever was typed, so every guard redirect looks like it did not happen — which is
 * exactly the assertion an RBAC spec is trying to make.
 *
 * So wait for the application to have rendered something (the authenticated shell, or the login
 * card in whichever step it is showing), then let the path stop moving before reporting it.
 */
export async function landsOn(page: Page, url: string): Promise<string> {
  await page.goto(url);
  // `.login-card` rather than `#username`: the login page has two steps, and the password form
  // is replaced — not merely hidden — while a second factor is outstanding.
  await page.locator('.app-container, .login-card').first().waitFor({ state: 'visible' });

  let previous = '';
  for (let stable = 0; stable < 3;) {
    const current = new URL(page.url()).pathname;
    stable = current === previous ? stable + 1 : 0;
    previous = current;
    await page.waitForTimeout(150);
  }
  return previous;
}
