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

import { test, expect } from './fixtures';

test.describe('Login', () => {
  test('login page displays correctly', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h1')).toHaveText('Fineract Backoffice UI');
    await expect(page.locator('.subtitle')).toHaveText('Manage your community bank operations');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('login form has required fields', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('#serverUrl')).toBeVisible();
    await expect(page.locator('#tenantId')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('submit button is disabled when form is empty', async ({ page }) => {
    await page.goto('/login');

    const submitButton = page.getByRole('button', { name: 'Sign In' });
    await expect(submitButton).toBeDisabled();
  });

  test('submit button is enabled when form is filled', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#tenantId').fill('default');
    await page.locator('#username').fill('testuser');
    await page.locator('#password').fill('password');

    const submitButton = page.getByRole('button', { name: 'Sign In' });
    await expect(submitButton).toBeEnabled();
  });
});
