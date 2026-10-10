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
 * Deposit and Withdraw appear only on an active savings account — #667.
 *
 * Both used to sit outside the state check that already guarded Close and the whole Actions menu
 * on the same screen, so an account awaiting approval offered a transaction form that could only
 * be refused:
 *
 *     POST /savingsaccounts/{id}/transactions?command=deposit
 *     400 error.msg.savingsaccount.transaction.account.is.not.active
 *          "Transaction is not allowed. Account is not active."
 *
 * Reproduced through the UI when the defect was found: the form accepted an amount and a payment
 * type and only rejected it on submit.
 */

import { test, expect, recordingTimeout } from './fixtures';
import { login } from './utils/fineract-login';
import {
  API_BASE,
  activateSavingsAccount,
  createApiContext,
  fineractDate,
  seedSubmittedSavingsAccount,
} from './utils/seed-api';

const DEPOSIT_BUTTON = 'savings-deposit-action';
const WITHDRAW_BUTTON = 'savings-withdraw-action';

test.describe('Savings transactions are offered only on an active account', () => {
  test('withheld while awaiting approval, offered once active', async ({ page }) => {
    test.setTimeout(recordingTimeout(180000));
    const api = await createApiContext();

    try {
      const { savingsId } = await seedSubmittedSavingsAccount(api, 'E2ESavingsGate');
      await login(page);

      await page.goto(`/products/savings-accounts/view/${savingsId}`);
      await expect(page.getByText('Submitted and pending approval')).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByTestId(DEPOSIT_BUTTON)).toHaveCount(0);
      await expect(page.getByTestId(WITHDRAW_BUTTON)).toHaveCount(0);
      // The control: the approval buttons are present, so the screen rendered and the gate is
      // what withheld the other two.
      await expect(page.getByRole('button', { name: /Approve Savings Account/i })).toBeVisible();

      await activateSavingsAccount(api, savingsId);
      await page.reload();
      await expect(page.getByText('Active', { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(DEPOSIT_BUTTON)).toBeVisible();
      await expect(page.getByTestId(WITHDRAW_BUTTON)).toBeVisible();
    } finally {
      await api.dispose();
    }
  });

  test('the platform refuses a deposit on an account awaiting approval', async () => {
    test.setTimeout(recordingTimeout(120000));
    const api = await createApiContext();

    try {
      const { savingsId } = await seedSubmittedSavingsAccount(api, 'E2ESavingsRule');

      // Through API_BASE: the seeding context deliberately has no baseURL, because a
      // leading-slash path would resolve against the origin and drop the API prefix.
      const response = await api.post(
        `${API_BASE}/savingsaccounts/${savingsId}/transactions?command=deposit`,
        {
          data: {
            transactionDate: fineractDate(),
            transactionAmount: 10,
            paymentTypeId: 1,
            dateFormat: 'dd MMMM yyyy',
            locale: 'en',
          },
        },
      );

      expect(response.status()).toBe(400);
      const body = (await response.json()) as {
        errors?: { userMessageGlobalisationCode?: string }[];
      };
      expect((body.errors ?? []).map((error) => error.userMessageGlobalisationCode)).toContain(
        'error.msg.savingsaccount.transaction.account.is.not.active',
      );
    } finally {
      await api.dispose();
    }
  });
});
