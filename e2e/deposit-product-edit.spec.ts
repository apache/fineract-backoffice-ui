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
 * Saving an edit to a deposit product must send back what the product already has.
 *
 * The edit path used to read a handful of fields and then submit its own defaults: a fabricated
 * deposit amount, accounting rule NONE, and an invented interest chart. Changing a product's name
 * and saving it therefore reset its deposit amount, removed its GL configuration and rewrote its
 * rates. The rendered form looks the same either way, so these assertions are on the PUT body.
 *
 * Mocked, so it runs in the fast CI project. The real-platform counterpart is
 * deposit-product-configuration.spec.ts.
 */

import type { Route } from '@playwright/test';
import { test, expect, Page } from './fixtures';

const TENANT = 'default';
const USER = 'mifos';
const PASSWORD = 'password';

const FIXED_ID = 7;
const RECURRING_ID = 9;

const CASH_BASED = { id: 2, code: 'accountingRuleType.cash.based', value: 'Cash based' };

const ACCOUNTING_MAPPINGS = {
  savingsReferenceAccount: { id: 11, name: 'Fund source' },
  savingsControlAccount: { id: 21, name: 'Savings control' },
  transfersInSuspenseAccount: { id: 22, name: 'Transfers in suspense' },
  interestOnSavingsAccount: { id: 41, name: 'Interest on deposits' },
  incomeFromFeeAccount: { id: 31, name: 'Fee income' },
  incomeFromPenaltyAccount: { id: 32, name: 'Penalty income' },
};

const ACCOUNTING_MAPPING_OPTIONS = {
  assetAccountOptions: [{ id: 11, name: 'Fund source', glCode: '1100' }],
  liabilityAccountOptions: [
    { id: 21, name: 'Savings control', glCode: '2100' },
    { id: 22, name: 'Transfers in suspense', glCode: '2200' },
  ],
  incomeAccountOptions: [
    { id: 31, name: 'Fee income', glCode: '4100' },
    { id: 32, name: 'Penalty income', glCode: '4200' },
  ],
  expenseAccountOptions: [{ id: 41, name: 'Interest on deposits', glCode: '5100' }],
};

const CURRENCY = { code: 'USD', name: 'US Dollar', decimalPlaces: 2, inMultiplesOf: 1 };

/** The rate chart the platform already holds for each product, ids and all. */
const FIXED_CHART = {
  id: 77,
  chartSlabs: [
    {
      id: 701,
      periodType: { id: 2, value: 'Months' },
      fromPeriod: 1,
      toPeriod: 12,
      annualInterestRate: 4.5,
      description: 'Year one',
      locale: 'en',
    },
  ],
};

const RECURRING_CHART = {
  id: 88,
  chartSlabs: [
    {
      id: 801,
      periodType: { id: 2, value: 'Months' },
      fromPeriod: 1,
      toPeriod: 24,
      annualInterestRate: 6,
      description: 'Two years',
      locale: 'en',
    },
  ],
};

const FIXED_PRODUCT = {
  id: FIXED_ID,
  name: 'Fixed Gold',
  shortName: 'FXG1',
  description: 'Seeded for the mocked e2e suite',
  currency: CURRENCY,
  depositAmount: 5000,
  minDepositTerm: 6,
  minDepositTermType: { id: 2, value: 'Months' },
  maxDepositTerm: 24,
  maxDepositTermType: { id: 2, value: 'Months' },
  interestCompoundingPeriodType: { id: 4, value: 'Monthly' },
  interestPostingPeriodType: { id: 4, value: 'Monthly' },
  interestCalculationType: { id: 1, value: 'Daily' },
  interestCalculationDaysInYearType: { id: 365, value: '365 Days' },
  preClosurePenalApplicable: false,
  accountingRule: CASH_BASED,
  accountingMappings: ACCOUNTING_MAPPINGS,
  activeChart: FIXED_CHART,
};

const RECURRING_PRODUCT = {
  id: RECURRING_ID,
  name: 'Recurring Silver',
  shortName: 'RSL1',
  description: 'Seeded for the mocked e2e suite',
  currency: CURRENCY,
  depositAmount: 250,
  recurringDepositFrequency: 1,
  recurringDepositFrequencyType: { id: 2, value: 'Months' },
  minDepositTerm: 12,
  minDepositTermType: { id: 2, value: 'Months' },
  interestCompoundingPeriodType: { id: 4, value: 'Monthly' },
  interestPostingPeriodType: { id: 4, value: 'Monthly' },
  interestCalculationType: { id: 1, value: 'Daily' },
  interestCalculationDaysInYearType: { id: 365, value: '365 Days' },
  preClosurePenalApplicable: false,
  accountingRule: CASH_BASED,
  accountingMappings: ACCOUNTING_MAPPINGS,
  activeChart: RECURRING_CHART,
};

