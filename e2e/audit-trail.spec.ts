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
 * The auditor's journey through the audit trail (#788), against mocked endpoints: filter the
 * list with the choices `searchtemplate` publishes, check that the filters reach the server, open
 * an entry, and read its payload with the password masked. A user without READ_AUDIT is refused
 * the entry outright.
 */

import { expect, test, type Page } from './fixtures';
import { landsOn } from './utils/settled-route';

const SECRET = 'S3cret!pass';

const TEMPLATE = {
  appUsers: [
    { id: 3, username: 'officer1' },
    { id: 4, username: 'manager2' },
  ],
  actionNames: ['CREATE', 'APPROVE', 'UPDATE'],
  entityNames: ['CLIENT', 'LOAN', 'USER'],
  statuses: [
    { id: 1, processingResult: 'processed' },
    { id: 2, processingResult: 'awaiting.approval' },
  ],
};

const ROW = {
  id: 12_873,
  actionName: 'APPROVE',
  entityName: 'LOAN',
  resourceId: 457,
  maker: 'officer1',
  // The list is serialised by Gson, which writes the timestamp as epoch milliseconds.
  madeOnDate: Date.UTC(2026, 9, 15, 10, 42),
  checker: 'manager2',
  checkedOnDate: Date.UTC(2026, 9, 15, 11, 5),
  processingResult: 'processed',
  clientId: 88,
  loanId: 457,
};

const ENTRY = {
  ...ROW,
  madeOnDate: '2026-10-15T10:42:00Z',
  checkedOnDate: '2026-10-15T11:05:00Z',
  officeId: 1,
  officeName: 'Main Office',
  clientName: 'Ada Lovelace',
  loanAccountNo: '000000457',
  commandAsJson: JSON.stringify({
    approvedOnDate: '15 October 2026',
    approvedLoanAmount: 50_000,
    note: 'Approved per committee 14/10',
    password: SECRET,
  }),
};

async function signIn(page: Page, permissions: string[]): Promise<void> {
  await page.route('**/config.json*', (route) =>
    route.fulfill({ json: { fineractApiUrl: '/api/v1', defaultTenant: 'default' } }),
  );
  await page.route('**/api/v1/authentication**', (route) =>
    route.fulfill({
      json: {
        username: 'auditor',
        userId: 7,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: 'Head Office',
        permissions,
      },
    }),
  );
  await page.route('**/api/v1/businessdate**', (route) =>
    route.fulfill({ json: [{ type: 'BUSINESS_DATE', date: [2026, 10, 16] }] }),
  );
  await page.goto('/login');
  await page.locator('#tenantId').fill('default');
  await page.locator('#username').fill('auditor');
  await page.locator('#password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

/** Serves the three audit endpoints and records every list query the screen sends. */
async function mockAudits(page: Page): Promise<URLSearchParams[]> {
  const listQueries: URLSearchParams[] = [];
  await page.route(/\/api\/v1\/audits(?:\/|\?|$)/, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/audits/searchtemplate')) {
      return route.fulfill({ json: TEMPLATE });
    }
    if (/\/audits\/\d+$/.test(url.pathname)) {
      return route.fulfill({ json: ENTRY });
    }
    listQueries.push(url.searchParams);
    return route.fulfill({ json: { totalFilteredRecords: 1, pageItems: [ROW] } });
  });
  return listQueries;
}

