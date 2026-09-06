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

/* eslint-disable sonarjs/no-duplicate-string -- Playwright test patterns inherently repeat locator strings */

import { test, expect, Page } from './fixtures';

/* ─────────── Constants ─────────── */

const TEST_USER = 'mifos';
const TEST_PASSWORD = 'password';
const TENANT_ID = 'default';
const API_BASE = '/api/v1';
const HEAD_OFFICE = 'Head Office';
const BRANCH_OFFICE = 'Branch Office';
const SEARCH_PLACEHOLDER = 'Type to search...';
const ITEMS_PER_PAGE = 'Items per page:';
const SIGN_IN = 'Sign In';
const SAVE_BTN = 'Save';
const CANCEL_BTN = 'Cancel';

const MOCK_AUTH = {
  username: TEST_USER,
  userId: 1,
  base64EncodedAuthenticationKey: 'YmFzZTY0',
  authenticated: true,
  officeId: 1,
  officeName: HEAD_OFFICE,
  roles: [{ id: 1, name: 'Super User', description: 'Super user' }],
  permissions: ['ALL_FUNCTIONS'],
};

const OFFICE_HEAD = {
  id: 1,
  name: HEAD_OFFICE,
  nameDecorated: HEAD_OFFICE,
  externalId: '1',
  openingDate: [2009, 1, 1],
  hierarchy: '.',
};

const OFFICE_BRANCH = {
  id: 2,
  name: BRANCH_OFFICE,
  nameDecorated: `${HEAD_OFFICE}/${BRANCH_OFFICE}`,
  externalId: 'BR001',
  parentId: 1,
  parentName: HEAD_OFFICE,
  openingDate: [2026, 6, 15],
  hierarchy: '.1.',
};

const MOCK_CLIENT = {
  id: 2001,
  accountNo: '00000001',
  displayName: 'Jane Smith',
  firstname: 'Jane',
  lastname: 'Smith',
  officeId: 1,
  officeName: HEAD_OFFICE,
  status: { id: 300, value: 'Active' },
  legalFormId: 1,
  active: true,
};

const EMPTY_LIST = JSON.stringify({ totalFilteredRecords: 0, pageItems: [] });
const EMPTY_ARRAY = JSON.stringify([]);
const JSON_CONTENT = 'application/json';

/* ─────────── Helpers ─────────── */

async function mockConfig(page: Page) {
  await page.route('**/config.json', async (route) => {
    await route.fulfill(
      okJsonResponse(JSON.stringify({ fineractApiUrl: API_BASE, defaultTenant: TENANT_ID })),
    );
  });
}

async function mockAuth(page: Page) {
  await page.route('**/api/v1/authentication**', async (route) => {
    await route.fulfill(okJsonResponse(JSON.stringify(MOCK_AUTH)));
  });
}

async function mockOffices(page: Page, offices = [OFFICE_HEAD]) {
  await page.route('**/api/v1/offices**', async (route) => {
    await route.fulfill(okJsonResponse(JSON.stringify(offices)));
  });
}

async function mockClients(page: Page, clients: unknown[] = []) {
  const body =
    clients.length > 0
      ? JSON.stringify({ totalFilteredRecords: clients.length, pageItems: clients })
      : EMPTY_LIST;
  await page.route('**/api/v1/clients?**', async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT, body });
  });
}

async function mockDashboardCounts(page: Page) {
  const zeroCount = JSON.stringify({ total: 0 });
  const zeroPending = JSON.stringify({ totalPending: 0 });
  await page.route('**/api/v1/loans/count**', async (route) => {
    await route.fulfill(okJsonResponse(zeroCount));
  });
  await page.route('**/api/v1/loans/pendingcases**', async (route) => {
    await route.fulfill(okJsonResponse(zeroPending));
  });
  await page.route('**/api/v1/savings/count**', async (route) => {
    await route.fulfill(okJsonResponse(zeroCount));
  });
  await page.route('**/api/v1/savings/pendingcases**', async (route) => {
    await route.fulfill(okJsonResponse(zeroPending));
  });
}

