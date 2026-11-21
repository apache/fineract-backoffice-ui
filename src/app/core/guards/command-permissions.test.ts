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

import {
  CHARGE_COMMAND_PERMISSIONS,
  LOAN_COMMAND_PERMISSIONS,
  LOAN_TRANSACTION_COMMAND_PERMISSIONS,
  SAVINGS_COMMAND_PERMISSIONS,
  WC_LOAN_COMMAND_PERMISSIONS,
  commandPermission,
  loanCommandPermission,
  savingsCommandPermission,
  wcLoanCommandPermission,
} from './command-permissions';

/** A `paramMap` stand-in; the resolver only ever calls `get`. */
function params(values: Record<string, string>): { get(name: string): string | null } {
  return { get: (name) => values[name] ?? null };
}

/**
 * Commands the transaction form accepts but this map deliberately does not cover.
 *
 * Asserted as a list rather than left implicit, because the honest reason for each is that the
 * authorisation probe gave no clean answer — not that they were forgotten. If one of these ever
 * gains an entry, this test is where the claim that it was unknowable gets retired.
 */
const DELIBERATELY_UNMAPPED = ['undoContractTermination', 'undowriteoff'] as const;

describe('LOAN_COMMAND_PERMISSIONS', () => {
  it('maps every code to Fineract spelling: upper snake case, suffixed _LOAN', () => {
    // The defect class this guards against is a code that does not exist, which can never be
    // satisfied by any role and so refuses everyone silently.
    for (const [command, code] of Object.entries(LOAN_COMMAND_PERMISSIONS)) {
      expect(code, `${command} maps to a malformed code`).toMatch(/^[A-Z][A-Z0-9_]*_LOAN$/);
    }
  });

  it('never maps a command to UPDATE_LOAN', () => {
    // The whole point. UPDATE_LOAN is in Fineract's `portfolio` grouping and authorises none of
    // these commands; declaring it for every one of them is issue #691.
    expect(Object.values(LOAN_COMMAND_PERMISSIONS)).not.toContain('UPDATE_LOAN');
  });

  it('covers the three commands the loan view offers as buttons', () => {
    // Approve, Disburse and Repayment are the controls on the loan screen itself, so a gap here
    // is a dead-end control rather than an obscure menu item.
    expect(LOAN_COMMAND_PERMISSIONS['approve']).toBe('APPROVE_LOAN');
    expect(LOAN_COMMAND_PERMISSIONS['disburse']).toBe('DISBURSE_LOAN');
    expect(LOAN_COMMAND_PERMISSIONS['repayment']).toBe('REPAYMENT_LOAN');
  });

  it('treats a prepayment as a repayment, because the platform has no separate code', () => {
    expect(LOAN_COMMAND_PERMISSIONS['prepayLoan']).toBe('REPAYMENT_LOAN');
  });

  it('leaves the commands whose code could not be established unmapped', () => {
    for (const command of DELIBERATELY_UNMAPPED) {
      expect(LOAN_COMMAND_PERMISSIONS[command], `${command} should be unmapped`).toBeUndefined();
    }
  });

  it('maps reAmortize, which the first probe could not settle', () => {
    // It was in DELIBERATELY_UNMAPPED until #778 re-probed it. Pinned on its own so that
    // removing it again is a deliberate act with a failing test attached.
    expect(LOAN_COMMAND_PERMISSIONS['reAmortize']).toBe('REAMORTIZE_LOAN');
  });

  it('separates each undo from the action it reverses', () => {
    // An operator who may re-age is not thereby an operator who may put the schedule back:
    // #778 asks for the undo to sit with a supervisor, which only holds if the codes differ.
    expect(LOAN_COMMAND_PERMISSIONS['undoReAge']).toBe('UNDO_REAGE_LOAN');
    expect(LOAN_COMMAND_PERMISSIONS['undoReAmortize']).toBe('UNDO_REAMORTIZE_LOAN');
    expect(LOAN_COMMAND_PERMISSIONS['undoReAge']).not.toBe(LOAN_COMMAND_PERMISSIONS['reAge']);
    expect(LOAN_COMMAND_PERMISSIONS['undoReAmortize']).not.toBe(
      LOAN_COMMAND_PERMISSIONS['reAmortize'],
    );
  });

  it('maps the two deferred-income postings', () => {
    expect(LOAN_COMMAND_PERMISSIONS['buyDownFee']).toBe('BUYDOWNFEE_LOAN');
    expect(LOAN_COMMAND_PERMISSIONS['capitalizedIncome']).toBe('CAPITALIZEDINCOME_LOAN');
  });
});

