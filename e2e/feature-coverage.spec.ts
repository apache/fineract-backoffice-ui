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

import { test, expect, Page } from './fixtures';

const TEST_USER = 'mifos';
const TEST_PASSWORD = 'password';
const TENANT_DEFAULT = 'default';
const API_BASE = '/api/v1';
const HEAD_OFFICE = 'Head Office';
const BTN_CREATE = /Create/i;
const CARD_TITLE = 'ion-card-title';
const RESP_EMPTY = JSON.stringify([]);
const RESP_EMPTY_PAGINATED = JSON.stringify({ totalFilteredRecords: 0, pageItems: [] });
const SAVINGS_ACCOUNTS = 'Savings Accounts';

/**
 * A list mocked with [] renders exactly the same DOM as a list whose rows never reached the
 * template, so a test asserting only the page title passes against either. That is how the
 * empty parent-office dropdown survived this suite. One row makes the two distinguishable.
 */
const oneRow = (fields: Record<string, unknown>) => JSON.stringify([{ id: 1, ...fields }]);

/** Asserts the shared data table actually rendered its row, not just its heading. */
async function expectRow(page: Page, text: string | RegExp) {
  const rows = page.locator('table.data-table tr[cdk-row]');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(text);
}

/** Shared login + API mock setup used across all feature tests */
async function loginAndMockApi(page: Page) {
  await page.route('**/config.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        fineractApiUrl: API_BASE,
        defaultTenant: TENANT_DEFAULT,
      }),
    });
  });

  await page.route('**/api/v1/authentication**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        username: TEST_USER,
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: HEAD_OFFICE,
        roles: [{ id: 1, name: 'Super User', description: 'Super user' }],
        permissions: ['ALL_FUNCTIONS'],
      }),
    });
  });

  await page.goto('/login');
  if (!page.url().includes('/dashboard')) {
    await page.locator('#tenantId').fill(TENANT_DEFAULT);
    await page.locator('#username').fill(TEST_USER);
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/dashboard');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. NAVIGATION & SIDEBAR COVERAGE
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Navigation & Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndMockApi(page);
  });

  test('all main navigation links are visible in sidebar', async ({ page }) => {
    const navLinks = [
      'Dashboard',
      'Clients',
      'Groups',
      'Centers',
      'Loans',
      'Transfers',
      'Account Transfer',
      'Standing Instructions',
      'SI History',
      'Products',
      'Loan Products',
      'Savings Products',
      'Fixed Deposit Products',
      'Recurring Deposit Products',
      'Share Products',
      'Tax Components',
      'Tax Groups',
      'Floating Rates',
      SAVINGS_ACCOUNTS,
      'Fixed Deposits',
      'Recurring Deposits',
      'Share Accounts',
      'Embedded Fintech',
      'Asset Owners',
      'Accounting',
      'Chart of Accounts',
      'Journal Entries',
      'Accounting Closures',
      'Accounting Rules',
      'Financial Activity Mappings',
      'Charges',
      'Tasks',
      'Checker Inbox',
      'Security',
      'Users',
      'Roles',
      'Audit Logs',
      'Reporting',
      'Reports',
      'Settings',
      'Global Configurations',
      'Holidays',
      'Working Days',
      'Teller Operations',
      'Tellers',
      'Organization',
      'Offices',
      'Staff',
      'Funds',
      'Payment Types',
      'System',
      'Data Tables',
      'Bulk Import',
      'Delinquency',
    ];

    for (const linkName of navLinks) {
      // The list mixes routable children (rendered as <a>) with group headings
      // such as "Embedded Fintech", which the sidebar renders as a plain
      // <span class="nav-group-header"> and which therefore has no link role.
      // Accept either. Without this, a heading only passes when its text happens
      // to be a substring of some child link ("Accounting" matching "Accounting
      // Closures"), which is why "Embedded Fintech" was the one that failed.
      //
      // .first(): some names are not unique in the sidebar (e.g. "Loan Products"
      // appears under both Products and Working Capital) — this test asserts
      // presence, not uniqueness.
      const link = page.getByRole('link', { name: linkName });
      const groupHeading = page.locator('.nav-group-header', { hasText: linkName });
      await expect(link.or(groupHeading).first()).toBeVisible();
    }
  });

  test('sidebar navigation routes to correct pages', async ({ page }) => {
    const routes = [
      { link: 'Dashboard', url: '/dashboard' },
      { link: 'Clients', url: '/clients' },
      { link: 'Groups', url: '/groups' },
      { link: 'Centers', url: '/centers' },
      { link: 'Loans', url: '/loans' },
      { link: 'Offices', url: '/organization/offices' },
      { link: 'Users', url: '/security/users' },
    ];

    for (const route of routes) {
      await page.getByRole('link', { name: route.link, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(route.url));
    }
  });

  test('header shows logged-in user info', async ({ page }) => {
    await expect(page.getByText(TEST_USER)).toBeVisible();
    await expect(page.getByText('Business Date:')).toBeVisible();
    await expect(page.getByText('Render Time:')).toBeVisible();
  });

  test('help tour button is visible and interactive', async ({ page }) => {
    const helpBtn = page.getByRole('button', { name: /Help Tour|Guide/ });
    await expect(helpBtn).toBeVisible();
  });

  test('logout button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('language selector is present', async ({ page }) => {
    await expect(page.getByRole('combobox', { name: 'Select Language' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndMockApi(page);
  });

  test('dashboard shows key metrics cards', async ({ page }) => {
    await expect(page.getByText('Total Clients')).toBeVisible();
    await expect(page.getByText('Active Loans')).toBeVisible();
    await expect(
      page.getByTestId('dashboard-savings-widget').getByText(SAVINGS_ACCOUNTS),
    ).toBeVisible();
    await expect(page.getByText('System Health')).toBeVisible();
  });

  test('dashboard shows pending approvals section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Pending Approvals' })).toBeVisible();
  });

  test('dashboard shows loan and savings status distribution', async ({ page }) => {
    await expect(page.getByText('Loan Status Distribution')).toBeVisible();
    await expect(page.getByText('Savings Status Distribution')).toBeVisible();
  });

  test('dashboard shows system operational status', async ({ page }) => {
    await expect(page.getByText('System Operational Status')).toBeVisible();
    await expect(page.getByText('Runtime API URL:')).toBeVisible();
    await expect(page.getByText('Active Tenant:')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GROUPS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Groups', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndMockApi(page);
    await page.route('**/api/v1/groups*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY_PAGINATED,
      });
    });
  });

  test('groups page renders with title', async ({ page }) => {
    await page.getByRole('link', { name: 'Groups', exact: true }).click();
    await expect(page).toHaveURL('/groups');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Groups|Group/i);
  });

  test('groups page has create button', async ({ page }) => {
    await page.getByRole('link', { name: 'Groups', exact: true }).click();
    await expect(page.getByRole('button', { name: BTN_CREATE })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CENTERS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Centers', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndMockApi(page);
    await page.route('**/api/v1/centers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY_PAGINATED,
      });
    });
  });

  test('centers page renders with title', async ({ page }) => {
    await page.getByRole('link', { name: 'Centers' }).click();
    await expect(page).toHaveURL('/centers');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Centers|Center/i);
  });

  test('centers page has create button', async ({ page }) => {
    await page.getByRole('link', { name: 'Centers' }).click();
    await expect(page.getByRole('button', { name: BTN_CREATE })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. ORGANIZATION
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Organization', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndMockApi(page);
    await page.route('**/api/v1/offices*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: HEAD_OFFICE, nameDecorated: HEAD_OFFICE, openingDate: [2009, 1, 1] },
        ]),
      });
    });
    await page.route('**/api/v1/staff*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: oneRow({ displayName: 'Ada Lovelace', officeName: HEAD_OFFICE, isLoanOfficer: true }),
      });
    });
    await page.route('**/api/v1/funds*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: oneRow({ name: 'Microfinance Fund', externalId: 'FUND-1' }),
      });
    });
    await page.route('**/api/v1/paymenttypes*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: oneRow({
          name: 'Bank Transfer',
          description: 'Wire',
          isCashPayment: false,
          position: 1,
        }),
      });
    });
  });

  test('offices page loads with list', async ({ page }) => {
    await page.getByRole('link', { name: 'Offices' }).click();
    await expect(page).toHaveURL('/organization/offices');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Office/i);
    await expect(page.getByRole('button', { name: BTN_CREATE })).toBeVisible();
    await expectRow(page, HEAD_OFFICE);
  });

  test('staff page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Staff' }).click();
    await expect(page).toHaveURL('/organization/staff');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Staff/i);
    await expectRow(page, 'Ada Lovelace');
  });

  test('funds page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Funds' }).click();
    await expect(page).toHaveURL('/organization/funds');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Funds/i);
    await expectRow(page, 'Microfinance Fund');
  });

  test('payment types page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Payment Types' }).click();
    await expect(page).toHaveURL('/organization/payment-types');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Payment/i);
    await expectRow(page, 'Bank Transfer');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ACCOUNTING
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Accounting', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndMockApi(page);
    await page.route('**/api/v1/glaccounts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
    await page.route('**/api/v1/journalentries*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY_PAGINATED,
      });
    });
    await page.route('**/api/v1/accountingclosures*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
    await page.route('**/api/v1/accountingrules*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
    await page.route('**/api/v1/mappingfinancialactivities*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
    await page.route('**/api/v1/charges*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
  });

  test('chart of accounts loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Chart of Accounts' }).click();
    await expect(page).toHaveURL('/accounting/chart-of-accounts');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Chart of Accounts/i);
  });

  test('journal entries page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Journal Entries' }).click();
    await expect(page).toHaveURL('/accounting/journal-entries');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Journal/i);
  });

  test('accounting closures loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Accounting Closures' }).click();
    await expect(page).toHaveURL('/accounting/closures');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Closure/i);
  });

  test('accounting rules loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Accounting Rules' }).click();
    await expect(page).toHaveURL('/accounting/rules');
  });

  test('financial activity mappings loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Financial Activity Mappings' }).click();
    await expect(page).toHaveURL('/accounting/financial-activity-mappings');
  });

  test('charges page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Charges' }).click();
    await expect(page).toHaveURL('/accounting/charges');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Charge/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. SECURITY
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Security', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndMockApi(page);
    await page.route('**/api/v1/users*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
    await page.route('**/api/v1/roles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
    await page.route('**/api/v1/audits*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY_PAGINATED,
      });
    });
  });

  test('users page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL('/security/users');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/User/i);
  });

  test('roles page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Roles' }).click();
    await expect(page).toHaveURL('/security/roles');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Role/i);
  });

  test('audit logs page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Audit Logs' }).click();
    await expect(page).toHaveURL('/security/audits');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Audit/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. PRODUCTS (Loan & Savings Products)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Products - Loan & Savings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndMockApi(page);
    await page.route('**/api/v1/loanproducts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
    await page.route('**/api/v1/savingsproducts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
    await page.route('**/api/v1/taxcomponents*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
    await page.route('**/api/v1/taxgroups*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
    await page.route('**/api/v1/floatingrates*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
  });

  test('loan products page loads', async ({ page }) => {
    // .first(): "Loan Products" appears twice — once under Products, once under
    // Working Capital — this test targets the Products one (/products/loan).
    await page.getByRole('link', { name: 'Loan Products' }).first().click();
    await expect(page).toHaveURL('/products/loan');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Loan Product/i);
  });

  test('savings products page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Savings Products' }).click();
    await expect(page).toHaveURL('/products/savings');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Savings Product/i);
  });

  test('tax components page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Tax Components' }).click();
    await expect(page).toHaveURL('/products/tax-components');
  });

  test('tax groups page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Tax Groups' }).click();
    await expect(page).toHaveURL('/products/tax-groups');
  });

  test('floating rates page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Floating Rates' }).click();
    await expect(page).toHaveURL('/products/floating-rates');
  });

  test('savings accounts page loads', async ({ page }) => {
    await page.getByRole('link', { name: SAVINGS_ACCOUNTS }).click();
    await expect(page).toHaveURL('/products/savings-accounts');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Savings Account/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndMockApi(page);
    await page.route('**/api/v1/configurations*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
    await page.route('**/api/v1/holidays*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
    await page.route('**/api/v1/workingdays*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
  });

  test('global configurations page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Global Configurations' }).click();
    await expect(page).toHaveURL('/settings/configurations');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Configuration/i);
  });

  test('holidays page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Holidays' }).click();
    await expect(page).toHaveURL('/settings/holidays');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Holiday/i);
  });

  test('working days page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Working Days' }).click();
    await expect(page).toHaveURL('/settings/working-days');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
