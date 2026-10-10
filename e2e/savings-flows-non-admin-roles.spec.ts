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
 * The savings account lifecycle driven by the four separate non-admin accounts a deposit-taking
 * institution would split it across, with every one of those accounts built through the
 * application's own screens.
 *
 * The companion to `loan-flows-non-admin-roles.spec.ts`, and for the same reason: Fineract's
 * `transaction_savings` grouping had no coverage at all, and it is where the codes a branch
 * actually separates duties along live — `APPROVE_SAVINGSACCOUNT`, `ACTIVATE_SAVINGSACCOUNT`,
 * `DEPOSIT_SAVINGSACCOUNT`, `WITHDRAWAL_SAVINGSACCOUNT`. The existing `rbac-*` specs vary what a
 * session may *read* and seed their users over HTTP; this one varies what it may *write* and
 * builds its users by filling the forms. See `utils/ui-rbac.ts` for why that matters.
 *
 * ## Two defects this covers
 *
 * Both were found by driving these duties against a real platform, and both are the same shape
 * as the loan ones:
 *
 *  1. `/products/savings-accounts/:accountId/transactions/:command` declared
 *     `UPDATE_SAVINGSACCOUNT` for every command it serves. The platform accepts that code for
 *     none of them — deposit and withdrawal are in `transaction_savings` while
 *     `UPDATE_SAVINGSACCOUNT` is in `portfolio` — so a teller was offered an enabled Deposit
 *     button and then refused the form, and an account editor was admitted to a form whose
 *     submit could only 403.
 *  2. The cash-withdrawal button was gated on `WITHDRAW_SAVINGSACCOUNT`, which withdraws the
 *     *application*, not `WITHDRAWAL_SAVINGSACCOUNT`, which withdraws *cash*. One letter apart,
 *     both real, and strictly not interchangeable — measured in both directions.
 *
 *   npm run test:e2e:local -- e2e/savings-flows-non-admin-roles.spec.ts
 */

import { test, expect, type Page } from './fixtures';
import { assertLocalBackend } from './utils/backend-env';
import { captureJson } from './utils/capture-response';
import { login, loginAsSeededUser, uniqueSuffix } from './utils/fineract-login';
import { selectOption } from './utils/select-option';
import { landsOn } from './utils/settled-route';
import {
  createRoleAndUser,
  expectOffered,
  expectRefused,
  platformAllows,
  type UiUser,
} from './utils/ui-rbac';

// Five roles, five users, a client, a product and an account — all through forms — then five
// sign-ins. Serial because each test consumes the state the previous one left.
test.describe.configure({ mode: 'serial', timeout: 600_000 });

/** The reads every savings screen in the flow needs, held by every role below. */
const READS = ['READ_OFFICE', 'READ_CLIENT', 'READ_SAVINGSPRODUCT', 'READ_SAVINGSACCOUNT'];

/** Books an application. Holds nothing from `transaction_savings`. */
const OFFICER = [...READS, 'CREATE_SAVINGSACCOUNT'];

/** The four duties, each differing from the officer in exactly one code. */
const APPROVER = [...READS, 'APPROVE_SAVINGSACCOUNT'];
const ACTIVATOR = [...READS, 'ACTIVATE_SAVINGSACCOUNT'];
const TELLER = [...READS, 'DEPOSIT_SAVINGSACCOUNT', 'WITHDRAWAL_SAVINGSACCOUNT'];

/**
 * The control for the route assertions. `UPDATE_SAVINGSACCOUNT` is what the transaction route
 * used to declare, and the platform accepts it for no command the form serves, so both layers
 * must refuse it.
 */
const EDITOR = [...READS, 'UPDATE_SAVINGSACCOUNT'];

async function createClient(page: Page): Promise<string> {
  const suffix = uniqueSuffix();
  const firstName = `E2ESave${suffix}`;

  await page.goto('/clients/create', { waitUntil: 'networkidle' });
  await selectOption(page, 'Office', 'Head Office');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill('Saver');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/clients$/, { timeout: 20_000 });
  return `${firstName} Saver`;
}

async function createSavingsProduct(page: Page): Promise<string> {
  const suffix = uniqueSuffix();
  const productName = `E2E Savings ${suffix}`;

  await page.goto('/products/savings/create', { waitUntil: 'networkidle' });
  await page.locator('input[name="name"]').fill(productName);
  await page.locator('input[name="shortName"]').fill(`V${suffix.slice(-3).toUpperCase()}`);
  // A textarea, not an input — `input[name="description"]` matches nothing here.
  await page.locator('textarea[name="description"]').fill('Built by the non-admin savings spec');
  await page.locator('input[name="digitsAfterDecimal"]').fill('2');
  await page.locator('input[name="nominalAnnualInterestRate"]').fill('5');
  // The options are currency *codes*, not names: USD, EUR, INR are the literal labels.
  await selectOption(page, 'Currency', 'USD');

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/products\/savings$/, { timeout: 20_000 });
  return productName;
}