describe('LOAN_TRANSACTION_COMMAND_PERMISSIONS', () => {
  it('keeps the generic adjustment apart from the two typed ones', () => {
    // The platform switches both the operation and the code on the `command` parameter: the
    // bare POST is the generic adjust and takes ADJUST_LOAN, which is refused each typed one.
    expect(LOAN_TRANSACTION_COMMAND_PERMISSIONS.adjust).toBe('ADJUST_LOAN');
    expect(LOAN_TRANSACTION_COMMAND_PERMISSIONS.buyDownFeeAdjustment).toBe(
      'BUYDOWNFEEADJUSTMENT_LOAN',
    );
    expect(LOAN_TRANSACTION_COMMAND_PERMISSIONS.capitalizedIncomeAdjustment).toBe(
      'CAPITALIZEDINCOMEADJUSTMENT_LOAN',
    );
  });

  it('separates posting a deferred-income transaction from adjusting one', () => {
    // #779 asks for this explicitly: an adjustment moves recognised income, so it is not the
    // same authority as posting the fee in the first place.
    expect(LOAN_TRANSACTION_COMMAND_PERMISSIONS.buyDownFeeAdjustment).not.toBe(
      LOAN_COMMAND_PERMISSIONS['buyDownFee'],
    );
    expect(LOAN_TRANSACTION_COMMAND_PERMISSIONS.capitalizedIncomeAdjustment).not.toBe(
      LOAN_COMMAND_PERMISSIONS['capitalizedIncome'],
    );
  });

  it('reverses a waive-charge with neither the adjust nor the waive code', () => {
    // Measured: a role holding ADJUST_LOAN is refused the PUT, and so is one holding
    // WAIVE_LOANCHARGE. Falling back to either would lock the undo out of every role.
    expect(LOAN_TRANSACTION_COMMAND_PERMISSIONS.undoWaiveCharge).toBe('UNDO_WAIVECHARGE');
    expect(LOAN_TRANSACTION_COMMAND_PERMISSIONS.undoWaiveCharge).not.toBe('ADJUST_LOAN');
    expect(LOAN_TRANSACTION_COMMAND_PERMISSIONS.undoWaiveCharge).not.toBe(
      CHARGE_COMMAND_PERMISSIONS.loan.waive,
    );
  });
});

describe('CHARGE_COMMAND_PERMISSIONS', () => {
  it("uses the platform spelling for paying each entity's charge", () => {
    // A loan charge is paid with `pay`; a savings or client charge with `paycharge`. The
    // inconsistency is Fineract's, and guessing either way produces an unsupported command.
    expect(CHARGE_COMMAND_PERMISSIONS.loan).toHaveProperty('pay');
    expect(CHARGE_COMMAND_PERMISSIONS.savings).toHaveProperty('paycharge');
    expect(CHARGE_COMMAND_PERMISSIONS.client).toHaveProperty('paycharge');
    expect(CHARGE_COMMAND_PERMISSIONS.loan).not.toHaveProperty('paycharge');
  });

  it('gates each entity on its own charge codes', () => {
    expect(Object.values(CHARGE_COMMAND_PERMISSIONS.loan)).toEqual([
      'PAY_LOANCHARGE',
      'WAIVE_LOANCHARGE',
      'ADJUSTMENT_LOANCHARGE',
    ]);
    expect(Object.values(CHARGE_COMMAND_PERMISSIONS.savings)).toEqual([
      'PAY_SAVINGSACCOUNTCHARGE',
      'WAIVE_SAVINGSACCOUNTCHARGE',
      'INACTIVATE_SAVINGSACCOUNTCHARGE',
    ]);
    expect(Object.values(CHARGE_COMMAND_PERMISSIONS.client)).toEqual([
      'PAY_CLIENTCHARGE',
      'WAIVE_CLIENTCHARGE',
    ]);
  });

  it("never falls back to the entity's portfolio write code", () => {
    // Measured for all three: UPDATE_LOAN, UPDATE_SAVINGSACCOUNT and UPDATE_CLIENT are each
    // refused their own entity's charge commands. #691 and #777, one layer down.
    const codes = Object.values(CHARGE_COMMAND_PERMISSIONS).flatMap((entity) =>
      Object.values(entity),
    );
    expect(codes).not.toContain('UPDATE_LOAN');
    expect(codes).not.toContain('UPDATE_SAVINGSACCOUNT');
    expect(codes).not.toContain('UPDATE_CLIENT');
  });
});

