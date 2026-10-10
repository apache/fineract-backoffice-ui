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
 * Pausing and resuming delinquency on a regular loan (#505), against mocks.
 *
 * Mocked because what matters here is the request the page sends and what it does with the
 * platform's answers, and because the screen has to be shown a loan that is already delinquent
 * with pause periods on it, which a fresh platform does not have.
 *
 * The fixtures use the shapes Fineract actually sends, not the ones the generated model declares:
 * `LocalDate` as `[year, month, day]`, and pause periods as `pausePeriodStart` / `pausePeriodEnd`.
 * The tab used to read `startDate` / `endDate` and print the arrays as they came, so against a
 * real platform its pause table had blank dates and every other date read `2026,10,15`.
 */

import { test, expect, Page } from './fixtures';

const TENANT = 'default';
const LOAN_ID = 456;
// Literals rather than a RegExp built from LOAN_ID: the security lint flags a non-literal pattern.
const LOAN_URL = /\/api\/v1\/loans\/456(\?|$)/;
const ACTIONS_URL = /\/api\/v1\/loans\/456\/delinquency-actions/;

type Ymd = [number, number, number];

interface PausePeriod {
  pausePeriodStart: Ymd;
  pausePeriodEnd: Ymd;
}

const BUSINESS_DATE: Ymd = [2026, 10, 1];
const ENDED: PausePeriod = { pausePeriodStart: [2026, 8, 1], pausePeriodEnd: [2026, 8, 10] };
const IN_EFFECT: PausePeriod = { pausePeriodStart: [2026, 9, 28], pausePeriodEnd: [2026, 10, 15] };

const ymd = ([year, month, day]: Ymd) => year * 10_000 + month * 100 + day;

/**
 * The platform's rule for a period's `active` flag: the business date falls inside it, both
 * ends included. Worked out here, as the platform does, so that a pause which starts today is in
 * effect today and a pause cut short to today still reads as in effect until the date moves on.
 */
const isInEffect = (period: PausePeriod) =>
  ymd(period.pausePeriodStart) <= ymd(BUSINESS_DATE) &&
  ymd(BUSINESS_DATE) <= ymd(period.pausePeriodEnd);

const ACTIVE_STATUS = { id: 300, code: 'loanStatusType.active', value: 'Active', active: true };
const CLOSED_STATUS = {
  id: 600,
  code: 'loanStatusType.closed.obligations.met',
  value: 'Closed (obligations met)',
  active: false,
  closedObligationsMet: true,
};

interface Setup {
  periods?: PausePeriod[];
  /** The permissions the signed-in user holds. Defaults to everything. */
  permissions?: string[];
  status?: Record<string, unknown>;
  /** Makes the platform refuse the next delinquency action with this message. */
  refuseWith?: string;
}

interface Probe {
  posted: Record<string, unknown>[];
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Reads the `dd MMMM yyyy` the page posts back into the array Fineract would answer with. */
function toYmd(posted: unknown): Ymd {
  const [day, month, year] = String(posted).split(' ');
  return [Number(year), MONTHS.indexOf(month) + 1, Number(day)];
}

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/**
 * Mocks a tenant with one delinquent loan whose pause periods change as actions are posted, the
 * way the platform's would: a pause adds a period, a resume ends the one in effect today.
 */
async function signInWithLoan(page: Page, setup: Setup = {}): Promise<Probe> {
  const probe: Probe = { posted: [] };
  let periods = setup.periods ?? [ENDED, IN_EFFECT];
  let refuseWith = setup.refuseWith;

  await page.route('**/config.json*', (route) =>
    route.fulfill(json({ fineractApiUrl: '/api/v1', defaultTenant: TENANT })),
  );
  await page.route('**/api/v1/authentication**', (route) =>
    route.fulfill(
      json({
        username: 'mifos',
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: 'Head Office',
        roles: [{ id: 1, name: 'Loan Officer', description: 'Loan officer' }],
        permissions: setup.permissions ?? ['ALL_FUNCTIONS'],
      }),
    ),
  );
  await page.route('**/api/v1/businessdate**', (route) =>
    route.fulfill(json([{ type: 'BUSINESS_DATE', date: BUSINESS_DATE }])),
  );
  await page.route(/\/api\/v1\/loans\/\d+\/delinquencytags/, (route) =>
    route.fulfill(
      json([
        { id: 1, classification: 'Delinquent 30', addedOnDate: [2026, 7, 1], liftedOnDate: null },
      ]),
    ),
  );
  await page.route(ACTIONS_URL, async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.fulfill(json([]));
      return;
    }

    const body = request.postDataJSON() as Record<string, unknown>;
    probe.posted.push(body);

    if (refuseWith) {
      const message = refuseWith;
      refuseWith = undefined;
      await route.fulfill(
        json(
          {
            developerMessage: 'The request was invalid.',
            httpStatusCode: '400',
            defaultUserMessage: 'Validation errors exist.',
            userMessageGlobalisationCode: 'validation.msg.validation.errors.exist',
            errors: [{ developerMessage: message, defaultUserMessage: message }],
          },
          400,
        ),
      );
      return;
    }

    periods =
      body['action'] === 'pause'
        ? [
            ...periods,
            { pausePeriodStart: toYmd(body['startDate']), pausePeriodEnd: toYmd(body['endDate']) },
          ]
        : periods.map((period) =>
            isInEffect(period) ? { ...period, pausePeriodEnd: BUSINESS_DATE } : period,
          );
    await route.fulfill(json({ officeId: 1, clientId: 1, loanId: LOAN_ID, resourceId: 900 }));
  });
  await page.route(LOAN_URL, (route) =>
    route.fulfill(
      json({
        id: LOAN_ID,
        accountNo: '000000456',
        clientId: 1,
        clientName: 'Jane Smith',
        loanProductName: 'Business Loan',
        principal: 5000,
        status: setup.status ?? ACTIVE_STATUS,
        currency: { code: 'USD', displaySymbol: '$' },
        timeline: { actualDisbursementDate: [2026, 6, 1] },
        summary: { principalOutstanding: 5000, totalOutstanding: 5000 },
        repaymentSchedule: { periods: [] },
        transactions: [],
        charges: [],
        loanTermVariations: [],
        overdueCharges: [],
        originators: [],
        delinquent: {
          pastDueDays: 34,
          delinquentDays: 31,
          delinquentAmount: 1500,
          nextPaymentDueDate: [2026, 10, 15],
          lastRepaymentDate: [2026, 7, 20],
          delinquencyPausePeriods: periods.map((period) => ({
            ...period,
            active: isInEffect(period),
          })),
        },
      }),
    ),
  );

  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT);
  await page.locator('#username').fill('mifos');
  await page.locator('#password').fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');

  return probe;
}

