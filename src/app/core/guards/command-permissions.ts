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
 * Four commands are deliberately absent, because the probe did not give a clean answer and a
 * wrong entry here is worse than no entry — it refuses a user the platform would have allowed:
 *
 * | Command                   | What the probe said |
 * | ------------------------- | ------------------- |
 * | `undoContractTermination` | 403 at the endpoint the form posts to, 400 at the other shape |
 * | `reAmortize`              | the mirror image: 400 at one shape, 403 at the form's |
 * | `undowriteoff`            | 503 from the platform |
 * | `postInterestAsOn`        | 403 for `POSTINTERESTASONDATE_SAVINGSACCOUNT` *and* for `UPDATE_SAVINGSACCOUNT` |
 *
 * {@link commandPermission} answers `undefined` for those, which leaves the route with no
 * client-side gate — the same position the products action dispatch route is already in, and
 * documented in `scripts/check-route-permissions.mjs`. Fineract still refuses what it refuses;
 * what is given up is only the "not led into a screen that will 403" guarantee, for four
 * commands, rather than being wrong about all of them.
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
};

/**
 * Savings commands, keyed by the `:command` segment of
 * `/products/savings-accounts/:accountId/transactions/:command`.
 *
 * Only the two the application links to. `postInterestAsOn` is served by the same form but is
 * unmapped — see the table above; neither its apparent code nor the one the route used to
 * declare authorises it, so there is nothing here to state honestly.
 */
export const SAVINGS_COMMAND_PERMISSIONS: Readonly<Record<string, string>> = {
  deposit: 'DEPOSIT_SAVINGSACCOUNT',
  withdrawal: 'WITHDRAWAL_SAVINGSACCOUNT',
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

/** `data.permissions` for `/loans/:loanId/transactions/:type`. */
export const loanCommandPermission = commandPermission('type', LOAN_COMMAND_PERMISSIONS);

/** `data.permissions` for `/products/savings-accounts/:accountId/transactions/:command`. */
export const savingsCommandPermission = commandPermission('command', SAVINGS_COMMAND_PERMISSIONS);
