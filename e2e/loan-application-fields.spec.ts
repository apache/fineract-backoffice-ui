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
import { ionSelectValue } from './utils/ionic-locators';
import { selectOption } from './utils/select-option';

/**
 * The loan application fields the form never carried: #792.
 *
 * A loan could be booked but not attributed. There was nowhere to name the officer who owned it,
 * why the client was borrowing, which fund it was drawn against, or which savings account
 * repayments would come from, and the product's own charges were applied unseen.
 *
 * Mocked, so the option lists are fixed and the assertions are about the screen and the request
 * body. `loan-application-fields-backend.spec.ts` is the version that puts the same journey
 * through a running platform, where the charge due date stops being a nicety: a specified-due-date
 * charge submitted without one is refused outright.
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
  // Dashboard summaries are outside this journey; keep every request synthetic.
  await page.route(/\/api\/v1\/(clients|loans|savingsaccounts)\?/, (route) =>
    route.fulfill({ json: { pageItems: [], totalFilteredRecords: 0 } }),
  );

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
  principal: 1000,
  numberOfRepayments: 12,
  repaymentEvery: 1,
  repaymentFrequencyType: { id: 2 },
  interestRatePerPeriod: 10,
  interestType: { id: 0 },
  amortizationType: { id: 1 },
  interestCalculationPeriodType: { id: 1 },
  transactionProcessingStrategyCode: 'mifos-standard-strategy',
  // Only the ids; the names and default amounts come from the template's `chargeOptions`.
  charges: [{ id: 1, amount: 100 }],
};

/**
 * The option lists as a running platform answers them, field for field.
 *
 * Measured rather than read off the generated model, which declares none of these lists. The
 * label the screen reads differs per list, so a fixture that gave them all the same shape would
 * pass while the operator saw blanks.
 */
const template = {
  loanOfficerOptions: [
    { id: 1, displayName: 'Officer, Tpl', officeId: 1, isLoanOfficer: true, isActive: true },
    { id: 2, displayName: 'Officer, Second' },
  ],
  loanPurposeOptions: [{ id: 24, name: 'Working capital', active: true }],
  fundOptions: [{ id: 5, name: 'Rural credit line' }],
  accountLinkingOptions: [
    { id: 11, accountNo: '000000011', clientId: 7, productId: 1, productName: 'Passbook Savings' },
  ],
  chargeOptions: [
    {
      id: 1,
      name: 'Processing fee',
      amount: 100,
      penalty: false,
      chargeTimeType: { id: 1, code: 'chargeTimeType.disbursement', value: 'Disbursement' },
    },
    {
      id: 2,
      name: 'Annual service fee',
      amount: 75,
      penalty: false,
      chargeTimeType: {
        id: 2,
        code: 'chargeTimeType.specifiedDueDate',
        value: 'Specified due date',
      },
    },
  ],
};

async function routeReferenceData(page: Page, overrides: Partial<typeof template> = {}) {
  await page.route('**/api/v1/clients/7**', (route) =>
    route.fulfill({ json: { id: 7, displayName: 'Synthetic Client' } }),
  );
  await page.route('**/api/v1/loanproducts**', (route) =>
    route.fulfill({
      json: /\/loanproducts\/3(?:\?|$)/.test(route.request().url()) ? product : [product],
    }),
  );
  await page.route('**/api/v1/loans/template**', (route) =>
    route.fulfill({ json: { ...template, ...overrides } }),
  );
}

const save = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });
const chargeRow = (page: Page, chargeId: number) => page.getByTestId(`loan-charge-${chargeId}`);

async function submit(page: Page) {
  const request = page.waitForRequest(
    (r) => r.method() === 'POST' && /\/loans(?:\?|$)/.test(r.url()),
  );
  await save(page).click();
  return (await request).postDataJSON();
}

