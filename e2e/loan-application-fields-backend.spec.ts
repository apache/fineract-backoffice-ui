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
 * The loan application fields of #792, driven through the UI against a real Fineract.
 *
 * `loan-application-fields.spec.ts` covers the same journey with the API mocked, which proves the
 * screen reads each option list by the right field and sends the right body. What a mock cannot
 * prove is that the platform answers those lists at all, or accepts what the form sends: the
 * option lists only appear on the loan template once a client **and** a product are both given,
 * and a charge's due date is a backend rule, not a nicety.
 *
 * So this spec seeds the reference data a stock Fineract ships without -- a loan officer, a fund,
 * a loan purpose, a charge, and an active savings account belonging to the same client -- drives
 * the screen, and reads the loan back from the platform.
 *
 * The due-date rule is the reason this file exists. Measured:
 *
 *     POST /loans  charges: [{ chargeId, amount }]
 *     403 error.msg.loanCharge.cannot.be.added.as.specified.due.date.outside.range
 *
 * naming the submission date, so the platform supplies no default of its own and the disbursement
 * date is itself outside the range it will accept. The last case here asserts that refusal
 * directly, so the form's gate is pinned to the platform rule it exists for rather than to a
 * belief about one.
 */

import { test, expect } from './fixtures';
import { login } from './utils/fineract-login';
import {
  API_BASE,
  createApiContext,
  ensureCodeValue,
  fineractDate,
  seedActiveSavingsAccountForClient,
  seedClient,
  seedFund,
  seedLoanCharge,
  seedLoanProduct,
  seedStaff,
} from './utils/seed-api';
import { ionSelectValue } from './utils/ionic-locators';
import { selectOption } from './utils/select-option';
import type { APIRequestContext } from '@playwright/test';

// Reference data once, then a client plus a UI journey per test.
test.describe.configure({ mode: 'serial', timeout: 240_000 });

let api: APIRequestContext;
let seeded: {
  productId: number;
  productName: string;
  chargeId: number;
  chargeName: string;
  staffId: number;
  staffName: string;
  fundId: number;
  fundName: string;
  purposeId: number;
  purposeName: string;
};

test.beforeAll(async () => {
  api = await createApiContext();
  const charge = await seedLoanCharge(api, 'E2E792', 100);
  const [product, staff, fund, purpose] = await Promise.all([
    // The product carries the charge, which is what puts it on an application unasked.
    seedLoanProduct(api, 'E2E792', false, [charge.chargeId]),
    seedStaff(api, 'E2E792Officer'),
    seedFund(api, 'E2E792 Fund'),
    // `LoanPurpose` ships with no values, so the field could never be filled on a stock tenant.
    ensureCodeValue(api, 'LoanPurpose', 'Working capital'),
  ]);
  seeded = {
    ...product,
    chargeId: charge.chargeId,
    chargeName: charge.name,
    ...staff,
    ...fund,
    purposeId: purpose.id,
    purposeName: purpose.name,
  };
});

test.afterAll(async () => {
  await api.dispose();
});

/** A client of the head office with an active savings account of their own. */
async function seedApplicant() {
  const client = await seedClient(api, 'E2E792');
  const savings = await seedActiveSavingsAccountForClient(api, client.clientId, 'E2E792');
  return { ...client, ...savings };
}

/** The loan as the platform holds it, which is the assertion that matters here. */
async function loanFromPlatform(loanId: number) {
  const response = await api.get(`${API_BASE}/loans/${loanId}?associations=charges,linkedAccount`);
  expect(response.ok(), `reading loan ${loanId} answered ${response.status()}`).toBe(true);
  return response.json() as Promise<{
    loanOfficerId?: number;
    loanPurposeId?: number;
    fundId?: number;
    linkedAccount?: { id?: number };
    charges?: { chargeId?: number; amount?: number; dueDate?: number[] }[];
  }>;
}

/** A date inside the schedule the seeded product produces: three monthly repayments. */
function dueDateInSchedule(): { iso: string; platform: string } {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
  return { iso, platform: fineractDate(date) };
}

test('every option list the platform answers reaches the loan it creates', async ({ page }) => {
  const applicant = await seedApplicant();
  await login(page);

  await page.goto(`/loans/create?clientId=${applicant.clientId}`);
  // The platform answers none of these lists without a product, so the form says so rather than
  // showing five selects it cannot fill.
  await expect(page.getByTestId('loan-options-hint')).toBeVisible();
  await selectOption(page, 'Loan Product', seeded.productName);
  await expect(page.getByTestId('loan-options-hint')).toHaveCount(0);

  // The product's charge, named and priced from the live template rather than applied unseen.
  const chargeRow = page.getByTestId(`loan-charge-${seeded.chargeId}`);
  await expect(chargeRow).toContainText(seeded.chargeName);
  await expect(
    page.getByTestId(`loan-charge-amount-${seeded.chargeId}`).locator('input'),
  ).toHaveValue('100');

  await selectOption(page, 'Loan Officer', seeded.staffName);
  await selectOption(page, 'Loan Purpose', seeded.purposeName);
  await selectOption(page, 'Fund', seeded.fundName);
  await selectOption(
    page,
    'Linked Savings Account',
    `${applicant.accountNo} (${applicant.productName})`,
  );
  await page.getByTestId('loan-standing-instruction-checkbox').click();

  // A specified-due-date charge holds Save until it is dated, and names the charge holding it.
  const due = dueDateInSchedule();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(page.getByTestId('loan-submit-hint')).toContainText(seeded.chargeName);
  await page.getByTestId(`loan-charge-amount-${seeded.chargeId}`).locator('input').fill('250');
  await page.getByTestId(`loan-charge-due-date-${seeded.chargeId}`).locator('input').fill(due.iso);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  // The platform accepted it. A rejection leaves the form in place with a toast, so landing on
  // the loan is itself the assertion that nothing was refused.
  await expect(page).toHaveURL(/\/loans\/view\/\d+$/);
  const loanId = Number(/\/loans\/view\/(\d+)$/.exec(page.url())?.[1]);

  const loan = await loanFromPlatform(loanId);
  expect(loan.loanOfficerId).toBe(seeded.staffId);
  expect(loan.loanPurposeId).toBe(seeded.purposeId);
  expect(loan.fundId).toBe(seeded.fundId);
  expect(loan.linkedAccount?.id).toBe(applicant.savingsId);
  expect(loan.charges).toHaveLength(1);
  expect(loan.charges?.[0]).toMatchObject({ chargeId: seeded.chargeId, amount: 250 });
});