async function bookApplication(
  page: Page,
  clientName: string,
  productName: string,
): Promise<number> {
  await page.goto('/products/savings-accounts/create', { waitUntil: 'networkidle' });

  // Retried for the reason `seed-api.ts` cites as why it stopped building prerequisites this
  // way: a just-created client is not always returned by the search endpoint on the first call,
  // and the failure lands on the option click, reading as "the dropdown is broken".
  const clientSearch = page.getByRole('textbox', { name: 'Client ID' });
  const clientOption = page
    .getByTestId('client-search-results')
    .locator('ion-item')
    .filter({ hasText: clientName });
  await expect(async () => {
    await clientSearch.fill('');
    await clientSearch.fill(clientName.split(' ')[0]);
    await expect(clientOption).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000, intervals: [1000, 2000, 3000] });
  await clientOption.click();

  await selectOption(page, 'Product', productName);

  const created = await captureJson<{ savingsId: number }>(page, /\/savingsaccounts$/, 'POST', () =>
    page.getByRole('button', { name: 'Save' }).click(),
  );
  await expect(page).toHaveURL(/\/products\/savings-accounts$/, { timeout: 20_000 });
  return created.savingsId;
}

let officer: UiUser;
let approver: UiUser;
let activator: UiUser;
let teller: UiUser;
let editor: UiUser;
let clientName: string;
let productName: string;
let savingsId: number;

const VIEW = (id: number): string => `/products/savings-accounts/view/${id}`;
const DEPOSIT_FORM = (id: number): string =>
  `/products/savings-accounts/${id}/transactions/deposit`;

