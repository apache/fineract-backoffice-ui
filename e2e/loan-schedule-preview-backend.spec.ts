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
 * The schedule preview of #791, against a real Fineract.
 *
 * `loan-schedule-preview.spec.ts` covers the screen and the request with the API mocked. What a
 * mock cannot prove is the one thing the issue actually promises: that the preview is **exact**,
 * that the instalments an officer reads before saving are the instalments the created loan gets.
 * So this calculates a schedule through the form, saves the application, reads the loan's own
 * repayment schedule back from the platform, and compares them row by row.
 *
 * It also pins the two behaviours that made the feature need care, both measured here rather
 * than assumed:
 *
 *   - asked with a term missing, the calculation answers **200 and a schedule of zeroes** rather
 *     than an error, so a preview offered too early would show an officer a meaningless answer;
 *   - the first period of a calculated schedule is the **disbursement**, not an instalment, so
 *     six repayments come back as seven rows.
 */

import { test, expect, type Page } from './fixtures';
import { login } from './utils/fineract-login';
import {
  API_BASE,
  createApiContext,
  fineractDate,
  seedClient,
  seedLoanProduct,
} from './utils/seed-api';
import { selectOption } from './utils/select-option';
import type { APIRequestContext } from '@playwright/test';

test.describe.configure({ mode: 'serial', timeout: 240_000 });

let api: APIRequestContext;
let product: { productId: number; productName: string };

test.beforeAll(async () => {
  api = await createApiContext();
  product = await seedLoanProduct(api, 'E2E791');
});

test.afterAll(async () => {
  await api.dispose();
});

interface SchedulePeriod {
  period?: number;
  dueDate?: number[];
  principalDue?: number;
  interestDue?: number;
  totalDueForPeriod?: number;
}

/** The instalments of a schedule, which is every row the platform gave a period number. */
const instalmentsOf = (periods: SchedulePeriod[] = []) =>
  periods.filter((period) => period.period !== undefined);

/** A row reduced to the figures an officer compares. */
const comparable = (period: SchedulePeriod) => ({
  period: period.period,
  dueDate: period.dueDate,
  principalDue: period.principalDue,
  interestDue: period.interestDue,
  totalDueForPeriod: period.totalDueForPeriod,
});

/**
 * Presses Preview once the form will act on it. The action refuses while a required term is
 * empty, and a product's defaults reach the controls a cycle after its fetch resolves.
 *
 * Read off `aria-disabled`: the test id is on the `ion-button` host, and Ionic renders the real
 * button in its shadow root, so the enabled matcher passes there whatever the state is.
 */
async function pressPreview(page: Page): Promise<void> {
  const button = page.getByTestId('loan-preview-btn');
  await expect(button).not.toHaveAttribute('aria-disabled', 'true', { timeout: 20_000 });
  await button.click();
}

test('the calculation answers zeroes rather than an error for incomplete terms', async () => {
  const client = await seedClient(api, 'E2E791');
  const terms = {
    clientId: client.clientId,
    productId: product.productId,
    loanType: 'individual',
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

  // No principal. This is the reason the form gates the action on its own required-field
  // summary: the platform does not refuse the request, it answers a schedule of nothing.
  const response = await api.post(`${API_BASE}/loans?command=calculateLoanSchedule`, {
    data: terms,
  });
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as {
    periods?: SchedulePeriod[];
    totalRepaymentExpected?: number;
    loanTermInDays?: number;
  };
  expect(body.totalRepaymentExpected).toBe(0);
  expect(body.loanTermInDays).toBe(0);
  expect(instalmentsOf(body.periods)).toHaveLength(0);
});

test('the previewed instalments are the ones the created loan gets', async ({ page }) => {
  const client = await seedClient(api, 'E2E791');
  await login(page);

  await page.goto(`/loans/create?clientId=${client.clientId}`);
  await selectOption(page, 'Loan Product', product.productName);

  // Capture what the platform calculated, as the officer sees it.
  const calculation = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).searchParams.get('command') === 'calculateLoanSchedule',
    { timeout: 30_000 },
  );
  await pressPreview(page);
  const previewed = (await (await calculation).json()) as {
    periods?: SchedulePeriod[];
    totalInterestCharged?: number;
    totalRepaymentExpected?: number;
  };
  const previewedInstalments = instalmentsOf(previewed.periods);

  // The product seeds three repayments, and the platform adds a disbursement row in front.
  expect(previewedInstalments).toHaveLength(3);
  expect(previewed.periods).toHaveLength(4);
  await expect(page.getByTestId('loan-preview-count')).toHaveText('3');
  await expect(page.getByTestId('loan-preview-schedule')).toBeVisible();
  // What is drawn is what came back, for every row.
  for (const instalment of previewedInstalments) {
    await expect(page.getByTestId(`loan-preview-period-${instalment.period}`)).toBeVisible();
  }

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/loans\/view\/\d+$/);
  const loanId = Number(/\/loans\/view\/(\d+)$/.exec(page.url())?.[1]);

  const saved = await api.get(`${API_BASE}/loans/${loanId}?associations=repaymentSchedule`);
  expect(saved.ok(), `reading loan ${loanId} answered ${saved.status()}`).toBe(true);
  const loan = (await saved.json()) as {
    repaymentSchedule?: { periods?: SchedulePeriod[]; totalRepaymentExpected?: number };
  };
  const savedInstalments = instalmentsOf(loan.repaymentSchedule?.periods);

  // The promise the issue makes: the preview was exact.
  expect(savedInstalments.map(comparable)).toEqual(previewedInstalments.map(comparable));
  expect(loan.repaymentSchedule?.totalRepaymentExpected).toBe(previewed.totalRepaymentExpected);
});

test('a preview creates nothing, so the client has no loans until Save', async ({ page }) => {
  const client = await seedClient(api, 'E2E791');
  await login(page);

  await page.goto(`/loans/create?clientId=${client.clientId}`);
  await selectOption(page, 'Loan Product', product.productName);
  await pressPreview(page);
  await expect(page.getByTestId('loan-preview-schedule')).toBeVisible();

  // Previewing twice, with a term changed in between, must still create nothing.
  await page.locator('ion-input[name="principal"]').locator('input').fill('2000');
  await expect(page.getByTestId('loan-preview-stale')).toBeVisible();
  await pressPreview(page);
  await expect(page.getByTestId('loan-preview-stale')).toHaveCount(0);

  const accounts = await api.get(`${API_BASE}/clients/${client.clientId}/accounts`);
  expect(accounts.ok()).toBe(true);
  const body = (await accounts.json()) as { loanAccounts?: unknown[] };
  expect(body.loanAccounts ?? []).toHaveLength(0);
  // Still on the form, with the schedule for the new principal.
  await expect(page).toHaveURL(/\/loans\/create/);
  await expect(page.getByTestId('loan-preview-schedule')).toBeVisible();
});
