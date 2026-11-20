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
 * The client details page, against a real Fineract (#794).
 *
 * Against the real platform rather than mocked, and that is the whole point of this spec. What
 * the page was getting wrong is which **field names** it reads off `GET /clients/{id}` and
 * `GET /clients/{id}/accounts`, and several of them are undeclared in the generated models or
 * declared with the wrong label field: `gender` is a `CodeValueData` labelled by `name`,
 * `legalForm` is an `EnumOptionData` labelled by `value`, and `loanBalance` and
 * `accountBalance` are not in the generated account models at all. A mocked fixture would
 * reproduce whatever names this spec was written against, which is how a screen passes its
 * tests while showing empty cells in a browser (#862 shipped exactly that way).
 *
 * So the values go in through the API and the assertions look for them on the screen.
 */

import { test, expect, recordingTimeout } from './fixtures';
import { login } from './utils/fineract-login';
import {
  createApiContext,
  seedActiveLoanForClient,
  seedDetailedClient,
  seedEntityClient,
  seedFundedSavingsAccount,
  seedGroup,
} from './utils/seed-api';
import { selectTab } from './utils/ionic-locators';

test.describe('Client details', () => {
  test('shows every saved identification field, the group, the staff member and an accounts summary', async ({
    page,
  }) => {
    test.setTimeout(recordingTimeout(240000));
    const api = await createApiContext();

    try {
      const client = await seedDetailedClient(api);
      const group = await seedGroup(api, 'E2EDetailsGroup', [client.clientId]);
      const savingsBalance = 2500;
      await seedFundedSavingsAccount(api, client.clientId, savingsBalance);
      await seedActiveLoanForClient(api, client.clientId, 1000);

      await login(page);
      await page.goto(`/clients/view/${client.clientId}`);
      await expect(page.getByText(client.displayName).first()).toBeVisible({ timeout: 30000 });

      // Identification. Every one of these was either absent from the page or only visible by
      // opening Edit, which needs update permission the viewer may not have.
      await expect(page.getByTestId('client-mobile-number')).toHaveText(client.mobileNo);
      await expect(page.getByTestId('client-date-of-birth')).toHaveText(
        new Date(1990, 4, 15).toLocaleDateString(),
      );
      await expect(page.getByTestId('client-gender')).toHaveText(client.genderName);
      await expect(page.getByTestId('client-type')).toHaveText(client.clientTypeName);
      await expect(page.getByTestId('client-classification')).toHaveText(client.classificationName);
      // `legalForm.value`, not the word "Person" the row used to print whatever the client was.
      await expect(page.getByTestId('client-legal-form')).toHaveText(/PERSON/i);

      // Already on the page, in the header, so this asserts it rather than adding a second
      // copy of it to the details card.
      await expect(page.getByTestId('client-staff-name')).toHaveText(client.staffName);

      // Group membership, which the page did not mention at all, as a link to the group.
      const groupLink = page.getByTestId(`client-group-${group.groupId}`);
      await expect(groupLink).toHaveText(group.groupName);
      await expect(groupLink).toHaveAttribute('href', `/groups/view/${group.groupId}`);

      // The accounts overview: counts and the platform's own balances, in one place, on the
      // landing tab. Answering "what does this client owe and hold?" used to mean four tabs.
      await expect(page.getByTestId('client-accounts-overview')).toBeVisible();
      await expect(page.getByTestId('overview-count-savings')).toHaveText('1 / 1');
      await expect(page.getByTestId('overview-amount-savings')).toHaveText(
        savingsBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      );
      // The loan was just disbursed, so its outstanding balance is the whole principal. Read
      // through `loanBalance`, which the generated model does not declare.
      await expect(page.getByTestId('overview-count-loans')).toHaveText('1 / 1');
      await expect(page.getByTestId('overview-amount-loans')).toHaveText('1,000.00');
      // No fixed or recurring deposit was seeded, and the row says so rather than being absent.
      await expect(page.getByTestId('overview-count-deposits')).toHaveText('0 / 0');

      // The per-account links live on the tabs; the overview names the types and reports the
      // figures, which is what it is for. It carries no control of its own — a button here
      // duplicated the tab and collided with the New Account menu on accessible name.
      await expect(page.getByTestId('client-accounts-overview').locator('ion-button')).toHaveCount(
        0,
      );
      await selectTab(page, 'Loan Accounts');
      await expect(page.getByTestId('client-loan-accounts')).toBeVisible();
    } finally {
      await api.dispose();
    }
  });

  /**
   * An entity client, which the page labelled "Person" like every other client, and which has
   * no date of birth or gender to show.
   */
  test('labels an entity as one, and shows a dash where a field has no value', async ({ page }) => {
    test.setTimeout(recordingTimeout(180000));
    const api = await createApiContext();

    try {
      const client = await seedEntityClient(api, 'E2EDetailsEntity');

      await login(page);
      await page.goto(`/clients/view/${client.clientId}`);
      await expect(page.getByText(client.displayName).first()).toBeVisible({ timeout: 30000 });

      await expect(page.getByTestId('client-legal-form')).toHaveText(/ENTITY/i);
      await expect(page.getByTestId('client-date-of-birth')).toHaveText('—');
      await expect(page.getByTestId('client-gender')).toHaveText('—');
      await expect(page.getByTestId('client-groups')).toHaveText('—');
      // Nobody is assigned, so the header shows no staff chip at all.
      await expect(page.getByTestId('client-staff-name')).toHaveCount(0);
    } finally {
      await api.dispose();
    }
  });
});
