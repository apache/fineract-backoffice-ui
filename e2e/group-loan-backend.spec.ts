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
 * Issue #767. A loan owned by a group, applied for from the group and approved, all through the
 * screens and against a real Fineract: the form names the group in place of a client, and the
 * loan list and loan header show the group rather than an empty client.
 */
import { test, expect } from './fixtures';
import { login } from './utils/fineract-login';
import {
  API_BASE,
  activateGroup,
  createApiContext,
  seedGroup,
  seedLoanProduct,
} from './utils/seed-api';
import { selectOption } from './utils/select-option';
import type { APIRequestContext } from '@playwright/test';

test.describe.configure({ mode: 'serial', timeout: 240_000 });

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await createApiContext();
});

test.afterAll(async () => {
  await api.dispose();
});

test('a group applies for a loan from its own record, and the loan is approved', async ({
  page,
}) => {
  const [group, product] = await Promise.all([
    seedGroup(api, 'E2E767Group'),
    seedLoanProduct(api, 'E2E767'),
  ]);
  await activateGroup(api, group.groupId);
  await login(page);

  await page.goto(`/groups/view/${group.groupId}`);
  await page.getByTestId('group-tab-accounts').click();
  await page.getByTestId('group-create-loan').click();

  await expect(page).toHaveURL(new RegExp(`/loans/create\\?groupId=${group.groupId}$`));
  await expect(page.getByTestId('loan-owning-group').locator('input')).toHaveValue(group.groupName);
  await selectOption(page, 'Loan Product', product.productName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // Landing on the loan is the assertion that the platform took the application.
  await expect(page).toHaveURL(/\/loans\/view\/\d+$/);
  const loanId = Number(/\/loans\/view\/(\d+)$/.exec(page.url())?.[1]);
  const response = await api.get(`${API_BASE}/loans/${loanId}`);
  const loan = (await response.json()) as {
    clientId?: number | null;
    group?: { id?: number };
    loanType?: { code?: string };
  };
  expect(loan.loanType?.code).toBe('accountType.group');
  expect(loan.group?.id).toBe(group.groupId);
  expect(loan.clientId ?? null).toBeNull();

  // The header names the group, where it used to read "Client:" with nothing after it.
  await expect(page.getByTestId('loan-group-link')).toContainText(group.groupName);

  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page).toHaveURL(/\/products\/loan\/\d+\/action\/approve$/);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(`/loans/view/${loanId}`, { timeout: 15_000 });
  await expect(page.getByText('Approved', { exact: true })).toBeVisible({ timeout: 15_000 });

  // The group's accounts list it, and so does the loan list, by the group's name.
  const accountNo = (
    (await (await api.get(`${API_BASE}/loans/${loanId}`)).json()) as {
      accountNo: string;
    }
  ).accountNo;
  await page.goto('/loans');
  await page.locator('app-search-filter input').fill(accountNo);
  const groupCell = page.getByTestId('loan-group-link').filter({ hasText: group.groupName });
  await expect(groupCell).toHaveAttribute('href', `/groups/view/${group.groupId}`);
});
