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

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { LoanTransactionsService } from '../../../api';
import {
  FineractLoanTransactionApi,
  mapLoanTransaction,
  mapLoanTransactionType,
  mapPaymentTypeOption,
} from './fineract-loan-transaction.api';
import type { LoanTransactionTemplate } from './loan-transaction.api';

/**
 * Payloads copied from `GET /loans/5/transactions/1` on a running `apache/fineract:latest`.
 *
 * `date` is an array where `GetLoansLoanIdTransactionsTransactionIdResponse` says `string`, and
 * `type.value` is sent while `GetLoansType` declares `description` instead. Writing these
 * fixtures from the generated types would reproduce the blind spot the adapter exists to close.
 */
const DISBURSEMENT_TYPE = {
  id: 1,
  code: 'loanTransactionType.disbursement',
  value: 'Disbursement',
};

const TRANSACTION = {
  id: 1,
  type: DISBURSEMENT_TYPE,
  date: [2026, 10, 2],
  amount: 1000,
  netDisbursalAmount: 1000,
  principalPortion: 0,
  interestPortion: 0,
  feeChargesPortion: 0,
  penaltyChargesPortion: 0,
  overpaymentPortion: 0,
  outstandingLoanBalance: 1000,
  manuallyReversed: false,
};

/** `paymentTypeOptions` off `GET /loans/5/transactions/template?command=repayment`. */
const MONEY_TRANSFER = {
  id: 1,
  name: 'Money Transfer',
  description: 'Money Transfer',
  isCashPayment: false,
  position: 1,
  isSystemDefined: false,
};

const CHARGEBACK_TYPE = {
  id: 2,
  name: 'Repayment Adjustment Chargeback',
  description: 'Repayment Adjustment Chargeback',
  isCashPayment: false,
  position: 1,
  codeName: 'REPAYMENT_ADJUSTMENT_CHARGEBACK',
  isSystemDefined: true,
};

describe('mapLoanTransactionType', () => {
  it('exposes the display value Fineract sends but GetLoansType does not declare', () => {
    expect(mapLoanTransactionType(DISBURSEMENT_TYPE).displayName).toBe('Disbursement');
  });

  it('falls back to the code rather than to a blank label', () => {
    // A blank type in a transaction table is indistinguishable from a field with no value,
    // whereas a visible `loanTransactionType.repayment` diagnoses itself.
    const type = mapLoanTransactionType({ id: 2, code: 'loanTransactionType.repayment' });
    expect(type.displayName).toBe('loanTransactionType.repayment');
  });

  it('answers a missing type without throwing', () => {
    expect(mapLoanTransactionType(undefined)).toEqual({ id: null, code: '', displayName: '' });
  });
});

describe('mapLoanTransaction', () => {
  it('converts the array date Fineract sends into an ISO date', () => {
    expect(mapLoanTransaction(TRANSACTION).date).toBe('2026-10-02');
  });

  it('treats the month as 1-based, as Fineract sends it', () => {
    // [2026, 10, 2] is October. Reading it as a Date month would make it November.
    expect(mapLoanTransaction({ ...TRANSACTION, date: [2026, 1, 5] }).date).toBe('2026-01-05');
  });

  it('reports no date as null rather than as a placeholder string', () => {
    expect(mapLoanTransaction({ ...TRANSACTION, date: undefined }).date).toBeNull();
  });

  it('flattens the receipt number, the only field the dialog reads off paymentDetailData', () => {
    const tx = mapLoanTransaction({
      ...TRANSACTION,
      paymentDetailData: { receiptNumber: 'RCPT-9' },
    });
    expect(tx.receiptNumber).toBe('RCPT-9');
  });

  it('reports no receipt number as null', () => {
    expect(mapLoanTransaction(TRANSACTION).receiptNumber).toBeNull();
  });

  it('maps a whole transaction', () => {
    expect(mapLoanTransaction(TRANSACTION)).toEqual({
      id: 1,
      type: { id: 1, code: 'loanTransactionType.disbursement', displayName: 'Disbursement' },
      date: '2026-10-02',
      amount: 1000,
      principalPortion: 0,
      interestPortion: 0,
      feeChargesPortion: 0,
      penaltyChargesPortion: 0,
      manuallyReversed: false,
      receiptNumber: null,
    });
  });

  it('refuses a transaction with no id rather than posting to /transactions/undefined', () => {
    expect(() => mapLoanTransaction({ ...TRANSACTION, id: undefined })).toThrow(/no id/);
  });
});