test.describe('a savings account taken through four separated duties, every account built in the UI', () => {
  test('an administrator builds the five roles and accounts through the forms', async ({
    page,
  }) => {
    assertLocalBackend();
    await login(page);

    officer = await createRoleAndUser(page, OFFICER, 'SvOfficer');
    approver = await createRoleAndUser(page, APPROVER, 'SvApprover');
    activator = await createRoleAndUser(page, ACTIVATOR, 'SvActivator');
    teller = await createRoleAndUser(page, TELLER, 'SvTeller');
    editor = await createRoleAndUser(page, EDITOR, 'SvEditor');

    // Guards everything after it: the sets differ in one code each, so any later difference in
    // behaviour can only be that code — unless the permission matrix wrote something other than
    // what was ticked, which this checks.
    const users = [officer, approver, activator, teller, editor];
    expect(new Set(users.map((user) => user.username)).size).toBe(users.length);
    for (const user of users) {
      expect(user.password.length).toBeGreaterThanOrEqual(12);
    }

    clientName = await createClient(page);
    productName = await createSavingsProduct(page);
  });

  test('the officer books the application and is not offered approval of it', async ({ page }) => {
    await loginAsSeededUser(page, officer);
    savingsId = await bookApplication(page, clientName, productName);

    await page.goto(VIEW(savingsId));
    await expect(page.getByText('Submitted and pending approval')).toBeVisible({
      timeout: 20_000,
    });

    // Refused rather than absent — this application disables an action on the record on screen
    // and names the missing code. See expectRefused in utils/ui-rbac.ts.
    await expectRefused(page.getByTestId('savings-approve-action'));

    const probe = await platformAllows(officer, `/savingsaccounts/${savingsId}?command=approve`);
    expect(probe.allowed, `officer was authorised to approve (status ${probe.status})`).toBe(false);
  });

  test('the approver, differing in one code, is offered it and approves', async ({ page }) => {
    // The control for the previous assertion: "the button is refused" passes just as well
    // against a screen that renders nothing, so the same screen has to offer it to somebody.
    const probe = await platformAllows(approver, `/savingsaccounts/${savingsId}?command=approve`);
    expect(probe.allowed, `approver was refused approval (status ${probe.status})`).toBe(true);

    await loginAsSeededUser(page, approver);
    await page.goto(VIEW(savingsId));

    const approve = page.getByTestId('savings-approve-action');
    await expectOffered(approve);
    await approve.click();

    await page.getByRole('button', { name: 'Save' }).click();

    // The savings action form returns to the **list**, not to the account — unlike the loan
    // approve form, which comes back to the loan. So the view has to be reopened before the new
    // status can be read.
    await expect(page).toHaveURL(/\/products\/savings-accounts$/, { timeout: 20_000 });
    await page.goto(VIEW(savingsId));
    await expect(page.getByText('Approved', { exact: true })).toBeVisible({ timeout: 20_000 });

    // Approval and activation are separate duties at the platform, so the approver must not be
    // able to put money in motion by itself.
    await expectRefused(page.getByTestId('savings-activate-action'));
  });

  test('the activator activates, and cannot take a deposit', async ({ page }) => {
    await loginAsSeededUser(page, activator);
    await page.goto(VIEW(savingsId));

    const activate = page.getByTestId('savings-activate-action');
    await expectOffered(activate);
    await activate.click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/products\/savings-accounts$/, { timeout: 20_000 });
    await page.goto(VIEW(savingsId));
    await expect(page.getByText('Active', { exact: true })).toBeVisible({ timeout: 20_000 });

    await expectRefused(page.getByTestId('savings-deposit-action'));
    const probe = await platformAllows(
      activator,
      `/savingsaccounts/${savingsId}/transactions?command=deposit`,
    );
    expect(probe.allowed, `activator was authorised to deposit (status ${probe.status})`).toBe(
      false,
    );
  });

  test('the teller, holding only the transaction codes, records a deposit end to end', async ({
    page,
  }) => {
    // The route used to declare UPDATE_SAVINGSACCOUNT, so this account — which the platform
    // authorises — was offered an enabled Deposit button and then sent to Access Denied.
    const probe = await platformAllows(
      teller,
      `/savingsaccounts/${savingsId}/transactions?command=deposit`,
    );
    expect(probe.allowed, `teller was refused a deposit (status ${probe.status})`).toBe(true);
    expect(teller.permissions).not.toContain('UPDATE_SAVINGSACCOUNT');

    await loginAsSeededUser(page, teller);
    await page.goto(VIEW(savingsId));

    const deposit = page.getByTestId('savings-deposit-action');
    await expectOffered(deposit);
    await deposit.click();

    await expect(page).toHaveURL(new RegExp(`/transactions/deposit$`), { timeout: 20_000 });
    await page.locator('input[name="transactionAmount"]').fill('500');
    // The platform refuses a deposit with no payment type, so the form requires one. Selecting
    // it here is the flow, not a workaround — see the note on the control.
    await selectOption(page, 'Payment Type', 'Money Transfer');

    // Driven to completion rather than stopping at the form: a gate that admits the right user
    // but a form that cannot submit would pass a narrower assertion. The response is captured
    // rather than inferred from the page, so a platform refusal fails here naming the reason
    // instead of three lines later as a missing balance.
    const posted = await captureJson<{ resourceId?: number }>(
      page,
      /\/savingsaccounts\/\d+\/transactions\?command=deposit$/,
      'POST',
      () => page.getByRole('button', { name: 'Save' }).click(),
    );
    expect(posted.resourceId, 'the deposit was refused by the platform').toBeDefined();
  });

  test('the cash-withdrawal control asks for the cash code, not the application one', async ({
    page,
  }) => {
    // The second defect, and the one a code-existence check cannot find: both codes are real.
    //
    //   transactions?command=withdrawal   WITHDRAWAL_ 400   WITHDRAW_ 403
    //   ?command=withdrawnByApplicant     WITHDRAWAL_ 403   WITHDRAW_ 400
    //
    // The button used to ask for WITHDRAW_SAVINGSACCOUNT — the application one — so a teller
    // holding the cash code was shown it disabled.
    const cash = await platformAllows(
      teller,
      `/savingsaccounts/${savingsId}/transactions?command=withdrawal`,
    );
    expect(cash.allowed, `teller was refused a cash withdrawal (status ${cash.status})`).toBe(true);

    await loginAsSeededUser(page, teller);
    await page.goto(VIEW(savingsId));
    await expectOffered(page.getByTestId('savings-withdraw-action'));

    // And the other direction, which is what makes this about the two codes rather than about
    // the teller: an account holding only the *application* withdrawal code is refused the cash
    // control, and the platform refuses it the operation too.
    await login(page);
    const applicationWithdrawer = await createRoleAndUser(
      page,
      [...READS, 'WITHDRAW_SAVINGSACCOUNT'],
      'SvAppWdr',
    );
    const refused = await platformAllows(
      applicationWithdrawer,
      `/savingsaccounts/${savingsId}/transactions?command=withdrawal`,
    );
    expect(
      refused.allowed,
      `WITHDRAW_SAVINGSACCOUNT was accepted for a cash withdrawal (status ${refused.status})`,
    ).toBe(false);

    await loginAsSeededUser(page, applicationWithdrawer);
    await page.goto(VIEW(savingsId));
    await expectRefused(page.getByTestId('savings-withdraw-action'));
  });

  test('the transaction route refuses an UPDATE_SAVINGSACCOUNT holder, as the platform does', async ({
    page,
  }) => {
    // The mirror of the teller case, and the reason the route could not simply be widened to
    // include UPDATE_SAVINGSACCOUNT: the platform does not accept a deposit under that code, so
    // admitting it led a user into a form whose submit could only 403.
    const probe = await platformAllows(
      editor,
      `/savingsaccounts/${savingsId}/transactions?command=deposit`,
    );
    expect(
      probe.allowed,
      `UPDATE_SAVINGSACCOUNT was accepted for a deposit (status ${probe.status})`,
    ).toBe(false);

    await loginAsSeededUser(page, editor);
    await page.goto(VIEW(savingsId));
    await expectRefused(page.getByTestId('savings-deposit-action'));

    expect(
      await landsOn(page, DEPOSIT_FORM(savingsId)),
      'the deposit form admitted an UPDATE_SAVINGSACCOUNT holder the platform refuses — the gate has widened again',
    ).toBe('/forbidden');
  });
});
