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
 * What a product's accounting configuration is made of, as data.
 *
 * The five product families each map a different set of GL accounts, but they map them the same
 * way: pick a rule, then fill one account per slot the rule requires. Describing the slots as a
 * list means the section component renders any family without knowing which one it is, and a
 * family is added by writing its list rather than another form.
 */

/**
 * Fineract's `accountingRuleType` enum.
 *
 * The platform returns these as `accountingRuleOptions` on every product template, and the
 * section renders its selector from that response so the labels are the tenant's own. The ids
 * are named here because the *behaviour* keys off them — which slots a rule requires is a fact
 * about the rule, not a string the server sends.
 */
export const ACCOUNTING_RULE = {
  NONE: 1,
  CASH: 2,
  ACCRUAL_PERIODIC: 3,
  ACCRUAL_UPFRONT: 4,
} as const;

export type AccountingRuleId = (typeof ACCOUNTING_RULE)[keyof typeof ACCOUNTING_RULE];

/** Every rule that posts to the ledger — i.e. everything except `NONE`. */
export const ACCOUNTING_RULES_WITH_MAPPINGS: readonly AccountingRuleId[] = [
  ACCOUNTING_RULE.CASH,
  ACCOUNTING_RULE.ACCRUAL_PERIODIC,
  ACCOUNTING_RULE.ACCRUAL_UPFRONT,
];

/** The two accrual rules, which require the receivable slots on top of the cash ones. */
export const ACCRUAL_RULES: readonly AccountingRuleId[] = [
  ACCOUNTING_RULE.ACCRUAL_PERIODIC,
  ACCOUNTING_RULE.ACCRUAL_UPFRONT,
];

/**
 * The four GL account classes a product slot can draw from.
 *
 * Not cosmetic. Pointing a slot at an account of the wrong class is refused —
 * `403 validation.msg.domain.rule.violation`, "Passed in GLAccount fundSourceAccountId with Id 5
 * maps to the account Probe INC of type INCOME, the expected account type was ASSET" — so the
 * class each slot expects is what makes the picker able to only offer accounts that will work.
 */
export type GlAccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

/** A GL account as the product template offers it. */
export interface GlAccountOption {
  id?: number;
  name?: string;
  glCode?: string;
}

/**
 * The template's `accountingMappingOptions`, one list per account class.
 *
 * Every list is optional because the platform **omits the key entirely** when the tenant has no
 * accounts of that class — a fresh install has none at all. A form that assumed four lists would
 * render four empty dropdowns and no explanation; {@link ProductAccountingSectionComponent} says
 * so instead.
 */
export interface GlAccountOptions {
  assetAccountOptions?: Iterable<GlAccountOption>;
  liabilityAccountOptions?: Iterable<GlAccountOption>;
  equityAccountOptions?: Iterable<GlAccountOption>;
  incomeAccountOptions?: Iterable<GlAccountOption>;
  expenseAccountOptions?: Iterable<GlAccountOption>;
}

/** One account slot on a product. */
export interface AccountingMappingField {
  /** The key the create/update request carries, e.g. `fundSourceAccountId`. */
  readonly key: string;
  /** The key the product response carries under `accountingMappings`, e.g. `fundSourceAccount`. */
  readonly responseKey: string;
  /** Which class of account the platform expects here. */
  readonly accountType: GlAccountType;
  /** Translation key for the field label. */
  readonly label: string;
  /** The rules that require this slot. A rule outside this list must not send the key. */
  readonly rules: readonly AccountingRuleId[];
}

/** The id/name pair a product response carries for a mapped account. */
export interface MappedGlAccount {
  id?: number;
  name?: string;
}

/** Selected accounts, keyed by request key. */
export type AccountingMappings = Record<string, number | undefined>;

/**
 * The slots a **loan product** maps.
 *
 * Taken from the platform rather than from documentation: posting a loan product with a rule and
 * no mappings answers 400 and names every missing parameter, which enumerates the mandatory set
 * exactly. Against Fineract at the time of writing, `CASH` names nine and both accrual rules name
 * those nine plus the three receivables — including `incomeFromRecoveryAccountId`, which is easy
 * to miss because recovery is not part of the ordinary repayment story.
 *
 * Reproduce with:
 *
 *     POST /loanproducts  {"accountingRule": 2, …no mapping ids…}
 */
