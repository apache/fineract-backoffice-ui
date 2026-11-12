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

import { InjectionToken, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { FineractDepositAccountApi } from './fineract-deposit-account.api';

/**
 * Which kind of term deposit. Fineract gives the two their own endpoints and their own generated
 * services, and the screens serve both, so every operation here takes it.
 */
export type DepositType = 'fixed' | 'recurring';

/**
 * A term deposit account, as the application understands one.
 *
 * ## Why this model exists
 *
 * Four separate defects in this module came from reading a field that is not where it looks like
 * it should be, and three of them had unit tests that passed against invented fixtures. Each one
 * is a statement about the wire that was made at the call site instead of once:
 *
 * | Read                                   | What the payload actually does                    |
 * | -------------------------------------- | ------------------------------------------------- |
 * | `accountBalance`                       | absent; the balance is `summary.accountBalance`   |
 * | `savingsProductId`                     | absent; a deposit answers `depositProductId`      |
 * | template's `nominalAnnualInterestRate` | sent as `0`; the rate is in the chart's slabs     |
 * | template's `depositAmount`             | absent; it is on the *product*                    |
 * | `productName`                          | absent; a deposit answers `depositProductName`    |
 *
 * All five were measured against a running Fineract. Stated here, they are stated once, and the
 * next screen to read a deposit cannot get them wrong — which is what ADR 0006's boundary is
 * for.
 *
 * The last one is what the untyped `raw` record this model used to carry was hiding: the account
 * view read `raw['productName']`, which a deposit account does not send, so the heading of every
 * fixed and recurring deposit account was blank. Nothing here is read by string any more.
 */
export interface DepositAccount {
  readonly id: number;
  readonly accountNo: string;
  readonly clientId: number | null;
  /** `depositProductName`, not `productName` — see the table above. */
  readonly productName: string;
  readonly clientName: string;
  readonly groupId: number | null;
  readonly groupName: string;
  /** `depositProductId` on a deposit account; `savingsProductId` is the savings response's name. */
  readonly productId: number | null;
  /** `summary.accountBalance`. `null` when the payload states none, never 0 — see below. */
  readonly balance: number | null;
  readonly depositAmount: number | null;
  /**
   * What a recurring deposit collects each period.
   *
   * `mandatoryRecommendedDepositAmount` on the wire. The recurring-deposit list rendered
   * `recurringDepositAmount`, which — measured against a running Fineract — the response does
   * not carry at all, so its Amount column was empty on every row. `null` on a fixed deposit,
   * which collects once.
   */
  readonly recurringDepositAmount: number | null;
  readonly depositPeriod: number | null;
  /** The unit the period is in ("Months"), from `depositPeriodFrequency`. */
  readonly depositPeriodUnit: string | null;
  /** That unit's id, which is what an update has to send back. */
  readonly depositPeriodFrequencyId: number | null;
  /**
   * What happens at maturity, as an id.
   *
   * `null` on every account measured: the platform was not observed to echo
   * `maturityInstruction` on `GET /{type}depositaccounts/{id}`, even with `associations=all`, so
   * the edit form falls back to the template's default rather than showing the agreed
   * instruction. Mapped rather than assumed absent, so the day the platform does send it the
   * form picks it up.
   */
  readonly maturityInstructionId: number | null;
  readonly maturityAmount: number | null;
  /** ISO `YYYY-MM-DD`, converted from Fineract's `[year, month, day]`. */
  readonly maturityDate: string | null;
  readonly nominalAnnualInterestRate: number | null;
  /** The account number of the savings account that *funded* this deposit, if one did. */
  readonly linkedAccountNo: string | null;
  readonly transferInterestToSavings: boolean;
  /**
   * The charges on this account.
   *
   * Present because {@link DepositAccountApi.get} asks for `associations=all`. The screen used
   * to fetch the account twice — once through the generated client without associations, then
   * again by hand with them — to get this list.
   */
  readonly charges: readonly DepositAccountCharge[];
  /**
   * This account's own rate chart, as the interest-rate-chart tab displays it.
   *
   * A richer shape than {@link DepositRateSlab}, which carries only what a *request* needs:
   * a displayed slab also has the period type's label, the amount band it applies to, its
   * description and its incentives. Present for the same reason `charges` is — the account is
   * read with `associations=all`.
   */
  readonly chartRows: readonly DepositChartRow[];
  readonly status: DepositAccountStatus;
  /** The currency's display symbol ("$"), which is what the screens print beside a figure. */
  readonly currencySymbol: string;
  /** The ISO code ("USD"), which is what Angular's `CurrencyPipe` takes. */
  readonly currencyCode: string;
  /** A savings field, absent on a term deposit; `null` rather than 0 when it is. */
  readonly minRequiredOpeningBalance: number | null;
  readonly timeline: DepositAccountTimeline;
}

/**
 * A deposit account's state.
 *
 * The flags, not `value`, are what the screens gate actions on: `value` is the platform's own
 * English label and moves with its locale, while the booleans beside it do not.
 */
export interface DepositAccountStatus {
  /** The platform's label, for display only. */
  readonly value: string;
  readonly submittedAndPendingApproval: boolean;
  readonly approved: boolean;
  readonly active: boolean;
}

/**
 * The dates the platform itself stamped on this account, as ISO `YYYY-MM-DD`.
 *
 * A command's date is validated against these — an approval cannot precede submission, an
 * activation cannot precede approval — so the screens send the later of the stamped date and
 * today rather than trusting the browser's clock. See `commandDateIso` on the account view.
 */
export interface DepositAccountTimeline {
  readonly submittedOnDate: string | null;
  readonly approvedOnDate: string | null;
  readonly activatedOnDate: string | null;
}

/**
 * One row of a deposit account's interest rate chart, flattened for display.
 *
 * The generated `GetFixedDepositAccountsChartSlabs`/`GetRecurringDepositAccountsChartSlabs`
 * models describe only `annualInterestRate`, `currency`, `fromPeriod`, `id`, `periodType` and
 * `toPeriod`. The amount band, description and incentives the real response carries are in
 * neither, so this is modelled from what was measured on the wire rather than forced through an
 * incomplete type — issue #653's class of problem.
 */
export interface DepositChartRow {
  readonly fromPeriod: number | null;
  readonly toPeriod: number | null;
  /** The period type's label ("Months"); the id is not displayed. */
  readonly periodTypeLabel: string;
  readonly amountRangeFrom: number | null;
  readonly amountRangeTo: number | null;
  readonly annualInterestRate: number | null;
  readonly description: string;
  readonly incentives: readonly DepositChartIncentive[];
}

/** One incentive under a chart row, with each of its enums flattened to its label. */
export interface DepositChartIncentive {
  readonly entityType: string;
  readonly attributeName: string;
  readonly conditionType: string;
  readonly attributeValue: string;
  readonly incentiveType: string;
  readonly amount: number | null;
}

/** A charge on a deposit account, as the charges tab shows one. */
export interface DepositAccountCharge {
  readonly id: number | null;
  readonly name: string;
  readonly amount: number | null;
  readonly amountOutstanding: number | null;
}

/**
 * What opening a deposit account offers, from `GET /{type}depositaccounts/template`.
 *
 * `rate` is deliberately absent: the template's own `nominalAnnualInterestRate` is `0` even for a
 * product whose chart pays 7%, so a rate here would be a lie. The caller reads it out of
 * {@link chartSlabs} for the term it is opening, which is what `rateForTerm` does.
 */
export interface DepositAccountTemplate {
  /** The product's minimum term, which is the sensible default for a new account. */
  readonly minDepositTerm: number | null;
  /** The unit of that term, as a period-frequency id. */
  readonly minDepositTermTypeId: number | null;
  readonly chartSlabs: readonly DepositRateSlab[];
  readonly savingsAccounts: readonly DepositSavingsAccount[];
  readonly maturityInstructions: readonly DepositEnumOption[];
  readonly chargeOptions: readonly DepositChargeOption[];
  /** The products this client may open an account under. */
  readonly productOptions: readonly DepositProductOption[];
}

/** A deposit product, as the account template's picker lists one. */
export interface DepositProductOption {
  readonly id: number;
  readonly name: string;
}

/** One band of a product's rate chart, flattened out of its enum wrappers. */
export interface DepositRateSlab {
  readonly periodTypeId: number | null;
  readonly fromPeriod: number | null;
  /** Absent on an open-ended last band, which is how "12 months and over" is written. */
  readonly toPeriod: number | null;
  readonly annualInterestRate: number | null;
}

/** A savings account of the same client. */
export interface DepositSavingsAccount {
  readonly id: number;
  readonly accountNo: string;
}

/** An id-and-label option, as Fineract's enum lists give one. */
export interface DepositEnumOption {
  readonly id: number;
  readonly value: string;
}

/** A charge the product allows on its accounts. */
export interface DepositChargeOption {
  readonly id: number;
  readonly name: string;
}

/**
 * What closing a deposit offers, from the account's own `?command=close` template.
 *
 * The options are returned unfiltered. Which of them the platform will actually accept depends
 * on the command — measured, `prematureClose` refuses the two re-investment options with
 * `reinvest.not.allowed` while the template offers them for both — and that is a rule about the
 * *operation*, so the dialog applies it rather than this adapter pretending the template said so.
 */
export interface DepositClosureTemplate {
  readonly options: readonly DepositEnumOption[];
  readonly transferTargets: readonly DepositSavingsAccount[];
  /** The account this deposit already pays into, when it has one. */
  readonly defaultTransferTargetId: number | null;
}

/** A charge to attach to a deposit account. The date is ISO; the adapter adds the format. */
export interface DepositChargeRequest {
  readonly chargeId: number;
  readonly amount: number;
  readonly dueDate: string;
}

/**
 * One transaction on a deposit account, as the lists and the account view show one.
 *
 * Modelled rather than passed through, which is a change from what this adapter first did. Two
 * screens rendered the payload directly and both printed the wire rather than the fact:
 * `date` is Fineract's `[year, month, day]`, so the transactions list showed "2026,10,18", and
 * the type was read as `transactionType.code`, so the same row's type showed
 * "savingsAccountTransactionType.payCharge". Both measured against a running Fineract.
 *
 * `entryType` stays the platform's own `'DEBIT'`/`'CREDIT'` string: the screens colour a row by
 * it, and inventing a boolean here would only move the comparison.
 */
export interface DepositTransaction {
  readonly id: number;
  /** ISO `YYYY-MM-DD`, converted from `[year, month, day]`. */
  readonly date: string | null;
  readonly amount: number | null;
  /** `transactionType.value` — "Pay Charge", not `savingsAccountTransactionType.payCharge`. */
  readonly typeLabel: string;
  /** `'DEBIT'` or `'CREDIT'`, as the payload states it. */
  readonly entryType: string;
  readonly runningBalance: number | null;
  readonly reversed: boolean;
  /** The row's own currency symbol; a transaction carries its account's currency. */
  readonly currencySymbol: string;
}

/** Which transaction is being posted. A fixed deposit accepts only the first. */
export type DepositTransactionCommand = 'deposit' | 'withdrawal';

/**
 * What posting a transaction offers.
 *
 * Only the payment channels, because that is the one field the forms ask for that the tenant
 * defines. The rest of the template is a blank transaction.
 */
export interface DepositTransactionTemplate {
  readonly paymentTypes: readonly DepositPaymentType[];
}

/**
 * A payment channel the tenant has defined.
 *
 * The generated models type `paymentTypeOptions` as `Array<number>`, which the platform does not
 * honour — measured, it answers objects carrying `id` and `name`. Bound to the raw element, a
 * select renders `[object Object]` and posts an object as `paymentTypeId`, which is what the
 * recurring-deposit form did. Stated here, both forms get the shape that is really on the wire.
 */
export interface DepositPaymentType {
  readonly id: number;
  readonly name: string;
}

/**
 * One on-hold fund transaction of a savings account.
 *
 * A savings concern rather than a deposit one, on this port for the same reason
 * {@link DepositAccountApi.addCharge} is: the screen that shows them lives in this module, and
 * `GET /savingsaccounts/{id}/onholdtransactions` is the only endpoint that serves it.
 *
 * `loanId` is what the rows are *for*: these holds are created as a side effect of a loan
 * guarantee, not by a teller. The screen used to show `loanClientName`, which measured against a
 * running Fineract is not a field of this response at all — so its "reason" column was blank on
 * every row. What the response does carry is `savingsClientName`, `savingsAccountNo` and
 * `loanId`.
 */
export interface SavingsOnHoldTransaction {
  readonly id: number;
  /** ISO `YYYY-MM-DD`, converted from `[year, month, day]`. */
  readonly date: string | null;
  readonly amount: number | null;
  /** `transactionType.value` — "hold" or "release". */
  readonly typeLabel: string;
  readonly reversed: boolean;
  /** `null` rather than 0 when the payload states no loan. */
  readonly loanId: number | null;
  readonly clientName: string;
}

/**
 * Term deposit accounts, stated as application operations.
 *
 * One token for both kinds. Every method takes the {@link DepositType} rather than there being
 * two tokens, because the screens are one screen: a caller that had to pick an adapter would be
 * making the same `isRD ? … : …` choice this hides.
 */
export interface DepositAccountApi {
  /** One account, with its charges and rate chart. */
  get(type: DepositType, accountId: number): Observable<DepositAccount>;

  /**
   * Every account of this kind, for the list screens.
   *
   * Measured, `GET /{type}depositaccounts` answers the same account payload `get` does, minus
   * the associations — so a list row is a {@link DepositAccount} with no charges and no chart
   * rather than a shape of its own. That is what lets the list screens gate their actions on
   * `status.submittedAndPendingApproval` instead of comparing `status.value` against the English
   * string "Submitted and pending approval", which is what they used to do.
   */
  list(type: DepositType): Observable<DepositAccount[]>;

  /** The account's transactions, with their dates converted and their types labelled. */
  transactions(type: DepositType, accountId: number): Observable<DepositTransaction[]>;

  /**
   * What posting a transaction offers.
   *
   * Takes the command because the two deposit types disagree about whether it is optional:
   * measured, `GET /recurringdepositaccounts/{id}/transactions/template` answers `400`
   * `error.msg.query.parameter.value.unsupported` without one, while the fixed-deposit path
   * serves the template either way. The recurring-deposit form omitted it, so its payment-type
   * list was empty on every load.
   */
  transactionTemplate(
    type: DepositType,
    accountId: number,
    command: DepositTransactionCommand,
  ): Observable<DepositTransactionTemplate>;

  /**
   * Posts a deposit or a withdrawal.
   *
   * Returns the platform's response rather than `void`: the forms hand it to
   * `MutationOutcomeService`, which reads the new resource id out of it and recognises a
   * maker-checker hold.
   *
   * The two generated methods for this disagree in a way that compiles either way — one takes
   * `(accountId, command, body)` and the other `(accountId, body, command)` — which is exactly
   * the kind of wire detail this boundary exists to hold.
   */
  postTransaction(
    type: DepositType,
    accountId: number,
    command: DepositTransactionCommand,
    body: Record<string, unknown>,
  ): Observable<unknown>;

  /**
   * What opening an account under this product offers.
   *
   * `clientId` is optional, and absent is not the same as 0: measured, `?clientId=0` answers
   * `404` "Client not found with valuer 0", while omitting it serves the generic template with
   * every product listed. A caller that passed `clientId ?? 0` to list the products before a
   * client was chosen therefore got no products at all.
   */
  template(
    type: DepositType,
    clientId?: number,
    productId?: number,
  ): Observable<DepositAccountTemplate>;

  /** The deposit amount the product defaults to, which the account template does not carry. */
  productDepositAmount(type: DepositType, productId: number): Observable<number | null>;

  /** What closing this account offers. */
  closureTemplate(type: DepositType, accountId: number): Observable<DepositClosureTemplate>;

  /**
   * What the client would receive if the deposit were closed today.
   *
   * A `POST` that changes nothing — it prices the closure — and the difference between a teller
   * quoting a figure and guessing one. `null` when the platform does not answer with one.
   */
  prematureAmount(
    type: DepositType,
    accountId: number,
    closedOnDate: string,
  ): Observable<number | null>;

  /** Opens an account. The caller builds the body, which differs by deposit type and product. */
  create(type: DepositType, body: Record<string, unknown>): Observable<void>;

  /**
   * Changes an open application.
   *
   * The caller names the fields: an update must not resend the client and product, and every
   * field it leaves out is a field the platform drops.
   */
  update(type: DepositType, accountId: number, body: Record<string, unknown>): Observable<void>;

  /**
   * Issues a command against one transaction — `undo` being the one the screens use.
   *
   * Separate from {@link command} because the URL carries the transaction id, and because the
   * two deposit types have differently-named generated methods for it that take the body as a
   * required positional argument even when the command ignores it.
   */
  transactionCommand(
    type: DepositType,
    accountId: number,
    transactionId: number,
    command: string,
  ): Observable<void>;

  /** Issues a lifecycle or servicing command. The caller builds the body; the platform varies. */
  command(
    type: DepositType,
    accountId: number,
    command: string,
    body: Record<string, unknown>,
  ): Observable<void>;

  /**
   * Attaches a charge.
   *
   * A deposit account is a savings-type account, and `POST /savingsaccounts/{id}/charges` is the
   * only endpoint the platform exposes for charging one — there is no deposit-specific path.
   */
  addCharge(accountId: number, charge: DepositChargeRequest): Observable<void>;

  /** A savings account's on-hold fund transactions — see {@link SavingsOnHoldTransaction}. */
  onHoldTransactions(savingsId: number): Observable<SavingsOnHoldTransaction[]>;
}

/**
 * Injection token for the active {@link DepositAccountApi}. Defaults to the Fineract
 * implementation.
 */
export const DEPOSIT_ACCOUNT_API = new InjectionToken<DepositAccountApi>('DepositAccountApi', {
  providedIn: 'root',
  factory: () => inject(FineractDepositAccountApi),
});