async function pick(page: Page, testId: string, value: string | number): Promise<void> {
  await page.locator(`[data-testid="${testId}"]`).click();
  await page.locator(`[data-testid="searchable-select-option-${value}"]`).click();
  await expect(page.locator('[data-testid="searchable-select-modal"]')).toHaveCount(0);
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Audit trail (#788)', () => {
  test('filters from the search template are sent to the server with paging', async ({ page }) => {
    await signIn(page, ['READ_AUDIT']);
    const queries = await mockAudits(page);
    await page.goto('/security/audits');
    await expect(page.getByRole('cell', { name: 'officer1' })).toBeVisible();

    const first = queries.at(-1)!;
    expect(first.get('paged')).toBe('true');
    expect(first.get('offset')).toBe('0');
    expect(first.get('limit')).toBe('10');
    expect(first.get('orderBy')).toBe('id');
    expect(first.get('sortOrder')).toBe('DESC');

    await page.getByText('Filters').click();
    await pick(page, 'audit-filter-maker', 3);
    await pick(page, 'audit-filter-action', 'APPROVE');
    await pick(page, 'audit-filter-entity', 'LOAN');
    await pick(page, 'audit-filter-status', 1);
    // Clicked and typed: `fill()`, and `pressSequentially()` under a loaded run, left this
    // `type="number"` ion-input empty in Chromium. Focused keystrokes are what a user sends.
    const loanId = page.locator('[data-testid="audit-filter-loan-id"] input');
    await loanId.click();
    await page.keyboard.type('457');
    await expect(loanId).toHaveValue('457');

    const sent = queries.length;
    await page.locator('[data-testid="audit-filter-apply"] ion-button').click();
    await expect.poll(() => queries.length).toBeGreaterThan(sent);

    const filtered = queries.at(-1)!;
    expect(filtered.get('makerId')).toBe('3');
    expect(filtered.get('actionName')).toBe('APPROVE');
    expect(filtered.get('entityName')).toBe('LOAN');
    expect(filtered.get('status')).toBe('1');
    expect(filtered.get('loanId')).toBe('457');
    expect(filtered.get('offset')).toBe('0');
    expect(filtered.get('paged')).toBe('true');
  });

  test('an entry opens with maker, checker, linked records and a masked payload', async ({
    page,
  }) => {
    await signIn(page, ['READ_AUDIT']);
    await mockAudits(page);
    await page.goto('/security/audits');

    await page.locator('[data-testid="audit-open-12873"] ion-button').click();
    await expect(page).toHaveURL('/security/audits/12873');

    await expect(page.locator('[data-testid="audit-entry-title"]')).toHaveText(
      'Audit entry #12873',
    );
    await expect(page.locator('[data-testid="audit-entry-maker"]')).toHaveText('officer1');
    await expect(page.locator('[data-testid="audit-entry-checker"]')).toHaveText('manager2');

    const payload = page.locator('[data-testid="audit-entry-payload"]');
    await expect(payload).toContainText('"approvedLoanAmount": 50000');
    await expect(payload).toContainText('"password": "••••••"');
    await expect(page.locator('body')).not.toContainText(SECRET);

    await expect(page.locator('[data-testid="audit-link-office"]')).toHaveAttribute(
      'href',
      '/organization/offices/view/1',
    );
    await expect(page.locator('[data-testid="audit-link-loan"]')).toHaveAttribute(
      'href',
      '/loans/view/457',
    );
    const client = page.locator('[data-testid="audit-link-client"]');
    await expect(client).toHaveText('Ada Lovelace');
    await expect(client).toHaveAttribute('href', '/clients/view/88');
  });

  test('ALL_FUNCTIONS_READ opens an entry too', async ({ page }) => {
    await signIn(page, ['ALL_FUNCTIONS_READ']);
    await mockAudits(page);

    expect(await landsOn(page, '/security/audits/12873')).toBe('/security/audits/12873');
    await expect(page.locator('[data-testid="audit-entry-payload"]')).toBeVisible();
  });

  test('a user without READ_AUDIT is sent to /forbidden, not shown the entry', async ({ page }) => {
    await signIn(page, ['READ_CLIENT', 'READ_LOAN']);
    const entryRequests: string[] = [];
    page.on('request', (request) => {
      if (/\/api\/v1\/audits\/\d+/.test(request.url())) entryRequests.push(request.url());
    });

    expect(await landsOn(page, '/security/audits/12873')).toBe('/forbidden');
    expect(entryRequests).toEqual([]);
  });
});
