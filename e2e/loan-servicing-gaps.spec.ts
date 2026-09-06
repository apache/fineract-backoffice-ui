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
 * The loan gaps closed in #266 and the interest-pause edit flow from #283, against mocks.
 *
 * Mocked rather than backend for two reasons. The four data tabs need a loan carrying term
 * variations, overdue charges, originators and a delinquency block, and a fresh platform
 * returns `[]` for every one of those — a real run could only ever assert the empty state.
 * And the undo-approval assertion is about the *request*, which is exactly what a mock can
 * inspect and a live platform cannot.
 *
 * The request assertion is the point of this file. `undoapproval` rejects `locale` and
 * `dateFormat` with a 400 naming them as unsupported parameters, so routing it through the
 * shared account action form — which sends both on every request — would break it. That is a
 * mistake with no visible symptom until someone actually undoes an approval, so it is pinned
 * here rather than left to a reviewer to notice.
 */

import { test, expect, Page } from './fixtures';

const TENANT = 'default';
const USER = 'mifos';
const PASSWORD = 'password';
const HEAD_OFFICE = 'Head Office';
const LOAN_ID = 456;
const MENU_TRIGGER = '#loanMenu-trigger';
const UNDO_APPROVAL_ITEM = 'loan-undo-approval-action';
const WRONG_CLIENT = 'approved against the wrong client';
const OFFICER_NAME = 'Field Officer';
const INTEREST_PAUSE_ID = 77;

interface LoanOverrides {
  status?: Record<string, unknown>;
  loanOfficerId?: number;
  loanOfficerName?: string;
  multiDisburseLoan?: boolean;
  loanTermVariations?: unknown[];
  overdueCharges?: unknown[];
  originators?: unknown[];
  delinquent?: Record<string, unknown>;
}

const APPROVED = {
  id: 200,
  code: 'loanStatusType.approved',
  value: 'Approved',
  active: false,
  pendingApproval: false,
};

function loan(overrides: LoanOverrides) {
  return {
    id: LOAN_ID,
    accountNo: 'L000456',
    clientId: 1,
    clientName: 'Jane Smith',
    loanProductName: 'Demo Product',
    principal: 5000,
    status: { id: 300, code: 'loanStatusType.active', value: 'Active', active: true },
    currency: { code: 'USD', displaySymbol: '$' },
    summary: { principalOutstanding: 5000, totalOutstanding: 5000 },
    repaymentSchedule: { periods: [] },
    transactions: [],
    charges: [],
    loanTermVariations: [],
    overdueCharges: [],
    originators: [],
    ...overrides,
  };
}

/** Records what the page sent, so the assertions are about requests rather than appearances. */
interface Probe {
  commands: { command: string | null; body: unknown }[];
  interestPauseUpdates: { variationId: number; body: Record<string, unknown> }[];
}

async function loginWithLoan(page: Page, overrides: LoanOverrides): Promise<Probe> {
  const probe: Probe = { commands: [], interestPauseUpdates: [] };

  await page.route('**/config.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fineractApiUrl: '/api/v1', defaultTenant: TENANT }),
    });
  });

  await page.route('**/api/v1/authentication**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        username: USER,
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: HEAD_OFFICE,
        roles: [{ id: 1, name: 'Super User', description: 'Super user' }],
        permissions: ['ALL_FUNCTIONS'],
      }),
    });
  });

  await page.route(/\/api\/v1\/loans\/\d+\/delinquencytags/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ classification: 'Delinquent 30', addedOnDate: '2026-07-01' }]),
    });
  });

  await page.route(/\/api\/v1\/loans\/\d+\/delinquency-actions/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route(
    new RegExp(`/api/v1/loans/${LOAN_ID}/interest-pauses(?:/\\d+)?(?:\\?|$)`),
    async (route) => {
      const request = route.request();
      if (request.method() === 'PUT') {
        const variationId = Number(new URL(request.url()).pathname.split('/').pop());
        probe.interestPauseUpdates.push({
          variationId,
          body: request.postDataJSON() as Record<string, unknown>,
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ loanId: LOAN_ID, resourceId: variationId }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        // Fineract deployments can serialize LocalDate this way; the form accepts this as well
        // as the ISO strings declared by the generated OpenAPI model.
        body: JSON.stringify([
          {
            id: INTEREST_PAUSE_ID,
            startDate: [2026, 4, 1],
            endDate: [2026, 4, 8],
          },
        ]),
      });
    },
  );

  await page.route(/\/api\/v1\/loans\/456(\?|$)/, async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      probe.commands.push({
        command: new URL(request.url()).searchParams.get('command'),
        body: request.postDataJSON(),
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ loanId: LOAN_ID, resourceId: LOAN_ID }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(loan(overrides)),
    });
  });

  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT);
  await page.locator('#username').fill(USER);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');

  return probe;
}

