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

import { TellerCashManagementService } from '../../../api';
import {
  FineractTellerApi,
  mapCashier,
  mapCashierSummary,
  mapCashierTransaction,
  mapCashierTransactionTemplate,
  mapTeller,
} from './fineract-teller.api';

/**
 * Payloads copied from `GET /tellers` and `GET /tellers/1/cashiers` on a running
 * `apache/fineract`, as recorded in issue #687. `startDate` is a string here, which is what
 * the platform sends for a teller. The point of this fixture is that it is not an array.
 */
const MAIN_TELLER = {
  id: 1,
  name: 'Main Teller',
  description: 'Head office vault',
  officeId: 1,
  officeName: 'Head Office',
  startDate: '2026-10-02',
  status: 'ACTIVE' as const,
};

const CASHIER = {
  id: 3,
  staffId: 2,
  staffName: 'Officer, Field',
  startDate: '2026-10-02',
  endDate: '2026-12-31',
  isFullDay: true,
};

describe('mapTeller', () => {
  it('reads the string start date the platform actually sends', () => {
    // The regression this file exists for. The teller list ran this value through
    // `formatArrayDate()`, which answers '-', so every teller showed a dash.
    expect(mapTeller(MAIN_TELLER).startDate).toBe('2026-10-02');
  });

  it('also reads the array form, so the encoding stops being the screen problem', () => {
    expect(mapTeller({ ...MAIN_TELLER, startDate: [2026, 10, 2] }).startDate).toBe('2026-10-02');
  });

  it('reports no start date as null rather than as a dash', () => {
    expect(mapTeller({ ...MAIN_TELLER, startDate: undefined }).startDate).toBeNull();
  });

  it('exposes the description, which the generated model does not declare', () => {
    expect(mapTeller(MAIN_TELLER).description).toBe('Head office vault');
  });

  it('maps a whole teller and keeps the status as the platform enum, not display text', () => {
    expect(mapTeller(MAIN_TELLER)).toEqual({
      id: 1,
      name: 'Main Teller',
      description: 'Head office vault',
      officeId: 1,
      officeName: 'Head Office',
      status: 'ACTIVE',
      startDate: '2026-10-02',
    });
  });

  it('refuses a teller with no id rather than assigning one that cannot be used', () => {
    expect(() => mapTeller({ ...MAIN_TELLER, id: undefined })).toThrow(/no id/);
  });
});

describe('mapCashier', () => {
  it('maps both dates and the full-time flag', () => {
    expect(mapCashier(CASHIER)).toEqual({
      id: 3,
      staffId: 2,
      staffName: 'Officer, Field',
      isFullDay: true,
      startDate: '2026-10-02',
      endDate: '2026-12-31',
    });
  });

  it('reads array dates as well, and reports an absent end date as null', () => {
    const cashier = mapCashier({ ...CASHIER, startDate: [2026, 10, 2], endDate: undefined });
    expect(cashier.startDate).toBe('2026-10-02');
    expect(cashier.endDate).toBeNull();
  });

  it('treats a missing full-time flag as false rather than undefined', () => {
    expect(mapCashier({ ...CASHIER, isFullDay: undefined }).isFullDay).toBe(false);
  });
});

describe('mapCashierTransaction', () => {
  it('reads the transaction type from its display value', () => {
    const entry = mapCashierTransaction({
      id: 9,
      txnType: { id: 101, value: 'Allocate Cash' },
      txnAmount: 5000,
      txnDate: '2026-08-05',
      txnNote: 'vault float',
    });
    expect(entry).toEqual({
      type: 'Allocate Cash',
      amount: 5000,
      date: '2026-08-05',
      note: 'vault float',
    });
  });

  it('formats the transaction date in either shape the platform returns', () => {
    // The cashier-transactions endpoint answers an ISO string. Rendering `[2026,8,5]` into a
    // table cell is the failure mode a single-shape assumption produces.
    expect(mapCashierTransaction({ txnDate: '2026-08-05' }).date).toBe('2026-08-05');
    expect(mapCashierTransaction({ txnDate: [2026, 8, 5] }).date).toBe('2026-08-05');
    expect(mapCashierTransaction({}).date).toBeNull();
  });
});

