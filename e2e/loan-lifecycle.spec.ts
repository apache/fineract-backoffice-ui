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
 * Real-backend end-to-end coverage for the full loan lifecycle: client
 * creation, loan product creation, loan application creation, approval, and
 * disbursement — run once for a Cumulative product and once for a
 * Progressive product, since the schedule-generation code path differs
 * between the two once a loan is actually disbursed.
 *
 * Each test is fully self-contained — it creates its own client and product
 * through the UI, which is the point: this spec is the one that exercises
 * those forms end to end rather than seeding around them.
 *
 *   npm run test:e2e:local -- e2e/loan-lifecycle.spec.ts
 *
 * Runs against the local docker stack; see e2e/utils/backend-env.ts for how the
 * backend is chosen.
 *
 * Videos/traces for every run are written under test-results/.
 */

import { test, expect, Page, recordingTimeout } from './fixtures';
import { login, uniqueSuffix } from './utils/fineract-login';
import { ionSelect } from './utils/ionic-locators';
import { captureJson } from './utils/capture-response';
import { selectOption } from './utils/select-option';

test.use({ video: 'on', trace: 'on' });

async function createClient(page: Page): Promise<string> {
  const suffix = uniqueSuffix();
  const firstName = `E2ELife${suffix}`;
  const lastName = 'Tester';

  // Wait for network idle so the async GET /offices call backing the Office
  // dropdown has resolved before opening it — otherwise it opens empty.
  await page.goto('/clients/create', { waitUntil: 'networkidle' });
  await selectOption(page, 'Office', 'Head Office');
  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/clients$/, { timeout: 15000 });

  return `${firstName} ${lastName}`;
}

async function createLoanProduct(
  page: Page,
  scheduleType: 'Cumulative' | 'Progressive',
): Promise<string> {
  const suffix = uniqueSuffix();
  const productName = `E2E ${scheduleType} Lifecycle ${suffix}`;
  const shortName = suffix.slice(-4).toUpperCase();

  await page.goto('/products/loan/create');
  // Wait for the template-driven dropdowns to populate before touching them.
  // The template-driven dropdowns populate from an async GET /loanproducts/template.
  // Wait for the strategy select to carry a value rather than for one particular
  // strategy name: the default is whatever the instance lists first, so pinning the
  // name couples the test to the backend's option ordering.
  await expect(
    ionSelect(page, 'Repayment Strategy').locator('ion-select-option').first(),
  ).toBeAttached({ timeout: 15000 });

  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(productName);
  await page.getByRole('textbox', { name: 'Short Name' }).fill(shortName);
  await page.getByRole('spinbutton', { name: 'Principal' }).fill('1000');
  await page.getByRole('spinbutton', { name: 'Interest Rate' }).fill('10');
  await page.getByRole('spinbutton', { name: 'Number of Repayments' }).fill('3');
  await page.getByRole('spinbutton', { name: 'Repayment Every' }).fill('1');

  if (scheduleType === 'Progressive') {
    await selectOption(page, 'Loan Schedule Type', 'Progressive');
  }

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/products\/loan$/, { timeout: 15000 });

  return productName;
}

async function createLoanApplication(
  page: Page,
  clientName: string,
  productName: string,
): Promise<number> {
  // Wait for network idle so the async getLoanproducts() call backing the
  // Loan Product dropdown has resolved before opening it.
  await page.goto('/loans/create', { waitUntil: 'networkidle' });

  // Client search is a debounced autocomplete backed by GET /clients — type
  // enough of the unique first name to filter server-side to just our client.
  //
  // Retried because a just-created client is not always returned by the search
  // endpoint on the first call, and the failure lands on the option click,
  // which reads as "the dropdown is broken" rather than "the index lagged".
  const clientSearch = page.getByRole('textbox', { name: 'Client ID' });
  // Client search is app-client-search, not an ion-select: it renders its hits as
  // ion-items in an inline ion-list, so there is no overlay and no radio role.
  const clientOption = page
    .getByTestId('client-search-results')
    .locator('ion-item')
    .filter({ hasText: clientName });
  await expect(async () => {
    await clientSearch.fill('');
    await clientSearch.fill(clientName.split(' ')[0]);
    await expect(clientOption).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000, intervals: [1000, 2000, 3000] });
  await clientOption.click();

  await selectOption(page, 'Loan Product', productName);

  await page.getByRole('spinbutton', { name: 'Principal', exact: true }).fill('1000');
  await page.getByRole('spinbutton', { name: 'Term Frequency' }).fill('3');
  await selectOption(page, 'Term Type', 'Months');
  await page.getByRole('spinbutton', { name: 'Number of Repayments' }).fill('3');
  await page.getByRole('spinbutton', { name: 'Repayment Every' }).fill('1');
  await selectOption(page, 'Frequency', 'Months');
  await page.getByRole('spinbutton', { name: 'Interest Rate' }).fill('10');
  await selectOption(page, 'Interest Type', 'Declining Balance');
  await selectOption(page, 'Amortization Type', 'Equal Installments');
  await selectOption(page, 'Interest Calculation Period Type', 'Same as repayment period');

  // Capture the created loan's ID directly from the POST /loans response
  // rather than looking it up afterwards in the list — the list's search box
  // only filters by account number (a real gap: it's wired to the Fineract
  // `accountNo` query param, not a general search), and pagination makes
  // locating a specific row unreliable in a shared environment that
  // accumulates loans across test runs.
  const created = await captureJson<{ loanId: number }>(page, /\/loans$/, 'POST', () =>
    page.getByRole('button', { name: 'Save' }).click(),
  );
  await expect(page).toHaveURL(/\/loans$/, { timeout: 15000 });
  return created.loanId;
}

