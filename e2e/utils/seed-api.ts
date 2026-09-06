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
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

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
export async function seedSavingsAccountWithTransactions(
  api: APIRequestContext,
  namePrefix = 'E2ESavings',
): Promise<SeededSavingsAccount> {
  const client = await seedClient(api, namePrefix);
  const suffix = seedSuffix();
  const today = fineractDate();

  const { resourceId: productId } = await post<{ resourceId: number }>(api, '/savingsproducts', {
    name: `${namePrefix} Savings ${suffix}`,
    shortName: `V${suffix.slice(-3).toUpperCase()}`,
    description: 'Seeded for savings transaction correction coverage',
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

  return { savingsId, clientId: client.clientId, clientName: client.displayName };
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
 * Creates a client, a loan product and a loan application, then approves and
 * disburses it — leaving an Active loan, the starting point the servicing specs
 * (repayment, notes, adjustment, write-off) assume.
 */
export async function seedActiveLoan(
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

  await post(api, `/loans/${loanId}?command=approve`, {
    approvedOnDate: today,
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  });
  await post(api, `/loans/${loanId}?command=disburse`, {
    actualDisbursementDate: today,
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
): Promise<SeededGroup> {
  const groupName = `${namePrefix} ${seedSuffix()}`;
  const { resourceId } = await post<{ resourceId: number }>(api, '/groups', {
    name: groupName,
    officeId: 1,
    active: false,
    locale: LOCALE,
    dateFormat: DATE_FORMAT,
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
 * @param api - an API context authenticated as a user who may administer roles and users
 * @param permissions - permission codes the user should hold, and only those
 */
export async function seedRestrictedUser(
  api: APIRequestContext,
  permissions: string[],
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
    officeId: 1,
    roles: [roleId],
    sendPasswordToEmail: false,
    password,
    repeatPassword: password,
  });

  return { username, password, roleId, userId: resourceId, permissions };
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
export async function seedManualJournalEntry(
  api: APIRequestContext,
  namePrefix = 'E2EJournal',
): Promise<SeededJournalEntry> {
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

  const { transactionId } = await post<{ transactionId: string }>(api, '/journalentries', {
    officeId: 1,
    currencyCode: 'USD',
    transactionDate: fineractDate(),
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
    comments: 'Seeded for reversal coverage',
    debits: [{ glAccountId: debitId, amount: 100 }],
    credits: [{ glAccountId: creditId, amount: 100 }],
  });

  const page = await get<{ pageItems: { id: number }[] }>(
    api,
    `/journalentries?transactionId=${transactionId}`,
  );
  return {
    entryId: page.pageItems[0].id,
    transactionId,
    debitAccountName,
    creditAccountName,
  };
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
