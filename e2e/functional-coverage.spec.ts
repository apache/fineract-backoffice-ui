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
const CARD_TITLE = 'ion-card-title';
const BTN_SAVE = 'Save';
const BTN_CANCEL = 'Cancel';

const URL_CLIENTS_CREATE = '/clients/create';
const SELECT_LEGAL_FORM = 'ion-select[name="legalFormId"]';
const SELECT_OFFICE = 'ion-select[name="officeId"]';
const OPTION = 'ion-alert [role="radio"], ion-popover [role="radio"]';
const ROUTE_CLIENT_2001 = '**/api/v1/clients/2001**';
const URL_CLIENT_2001 = '/clients/view/2001';
const ARIA_SELECTED = 'aria-selected';
const SEARCH_INPUT_LOCATOR = 'input[placeholder="Type to search..."]';
const ROUTE_CHARGES = '**/api/v1/charges**';
const ROUTE_OFFICES = '**/api/v1/offices';
const ROUTE_OFFICES_WILDCARD = '**/api/v1/offices**';
const ROUTE_GLACCOUNTS = '**/api/v1/glaccounts**';

const OFFICE_MOCK = {
  id: 1,
  name: HEAD_OFFICE,
  nameDecorated: HEAD_OFFICE,
  externalId: '1',
  openingDate: [2009, 1, 1],
  hierarchy: '.',
};

const EMPTY_RESPONSE = JSON.stringify({ totalFilteredRecords: 0, pageItems: [] });
const EMPTY_ARRAY = JSON.stringify([]);
const OFFICE_ARRAY = JSON.stringify([OFFICE_MOCK]);

const NEW_CLIENT = {
  id: 2001,
  accountNo: '000000001',
  displayName: 'Test User',
  firstname: 'Test',
  lastname: 'User',
  officeId: 1,
  officeName: HEAD_OFFICE,
  status: { id: 100, value: 'Pending' },
  legalFormId: 1,
  active: false,
};

const ACTIVE_CLIENT = {
  ...NEW_CLIENT,
  status: { id: 300, value: 'Active' },
  active: true,
};

const CLOSED_CLIENT = {
  ...NEW_CLIENT,
  status: { id: 600, value: 'Closed' },
  active: false,
};

/* ─────────── helpers ─────────── */

async function mockConfig(page: Page) {
  await page.route('**/config.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fineractApiUrl: API_BASE, defaultTenant: TENANT_DEFAULT }),
    });
  });
}

async function mockAuth(page: Page) {
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
}

async function mockOffices(page: Page) {
  await page.route('**/api/v1/offices*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: OFFICE_ARRAY });
  });
}

async function loginAndGoToDashboard(page: Page) {
  await mockConfig(page);
  await mockAuth(page);
  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT_DEFAULT);
  await page.locator('#username').fill(TEST_USER);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

