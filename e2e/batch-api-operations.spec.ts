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
 * UI equivalent of Fineract's own `BatchApi.feature` (fineract-e2e-tests-runner), scenario
 * "As a user I would like to run a sample Batch API scenario" (TestRailId C63), whose glue code
 * lives in `BatchApiStepDef.runSampleBatchApiCall()` (fineract-e2e-tests-core).
 *
 * That scenario POSTs a four-step batch through `BatchApiApi` directly: create a client, create a
 * loan referencing the new client by Fineract's `$.clientId` batch-reference syntax, add a charge
 * to the new loan referencing it by `$.loanId`, then read the charge back — asserting every step
 * answers 200. The Backoffice UI's equivalent surface is `/admin/batch-operations`
 * (`BatchOperationsComponent`): a raw JSON-array textarea over the same `POST /batches` endpoint,
 * so the same four-step, reference-chained batch is reproduced here verbatim through that screen
 * rather than re-derived — proving the UI's passthrough (JSON.parse -> BatchAPIService.postBatches)
 * doesn't drop or reshape anything Fineract's own reference substitution depends on.
 *
 * `$.clientId` / `$.loanId` are not this suite's placeholders — they are Fineract's own batch
 * reference syntax, resolved server-side from the referenced step's JSON response body. A batch
 * step's `body` is transmitted as a *string* (not a nested object) for exactly this reason: the
 * reference token has to survive as literal text for the server to substitute, which is why every
 * `body` field below is built with `JSON.stringify` before going into the outer array.
 */

import { devices } from '@playwright/test';
import { test, expect } from './fixtures';
import { login } from './utils/fineract-login';
import {
  createApiContext,
  fineractDate,
  seedLoanCharge,
  seedLoanProduct,
  seedSuffix,
} from './utils/seed-api';

const DATE_FORMAT = 'dd MMMM yyyy';
const LOCALE = 'en';
/** Fineract's batch-request headers; mirrors BatchApiStepDef's HEADER constant verbatim. */
const HEADERS = [{ name: 'Content-type', value: 'text/html' }];

interface BatchStep {
  requestId: number;
  relativeUrl: string;
  method: 'GET' | 'POST';
  reference?: number;
  headers: typeof HEADERS;
  body: string;
}

interface BatchResultSegment {
  requestId: number;
  statusCode: number;
  body?: string;
}

/**
 * Request 1 of every scenario below: create a client, nothing references it yet.
 *
 * `externalId` is optional and, when passed, is this test's own value — not something read back
 * from the response — precisely so a caller can look the client up afterward
 * (`GET /clients/external-id/{id}`) without depending on the create step's response body having
 * come back at all. That distinction turns out to matter: see the enclosingTransaction tests
 * below, where Fineract's response shape itself differs based on how the batch turns out.
 */
function clientCreateStep(firstName: string, today: string, externalId?: string): BatchStep {
  return {
    requestId: 1,
    relativeUrl: 'clients',
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      officeId: 1,
      firstname: firstName,
      lastname: 'Tester',
      legalFormId: 1,
      active: true,
      activationDate: today,
      dateFormat: DATE_FORMAT,
      locale: LOCALE,
      ...(externalId ? { externalId } : {}),
    }),
  };
}

/** Request 2: a loan application against request 1's client, via Fineract's `$.clientId` syntax. */
function loanCreateStep(productId: number, today: string): BatchStep {
  return {
    requestId: 2,
    relativeUrl: 'loans',
    method: 'POST',
    reference: 1,
    headers: HEADERS,
    body: JSON.stringify({
      // Fineract's batch-reference syntax: resolved from request 1's response at submit time,
      // not literal text this test is meant to send as-is.
      clientId: '$.clientId',
      productId,
      principal: 1000,
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
      expectedDisbursementDate: today,
      submittedOnDate: today,
      loanType: 'individual',
      dateFormat: DATE_FORMAT,
      locale: LOCALE,
    }),
  };
}

/**
 * Fills the batch textarea, sets the "Enclose in Transaction" checkbox to match
 * `enclosingTransaction` (the component defaults to unchecked/false), submits, and returns the
 * parsed response segments.
 */