test.describe('System', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndMockApi(page);
    await page.route('**/api/v1/datatables*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
    await page.route('**/api/v1/delinquency*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
  });

  test('data tables page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Data Tables' }).click();
    await expect(page).toHaveURL('/system/data-tables');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Data Table/i);
  });

  test('bulk import page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Bulk Import' }).click();
    await expect(page).toHaveURL('/system/bulk-import');
  });

  test('delinquency page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Delinquency' }).click();
    await expect(page).toHaveURL('/system/delinquency');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Delinquency/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. TELLERS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Tellers', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndMockApi(page);
    await page.route('**/api/v1/tellers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
  });

  test('tellers page loads with create button', async ({ page }) => {
    await page.getByRole('link', { name: 'Tellers' }).click();
    await expect(page).toHaveURL('/tellers');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Teller/i);
    await expect(page.getByRole('button', { name: BTN_CREATE })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. TRANSFERS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Transfers', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndMockApi(page);
    await page.route('**/api/v1/accounttransfers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
    await page.route('**/api/v1/standinginstructions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
  });

  test('account transfer page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Account Transfer' }).click();
    await expect(page).toHaveURL('/transfers/account-transfer');
  });

  test('standing instructions page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Standing Instructions' }).click();
    await expect(page).toHaveURL('/transfers/standing-instructions');
  });

  test('SI history page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'SI History' }).click();
    await expect(page).toHaveURL('/transfers/standing-instructions/history');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. FINTECH
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Embedded Fintech', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndMockApi(page);
    await page.route('**/api/v1/externalassetowners*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: RESP_EMPTY,
      });
    });
  });

  test('asset owners page loads', async ({ page }) => {
    await page.getByRole('link', { name: 'Asset Owners' }).click();
    await expect(page).toHaveURL('/fintech/asset-owners');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Asset/i);
  });
});
