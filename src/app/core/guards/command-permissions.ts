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
 * The permission each account command needs, for the routes that serve many commands from one
 * path.
 *
 * ## Why this exists
 *
 * A dispatch route cannot declare one permission. `/loans/:loanId/transactions/:type` serves
 * 29 commands and declared `UPDATE_LOAN` for all of them, which is wrong in **both** directions
 * — see issue #691. Fineract puts these commands in its `transaction_loan` and
 * `transaction_savings` groupings, while `UPDATE_LOAN` and `UPDATE_SAVINGSACCOUNT` live in
 * `portfolio`, so the route asked for a code the platform does not accept for any of them:
 *
 * ```
 * DISBURSE_LOAN holder  → platform 400 (authorised)  → route refused them
 * UPDATE_LOAN holder    → platform 403 (refused)     → route admitted them
 * ```
 *
 * The action gates on the buttons were already right (`appRequiresPermission="DISBURSE_LOAN"`),
 * so the two layers disagreed: the only control the screen offered a disburser led to Access
 * Denied, and an editor was led into a form whose submit could only 403.
 *
 * ## How these codes were established
 *
 * **Measured, not inferred.** Each entry was confirmed against a running Fineract by creating a
 * role holding exactly that code plus the matching `READ_*`, then sending the command with an
 * **empty body** to the endpoint the form actually posts to. Fineract authorises before it
 * validates, so the status separates the two questions without writing anything:
 *
 * ```
 * 403 error.msg.not.authorized      → the code does not authorise this command
 * 400 validation.msg.validation...  → it does, and only the body was wrong
 * ```
 *
 * That matters because the codes are not derivable from the command names. `withdrawnByClient`
 * needs `WITHDRAW_LOAN`, `waiveinterest` needs `WAIVEINTERESTPORTION_LOAN`, `close-rescheduled`
 * needs `CLOSEASRESCHEDULED_LOAN`, and `prepayLoan` needs `REPAYMENT_LOAN` because a prepayment
 * *is* a repayment. Guessing any of those would reproduce #691 one command at a time.
 *
 * ## Unmapped commands are not guessed at
 *
 * Three commands are deliberately absent, because the probe did not give a clean answer and a
 * wrong entry here is worse than no entry — it refuses a user the platform would have allowed:
 *
 * | Command                   | What the probe said |
 * | ------------------------- | ------------------- |
 * | `undoContractTermination` | 403 at the endpoint the form posts to, 400 at the other shape |
 * | `undowriteoff`            | 503 from the platform |
 * | `postInterestAsOn`        | 403 for `POSTINTERESTASONDATE_SAVINGSACCOUNT` *and* for `UPDATE_SAVINGSACCOUNT` |
 *
 * {@link commandPermission} answers `undefined` for those, which leaves the route with no
 * client-side gate — the same position the products action dispatch route is already in, and
 * documented in `scripts/check-route-permissions.mjs`. Fineract still refuses what it refuses;
 * what is given up is only the "not led into a screen that will 403" guarantee, for three
 * commands, rather than being wrong about all of them.
 *
 * `reAmortize` was the fourth, and is now mapped. The original probe read it as "400 at one
 * shape, 403 at the form's". Re-running it for issue #778, against the endpoint the form posts
 * to and with a role holding `REAMORTIZE_LOAN` and nothing else, the platform answered 404
 * `error.msg.loan.id.invalid` — past authorisation, failing only on the absent loan. The two
 * readings disagree and this is the one with the evidence recorded;
 * `e2e/loan-servicing-rbac-backend.spec.ts` re-measures it on every backend run, so a
 * regression either way reports itself rather than sitting in a comment.
 */

/**
 * Loan commands, keyed by the `:type` segment of `/loans/:loanId/transactions/:type`.
 *
 * The keys are the spellings `loan-transaction-form.component.ts` accepts — Fineract's own
 * command names, which are inconsistently cased (`charge-off` and `close-rescheduled` are
 * hyphenated, `undoDisbursal` is camel) and are passed through verbatim.
 */