async function submitBatch(
  page: import('@playwright/test').Page,
  steps: BatchStep[],
  enclosingTransaction: boolean,
): Promise<BatchResultSegment[]> {
  await page
    .locator('ion-textarea[data-testid="batch-operations-input"] textarea')
    .fill(JSON.stringify(steps));

  const enclose = page.locator('ion-checkbox[data-testid="batch-operations-enclose"]');
  const isChecked = await enclose.evaluate((el: HTMLElement & { checked?: boolean }) =>
    Boolean(el.checked),
  );
  if (isChecked !== enclosingTransaction) {
    await enclose.click();
  }

  const batchResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/batches') &&
      response.request().method() === 'POST' &&
      response.url().includes(`enclosingTransaction=${enclosingTransaction}`),
  );
  await page.getByTestId('batch-operations-submit').click();
  const response = await batchResponse;
  expect(response.ok()).toBe(true);
  return (await response.json()) as BatchResultSegment[];
}

test.describe('Batch API Operations against Fineract', () => {
  test('runs the sample batch scenario — create client, create loan, add and read back a charge', async ({
    page,
  }) => {
    const api = await createApiContext();
    const product = await seedLoanProduct(api, 'E2EBatch');
    const charge = await seedLoanCharge(api, 'E2EBatch');
    await api.dispose();

    const today = fineractDate();
    const firstName = `E2EBatch${seedSuffix()}`;
    const dueDate = today;

    const steps: BatchStep[] = [
      clientCreateStep(firstName, today),
      loanCreateStep(product.productId, today),
      {
        requestId: 3,
        // Same reference syntax in the URL itself: request 2's loanId, not literal text.
        relativeUrl: 'loans/$.loanId/charges',
        method: 'POST',
        reference: 2,
        headers: HEADERS,
        body: JSON.stringify({
          chargeId: charge.chargeId,
          amount: 25,
          dueDate,
          dateFormat: DATE_FORMAT,
          locale: LOCALE,
        }),
      },
      {
        requestId: 4,
        relativeUrl: 'loans/$.loanId/charges',
        method: 'GET',
        reference: 2,
        headers: HEADERS,
        body: '{}',
      },
    ];

    await login(page);
    await page.goto('/admin/batch-operations');
    await expect(page.locator('ion-card-title').first()).toContainText('Batch API Operations');

    const segments = await submitBatch(page, steps, false);
    expect(segments).toHaveLength(4);
    // Mirrors BatchApiStepDef's `adminChecksThatAllStepsResultOK` exactly: every segment 200.
    for (const segment of segments) {
      expect(
        segment.statusCode,
        `request ${segment.requestId} did not return 200: ${segment.body}`,
      ).toBe(200);
    }

    // The business fact the reference chain exists to prove: the charge Fineract attached is on
    // the loan the batch itself just created, not a coincidental 200 with the wrong data behind
    // it. Segment 4 is the GET of $.loanId/charges from segment 2's newly created loan.
    const chargesSegment = segments.find((s) => s.requestId === 4)!;
    const charges = JSON.parse(chargesSegment.body ?? '[]') as { name: string; amount: number }[];
    expect(charges.some((c) => c.name === charge.name && c.amount === 25)).toBe(true);

    // And the UI itself rendered a result, not just the network call succeeding underneath it.
    const results = page.getByTestId('batch-operations-results');
    await expect(results).toBeVisible();
    await expect(results).toContainText('"statusCode": 200');
    await expect(page.getByTestId('batch-operations-error')).toHaveCount(0);
  });

  test('shows a parse error instead of submitting when the batch input is not valid JSON', async ({
    page,
  }) => {
    await login(page);
    await page.goto('/admin/batch-operations');

    await page
      .locator('ion-textarea[data-testid="batch-operations-input"] textarea')
      .fill('{ not: valid JSON ]');

    const batchRequest = page.waitForRequest(
      (request) => request.url().includes('/batches') && request.method() === 'POST',
      { timeout: 2000 },
    );
    await page.getByTestId('batch-operations-submit').click();

    await expect(page.getByTestId('batch-operations-error')).toBeVisible();
    await expect(page.getByTestId('batch-operations-results')).toHaveCount(0);
    await expect(batchRequest).rejects.toThrow();
  });
});