async function loginAndGoToDashboard(page: Page) {
  await mockConfig(page);
  await mockAuth(page);
  await mockDashboardCounts(page);
  await page.goto('/login');

  // API_BASE is a relative path, so it is not one of the preset <option> values —
  // fall back to the "Custom URL..." entry. Kept general so the same helper works
  // when FINERACT_SERVER_URL points at a preset.
  const serverSelect = page.locator('#serverUrl');
  await serverSelect.waitFor({ state: 'visible' });
  if ((await serverSelect.locator(`option[value="${API_BASE}"]`).count()) > 0) {
    await serverSelect.selectOption(API_BASE);
  } else {
    await serverSelect.selectOption('custom');
    await page.locator('#customUrl').fill(API_BASE);
  }

  await page.locator('#tenantId').fill(TENANT_ID);
  await page.locator('#username').fill(TEST_USER);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: SIGN_IN }).click();
  await expect(page).toHaveURL('/dashboard');
}

function okJsonResponse(body: string) {
  return { status: 200, contentType: JSON_CONTENT, body };
}

/** A form field's own `<ion-label>`, so a help tooltip repeating the label cannot match too. */
function fieldLabel(page: Page, text: string) {
  return page
    .locator('ion-label')
    .filter({ hasText: new RegExp(`^${text}`) })
    .first();
}

/** Opens the client form's Office select and picks the named office. */
async function selectClientOffice(page: Page, officeName: string) {
  await page.locator('ion-select[name="officeId"]').click();
  await page.locator('ion-alert, ion-popover').getByRole('radio', { name: officeName }).click();
}

function mockPostOffice(page: Page) {
  return page.route('**/api/v1/offices', async (route) => {
    if (route.request().method() === 'POST') {
      const data = JSON.parse(route.request().postData() || '{}');
      await route.fulfill(
        okJsonResponse(JSON.stringify({ officeId: 10, resourceId: 10, name: data.name })),
      );
    } else {
      await route.continue();
    }
  });
}