describe('mapCashierSummary', () => {
  it('maps the totals and the page of transactions', () => {
    const summary = mapCashierSummary({
      cashierName: 'Officer, Probe',
      tellerName: 'Main Teller',
      sumCashAllocation: 5000,
      sumCashSettlement: 1200,
      netCash: 3800,
      cashierTransactions: {
        pageItems: [
          { txnType: { value: 'Allocate Cash' }, txnAmount: 5000, txnDate: '2026-08-05' },
        ],
      },
    });
    expect(summary.allocated).toBe(5000);
    expect(summary.settled).toBe(1200);
    expect(summary.netCash).toBe(3800);
    expect(summary.transactions).toHaveLength(1);
  });

  it('answers zero totals and no transactions for an empty summary', () => {
    expect(mapCashierSummary({})).toEqual({
      cashierName: '',
      tellerName: '',
      allocated: 0,
      settled: 0,
      netCash: 0,
      transactions: [],
    });
  });
});

describe('mapCashierTransactionTemplate', () => {
  it('labels a currency with the display label, then the name, then the code', () => {
    const template = mapCashierTransactionTemplate({
      cashierName: 'Officer, Probe',
      tellerName: 'Main Teller',
      currencyOptions: [
        { code: 'USD', name: 'US Dollar', displayLabel: 'US Dollar ($)' },
        { code: 'INR', name: 'Indian Rupee' },
        { code: 'EUR' },
      ],
    });
    expect(template.currencies).toEqual([
      { code: 'USD', label: 'US Dollar ($)' },
      { code: 'INR', label: 'Indian Rupee' },
      { code: 'EUR', label: 'EUR' },
    ]);
  });
});