/**
 * `enclosingTransaction`'s actual effect: Fineract's own suite proves it not by trusting the
 * per-segment status codes — a step that ran and would have succeeded still reports 200 in the
 * response body even when a later step forces the whole transaction to roll back — but by an
 * independent lookup afterward (`BatchApiStepDef`'s `retrieveOneClientByExternalId`, here a plain
 * GET on the id the create-client segment reported). C2640–C2643 cover both the true/false split
 * and the succeed/fail split; these two specs are the fail half of each, since that is the only
 * half where the two settings actually produce different, observable outcomes — the "all steps
 * succeed" half already has a case in the sample-scenario test above.
 */
test.describe('Batch API enclosingTransaction semantics against Fineract', () => {
  /** Guaranteed to 404 inside the batch without disturbing anything else in the tenant. */
  const FAILING_STEP: BatchStep = {
    requestId: 3,
    relativeUrl: 'loans/999999999?command=approve',
    method: 'POST',
    reference: 2,
    headers: HEADERS,
    body: '{}',
  };

  /**
   * Runs client-create -> loan-create -> a guaranteed-404 step, and returns the *externalId* this
   * test chose for the client rather than an id parsed out of a response segment.
   *
   * That choice is load-bearing, not stylistic: empirically, when `enclosingTransaction: true`
   * and a later step fails, Fineract's response is a single-element array — just the failing
   * segment, none of the earlier ones that "succeeded" before the rollback. The Java step
   * definitions this mirrors sidestep the same problem the same way (external ids, not the
   * response body) for the same reason; discovering that empirically here rather than assuming
   * the false-case response shape also holds for the true case is what this comment is recording.
   */
  async function runClientLoanThenFailingStep(
    page: import('@playwright/test').Page,
    enclosingTransaction: boolean,
  ): Promise<{ segments: BatchResultSegment[]; clientExternalId: string }> {
    const api = await createApiContext();
    const product = await seedLoanProduct(api, 'E2EBatchTx');
    await api.dispose();

    const today = fineractDate();
    const firstName = `E2EBatchTx${seedSuffix()}`;
    const clientExternalId = globalThis.crypto.randomUUID();
    const steps: BatchStep[] = [
      clientCreateStep(firstName, today, clientExternalId),
      loanCreateStep(product.productId, today),
      FAILING_STEP,
    ];

    await login(page);
    await page.goto('/admin/batch-operations');
    const segments = await submitBatch(page, steps, enclosingTransaction);

    const approveSegment = segments.find((s) => s.requestId === 3)!;
    expect(approveSegment, 'no segment for the failing step at all').toBeTruthy();
    expect(approveSegment.statusCode).toBe(404);

    return { segments, clientExternalId };
  }

  async function clientExists(externalId: string): Promise<boolean> {
    const api = await createApiContext();
    const check = await api.get(
      `https://localhost:8443/fineract-provider/api/v1/clients/external-id/${externalId}`,
      { ignoreHTTPSErrors: true },
    );
    await api.dispose();
    return check.ok();
  }

  test('rolls back the earlier steps when enclosingTransaction is true and a later step fails', async ({
    page,
  }) => {
    const { segments, clientExternalId } = await runClientLoanThenFailingStep(page, true);

    // The distinctive shape of a rolled-back enclosing transaction: only the failing segment
    // comes back at all, not a full 3-entry array with the earlier ones marked 200.
    expect(segments).toHaveLength(1);

    expect(
      await clientExists(clientExternalId),
      'client from a rolled-back enclosing transaction still exists',
    ).toBe(false);
  });

  test('does not roll back the earlier steps when enclosingTransaction is false and a later step fails', async ({
    page,
  }) => {
    const { segments, clientExternalId } = await runClientLoanThenFailingStep(page, false);

    // Contrasting shape: every step ran independently, so all three are reported, with the first
    // two genuinely 200 rather than a rolled-back 200.
    expect(segments).toHaveLength(3);
    const clientSegment = segments.find((s) => s.requestId === 1)!;
    expect(clientSegment.statusCode).toBe(200);

    // The contrasting outcome: with no enclosing transaction, each step commits independently, so
    // the client created before the failing step persists despite it.
    expect(
      await clientExists(clientExternalId),
      'client should persist when enclosingTransaction is false',
    ).toBe(true);
  });
});