export const LOAN_COMMAND_PERMISSIONS: Readonly<Record<string, string>> = {
  approve: 'APPROVE_LOAN',
  disburse: 'DISBURSE_LOAN',
  undoDisbursal: 'DISBURSALUNDO_LOAN',
  contractTermination: 'CONTRACT_TERMINATION_LOAN',
  repayment: 'REPAYMENT_LOAN',
  // A prepayment is a repayment as far as the platform is concerned; there is no PREPAY code.
  prepayLoan: 'REPAYMENT_LOAN',
  reject: 'REJECT_LOAN',
  withdrawnByClient: 'WITHDRAW_LOAN',
  waiveinterest: 'WAIVEINTERESTPORTION_LOAN',
  foreclosure: 'FORECLOSURE_LOAN',
  close: 'CLOSE_LOAN',
  'close-rescheduled': 'CLOSEASRESCHEDULED_LOAN',
  writeoff: 'WRITEOFF_LOAN',
  'charge-off': 'CHARGEOFF_LOAN',
  merchantIssuedRefund: 'MERCHANTISSUEDREFUND_LOAN',
  payoutRefund: 'PAYOUTREFUND_LOAN',
  refundByCash: 'REFUNDBYCASH_LOAN',
  chargeRefund: 'CHARGEREFUND_LOAN',
  goodwillCredit: 'GOODWILLCREDIT_LOAN',
  downPayment: 'DOWNPAYMENT_LOAN',
  interestPaymentWaiver: 'INTERESTPAYMENTWAIVER_LOAN',
  creditBalanceRefund: 'CREDITBALANCEREFUND_LOAN',
  recoverypayment: 'RECOVERYPAYMENT_LOAN',
  reAge: 'REAGE_LOAN',
  reAmortize: 'REAMORTIZE_LOAN',
  undoReAge: 'UNDO_REAGE_LOAN',
  undoReAmortize: 'UNDO_REAMORTIZE_LOAN',
  // Deferred-income postings, offered only on a loan whose product enables the feature. The
  // product flag governs whether the command is *applicable*; the code governs whether this
  // user may issue it, and the two are independent — see issue #779.
  buyDownFee: 'BUYDOWNFEE_LOAN',
  capitalizedIncome: 'CAPITALIZEDINCOME_LOAN',
};

/**
 * Loan commands that act on **one transaction** rather than on the loan.
 *
 * These are not reachable through `/loans/:loanId/transactions/:type`, because their URL carries
 * the transaction id: `POST /loans/{loanId}/transactions/{transactionId}?command=…`. They are
 * gated on the control that issues them instead of by a route guard, which is why they are a
 * separate map — a dispatch route cannot serve them.
 *
 * Measured by the same probe as the rest. The two deferred-income adjustments are the
 * interesting pair: issue #779 expected them at `POST /loans/{loanId}/transactions`, where the
 * platform answers `error.msg.query.parameter.value.unsupported` on `command` — the #268
 * discriminator for a command it does not recognise at that URL. They are recognised on the
 * per-transaction URL, each authorised by its own code and refused the bare adjust:
 *
 * ```
 * BUYDOWNFEEADJUSTMENT_LOAN   → POST /loans/1/transactions/1                               403 not.authorized
 * BUYDOWNFEEADJUSTMENT_LOAN   → POST /loans/1/transactions/1?command=buyDownFeeAdjustment   404 loan.id.invalid
 * ADJUST_LOAN                 → POST /loans/1/transactions/1                               400 transactionDate
 * ```
 *
 * So the bare POST is the generic adjustment and takes `ADJUST_LOAN`; naming a command switches
 * both the operation and the code it requires. `UNDO_WAIVECHARGE` is the odd one out in being a
 * `PUT` rather than a command — it is how a waive-charge transaction is reversed (#754) — and
 * neither `ADJUST_LOAN` nor `WAIVE_LOANCHARGE` authorises it.
 */
export const LOAN_TRANSACTION_COMMAND_PERMISSIONS = {
  /** `POST /loans/{loanId}/transactions/{transactionId}` with no command. */
  adjust: 'ADJUST_LOAN',
  buyDownFeeAdjustment: 'BUYDOWNFEEADJUSTMENT_LOAN',
  capitalizedIncomeAdjustment: 'CAPITALIZEDINCOMEADJUSTMENT_LOAN',
  /** `PUT /loans/{loanId}/transactions/{transactionId}` — reverses a waive-charge. */
  undoWaiveCharge: 'UNDO_WAIVECHARGE',
} as const satisfies Readonly<Record<string, string>>;

