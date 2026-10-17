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
 * Builds e2e fixture data directly against the Fineract REST API.
 *
 * The loan specs used to assemble their own prerequisites by driving the UI —
 * filling the client form, then the product form, then the loan form. That made
 * every one of them depend on the whole chain: a single flaky control failed the
 * test for a reason unrelated to what it was asserting. The client-search
 * dropdown was the usual culprit, since a newly created client is not always
 * returned by the search endpoint straight away.
 *
 * Seeding over HTTP removes that coupling. Setup is deterministic and takes
 * about a second, and the UI assertions are left to test only the behaviour they
 * name.
 *
 * Talks to the backend directly rather than through the dev-server proxy: this
 * runs in Node, where a relative path has nothing to resolve against.
 */

import { randomInt } from 'node:crypto';
import { APIRequestContext, APIResponse, request as playwrightRequest } from '@playwright/test';

import { API_BASE, PASSWORD, TENANT_ID, USERNAME, assertBackendReachable } from './backend-env';

export { API_BASE };
/** Kept as `TENANT` for the existing call sites; `TENANT_ID` is the canonical name. */
export const TENANT = TENANT_ID;

const DATE_FORMAT = 'dd MMMM yyyy';
const LOCALE = 'en';
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

/** Fineract expects `dd MMMM yyyy` when `dateFormat` is set as above. */
export function fineractDate(d: Date = new Date()): string {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Short random token; loan product shortName is capped at 4 characters. */
export function seedSuffix(): string {
  return Date.now().toString(36).slice(-6);
}

export async function createApiContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    // No baseURL: a leading-slash path resolves against the origin only, which
    // would drop the /fineract-provider/api/v1 prefix. post() builds full URLs.
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      'Fineract-Platform-TenantId': TENANT,
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}`,
    },
  });
}

async function post<T>(api: APIRequestContext, path: string, body: unknown): Promise<T> {
  const res = await api.post(`${API_BASE}${path}`, { data: body });
  if (!res.ok()) {
    throw new Error(`POST ${path} -> ${res.status()}: ${(await res.text()).slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

async function get<T>(api: APIRequestContext, path: string): Promise<T> {
  const res = await api.get(`${API_BASE}${path}`);
  if (!res.ok()) {
    throw new Error(`GET ${path} -> ${res.status()}: ${(await res.text()).slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

/**
 * Brings a bare Fineract up to the baseline the specs assume, once per run.
 *
 * Everything here is checked before it is created, because the compose stack keeps
 * its database in a named volume: the second run of the day starts from whatever the
 * first one left behind, not from a migration-fresh instance.
 *
 * The currency step is the one that actually matters. Fineract ships 163 currency
 * definitions but *enables* only what is in `m_organisation_currency`, and a loan
 * product cannot be created in a currency that is not enabled — which surfaces as an
 * unhelpful validation error on the product form rather than as anything about
 * currencies.
 */
export async function ensureReferenceData(api: APIRequestContext): Promise<void> {
  await assertBackendReachable(api);

  const currencies = await get<{ selectedCurrencyOptions?: { code: string }[] }>(
    api,
    '/currencies',
  );
  const enabled = (currencies.selectedCurrencyOptions ?? []).map((c) => c.code);
  if (!enabled.includes('USD')) {
    await put(api, '/currencies', { currencies: [...enabled, 'USD'] });
  }

  const paymentTypes = await get<unknown[]>(api, '/paymenttypes');
  if (paymentTypes.length === 0) {
    await post(api, '/paymenttypes', {
      name: 'E2E Cash',
      description: 'Seeded by the e2e suite',
      isCashPayment: true,
      position: 1,
    });
  }
}

async function put<T>(api: APIRequestContext, path: string, body: unknown): Promise<T> {
  const res = await api.put(`${API_BASE}${path}`, { data: body });
  if (!res.ok()) {
    throw new Error(`PUT ${path} -> ${res.status()}: ${(await res.text()).slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

/**
 * A datatable registered against `m_loan`, so the loan view's Custom Fields tab has
 * something to show. Without one the tab renders SYSTEM.NO_DATA_TABLES_REGISTERED
 * and the demo's "add an entry" step silently does nothing.
 *
 * Reuses an existing e2e table rather than adding one per run — registered datatables
 * are DDL, so accumulating them would leave real tables behind in the volume.
 */
export async function seedLoanDatatable(api: APIRequestContext): Promise<string> {
  const existing = await get<{ registeredTableName: string; applicationTableName: string }[]>(
    api,
    '/datatables',
  );
  const found = existing.find(
    (t) => t.applicationTableName === 'm_loan' && t.registeredTableName.startsWith('e2e_loan_'),
  );
  if (found) {
    return found.registeredTableName;
  }

  const datatableName = `e2e_loan_remarks_${seedSuffix()}`;
  await post(api, '/datatables', {
    datatableName,
    apptableName: 'm_loan',
    multiRow: true,
    columns: [{ name: 'Remark', type: 'String', length: 200, mandatory: false }],
  });
  return datatableName;
}

/**
 * A collateral type for the loan Collateral form.
 *
 * Note this is *not* the same thing as a collateral product: the loan form's Type
 * dropdown is filled from GET /loans/{id}/collaterals/template, which returns the
 * code values of the `LoanCollateral` code — a bare Fineract defines the code but
 * leaves it empty, so the dropdown opens with nothing in it. Client collateral is
 * the one that uses /collateral-management.
 */
export async function seedLoanCollateralType(api: APIRequestContext): Promise<void> {
  const codes = await get<{ id: number; name: string }[]>(api, '/codes');
  const loanCollateral = codes.find((c) => c.name === 'LoanCollateral');
  if (!loanCollateral) return;

  const values = await get<unknown[]>(api, `/codes/${loanCollateral.id}/codevalues`);
  if (values.length > 0) return;

  await post(api, `/codes/${loanCollateral.id}/codevalues`, {
    name: 'E2E Gold',
    position: 0,
    isActive: true,
  });
}

/**
 * A collateral product, used by *client* collateral (/collateral-management).
 */
export async function seedCollateralProduct(api: APIRequestContext): Promise<number> {
  const existing = await get<{ id: number }[]>(api, '/collateral-management');
  if (existing.length > 0) {
    return existing[0].id;
  }

  const { resourceId } = await post<{ resourceId: number }>(api, '/collateral-management', {
    name: `E2E Gold ${seedSuffix()}`,
    quality: 'Fine',
    basePrice: 1000,
    pctToBase: 80,
    unitType: 'Grams',
    currency: 'USD',
    locale: LOCALE,
  });
  return resourceId;
}

export interface SeededCharge {
  chargeId: number;
  name: string;
}

/**
 * A flat, specified-due-date loan charge. `chargeAppliesTo: 1` is LOAN — not CLIENT, despite what
 * a stale comment on the accounting charge form's default suggests; see
 * `ChargeAppliesTo.java`/`ChargeTimeType.java`/`ChargeCalculationType.java` in the Fineract
 * backend for the enum this mirrors.
 */
export async function seedLoanCharge(
  api: APIRequestContext,
  namePrefix = 'E2ESeed',
  amount = 25,
): Promise<SeededCharge> {
  const name = `${namePrefix} Charge ${seedSuffix()}`;
  const { resourceId } = await post<{ resourceId: number }>(api, '/charges', {
    name,
    amount,
    currencyCode: 'USD',
    chargeAppliesTo: 1, // LOAN
    chargeTimeType: 2, // SPECIFIED_DUE_DATE
    chargeCalculationType: 1, // FLAT
    chargePaymentMode: 0, // REGULAR
    penalty: false,
    active: true,
    locale: LOCALE,
  });
  return { chargeId: resourceId, name };
}

export interface SeededOffice {
  officeId: number;
  officeName: string;
}

/**
 * A branch office under Head Office.
 *
 * A bare Fineract ships with exactly one office, so any screen that asks the user to
 * pick a branch has a single-entry dropdown and demonstrates nothing. Seeding a second
 * one gives those pickers something to actually choose between.
 */
export async function seedOffice(
  api: APIRequestContext,
  namePrefix = 'E2ESeed',
  parentId = 1,
): Promise<SeededOffice> {
  const officeName = `${namePrefix} Branch ${seedSuffix()}`;
  const { officeId } = await post<{ officeId: number }>(api, '/offices', {
    name: officeName,
    parentId,
    // Backdated so it is never rejected as being in the future relative to the
    // instance's business date.
    openingDate: '01 January 2020',
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
  return { officeId, officeName };
}

export interface SeededClient {
  clientId: number;
  firstName: string;
  lastName: string;
  displayName: string;
}

export async function seedClient(
  api: APIRequestContext,
  namePrefix = 'E2ESeed',
  officeId = 1,
): Promise<SeededClient> {
  const firstName = `${namePrefix}${seedSuffix()}`;
  const lastName = 'Tester';
  const { clientId } = await post<{ clientId: number }>(api, '/clients', {
    officeId,
    firstname: firstName,
    lastname: lastName,
    legalFormId: 1,
    active: true,
    activationDate: fineractDate(),
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
  return { clientId, firstName, lastName, displayName: `${firstName} ${lastName}` };
}

export async function seedEntityClient(
  api: APIRequestContext,
  namePrefix = 'E2ESeedEntity',
  officeId = 1,
): Promise<SeededClient> {
  const fullname = `${namePrefix}${seedSuffix()} Pvt Ltd`;
  const { clientId } = await post<{ clientId: number }>(api, '/clients', {
    officeId,
    fullname,
    legalFormId: 2,
    active: true,
    activationDate: fineractDate(),
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
  return { clientId, firstName: fullname, lastName: '', displayName: fullname };
}

export interface SeededFixedDeposit {
  accountId: number;
  clientId: number;
  clientName: string;
  productName: string;
}

/**
 * Seeds a client, a fixed deposit product and a deposit account left **pending approval**.
 *
 * Seeded rather than driven through the screens because what the servicing spec is about starts
 * where this stops: an account that exists and cannot be operated. The deposit product and
 * account forms have their own coverage, and re-walking them here would mean a failure in the
 * interest-rate chart reads as a broken approve button.
 *
 * The chart is the fiddly part. A slab has to span the account's deposit period in the *same*
 * unit, or the account is refused with `no.applicable.interest.rate.is.found.based.on.amount.and.
 * deposit.period` — periodType 2 is months, matching `depositPeriodFrequencyId: 2`.
 */
export async function seedFixedDepositAccount(
  api: APIRequestContext,
  namePrefix = 'E2EDeposit',
): Promise<SeededFixedDeposit> {
  const client = await seedClient(api, namePrefix);
  const suffix = seedSuffix();
  const productName = `${namePrefix} FD ${suffix}`;

  const { resourceId: productId } = await post<{ resourceId: number }>(
    api,
    '/fixeddepositproducts',
    {
      name: productName,
      shortName: suffix.slice(-4).toUpperCase(),
      description: 'Seeded for deposit servicing coverage',
      currencyCode: 'USD',
      digitsAfterDecimal: 2,
      inMultiplesOf: 0,
      interestCompoundingPeriodType: 4,
      interestPostingPeriodType: 4,
      interestCalculationType: 1,
      interestCalculationDaysInYearType: 365,
      minDepositTerm: 1,
      minDepositTermTypeId: 2,
      preClosurePenalApplicable: false,
      accountingRule: 1,
      depositAmount: 1000,
      minDepositAmount: 100,
      maxDepositAmount: 100000,
      locale: LOCALE,
      charts: [
        {
          fromDate: fineractDate(),
          dateFormat: DATE_FORMAT,
          locale: LOCALE,
          chartSlabs: [
            {
              periodType: 2,
              fromPeriod: 1,
              toPeriod: 60,
              annualInterestRate: 5,
              description: 'Seeded slab',
              locale: LOCALE,
            },
          ],
        },
      ],
    },
  );

  const { resourceId: accountId } = await post<{ resourceId: number }>(
    api,
    '/fixeddepositaccounts',
    {
      clientId: client.clientId,
      productId,
      submittedOnDate: fineractDate(),
      dateFormat: DATE_FORMAT,
      locale: LOCALE,
      depositAmount: 1000,
      depositPeriod: 12,
      depositPeriodFrequencyId: 2,
      interestCompoundingPeriodType: 4,
      interestPostingPeriodType: 4,
      interestCalculationType: 1,
      interestCalculationDaysInYearType: 365,
    },
  );

  return { accountId, clientId: client.clientId, clientName: client.displayName, productName };
}

export interface SeededShareAccount {
  accountId: number;
  clientName: string;
  productName: string;
}

export interface SeededSavingsAccount {
  savingsId: number;
  clientId: number;
  clientName: string;
}

/**
 * Seeds a client and an **active** savings account carrying one deposit and one hold.
 *
 * Both transactions matter to what this seeds for: a deposit is the only kind of row that can be
 * reversed, and a hold is the only kind that can be released. They also go through different
 * endpoints — a hold is `POST /savingsaccounts/{id}/transactions?command=holdAmount`, takes
 * `transactionAmount` rather than `amount`, and needs a `reasonForBlock` from the
 * `SavingsAccountBlockReasons` code.
 */
/**
 * Seeds a client and a savings account left in `Submitted and pending approval`.
 *
 * The state in which the platform refuses a deposit or a withdrawal:
 *
 *     POST /savingsaccounts/{id}/transactions?command=deposit
 *     400 error.msg.savingsaccount.transaction.account.is.not.active
 *
 * Note this is an ordinary savings account, not a deposit product — a fixed deposit in the same
 * status answers a different error (`Fixed Depositaccount deposit transaction not allowed`),
 * from a different code path.
 */
export async function seedSubmittedSavingsAccount(
  api: APIRequestContext,
  namePrefix = 'E2ESavings',
): Promise<SeededSavingsAccount> {
  const client = await seedClient(api, namePrefix);
  const suffix = seedSuffix();

  const { resourceId: productId } = await post<{ resourceId: number }>(api, '/savingsproducts', {
    name: `${namePrefix} Savings ${suffix}`,
    shortName: `V${suffix.slice(-3).toUpperCase()}`,
    description: 'Seeded for savings transaction coverage',
    currencyCode: 'USD',
    digitsAfterDecimal: 2,
    inMultiplesOf: 0,
    nominalAnnualInterestRate: 5,
    interestCompoundingPeriodType: 1,
    interestPostingPeriodType: 4,
    interestCalculationType: 1,
    interestCalculationDaysInYearType: 365,
    accountingRule: 1,
    locale: LOCALE,
  });

  const { savingsId } = await post<{ savingsId: number }>(api, '/savingsaccounts', {
    clientId: client.clientId,
    productId,
    submittedOnDate: fineractDate(),
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });

  return { savingsId, clientId: client.clientId, clientName: client.displayName };
}

/** Approves and activates a savings account, which is what makes transactions legal on it. */
export async function activateSavingsAccount(
  api: APIRequestContext,
  savingsId: number,
): Promise<void> {
  for (const [command, field] of [
    ['approve', 'approvedOnDate'],
    ['activate', 'activatedOnDate'],
  ] as const) {
    await post(api, `/savingsaccounts/${savingsId}?command=${command}`, {
      [field]: fineractDate(),
      dateFormat: DATE_FORMAT,
      locale: LOCALE,
    });
  }
}

export async function seedSavingsAccountWithTransactions(
  api: APIRequestContext,
  namePrefix = 'E2ESavings',
): Promise<SeededSavingsAccount> {
  const seeded = await seedSubmittedSavingsAccount(api, namePrefix);
  const { savingsId } = seeded;
  const today = fineractDate();

  await activateSavingsAccount(api, savingsId);

  await post(api, `/savingsaccounts/${savingsId}/transactions?command=deposit`, {
    transactionDate: today,
    transactionAmount: 500,
    paymentTypeId: 1,
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
  await post(api, `/savingsaccounts/${savingsId}/transactions?command=holdAmount`, {
    transactionDate: today,
    transactionAmount: 100,
    reasonForBlock: 1,
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });

  return seeded;
}

/**
 * Seeds a client, a savings account, a share product and a share account pending approval.
 *
 * The savings account is not optional scaffolding: `savingsAccountId` is mandatory on a share
 * account, because that is where dividends are paid, and it has to be **active** before the share
 * account will activate.
 *
 * Two of the share product's fields are easy to get wrong and answer with validation rather than
 * anything descriptive: `nominalShares` is mandatory, and `minimumactiveperiodFrequencyType` must
 * be 0 when there is no minimum active period.
 */
export async function seedShareAccount(
  api: APIRequestContext,
  namePrefix = 'E2EShare',
): Promise<SeededShareAccount> {
  const client = await seedClient(api, namePrefix);
  const suffix = seedSuffix();
  const today = fineractDate();

  const { resourceId: savingsProductId } = await post<{ resourceId: number }>(
    api,
    '/savingsproducts',
    {
      name: `${namePrefix} Savings ${suffix}`,
      shortName: `S${suffix.slice(-3).toUpperCase()}`,
      description: 'Dividend destination for the share account',
      currencyCode: 'USD',
      digitsAfterDecimal: 2,
      inMultiplesOf: 0,
      nominalAnnualInterestRate: 5,
      interestCompoundingPeriodType: 1,
      interestPostingPeriodType: 4,
      interestCalculationType: 1,
      interestCalculationDaysInYearType: 365,
      accountingRule: 1,
      locale: LOCALE,
    },
  );

  const { savingsId } = await post<{ savingsId: number }>(api, '/savingsaccounts', {
    clientId: client.clientId,
    productId: savingsProductId,
    submittedOnDate: today,
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
  for (const [command, field] of [
    ['approve', 'approvedOnDate'],
    ['activate', 'activatedOnDate'],
  ] as const) {
    await post(api, `/savingsaccounts/${savingsId}?command=${command}`, {
      [field]: today,
      dateFormat: DATE_FORMAT,
      locale: LOCALE,
    });
  }

  const productName = `${namePrefix} Shares ${suffix}`;
  const { resourceId: productId } = await post<{ resourceId: number }>(api, '/products/share', {
    name: productName,
    shortName: `H${suffix.slice(-3).toUpperCase()}`,
    description: 'Seeded for share account servicing coverage',
    currencyCode: 'USD',
    digitsAfterDecimal: 2,
    totalShares: 10000,
    sharesIssued: 10000,
    nominalShares: 10000,
    unitPrice: 10,
    minimumActivePeriodForDividends: 0,
    minimumactiveperiodFrequencyType: 0,
    lockinPeriodFrequency: 0,
    lockinPeriodFrequencyType: 0,
    allowDividendCalculationForInactiveClients: true,
    accountingRule: 1,
    locale: LOCALE,
  });

  const { resourceId: accountId } = await post<{ resourceId: number }>(api, '/accounts/share', {
    clientId: client.clientId,
    productId,
    savingsAccountId: savingsId,
    submittedDate: today,
    applicationDate: today,
    requestedShares: 100,
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });

  return { accountId, clientName: client.displayName, productName };
}

export interface SeededLoanProduct {
  productId: number;
  productName: string;
}

/**
 * Fineract's default payment allocation order, in the order the loan product
 * template returns it (GET /loanproducts/template -> advancedPaymentAllocationTypes).
 */
const ADVANCED_PAYMENT_ALLOCATION_ORDER = [
  'PAST_DUE_PENALTY',
  'PAST_DUE_FEE',
  'PAST_DUE_PRINCIPAL',
  'PAST_DUE_INTEREST',
  'DUE_PENALTY',
  'DUE_FEE',
  'DUE_PRINCIPAL',
  'DUE_INTEREST',
  'IN_ADVANCE_PENALTY',
  'IN_ADVANCE_FEE',
  'IN_ADVANCE_PRINCIPAL',
  'IN_ADVANCE_INTEREST',
];

/**
 * `isProgressive` switches the product to the progressive schedule + advanced
 * payment allocation pairing, which Fineract requires together.
 */
export async function seedLoanProduct(
  api: APIRequestContext,
  namePrefix = 'E2ESeed',
  isProgressive = false,
): Promise<SeededLoanProduct> {
  const suffix = seedSuffix();
  const productName = `${namePrefix} Product ${suffix}`;
  const body: Record<string, unknown> = {
    name: productName,
    shortName: suffix.slice(-4).toUpperCase(),
    currencyCode: 'USD',
    digitsAfterDecimal: 2,
    principal: 1000,
    numberOfRepayments: 3,
    repaymentEvery: 1,
    repaymentFrequencyType: 2,
    interestRatePerPeriod: 10,
    interestRateFrequencyType: 2,
    amortizationType: 1,
    interestType: 0,
    interestCalculationPeriodType: 1,
    accountingRule: 1,
    daysInYearType: 1,
    daysInMonthType: 1,
    isInterestRecalculationEnabled: false,
    transactionProcessingStrategyCode: isProgressive
      ? 'advanced-payment-allocation-strategy'
      : 'mifos-standard-strategy',
    locale: LOCALE,
    dateFormat: DATE_FORMAT,
  };
  if (isProgressive) {
    body['loanScheduleType'] = 'PROGRESSIVE';
    body['loanScheduleProcessingType'] = 'HORIZONTAL';
    // Fineract rejects the advanced-payment-allocation strategy outright unless a
    // DEFAULT allocation accompanies it ("no DEFAULT payment allocation was
    // provided"). This mirrors buildDefaultPaymentAllocation() in
    // features/products/loan-product-form.component.ts, so a seeded product matches
    // what the form would have created.
    body['paymentAllocation'] = [
      {
        transactionType: 'DEFAULT',
        futureInstallmentAllocationRule: 'NEXT_INSTALLMENT',
        paymentAllocationOrder: ADVANCED_PAYMENT_ALLOCATION_ORDER.map((rule, index) => ({
          order: index + 1,
          paymentAllocationRule: rule,
        })),
      },
    ];
  }
  const { resourceId } = await post<{ resourceId: number }>(api, '/loanproducts', body);
  return { productId: resourceId, productName };
}

export interface SeededLoan extends SeededClient, SeededLoanProduct {
  loanId: number;
}

/**
 * Creates a client, a loan product and a loan application, and **stops there** — the loan is left
 * in `Submitted and pending approval`.
 *
 * This is the state in which the platform refuses a repayment outright:
 *
 *     POST /loans/{id}/transactions?command=repayment
 *     400 error.msg.loan.must.be.active.fully.paid.or.overpaid
 *
 * so it is the starting point for anything asserting on what a non-active loan may be offered.
 */
export async function seedSubmittedLoan(
  api: APIRequestContext,
  namePrefix = 'E2ESeed',
): Promise<SeededLoan> {
  const client = await seedClient(api, namePrefix);
  const product = await seedLoanProduct(api, namePrefix);
  const today = fineractDate();

  const { loanId } = await post<{ loanId: number }>(api, '/loans', {
    clientId: client.clientId,
    productId: product.productId,
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
  });

  return { ...client, ...product, loanId };
}

/** Approves a loan application. Separate from the seeding so a spec can watch the state change. */
export async function approveLoan(api: APIRequestContext, loanId: number): Promise<void> {
  await post(api, `/loans/${loanId}?command=approve`, {
    approvedOnDate: fineractDate(),
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
}

/** Disburses an approved loan, which is what makes it Active. */
export async function disburseLoan(api: APIRequestContext, loanId: number): Promise<void> {
  await post(api, `/loans/${loanId}?command=disburse`, {
    actualDisbursementDate: fineractDate(),
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
}

/** A Working Capital loan seeded through the API, already Active. */
export interface SeededWorkingCapitalLoan {
  readonly clientId: number;
  readonly productId: number;
  readonly loanId: number;
  readonly principal: number;
}

/**
 * Creates a Working Capital loan product.
 *
 * Every field here is one the platform insisted on; the payload was arrived at by posting and
 * reading the validation errors back, against the image `deploy/docker-compose-e2e.yml` runs.
 * Three of them are worth knowing about:
 *
 *  - `paymentAllocation` is mandatory, and its six rules must cover every allocation type the
 *    product template offers. A short list is rejected.
 *  - `npvDayCount` is mandatory under the `EIR` amortization type, which is what makes the
 *    schedule solvable.
 *  - `principal`, `periodPaymentRate`, `repaymentEvery` and `repaymentFrequencyType` are product
 *    defaults, and the product does **not** allow the loan application to override the last two:
 *    sending them on the loan answers `repaymentEvery.override.not.allowed.by.product`.
 */
export async function seedWorkingCapitalLoanProduct(
  api: APIRequestContext,
  namePrefix = 'E2EWc',
): Promise<number> {
  const suffix = seedSuffix();
  const allocationRules = [
    'DUE_PENALTY',
    'DUE_FEE',
    'DUE_PRINCIPAL',
    'IN_ADVANCE_PENALTY',
    'IN_ADVANCE_FEE',
    'IN_ADVANCE_PRINCIPAL',
  ];
  const { resourceId } = await post<{ resourceId: number }>(api, '/working-capital-loan-products', {
    name: `${namePrefix} Product ${suffix}`,
    // Fineract caps the short name at four characters and refuses a duplicate, so the three
    // characters taken are the *last* of the suffix: `seedSuffix` is a base-36 timestamp, whose
    // leading characters are shared by every run within the same minute. Taking the leading ones
    // made two runs a minute apart collide on `Wcez`.
    shortName: `W${suffix.slice(-3)}`,
    currencyCode: 'USD',
    digitsAfterDecimal: 2,
    inMultiplesOf: 0,
    amortizationType: 'EIR',
    paymentAmountCalculationStrategy: 'TPV',
    npvDayCount: 360,
    principal: 10_000,
    periodPaymentRate: 5,
    repaymentEvery: 1,
    repaymentFrequencyType: 'DAYS',
    accountingRule: 'NONE',
    paymentAllocation: [
      {
        transactionType: 'DEFAULT',
        paymentAllocationOrder: allocationRules.map((paymentAllocationRule, index) => ({
          paymentAllocationRule,
          order: index + 1,
        })),
      },
    ],
    locale: LOCALE,
    dateFormat: DATE_FORMAT,
  });
  return resourceId;
}

/**
 * Creates a client and a Working Capital loan, then approves and disburses it — an Active loan
 * with an outstanding balance, which is the starting point for every action on the loan screen.
 *
 * Each command takes only its own parameters: Fineract answers `error.msg.parameter.unsupported`
 * for anything else, so the approve body must not carry the disbursement's fields and vice versa.
 * `approve` additionally requires `expectedDisbursementDate`, and `disburse` requires
 * `transactionAmount` — neither is obvious from the command name, and both were measured.
 */
export async function seedActiveWorkingCapitalLoan(
  api: APIRequestContext,
  productId?: number,
  namePrefix = 'E2EWc',
): Promise<SeededWorkingCapitalLoan> {
  const client = await seedClient(api, namePrefix);
  const product = productId ?? (await seedWorkingCapitalLoanProduct(api, namePrefix));
  const today = fineractDate();
  const principal = 10_000;

  const { resourceId: loanId } = await post<{ resourceId: number }>(api, '/working-capital-loans', {
    clientId: client.clientId,
    productId: product,
    principalAmount: principal,
    totalPaymentVolume: 60_000,
    periodPaymentRate: 5,
    submittedOnDate: today,
    expectedDisbursementDate: today,
    locale: LOCALE,
    dateFormat: DATE_FORMAT,
  });

  await post(api, `/working-capital-loans/${loanId}?command=approve`, {
    approvedOnDate: today,
    approvedLoanAmount: principal,
    expectedDisbursementDate: today,
    locale: LOCALE,
    dateFormat: DATE_FORMAT,
  });
  await post(api, `/working-capital-loans/${loanId}?command=disburse`, {
    actualDisbursementDate: today,
    transactionAmount: principal,
    locale: LOCALE,
    dateFormat: DATE_FORMAT,
  });

  return { clientId: client.clientId, productId: product, loanId, principal };
}

/**
 * Creates a client, a loan product and a loan application, then approves and
 * disburses it — leaving an Active loan, the starting point the servicing specs
 * (repayment, notes, adjustment, write-off) assume.
 */
export async function seedActiveLoan(
  api: APIRequestContext,
  namePrefix = 'E2ESeed',
): Promise<SeededLoan> {
  const loan = await seedSubmittedLoan(api, namePrefix);
  await approveLoan(api, loan.loanId);
  await disburseLoan(api, loan.loanId);
  return loan;
}

/**
 * A charge that may be attached to a Working Capital loan.
 *
 * Two values here are not interchangeable with the term-loan ones and were measured:
 * `chargeAppliesTo` 5 is `chargeAppliesTo.workingCapitalLoan`, and the only charge *time* type
 * the module accepts is 2 (specified due date) — attaching a disbursement-time charge answers
 * 403 `error.msg.wc.loan.charge.time.type.not.supported`.
 *
 * Reused across runs by name prefix: charges are tenant configuration rather than per-test state.
 */
export async function seedWorkingCapitalCharge(api: APIRequestContext): Promise<number> {
  const existing = await get<{ id: number; name: string }[]>(
    api,
    '/charges?chargeAppliesTo=5',
  ).catch(() => [] as { id: number; name: string }[]);
  const found = existing.find((charge) => charge.name.startsWith('E2EWcFee'));
  if (found) return found.id;

  const { resourceId } = await post<{ resourceId: number }>(api, '/charges', {
    name: `E2EWcFee ${seedSuffix()}`,
    chargeAppliesTo: 5,
    chargeTimeType: 2,
    chargeCalculationType: 1,
    currencyCode: 'USD',
    amount: 50,
    active: true,
    locale: LOCALE,
    monthDayFormat: 'dd MMM',
  });
  return resourceId;
}

/** The product's name, which is what a form's product select offers rather than its id. */
export async function workingCapitalProductName(
  api: APIRequestContext,
  productId: number,
): Promise<string> {
  const product = await get<{ name: string }>(api, `/working-capital-loan-products/${productId}`);
  return product.name;
}

/** Attaches a charge to one loan, and hands back the loan-charge id the screen addresses. */
export async function attachWorkingCapitalCharge(
  api: APIRequestContext,
  loanId: number,
  chargeId: number,
  amount = 50,
): Promise<number> {
  const { resourceId } = await post<{ resourceId: number }>(
    api,
    `/working-capital-loans/${loanId}/charges`,
    { chargeId, amount, dueDate: fineractDate(), locale: LOCALE, dateFormat: DATE_FORMAT },
  );
  return resourceId;
}

/** Posts a repayment and hands back its transaction id — the transaction panel's subject. */
export async function postWorkingCapitalRepayment(
  api: APIRequestContext,
  loanId: number,
  amount: number,
): Promise<number> {
  const { resourceId } = await post<{ resourceId: number }>(
    api,
    `/working-capital-loans/${loanId}/transactions?command=repayment`,
    {
      transactionDate: fineractDate(),
      transactionAmount: amount,
      locale: LOCALE,
      dateFormat: DATE_FORMAT,
    },
  );
  return resourceId;
}

/** The transactions of one loan, as the platform reports them. */
export async function workingCapitalTransactions(
  api: APIRequestContext,
  loanId: number,
): Promise<
  {
    id: number;
    transactionAmount: number;
    reversed: boolean;
    type: { value?: string; code?: string };
  }[]
> {
  const page = await get<{
    content?: {
      id: number;
      transactionAmount: number;
      reversed: boolean;
      type: { value?: string; code?: string };
    }[];
  }>(api, `/working-capital-loans/${loanId}/transactions`);
  return page.content ?? [];
}

/** GL accounts by class, enough to map a Working Capital product's twelve mandatory slots. */
export interface SeededGlAccounts {
  readonly asset: number[];
  readonly liability: number[];
  readonly income: number[];
  readonly expense: number[];
}

/**
 * Manual-entry GL accounts, six of each class a product can map.
 *
 * Reused across runs by GL code prefix. The classes are Fineract's `type` ids — 1 asset,
 * 2 liability, 4 income, 5 expense — and pointing a slot at the wrong class is refused with
 * `validation.msg.domain.rule.violation`, which is why the product form offers each slot only
 * the accounts of the class it expects.
 */
export async function seedGlAccountsForProductAccounting(
  api: APIRequestContext,
): Promise<SeededGlAccounts> {
  const existing = await get<{ id: number; glCode: string; type: { id: number } }[]>(
    api,
    '/glaccounts',
  );
  const byType = (type: number) =>
    existing
      .filter((account) => account.type?.id === type && account.glCode.startsWith('E2E-ACC-'))
      .map((account) => account.id);

  const seeded: Record<number, number[]> = {
    1: byType(1),
    2: byType(2),
    4: byType(4),
    5: byType(5),
  };
  for (const type of [1, 2, 4, 5]) {
    while (seeded[type].length < 6) {
      const index = seeded[type].length + 1;
      const { resourceId } = await post<{ resourceId: number }>(api, '/glaccounts', {
        name: `E2E Accounting ${type}-${index}`,
        glCode: `E2E-ACC-${type}-${index}`,
        type,
        usage: 1,
        manualEntriesAllowed: true,
      });
      seeded[type].push(resourceId);
    }
  }
  return { asset: seeded[1], liability: seeded[2], income: seeded[4], expense: seeded[5] };
}

/**
 * One code value on each of the two loss-reason codes, so the reason mapping tables have
 * something to offer.
 *
 * A bare Fineract defines `ChargeOffReasons` and `WriteOffReasons` and leaves both empty, and the
 * product template omits `chargeOffReasonOptions` entirely rather than sending an empty list.
 */
export async function seedLossReasonCodeValues(
  api: APIRequestContext,
): Promise<{ chargeOffReasonId: number; writeOffReasonId: number }> {
  const codes = await get<{ id: number; name: string }[]>(api, '/codes');
  const firstValue = async (codeName: string, valueName: string): Promise<number> => {
    const code = codes.find((candidate) => candidate.name === codeName);
    if (!code) throw new Error(`the ${codeName} code is missing from this tenant`);
    const values = await get<{ id: number; name: string }[]>(api, `/codes/${code.id}/codevalues`);
    const found = values.find((value) => value.name.startsWith('E2E'));
    if (found) return found.id;
    const { subResourceId } = await post<{ subResourceId: number }>(
      api,
      `/codes/${code.id}/codevalues`,
      { name: valueName, position: 1, isActive: true },
    );
    return subResourceId;
  };

  return {
    chargeOffReasonId: await firstValue('ChargeOffReasons', 'E2E Insolvency'),
    writeOffReasonId: await firstValue('WriteOffReasons', 'E2E Uncollectible'),
  };
}

/**
 * A Working Capital product with the posting rule and every mandatory GL account mapped.
 *
 * The twelve slots are the ones the platform names when the rule is sent without them, and the
 * seven it accepts without demanding — the charge-off, fraud and goodwill slots — are left out
 * here so a spec can tell a mapped slot from an unmapped one.
 */
export async function seedWorkingCapitalAccrualProduct(
  api: APIRequestContext,
  accounts: SeededGlAccounts,
  reasons: { chargeOffReasonId: number; writeOffReasonId: number },
  namePrefix = 'E2EWcAcc',
): Promise<number> {
  const suffix = seedSuffix();
  const { resourceId } = await post<{ resourceId: number }>(api, '/working-capital-loan-products', {
    name: `${namePrefix} Product ${suffix}`,
    // Last three for the same reason as `seedWorkingCapitalLoanProduct`: a four-character name
    // that has to be unique cannot be built from the slow end of a timestamp.
    shortName: `A${suffix.slice(-3)}`,
    currencyCode: 'USD',
    digitsAfterDecimal: 2,
    inMultiplesOf: 0,
    amortizationType: 'EIR',
    paymentAmountCalculationStrategy: 'TPV',
    npvDayCount: 360,
    principal: 10_000,
    periodPaymentRate: 5,
    repaymentEvery: 1,
    repaymentFrequencyType: 'DAYS',
    accountingRule: 'ACC_DEF_REV_AM',
    fundSourceAccountId: accounts.asset[0],
    loanPortfolioAccountId: accounts.asset[1],
    transfersInSuspenseAccountId: accounts.asset[2],
    receivableFeeAccountId: accounts.asset[3],
    receivablePenaltyAccountId: accounts.asset[4],
    deferredIncomeLiabilityAccountId: accounts.liability[0],
    overpaymentLiabilityAccountId: accounts.liability[1],
    incomeFromDiscountFeeAccountId: accounts.income[0],
    incomeFromFeeAccountId: accounts.income[1],
    incomeFromPenaltyAccountId: accounts.income[2],
    incomeFromRecoveryAccountId: accounts.income[3],
    writeOffAccountId: accounts.expense[0],
    chargeOffReasonToExpenseAccountMappings: [
      {
        chargeOffReasonCodeValueId: reasons.chargeOffReasonId,
        expenseAccountId: accounts.expense[1],
      },
    ],
    writeOffReasonsToExpenseMappings: [
      {
        writeOffReasonCodeValueId: reasons.writeOffReasonId,
        expenseAccountId: accounts.expense[0],
      },
    ],
    paymentAllocation: [
      {
        transactionType: 'DEFAULT',
        paymentAllocationOrder: [
          'DUE_PENALTY',
          'DUE_FEE',
          'DUE_PRINCIPAL',
          'IN_ADVANCE_PENALTY',
          'IN_ADVANCE_FEE',
          'IN_ADVANCE_PRINCIPAL',
        ].map((paymentAllocationRule, index) => ({ paymentAllocationRule, order: index + 1 })),
      },
    ],
    locale: LOCALE,
    dateFormat: DATE_FORMAT,
  });
  return resourceId;
}

/** One Working Capital product as the platform reports it, for checking what a form saved. */
export async function workingCapitalProduct(
  api: APIRequestContext,
  productId: number,
): Promise<{
  name?: string;
  accountingRule?: { id?: string };
  accountingMappings?: Record<string, { id?: number; name?: string }>;
  chargeOffReasonToExpenseAccountMappings?: {
    reasonCodeValue?: { id?: number };
    expenseAccount?: { id?: number };
  }[];
  writeOffReasonsToExpenseMappings?: {
    reasonCodeValue?: { id?: number };
    expenseAccount?: { id?: number };
  }[];
  paymentAllocation?: { transactionType?: string; paymentAllocationOrder?: unknown[] }[];
}> {
  return get(api, `/working-capital-loan-products/${productId}`);
}

/**
 * A datatable registered against `m_wc_loan`.
 *
 * Reused rather than created per run, as {@link seedLoanDatatable} is and for the same reason:
 * registering a datatable is DDL, and a table per run would accumulate in the volume.
 *
 * `multiRow` decides more than the row count. A multi-row table's primary key is its own `id`
 * and the entity key is an ordinary column; a single-row table's primary key *is* the entity key.
 * That is what the screen reads to decide whether a row is addressed by id or by entity, so both
 * shapes are worth seeding.
 */
export async function seedWorkingCapitalLoanDatatable(
  api: APIRequestContext,
  multiRow: boolean,
): Promise<string> {
  const prefix = multiRow ? 'e2e_wc_notes_' : 'e2e_wc_kyc_';
  const existing = await get<{ registeredTableName: string; applicationTableName: string }[]>(
    api,
    '/datatables?apptable=m_wc_loan',
  );
  const found = existing.find((table) => table.registeredTableName.startsWith(prefix));
  if (found) return found.registeredTableName;

  const datatableName = `${prefix}${seedSuffix()}`;
  await post(api, '/datatables', {
    datatableName,
    apptableName: 'm_wc_loan',
    multiRow,
    columns: [{ name: 'reference', type: 'String', length: 40, mandatory: false }],
  });
  return datatableName;
}

/**
 * Registers a datatable as a CREATE check on `m_wc_loan`, and hands back the id to remove it by.
 *
 * Status 100 is `statusEnum.create`. While it stands, the platform refuses every Working Capital
 * application that does not carry a row for the table — including those of other specs — so a
 * caller must remove it in a `finally`.
 */
export async function seedWorkingCapitalCreateCheck(
  api: APIRequestContext,
  datatableName: string,
): Promise<number> {
  // A run that died before its cleanup leaves one behind, and it would then refuse every loan
  // the other specs create. Clearing first makes this seeder idempotent.
  await clearWorkingCapitalCreateChecks(api);
  const { resourceId } = await post<{ resourceId: number }>(api, '/entityDatatableChecks', {
    entity: 'm_wc_loan',
    status: 100,
    datatableName,
  });
  return resourceId;
}

/** Every CREATE check on `m_wc_loan`, removed. */
export async function clearWorkingCapitalCreateChecks(api: APIRequestContext): Promise<void> {
  const page = await get<{ pageItems?: { id: number }[] }>(
    api,
    '/entityDatatableChecks?status=100&entity=m_wc_loan',
  );
  for (const check of page.pageItems ?? []) {
    await removeEntityDatatableCheck(api, check.id);
  }
}

/**
 * Removes a datatable check.
 *
 * Tolerant of a check that is already gone, and it never throws: a caller runs this in a
 * `finally`, and a cleanup that throws replaces the failure the test was reporting with its own
 * — which is how a navigation assertion came to be reported as a failed DELETE.
 */
export async function removeEntityDatatableCheck(
  api: APIRequestContext,
  checkId: number,
): Promise<void> {
  const res = await api.delete(`${API_BASE}/entityDatatableChecks/${checkId}`);
  if (!res.ok() && res.status() !== 404) {
    console.warn(`DELETE /entityDatatableChecks/${checkId} -> ${res.status()}`);
  }
}

/**
 * The same shape as {@link seedActiveLoan}, but disbursing only part of the approved amount —
 * the starting point Fineract's own `LoanUpdateApprovedAmount.feature` uses for revising the
 * approved amount on a loan that has already released some of it (UC3). Fully disbursing first,
 * as `seedActiveLoan` does, leaves nothing this revision could legally change: reducing the
 * approved amount below what has already gone out is refused, and this product's default (0%)
 * over-applied tolerance means it cannot go any higher either. Verified live.
 */
export async function seedPartiallyDisbursedLoan(
  api: APIRequestContext,
  disbursedAmount: number,
  namePrefix = 'E2ESeed',
): Promise<SeededLoan> {
  const client = await seedClient(api, namePrefix);
  const product = await seedLoanProduct(api, namePrefix);
  const today = fineractDate();

  const { loanId } = await post<{ loanId: number }>(api, '/loans', {
    clientId: client.clientId,
    productId: product.productId,
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
  });

  await post(api, `/loans/${loanId}?command=approve`, {
    approvedOnDate: today,
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
  await post(api, `/loans/${loanId}?command=disburse`, {
    actualDisbursementDate: today,
    transactionAmount: disbursedAmount,
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });

  return { ...client, ...product, loanId };
}

/** Repayment against an active loan — the precondition for adjustment specs. */
export async function seedRepayment(
  api: APIRequestContext,
  loanId: number,
  amount = 100,
): Promise<void> {
  await post(api, `/loans/${loanId}/transactions?command=repayment`, {
    transactionDate: fineractDate(),
    transactionAmount: amount,
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
}

export interface SeededChartReport {
  reportId: number;
  reportName: string;
}

/**
 * A parameterless `Chart` report, so the run screen has something whose type is not `Table`.
 *
 * `Chart` is one of only three report types the platform accepts — posting `Pentaho` answers
 * `validation.msg.report.reportType.is.not.one.of.expected.enumerations` naming
 * `["Table","Chart","SMS"]` — and a chart report returns the *same* generic resultset a table
 * report does, so the chart is drawn entirely from the column types.
 *
 * The SQL is written for PostgreSQL and takes no parameters on purpose: most stock loan reports
 * compare a bigint column against a bound string (`o.id='${officeId}'`) and fail outright on
 * PostgreSQL, which would make this a test of that defect rather than of the chart.
 */
export async function seedChartReport(
  api: APIRequestContext,
  namePrefix = 'E2EChart',
  subType: 'Bar' | 'Pie' = 'Bar',
): Promise<SeededChartReport> {
  const reportName = `${namePrefix} Clients By Office ${seedSuffix()}`;
  const { resourceId } = await post<{ resourceId: number }>(api, '/reports', {
    reportName,
    reportType: 'Chart',
    reportSubType: subType,
    reportCategory: 'Client',
    reportSql:
      'select o.name as "Office", count(c.id) as "Clients" ' +
      'from m_office o left join m_client c on c.office_id = o.id ' +
      'group by o.name order by 1',
    useReport: true,
  });
  return { reportId: resourceId, reportName };
}

export interface SeededCenter {
  centerId: number;
  centerName: string;
}

/** A pending center, which is where the lifecycle actions on the detail view start. */
export async function seedCenter(
  api: APIRequestContext,
  namePrefix = 'E2ECenter',
): Promise<SeededCenter> {
  const centerName = `${namePrefix} ${seedSuffix()}`;
  const { resourceId } = await post<{ resourceId: number }>(api, '/centers', {
    name: centerName,
    officeId: 1,
    active: false,
    locale: LOCALE,
    dateFormat: DATE_FORMAT,
  });
  return { centerId: resourceId, centerName };
}

export interface SeededGroup {
  groupId: number;
  groupName: string;
}

/**
 * A group with no parent center, so it is a candidate for attaching to one.
 *
 * `GET /groups?orphansOnly=true` is what the attach dialog offers, and a group already held by a
 * center is excluded from it — a group has at most one parent.
 */
export async function seedGroup(
  api: APIRequestContext,
  namePrefix = 'E2EGroup',
  clientIds: number[] = [],
): Promise<SeededGroup> {
  const groupName = `${namePrefix} ${seedSuffix()}`;
  const { resourceId } = await post<{ resourceId: number }>(api, '/groups', {
    name: groupName,
    officeId: 1,
    active: false,
    locale: LOCALE,
    dateFormat: DATE_FORMAT,
    // `clientMembers` at creation rather than a follow-up association command: the group screen
    // reads `clientMembers` from the `associations=all` fetch, and this is the shorter path to a
    // group that has one.
    ...(clientIds.length ? { clientMembers: clientIds } : {}),
  });
  return { groupId: resourceId, groupName };
}

export interface SeededStaff {
  staffId: number;
  staffName: string;
}

/**
 * A member of staff in the head office.
 *
 * Seeded rather than assumed: a fresh Fineract has none, and a staff picker scoped to the office
 * — as every one of them is, because the platform refuses staff from another office — then has
 * nothing to offer. `displayName` comes back as "lastname, firstname", which is what the pickers
 * show.
 */
export async function seedStaff(
  api: APIRequestContext,
  namePrefix = 'E2EStaff',
): Promise<SeededStaff> {
  const lastname = `${namePrefix}${seedSuffix()}`;
  const { resourceId } = await post<{ resourceId: number }>(api, '/staff', {
    officeId: 1,
    firstname: 'Field',
    lastname,
    isLoanOfficer: true,
    joiningDate: fineractDate(new Date(2020, 0, 1)),
    locale: LOCALE,
    dateFormat: DATE_FORMAT,
  });
  return { staffId: resourceId, staffName: `${lastname}, Field` };
}

export interface SeededRestrictedUser {
  username: string;
  password: string;
  roleId: number;
  userId: number;
  /** Exactly the permission codes the user holds, as granted to their role. */
  permissions: string[];
  /** The office the user belongs to, which scopes the records they can see at all. */
  officeId: number;
}

/**
 * A Fineract role granted precisely the permissions listed, and nothing else.
 *
 * `PUT /roles/{id}/permissions` takes a map of code to boolean and applies it as a delta, so a
 * freshly created role — which starts with none — ends up holding exactly these.
 *
 * @param api - an API context authenticated as a user who may administer roles
 * @param permissions - permission codes, which must exist in `GET /permissions`
 * @param namePrefix - distinguishes the role in a stack that keeps its database between runs
 * @returns the new role's id
 */
export async function seedRole(
  api: APIRequestContext,
  permissions: string[],
  namePrefix = 'E2ERole',
): Promise<number> {
  const name = `${namePrefix}${seedSuffix()}`;
  const { resourceId } = await post<{ resourceId: number }>(api, '/roles', {
    name,
    description: 'Seeded by the RBAC e2e suite',
  });
  await put(api, `/roles/${resourceId}/permissions`, {
    permissions: Object.fromEntries(permissions.map((code) => [code, true])),
  });
  return resourceId;
}

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT = '23456789';
// No underscore: Fineract's policy requires a character matching `[^\w\s]`, and `\w`
// includes `_` — a password whose only punctuation was an underscore would be rejected.
const SPECIAL = '#$%&*+-=?@^';

/**
 * A throwaway password that satisfies Fineract's policy, drawn fresh each time.
 *
 * The policy is `^(?!.*(.)\1)(?!.*\s)(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^\w\s]).{12,50}$` —
 * 12 to 50 characters, one of each class, no whitespace, and **no character repeated
 * consecutively**. That last clause is the one that catches people out, and the validation error
 * does not mention it until you read `args`.
 *
 * Generated rather than written down. A literal that satisfies the rule is by construction a
 * credential-shaped string, which secret scanners flag and reviewers have to think about; there
 * is no value in having one in the tree when the account is created and used within a single
 * test run.
 */
export function generatePassword(): string {
  const pools = [UPPER, LOWER, DIGIT, SPECIAL];
  const characters: string[] = [];
  // One from each class first, so the policy's lookaheads are satisfied by construction,
  // then fill out the length from the union.
  const all = pools.join('');
  while (characters.length < 16) {
    const pool = characters.length < pools.length ? pools[characters.length] : all;
    const candidate = pool[randomInt(pool.length)];
    // Reject rather than reshuffle: the "no consecutive repeat" rule is the only ordering
    // constraint, and refusing a duplicate neighbour is the whole of enforcing it.
    if (candidate !== characters[characters.length - 1]) characters.push(candidate);
  }
  return characters.join('');
}

/**
 * A user who genuinely holds only the given permissions, for signing into the application as.
 *
 * The point of seeding rather than mocking is that the resulting session is the platform's own
 * answer: whatever the UI then allows or refuses can be checked against what Fineract itself
 * allows or refuses, which is the only way to show the two agree.
 *
 * The password is generated to satisfy Fineract's policy — 12 to 50 characters, one of each
 * class, no whitespace, and no character repeated consecutively — which rejects most obvious
 * literals with a validation error that does not mention the rule until you read `args`.
 *
 * Permission codes are only half of what Fineract decides with. The other half is the user's
 * **office**: every query is scoped to the office hierarchy beneath the one the user belongs to,
 * so two users holding an identical role see different records. `officeId` defaults to Head
 * Office, whose subtree is everything — which is why a spec about scoping has to pass a branch.
 *
 * @param api - an API context authenticated as a user who may administer roles and users
 * @param permissions - permission codes the user should hold, and only those
 * @param officeId - the office the user belongs to; Head Office (1) unless given
 */
export async function seedRestrictedUser(
  api: APIRequestContext,
  permissions: string[],
  officeId = 1,
): Promise<SeededRestrictedUser> {
  const roleId = await seedRole(api, permissions);
  const suffix = seedSuffix();
  const username = `e2erbac${suffix}`;
  const password = generatePassword();

  const { resourceId } = await post<{ resourceId: number }>(api, '/users', {
    username,
    firstname: 'Restricted',
    lastname: `User${suffix}`,
    email: `${username}@example.invalid`,
    officeId,
    roles: [roleId],
    sendPasswordToEmail: false,
    password,
    repeatPassword: password,
  });

  return { username, password, roleId, userId: resourceId, permissions, officeId };
}

/**
 * Asks Fineract the same question the UI just asked, as the restricted user themselves.
 *
 * Returns the HTTP status so a spec can assert the platform's answer directly rather than
 * inferring it from what the UI did — the client guard is defence-in-depth, and this is how a
 * test tells the difference between the two agreeing and the client merely looking convincing.
 */
export async function statusAs(
  user: SeededRestrictedUser,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
): Promise<number> {
  const context = await playwrightRequest.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      'Fineract-Platform-TenantId': TENANT,
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${user.username}:${user.password}`).toString('base64')}`,
    },
  });
  try {
    const url = `${API_BASE}${path}`;
    const response =
      method === 'GET'
        ? await context.get(url)
        : method === 'PUT'
          ? await context.put(url, { data: body ?? {} })
          : await context.post(url, { data: body ?? {} });
    return response.status();
  } finally {
    await context.dispose();
  }
}

/**
 * Whether Fineract refused the request **for want of permission**, as that user.
 *
 * `statusAs` is enough for most of the authorisation probe, because an unauthorised command
 * answers 403 while an authorised one answers 400 or 404 on the body or the resource. It is not
 * enough everywhere: the platform also answers **403** for a domain rule violation — a charge
 * that is already waived, a loan in the wrong status — so a bare status cannot tell "you may not"
 * from "not like that". This reads the globalisation code, which can:
 *
 * ```
 * 403 error.msg.not.authorized          → the code does not authorise the command
 * 403 validation.msg.domain.rule.violation → it does; the resource was in the wrong state
 * ```
 */
export async function notAuthorisedAs(
  user: SeededRestrictedUser,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
): Promise<boolean> {
  const context = await playwrightRequest.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      'Fineract-Platform-TenantId': TENANT,
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${user.username}:${user.password}`).toString('base64')}`,
    },
  });
  try {
    const url = `${API_BASE}${path}`;
    const response =
      method === 'GET'
        ? await context.get(url)
        : method === 'PUT'
          ? await context.put(url, { data: body ?? {} })
          : await context.post(url, { data: body ?? {} });
    if (response.status() !== 403) return false;
    const text = await response.text();
    return text.includes('error.msg.not.authorized');
  } finally {
    await context.dispose();
  }
}

export interface SeededJournalEntry {
  /** The id of one line, which is what the detail route takes. */
  entryId: number;
  /** The id of the transaction, which is what reversal takes. */
  transactionId: string;
  debitAccountName: string;
  creditAccountName: string;
}

/**
 * A manual journal entry that can actually be reversed.
 *
 * Reversal is refused for system-generated entries — those written by the platform behind a loan
 * or savings transaction — so a spec covering the reverse action cannot reuse whatever the other
 * specs happen to have posted. It has to make one by hand, which is what this does.
 */
export interface SeededGlAccountPair {
  debitId: number;
  creditId: number;
  debitAccountName: string;
  creditAccountName: string;
}

/**
 * Two manual-entry GL accounts, one asset and one income, that a journal entry can be posted
 * against.
 *
 * `manualEntriesAllowed` is the part that matters: the platform refuses a hand-written entry
 * against an account that does not carry it, and the stock chart of accounts cannot be relied on
 * to hold a pair that does.
 */
export async function seedGlAccountPair(
  api: APIRequestContext,
  namePrefix = 'E2EJournal',
): Promise<SeededGlAccountPair> {
  const suffix = seedSuffix();
  const debitAccountName = `${namePrefix} Cash ${suffix}`;
  const creditAccountName = `${namePrefix} Income ${suffix}`;

  const { resourceId: debitId } = await post<{ resourceId: number }>(api, '/glaccounts', {
    name: debitAccountName,
    glCode: `E2E-D-${suffix}`,
    type: 1,
    usage: 1,
    manualEntriesAllowed: true,
  });
  const { resourceId: creditId } = await post<{ resourceId: number }>(api, '/glaccounts', {
    name: creditAccountName,
    glCode: `E2E-C-${suffix}`,
    type: 4,
    usage: 1,
    manualEntriesAllowed: true,
  });

  return { debitId, creditId, debitAccountName, creditAccountName };
}

/**
 * Posts a balanced manual journal entry and hands back the raw response.
 *
 * Raw, rather than parsed, because the interesting cases are the refusals: an accounting closure
 * covering the transaction date makes the platform reject this, and a caller proving that needs
 * the status and the body rather than an exception. {@link seedManualJournalEntry} wraps it for
 * the callers that only want the entry to exist.
 */
export async function attemptJournalEntry(
  api: APIRequestContext,
  options: {
    pair: SeededGlAccountPair;
    officeId?: number;
    date?: Date;
    amount?: number;
    comments?: string;
  },
): Promise<APIResponse> {
  const { pair, officeId = 1, date = new Date(), amount = 100, comments = '' } = options;
  return api.post(`${API_BASE}/journalentries`, {
    data: {
      officeId,
      currencyCode: 'USD',
      transactionDate: fineractDate(date),
      dateFormat: DATE_FORMAT,
      locale: LOCALE,
      comments,
      debits: [{ glAccountId: pair.debitId, amount }],
      credits: [{ glAccountId: pair.creditId, amount }],
    },
  });
}

export async function seedManualJournalEntry(
  api: APIRequestContext,
  namePrefix = 'E2EJournal',
): Promise<SeededJournalEntry> {
  const pair = await seedGlAccountPair(api, namePrefix);
  const response = await attemptJournalEntry(api, {
    pair,
    comments: 'Seeded for reversal coverage',
  });
  if (!response.ok()) {
    throw new Error(
      `POST /journalentries -> ${response.status()}: ${(await response.text()).slice(0, 400)}`,
    );
  }
  const { transactionId } = (await response.json()) as { transactionId: string };

  const page = await get<{ pageItems: { id: number }[] }>(
    api,
    `/journalentries?transactionId=${transactionId}`,
  );
  return {
    entryId: page.pageItems[0].id,
    transactionId,
    debitAccountName: pair.debitAccountName,
    creditAccountName: pair.creditAccountName,
  };
}

export interface SeededAccountingClosure {
  closureId: number;
  officeId: number;
}

/**
 * Closes an accounting period for one office.
 *
 * Always pass a seeded branch rather than Head Office. A closure is enforced over the office's
 * whole subtree, so closing Head Office would make the platform refuse every posting the rest of
 * the backend suite makes — including the loan and savings specs, which post through the
 * accounting rules rather than by hand and would fail for a reason nothing in them names.
 */
export async function seedAccountingClosure(
  api: APIRequestContext,
  officeId: number,
  date: Date = new Date(),
  comments = 'Seeded for closure coverage',
): Promise<SeededAccountingClosure> {
  const { resourceId } = await post<{ resourceId: number }>(api, '/glclosures', {
    officeId,
    closingDate: fineractDate(date),
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
    comments,
  });
  return { closureId: resourceId, officeId };
}

/**
 * Re-opens a closed period, so a spec does not leave one behind.
 *
 * Tolerates a closure that is already gone: a spec that re-opens through the UI and then cleans
 * up should not fail in teardown for having succeeded.
 */
export async function deleteAccountingClosure(
  api: APIRequestContext,
  closureId: number,
): Promise<void> {
  const response = await api.delete(`${API_BASE}/glclosures/${closureId}`);
  if (!response.ok() && response.status() !== 404) {
    throw new Error(
      `DELETE /glclosures/${closureId} -> ${response.status()}: ${(await response.text()).slice(0, 200)}`,
    );
  }
}

export interface SeededReportDefinition {
  reportId: number;
  reportName: string;
}

/** A tenant report definition — the only kind the platform allows to be edited or deleted. */
export async function seedReportDefinition(
  api: APIRequestContext,
  namePrefix = 'E2EReportDef',
): Promise<SeededReportDefinition> {
  const reportName = `${namePrefix} ${seedSuffix()}`;
  const { resourceId } = await post<{ resourceId: number }>(api, '/reports', {
    reportName,
    reportType: 'Table',
    reportCategory: 'Client',
    description: 'Seeded for report definition coverage',
    reportSql: 'select 1 as one',
    useReport: true,
    reportParameters: [],
  });
  return { reportId: resourceId, reportName };
}

/**
 * A loan left in "Submitted and pending approval", which is what an approval queue is made of.
 *
 * `seedActiveLoan` approves and disburses; a queue needs the opposite, so this stops at submission.
 */
export async function seedPendingLoan(
  api: APIRequestContext,
  namePrefix = 'E2EQueue',
): Promise<{ loanId: number; clientName: string; accountNo: string }> {
  const client = await seedClient(api, namePrefix);
  const product = await seedLoanProduct(api, namePrefix);

  const { loanId } = await post<{ loanId: number }>(api, '/loans', {
    clientId: client.clientId,
    productId: product.productId,
    principal: 1000,
    loanTermFrequency: 6,
    loanTermFrequencyType: 2,
    numberOfRepayments: 6,
    repaymentEvery: 1,
    repaymentFrequencyType: 2,
    interestRatePerPeriod: 2,
    amortizationType: 1,
    interestType: 0,
    interestCalculationPeriodType: 1,
    transactionProcessingStrategyCode: 'mifos-standard-strategy',
    expectedDisbursementDate: fineractDate(),
    submittedOnDate: fineractDate(),
    loanType: 'individual',
    locale: LOCALE,
    dateFormat: DATE_FORMAT,
  });

  const loan = await get<{ accountNo: string }>(api, `/loans/${loanId}`);
  return { loanId, clientName: client.displayName, accountNo: loan.accountNo };
}

/**
 * Reverses a journal transaction over the API.
 *
 * Used to put a record into the reversed state a spec wants to *read*, rather than to test the
 * reversal itself — that goes through the UI.
 */
export async function reverseJournalEntry(
  api: APIRequestContext,
  transactionId: string,
): Promise<void> {
  await post(api, `/journalentries/${transactionId}?command=reverse`, {
    comments: 'Reversed by the e2e suite',
  });
}

/**
 * A charge definition that may be attached to a savings account.
 *
 * `chargeAppliesTo` 2 is savings. The time type matters: 2 is specified-due-date, which is the
 * only one that produces a charge with an outstanding amount the moment it is attached — an
 * annual or withdrawal fee has nothing outstanding until the event that levies it, so a Pay
 * action on one would have nothing to pay.
 *
 * Reused across runs by name prefix: charges are tenant configuration rather than per-test
 * state.
 */
export async function seedSavingsCharge(
  api: APIRequestContext,
  namePrefix = 'E2ESeed',
  amount = 20,
): Promise<SeededCharge> {
  const existing = await get<{ id: number; name: string }[]>(api, '/charges?chargeAppliesTo=2');
  const reusable = existing.find((charge) => charge.name.startsWith(`${namePrefix} Savings`));
  if (reusable) return { chargeId: reusable.id, name: reusable.name };

  const name = `${namePrefix} Savings Charge ${seedSuffix()}`;
  const { resourceId } = await post<{ resourceId: number }>(api, '/charges', {
    name,
    amount,
    currencyCode: 'USD',
    chargeAppliesTo: 2,
    chargeTimeType: 2,
    chargeCalculationType: 1,
    penalty: false,
    active: true,
    locale: LOCALE,
  });
  return { chargeId: resourceId, name };
}

/**
 * A recurring savings charge: an annual fee.
 *
 * Separate from {@link seedSavingsCharge} because the two answer different questions. A
 * specified-due-date charge has an amount outstanding the moment it is attached, which is what
 * Pay and Waive need; only a *recurring* charge can be inactivated, which the platform states as
 * `charge.inactivation.allowed.only.for.recurring.charges`. Time type 6 is the annual fee, from
 * the platform's own charge template.
 */
export async function seedRecurringSavingsCharge(
  api: APIRequestContext,
  namePrefix = 'E2ESeed',
  amount = 12,
): Promise<SeededCharge> {
  const existing = await get<{ id: number; name: string }[]>(api, '/charges?chargeAppliesTo=2');
  const reusable = existing.find((charge) => charge.name.startsWith(`${namePrefix} Annual`));
  if (reusable) return { chargeId: reusable.id, name: reusable.name };

  const name = `${namePrefix} Annual Fee ${seedSuffix()}`;
  const { resourceId } = await post<{ resourceId: number }>(api, '/charges', {
    name,
    amount,
    currencyCode: 'USD',
    chargeAppliesTo: 2,
    chargeTimeType: 6,
    chargeCalculationType: 1,
    feeOnMonthDay: '01 January',
    penalty: false,
    active: true,
    locale: LOCALE,
    // `monthDayFormat`, not `dateFormat`: an annual fee's due day has no year, and sending it
    // under `dateFormat` answers 500 rather than a validation error.
    monthDayFormat: 'dd MMMM',
  });
  return { chargeId: resourceId, name };
}

/** A charge definition that may be attached to a client. `chargeAppliesTo` 3 is client. */
export async function seedClientChargeDefinition(
  api: APIRequestContext,
  namePrefix = 'E2ESeed',
  amount = 15,
): Promise<SeededCharge> {
  const existing = await get<{ id: number; name: string }[]>(api, '/charges?chargeAppliesTo=3');
  const reusable = existing.find((charge) => charge.name.startsWith(`${namePrefix} Client`));
  if (reusable) return { chargeId: reusable.id, name: reusable.name };

  const name = `${namePrefix} Client Charge ${seedSuffix()}`;
  const { resourceId } = await post<{ resourceId: number }>(api, '/charges', {
    name,
    amount,
    currencyCode: 'USD',
    chargeAppliesTo: 3,
    chargeTimeType: 2,
    chargeCalculationType: 1,
    penalty: false,
    active: true,
    locale: LOCALE,
  });
  return { chargeId: resourceId, name };
}

/** Attaches a charge to a loan and hands back the loan-charge id. */
export async function attachLoanCharge(
  api: APIRequestContext,
  loanId: number,
  chargeId: number,
  amount = 25,
): Promise<number> {
  const { resourceId } = await post<{ resourceId: number }>(api, `/loans/${loanId}/charges`, {
    chargeId,
    amount,
    dueDate: fineractDate(),
    locale: LOCALE,
    dateFormat: DATE_FORMAT,
  });
  return resourceId;
}

/** Attaches a charge to a savings account and hands back the savings-charge id. */
export async function attachSavingsCharge(
  api: APIRequestContext,
  savingsAccountId: number,
  chargeId: number,
  amount = 20,
): Promise<number> {
  const { resourceId } = await post<{ resourceId: number }>(
    api,
    `/savingsaccounts/${savingsAccountId}/charges`,
    { chargeId, amount, dueDate: fineractDate(), locale: LOCALE, dateFormat: DATE_FORMAT },
  );
  return resourceId;
}

/** Attaches a charge to a client and hands back the client-charge id. */
export async function attachClientCharge(
  api: APIRequestContext,
  clientId: number,
  chargeId: number,
  amount = 15,
): Promise<number> {
  const { resourceId } = await post<{ resourceId: number }>(api, `/clients/${clientId}/charges`, {
    chargeId,
    amount,
    dueDate: fineractDate(),
    locale: LOCALE,
    dateFormat: DATE_FORMAT,
  });
  return resourceId;
}

/** One loan's charges, as the platform reports them. */
export async function loanCharges(
  api: APIRequestContext,
  loanId: number,
): Promise<
  {
    id: number;
    name: string;
    amount: number;
    amountOutstanding?: number;
    amountWaived?: number;
    paid?: boolean;
  }[]
> {
  return get(api, `/loans/${loanId}/charges`);
}

/** One savings account's charges, as the platform reports them. */
export async function savingsCharges(
  api: APIRequestContext,
  savingsAccountId: number,
): Promise<Record<string, unknown>[]> {
  return get(api, `/savingsaccounts/${savingsAccountId}/charges`);
}

/** One loan's transactions, as the platform reports them on the loan response. */
export async function loanTransactions(
  api: APIRequestContext,
  loanId: number,
): Promise<
  {
    id: number;
    amount: number;
    manuallyReversed?: boolean;
    type?: Record<string, unknown>;
  }[]
> {
  const loan = await get<{
    transactions?: {
      id: number;
      amount: number;
      manuallyReversed?: boolean;
      type?: Record<string, unknown>;
    }[];
  }>(api, `/loans/${loanId}?associations=all`);
  return loan.transactions ?? [];
}

/** Approves and activates a seeded fixed deposit, leaving it Active with its balance funded. */
export async function activateFixedDepositAccount(
  api: APIRequestContext,
  accountId: number,
): Promise<void> {
  await post(api, `/fixeddepositaccounts/${accountId}?command=approve`, {
    approvedOnDate: fineractDate(),
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
  await post(api, `/fixeddepositaccounts/${accountId}?command=activate`, {
    activatedOnDate: fineractDate(),
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
}

/** One fixed deposit account, as the platform reports it. */
export async function fixedDepositAccount(
  api: APIRequestContext,
  accountId: number,
): Promise<Record<string, unknown>> {
  return get(api, `/fixeddepositaccounts/${accountId}?associations=all`);
}

/**
 * An active savings account for a client, funded with `balance`.
 *
 * The funding matters wherever a deposit is linked to it: activation of a linked deposit debits
 * this account, and an unfunded one makes that activation fail with "Insufficient account
 * balance."
 */
export async function seedFundedSavingsAccount(
  api: APIRequestContext,
  clientId: number,
  balance = 20000,
): Promise<number> {
  const products = await get<{ id: number }[]>(api, '/savingsproducts');
  let productId = products[0]?.id;
  if (productId === undefined) {
    const suffix = seedSuffix();
    const created = await post<{ resourceId: number }>(api, '/savingsproducts', {
      name: `E2ESeed Savings ${suffix}`,
      shortName: suffix.slice(-4).toUpperCase(),
      currencyCode: 'USD',
      digitsAfterDecimal: 2,
      nominalAnnualInterestRate: 3,
      interestCompoundingPeriodType: 1,
      interestPostingPeriodType: 4,
      interestCalculationType: 1,
      interestCalculationDaysInYearType: 365,
      accountingRule: 1,
      locale: LOCALE,
    });
    productId = created.resourceId;
  }

  const { resourceId } = await post<{ resourceId: number }>(api, '/savingsaccounts', {
    clientId,
    productId,
    submittedOnDate: fineractDate(),
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
  await post(api, `/savingsaccounts/${resourceId}?command=approve`, {
    approvedOnDate: fineractDate(),
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
  await post(api, `/savingsaccounts/${resourceId}?command=activate`, {
    activatedOnDate: fineractDate(),
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
  if (balance > 0) {
    await post(api, `/savingsaccounts/${resourceId}/transactions?command=deposit`, {
      transactionDate: fineractDate(),
      transactionAmount: balance,
      paymentTypeId: 1,
      dateFormat: DATE_FORMAT,
      locale: LOCALE,
    });
  }
  return resourceId;
}

/** One savings account's balance, for asserting that money actually moved. */
export async function savingsAccountBalance(
  api: APIRequestContext,
  savingsAccountId: number,
): Promise<number> {
  const account = await get<{ summary?: { accountBalance?: number } }>(
    api,
    `/savingsaccounts/${savingsAccountId}`,
  );
  return account.summary?.accountBalance ?? 0;
}

/**
 * A fixed deposit product by name, with its active chart.
 *
 * For asserting what a product the UI created actually carries. The rate is the reason: issue
 * #765 was a chart the form sent without showing it, so the only honest check is reading the
 * saved product back from the platform.
 */
export async function fixedDepositProductByName(
  api: APIRequestContext,
  name: string,
): Promise<Record<string, unknown> | undefined> {
  const products = await get<{ id: number; name: string }[]>(api, '/fixeddepositproducts');
  const match = products.find((product) => product.name === name);
  if (!match) return undefined;
  return get(api, `/fixeddepositproducts/${match.id}`);
}

/** The annual rates of a product's active chart, in slab order. */
export function chartRates(product: Record<string, unknown> | undefined): number[] {
  const chart = product?.['activeChart'] as
    { chartSlabs?: { annualInterestRate?: number }[] } | undefined;
  return (chart?.chartSlabs ?? []).map((slab) => slab.annualInterestRate ?? 0);
}
