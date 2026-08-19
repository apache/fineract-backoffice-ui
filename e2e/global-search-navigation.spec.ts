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
 * Cover for the global search in the header — the one control that can reach any
 * entity in the application from any screen, and until now the only navigation
 * affordance with no end-to-end test at all.
 *
 * What is worth testing here is not that a request is made. It is the three things
 * the component does around the request, each of which is invisible in a unit test
 * of the service: it suppresses queries the backend would reject, it routes each
 * entity type to a different destination, and it keeps the dropdown alive long
 * enough for the click that dismisses it to land. The last one is a genuine race —
 * `onSearchBlur` hides the list on a 150ms timer precisely so that blur does not
 * unmount the item being clicked — and it only reproduces in a real browser.
 *
 * Everything runs against page.route() mocks, so this needs no Fineract.
 */

import { test, expect, Page } from './fixtures';

const TENANT = 'default';
const USER = 'mifos';
const PASSWORD = 'password';

/** Matches the `debounceTime(300)` in HeaderComponent, with room for the round trip. */
const DEBOUNCE_MS = 300;

type SearchHit = {
  entityId: number;
  entityType: string;
  entityName: string;
  entityAccountNo?: string;
};

const HITS: SearchHit[] = [
  { entityId: 11, entityType: 'CLIENT', entityName: 'Ada Lovelace', entityAccountNo: '000000011' },
  {
    entityId: 22,
    entityType: 'LOAN',
    entityName: 'Ada Lovelace - Loan',
    entityAccountNo: '000000022',
  },
  {
    entityId: 33,
    entityType: 'SAVINGSACCOUNT',
    entityName: 'Ada Lovelace - Savings',
    entityAccountNo: '000000033',
  },
];

async function mockSession(page: Page) {
  // Registered first on purpose. Playwright matches handlers most-recent-first, so this
  // catch-all must go in before the specific ones or it answers for them too — including
  // /authentication, which strips the user's permissions and bounces every guarded route
  // to /forbidden. Destination screens each fan out into several endpoints and none of
  // them are what this spec is about; an empty body keeps a landed navigation from being
  // drowned in unrelated failures.
  await page.route(/\/api\/v1\//, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/config.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fineractApiUrl: '/api/v1', defaultTenant: TENANT }),
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
        roles: [{ id: 1, name: 'Super User', description: 'Super user' }],
        permissions: ['ALL_FUNCTIONS'],
      }),
    });
  });

  // The header reads this on init; left unmocked it fails and the console noise
  // lands on whichever test is running.
  await page.route(/\/api\/v1\/businessdate/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ type: 'BUSINESS_DATE', date: [2026, 8, 16] }]),
    });
  });
}

/**
 * Records every search request so a test can assert on what was *not* sent —
 * the minimum-length and debounce behaviour is only observable that way.
 */
async function mockSearch(page: Page, hits: SearchHit[] = HITS) {
  const queries: string[] = [];

  await page.route(/\/api\/v1\/search\?/, async (route) => {
    const url = new URL(route.request().url());
    queries.push(url.searchParams.get('query') ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(hits),
    });
  });

  return queries;
}

async function login(page: Page) {
  await mockSession(page);
  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT);
  await page.locator('#username').fill(USER);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

const searchBox = (page: Page) => page.getByTestId('global-search').locator('input');
const results = (page: Page) => page.getByTestId('global-search-results');
const result = (page: Page, entityId: number) => page.getByTestId(`search-result-${entityId}`);

test.describe('Global search navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('does not query the backend for a single character', async ({ page }) => {
    const queries = await mockSearch(page);

    await searchBox(page).fill('A');
    await page.waitForTimeout(DEBOUNCE_MS * 3);

    // Fineract rejects a one-character search, so the guard is what keeps the
    // first keystroke of every search from being a wasted round trip.
    expect(queries).toEqual([]);
    await expect(results(page)).toBeHidden();
  });

  test('sends one request for a phrase typed straight through', async ({ page }) => {
    const queries = await mockSearch(page);

    await searchBox(page).pressSequentially('Ada', { delay: 40 });
    await expect(results(page)).toBeVisible();
    await page.waitForTimeout(DEBOUNCE_MS * 3);

    // Without the debounce this is one request per keystroke, against an endpoint
    // that searches clients, loans and savings on every call.
    expect(queries).toEqual(['Ada']);
  });

  test('opens the client behind a client result', async ({ page }) => {
    await mockSearch(page);

    await searchBox(page).fill('Ada');
    await expect(result(page, 11)).toBeVisible();
    await result(page, 11).click();

    await expect(page).toHaveURL('/clients/view/11');
  });

  test('opens the loan behind a loan result', async ({ page }) => {
    await mockSearch(page);

    await searchBox(page).fill('Ada');
    await expect(result(page, 22)).toBeVisible();
    await result(page, 22).click();

    await expect(page).toHaveURL('/loans/view/22');
  });

  test('opens the savings account behind a savings result', async ({ page }) => {
    await mockSearch(page);

    await searchBox(page).fill('Ada');
    await expect(result(page, 33)).toBeVisible();
    await result(page, 33).click();

    // Savings accounts live under products, not at a top-level /savings — routing
    // one there matched the wildcard and dropped the user on Not Found.
    await expect(page).toHaveURL('/products/savings-accounts/view/33');
  });

  test('clears the query and closes the dropdown after a selection', async ({ page }) => {
    await mockSearch(page);

    await searchBox(page).fill('Ada');
    await expect(result(page, 11)).toBeVisible();
    await result(page, 11).click();

    await expect(results(page)).toBeHidden();
    // A query left in the box reopens the previous results on the next focus,
    // over whatever screen the user just navigated to.
    await expect(searchBox(page)).toHaveValue('');
  });

  test('closes the dropdown when focus leaves without a selection', async ({ page }) => {
    await mockSearch(page);

    await searchBox(page).fill('Ada');
    await expect(results(page)).toBeVisible();

    await searchBox(page).blur();

    await expect(results(page)).toBeHidden();
    await expect(page).toHaveURL('/dashboard');
  });

  test('shows nothing rather than an empty dropdown when there are no matches', async ({
    page,
  }) => {
    await mockSearch(page, []);

    await searchBox(page).fill('Zz');
    await page.waitForTimeout(DEBOUNCE_MS * 3);

    await expect(results(page)).toBeHidden();
  });
});
