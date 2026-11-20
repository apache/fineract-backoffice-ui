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
  DELINQUENCY_AGING_BANDS,
  agingBandOf,
  summarisePortfolio,
  type WorkingCapitalLoanSnapshot,
} from './working-capital-loan.api';

function loan(overrides: Partial<WorkingCapitalLoanSnapshot> = {}): WorkingCapitalLoanSnapshot {
  return {
    id: 1,
    accountNo: '000000001',
    clientId: 7,
    clientName: 'Synthetic Client',
    status: 'Active',
    currencyCode: 'USD',
    principal: 1000,
    outstanding: 800,
    delinquentAmount: 0,
    delinquentDays: 0,
    breachPastDueAmount: 0,
    chargedOff: false,
    fraud: false,
    ...overrides,
  };
}

describe('agingBandOf', () => {
  // The boundaries are the whole point of a banded report: an off-by-one puts a 30-day arrear
  // in the 31-60 column, and nothing downstream can tell.
  it.each([
    [0, 'current'],
    [1, 'd1to30'],
    [30, 'd1to30'],
    [31, 'd31to60'],
    [60, 'd31to60'],
    [61, 'd61to90'],
    [90, 'd61to90'],
    [91, 'd90plus'],
    [365, 'd90plus'],
  ])('puts %i days in %s', (days, band) => {
    expect(agingBandOf(days)).toBe(band);
  });

  it('counts a negative day count somewhere rather than dropping it', () => {
    // Not a shape Fineract sends, but a dropped loan would leave the band totals disagreeing
    // with the portfolio total, which is the one thing a reader checks.
    expect(agingBandOf(-5)).toBe('current');
  });

  it('covers every band declared', () => {
    const reached = new Set([0, 15, 45, 75, 400].map((days) => agingBandOf(days)));
    expect(reached.size).toBe(DELINQUENCY_AGING_BANDS.length);
  });
});

describe('summarisePortfolio', () => {
  it('reports an empty book without inventing figures', () => {
    const summary = summarisePortfolio([]);

    expect(summary.loans).toBe(0);
    expect(summary.outstanding).toBe(0);
    expect(summary.currencyCode).toBeNull();
    expect(summary.byStatus).toEqual([]);
    // The bands are still listed, so an empty portfolio reads as empty rather than broken.
    expect(summary.aging).toHaveLength(DELINQUENCY_AGING_BANDS.length);
  });

  it('totals principal, outstanding and delinquency across the book', () => {
    const summary = summarisePortfolio([
      loan({ principal: 1000, outstanding: 800, delinquentAmount: 100, delinquentDays: 10 }),
      loan({ id: 2, principal: 500, outstanding: 250, delinquentAmount: 0 }),
      loan({ id: 3, principal: 250, outstanding: 0, delinquentAmount: 25, delinquentDays: 120 }),
    ]);

    expect(summary.loans).toBe(3);
    expect(summary.principal).toBe(1750);
    expect(summary.outstanding).toBe(1050);
    expect(summary.delinquentAmount).toBe(125);
    // Counted by having an amount, not by having a day count: a loan one day late with nothing
    // yet overdue is not money at risk.
    expect(summary.delinquentLoans).toBe(2);
  });

  it('splits the book into aging bands whose totals add back up', () => {
    const loans = [
      loan({ outstanding: 100, delinquentDays: 0 }),
      loan({ id: 2, outstanding: 200, delinquentDays: 20, delinquentAmount: 20 }),
      loan({ id: 3, outstanding: 300, delinquentDays: 45, delinquentAmount: 30 }),
      loan({ id: 4, outstanding: 400, delinquentDays: 200, delinquentAmount: 40 }),
    ];
    const summary = summarisePortfolio(loans);
    const band = (key: string) => summary.aging.find((row) => row.key === key)!;

    expect(band('current').loans).toBe(1);
    expect(band('d1to30').outstanding).toBe(200);
    expect(band('d31to60').outstanding).toBe(300);
    expect(band('d61to90').loans).toBe(0);
    expect(band('d90plus').outstanding).toBe(400);

    // The report is only readable if the parts sum to the whole.
    expect(summary.aging.reduce((total, row) => total + row.loans, 0)).toBe(summary.loans);
    expect(summary.aging.reduce((total, row) => total + row.outstanding, 0)).toBe(
      summary.outstanding,
    );
  });

  it('groups by status, most loans first', () => {
    const summary = summarisePortfolio([
      loan({ status: 'Active', outstanding: 100 }),
      loan({ id: 2, status: 'Active', outstanding: 200 }),
      loan({ id: 3, status: 'Closed', outstanding: 0 }),
      loan({ id: 4, status: null, outstanding: 50 }),
    ]);

    expect(summary.byStatus[0]).toEqual({ status: 'Active', loans: 2, outstanding: 300 });
    // A status the platform did not send becomes the empty key, for the view to label.
    expect(summary.byStatus.map((row) => row.status)).toContain('');
  });

  it('reports a currency only when the whole book shares one', () => {
    expect(summarisePortfolio([loan(), loan({ id: 2 })]).currencyCode).toBe('USD');
    // Adding dollars to euros produces a number that means nothing; the view drops the label
    // rather than stamping the first code it saw onto a mixed total.
    expect(
      summarisePortfolio([loan(), loan({ id: 2, currencyCode: 'EUR' })]).currencyCode,
    ).toBeNull();
    expect(summarisePortfolio([loan({ currencyCode: null })]).currencyCode).toBeNull();
  });

  it('counts the flags the platform states outright', () => {
    const summary = summarisePortfolio([
      loan({ chargedOff: true }),
      loan({ id: 2, fraud: true }),
      loan({ id: 3, breachPastDueAmount: 75 }),
      loan({ id: 4 }),
    ]);

    expect(summary.chargedOffLoans).toBe(1);
    expect(summary.fraudLoans).toBe(1);
    expect(summary.breachPastDueAmount).toBe(75);
    expect(summary.breachPastDueLoans).toBe(1);
  });
});
