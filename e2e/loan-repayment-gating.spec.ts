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
 * The Repayment button appears only in the states the platform will accept a repayment in — #667.
 *
 * The button used to sit outside every state check, while Approve and Disburse beside it were
 * already guarded, so a loan awaiting approval offered a full transaction form that could only be
 * refused on submit:
 *
 *     POST /loans/{id}/transactions?command=repayment
 *     400 error.msg.loan.must.be.active.fully.paid.or.overpaid
 *          "Loan must be Active, Fully Paid or Overpaid"
 *
 * The unit tests pin the three accepted states against a stubbed loan. This pins the same rule
 * against the platform that defines it, and walks one loan through the transition so a regression
 * cannot pass by hiding the button everywhere.
 *
 * The refusal above is asserted directly as well. Without it the spec would still pass if the
 * platform one day started accepting repayments on a pending loan — the gate would then be wrong
 * rather than right, and nothing here would notice.
 */

import { test, expect, recordingTimeout } from './fixtures';
import { login } from './utils/fineract-login';
import {
  API_BASE,
  approveLoan,
  createApiContext,
  disburseLoan,
  fineractDate,
  seedSubmittedLoan,
} from './utils/seed-api';

const REPAYMENT_BUTTON = 'loan-repayment-action';

test.describe('Repayment is offered only where the platform allows it', () => {
  test('withheld on a loan awaiting approval, offered once it is active', async ({ page }) => {
    test.setTimeout(recordingTimeout(180000));
    const api = await createApiContext();

    try {
      const { loanId } = await seedSubmittedLoan(api, 'E2ERepayGate');
      await login(page);

      // 1. Submitted and pending approval — no repayment on offer.
      await page.goto(`/loans/view/${loanId}`);
      await expect(page.getByText('Submitted and pending approval')).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByTestId(REPAYMENT_BUTTON)).toHaveCount(0);
      // The neighbours are the control: this is the gate working, not the screen failing to load.
      await expect(page.getByTestId('loan-approve-action')).toBeVisible();

      // 2. Approved, awaiting disbursal — still no repayment, because there is no balance yet.
      await approveLoan(api, loanId);
      await page.reload();
      await expect(page.getByText('Approved', { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(REPAYMENT_BUTTON)).toHaveCount(0);

      // 3. Active — now it is a legal command, and the button is back.
      await disburseLoan(api, loanId);
      await page.reload();
      await expect(page.getByText('Active', { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(REPAYMENT_BUTTON)).toBeVisible();
    } finally {
      await api.dispose();
    }
  });

  test('the platform refuses a repayment on a loan awaiting approval', async () => {
    test.setTimeout(recordingTimeout(120000));
    const api = await createApiContext();

    try {
      const { loanId } = await seedSubmittedLoan(api, 'E2ERepayRule');

      // Through API_BASE: the seeding context deliberately has no baseURL, because a
      // leading-slash path would resolve against the origin and drop the API prefix.
      const response = await api.post(
        `${API_BASE}/loans/${loanId}/transactions?command=repayment`,
        {
          data: {
            transactionDate: fineractDate(),
            transactionAmount: 100,
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
        'error.msg.loan.must.be.active.fully.paid.or.overpaid',
      );
    } finally {
      await api.dispose();
    }
  });
});