async function setupClientMocks(page: Page, clients: unknown[] = []) {
  const body =
    clients.length > 0
      ? JSON.stringify({ totalFilteredRecords: clients.length, pageItems: clients })
      : EMPTY_RESPONSE;
  await page.route(/\/api\/v1\/clients(\?|$)/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await page.route('**/api/v1/clients', async (route) => {
    if (route.request().method() === 'POST') {
      const postData = JSON.parse(route.request().postData() || '{}');
      const created = {
        id: Date.now(),
        accountNo: '000009999',
        displayName: `${postData.firstname} ${postData.lastname}`.trim(),
        firstname: postData.firstname,
        lastname: postData.lastname,
        officeId: postData.officeId,
        officeName: HEAD_OFFICE,
        status: { id: 100, value: 'Pending' },
        legalFormId: postData.legalFormId,
        active: false,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ clientId: created.id, resourceId: created.id }),
      });
    } else {
      await route.continue();
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════════
   1. CLIENT CRUD WORKFLOW
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Client CRUD Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page);
  });

  test('should complete full client creation flow — Person', async ({ page }) => {
    await setupClientMocks(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await expect(page).toHaveURL('/clients');

    /* open create form */
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL(URL_CLIENTS_CREATE);
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Create Client/i);

    /* save button should be disabled when required fields are empty */
    await expect(page.getByRole('button', { name: BTN_SAVE })).toBeDisabled();

    /* fill required fields */
    await page.locator(SELECT_LEGAL_FORM).click();
    await page
      .locator('ion-alert, ion-popover')
      .getByRole('radio', { name: /Person/i })
      .click();

    await page.locator(SELECT_OFFICE).click();
    await page.locator(OPTION).first().click();

    /* submitted on / activation date already default to today; no interaction needed */

    /* fill required name fields */
    await page.locator('input[name="firstname"]').fill('Test');
    await page.locator('input[name="lastname"]').fill('User');

    /* now save button should be enabled */
    await expect(page.getByRole('button', { name: BTN_SAVE })).toBeEnabled();

    /* fill optional fields */
    await page.locator('input[name="firstname"]').fill('Test');
    await page.locator('input[name="lastname"]').fill('User');
    await page.locator('input[name="externalId"]').fill('EXT-TEST-001');
    await page.locator('input[name="mobileNo"]').fill('9876543210');
    await page.locator('input[name="emailAddress"]').fill('test@example.com');

    /* submit the form */
    await page.getByRole('button', { name: BTN_SAVE }).click();
    await expect(page).toHaveURL('/clients');
  });

  test('should complete full client creation flow — Entity', async ({ page }) => {
    await setupClientMocks(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL(URL_CLIENTS_CREATE);

    /* save disabled initially */
    await expect(page.getByRole('button', { name: BTN_SAVE })).toBeDisabled();

    /* select Entity legal form */
    await page.locator(SELECT_LEGAL_FORM).click();
    await page
      .locator('ion-alert, ion-popover')
      .getByRole('radio', { name: /Entity/i })
      .click();

    /* fill required office */
    await page.locator(SELECT_OFFICE).click();
    await page.locator(OPTION).first().click();

    /* submitted on / activation date already default to today; no interaction needed */

    /* entity shows fullname field instead of first/last */
    const fullname = page.locator('input[name="fullname"]');
    await expect(fullname).toBeVisible();
    await fullname.fill('Acme Corporation');

    await expect(page.getByRole('button', { name: BTN_SAVE })).toBeEnabled();
  });

  test('should cancel client creation and return to list', async ({ page }) => {
    await setupClientMocks(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL(URL_CLIENTS_CREATE);

    await page.getByRole('button', { name: BTN_CANCEL }).click();
    await expect(page).toHaveURL('/clients');
  });

  test('should disable office and legal form in edit mode', async ({ page }) => {
    /* mock a single client GET */
    await page.route(ROUTE_CLIENT_2001, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ACTIVE_CLIENT),
      });
    });
    await setupClientMocks(page, [ACTIVE_CLIENT]);

    /* navigate to client view then edit */
    await page.goto('/clients/edit/2001');
    /* ion-select's `disabled` prop has reflect:false in Ionic, so it never surfaces as an
       attribute/aria-disabled for toBeDisabled() to see; assert via its disabled CSS class instead */
    await expect(page.locator(SELECT_LEGAL_FORM)).toHaveClass(/select-disabled/);
    await expect(page.locator(SELECT_OFFICE)).toHaveClass(/select-disabled/);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   2. CLIENT VIEW & STATUS TRANSITIONS
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Client View & Status Transitions', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page);
  });

  test('should display client view with correct details', async ({ page }) => {
    await page.route(ROUTE_CLIENT_2001, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ACTIVE_CLIENT),
      });
    });
    await setupClientMocks(page, [ACTIVE_CLIENT]);

    await page.goto(URL_CLIENT_2001);
    await expect(page.locator('.breadcrumb')).toContainText('Clients');
    await expect(page.locator('.breadcrumb')).toContainText('Test User');
    await expect(page.locator('h2')).toContainText('Test User');
    await expect(page.getByText('#000000001')).toBeVisible();
  });

  test('should show actions menu for pending client (status 100)', async ({ page }) => {
    await page.route(ROUTE_CLIENT_2001, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(NEW_CLIENT),
      });
    });
    await page.goto(URL_CLIENT_2001);

    /* open actions menu */
    await page.getByRole('button', { name: /Actions/i }).click();
    await expect(page.getByRole('button', { name: /Activate/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reject/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Withdraw/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Delete/i })).toBeVisible();
  });

  test('should show actions menu for active client (status 300)', async ({ page }) => {
    await page.route(ROUTE_CLIENT_2001, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ACTIVE_CLIENT),
      });
    });
    await page.goto(URL_CLIENT_2001);

    await page.getByRole('button', { name: /Actions/i }).click();
    await expect(page.getByRole('button', { name: /Close Client/i })).toBeVisible();
  });

  test('should show actions menu for closed client (status 600)', async ({ page }) => {
    await page.route(ROUTE_CLIENT_2001, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CLOSED_CLIENT),
      });
    });
    await page.goto(URL_CLIENT_2001);

    await page.getByRole('button', { name: /Actions/i }).click();
    await expect(page.getByRole('button', { name: /Reactivate/i })).toBeVisible();
  });

  test('should show New Account menu for active client', async ({ page }) => {
    await page.route(ROUTE_CLIENT_2001, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ACTIVE_CLIENT),
      });
    });
    await page.goto(URL_CLIENT_2001);

    await page.getByRole('button', { name: /New Account/i }).click();
    await expect(page.getByRole('button', { name: /Loan Account/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Savings Account/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Fixed Deposit/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Recurring Deposit/i })).toBeVisible();
  });

  test('should navigate from client view to client list via breadcrumb', async ({ page }) => {
    await page.route(ROUTE_CLIENT_2001, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ACTIVE_CLIENT),
      });
    });
    await setupClientMocks(page, [ACTIVE_CLIENT]);

    await page.goto(URL_CLIENT_2001);
    await page.locator('.breadcrumb a').first().click();
    await expect(page).toHaveURL('/clients');
  });

  test('should navigate back from client view', async ({ page }) => {
    await page.route(ROUTE_CLIENT_2001, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ACTIVE_CLIENT),
      });
    });
    await page.goto(URL_CLIENT_2001);

    await page.getByRole('button', { name: /Back/i }).click();
    await expect(page).toHaveURL('/clients');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   3. CLIENT VIEW TABS
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Client View Tabs', () => {
  test('should display all expected tabs on client view', async ({ page }) => {
    await loginAndGoToDashboard(page);
    await page.route(ROUTE_CLIENT_2001, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ACTIVE_CLIENT),
      });
    });
    await page.route('**/api/v1/clientidentifiers**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.route('**/api/v1/clients/2001/addresses**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/clients/2001/familymembers**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/clients/2001/notes**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/clients/2001/documents**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto(URL_CLIENT_2001);

    /* verify tab labels */
    await expect(page.getByRole('tab', { name: /Details/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Identifiers/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Addresses/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Family Members/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Notes/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Documents/i })).toBeVisible();
  });

  test('should switch between client view tabs', async ({ page }) => {
    await loginAndGoToDashboard(page);
    await page.route(ROUTE_CLIENT_2001, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ACTIVE_CLIENT),
      });
    });
    await page.route('**/api/v1/clientidentifiers**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.route('**/api/v1/clients/2001/addresses**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/clients/2001/familymembers**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/clients/2001/notes**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/clients/2001/documents**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto(URL_CLIENT_2001);

    /* Details tab should be active by default */
    await expect(page.getByRole('tab', { name: /Details/i })).toHaveAttribute(
      ARIA_SELECTED,
      'true',
    );

    /* switch to Identifiers tab (force: Ionic's segment indicator overlay sits in the
       hit-test path of its own segment-button, tripping Playwright's actionability check) */
    await page.getByRole('tab', { name: /Identifiers/i }).click({ force: true });
    await expect(page.getByRole('tab', { name: /Identifiers/i })).toHaveAttribute(
      ARIA_SELECTED,
      'true',
    );

    /* switch to Notes tab */
    await page.getByRole('tab', { name: /Notes/i }).click({ force: true });
    await expect(page.getByRole('tab', { name: /Notes/i })).toHaveAttribute(ARIA_SELECTED, 'true');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   4. SEARCH & FILTER INTERACTIONS
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Search & Filter Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page);
  });

  test('should have search input on clients page and accept input', async ({ page }) => {
    await setupClientMocks(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    const searchInput = page.locator(SEARCH_INPUT_LOCATOR);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('test query');
    await expect(searchInput).toHaveValue('test query');
  });

  test('should have office filter on groups page', async ({ page }) => {
    await page.route('**/api/v1/groups*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_RESPONSE });
    });
    await page.getByRole('link', { name: 'Groups', exact: true }).click();

    /* verify office filter dropdown is present */
    const officeFilter = page.locator('ion-select').first();
    await expect(officeFilter).toBeVisible();

    /* open the dropdown and check options */
    await officeFilter.click();
    await expect(page.locator('ion-alert, ion-popover').getByRole('radio').first()).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('should have office filter on loans page', async ({ page }) => {
    await page.route('**/api/v1/loans**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_RESPONSE });
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
    await page.getByRole('link', { name: 'Loans', exact: true }).click();
    const searchInput = page.locator(SEARCH_INPUT_LOCATOR);
    await expect(searchInput).toBeVisible();
  });

  test('should have search input on charges page', async ({ page }) => {
    await page.route(ROUTE_CHARGES, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.getByRole('link', { name: 'Charges' }).click();
    const searchInput = page.locator(SEARCH_INPUT_LOCATOR);
    await expect(searchInput).toBeVisible();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   5. NAVIGATION FLOW VERIFICATION
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Navigation Flow Verification', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page);
  });

  test('should navigate full client lifecycle: list → create → back → list', async ({ page }) => {
    await setupClientMocks(page);
    await page.getByRole('link', { name: 'Clients' }).click();
    await expect(page).toHaveURL('/clients');

    /* go to create */
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL(URL_CLIENTS_CREATE);

    /* cancel should go back to list */
    await page.getByRole('button', { name: BTN_CANCEL }).click();
    await expect(page).toHaveURL('/clients');
  });

  test('should navigate from dashboard to all top-level pages via sidebar', async ({ page }) => {
    // Ten sequential navigations, each lazy-loading its own route chunk, against the default
    // 30s test budget — while a single toHaveURL is allowed 15s on its own. One slow chunk
    // under parallel load exhausts the test before the walk finishes, at whichever link
    // happens to be next. The work is genuinely ~10x a normal test, so the budget should be.
    test.slow();

    const navRoutes = [
      { link: 'Dashboard', expected: '/dashboard' },
      { link: 'Clients', expected: '/clients' },
      { link: 'Groups', expected: '/groups' },
      { link: 'Centers', expected: '/centers' },
      { link: 'Loans', expected: '/loans' },
      { link: 'Offices', expected: '/organization/offices' },
      { link: 'Users', expected: '/security/users' },
      { link: 'Roles', expected: '/security/roles' },
      { link: 'Reports', expected: '/reporting' },
      { link: 'Tellers', expected: '/tellers' },
      { link: 'Data Tables', expected: '/system/data-tables' },
    ];

    for (const route of navRoutes) {
      await page.getByRole('link', { name: route.link, exact: true }).click();
      await expect(page).toHaveURL(route.expected);
      /* verify we're still logged in - header should show user */
      await expect(page.getByText(TEST_USER)).toBeVisible();
    }
  });

  test('should go from loan products → create → back', async ({ page }) => {
    await page.route('**/api/v1/loanproducts**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.route('**/api/v1/currencies**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route(ROUTE_CHARGES, async (route) => {
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
    await page.route('**/api/v1/fineractEntity**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/adhocquery**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.getByRole('link', { name: 'Loan Products' }).first().click();
    await expect(page).toHaveURL('/products/loan');

    /* click create loan product */
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL('/products/loan/create');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Loan Product/i);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   6. OFFICE CRUD
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Office CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page);
  });

  test('should validate office create form — save disabled when empty', async ({ page }) => {
    await page.route(ROUTE_OFFICES, async (route) => {
      if (route.request().method() === 'POST') {
        const data = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ officeId: 10, resourceId: 10, name: data.name }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole('link', { name: 'Offices' }).click();
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL('/organization/offices/create');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Create Office/i);

    /* save disabled when required fields are empty */
    await expect(page.getByRole('button', { name: BTN_SAVE })).toBeDisabled();
  });

  test('should validate office create form — save enabled when filled', async ({ page }) => {
    await page.route(ROUTE_OFFICES, async (route) => {
      if (route.request().method() === 'POST') {
        const data = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ officeId: 10, resourceId: 10, name: data.name }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole('link', { name: 'Offices' }).click();
    await page.getByRole('button', { name: /Create/i }).click();

    /* fill required fields */
    await page.locator('input[name="name"]').fill('Branch Office');

    /* select parent office */
    await page.locator('ion-select[name="parentId"]').click();
    await page.locator(OPTION).first().click();

    /* opening date already defaults to today; no interaction needed */

    await expect(page.getByRole('button', { name: BTN_SAVE })).toBeEnabled();
  });

  test('should cancel office creation', async ({ page }) => {
    await page.route(ROUTE_OFFICES, async (route) => {
      await route.continue();
    });

    await page.getByRole('link', { name: 'Offices' }).click();
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL('/organization/offices/create');

    await page.getByRole('button', { name: BTN_CANCEL }).click();
    await expect(page).toHaveURL('/organization/offices');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   7. ORGANIZATION PAGES — CRUD BUTTONS & FORM FLOWS
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Organization Create Flows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page);
  });

  test('staff create form loads', async ({ page }) => {
    await page.route('**/api/v1/staff**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.route(ROUTE_OFFICES_WILDCARD, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: OFFICE_ARRAY });
    });

    await page.getByRole('link', { name: 'Staff' }).click();
    await expect(page).toHaveURL('/organization/staff');

    /* click create (ion-button[routerLink] renders as a link, not a button) */
    await page.getByRole('link', { name: /Create/i }).click();
    await expect(page).toHaveURL('/organization/staff/create');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Create Staff/i);
  });

  test('funds create form loads', async ({ page }) => {
    await page.route('**/api/v1/funds**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });

    await page.getByRole('link', { name: 'Funds' }).click();
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL('/organization/funds/create');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Create Fund/i);
  });

  test('payment types create form loads', async ({ page }) => {
    await page.route('**/api/v1/paymenttypes**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });

    await page.getByRole('link', { name: 'Payment Types' }).click();
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL('/organization/payment-types/create');
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Create Payment Type/i);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   8. ACCOUNTING CRUD
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Accounting CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page);
  });

  test('accounting closure create form loads', async ({ page }) => {
    await page.route('**/api/v1/accountingclosures**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.route(ROUTE_GLACCOUNTS, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.getByRole('link', { name: 'Accounting Closures' }).click();
    await page.getByRole('button', { name: /Close Period/i }).click();
    await expect(page).toHaveURL(/\/accounting\/closures\/create/);
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Close Accounting Period/i);
  });

  test('accounting rule create form loads', async ({ page }) => {
    await page.route('**/api/v1/accountingrules**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.route(ROUTE_GLACCOUNTS, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route(ROUTE_OFFICES_WILDCARD, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: OFFICE_ARRAY });
    });

    await page.getByRole('link', { name: 'Accounting Rules' }).click();
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL(/\/accounting\/rules\/create/);
    await expect(page.locator('h1').first()).toContainText(/Create Accounting Rule/i);
  });

  test('financial activity mapping create form loads', async ({ page }) => {
    await page.route('**/api/v1/mappingfinancialactivities**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.route(ROUTE_GLACCOUNTS, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.getByRole('link', { name: 'Financial Activity Mappings' }).click();
    await page.getByRole('button', { name: /Define Mapping/i }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /Define Financial Activity Mapping/i,
    );
  });

  test('charge create form loads', async ({ page }) => {
    await page.route(ROUTE_CHARGES, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });

    await page.getByRole('link', { name: 'Charges' }).click();
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL(/\/accounting\/charges\/create/);
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Create Charge/i);
  });

  test('chart of accounts create form loads', async ({ page }) => {
    await page.route(ROUTE_GLACCOUNTS, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });

    await page.getByRole('link', { name: 'Chart of Accounts' }).click();
    await page.getByRole('button', { name: /Add Ledger Account/i }).click();
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Create GL Account/i);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   9. SETTINGS CRUD
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Settings CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page);
  });

  test('global configurations page has editable toggle', async ({ page }) => {
    await page.route('**/api/v1/configurations**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          globalConfiguration: [
            {
              id: 1,
              name: 'maker-checker-for-loan',
              value: true,
              description: 'Enable maker-checker for loans',
            },
            {
              id: 2,
              name: 'maker-checker-for-savings',
              value: false,
              description: 'Enable maker-checker for savings',
            },
          ],
        }),
      });
    });

    await page.getByRole('link', { name: 'Global Configurations' }).click();
    await expect(page).toHaveURL('/settings/configurations');

    /* configurations should be listed */
    await expect(page.locator('table')).toContainText('maker-checker-for-loan');
  });

  test('holiday create form loads', async ({ page }) => {
    await page.route(ROUTE_OFFICES_WILDCARD, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: OFFICE_ARRAY });
    });
    await page.route('**/api/v1/holidays**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });

    await page.getByRole('link', { name: 'Holidays' }).click();
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL(/\/settings\/holidays\/create/);
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Create Holiday/i);
  });

  test('working days page has save button', async ({ page }) => {
    await page.route('**/api/v1/workingdays**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          recurrence: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR',
          repaymentRescheduleType: { id: 1 },
          extendTermForDailyRepayments: false,
          extendTermForRepaymentsOnHolidays: false,
        }),
      });
    });

    await page.getByRole('link', { name: 'Working Days' }).click();
    await expect(page).toHaveURL('/settings/working-days');
    await expect(page.getByRole('button', { name: /Save/i })).toBeVisible();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   10. SYSTEM — DATA TABLES & DELINQUENCY CRUD
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('System CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
  });

  test('data table create form loads', async ({ page }) => {
    await page.route('**/api/v1/datatables**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });

    await page.getByRole('link', { name: 'Data Tables' }).click();
    await page.getByRole('link', { name: /Create/i }).click();
    await expect(page).toHaveURL(/\/system\/data-tables\/create/);
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Create Data Table/i);
  });

  test('delinquency page has create buttons for ranges and buckets', async ({ page }) => {
    await page.route('**/api/v1/delinquency/ranges**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/v1/delinquency/buckets**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.getByRole('link', { name: 'Delinquency' }).click();
    await expect(page).toHaveURL('/system/delinquency');

    /* verify Create buttons are visible (ion-button[routerLink] renders as a link) */
    const createButtons = page.getByRole('link', { name: /Create/i });
    await expect(createButtons.first()).toBeVisible();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   11. SECURITY — ROLE & USER CRUD
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Security CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
  });

  test('role create form loads', async ({ page }) => {
    await page.route('**/api/v1/roles**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.route('**/api/v1/permissions**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.getByRole('link', { name: 'Roles' }).click();
    await page.getByRole('button', { name: /Create Role/i }).click();
    await expect(page).toHaveURL(/\/security\/roles\/create/);
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Create Role/i);
  });

  test('audit logs search form has date range', async ({ page }) => {
    await page.route('**/api/v1/audits**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_RESPONSE });
    });
    await page.route(ROUTE_OFFICES_WILDCARD, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: OFFICE_ARRAY });
    });

    await page.getByRole('link', { name: 'Audit Logs' }).click();
    await expect(page).toHaveURL('/security/audits');

    /* filters live in a collapsed accordion; expand it first */
    await page.getByText('Filters').click();

    /* verify date range inputs are present */
    await expect(page.getByText('Maker Date From')).toBeVisible();
    await expect(page.getByText('Maker Date To')).toBeVisible();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   12. REPORTING — RUN REPORT FLOW
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Reporting — Run Report Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page);
  });

  test('should navigate to report and verify report parameters', async ({ page }) => {
    await page.route('**/api/v1/reports**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            reportName: 'Active Clients Summary',
            reportType: 'Table',
            reportCategory: 'Client',
            useReport: true,
          },
        ]),
      });
    });
    await page.route('**/api/v1/runreports/Active%20Clients%20Summary**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          columnHeaders: [
            { columnName: 'Client ID', columnType: 'INTEGER' },
            { columnName: 'Display Name', columnType: 'VARCHAR' },
          ],
          data: [{ row: [101, 'Alice Smith'] }, { row: [102, 'Bob Jones'] }],
        }),
      });
    });
    await page.route('**/api/v1/runreports/FullParameterList**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              row: [
                'OfficeIdSelectOne',
                'officeId',
                'Office',
                'select',
                'number',
                '0',
                null,
                null,
                null,
              ],
            },
          ],
        }),
      });
    });
    await page.route('**/api/v1/runreports/OfficeIdSelectOne**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ row: [1, HEAD_OFFICE] }] }),
      });
    });

    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page).toHaveURL('/reporting');

    /* run the report */
    await page.getByRole('button', { name: 'Run' }).first().click();
    await expect(page).toHaveURL(/\/reporting\/run/);

    /* select office and run */
    await page.getByTestId('report-parameter-officeId').locator('ion-select').click();
    await page.locator('ion-alert, ion-popover').getByRole('radio', { name: HEAD_OFFICE }).click();
    await page.getByRole('button', { name: 'Run Report' }).click();

    /* verify results */
    await expect(page.locator('.results-header h3')).toContainText('Report Results');
    await expect(page.locator('table')).toContainText('Alice Smith');
    await expect(page.locator('table')).toContainText('Bob Jones');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   13. TELLER CRUD
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Teller CRUD', () => {
  test('teller create form loads', async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page);
    await page.route('**/api/v1/tellers**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_ARRAY });
    });
    await page.route('**/api/v1/staff**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.getByRole('link', { name: 'Tellers' }).click();
    await expect(page).toHaveURL('/tellers');

    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL(/\/tellers\/create/);
    await expect(page.locator(CARD_TITLE).first()).toContainText(/Create Teller/i);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════════
   14. HELPER: OFFICE CREATE DIALOG (from client form)
   ═══════════════════════════════════════════════════════════════════════════════ */

test.describe('Create Office Dialog from Client Form', () => {
  test('should open create office dialog from client create form', async ({ page }) => {
    await loginAndGoToDashboard(page);
    await mockOffices(page);
    await page.route('**/api/v1/clients?**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_RESPONSE });
    });
    await page.route('**/api/v1/clients', async (route) => {
      await route.continue();
    });

    await page.getByRole('link', { name: 'Clients' }).click();
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page).toHaveURL(URL_CLIENTS_CREATE);

    /* click the add office button (the + icon) */
    const addOfficeBtn = page.getByRole('button', { name: 'Add New Office' });
    await expect(addOfficeBtn).toBeVisible();
    await addOfficeBtn.click();

    /* verify dialog opens (exclude the ion-datetime-button's own auto-generated overlays) */
    const dialog = page.locator('ion-modal:not(.ion-datetime-button-overlay)');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Create Office/i);
  });
});