/**
 * Charge commands, for the three entities whose charges can be serviced.
 *
 * Gated on the row action rather than by a route guard: a charge is paid or waived from the
 * charge list, which has no route of its own per command. Every pairing below was measured, and
 * the spellings are the platform's own — a savings or client charge is paid with `paycharge`
 * while a loan charge is paid with `pay`, and nothing but the platform says so.
 *
 * `UPDATE_LOAN`, `UPDATE_SAVINGSACCOUNT` and `UPDATE_CLIENT` each authorise none of their
 * entity's charge commands, which is the same trap as #691 and #777 one layer down: the
 * portfolio write code does not carry the charge operations.
 */
export const CHARGE_COMMAND_PERMISSIONS = {
  loan: {
    pay: 'PAY_LOANCHARGE',
    waive: 'WAIVE_LOANCHARGE',
    adjustment: 'ADJUSTMENT_LOANCHARGE',
  },
  savings: {
    paycharge: 'PAY_SAVINGSACCOUNTCHARGE',
    waive: 'WAIVE_SAVINGSACCOUNTCHARGE',
    inactivate: 'INACTIVATE_SAVINGSACCOUNTCHARGE',
  },
  client: {
    paycharge: 'PAY_CLIENTCHARGE',
    waive: 'WAIVE_CLIENTCHARGE',
  },
} as const;

/**
 * Savings commands, keyed by the `:command` segment of
 * `/products/savings-accounts/:accountId/transactions/:command`.
 *
 * Only the ones the application links to. `postInterestAsOn` is served by the same form but is
 * unmapped — see the table above; neither its apparent code nor the one the route used to
 * declare authorises it, so there is nothing here to state honestly.
 *
 * `modify` needed no probe, for the reason the Working Capital map below did not: Fineract's
 * command dispatcher derives the permission from the handler's own annotation, and
 * `SavingsTransactionAdjustmentCommandHandler` declares
 * `@CommandType(entity = "SAVINGSACCOUNT", action = "ADJUSTTRANSACTION")`. The command spelling
 * is `SavingsApiConstants.COMMAND_ADJUST_TRANSACTION`, which is the string `modify` rather than
 * `adjust` — the one place this pairing is not guessable from either half. The code is present
 * in `scripts/permission-codes.json`, the catalogue taken from a running platform.
 *
 * `reverse` is deliberately absent. It is a row action on the account view, not a form route, so
 * nothing resolves a gate from this map for it; it is gated on the button with
 * `REVERSETRANSACTION_SAVINGSACCOUNT`, from
 * `ReverseTransactionSavingsAccountCommandHandler`'s annotation. An entry here would be dead.
 */
export const SAVINGS_COMMAND_PERMISSIONS: Readonly<Record<string, string>> = {
  deposit: 'DEPOSIT_SAVINGSACCOUNT',
  withdrawal: 'WITHDRAWAL_SAVINGSACCOUNT',
  modify: 'ADJUSTTRANSACTION_SAVINGSACCOUNT',
};

/**
 * Builds the `data.permissions` value for a dispatch route.
 *
 * Returns a function of the route's params rather than a code, which is what
 * {@link permissionGuard} calls once it knows which command is being opened. Returning
 * `undefined` for an unmapped command is deliberate and means "no client-side gate": see the
 * note above on why a guessed code is worse than none.
 *
 * @param param - the route parameter carrying the command (`type` for loans, `command` for savings)
 * @param permissions - the command-to-code map for that family
 */
export function commandPermission(
  param: string,
  permissions: Readonly<Record<string, string>>,
): (params: { get(name: string): string | null }) => string | undefined {
  return (params) => {
    const command = params.get(param);
    return command === null ? undefined : permissions[command];
  };
}

