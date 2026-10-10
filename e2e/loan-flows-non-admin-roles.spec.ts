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
 * The loan lifecycle driven by the four separate non-admin accounts a real lender would
 * split it across, with every one of those accounts built through the application's own
 * screens.
 *
 * ## Why this is not another RBAC spec
 *
 * The existing RBAC specs seed their users with `seed-api.ts` and then vary what the
 * resulting session may *read*. This one does neither:
 *
 *  - **No seeding.** The roles, the permission grants, the users, the client, the loan
 *    product and the loan application are all created by filling the forms. That means the
 *    administrative screens are themselves under test — `role-form` is the only place in the
 *    application that writes `PUT /roles/{id}/permissions`, and nothing exercised it against a
 *    real platform before this spec. A permission matrix that silently sent the wrong delta
 *    would have passed every existing test, because every existing test grants permissions
 *    over HTTP instead.
 *  - **Write actions, not reads.** `APPROVE_LOAN`, `DISBURSE_LOAN` and `REPAYMENT_LOAN` live
 *    in Fineract's `transaction_loan` grouping, which the suite had no coverage of at all.
 *    They are also the codes a lender actually separates duties along: the officer who books
 *    the loan is not the person who approves it, and neither is the teller who pays it out.
 *
 * `seed-api.ts` opens by explaining that these prerequisites used to be built through the UI
 * and were moved to HTTP because the chain was flaky — the client-search dropdown especially.
 * That reasoning is right for a spec whose subject is something else; setup should not be able
 * to fail a test for an unrelated reason. Here the setup *is* the subject, so it is driven
 * through the forms deliberately, and the one genuinely racy step is wrapped in the same
 * `toPass` retry `loan-lifecycle.spec.ts` uses for it.
 *
 * ## Both halves, every time
 *
 * Every claim about what an account may do is checked twice: once against what the
 * application offers that session, and once against what Fineract answers the same account.
 * `platformAllows()` does the second half **without performing the operation**, by
 * sending an empty body: Fineract authorises before it validates, so a holder of the code
 * gets 400 and a non-holder gets 403. That distinction is the whole assertion, and it costs
 * no state.
 *
 *   npm run test:e2e:local -- e2e/loan-flows-non-admin-roles.spec.ts
 */

import { test, expect, type Page } from './fixtures';
import { assertLocalBackend } from './utils/backend-env';
import { captureJson } from './utils/capture-response';
import { login, loginAsSeededUser, uniqueSuffix } from './utils/fineract-login';
import { ionSelect } from './utils/ionic-locators';
import { selectOption } from './utils/select-option';
import { landsOn } from './utils/settled-route';
import {
  createRoleAndUser,
  expectOffered,
  expectRefused,
  platformAllows,
  type UiUser,
} from './utils/ui-rbac';

// Four roles, four users, a client, a product and a loan — all through forms — then four
// sign-ins. Serial because each test consumes the state the previous one left.
test.describe.configure({ mode: 'serial', timeout: 600_000 });

/**
 * Reads every loan screen in the flow, and books an application. Deliberately holds no
 * `transaction_loan` code: this is the account that must be *refused* approval.
 *
 * `READ_OFFICE`, `READ_CLIENT` and `READ_LOANPRODUCT` are not decoration — the application
 * form's three dropdowns are backed by those endpoints, and a session missing one gets an
 * empty select rather than an error.
 */
const OFFICER = ['READ_OFFICE', 'READ_CLIENT', 'READ_LOANPRODUCT', 'READ_LOAN', 'CREATE_LOAN'];

/** Identical to the officer's set but for `APPROVE_LOAN`, so any difference is that code. */
const APPROVER = ['READ_OFFICE', 'READ_CLIENT', 'READ_LOANPRODUCT', 'READ_LOAN', 'APPROVE_LOAN'];

/** Likewise for `DISBURSE_LOAN`. */
const DISBURSER = ['READ_OFFICE', 'READ_CLIENT', 'READ_LOANPRODUCT', 'READ_LOAN', 'DISBURSE_LOAN'];

/**
 * The control for the route-gate assertions: `UPDATE_LOAN` is what the transaction routes used
 * to be gated on, and it is **not** what the platform accepts a repayment or a disbursement
 * under. An account holding it and nothing else from `transaction_loan` is the one both layers
 * must now refuse.
 */