describe('SAVINGS_COMMAND_PERMISSIONS', () => {
  it('maps each form command to the code its handler declares', () => {
    expect(SAVINGS_COMMAND_PERMISSIONS).toEqual({
      deposit: 'DEPOSIT_SAVINGSACCOUNT',
      withdrawal: 'WITHDRAWAL_SAVINGSACCOUNT',
      // `modify` rather than `adjust`: the command spelling is
      // SavingsApiConstants.COMMAND_ADJUST_TRANSACTION, while the code comes from
      // SavingsTransactionAdjustmentCommandHandler's @CommandType annotation.
      modify: 'ADJUSTTRANSACTION_SAVINGSACCOUNT',
    });
  });

  it('leaves reverse out, because nothing resolves a gate from this map for it', () => {
    // A row action on the account view, not a form route: it is gated on the button with
    // REVERSETRANSACTION_SAVINGSACCOUNT. An entry here would be dead, and an exact-match
    // assertion is what keeps one from being added without a route to use it.
    expect(SAVINGS_COMMAND_PERMISSIONS).not.toHaveProperty('reverse');
  });

  it('never maps a command to UPDATE_SAVINGSACCOUNT', () => {
    expect(Object.values(SAVINGS_COMMAND_PERMISSIONS)).not.toContain('UPDATE_SAVINGSACCOUNT');
  });
});