describe('mapPaymentTypeOption', () => {
  it('exposes codeName, which the generated model does not declare', () => {
    // The chargeback dialog selects its default payment type by this field, and had to cast to
    // reach it.
    expect(mapPaymentTypeOption(CHARGEBACK_TYPE)?.codeName).toBe('REPAYMENT_ADJUSTMENT_CHARGEBACK');
  });

  it('reports a null codeName for the types Fineract does not define itself', () => {
    // Only system-defined payment types carry codeName; a deployment's own do not.
    expect(mapPaymentTypeOption(MONEY_TRANSFER)?.codeName).toBeNull();
    expect(mapPaymentTypeOption(MONEY_TRANSFER)?.isSystemDefined).toBe(false);
  });

  it('rejects an option with no id, because the id is what the command sends', () => {
    expect(mapPaymentTypeOption({ ...CHARGEBACK_TYPE, id: undefined })).toBeNull();
  });
});

describe('FineractLoanTransactionApi', () => {
  let generated: {
    getLoansLoanIdTransactionsTransactionId: ReturnType<typeof vi.fn>;
    getLoansLoanIdTransactionsTemplate: ReturnType<typeof vi.fn>;
    postLoansLoanIdTransactionsTransactionId: ReturnType<typeof vi.fn>;
  };
  let api: FineractLoanTransactionApi;

  beforeEach(() => {
    generated = {
      getLoansLoanIdTransactionsTransactionId: vi.fn().mockReturnValue(of(TRANSACTION)),
      getLoansLoanIdTransactionsTemplate: vi
        .fn()
        .mockReturnValue(of({ paymentTypeOptions: [MONEY_TRANSFER, CHARGEBACK_TYPE] })),
      postLoansLoanIdTransactionsTransactionId: vi.fn().mockReturnValue(of({})),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: LoanTransactionsService, useValue: generated }],
    });
    api = TestBed.inject(FineractLoanTransactionApi);
  });

  it('reads one transaction by loan and transaction id', async () => {
    const tx = await new Promise((resolve) => api.get(5, 1).subscribe(resolve));
    expect(generated.getLoansLoanIdTransactionsTransactionId).toHaveBeenCalledWith(5, 1);
    expect(tx).toEqual(expect.objectContaining({ id: 1, date: '2026-10-02' }));
  });

  function readTemplate(): Promise<LoanTransactionTemplate> {
    return new Promise((resolve) => api.template(5, 'repayment').subscribe(resolve));
  }

  it('maps the template payment types and keeps their order', async () => {
    const template = await readTemplate();
    expect(generated.getLoansLoanIdTransactionsTemplate).toHaveBeenCalledWith(5, 'repayment');
    expect(template.paymentTypeOptions).toEqual([
      { id: 1, name: 'Money Transfer', codeName: null, isSystemDefined: false },
      {
        id: 2,
        name: 'Repayment Adjustment Chargeback',
        codeName: 'REPAYMENT_ADJUSTMENT_CHARGEBACK',
        isSystemDefined: true,
      },
    ]);
  });

  it('drops an option the command could not send', async () => {
    generated.getLoansLoanIdTransactionsTemplate.mockReturnValue(
      of({ paymentTypeOptions: [{ name: 'No id here' }, CHARGEBACK_TYPE] }),
    );
    const template = await readTemplate();
    expect(template.paymentTypeOptions).toHaveLength(1);
  });

  it('offers an empty list when the deployment has no payment types', async () => {
    generated.getLoansLoanIdTransactionsTemplate.mockReturnValue(of({}));
    const template = await readTemplate();
    expect(template.paymentTypeOptions).toEqual([]);
  });

  it('adds the date format and locale the platform parses the date against', () => {
    // Fineract parses `transactionDate` strictly against the `dateFormat` it is told to use, so
    // omitting either answers 500 rather than a validation error. Sending them once here is the
    // point of the method: no caller has to remember.
    api.adjust(5, 1, { date: '2026-10-02', amount: 250.5, note: 'typo' }).subscribe();

    expect(generated.postLoansLoanIdTransactionsTransactionId).toHaveBeenCalledWith(5, 1, {
      transactionDate: '2026-10-02',
      transactionAmount: 250.5,
      note: 'typo',
      dateFormat: 'yyyy-MM-dd',
      locale: 'en',
    });
  });
});