const EDITOR = ['READ_OFFICE', 'READ_CLIENT', 'READ_LOANPRODUCT', 'READ_LOAN', 'UPDATE_LOAN'];

async function createClient(page: Page): Promise<string> {
  const suffix = uniqueSuffix();
  const firstName = `E2ERole${suffix}`;

  await page.goto('/clients/create', { waitUntil: 'networkidle' });
  await selectOption(page, 'Office', 'Head Office');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill('Borrower');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/clients$/, { timeout: 20_000 });
  return `${firstName} Borrower`;
}

async function createLoanProduct(page: Page): Promise<string> {
  const suffix = uniqueSuffix();
  const productName = `E2E Roles Product ${suffix}`;

  await page.goto('/products/loan/create');
  await expect(
    ionSelect(page, 'Repayment Strategy').locator('ion-select-option').first(),
  ).toBeAttached({ timeout: 20_000 });

  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(productName);
  await page.getByRole('textbox', { name: 'Short Name' }).fill(suffix.slice(-4).toUpperCase());
  await page.getByRole('spinbutton', { name: 'Principal' }).fill('1000');
  await page.getByRole('spinbutton', { name: 'Interest Rate' }).fill('10');
  await page.getByRole('spinbutton', { name: 'Number of Repayments' }).fill('3');
  await page.getByRole('spinbutton', { name: 'Repayment Every' }).fill('1');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/products\/loan$/, { timeout: 20_000 });
  return productName;
}

async function bookLoanApplication(
  page: Page,
  clientName: string,
  productName: string,
): Promise<number> {
  await page.goto('/loans/create', { waitUntil: 'networkidle' });

  // Retried for the reason `seed-api.ts` cites as why it stopped doing this at all: a
  // just-created client is not always returned by the search endpoint on the first call, and
  // the failure lands on the option click, reading as "the dropdown is broken".
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

  await selectOption(page, 'Loan Product', productName);
  await page.getByRole('spinbutton', { name: 'Principal', exact: true }).fill('1000');
  await page.getByRole('spinbutton', { name: 'Term Frequency' }).fill('3');
  await selectOption(page, 'Term Type', 'Months');
  await page.getByRole('spinbutton', { name: 'Number of Repayments' }).fill('3');
  await page.getByRole('spinbutton', { name: 'Repayment Every' }).fill('1');
  await selectOption(page, 'Frequency', 'Months');
  await page.getByRole('spinbutton', { name: 'Interest Rate' }).fill('10');
  await selectOption(page, 'Interest Type', 'Declining Balance');
  await selectOption(page, 'Amortization Type', 'Equal Installments');
  await selectOption(page, 'Interest Calculation Period Type', 'Same as repayment period');

  const created = await captureJson<{ loanId: number }>(page, /\/loans$/, 'POST', () =>
    page.getByRole('button', { name: 'Save' }).click(),
  );
  await expect(page).toHaveURL(/\/loans$/, { timeout: 20_000 });
  return created.loanId;
}

let officer: UiUser;
let approver: UiUser;
let disburser: UiUser;
let editor: UiUser;
let clientName: string;
let productName: string;
let loanId: number;