describe('WC_LOAN_COMMAND_PERMISSIONS', () => {
  /**
   * Every action the Working Capital loan screen can reach through the action route, and the code
   * Fineract authorises it with. Spelled out rather than looped, because the pairing is the whole
   * content of the fix: a wrong entry here either locks out a user the platform would allow or
   * leads one into a 403, which is issue #777 reproduced one command at a time.
   */
  const EXPECTED: Readonly<Record<string, string>> = {
    approve: 'APPROVE_WORKINGCAPITALLOAN',
    undoapproval: 'APPROVALUNDO_WORKINGCAPITALLOAN',
    reject: 'REJECT_WORKINGCAPITALLOAN',
    disburse: 'DISBURSE_WORKINGCAPITALLOAN',
    undodisbursal: 'DISBURSALUNDO_WORKINGCAPITALLOAN',
    markasfraud: 'SETFRAUD_WORKINGCAPITALLOAN',
    discount: 'UPDATEDISCOUNT_WORKINGCAPITALLOAN',
    paymentrate: 'UPDATERATE_WORKINGCAPITALLOAN',
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

  it('maps each command to the code Fineract authorises it with', () => {
    expect(WC_LOAN_COMMAND_PERMISSIONS).toEqual(EXPECTED);
  });

  it('never maps a command to UPDATE_WORKINGCAPITALLOAN', () => {
    // The defect: the route declared it for all of these, and it authorises none of them.
    expect(Object.values(WC_LOAN_COMMAND_PERMISSIONS)).not.toContain('UPDATE_WORKINGCAPITALLOAN');
  });

  it('maps every code to Fineract spelling for the module', () => {
    for (const [command, code] of Object.entries(WC_LOAN_COMMAND_PERMISSIONS)) {
      expect(code, `${command} maps to a malformed code`).toMatch(
        /^[A-Z][A-Z0-9]*_WORKINGCAPITALLOAN$/,
      );
    }
  });

  /**
   * The discount fee posts a transaction, so the obvious guess is the code that sets the agreed
   * discount before disbursement. It is not: `UPDATEDISCOUNT_WORKINGCAPITALLOAN` is refused the
   * `discountFee` command, and `DISCOUNTFEE_WORKINGCAPITALLOAN` is refused the PUT. Measured.
   */
  it('separates posting the discount fee from updating the agreed discount', () => {
    expect(WC_LOAN_COMMAND_PERMISSIONS['discountFee']).not.toBe(
      WC_LOAN_COMMAND_PERMISSIONS['discount'],
    );
  });

  it('treats a prepayment as a repayment, as the term-loan map does', () => {
    // Fineract has no prepay command at all: the form posts `repayment` with the payoff amount.
    expect(WC_LOAN_COMMAND_PERMISSIONS['prepay']).toBe(WC_LOAN_COMMAND_PERMISSIONS['repayment']);
  });

  it('separates each undo from the action it reverses', () => {
    // Undo is the checker-ish half of each pair and is routinely granted to a different role, so
    // sharing a code with the forward action would hand it to whoever can perform that.
    expect(WC_LOAN_COMMAND_PERMISSIONS['undoChargeOff']).not.toBe(
      WC_LOAN_COMMAND_PERMISSIONS['chargeOff'],
    );
    expect(WC_LOAN_COMMAND_PERMISSIONS['undoWriteOff']).not.toBe(
      WC_LOAN_COMMAND_PERMISSIONS['writeOff'],
    );
    expect(WC_LOAN_COMMAND_PERMISSIONS['undoapproval']).not.toBe(
      WC_LOAN_COMMAND_PERMISSIONS['approve'],
    );
    expect(WC_LOAN_COMMAND_PERMISSIONS['undodisbursal']).not.toBe(
      WC_LOAN_COMMAND_PERMISSIONS['disburse'],
    );
  });

  it('resolves the code from the :command segment, not :type', () => {
    // The Working Capital route names the segment `:command`; the term-loan route names it
    // `:type`. Crossing them unmaps every command on one of the two.
    expect(wcLoanCommandPermission(params({ command: 'chargeOff' }))).toBe(
      'CHARGEOFF_WORKINGCAPITALLOAN',
    );
    expect(wcLoanCommandPermission(params({ type: 'chargeOff' }))).toBeUndefined();
  });
});

describe('commandPermission', () => {
  it('reads the command out of the parameter it was given', () => {
    const resolve = commandPermission('kind', { pay: 'PAY_THING' });
    expect(resolve(params({ kind: 'pay' }))).toBe('PAY_THING');
  });

  it('answers undefined for a command it does not know', () => {
    // Which the guard treats as "no client-side gate". A guessed code would refuse a user the
    // platform allows — the more damaging half of #691, and the harder half to notice.
    const resolve = commandPermission('kind', { pay: 'PAY_THING' });
    expect(resolve(params({ kind: 'somethingElse' }))).toBeUndefined();
  });

  it('answers undefined when the parameter is missing', () => {
    const resolve = commandPermission('kind', { pay: 'PAY_THING' });
    expect(resolve(params({}))).toBeUndefined();
  });

  it('reads the loan parameter as :type and the savings one as :command', () => {
    // The two routes name the segment differently, and crossing them would silently unmap
    // every command on one of them.
    expect(loanCommandPermission(params({ type: 'disburse' }))).toBe('DISBURSE_LOAN');
    expect(loanCommandPermission(params({ command: 'disburse' }))).toBeUndefined();
    expect(savingsCommandPermission(params({ command: 'deposit' }))).toBe('DEPOSIT_SAVINGSACCOUNT');
    expect(savingsCommandPermission(params({ type: 'deposit' }))).toBeUndefined();
  });
});