const tab = (page: Page, testId: string) => page.getByTestId(testId);

test.describe('Loan servicing gaps', () => {
  test('edits an interest pause through PUT while preserving its existing dates', async ({
    page,
  }) => {
    const probe = await loginWithLoan(page, {});

    await page.goto(`/loans/${LOAN_ID}/interest-pauses`);
    await page.getByRole('button', { name: 'Edit' }).click();

    await expect(page).toHaveURL(`/loans/${LOAN_ID}/interest-pauses/edit/${INTEREST_PAUSE_ID}`);
    await expect(page.getByText('Edit Interest Pause', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save' }).click();

    await expect.poll(() => probe.interestPauseUpdates.length).toBe(1);
    expect(probe.interestPauseUpdates[0]).toEqual({
      variationId: INTEREST_PAUSE_ID,
      body: {
        startDate: '01 April 2026',
        endDate: '08 April 2026',
        dateFormat: 'dd MMMM yyyy',
        locale: 'en',
      },
    });
    await expect(page).toHaveURL(`/loans/${LOAN_ID}/interest-pauses`);
  });

  test('undo approval sends an empty body, without the locale the platform refuses', async ({
    page,
  }) => {
    const probe = await loginWithLoan(page, { status: APPROVED });

    await page.goto(`/loans/view/${LOAN_ID}`);
    await page.locator(MENU_TRIGGER).click();
    await page.getByTestId(UNDO_APPROVAL_ITEM).click();
    await page.getByTestId('loan-undo-approval-confirm').click();

    await expect.poll(() => probe.commands.length).toBe(1);
    expect(probe.commands[0].command).toBe('undoapproval');
    // The whole point: no `locale`, no `dateFormat`. The platform answers 400 and names both
    // as unsupported parameters, and nothing else in the app would reveal that.
    expect(probe.commands[0].body).toEqual({});
  });

  test('undo approval carries the reason when one was given', async ({ page }) => {
    const probe = await loginWithLoan(page, { status: APPROVED });

    await page.goto(`/loans/view/${LOAN_ID}`);
    await page.locator(MENU_TRIGGER).click();
    await page.getByTestId(UNDO_APPROVAL_ITEM).click();
    await page
      .locator('ion-textarea[data-testid="loan-undo-approval-note"] textarea')
      .fill(WRONG_CLIENT);
    await page.getByTestId('loan-undo-approval-confirm').click();

    await expect.poll(() => probe.commands.length).toBe(1);
    expect(probe.commands[0].body).toEqual({ note: WRONG_CLIENT });
  });

  test('undo approval is offered only while the loan is approved', async ({ page }) => {
    await loginWithLoan(page, {});

    await page.goto(`/loans/view/${LOAN_ID}`);
    await page.locator(MENU_TRIGGER).click();

    // An active loan is past the point of undoing its approval; offering it would be an
    // invitation to a 403.
    await expect(page.getByTestId(UNDO_APPROVAL_ITEM)).toHaveCount(0);
  });

  test('the delinquency tab shows the summary the loan carries and the tags it fetches', async ({
    page,
  }) => {
    await loginWithLoan(page, {
      delinquent: {
        pastDueDays: 12,
        delinquentDays: 9,
        delinquentAmount: 1500,
        delinquencyPausePeriods: [{ startDate: '2026-06-01', endDate: '2026-06-15' }],
      },
    });

    await page.goto(`/loans/view/${LOAN_ID}`);
    await tab(page, 'loan-tab-delinquency').click();

    await expect(page.getByTestId('loan-past-due-days')).toHaveText('12');
    await expect(page.getByTestId('loan-delinquent-days')).toHaveText('9');
    await expect(page.getByTestId('loan-delinquent-amount')).toContainText('1,500');
    await expect(page.getByRole('cell', { name: 'Delinquent 30' })).toBeVisible();
  });

  test('the data-only tabs stay hidden when the loan carries nothing for them', async ({
    page,
  }) => {
    await loginWithLoan(page, {});

    await page.goto(`/loans/view/${LOAN_ID}`);
    // Anchored on a tab that is always there, so these are negatives against a rendered page.
    await expect(tab(page, 'loan-tab-delinquency')).toBeVisible();

    // Shown empty they would read as "nothing was varied" / "no originator", which is
    // indistinguishable from a read that failed.
    await expect(tab(page, 'loan-tab-term-variations')).toHaveCount(0);
    await expect(tab(page, 'loan-tab-overdue-charges')).toHaveCount(0);
    await expect(tab(page, 'loan-tab-originators')).toHaveCount(0);
  });

  test('each data-only tab appears and renders once the loan carries its data', async ({
    page,
  }) => {
    await loginWithLoan(page, {
      loanTermVariations: [
        {
          id: 1,
          termType: { id: 2, value: 'Principal' },
          termVariationApplicableFrom: '2026-05-01',
          decimalValue: 250,
          isProcessed: true,
        },
      ],
      overdueCharges: [
        { id: 9, name: 'Late fee', amount: 30, chargeTimeType: { value: 'Overdue Fees' } },
      ],
      originators: [
        { id: 3, name: 'Partner Agent', originatorTypeName: 'Broker', channelTypeName: 'Field' },
      ],
    });

    await page.goto(`/loans/view/${LOAN_ID}`);

    await tab(page, 'loan-tab-term-variations').click();
    await expect(page.getByRole('cell', { name: 'Principal' })).toBeVisible();

    await tab(page, 'loan-tab-overdue-charges').click();
    await expect(page.getByRole('cell', { name: 'Late fee' })).toBeVisible();

    await tab(page, 'loan-tab-originators').click();
    await expect(page.getByRole('cell', { name: 'Partner Agent' })).toBeVisible();
  });

  test('disburse to savings sends the date and amount, with the platform date format', async ({
    page,
  }) => {
    const probe = await loginWithLoan(page, { status: APPROVED });

    await page.goto(`/loans/view/${LOAN_ID}`);
    await page.locator(MENU_TRIGGER).click();
    await page.getByTestId('loan-disburse-to-savings-action').click();
    await page.getByTestId('disburse-to-savings-confirm').click();

    await expect.poll(() => probe.commands.length).toBe(1);
    expect(probe.commands[0].command).toBe('disbursetosavings');
    const body = probe.commands[0].body as Record<string, unknown>;
    // Unlike undoapproval, this command *does* take locale and dateFormat, and the date has to
    // be in the platform's own format rather than the ISO the picker produces.
    expect(body['dateFormat']).toBe('dd MMMM yyyy');
    expect(body['locale']).toBe('en');
    expect(body['actualDisbursementDate']).toMatch(/^\d{2} \w+ \d{4}$/);
    expect(body['transactionAmount']).toBe(5000);
  });

  test('disburse to savings is offered only on an approved loan', async ({ page }) => {
    await loginWithLoan(page, {});

    await page.goto(`/loans/view/${LOAN_ID}`);
    await page.locator(MENU_TRIGGER).click();

    await expect(page.getByTestId('loan-disburse-to-savings-action')).toHaveCount(0);
  });

  test('unassign loan officer sends the date, and appears only when one is assigned', async ({
    page,
  }) => {
    const probe = await loginWithLoan(page, { loanOfficerId: 7, loanOfficerName: OFFICER_NAME });

    await page.goto(`/loans/view/${LOAN_ID}`);
    await page.locator(MENU_TRIGGER).click();
    await page.getByTestId('loan-unassign-officer-action').click();
    await page.getByTestId('unassign-officer-confirm').click();

    await expect.poll(() => probe.commands.length).toBe(1);
    expect(probe.commands[0].command).toBe('unassignloanofficer');
    const body = probe.commands[0].body as Record<string, unknown>;
    expect(body['unassignedDate']).toMatch(/^\d{2} \w+ \d{4}$/);
    expect(body['dateFormat']).toBe('dd MMMM yyyy');
  });

  test('unassign loan officer is hidden on a loan with no officer', async ({ page }) => {
    await loginWithLoan(page, {});

    await page.goto(`/loans/view/${LOAN_ID}`);
    await page.locator(MENU_TRIGGER).click();

    await expect(page.getByTestId('loan-unassign-officer-action')).toHaveCount(0);
  });

  test('undo last disbursal appears only on a multi-disbursal loan, and sends an empty body', async ({
    page,
  }) => {
    const probe = await loginWithLoan(page, { multiDisburseLoan: true });

    await page.goto(`/loans/view/${LOAN_ID}`);
    await page.locator(MENU_TRIGGER).click();
    await page.getByTestId('loan-undo-last-disbursal-action').click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect.poll(() => probe.commands.length).toBe(1);
    expect(probe.commands[0].command).toBe('undoLastDisbursal');
    expect(probe.commands[0].body).toEqual({});
  });

  test('undo last disbursal is hidden on a single-disbursal loan', async ({ page }) => {
    await loginWithLoan(page, {});

    await page.goto(`/loans/view/${LOAN_ID}`);
    await page.locator(MENU_TRIGGER).click();

    // The platform can only ever answer 403 there. An action whose sole outcome is an error
    // is worse than no action at all.
    await expect(page.getByTestId('loan-undo-last-disbursal-action')).toHaveCount(0);
  });

  test('close as rescheduled is offered on an active loan', async ({ page }) => {
    await loginWithLoan(page, {});

    await page.goto(`/loans/view/${LOAN_ID}`);
    await page.locator(MENU_TRIGGER).click();

    await expect(page.getByTestId('loan-close-as-rescheduled-action')).toBeVisible();
  });
});
