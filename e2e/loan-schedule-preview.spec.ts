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

import { expect, test, type Page } from './fixtures';
import { selectOption } from './utils/select-option';

/**
 * The schedule an officer could not see until the application existed: #791.
 *
 * Mocked, so the arithmetic is fixed and the assertions are about the screen, the request and the
 * stale state. `loan-schedule-preview-backend.spec.ts` is the version that proves the preview
 * matches the schedule the created loan actually gets.
 */
async function signIn(page: Page): Promise<void> {
  await page.route('**/config.json*', (route) =>
    route.fulfill({ json: { fineractApiUrl: '/api/v1', defaultTenant: 'default' } }),
  );
  await page.route('**/api/v1/authentication**', (route) =>
    route.fulfill({
      json: {
        username: 'mifos',
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: 'Head Office',
        permissions: ['ALL_FUNCTIONS'],
      },
    }),
  );
  await page.route('**/api/v1/configurations/name/enable-business-date**', (route) =>
    route.fulfill({ json: { name: 'enable-business-date', enabled: false } }),
  );
  await page.route('**/api/v1/businessdate**', (route) =>
    route.fulfill({ json: [{ type: 'BUSINESS_DATE', date: [2026, 9, 5] }] }),
  );
  await page.route(/\/api\/v1\/(clients|loans|savingsaccounts)\?/, (route) =>
    route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } }),
  );
  // The application template (#792). Answered here so nothing in this file reaches the network:
  // left unanswered it 502s and `retryInterceptor` re-sends it for seconds.
  await page.route('**/api/v1/loans/template**', (route) => route.fulfill({ json: {} }));

  await page.goto('/login');
  await page.locator('#tenantId').fill('default');
  await page.locator('#username').fill('mifos');
  await page.locator('#password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');
}

const product = {
  id: 3,
  name: 'Synthetic Loan',
  principal: 10000,
  numberOfRepayments: 6,
  repaymentEvery: 1,
  repaymentFrequencyType: { id: 2 },
  interestRatePerPeriod: 12,
  interestType: { id: 0 },
  amortizationType: { id: 1 },
  interestCalculationPeriodType: { id: 1 },
  transactionProcessingStrategyCode: 'mifos-standard-strategy',
};

/**
 * A schedule as the platform answers one.
 *
 * The first period is the disbursement: no `period` number, no dues. Two instalments follow, so
 * a correct screen shows two rows and says two instalments, not three.
 */
const schedule = (principal: number) => ({
  currency: { code: 'USD', displaySymbol: '$' },
  loanTermInDays: 180,
  totalPrincipalExpected: principal,
  totalInterestCharged: 2400,
  totalFeeChargesCharged: 0,
  totalPenaltyChargesCharged: 0,
  totalRepaymentExpected: principal + 2400,
  periods: [
    { dueDate: [2026, 11, 21], principalDisbursed: principal, totalDueForPeriod: 0 },
    {
      period: 1,
      dueDate: [2026, 12, 21],
      principalDue: principal / 2,
      interestDue: 1200,
      feeChargesDue: 0,
      penaltyChargesDue: 0,
      totalDueForPeriod: principal / 2 + 1200,
      principalLoanBalanceOutstanding: principal / 2,
    },
    {
      period: 2,
      dueDate: [2027, 1, 21],
      principalDue: principal / 2,
      interestDue: 1200,
      feeChargesDue: 0,
      penaltyChargesDue: 0,
      totalDueForPeriod: principal / 2 + 1200,
      principalLoanBalanceOutstanding: 0,
    },
  ],
});

/** Counts the create posts, so a preview that quietly created a loan would be caught. */
async function routeLoans(page: Page, created: { count: number }, calcStatus = 200) {
  await page.route(/\/api\/v1\/loans(\?|$)/, async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.fallback();
    const url = new URL(request.url());
    if (url.searchParams.get('command') === 'calculateLoanSchedule') {
      if (calcStatus !== 200) {
        return route.fulfill({
          status: calcStatus,
          json: {
            userMessageGlobalisationCode: 'validation.msg.domain.rule.violation',
            errors: [
              {
                parameterName: 'id',
                defaultUserMessage: 'EMI amount must be greater than the interest',
              },
            ],
          },
        });
      }
      const body = request.postDataJSON() as { principal?: number };
      return route.fulfill({ json: schedule(body.principal ?? 10000) });
    }
    created.count += 1;
    return route.fulfill({ json: { loanId: 9, resourceId: 9 } });
  });
}

const previewBtn = (page: Page) => page.getByTestId('loan-preview-btn');

/**
 * Whether the preview action is offered.
 *
 * `getByTestId` resolves the `ion-button` host, where `disabled` is not a native property --
 * Ionic disables the real button in the shadow root. So the disabled matcher never holds there
 * and the enabled one passes whatever the state is. `getByRole` would resolve the inner button.
 */