const INCOME_FROM_FEES_LABEL = 'PRODUCTS.ACCOUNTING.INCOME_FROM_FEES';

export const LOAN_ACCOUNTING_FIELDS: readonly AccountingMappingField[] = [
  {
    key: 'fundSourceAccountId',
    responseKey: 'fundSourceAccount',
    accountType: 'asset',
    label: 'PRODUCTS.ACCOUNTING.FUND_SOURCE',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'loanPortfolioAccountId',
    responseKey: 'loanPortfolioAccount',
    accountType: 'asset',
    label: 'PRODUCTS.ACCOUNTING.LOAN_PORTFOLIO',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'transfersInSuspenseAccountId',
    responseKey: 'transfersInSuspenseAccount',
    accountType: 'asset',
    label: 'PRODUCTS.ACCOUNTING.TRANSFERS_IN_SUSPENSE',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'receivableInterestAccountId',
    responseKey: 'receivableInterestAccount',
    accountType: 'asset',
    label: 'PRODUCTS.ACCOUNTING.RECEIVABLE_INTEREST',
    rules: ACCRUAL_RULES,
  },
  {
    key: 'receivableFeeAccountId',
    responseKey: 'receivableFeeAccount',
    accountType: 'asset',
    label: 'PRODUCTS.ACCOUNTING.RECEIVABLE_FEE',
    rules: ACCRUAL_RULES,
  },
  {
    key: 'receivablePenaltyAccountId',
    responseKey: 'receivablePenaltyAccount',
    accountType: 'asset',
    label: 'PRODUCTS.ACCOUNTING.RECEIVABLE_PENALTY',
    rules: ACCRUAL_RULES,
  },
  {
    key: 'interestOnLoanAccountId',
    responseKey: 'interestOnLoanAccount',
    accountType: 'income',
    label: 'PRODUCTS.ACCOUNTING.INTEREST_ON_LOANS',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'incomeFromFeeAccountId',
    responseKey: 'incomeFromFeeAccount',
    accountType: 'income',
    label: INCOME_FROM_FEES_LABEL,
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'incomeFromPenaltyAccountId',
    responseKey: 'incomeFromPenaltyAccount',
    accountType: 'income',
    label: 'PRODUCTS.ACCOUNTING.INCOME_FROM_PENALTIES',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'incomeFromRecoveryAccountId',
    responseKey: 'incomeFromRecoveryAccount',
    accountType: 'income',
    label: 'PRODUCTS.ACCOUNTING.INCOME_FROM_RECOVERY',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'writeOffAccountId',
    responseKey: 'writeOffAccount',
    accountType: 'expense',
    label: 'PRODUCTS.ACCOUNTING.LOSSES_WRITTEN_OFF',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'overpaymentLiabilityAccountId',
    responseKey: 'overpaymentLiabilityAccount',
    accountType: 'liability',
    label: 'PRODUCTS.ACCOUNTING.OVERPAYMENT_LIABILITY',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
];

/** The slots `rule` requires, in declaration order. */
export function fieldsForRule(
  fields: readonly AccountingMappingField[],
  rule: number | undefined,
): AccountingMappingField[] {
  return fields.filter((field) => field.rules.includes(rule as AccountingRuleId));
}

/**
 * The mapping keys to send for `rule`, and nothing else.
 *
 * Two things this exists to prevent. A rule of `NONE` must send no mapping keys at all — the
 * platform rejects a stray `null`. And a slot left over from a previously selected rule must not
 * ride along: switching accrual → cash while three receivable ids sit in the model would send
 * receivables the cash rule has no slot for.
 */
export function mappingsForRule(
  fields: readonly AccountingMappingField[],
  rule: number | undefined,
  mappings: AccountingMappings,
): AccountingMappings {
  const payload: AccountingMappings = {};
  for (const field of fieldsForRule(fields, rule)) {
    const accountId = mappings[field.key];
    if (accountId !== undefined && accountId !== null) {
      payload[field.key] = accountId;
    }
  }
  return payload;
}

/**
 * The mappings a loaded product already has, keyed the way the form holds them.
 *
 * The response nests each one as `{ id, name }` under a key without the `Id` suffix, so this is
 * the only place that knows the two spellings are the same slot. Reading it is what stops an
 * edit from blanking a configured product.
 */
export function mappingsFromResponse(
  fields: readonly AccountingMappingField[],
  accountingMappings: object | undefined,
): AccountingMappings {
  const mappings: AccountingMappings = {};
  if (!accountingMappings) return mappings;

  // The generated `GetLoanAccountingMappings` (and its four siblings) declare their slots as
  // named properties with no index signature, so they cannot be read by a computed key without
  // this. Widened rather than narrowed: each family's response names a different subset, and the
  // field list is already the authority on which of them this product has.
  const source = accountingMappings as Record<string, MappedGlAccount | undefined>;

  for (const field of fields) {
    const accountId = source[field.responseKey]?.id;
    if (accountId !== undefined) {
      mappings[field.key] = accountId;
    }
  }
  return mappings;
}

/**
 * The slots a **savings product** maps.
 *
 * Enumerated the same way as the loan set, and it takes two passes to see all of it: supplying
 * the first seven makes the platform ask for `overdraftPortfolioControlId` and
 * `incomeFromInterestId` as well, which a single 400 does not reveal.
 *
 * Note `interestOnSavings` is an **expense**. Interest on a loan is income to the institution;
 * interest on a deposit is money it pays out, and pointing that slot at an income account is
 * refused.
 */
export const SAVINGS_ACCOUNTING_FIELDS: readonly AccountingMappingField[] = [
  {
    key: 'savingsReferenceAccountId',
    responseKey: 'savingsReferenceAccount',
    accountType: 'asset',
    label: 'PRODUCTS.ACCOUNTING.SAVINGS_REFERENCE',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'overdraftPortfolioControlId',
    responseKey: 'overdraftPortfolioControl',
    accountType: 'asset',
    label: 'PRODUCTS.ACCOUNTING.OVERDRAFT_PORTFOLIO',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'feesReceivableAccountId',
    responseKey: 'feeReceivableAccount',
    accountType: 'asset',
    label: 'PRODUCTS.ACCOUNTING.RECEIVABLE_FEE',
    rules: ACCRUAL_RULES,
  },
  {
    key: 'penaltiesReceivableAccountId',
    responseKey: 'penaltyReceivableAccount',
    accountType: 'asset',
    label: 'PRODUCTS.ACCOUNTING.RECEIVABLE_PENALTY',
    rules: ACCRUAL_RULES,
  },
  {
    key: 'savingsControlAccountId',
    responseKey: 'savingsControlAccount',
    accountType: 'liability',
    label: 'PRODUCTS.ACCOUNTING.SAVINGS_CONTROL',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'transfersInSuspenseAccountId',
    responseKey: 'transfersInSuspenseAccount',
    accountType: 'liability',
    label: 'PRODUCTS.ACCOUNTING.TRANSFERS_IN_SUSPENSE',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'interestPayableAccountId',
    responseKey: 'interestPayableAccount',
    accountType: 'liability',
    label: 'PRODUCTS.ACCOUNTING.INTEREST_PAYABLE',
    rules: ACCRUAL_RULES,
  },
  {
    key: 'incomeFromFeeAccountId',
    responseKey: 'incomeFromFeeAccount',
    accountType: 'income',
    label: INCOME_FROM_FEES_LABEL,
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'incomeFromPenaltyAccountId',
    responseKey: 'incomeFromPenaltyAccount',
    accountType: 'income',
    label: 'PRODUCTS.ACCOUNTING.INCOME_FROM_PENALTIES',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'incomeFromInterestId',
    responseKey: 'incomeFromInterest',
    accountType: 'income',
    label: 'PRODUCTS.ACCOUNTING.INCOME_FROM_INTEREST',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'interestOnSavingsAccountId',
    responseKey: 'interestOnSavingsAccount',
    accountType: 'expense',
    label: 'PRODUCTS.ACCOUNTING.INTEREST_ON_SAVINGS',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
  {
    key: 'writeOffAccountId',
    responseKey: 'writeOffAccount',
    accountType: 'expense',
    label: 'PRODUCTS.ACCOUNTING.LOSSES_WRITTEN_OFF',
    rules: ACCOUNTING_RULES_WITH_MAPPINGS,
  },
];

/**
 * The slots a **fixed or recurring deposit product** maps.
 *
 * The savings set without the two that only make sense on an account you can draw against: a
 * term deposit has no overdraft and nothing to write off, and the platform does not ask for
 * `writeOffAccountId`, `overdraftPortfolioControlId` or `incomeFromInterestId` on either family.
 * Both deposit families ask for exactly the same six, and the same three receivables on accrual.
 */
export const TERM_DEPOSIT_ACCOUNTING_FIELDS: readonly AccountingMappingField[] =
  SAVINGS_ACCOUNTING_FIELDS.filter(
    (field) =>
      !['writeOffAccountId', 'overdraftPortfolioControlId', 'incomeFromInterestId'].includes(
        field.key,
      ),
  );

/**
 * The rules a **share product** may carry.
 *
 * The share template is the one product template that returns no `accountingRuleOptions`, so
 * unlike the other families this list cannot come from the platform and is stated here.
 *
 * `NONE` and `CASH` only, and the omission of accrual is deliberate rather than conservative.
 * The platform's validator accepts 1, 2 and 3 — a 4 is refused with
 * `validation.msg.shareproduct.accountingRule.is.not.within.expected.range`, "must be between 1
 * and 3" — but a share product created with rule 3 asks for no mappings at all and reads back
 * with `accountingMappings: {}`. That is a product labelled ACCRUAL PERIODIC which posts nothing,
 * which is worse than one labelled NONE: it looks configured. Only the two rules that mean what
 * they say are offered.
 */
export const SHARE_ACCOUNTING_RULES: readonly AccountingRuleId[] = [
  ACCOUNTING_RULE.NONE,
  ACCOUNTING_RULE.CASH,
];

/**
 * The slots a **share product** maps.
 *
 * Enumerated from the platform the same way as the other families, and it names four rather than
 * the three the equity story suggests:
 *
 *     POST /products/share  {"accountingRule": 2, …no mapping ids…}
 *     → shareReferenceId, shareSuspenseId, incomeFromFeeAccountId, shareEquityId
 *
 * `shareEquityId` is the members' stake itself and is the only slot in the application that takes
 * an **equity** account. That matters twice over: pointing it at a liability is refused with
 * `403 validation.msg.domain.rule.violation`, and the share template omits
 * `equityAccountOptions` entirely until the tenant has at least one equity account — Fineract
 * drops an option list rather than sending it empty. A fresh chart of accounts therefore offers
 * nothing here, which {@link ProductAccountingSectionComponent} says out loud.
 *
 * Note the `responseKey`s: share products read back under the **same** keys they were written
 * with, `Id` suffix and all. Every other family drops the suffix — `fundSourceAccountId` in,
 * `fundSourceAccount` out — so this is the one field list where the two spellings coincide.
 */
export const SHARE_ACCOUNTING_FIELDS: readonly AccountingMappingField[] = [
  {
    key: 'shareReferenceId',
    responseKey: 'shareReferenceId',
    accountType: 'asset',
    label: 'PRODUCTS.ACCOUNTING.SHARE_REFERENCE',
    rules: [ACCOUNTING_RULE.CASH],
  },
  {
    key: 'shareSuspenseId',
    responseKey: 'shareSuspenseId',
    accountType: 'liability',
    label: 'PRODUCTS.ACCOUNTING.SHARE_SUSPENSE',
    rules: [ACCOUNTING_RULE.CASH],
  },
  {
    key: 'shareEquityId',
    responseKey: 'shareEquityId',
    accountType: 'equity',
    label: 'PRODUCTS.ACCOUNTING.SHARE_EQUITY',
    rules: [ACCOUNTING_RULE.CASH],
  },
  {
    key: 'incomeFromFeeAccountId',
    responseKey: 'incomeFromFeeAccountId',
    accountType: 'income',
    label: INCOME_FROM_FEES_LABEL,
    rules: [ACCOUNTING_RULE.CASH],
  },
];

// --- Advanced mappings ------------------------------------------------------------------------
//
// The base slots above send every payment to one fund source and every fee to one income
// account. These three tables override that per payment channel and per charge, which is what
// makes a till reconcilable at close of day and a fee line reportable on its own.

/** One payment channel routed to its own fund source. */
export interface PaymentChannelMapping {
  paymentTypeId?: number;
  fundSourceAccountId?: number;
}

/** One charge routed to its own income account. Used for both fees and penalties. */
export interface ChargeToIncomeMapping {
  chargeId?: number;
  incomeAccountId?: number;
}

/** The three advanced tables a product form holds. */
export interface AdvancedAccountingMappings {
  paymentChannelToFundSourceMappings: PaymentChannelMapping[];
  feeToIncomeAccountMappings: ChargeToIncomeMapping[];
  penaltyToIncomeAccountMappings: ChargeToIncomeMapping[];
}

/** An empty set of advanced tables. */
export function emptyAdvancedMappings(): AdvancedAccountingMappings {
  return {
    paymentChannelToFundSourceMappings: [],
    feeToIncomeAccountMappings: [],
    penaltyToIncomeAccountMappings: [],
  };
}

/** A row is worth sending only once both halves are chosen. */
function isCompletePaymentChannel(row: PaymentChannelMapping): boolean {
  return row.paymentTypeId != null && row.fundSourceAccountId != null;
}

function isCompleteChargeMapping(row: ChargeToIncomeMapping): boolean {
  return row.chargeId != null && row.incomeAccountId != null;
}

/**
 * The advanced tables as the create/update request carries them.
 *
 * Half-filled rows are dropped rather than sent: the tables are edited in place, so a user who
 * adds a row and then picks nothing would otherwise post `{}` into an array the platform reads
 * positionally.
 *
 * Empty tables produce **no key at all**. Both spellings are in fact accepted here — a loan
 * product posts identically with `[]` and with the key absent — but omitting keeps the request
 * to what the user actually configured, and matches how {@link mappingsForRule} treats the base
 * slots.
 *
 * A rule with no mappings gets nothing, for the same reason the base slots do.
 */
export function advancedMappingsForRequest(
  rule: number | undefined,
  mappings: AdvancedAccountingMappings,
): Record<string, unknown> {
  if (!ACCOUNTING_RULES_WITH_MAPPINGS.includes(rule as AccountingRuleId)) return {};

  const request: Record<string, unknown> = {};

  const channels = mappings.paymentChannelToFundSourceMappings.filter(isCompletePaymentChannel);
  if (channels.length) request['paymentChannelToFundSourceMappings'] = channels;

  const fees = mappings.feeToIncomeAccountMappings.filter(isCompleteChargeMapping);
  if (fees.length) request['feeToIncomeAccountMappings'] = fees;

  const penalties = mappings.penaltyToIncomeAccountMappings.filter(isCompleteChargeMapping);
  if (penalties.length) request['penaltyToIncomeAccountMappings'] = penalties;

  return request;
}

/** The response shape, which does not match the request shape. */
interface AdvancedMappingResponse {
  paymentChannelToFundSourceMappings?: {
    paymentType?: { id?: number };
    fundSourceAccount?: { id?: number };
  }[];
  feeToIncomeAccountMappings?: { charge?: { id?: number }; incomeAccount?: { id?: number } }[];
  penaltyToIncomeAccountMappings?: { charge?: { id?: number }; incomeAccount?: { id?: number } }[];
}

/**
 * The advanced tables a loaded product already has.
 *
 * The request and the response disagree about every key, which is the trap this exists for. A
 * product is written with `{paymentTypeId, fundSourceAccountId}` and reads back as
 * `{paymentType: {id}, fundSourceAccount: {id}}`; fees and penalties are written with
 * `{chargeId, incomeAccountId}` and read back as `{charge: {id}, incomeAccount: {id}}`. A form
 * that fed the response straight back into its model would show empty selects on a configured
 * product and then blank the mappings on save.
 */
export function advancedMappingsFromResponse(
  product: object | undefined,
): AdvancedAccountingMappings {
  const mappings = emptyAdvancedMappings();
  if (!product) return mappings;

  const source = product as AdvancedMappingResponse;

  mappings.paymentChannelToFundSourceMappings = (
    source.paymentChannelToFundSourceMappings ?? []
  ).map((row) => ({
    paymentTypeId: row.paymentType?.id,
    fundSourceAccountId: row.fundSourceAccount?.id,
  }));

  mappings.feeToIncomeAccountMappings = (source.feeToIncomeAccountMappings ?? []).map((row) => ({
    chargeId: row.charge?.id,
    incomeAccountId: row.incomeAccount?.id,
  }));

  mappings.penaltyToIncomeAccountMappings = (source.penaltyToIncomeAccountMappings ?? []).map(
    (row) => ({ chargeId: row.charge?.id, incomeAccountId: row.incomeAccount?.id }),
  );

  return mappings;
}
