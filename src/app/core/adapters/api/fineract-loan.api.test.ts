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

import { LoansService } from '../../../api';
import { FineractLoanApi, mapLoan, mapLoanStatus } from './fineract-loan.api';

/**
 * Statuses copied from a running `apache/fineract:latest`, not written from the generated type.
 *
 * `GetLoansLoanIdStatus` declares neither `value` — which every status carries — nor matches on
 * `description`, which it declares and the payload never sends. Building these fixtures from the
 * generated type would reproduce exactly the blind spot this adapter exists to close: the
 * application read `value` through a `Record<string, unknown>` cast in two places and compared
 * it against English text in two more.
 */
const APPROVED = {
  id: 200,
  code: 'loanStatusType.approved',
  value: 'Approved',
  pendingApproval: false,
  waitingForDisbursal: true,
  active: false,
  closedObligationsMet: false,
  closedWrittenOff: false,
  closedRescheduled: false,
  closed: false,
  overpaid: false,
};

const PENDING = {
  id: 100,
  code: 'loanStatusType.submitted.and.pending.approval',
  value: 'Submitted and pending approval',
  pendingApproval: true,
  waitingForDisbursal: false,
  active: false,
  closedObligationsMet: false,
  closedWrittenOff: false,
  closedRescheduled: false,
  closed: false,
  overpaid: false,
};

/** One `pageItems` entry, trimmed to the fields the list reads. */
const LOAN = {
  id: 53,
  accountNo: '000000053',
  clientId: 1,
  clientName: 'E2E Client',
  loanProductName: 'E2E Product',
  status: APPROVED,
};

describe('mapLoanStatus', () => {
  it('exposes the display value Fineract sends but the generated type does not declare', () => {
    expect(mapLoanStatus(APPROVED).value).toBe('Approved');
  });

  it('keeps the stable code, which is what callers should branch on', () => {
    expect(mapLoanStatus(APPROVED).code).toBe('loanStatusType.approved');
  });

  it('carries the platform flags that replace comparing against English text', () => {
    // The loans list used `status.value === 'Approved'` to decide whether to offer Disburse.
    // `waitingForDisbursal` is the same question asked in a way another locale cannot break.
    expect(mapLoanStatus(APPROVED).waitingForDisbursal).toBe(true);
    expect(mapLoanStatus(APPROVED).pendingApproval).toBe(false);
    expect(mapLoanStatus(PENDING).pendingApproval).toBe(true);
    expect(mapLoanStatus(PENDING).waitingForDisbursal).toBe(false);
  });

  it('defaults every flag to false rather than undefined', () => {
    // A status that arrives without `active` is not an active loan. Leaving the field optional
    // would push an `=== true` onto every caller, which is the per-screen re-interpretation
    // this boundary exists to remove.
    const status = mapLoanStatus({ id: 1, code: 'x', value: 'X' });
    expect(status.active).toBe(false);
    expect(status.overpaid).toBe(false);
    expect(status.closed).toBe(false);
  });

  it('answers a missing status without throwing', () => {
    // Every flag false and no id: a loan whose status did not arrive is offered no action,
    // which is the safe answer. Throwing here would take the whole list down with it.
    expect(mapLoanStatus(undefined)).toEqual({
      id: null,
      code: '',
      value: '',
      pendingApproval: false,
      waitingForDisbursal: false,
      active: false,
      closedObligationsMet: false,
      closedWrittenOff: false,
      closedRescheduled: false,
      closed: false,
      overpaid: false,
    });
  });
});

describe('mapLoan', () => {
  it('maps a whole loan', () => {
    expect(mapLoan(LOAN)).toEqual({
      id: 53,
      accountNo: '000000053',
      clientId: 1,
      clientName: 'E2E Client',
      loanProductName: 'E2E Product',
      status: mapLoanStatus(APPROVED),
    });
  });

  it('refuses a loan with no id rather than routing somewhere wrong', () => {
    expect(() => mapLoan({ ...LOAN, id: undefined })).toThrow(/no id/);
  });

  it('renders absent text fields as empty rather than undefined', () => {
    const loan = mapLoan({ ...LOAN, clientName: undefined, loanProductName: undefined });
    expect(loan.clientName).toBe('');
    expect(loan.loanProductName).toBe('');
    expect(loan.clientId).toBe(1);
  });
});

describe('FineractLoanApi', () => {
  let generated: { getLoans: ReturnType<typeof vi.fn> };
  let api: FineractLoanApi;

  beforeEach(() => {
    generated = {
      getLoans: vi.fn().mockReturnValue(of({ totalFilteredRecords: 1, pageItems: [LOAN] })),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: LoansService, useValue: generated }],
    });
    api = TestBed.inject(FineractLoanApi);
  });

  function list(query?: Parameters<FineractLoanApi['list']>[0]): Promise<unknown> {
    return new Promise((resolve) => api.list(query).subscribe(resolve));
  }

  it('maps the page items and keeps the total the paginator needs', async () => {
    expect(await list()).toEqual({
      items: [
        expect.objectContaining({ id: 53, status: expect.objectContaining({ value: 'Approved' }) }),
      ],
      totalFilteredRecords: 1,
    });
  });

  it('places each filter in the positional slot the generated signature expects', () => {
    // externalId, offset, limit, orderBy, sortOrder, accountNo, associations, clientId, status.
    // Getting this wrong is silent: every parameter is an optional string or number, so a
    // misplaced argument is still a valid call that filters by the wrong thing.
    api
      .list({
        offset: 20,
        limit: 10,
        orderBy: 'accountNo',
        sortOrder: 'DESC',
        accountNo: '000000053',
        status: '300',
      })
      .subscribe();

    expect(generated.getLoans).toHaveBeenCalledWith(
      undefined,
      20,
      10,
      'accountNo',
      'DESC',
      '000000053',
      undefined,
      undefined,
      '300',
    );
  });

  it('sends nothing for an omitted filter, because Fineract rejects an empty status', () => {
    // `status=` and `status=All` both answer 400 ("The Status value '...' is not supported"),
    // so "any status" has to leave the parameter off entirely.
    api.list().subscribe();
    expect(generated.getLoans).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('answers an empty page when there are no loans', async () => {
    generated.getLoans.mockReturnValue(of({ totalFilteredRecords: 0 }));
    expect(await list()).toEqual({ items: [], totalFilteredRecords: 0 });
  });
});