/**
 * The same sample scenario as the very first test in this file, run again at a real mobile
 * viewport rather than resized-desktop — Pixel 7's dimensions and touch flags, the same profile
 * the project-level `mobile` Playwright project uses for `mobile-shell.spec.ts`. Kept in the
 * `backend` project (not `mobile`) via `test.use()` rather than as a `MOBILE_SPECS` entry, since
 * this needs the real backend + seeding `dependencies: ['setup']` wires up for `backend`, which
 * the `mobile` project deliberately does not carry.
 *
 * `BatchOperationsComponent` has no viewport-conditional template or breakpoint of its own — one
 * card, one full-width textarea — so unlike the paginator/stepper bugs found elsewhere in this
 * codebase, there is no *known* mobile-only failure mode to target here. What this proves instead
 * is the more basic thing that turned out not to be true for several other screens this session:
 * that the input, the checkbox, and the submit button are all genuinely reachable and operable by
 * touch at 412px, and that a real multi-step batch submitted that way still round-trips correctly
 * against the backend — not just that the page renders without visibly breaking.
 */
test.describe('Batch API Operations on a mobile viewport against Fineract', () => {
  // Everything but `defaultBrowserType`, which `test.use()` inside a describe block refuses —
  // it forces a new browser, not just a new context, so it is only valid at the project level.
  test.use({
    userAgent: devices['Pixel 7'].userAgent,
    viewport: devices['Pixel 7'].viewport,
    deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor,
    isMobile: devices['Pixel 7'].isMobile,
    hasTouch: devices['Pixel 7'].hasTouch,
  });

  test('the sample batch scenario is reachable and works by touch at mobile width', async ({
    page,
  }) => {
    const api = await createApiContext();
    const product = await seedLoanProduct(api, 'E2EBatchMobile');
    const charge = await seedLoanCharge(api, 'E2EBatchMobile');
    await api.dispose();

    const today = fineractDate();
    const firstName = `E2EBatchMobile${seedSuffix()}`;
    const steps: BatchStep[] = [
      clientCreateStep(firstName, today),
      loanCreateStep(product.productId, today),
      {
        requestId: 3,
        relativeUrl: 'loans/$.loanId/charges',
        method: 'POST',
        reference: 2,
        headers: HEADERS,
        body: JSON.stringify({
          chargeId: charge.chargeId,
          amount: 25,
          dueDate: today,
          dateFormat: DATE_FORMAT,
          locale: LOCALE,
        }),
      },
      {
        requestId: 4,
        relativeUrl: 'loans/$.loanId/charges',
        method: 'GET',
        reference: 2,
        headers: HEADERS,
        body: '{}',
      },
    ];

    await login(page);
    await page.goto('/admin/batch-operations');

    // Reachable and not clipped off-screen — the exact class of bug this session found in the
    // mobile stepper and mobile paginator elsewhere in this app (overflow-x: visible on an
    // ancestor, content rendered past the viewport edge with no way to reach it).
    const input = page.locator('ion-textarea[data-testid="batch-operations-input"] textarea');
    const submit = page.getByTestId('batch-operations-submit');
    const enclose = page.locator('ion-checkbox[data-testid="batch-operations-enclose"]');
    await expect(input).toBeVisible();
    await expect(submit).toBeVisible();
    await expect(enclose).toBeVisible();
    for (const control of [input, submit, enclose]) {
      const box = await control.boundingBox();
      expect(box, 'control has no layout box — likely display:none or zero-size').not.toBeNull();
      expect(box!.x + box!.width, 'control extends past the 412px viewport').toBeLessThanOrEqual(
        412,
      );
    }

    const segments = await submitBatch(page, steps, false);
    expect(segments).toHaveLength(4);
    for (const segment of segments) {
      expect(
        segment.statusCode,
        `request ${segment.requestId} did not return 200: ${segment.body}`,
      ).toBe(200);
    }

    const chargesSegment = segments.find((s) => s.requestId === 4)!;
    const charges = JSON.parse(chargesSegment.body ?? '[]') as { name: string; amount: number }[];
    expect(charges.some((c) => c.name === charge.name && c.amount === 25)).toBe(true);

    const results = page.getByTestId('batch-operations-results');
    await expect(results).toBeVisible();
    // The other half of "not clipped": the results card itself must not force the page wider
    // than the viewport, the same overflow check bug #27 (mobile paginator) failed on elsewhere.
    const overflowsViewport = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowsViewport, 'page scrolls horizontally at mobile width').toBe(false);
  });
});