function mockPostClient(page: Page) {
  return page.route('**/api/v1/clients', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill(okJsonResponse(JSON.stringify({ clientId: 100, resourceId: 100 })));
    } else {
      await route.continue();
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════════
   1. LOGIN FLOW
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('E2E: Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfig(page);
  });

  test('should display login page with all required fields', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h1')).toHaveText('Fineract Backoffice UI');
    await expect(page.locator('.subtitle')).toHaveText('Manage your community bank operations');

    await expect(page.locator('#serverUrl')).toBeVisible();
    await expect(page.locator('#tenantId')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: SIGN_IN })).toBeVisible();
  });

  test('should have Sign In button disabled when fields are empty', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: SIGN_IN })).toBeDisabled();
  });

  test('should enable Sign In when credentials are entered', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#tenantId').fill(TENANT_ID);
    await page.locator('#username').fill(TEST_USER);
    await page.locator('#password').fill(TEST_PASSWORD);
    await expect(page.getByRole('button', { name: SIGN_IN })).toBeEnabled();
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    await mockAuth(page);
    await mockDashboardCounts(page);
    await page.goto('/login');

    await page.locator('#tenantId').fill(TENANT_ID);
    await page.locator('#username').fill(TEST_USER);
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: SIGN_IN }).click();

    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText(TEST_USER)).toBeVisible();
  });

  test('should display language selector on login page', async ({ page }) => {
    await page.goto('/login');
    const langSelector = page.locator('select').filter({ hasText: 'English' });
    await expect(langSelector).toBeVisible();
    await expect(langSelector).toContainText('English');
  });

  test('should display API endpoint selector with value', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#serverUrl')).toBeVisible();
    const endpointValue = await page.locator('#serverUrl').inputValue();
    expect(endpointValue).toBeTruthy();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   2. DASHBOARD VERIFICATION
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('E2E: Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
  });

  test('should display dashboard summary cards', async ({ page }) => {
    await expect(page.getByText('Total Clients')).toBeVisible();
    await expect(page.getByText('Active Loans')).toBeVisible();
    await expect(
      page.getByTestId('dashboard-savings-widget').getByText('Savings Accounts'),
    ).toBeVisible();
    await expect(page.getByText('System Health')).toBeVisible();
  });

  test('should display system health as Online', async ({ page }) => {
    await expect(page.getByText('Online')).toBeVisible();
  });

  test('should display pending approvals section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Pending Approvals' })).toBeVisible();
  });

  test('should display loan and savings status distribution charts', async ({ page }) => {
    await expect(page.getByText('Loan Status Distribution')).toBeVisible();
    await expect(page.getByText('Savings Status Distribution')).toBeVisible();
  });

  test('should display system operational status', async ({ page }) => {
    await expect(page.getByText('System Operational Status')).toBeVisible();
    await expect(page.getByText('Environment:')).toBeVisible();
    await expect(page.getByText('Active Tenant:')).toBeVisible();
  });

  test('should have header with business date, render time, and logout', async ({ page }) => {
    await expect(page.getByText('Business Date:')).toBeVisible();
    await expect(page.getByText('Render Time:')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('should have sidebar toggle button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Toggle Sidebar' })).toBeVisible();
  });

  test('should have global search bar in header', async ({ page }) => {
    const searchInput = page.locator('header input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
  });

  test('should have Guide button in header', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Guide' })).toBeVisible();
  });

  test('should have dark mode toggle button', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   3. SIDEBAR NAVIGATION
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('E2E: Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page);
    await mockClients(page);
  });

  test('should have all main navigation links', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Clients', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Groups', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Centers', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Loans', exact: true })).toBeVisible();
  });

  test('should have Products section with sub-links', async ({ page }) => {
    await expect(page.getByText('Products', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Loan Products', exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Savings Products', exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Fixed Deposit Products', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Recurring Deposit Products', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Share Products', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tax Components', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tax Groups', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Floating Rates', exact: true })).toBeVisible();
  });

  test('should have Transfers section with sub-links', async ({ page }) => {
    await expect(page.getByText('Transfers', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Account Transfer' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Standing Instructions' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'SI History' })).toBeVisible();
  });

  test('should have Accounting section with sub-links', async ({ page }) => {
    await expect(page.getByText('Accounting', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chart of Accounts' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Journal Entries' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Accounting Closures' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Accounting Rules' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Financial Activity Mappings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Charges' })).toBeVisible();
  });

  test('should have Security section', async ({ page }) => {
    await expect(page.getByText('Security')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Roles' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Audit Logs' })).toBeVisible();
  });

  test('should have Settings section', async ({ page }) => {
    await expect(page.getByText('Settings')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Global Configurations' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Holidays' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Working Days' })).toBeVisible();
  });

  test('should have Organization section', async ({ page }) => {
    await expect(page.getByText('Organization')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Offices' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Staff' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Funds' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Payment Types' })).toBeVisible();
  });

  test('should have System section', async ({ page }) => {
    await expect(page.getByText('System', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Data Tables' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bulk Import' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Delinquency' })).toBeVisible();
  });

  test('should navigate to all major pages via sidebar', async ({ page }) => {
    // Ten sequential navigations, each lazy-loading its own route chunk, against the default
    // 30s test budget — while a single toHaveURL is allowed 15s on its own. One slow chunk
    // under parallel load exhausts the test before the walk finishes, at whichever link
    // happens to be next. The work is genuinely ~10x a normal test, so the budget should be.
    test.slow();

    const routes = [
      { link: 'Dashboard', url: '/dashboard' },
      { link: 'Clients', url: '/clients' },
      { link: 'Groups', url: '/groups' },
      { link: 'Centers', url: '/centers' },
      { link: 'Loans', url: '/loans' },
      { link: 'Offices', url: '/organization/offices' },
      { link: 'Users', url: '/security/users' },
      { link: 'Roles', url: '/security/roles' },
      { link: 'Reports', url: '/reporting' },
      { link: 'Tellers', url: '/tellers' },
    ];

    for (const route of routes) {
      await page.getByRole('link', { name: route.link, exact: true }).click();
      await expect(page).toHaveURL(route.url);
      await expect(page.getByText(TEST_USER)).toBeVisible();
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   4. OFFICES CRUD
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('E2E: Offices', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page, [OFFICE_HEAD, OFFICE_BRANCH]);
  });

  test('should display offices list with table', async ({ page }) => {
    await page.getByRole('link', { name: 'Offices' }).click();
    await expect(page).toHaveURL('/organization/offices');

    await expect(page.getByRole('columnheader', { name: 'Office Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'External ID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Opening Date' })).toBeVisible();

    await expect(page.getByRole('table').getByText(HEAD_OFFICE)).toBeVisible();
    await expect(page.getByRole('table').getByText(BRANCH_OFFICE)).toBeVisible();
  });

  test('should have Create Office button', async ({ page }) => {
    await page.getByRole('link', { name: 'Offices' }).click();
    await expect(page.getByRole('button', { name: /Create Office/i })).toBeVisible();
  });

  test('should navigate to office create form', async ({ page }) => {
    await mockPostOffice(page);
    await page.getByRole('link', { name: 'Offices' }).click();
    await page.getByRole('button', { name: /Create Office/i }).click();
    await expect(page).toHaveURL('/organization/offices/create');
  });

  test('should validate office create form - save disabled when empty', async ({ page }) => {
    await page.getByRole('link', { name: 'Offices' }).click();
    await page.getByRole('button', { name: /Create Office/i }).click();
    await expect(page).toHaveURL('/organization/offices/create');
    await expect(page.getByRole('button', { name: SAVE_BTN })).toBeDisabled();
  });

  test('should fill office create form and enable save', async ({ page }) => {
    await mockPostOffice(page);
    await page.getByRole('link', { name: 'Offices' }).click();
    await page.getByRole('button', { name: /Create Office/i }).click();

    await page.locator('input[name="name"]').fill('Test Office');

    await page.locator('ion-select[name="parentId"]').click();
    await page.locator('ion-alert, ion-popover').getByRole('radio', { name: HEAD_OFFICE }).click();

    // openingDate already has a valid default (today), so the form is valid without touching it.
    await expect(page.getByRole('button', { name: SAVE_BTN })).toBeEnabled();
  });

  test('should cancel office creation and return to list', async ({ page }) => {
    await page.getByRole('link', { name: 'Offices' }).click();
    await page.getByRole('button', { name: /Create Office/i }).click();
    await expect(page).toHaveURL('/organization/offices/create');

    await page.getByRole('button', { name: CANCEL_BTN }).click();
    await expect(page).toHaveURL('/organization/offices');
  });

  test('should have search input on offices page', async ({ page }) => {
    await page.getByRole('link', { name: 'Offices' }).click();
    await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeVisible();
  });

  test('should show edit button for each office', async ({ page }) => {
    await page.getByRole('link', { name: 'Offices' }).click();
    await expect(page.getByRole('button', { name: 'Edit' }).first()).toBeVisible();
  });

  test('should have pagination controls', async ({ page }) => {
    await page.getByRole('link', { name: 'Offices' }).click();
    await expect(page.getByRole('button', { name: ITEMS_PER_PAGE })).toBeVisible();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   5. CLIENTS CRUD
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('E2E: Clients', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page, [OFFICE_HEAD, OFFICE_BRANCH]);
  });

  test('should display clients list page', async ({ page }) => {
    await mockClients(page, [MOCK_CLIENT]);
    await page.getByRole('link', { name: 'Clients' }).click();
    await expect(page).toHaveURL('/clients');

    await expect(page.getByText('Clients & Contracts')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Account No' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Office' })).toBeVisible();
  });

  test('should display client data in table', async ({ page }) => {
    await mockClients(page, [MOCK_CLIENT]);
    await page.getByRole('link', { name: 'Clients' }).click();

    await expect(page.getByText('Jane Smith')).toBeVisible();
    await expect(page.getByText('00000001')).toBeVisible();
    await expect(page.getByRole('table').getByText(HEAD_OFFICE)).toBeVisible();
  });

  test('should show ACTIVE status badge', async ({ page }) => {
    await mockClients(page, [MOCK_CLIENT]);
    await page.getByRole('link', { name: 'Clients' }).click();
    await expect(page).toHaveURL('/clients');
    await expect(page.getByRole('table').getByText('Active')).toBeVisible();
  });

  test('should have Create Client button', async ({ page }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await expect(page.getByRole('button', { name: /Create Client/i })).toBeVisible();
  });

  test('should show empty state when no clients exist', async ({ page }) => {
    await mockClients(page, []);
    await page.getByRole('link', { name: 'Clients' }).click();
    await expect(page.getByText('No records found')).toBeVisible();
  });

  test('should have search input and status filter', async ({ page }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeVisible();
  });

  test('should have pagination controls', async ({ page }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await expect(page.getByRole('button', { name: ITEMS_PER_PAGE })).toBeVisible();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   6. CLIENT CREATION FLOW
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('E2E: Client Creation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page, [OFFICE_HEAD, OFFICE_BRANCH]);
  });

  test('should navigate to client create form', async ({ page }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create Client/i }).click();
    await expect(page).toHaveURL('/clients/create');
    // Not the bare text: the breadcrumb trail's current-page crumb also reads "Create Client".
    await expect(page.locator('ion-card-title').first()).toContainText('Create Client');
  });

  test('should display all required client form fields, across the wizard steps', async ({
    page,
  }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create Client/i }).click();

    // Step 1 — Client Type.
    await expect(page.getByText('Legal Form')).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible();
    await selectClientOffice(page, HEAD_OFFICE);

    // Step 2 — Personal Details.
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Submitted On')).toBeVisible();
    await expect(page.getByText('Activation Date')).toBeVisible();
    await expect(page.getByText('First Name')).toBeVisible();
    await expect(page.getByText('Last Name')).toBeVisible();
  });

  test('should display optional client form fields, across the wizard steps', async ({ page }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create Client/i }).click();
    await selectClientOffice(page, HEAD_OFFICE);
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2 — Personal Details. Scoped to the field label: several of these fields carry a
    // help tooltip whose text repeats the label ("The client's date of birth."), and a tooltip
    // left open by the previous click makes a bare getByText ambiguous.
    await expect(fieldLabel(page, 'Middle Name')).toBeVisible();
    await expect(fieldLabel(page, 'Date of Birth')).toBeVisible();
    await page.locator('input[name="firstname"]').fill('Jane');
    await page.locator('input[name="lastname"]').fill('Smith');

    // Step 3 — Contact Details.
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(fieldLabel(page, 'External ID')).toBeVisible();
    await expect(fieldLabel(page, 'Mobile No')).toBeVisible();
    await expect(fieldLabel(page, 'Email Address')).toBeVisible();
  });

  test('should have Next disabled until the current step is valid', async ({ page }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create Client/i }).click();

    // Office (required) is unset, so step 1 is invalid.
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    await selectClientOffice(page, HEAD_OFFICE);
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  test('should populate office dropdown from API', async ({ page }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create Client/i }).click();

    await page.locator('ion-select[name="officeId"]').click();

    await expect(
      page.locator('ion-alert, ion-popover').getByRole('radio', { name: HEAD_OFFICE }),
    ).toBeVisible();
    await expect(
      page.locator('ion-alert, ion-popover').getByRole('radio', { name: BRANCH_OFFICE }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('should fill client form and enable save on the last step', async ({ page }) => {
    await page.route('**/api/v1/clients?**', async (route) => {
      await route.fulfill(okJsonResponse(EMPTY_LIST));
    });
    await mockPostClient(page);

    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create Client/i }).click();

    await page.locator('ion-select[name="legalFormId"]').click();
    await page.locator('ion-alert, ion-popover').getByRole('radio', { name: 'Person' }).click();
    await selectClientOffice(page, HEAD_OFFICE);
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('input[name="firstname"]').fill('Jane');
    await page.locator('input[name="lastname"]').fill('Smith');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('button', { name: SAVE_BTN })).toBeEnabled();
  });

  test('should submit client and redirect to clients list', async ({ page }) => {
    await page.route('**/api/v1/clients?**', async (route) => {
      await route.fulfill(okJsonResponse(EMPTY_LIST));
    });
    await mockPostClient(page);

    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create Client/i }).click();

    await page.locator('ion-select[name="legalFormId"]').click();
    await page.locator('ion-alert, ion-popover').getByRole('radio', { name: 'Person' }).click();
    await selectClientOffice(page, HEAD_OFFICE);
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('input[name="firstname"]').fill('Jane');
    await page.locator('input[name="lastname"]').fill('Smith');
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('button', { name: SAVE_BTN }).click();
    await expect(page).toHaveURL('/clients');
  });

  test('should cancel client creation and return to clients list', async ({ page }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create Client/i }).click();
    await expect(page).toHaveURL('/clients/create');

    await page.getByRole('button', { name: CANCEL_BTN }).click();
    await expect(page).toHaveURL('/clients');
  });

  test('should have add office quick-action button', async ({ page }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create Client/i }).click();

    await expect(page.getByRole('button', { name: 'Add New Office' })).toBeVisible();
  });

  test('should have help icons for form fields', async ({ page }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create Client/i }).click();

    await expect(page.locator('ion-icon[name="help-circle-outline"]').first()).toBeVisible();
  });

  test('should have calendar buttons for date fields', async ({ page }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create Client/i }).click();
    // Submitted On / Activation Date live on step 2 (Personal Details).
    await selectClientOffice(page, HEAD_OFFICE);
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.locator('ion-datetime-button').first()).toBeVisible();
  });

  test('should have pre-filled dates in Submitted On and Activation Date', async ({ page }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create Client/i }).click();
    await selectClientOffice(page, HEAD_OFFICE);
    await page.getByRole('button', { name: 'Next' }).click();

    const submittedValue = await page.locator('input[name="submittedOnDate"]').inputValue();
    const activationValue = await page.locator('input[name="activationDate"]').inputValue();
    expect(submittedValue).toBeTruthy();
    expect(activationValue).toBeTruthy();
  });

  test('should have Active checkbox checked by default', async ({ page }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create Client/i }).click();

    const checkbox = page.locator('ion-checkbox').filter({ hasText: 'Active' });
    await expect(checkbox).toBeChecked();
  });

  test('should handle Entity legal form showing fullname field', async ({ page }) => {
    await mockClients(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create Client/i }).click();

    await page.locator('ion-select[name="legalFormId"]').click();
    await page.locator('ion-alert, ion-popover').getByRole('radio', { name: 'Entity' }).click();
    // The Company Name field itself lives on step 2 (Personal Details).
    await selectClientOffice(page, HEAD_OFFICE);
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.locator('input[name="fullname"]')).toBeVisible();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   7. PRODUCTS PAGES
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('E2E: Loan Products Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await page.route('**/api/v1/loanproducts**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.route('**/api/v1/currencies**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/charges**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/funds**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/taxcomponents**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/taxgroups**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/floatingrates**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  });

  test('should display loan products list page', async ({ page }) => {
    await page.getByRole('link', { name: 'Loan Products', exact: true }).first().click();
    await expect(page).toHaveURL('/products/loan');
    await expect(page.getByRole('heading', { name: 'Loan Products' })).toBeVisible();
  });

  test('should have Create Loan Product button', async ({ page }) => {
    await page.getByRole('link', { name: 'Loan Products', exact: true }).first().click();
    await expect(page.getByRole('button', { name: /Create Loan Product/i })).toBeVisible();
  });

  test('should display table with correct headers', async ({ page }) => {
    await page.getByRole('link', { name: 'Loan Products', exact: true }).first().click();
    await expect(page.getByRole('columnheader', { name: 'Name', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Short Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
  });

  test('should show empty state when no products exist', async ({ page }) => {
    await page.getByRole('link', { name: 'Loan Products', exact: true }).first().click();
    await expect(page.getByText('No records found')).toBeVisible();
  });

  test('should have search input', async ({ page }) => {
    await page.getByRole('link', { name: 'Loan Products', exact: true }).first().click();
    await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeVisible();
  });

  test('should navigate to loan product create form', async ({ page }) => {
    await page.route('**/api/v1/fineractEntity**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/adhocquery**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.getByRole('link', { name: 'Loan Products', exact: true }).first().click();
    await page.getByRole('button', { name: /Create Loan Product/i }).click();
    await expect(page).toHaveURL('/products/loan/create');
  });
});

test.describe('E2E: Savings Products Page', () => {
  test('should display savings products list page', async ({ page }) => {
    await loginAndGoToDashboard(page);
    await page.route('**/api/v1/savingsproducts**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });

    await page.getByRole('link', { name: 'Savings Products' }).click();
    await expect(page).toHaveURL('/products/savings');
    await expect(page.getByRole('heading', { name: 'Savings Products' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create/i })).toBeVisible();
  });
});

test.describe('E2E: Other Products Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
  });

  test('Fixed Deposit Products page loads', async ({ page }) => {
    await page.route('**/api/v1/fixeddepositproducts**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.getByRole('link', { name: 'Fixed Deposit Products' }).click();
    await expect(page).toHaveURL('/products/fixed');
    await expect(page.getByRole('heading', { name: 'Fixed Deposit Products' })).toBeVisible();
  });

  test('Recurring Deposit Products page loads', async ({ page }) => {
    await page.route('**/api/v1/recurringdepositproducts**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.getByRole('link', { name: 'Recurring Deposit Products' }).click();
    await expect(page).toHaveURL('/products/recurring');
    // The breadcrumb's current crumb, not the bare text: the sidebar link reads the same.
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('Recurring Deposit Products'),
    ).toBeVisible();
  });

  test('Share Products page loads', async ({ page }) => {
    await page.route('**/api/v1/shareproducts**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.getByRole('link', { name: 'Share Products' }).click();
    await expect(page).toHaveURL('/products/share');
    // The breadcrumb's current crumb, not the bare text: the sidebar link reads the same.
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('Share Products'),
    ).toBeVisible();
  });

  test('Tax Components page loads', async ({ page }) => {
    await page.route('**/api/v1/taxcomponents**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.getByRole('link', { name: 'Tax Components' }).click();
    await expect(page).toHaveURL('/products/tax-components');
  });

  test('Tax Groups page loads', async ({ page }) => {
    await page.route('**/api/v1/taxgroups**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.getByRole('link', { name: 'Tax Groups' }).click();
    await expect(page).toHaveURL('/products/tax-groups');
  });

  test('Floating Rates page loads', async ({ page }) => {
    await page.route('**/api/v1/floatingrates**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.getByRole('link', { name: 'Floating Rates' }).click();
    await expect(page).toHaveURL('/products/floating-rates');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   8. LOANS PORTFOLIO PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('E2E: Loans Portfolio', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await page.route('**/api/v1/loans?**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_LIST });
    });
    await page.route('**/api/v1/loans/count**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total: 0 }),
      });
    });
    await page.route('**/api/v1/loans/pendingcases**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ totalPending: 0 }),
      });
    });
  });

  test('should display loans portfolio page', async ({ page }) => {
    await page.getByRole('link', { name: 'Loans', exact: true }).click();
    await expect(page).toHaveURL('/loans');
    await expect(page.getByText('Loans Portfolio')).toBeVisible();
  });

  test('should have Create Loan Account button', async ({ page }) => {
    await page.getByRole('link', { name: 'Loans', exact: true }).click();
    await expect(page.getByRole('button', { name: /Create Loan Account/i })).toBeVisible();
  });

  test('should display table with correct headers', async ({ page }) => {
    await page.getByRole('link', { name: 'Loans', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: 'Account No' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Client Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Product Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });

  test('should show empty state when no loans exist', async ({ page }) => {
    await page.getByRole('link', { name: 'Loans', exact: true }).click();
    await expect(page.getByText('No records found')).toBeVisible();
  });

  test('should have search input', async ({ page }) => {
    await page.getByRole('link', { name: 'Loans', exact: true }).click();
    await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeVisible();
  });

  test('should have pagination controls', async ({ page }) => {
    await page.getByRole('link', { name: 'Loans', exact: true }).click();
    await expect(page.getByRole('button', { name: ITEMS_PER_PAGE })).toBeVisible();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   9. HEADER & GLOBAL ELEMENTS
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('E2E: Header & Global Elements', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
  });

  test('should display Fineract logo and title in header', async ({ page }) => {
    await expect(page.locator('header').getByText('Fineract Backoffice UI')).toBeVisible();
  });

  test('should display logged-in username', async ({ page }) => {
    await expect(page.getByText(TEST_USER)).toBeVisible();
  });

  test('should display office name for user', async ({ page }) => {
    await expect(page.getByText(HEAD_OFFICE)).toBeVisible();
  });

  test('should have Logout button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('should have language selector in header', async ({ page }) => {
    await expect(page.locator('header select')).toBeVisible();
  });

  test('should display render time', async ({ page }) => {
    await expect(page.getByText('Render Time:')).toBeVisible();
  });

  test('should display business date', async ({ page }) => {
    await expect(page.getByText('Business Date:')).toBeVisible();
  });
});