/** The request bodies the two update endpoints received, captured in Node. */
interface Captured {
  fixed: Record<string, unknown> | null;
  recurring: Record<string, unknown> | null;
}

async function login(page: Page): Promise<Captured> {
  const captured: Captured = { fixed: null, recurring: null };

  await page.route('**/config.json*', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fineractApiUrl: '/api/v1', defaultTenant: TENANT }),
    }),
  );

  await page.route('**/api/v1/authentication**', (r) =>
    r.fulfill({
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
    }),
  );

  const templateBody = JSON.stringify({
    currencyOptions: [CURRENCY],
    accountingRuleOptions: [
      { id: 1, code: 'accountingRuleType.none', value: 'None' },
      CASH_BASED,
      { id: 3, code: 'accountingRuleType.accrual.periodic', value: 'Accrual (periodic)' },
    ],
    accountingMappingOptions: ACCOUNTING_MAPPING_OPTIONS,
  });

  await page.route('**/api/v1/fixeddepositproducts/template', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: templateBody }),
  );
  await page.route('**/api/v1/recurringdepositproducts/template', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: templateBody }),
  );

  // Each product answers GET with the configured product and captures the PUT it receives.
  const serve = (
    product: Record<string, unknown>,
    key: keyof Captured,
  ): ((route: Route) => Promise<void>) => {
    return async (route) => {
      if (route.request().method() === 'PUT') {
        captured[key] = JSON.parse(route.request().postData() ?? '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ resourceId: product['id'] }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(product),
      });
    };
  };

  await page.route(`**/api/v1/fixeddepositproducts/${FIXED_ID}`, serve(FIXED_PRODUCT, 'fixed'));
  await page.route(
    `**/api/v1/recurringdepositproducts/${RECURRING_ID}`,
    serve(RECURRING_PRODUCT, 'recurring'),
  );
  // The list screen the form returns to after a save.
  await page.route(/\/api\/v1\/(fixed|recurring)depositproducts(\?|$)/, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT);
  await page.locator('#username').fill(USER);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');

  return captured;
}

test.describe('Editing a deposit product keeps what it was not asked to change', () => {
  test('a fixed deposit product keeps its deposit amount, accounting and rate chart on save', async ({
    page,
  }) => {
    const captured = await login(page);
    await page.goto(`/products/fixed/edit/${FIXED_ID}`);

    const name = page.locator('input[name="name"]');
    await expect(name).toHaveValue('Fixed Gold');
    await name.fill('Fixed Gold v2');
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect.poll(() => captured.fixed).not.toBeNull();
    expect(captured.fixed).toMatchObject({
      name: 'Fixed Gold v2',
      depositAmount: 5000,
      accountingRule: 2,
      savingsReferenceAccountId: 11,
      savingsControlAccountId: 21,
      transfersInSuspenseAccountId: 22,
      interestOnSavingsAccountId: 41,
      incomeFromFeeAccountId: 31,
      incomeFromPenaltyAccountId: 32,
      charts: [{ id: 77, chartSlabs: [{ id: 701, annualInterestRate: 4.5 }] }],
    });
  });

  test('a recurring deposit product keeps its deposit amount, accounting and rate chart on save', async ({
    page,
  }) => {
    const captured = await login(page);
    await page.goto(`/products/recurring/edit/${RECURRING_ID}`);

    const name = page.locator('input[name="name"]');
    await expect(name).toHaveValue('Recurring Silver');
    await name.fill('Recurring Silver v2');
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect.poll(() => captured.recurring).not.toBeNull();
    expect(captured.recurring).toMatchObject({
      name: 'Recurring Silver v2',
      depositAmount: 250,
      recurringFrequency: 1,
      recurringFrequencyType: 2,
      accountingRule: 2,
      savingsReferenceAccountId: 11,
      savingsControlAccountId: 21,
      transfersInSuspenseAccountId: 22,
      interestOnSavingsAccountId: 41,
      incomeFromFeeAccountId: 31,
      incomeFromPenaltyAccountId: 32,
      charts: [{ id: 88, chartSlabs: [{ id: 801, annualInterestRate: 6 }] }],
    });
  });
});