async function expectPreviewOffered(page: Page, offered: boolean): Promise<void> {
  await expect(previewBtn(page)).toBeVisible();
  if (offered) {
    await expect(previewBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
  } else {
    await expect(previewBtn(page)).toHaveAttribute('aria-disabled', 'true');
  }
}

async function openFormWithProduct(page: Page) {
  await page.goto('/loans/create?clientId=7');
  await page.route('**/api/v1/clients/7**', (route) =>
    route.fulfill({ json: { id: 7, displayName: 'Synthetic Client' } }),
  );
  await selectOption(page, 'Loan Product', 'Synthetic Loan');
  await expectPreviewOffered(page, true);
}

test.use({ video: 'on' });
test.describe('loan schedule preview', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.route('**/api/v1/loanproducts**', (route) =>
      route.fulfill({
        json: /\/loanproducts\/3(?:\?|$)/.test(route.request().url()) ? product : [product],
      }),
    );
  });

  test('calculates the schedule for the terms on screen without creating anything', async ({
    page,
  }, testInfo) => {
    const created = { count: 0 };
    await routeLoans(page, created);

    await page.goto('/loans/create?clientId=7');
    await page.route('**/api/v1/clients/7**', (route) =>
      route.fulfill({ json: { id: 7, displayName: 'Synthetic Client' } }),
    );
    // Before a product there are no terms to calculate from, and the platform would answer a
    // schedule of zeroes rather than an error, so the action says why it is out of reach.
    await expectPreviewOffered(page, false);
    await expect(page.getByTestId('loan-preview-hint')).toBeVisible();

    await selectOption(page, 'Loan Product', 'Synthetic Loan');
    await expectPreviewOffered(page, true);
    await expect(page.getByTestId('loan-preview-hint')).toHaveCount(0);

    const calculation = page.waitForRequest(
      (r) => r.method() === 'POST' && new URL(r.url()).searchParams.has('command'),
    );
    await previewBtn(page).click();
    expect((await calculation).postDataJSON()).toMatchObject({
      clientId: 7,
      productId: 3,
      principal: 10000,
      numberOfRepayments: 6,
    });

    await expect(page.getByTestId('loan-preview-schedule')).toBeVisible();
    // Two instalments, not three: the disbursement row is not an instalment.
    await expect(page.getByTestId('loan-preview-count')).toHaveText('2');
    await expect(page.getByTestId('loan-preview-period-1')).toContainText('21 December 2026');
    await expect(page.getByTestId('loan-preview-period-1')).toContainText('6,200.00');
    await expect(page.getByTestId('loan-preview-period-2')).toBeVisible();
    await expect(page.getByTestId('loan-preview-interest')).toContainText('2,400.00');
    await expect(page.getByTestId('loan-preview-repayable')).toContainText('12,400.00');

    await page.getByTestId('loan-preview-summary').screenshot({
      path: testInfo.outputPath('schedule-preview-summary.png'),
    });

    // Previewing is not creating.
    expect(created.count).toBe(0);
    await expect(page).toHaveURL(/\/loans\/create/);
  });

  test('marks the schedule stale when a term changes, and recalculates on demand', async ({
    page,
  }) => {
    const created = { count: 0 };
    await routeLoans(page, created);
    await openFormWithProduct(page);

    await previewBtn(page).click();
    await expect(page.getByTestId('loan-preview-schedule')).toBeVisible();
    await expect(page.getByTestId('loan-preview-stale')).toHaveCount(0);

    await page.locator('ion-input[name="principal"]').locator('input').fill('20000');
    // The schedule stays on screen -- it is still the last true answer -- but it is labelled,
    // and the action renames itself.
    await expect(page.getByTestId('loan-preview-stale')).toBeVisible();
    await expect(page.getByTestId('loan-preview-schedule')).toBeVisible();
    await expect(previewBtn(page)).toContainText('Recalculate');

    await previewBtn(page).click();
    await expect(page.getByTestId('loan-preview-stale')).toHaveCount(0);
    await expect(page.getByTestId('loan-preview-repayable')).toContainText('22,400.00');
    expect(created.count).toBe(0);
  });

  test('a refused calculation keeps every entered value and repeats what the platform said', async ({
    page,
  }) => {
    const created = { count: 0 };
    await routeLoans(page, created, 403);
    await openFormWithProduct(page);

    await page.locator('ion-input[name="numberOfRepayments"]').locator('input').fill('4');
    await previewBtn(page).click();

    await expect(page.getByTestId('loan-preview-error')).toContainText(
      'EMI amount must be greater than the interest',
    );
    await expect(page.getByTestId('loan-preview-schedule')).toHaveCount(0);
    // The application is still there to be corrected, not retyped.
    await expect(page.locator('ion-input[name="principal"]').locator('input')).toHaveValue('10000');
    await expect(page.locator('ion-input[name="numberOfRepayments"]').locator('input')).toHaveValue(
      '4',
    );
    expect(created.count).toBe(0);
  });

  test('Save still creates the loan after a preview', async ({ page }) => {
    const created = { count: 0 };
    await routeLoans(page, created);
    await page.route('**/api/v1/loans/9**', (route) =>
      route.fulfill({
        json: {
          ...product,
          id: 9,
          clientId: 7,
          status: { id: 100, value: 'Submitted' },
          timeline: {},
          summary: {},
        },
      }),
    );
    await openFormWithProduct(page);

    await previewBtn(page).click();
    await expect(page.getByTestId('loan-preview-schedule')).toBeVisible();

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page).toHaveURL(/\/loans\/view\/9$/);
    expect(created.count).toBe(1);
  });
});