async function openDelinquencyTab(page: Page): Promise<void> {
  await page.goto(`/loans/view/${LOAN_ID}`);
  await page.getByTestId('loan-tab-delinquency').click();
  await expect(page.getByTestId('loan-past-due-days')).toHaveText('34');
}

const pauseButton = (page: Page) => page.getByTestId('loan-delinquency-pause');
const resumeButton = (page: Page) => page.getByTestId('loan-delinquency-resume');
const dialog = (page: Page) => page.locator('app-loan-delinquency-pause-dialog');

test.describe('Delinquency pause and resume on a regular loan', () => {
  test('shows the dates as dates, and the pause periods under their real fields', async ({
    page,
  }) => {
    await signInWithLoan(page);
    await openDelinquencyTab(page);

    // Summary, tags and pause periods all carry dates; none may read as an array.
    await expect(page.getByText('2026-10-15').first()).toBeVisible();
    await expect(page.getByText('2026-07-20')).toBeVisible();
    await expect(page.getByText('2026-07-01')).toBeVisible();
    await expect(page.getByRole('cell', { name: '2026-09-28' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '2026-08-10' })).toBeVisible();
    await expect(page.getByText('2026,10,15')).toHaveCount(0);
    await expect(page.getByText('In effect', { exact: true })).toBeVisible();
    await expect(page.getByText('Not in effect', { exact: true })).toBeVisible();
  });

  test('pauses delinquency for a period, from the business date', async ({ page }) => {
    const probe = await signInWithLoan(page, { periods: [ENDED] });
    await openDelinquencyTab(page);
    await expect(resumeButton(page)).toHaveCount(0);

    await pauseButton(page).click();
    // A pause starts on the platform's business date, which is not the browser's clock.
    await expect(page.getByTestId('delinquency-pause-start')).toHaveValue('2026-10-01');
    await page.getByTestId('delinquency-pause-end').fill('2026-10-31');
    await page.getByTestId('delinquency-pause-confirm').click();

    await expect.poll(() => probe.posted.length).toBe(1);
    expect(probe.posted[0]).toEqual({
      action: 'pause',
      startDate: '01 October 2026',
      endDate: '31 October 2026',
      dateFormat: 'dd MMMM yyyy',
      locale: 'en',
    });
    await expect(page.getByText('Delinquency paused.')).toBeVisible();
    // The loan was read again: the new period is on the screen and in effect, which is what
    // makes resuming it possible.
    await expect(page.getByRole('cell', { name: '2026-10-31' })).toBeVisible();
    await expect(page.getByText('In effect', { exact: true })).toBeVisible();
    await expect(resumeButton(page)).toBeVisible();
  });

  test('will not take a pause that ends before, or when, it starts', async ({ page }) => {
    const probe = await signInWithLoan(page);
    await openDelinquencyTab(page);

    await pauseButton(page).click();
    const confirm = dialog(page).getByRole('button', { name: 'Confirm' });

    // Nothing chosen for the end yet: nothing to complain about, and nothing to confirm.
    await expect(page.getByTestId('delinquency-pause-order-error')).toHaveCount(0);
    await expect(confirm).toBeDisabled();

    await page.getByTestId('delinquency-pause-end').fill('2026-10-01');
    await expect(page.getByTestId('delinquency-pause-order-error')).toBeVisible();
    await expect(confirm).toBeDisabled();

    await page.getByTestId('delinquency-pause-end').fill('2026-09-15');
    await expect(page.getByTestId('delinquency-pause-order-error')).toBeVisible();
    await expect(confirm).toBeDisabled();

    await page.getByTestId('delinquency-pause-end').fill('2026-10-02');
    await expect(page.getByTestId('delinquency-pause-order-error')).toHaveCount(0);
    await expect(confirm).toBeEnabled();
    expect(probe.posted).toEqual([]);
  });

  test('sends nothing when the pause dialog is cancelled', async ({ page }) => {
    const probe = await signInWithLoan(page);
    await openDelinquencyTab(page);

    await pauseButton(page).click();
    await page.getByTestId('delinquency-pause-end').fill('2026-10-31');
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog(page)).toHaveCount(0);
    expect(probe.posted).toEqual([]);
  });

  test('shows the platform’s own reason when it refuses a pause, and stays usable', async ({
    page,
  }) => {
    const probe = await signInWithLoan(page, {
      refuseWith: 'Delinquency pause period cannot overlap with another pause period',
    });
    await openDelinquencyTab(page);

    await pauseButton(page).click();
    await page.getByTestId('delinquency-pause-end').fill('2026-10-10');
    await page.getByTestId('delinquency-pause-confirm').click();

    await expect(page.getByText(/cannot overlap with another pause period/)).toBeVisible();
    await expect(page.getByText('Delinquency paused.')).toHaveCount(0);
    // Nothing was added, and the screen takes another go.
    await expect(page.getByRole('cell', { name: '2026-10-10' })).toHaveCount(0);
    await expect(pauseButton(page)).toBeEnabled();
    expect(probe.posted).toHaveLength(1);
  });

  test('resumes a pause that is in effect, dated the business date and with no end date', async ({
    page,
  }) => {
    const probe = await signInWithLoan(page);
    await openDelinquencyTab(page);

    await resumeButton(page).click();
    // It names the date before anything is sent.
    await expect(page.getByText('2026-10-01')).toBeVisible();
    expect(probe.posted).toEqual([]);
    await page.getByTestId('confirm-dialog-confirm').click();

    await expect.poll(() => probe.posted.length).toBe(1);
    // No endDate: the platform answers a resume that carries one with a 400.
    expect(probe.posted[0]).toEqual({
      action: 'resume',
      startDate: '01 October 2026',
      dateFormat: 'dd MMMM yyyy',
      locale: 'en',
    });
    await expect(page.getByText('Delinquency resumed.')).toBeVisible();
  });

  test('stops offering resume once the pause has been ended', async ({ page }) => {
    await signInWithLoan(page);
    await openDelinquencyTab(page);

    await resumeButton(page).click();
    await page.getByTestId('confirm-dialog-confirm').click();
    await expect(page.getByText('Delinquency resumed.')).toBeVisible();

    // The platform still reads that period as in effect today, because its last day is inclusive
    // and the resume has moved the end to today. A second resume would be refused, so it is not
    // offered; pausing again still is.
    await expect(resumeButton(page)).toHaveCount(0);
    await expect(pauseButton(page)).toBeVisible();
  });

  test('does not offer resume when no pause is in effect', async ({ page }) => {
    await signInWithLoan(page, { periods: [ENDED] });
    await openDelinquencyTab(page);

    await expect(pauseButton(page)).toBeVisible();
    await expect(resumeButton(page)).toHaveCount(0);
  });

  test('offers neither action without the permission to create a delinquency action', async ({
    page,
  }) => {
    await signInWithLoan(page, { permissions: ['READ_LOAN'] });
    await openDelinquencyTab(page);

    await expect(pauseButton(page)).toHaveCount(0);
    await expect(resumeButton(page)).toHaveCount(0);
    // The reading is still there.
    await expect(page.getByTestId('loan-delinquent-days')).toHaveText('31');
  });

  test('offers the permitted user the actions that permission opens, and no others', async ({
    page,
  }) => {
    await signInWithLoan(page, { permissions: ['READ_LOAN', 'CREATE_DELINQUENCY_ACTION'] });
    await openDelinquencyTab(page);

    await expect(pauseButton(page)).toBeVisible();
    await expect(resumeButton(page)).toBeVisible();
  });

  test('offers neither action on a loan that is not active', async ({ page }) => {
    await signInWithLoan(page, { status: CLOSED_STATUS });
    await openDelinquencyTab(page);

    // The platform: "Delinquency actions can be created only for active loans."
    await expect(pauseButton(page)).toHaveCount(0);
    await expect(resumeButton(page)).toHaveCount(0);
  });
});