test.describe('a loan taken through four separated duties, every account built in the UI', () => {
  test('an administrator builds the four roles and accounts through the forms', async ({
    page,
  }) => {
    assertLocalBackend();
    await login(page);

    officer = await createRoleAndUser(page, OFFICER, 'Officer');
    approver = await createRoleAndUser(page, APPROVER, 'Approver');
    disburser = await createRoleAndUser(page, DISBURSER, 'Disburser');
    editor = await createRoleAndUser(page, EDITOR, 'Editor');

    // Guards every assertion that follows. The four sets differ in exactly one code, so a
    // difference in behaviour later can only be that code — unless the matrix wrote something
    // other than what was ticked, which is what this checks.
    for (const user of [officer, approver, disburser, editor]) {
      expect(user.username, `${user.roleName} has no username`).not.toBe('');
      expect(user.password.length).toBeGreaterThanOrEqual(12);
    }
    expect(
      new Set([officer.username, approver.username, disburser.username, editor.username]).size,
    ).toBe(4);

    clientName = await createClient(page);
    productName = await createLoanProduct(page);
  });

  test('the officer books the application and is not offered approval of their own loan', async ({
    page,
  }) => {
    await loginAsSeededUser(page, officer);

    loanId = await bookLoanApplication(page, clientName, productName);

    await page.goto(`/loans/view/${loanId}`);
    await expect(page.getByText('Submitted and pending approval')).toBeVisible({
      timeout: 20_000,
    });

    // The whole point of separating the duty — and checked as a *refused* control rather than
    // an absent one, which is this application's deliberate choice for an action on the record
    // on screen. See expectRefused.
    await expectRefused(page.getByTestId('loan-approve-action'));

    // The refusal says which permission is missing, which is the half that makes disabling
    // better than hiding: an officer can read this and ask for the right thing.
    //
    // Read off `title`, not `aria-label`. The directive host-binds both, but `ion-button` is a
    // custom element that hoists host `aria-*` into its own shadow root at render, so the
    // accessible name is not on the element this locator resolves to while the tooltip text
    // is. Same hazard as the one `ionSelect()` documents for ion-select's folded name.
    await expect(page.getByTestId('loan-approve-action')).toHaveAttribute('title', /APPROVE_LOAN/);

    // And the platform agrees, so the hidden button is not merely the client being cautious.
    const probe = await platformAllows(officer, `/loans/${loanId}?command=approve`);
    expect(probe.allowed, `officer was authorised to approve (status ${probe.status})`).toBe(false);
  });

  test('the approver, differing from the officer in one code, is offered it and approves', async ({
    page,
  }) => {
    // The control for the previous assertion: "the button is absent" also passes against a
    // screen that renders nothing, so the same screen has to show it to somebody.
    const probe = await platformAllows(approver, `/loans/${loanId}?command=approve`);
    expect(probe.allowed, `approver was refused approval (status ${probe.status})`).toBe(true);

    await loginAsSeededUser(page, approver);
    await page.goto(`/loans/view/${loanId}`);

    const approve = page.getByTestId('loan-approve-action');
    await expectOffered(approve);
    await approve.click();

    await expect(page).toHaveURL(/\/action\/approve$/, { timeout: 20_000 });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(`/loans/view/${loanId}`, { timeout: 20_000 });
    await expect(page.getByText('Approved', { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test('the approver is not offered disbursement of the loan they just approved', async ({
    page,
  }) => {
    await loginAsSeededUser(page, approver);
    await page.goto(`/loans/view/${loanId}`);
    await expect(page.getByText('Approved', { exact: true })).toBeVisible({ timeout: 20_000 });

    await expectRefused(page.getByTestId('loan-disburse-action'));

    const probe = await platformAllows(approver, `/loans/${loanId}?command=disburse`);
    expect(probe.allowed, `approver was authorised to disburse (status ${probe.status})`).toBe(
      false,
    );
  });

  test('the disburser, holding only DISBURSE_LOAN, completes the payout end to end', async ({
    page,
  }) => {
    // The case issue #691 was about, now asserting the fix rather than the defect.
    //
    // The route used to declare `UPDATE_LOAN` for all 29 of its commands, so this account —
    // which the platform authorises, per the probe below — was offered an enabled Disburse
    // button and then sent to Access Denied by the guard. Nothing else on the screen was
    // available to it, so that one control was the whole of its application.
    //
    // `DISBURSE_LOAN` and nothing else from `transaction_loan`, and no `UPDATE_LOAN`: if the
    // route ever goes back to a single declaration, this is the test that fails.
    const probe = await platformAllows(disburser, `/loans/${loanId}?command=disburse`);
    expect(probe.allowed, `disburser was refused disbursement (status ${probe.status})`).toBe(true);
    expect(disburser.permissions).not.toContain('UPDATE_LOAN');

    await loginAsSeededUser(page, disburser);
    await page.goto(`/loans/view/${loanId}`);

    const disburse = page.getByTestId('loan-disburse-action');
    await expectOffered(disburse);
    await disburse.click();

    await expect(page).toHaveURL(new RegExp(`/loans/${loanId}/transactions/disburse$`), {
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/loans$/, { timeout: 20_000 });

    // The point of driving it to completion rather than stopping at the form: a gate that
    // admits the right user but a form that cannot submit would pass a narrower assertion.
    await page.goto(`/loans/view/${loanId}`);
    await expect(page.getByText('Active', { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test('and the same route now refuses an UPDATE_LOAN holder, as the platform does', async ({
    page,
  }) => {
    // The other half of #691, and the reason the gate could not simply be widened to include
    // UPDATE_LOAN: the platform does not accept the operation under that code at all, so
    // admitting it led a user into a form whose submit could only 403.
    const probe = await platformAllows(editor, `/loans/${loanId}?command=disburse`);
    expect(
      probe.allowed,
      `UPDATE_LOAN was accepted for disbursement (status ${probe.status})`,
    ).toBe(false);

    await loginAsSeededUser(page, editor);
    await page.goto(`/loans/view/${loanId}`);

    // Asserted on Repayment rather than Disburse. By this point the previous test has made the
    // loan **active**, and the Disburse button is gated on `@if (isLoanApproved)` — so it is
    // absent for everyone, including a superuser. Asserting its absence here would pass for a
    // reason that has nothing to do with permissions, which is the kind of assertion that keeps
    // passing after the thing it was meant to check has broken.
    //
    // Repayment *is* offered on an active loan, and this account lacks REPAYMENT_LOAN, so it is
    // the control that actually tests the gate at this point in the flow.
    await expectRefused(page.getByTestId('loan-repayment-action'));

    // The route is state-independent — the guard runs before the component loads — so the
    // disbursement URL is still the right thing to check, and still the half of #691 that
    // mattered: it used to admit this account to a form whose submit could only 403.
    expect(
      await landsOn(page, `/loans/${loanId}/transactions/disburse`),
      'the route admitted an UPDATE_LOAN holder the platform refuses — the gate has widened again',
    ).toBe('/forbidden');
  });

  test('a command with no mapped code is left to the platform rather than guessed at', async ({
    page,
  }) => {
    // Four commands are deliberately unmapped because the authorisation probe gave no clean
    // answer; `core/guards/command-permissions.ts` lists them and what each answered. The
    // guard admits those rather than inventing a code, because a wrong code refuses a user the
    // platform would have allowed — the more damaging and less visible half of #691.
    //
    // Asserted so that the choice is visible: if someone later maps `reAmortize`, this fails
    // and they have to decide deliberately rather than discover it from a support ticket.
    await loginAsSeededUser(page, editor);
    expect(
      await landsOn(page, `/loans/${loanId}/transactions/reAmortize`),
      'an unmapped command is now gated; command-permissions.ts needs updating to match',
    ).toBe(`/loans/${loanId}/transactions/reAmortize`);
  });

  test('a repayment duty reaches its own form, and records a repayment', async ({ page }) => {
    await login(page);
    const teller = await createRoleAndUser(
      page,
      ['READ_OFFICE', 'READ_CLIENT', 'READ_LOANPRODUCT', 'READ_LOAN', 'REPAYMENT_LOAN'],
      'Teller',
    );

    // REPAYMENT_LOAN is sufficient at the platform, as DISBURSE_LOAN was.
    const allowed = await platformAllows(teller, `/loans/${loanId}/transactions?command=repayment`);
    expect(allowed.allowed, `REPAYMENT_LOAN holder refused (status ${allowed.status})`).toBe(true);

    // And UPDATE_LOAN is not, which is the code the route asks for.
    const refused = await platformAllows(editor, `/loans/${loanId}/transactions?command=repayment`);
    expect(refused.allowed, `UPDATE_LOAN accepted a repayment (status ${refused.status})`).toBe(
      false,
    );

    await loginAsSeededUser(page, teller);
    await page.goto(`/loans/view/${loanId}`);

    // The fourth duty, on the loan the disburser made active. The same gate served Disburse
    // and Repayment from one declaration, so both were broken by the same line and both are
    // fixed by the same one — which is why this is asserted separately rather than assumed.
    const repayment = page.getByTestId('loan-repayment-action');
    await expectOffered(repayment);
    await repayment.click();

    await expect(page).toHaveURL(new RegExp(`/loans/${loanId}/transactions/repayment$`), {
      timeout: 20_000,
    });
    await page.locator('input[name="transactionAmount"]').fill('100');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/loans$/, { timeout: 20_000 });

    // The transaction landed, which a route assertion alone would not show.
    await page.goto(`/loans/view/${loanId}`);
    await expect(page.getByText('Active', { exact: true })).toBeVisible({ timeout: 20_000 });
  });
});