test('an application with none of them set is accepted just the same', async ({ page }) => {
  const applicant = await seedApplicant();
  await login(page);

  await page.goto(`/loans/create?clientId=${applicant.clientId}`);
  await selectOption(page, 'Loan Product', seeded.productName);

  // Removing the only charge is what makes the form submittable without a due date, and proves
  // the omission the unit tests assert on is one the platform accepts: `charges` absent, not
  // `charges: []`.
  await page.getByTestId(`loan-charge-remove-${seeded.chargeId}`).click();
  await expect(page.getByTestId('loan-no-charges')).toBeVisible();

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/loans\/view\/\d+$/);
  const loanId = Number(/\/loans\/view\/(\d+)$/.exec(page.url())?.[1]);

  const loan = await loanFromPlatform(loanId);
  expect(loan.loanOfficerId ?? null).toBeNull();
  expect(loan.loanPurposeId ?? null).toBeNull();
  expect(loan.fundId ?? null).toBeNull();
  expect(loan.linkedAccount ?? null).toBeNull();
  expect(loan.charges ?? []).toHaveLength(0);
});

test('a submitted application keeps these values and takes a reassignment', async ({ page }) => {
  const applicant = await seedApplicant();
  const second = await seedStaff(api, 'E2E792Second');
  const due = dueDateInSchedule();
  await login(page);

  await page.goto(`/loans/create?clientId=${applicant.clientId}`);
  await selectOption(page, 'Loan Product', seeded.productName);
  await selectOption(page, 'Loan Officer', seeded.staffName);
  await selectOption(page, 'Loan Purpose', seeded.purposeName);
  await selectOption(page, 'Fund', seeded.fundName);
  await page.getByTestId(`loan-charge-due-date-${seeded.chargeId}`).locator('input').fill(due.iso);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/loans\/view\/\d+$/);
  const loanId = Number(/\/loans\/view\/(\d+)$/.exec(page.url())?.[1]);

  await page.goto(`/loans/edit/${loanId}`);
  // Read off each host's `value`: an ion-select's text is every option label concatenated, so
  // asserting a selection with toContainText would pass whatever is chosen.
  expect(await ionSelectValue(page, 'Loan Officer')).toBe(seeded.staffId);
  expect(await ionSelectValue(page, 'Loan Purpose')).toBe(seeded.purposeId);
  expect(await ionSelectValue(page, 'Fund')).toBe(seeded.fundId);
  // The saved due date comes back as a date, so an unchanged save is not refused for want of one.
  await expect(
    page.getByTestId(`loan-charge-due-date-${seeded.chargeId}`).locator('input'),
  ).toHaveValue(due.iso);

  await selectOption(page, 'Loan Officer', second.staffName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/loans/view/${loanId}$`));

  const loan = await loanFromPlatform(loanId);
  expect(loan.loanOfficerId).toBe(second.staffId);
  // Reassigning the officer did not clear what was not touched.
  expect(loan.loanPurposeId).toBe(seeded.purposeId);
  expect(loan.fundId).toBe(seeded.fundId);
});

test('the due-date gate backs a rule the platform enforces', async () => {
  const applicant = await seedApplicant();
  const due = dueDateInSchedule();
  const base = {
    clientId: applicant.clientId,
    productId: seeded.productId,
    loanType: 'individual',
    principal: 1000,
    loanTermFrequency: 3,
    loanTermFrequencyType: 2,
    numberOfRepayments: 3,
    repaymentEvery: 1,
    repaymentFrequencyType: 2,
    interestRatePerPeriod: 10,
    amortizationType: 1,
    interestType: 0,
    interestCalculationPeriodType: 1,
    transactionProcessingStrategyCode: 'mifos-standard-strategy',
    expectedDisbursementDate: fineractDate(),
    submittedOnDate: fineractDate(),
    locale: 'en',
    dateFormat: 'dd MMMM yyyy',
  };

  // Exactly what the form would send for a dated charge: accepted.
  const dated = await api.post(`${API_BASE}/loans`, {
    data: {
      ...base,
      charges: [{ chargeId: seeded.chargeId, amount: 250, dueDate: due.platform }],
    },
  });
  expect(dated.status(), await dated.text()).toBe(200);

  // The same charge with no date of its own: refused, which is why the form asks for one rather
  // than letting the operator find out after Save.
  const undated = await api.post(`${API_BASE}/loans`, {
    data: { ...base, charges: [{ chargeId: seeded.chargeId, amount: 250 }] },
  });
  expect(undated.status()).toBe(403);
  const body = (await undated.json()) as {
    errors?: { userMessageGlobalisationCode?: string }[];
  };
  expect(body.errors?.map((error) => error.userMessageGlobalisationCode)).toContain(
    'error.msg.loanCharge.cannot.be.added.as.specified.due.date.outside.range',
  );
});