test.use({ video: 'on' });
test.describe('loan application fields', () => {
  test('the option lists wait for a product, then reach the request body', async ({
    page,
  }, testInfo) => {
    await signIn(page);
    await routeReferenceData(page);
    await page.route('**/api/v1/loans', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ json: { loanId: 9, resourceId: 9 } })
        : route.fallback(),
    );

    // A client is known from the URL, but the platform answers none of these lists without a
    // product, so the form says so rather than showing five empty selects.
    await page.goto('/loans/create?clientId=7');
    await expect(page.getByTestId('loan-options-hint')).toBeVisible();
    await expect(page.locator('ion-select[name="loanOfficerId"]')).toHaveCount(0);

    await selectOption(page, 'Loan Product', 'Synthetic Loan');
    await expect(page.getByTestId('loan-options-hint')).toHaveCount(0);

    // The product's own charge, named and priced from the template rather than left unseen.
    await expect(chargeRow(page, 1)).toContainText('Processing fee');
    await expect(chargeRow(page, 1)).toContainText('Disbursement');
    await expect(page.getByTestId('loan-charge-amount-1').locator('input')).toHaveValue('100');

    await selectOption(page, 'Loan Officer', 'Officer, Tpl');
    await selectOption(page, 'Loan Purpose', 'Working capital');
    await selectOption(page, 'Fund', 'Rural credit line');

    // The standing instruction is not offered until there is an account to pay from.
    await expect(page.getByTestId('loan-standing-instruction-checkbox')).toHaveCount(0);
    await selectOption(page, 'Linked Savings Account', '000000011 (Passbook Savings)');
    await page.getByTestId('loan-standing-instruction-checkbox').click();

    // Adjusted before submit: the amount overridden, and a second charge added.
    await page.getByTestId('loan-charge-amount-1').locator('input').fill('250');
    await selectOption(page, 'Add a charge', 'Annual service fee');
    await page.getByTestId('loan-charge-add-btn').click();
    await expect(chargeRow(page, 2)).toContainText('Annual service fee');

    // A specified-due-date charge holds Save until it is dated, and says which charge it is.
    await expect(save(page)).toBeDisabled();
    await expect(page.getByTestId('loan-submit-hint')).toContainText('Annual service fee');
    await page.getByTestId('loan-charge-due-date-2').locator('input').fill('2026-12-21');
    await expect(save(page)).toBeEnabled();

    await page.locator('.loan-form').screenshot({
      path: testInfo.outputPath('loan-application-fields.png'),
    });

    const body = await submit(page);
    expect(body).toMatchObject({
      clientId: 7,
      productId: 3,
      loanOfficerId: 1,
      loanPurposeId: 24,
      fundId: 5,
      linkAccountId: 11,
      createStandingInstructionAtDisbursement: true,
      charges: [
        { chargeId: 1, amount: 250 },
        { chargeId: 2, amount: 75, dueDate: '21 December 2026' },
      ],
    });
    await expect(page).toHaveURL(/\/loans\/view\/9$/);
  });

  /**
   * The Guide on this form, which the loans *list* tour used to answer.
   *
   * Its one anchored step points at `.filter-row`, so pressing Guide here outlined nothing --
   * and a target that resolves to nothing is invisible from the outside: the card still renders,
   * the counter still advances, and the only symptom is the missing outline. So this walks the
   * tour and insists every step after the opening card has put the highlight on something.
   *
   * Both states of the screen matter. The three optional sections appear only once a client and a
   * product are chosen, and before that there is a note where they will be, so the step that
   * describes them carries a grouped selector and has to resolve either way.
   */
  async function walkTheGuide(page: Page) {
    await page.locator('.tour-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Driven off the step counter rather than off the Next button. Next rewrites the card in
    // place, so reading the title straight after clicking can read the step just left -- which
    // it did, recording one step twice and dropping the last.
    const progress = page.locator('.guidance-card .progress-info');
    const total = Number(/of (\d+)/.exec((await progress.textContent()) ?? '')?.[1]);
    expect(total).toBeGreaterThan(1);

    const seen: string[] = [];
    for (let step = 1; step <= total; step++) {
      await expect(progress).toHaveText(`Step ${step} of ${total}`);
      seen.push((await page.locator('.guidance-card ion-card-title').textContent())?.trim() ?? '');
      if (step > 1) await expect(page.locator('.guidance-highlight')).not.toHaveCount(0);
      if (step < total) await page.getByRole('button', { name: 'Next' }).click();
    }
    await page.keyboard.press('Escape');
    return seen;
  }

  test('the Guide on this form points at the form, in both of its states', async ({ page }) => {
    await signIn(page);
    await routeReferenceData(page);

    await page.goto('/loans/create?clientId=7');
    // Before a product: the sections are not on screen, and the note that stands in for them is.
    await expect(page.getByTestId('loan-options-hint')).toBeVisible();
    const before = await walkTheGuide(page);
    expect(before[0]).toContain('Loan application');
    expect(before).toContain('Ownership, linkage and charges');

    await selectOption(page, 'Loan Product', 'Synthetic Loan');
    await expect(page.getByTestId('loan-options-hint')).toHaveCount(0);
    // After: the same step, now pointing at the sections themselves.
    expect(await walkTheGuide(page)).toEqual(before);
  });

  test('nothing left blank is sent, and a removed charge is not sent at all', async ({ page }) => {
    await signIn(page);
    await routeReferenceData(page, { accountLinkingOptions: [] });
    await page.route('**/api/v1/loans', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ json: { loanId: 9, resourceId: 9 } })
        : route.fallback(),
    );

    await page.goto('/loans/create?clientId=7');
    await selectOption(page, 'Loan Product', 'Synthetic Loan');

    // No account to link, so the form says that instead of offering an empty select.
    await expect(page.locator('ion-select[name="linkAccountId"]')).toHaveCount(0);
    await expect(page.getByTestId('loan-no-linkable-accounts')).toBeVisible();

    await page.getByTestId('loan-charge-remove-1').click();
    await expect(page.getByTestId('loan-no-charges')).toBeVisible();

    const body = await submit(page);
    for (const field of [
      'loanOfficerId',
      'loanPurposeId',
      'fundId',
      'linkAccountId',
      'createStandingInstructionAtDisbursement',
      // Not `charges: []`, which the platform reads as a list it should apply.
      'charges',
    ]) {
      expect(body, field).not.toHaveProperty(field);
    }
  });

  test('an existing application keeps what was saved and takes a reassignment', async ({
    page,
  }) => {
    await signIn(page);
    await routeReferenceData(page);
    await page.route('**/api/v1/loans/7**', (route) =>
      route.fulfill({
        json:
          route.request().method() === 'PUT'
            ? { loanId: 7 }
            : {
                ...product,
                id: 7,
                accountNo: 'SYNTHETIC7',
                clientId: 7,
                clientName: 'Synthetic Client',
                loanProductId: 3,
                termFrequency: 12,
                termPeriodFrequencyType: { id: 2 },
                status: { id: 100, value: 'Submitted' },
                loanOfficerId: 1,
                loanPurposeId: 24,
                fundId: 5,
                linkedAccount: { id: 11, accountNo: '000000011' },
                charges: [
                  {
                    chargeId: 1,
                    name: 'Processing fee',
                    amount: 180,
                    chargeTimeType: {
                      id: 1,
                      code: 'chargeTimeType.disbursement',
                      value: 'Disbursement',
                    },
                  },
                ],
                timeline: {
                  submittedOnDate: [2026, 4, 1],
                  expectedDisbursementDate: [2026, 4, 2],
                },
                summary: {},
              },
      }),
    );

    await page.goto('/loans/edit/7');

    // Saved values, shown as values and not as blanks waiting to be re-entered. Read off each
    // host's `value`: an ion-select's text is every option label concatenated, so asserting a
    // selection with toContainText passes whatever is chosen.
    expect(await ionSelectValue(page, 'Loan Officer')).toBe(1);
    expect(await ionSelectValue(page, 'Loan Purpose')).toBe(24);
    expect(await ionSelectValue(page, 'Fund')).toBe(5);
    expect(await ionSelectValue(page, 'Linked Savings Account')).toBe(11);
    // The loan's own charge amount, not the product's default.
    await expect(page.getByTestId('loan-charge-amount-1').locator('input')).toHaveValue('180');

    await selectOption(page, 'Loan Officer', 'Officer, Second');
    const update = page.waitForRequest(
      (r) => r.method() === 'PUT' && /\/loans\/7(?:\?|$)/.test(r.url()),
    );
    await save(page).click();
    expect((await update).postDataJSON()).toMatchObject({
      loanOfficerId: 2,
      loanPurposeId: 24,
      fundId: 5,
      linkAccountId: 11,
      charges: [{ chargeId: 1, amount: 180 }],
    });
    await expect(page).toHaveURL(/\/loans\/view\/7$/);
  });
});