test.describe('Loan lifecycle: creation, approval, disbursement', () => {
  // See the comment in loan-schedule-type.spec.ts — these tests exercise a
  // real shared backend and are run serially to avoid overloading it when
  // multiple product/loan-creating suites run in the same pass.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const scheduleType of ['Cumulative', 'Progressive'] as const) {
    test(`create, approve, and disburse a ${scheduleType} loan`, async ({ page }) => {
      test.setTimeout(recordingTimeout(120000));

      const clientName = await createClient(page);
      const productName = await createLoanProduct(page, scheduleType);
      const loanId = await createLoanApplication(page, clientName, productName);

      // Drive the whole lifecycle from the loan's own view page rather than
      // the list — the list's search box only filters by account number (see
      // the comment in createLoanApplication), so it can't reliably locate a
      // specific row in a shared environment with accumulated test data.
      await page.goto(`/loans/view/${loanId}`);
      await expect(page.getByText('Submitted and pending approval')).toBeVisible({
        timeout: 15000,
      });

      // Approve. Approval/expected-disbursement dates default to today, so
      // the action form needs no field interaction beyond Save.
      await page.getByRole('button', { name: 'Approve' }).click();
      await expect(page).toHaveURL(/\/products\/loan\/\d+\/action\/approve$/);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page).toHaveURL(`/loans/view/${loanId}`, { timeout: 15000 });
      await expect(page.getByText('Approved', { exact: true })).toBeVisible({ timeout: 15000 });

      // Disburse. Transaction amount/date default from the loan template, so
      // again no field interaction is needed beyond Save. This form (unlike
      // the approve action form) redirects to the loans list rather than
      // back to the loan's view page, so navigate there explicitly after.
      await page.getByRole('button', { name: 'Disburse' }).click();
      await expect(page).toHaveURL(new RegExp(`/loans/${loanId}/transactions/disburse$`));
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page).toHaveURL(/\/loans$/, { timeout: 15000 });

      await page.goto(`/loans/view/${loanId}`);
      await expect(page.getByText('Active', { exact: true })).toBeVisible({ timeout: 15000 });
    });
  }

  /**
   * The one step of the lifecycle that had no way back until #266.
   *
   * Driven entirely through the screens, and deliberately stopping at approval rather than
   * reusing the seeded-loan helper: what is being tested is that the platform accepts the
   * command the screen sends, and a loan approved by an API call is not evidence that the
   * screen's approval can be undone.
   */
  test('an approved loan can be returned to pending approval', async ({ page }) => {
    test.setTimeout(recordingTimeout(120000));

    const clientName = await createClient(page);
    const productName = await createLoanProduct(page, 'Cumulative');
    const loanId = await createLoanApplication(page, clientName, productName);

    await page.goto(`/loans/view/${loanId}`);
    await page.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(`/loans/view/${loanId}`, { timeout: 15000 });
    await expect(page.getByText('Approved', { exact: true })).toBeVisible({ timeout: 15000 });

    await page.locator('#loanMenu-trigger').click();
    await page.getByTestId('loan-undo-approval-action').click();
    await page
      .locator('ion-textarea[data-testid="loan-undo-approval-note"] textarea')
      .fill('approved against the wrong client');
    await page.getByTestId('loan-undo-approval-confirm').click();

    // Back to pending, in place — the screen re-reads the loan rather than patching its own
    // copy, so this also proves the platform actually cleared the approval.
    await expect(page.getByText('Submitted and pending approval')).toBeVisible({ timeout: 20000 });

    // And it is offered again only while approved: now that it is pending, the item is gone
    // and Approve is back.
    await page.locator('#loanMenu-trigger').click();
    await expect(page.getByTestId('loan-undo-approval-action')).toHaveCount(0);
  });

  /**
   * The four tabs added in #266 against a live platform.
   *
   * A fresh database carries no term variations, overdue charges, originators or delinquency
   * tags, so this asserts what is actually true there: the delinquency tab is present and
   * readable, and the three data-only tabs are correctly absent. The data-carrying case is
   * covered in loan-servicing-gaps.spec.ts, where the response can be dictated.
   */
  test('the delinquency tab reads a real loan, and the empty data tabs stay hidden', async ({
    page,
  }) => {
    test.setTimeout(recordingTimeout(120000));

    const clientName = await createClient(page);
    const productName = await createLoanProduct(page, 'Cumulative');
    const loanId = await createLoanApplication(page, clientName, productName);

    await page.goto(`/loans/view/${loanId}`);
    await page.getByTestId('loan-tab-delinquency').click();

    // A loan nobody has missed a payment on: zero, rather than blank or an error.
    await expect(page.getByTestId('loan-past-due-days')).toHaveText('0', { timeout: 20000 });
    await expect(page.getByTestId('loan-delinquent-days')).toHaveText('0');

    await expect(page.getByTestId('loan-tab-term-variations')).toHaveCount(0);
    await expect(page.getByTestId('loan-tab-overdue-charges')).toHaveCount(0);
    await expect(page.getByTestId('loan-tab-originators')).toHaveCount(0);

    // Standing instructions are always offered — an empty list there is a real answer
    // ("nothing pays into this loan"), not a missing capability.
    await page.getByTestId('loan-tab-standing-instructions').click();
    await expect(page.getByTestId('data-table-error')).toHaveCount(0);
  });
});