describe('FineractTellerApi', () => {
  let generated: {
    getTellers: ReturnType<typeof vi.fn>;
    getTellersTellerId: ReturnType<typeof vi.fn>;
    postTellers: ReturnType<typeof vi.fn>;
    putTellersTellerId: ReturnType<typeof vi.fn>;
    getTellersTellerIdCashiers: ReturnType<typeof vi.fn>;
    postTellersTellerIdCashiers: ReturnType<typeof vi.fn>;
    deleteTellersTellerIdCashiersCashierId: ReturnType<typeof vi.fn>;
    getTellersTellerIdCashiersCashierIdTransactionsTemplate: ReturnType<typeof vi.fn>;
    getTellersTellerIdCashiersCashierIdSummaryandtransactions: ReturnType<typeof vi.fn>;
    postTellersTellerIdCashiersCashierIdAllocate: ReturnType<typeof vi.fn>;
    postTellersTellerIdCashiersCashierIdSettle: ReturnType<typeof vi.fn>;
  };
  let api: FineractTellerApi;

  beforeEach(() => {
    generated = {
      getTellers: vi.fn().mockReturnValue(of([MAIN_TELLER])),
      getTellersTellerId: vi.fn().mockReturnValue(of(MAIN_TELLER)),
      postTellers: vi.fn().mockReturnValue(of({})),
      putTellersTellerId: vi.fn().mockReturnValue(of({})),
      getTellersTellerIdCashiers: vi
        .fn()
        .mockReturnValue(
          of({ tellerId: 1, tellerName: 'Main Teller', officeId: 1, cashiers: [CASHIER] }),
        ),
      postTellersTellerIdCashiers: vi.fn().mockReturnValue(of({})),
      deleteTellersTellerIdCashiersCashierId: vi.fn().mockReturnValue(of({})),
      getTellersTellerIdCashiersCashierIdTransactionsTemplate: vi.fn().mockReturnValue(of({})),
      getTellersTellerIdCashiersCashierIdSummaryandtransactions: vi.fn().mockReturnValue(of({})),
      postTellersTellerIdCashiersCashierIdAllocate: vi.fn().mockReturnValue(of({})),
      postTellersTellerIdCashiersCashierIdSettle: vi.fn().mockReturnValue(of({})),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: TellerCashManagementService, useValue: generated }],
    });
    api = TestBed.inject(FineractTellerApi);
  });

  it('passes the office filter through and survives an empty body', async () => {
    api.list(3).subscribe();
    expect(generated.getTellers).toHaveBeenCalledWith(3);

    generated.getTellers.mockReturnValue(of(null));
    const tellers = await new Promise((resolve) => api.list().subscribe(resolve));
    expect(tellers).toEqual([]);
  });

  it('flattens the cashiers envelope to the cashiers alone', async () => {
    // The response describes the teller and nests its cashiers. The caller already knows the
    // teller, so the contract answers only the cashiers.
    const cashiers = await new Promise((resolve) => api.listCashiers(1).subscribe(resolve));
    expect(cashiers).toEqual([mapCashier(CASHIER)]);
  });

  it('answers no cashiers for an empty body rather than failing', async () => {
    generated.getTellersTellerIdCashiers.mockReturnValue(of(null));
    const cashiers = await new Promise((resolve) => api.listCashiers(1).subscribe(resolve));
    expect(cashiers).toEqual([]);
  });

  it('sends an active teller with the numeric code and the ISO date it was given', () => {
    api.create({ name: 'New', officeId: 1, status: 'ACTIVE', startDate: '2026-05-09' }).subscribe();

    expect(generated.postTellers).toHaveBeenCalledWith({
      name: 'New',
      officeId: 1,
      status: 300,
      startDate: '2026-05-09',
      dateFormat: 'yyyy-MM-dd',
      locale: 'en',
    });
  });

  it('sends anything but an active teller as the inactive code, as the form always did', () => {
    api.update(1, { name: 'Old', status: 'INACTIVE', startDate: '2026-05-09' }).subscribe();

    expect(generated.putTellersTellerId).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: 400 }),
    );
  });

  it('sends the start date it was given on update, unchanged', () => {
    // The regression this block exists for. The edit form read the start date as an array,
    // which for '2026-10-02' builds 1901-12-02, and then saved that. The contract hands back the
    // teller's own date and the form sends it back as it was given.
    api.update(1, { name: 'Main Teller', status: 'ACTIVE', startDate: '2026-10-02' }).subscribe();

    expect(generated.putTellersTellerId).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ startDate: '2026-10-02', dateFormat: 'yyyy-MM-dd' }),
    );
  });

  it('omits the description when the caller gave none', () => {
    api.create({ name: 'New', officeId: 1, status: 'ACTIVE', startDate: '2026-05-09' }).subscribe();

    const body = generated.postTellers.mock.calls[0][0] as Record<string, unknown>;
    expect('description' in body).toBe(false);
  });

  it('sends a cashier allocation as an ISO date with its own format', () => {
    api
      .createCashier(1, {
        staffId: 2,
        isFullDay: true,
        startDate: '2026-10-02',
        endDate: '2026-12-31',
      })
      .subscribe();

    expect(generated.postTellersTellerIdCashiers).toHaveBeenCalledWith(1, {
      staffId: 2,
      isFullDay: true,
      startDate: '2026-10-02',
      endDate: '2026-12-31',
      dateFormat: 'yyyy-MM-dd',
      locale: 'en',
    });
  });

  it('removes a cashier allocation by both ids', () => {
    api.removeCashier(1, 3).subscribe();
    expect(generated.deleteTellersTellerIdCashiersCashierId).toHaveBeenCalledWith(1, 3);
  });

  it('asks for the summary in the currency it was given', () => {
    api.cashierSummary(7, 3, 'USD').subscribe();
    expect(
      generated.getTellersTellerIdCashiersCashierIdSummaryandtransactions,
    ).toHaveBeenCalledWith(7, 3, 'USD');
  });

  it('pads a single-digit day when allocating, because Fineract parses strictly', () => {
    // The padding is the point: an unpadded '5 August 2026' fails to parse against `dd` and
    // comes back 500 rather than as a validation error.
    api
      .allocateCash(7, 3, { currencyCode: 'USD', amount: 5000, date: '2026-08-05', note: 'float' })
      .subscribe();

    expect(generated.postTellersTellerIdCashiersCashierIdAllocate).toHaveBeenCalledWith(7, 3, {
      currencyCode: 'USD',
      txnAmount: 5000,
      txnDate: '05 August 2026',
      txnNote: 'float',
      dateFormat: 'dd MMMM yyyy',
      locale: 'en',
    });
  });

  it('routes a settlement to the settle command and never to allocate', () => {
    api
      .settleCash(7, 3, { currencyCode: 'USD', amount: 1200, date: '2026-08-05', note: '' })
      .subscribe();

    expect(generated.postTellersTellerIdCashiersCashierIdSettle).toHaveBeenCalled();
    expect(generated.postTellersTellerIdCashiersCashierIdAllocate).not.toHaveBeenCalled();
  });
});