/**
 * Working Capital loan commands, keyed by the `:command` segment of
 * `/working-capital/loans/:id/action/:command`.
 *
 * Same defect as #691, one module later: the route declared `UPDATE_WORKINGCAPITALLOAN` for all of
 * these, and Fineract authorises that code for none of them — the lifecycle and transaction
 * commands live in its `transaction_loan` grouping while `UPDATE_WORKINGCAPITALLOAN` is portfolio.
 * See issue #777.
 *
 * ## How these codes were established
 *
 * Unlike the term-loan map above, these did not need a probe: the Working Capital module
 * documents the pairing itself, endpoint by endpoint, and every code below is present in
 * `scripts/permission-codes.json` — the catalogue snapshot taken from a running Fineract, which
 * `scripts/check-permission-codes.mjs` enforces. The command spellings come from
 * `WorkingCapitalLoanConstants` and from the `@Operation` description on
 * `WorkingCapitalLoanTransactionsApiResource`, which lists exactly: `repayment`,
 * `creditBalanceRefund`, `payoutRefund`, `goodwillCredit`, `discountFee`,
 * `discountFeeAdjustment`, `chargeOff`, `undoChargeOff`, `writeOff`, `undoWriteOff`,
 * `recoveryPayment`.
 *
 * Two keys are the UI's own rather than Fineract's, and are kept because changing them would
 * break links that already exist:
 *
 *   - `markasfraud`, `discount` and `paymentrate` are `PUT` sub-resources, not commands.
 *   - `prepay` posts `command=repayment` with the amount the `prepayLoan` template offers. There
 *     is no prepay permission: a prepayment *is* a repayment, exactly as for term loans.
 *
 * `discountFee` was added later than the rest and *was* probed, because the module's
 * documentation does not pair it with a code: a role holding only
 * `DISCOUNTFEE_WORKINGCAPITALLOAN` is authorised for it and refused every other command, and
 * every other single-code role is refused `discountFee`.
 *
 * Three further commands act on **one transaction** rather than on the loan, so they are not
 * reachable through this dispatch route and are gated on the buttons that issue them (#773,
 * #774). Their codes were established by the same probe:
 * `undo` → `UNDO_WORKINGCAPITALLOANTRANSACTION`, `adjust` →
 * `ADJUST_WORKINGCAPITALLOANTRANSACTION`, `discountFeeAdjustment` →
 * `DISCOUNTFEEADJUSTMENT_WORKINGCAPITALLOAN`, and the charge command `adjustment` →
 * `ADJUSTMENT_WORKINGCAPITALLOANCHARGE`.
 */
export const WC_LOAN_COMMAND_PERMISSIONS: Readonly<Record<string, string>> = {
  // Lifecycle — POST /working-capital-loans/{id}?command=…
  approve: 'APPROVE_WORKINGCAPITALLOAN',
  undoapproval: 'APPROVALUNDO_WORKINGCAPITALLOAN',
  reject: 'REJECT_WORKINGCAPITALLOAN',
  disburse: 'DISBURSE_WORKINGCAPITALLOAN',
  undodisbursal: 'DISBURSALUNDO_WORKINGCAPITALLOAN',

  // PUT sub-resources, reached through the same action form
  markasfraud: 'SETFRAUD_WORKINGCAPITALLOAN',
  discount: 'UPDATEDISCOUNT_WORKINGCAPITALLOAN',
  paymentrate: 'UPDATERATE_WORKINGCAPITALLOAN',

  // Transactions — POST /working-capital-loans/{id}/transactions?command=…
  repayment: 'REPAYMENT_WORKINGCAPITALLOAN',
  prepay: 'REPAYMENT_WORKINGCAPITALLOAN',
  goodwillCredit: 'GOODWILLCREDIT_WORKINGCAPITALLOAN',
  payoutRefund: 'PAYOUTREFUND_WORKINGCAPITALLOAN',
  creditBalanceRefund: 'CREDITBALANCEREFUND_WORKINGCAPITALLOAN',
  discountFee: 'DISCOUNTFEE_WORKINGCAPITALLOAN',
  chargeOff: 'CHARGEOFF_WORKINGCAPITALLOAN',
  undoChargeOff: 'UNDOCHARGEOFF_WORKINGCAPITALLOAN',
  writeOff: 'WRITEOFF_WORKINGCAPITALLOAN',
  undoWriteOff: 'UNDOWRITEOFF_WORKINGCAPITALLOAN',
  recoveryPayment: 'RECOVERYPAYMENT_WORKINGCAPITALLOAN',
};

/** `data.permissions` for `/loans/:loanId/transactions/:type`. */
export const loanCommandPermission = commandPermission('type', LOAN_COMMAND_PERMISSIONS);

/** `data.permissions` for `/products/savings-accounts/:accountId/transactions/:command`. */
export const savingsCommandPermission = commandPermission('command', SAVINGS_COMMAND_PERMISSIONS);

/** `data.permissions` for `/working-capital/loans/:id/action/:command`. */
export const wcLoanCommandPermission = commandPermission('command', WC_LOAN_COMMAND_PERMISSIONS);
