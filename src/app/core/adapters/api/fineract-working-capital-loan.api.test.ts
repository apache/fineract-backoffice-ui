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
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { WorkingCapitalLoansService } from '../../../api';
import type { GetWorkingCapitalLoansLoanIdResponse } from '../../../api';
import {
  FineractWorkingCapitalLoanApi,
  mapWorkingCapitalLoanSnapshot,
} from './fineract-working-capital-loan.api';

/**
 * A working-capital loan as the module's existing screens see one.
 *
 * Built from the fixture `wc-loan-view.component.test.ts` already uses rather than from the
 * generated type, so the field names here are ones a real payload has been observed to carry
 * (`client.displayName`, `status.value`, `balance`, `summary`). It is not a fresh live capture,
 * which is this repo's stated preference — the mapping below is where an upstream rename would
 * surface, and a capture against a seeded working-capital book would make that sharper.
 */
const LOAN: GetWorkingCapitalLoansLoanIdResponse = {
  id: 11,
  accountNo: '000011',
  client: { id: 7, displayName: 'Synthetic Client' },
  status: { id: 300, value: 'Active', active: true },
  currency: { code: 'USD' },
  approvedPrincipal: 5000,
  proposedPrincipal: 4000,
  summary: { totalOutstanding: 3200 },
  delinquent: { delinquentAmount: 150, delinquentDays: 12 },
  balance: { breachPastDueAmount: 75 },
  chargedOff: false,
  fraud: false,
};

describe('mapWorkingCapitalLoanSnapshot', () => {
  it('reads the figures a portfolio view adds up', () => {
    expect(mapWorkingCapitalLoanSnapshot(LOAN)).toEqual({
      id: 11,
      accountNo: '000011',
      clientId: 7,
      clientName: 'Synthetic Client',
      status: 'Active',
      currencyCode: 'USD',
      // Approved takes precedence over proposed, as the loans list already shows it.
      principal: 5000,
      outstanding: 3200,
      delinquentAmount: 150,
      delinquentDays: 12,
      breachPastDueAmount: 75,
      chargedOff: false,
      fraud: false,
    });
  });

  it('resolves every absent number to zero rather than letting a total read NaN', () => {
    // The generated type marks all of these optional. A portfolio screen sums them, and one
    // `undefined` turns a column of money into "NaN" — which is why the mapper, not the
    // template, decides what absence means.
    const snapshot = mapWorkingCapitalLoanSnapshot({ id: 11 });

    expect(snapshot.principal).toBe(0);
    expect(snapshot.outstanding).toBe(0);
    expect(snapshot.delinquentAmount).toBe(0);
    expect(snapshot.delinquentDays).toBe(0);
    expect(snapshot.breachPastDueAmount).toBe(0);
    expect(snapshot.accountNo).toBe('');
    expect(snapshot.status).toBeNull();
    expect(snapshot.currencyCode).toBeNull();
    expect(Number.isNaN(snapshot.principal + snapshot.outstanding)).toBe(false);
  });

  it('falls back to the flattened client fields when the nested object is absent', () => {
    const snapshot = mapWorkingCapitalLoanSnapshot({
      id: 11,
      clientId: 9,
      clientName: 'Flattened Client',
    });

    expect(snapshot.clientId).toBe(9);
    expect(snapshot.clientName).toBe('Flattened Client');
  });

  it('falls back to the proposed principal before approval', () => {
    expect(mapWorkingCapitalLoanSnapshot({ id: 11, proposedPrincipal: 4000 }).principal).toBe(4000);
  });

  it('reports a loan with no id rather than routing to one that does not exist', () => {
    // Every row links to /working-capital/loans/view/<id>; a defaulted zero would open nothing
    // and look like a missing loan rather than a payload problem.
    expect(() => mapWorkingCapitalLoanSnapshot({ accountNo: '000011' })).toThrow(/no id/);
  });
});

describe('FineractWorkingCapitalLoanApi', () => {
  it('reads the page body Fineract answers with', async () => {
    const loans = { getWorkingCapitalLoans: vi.fn().mockReturnValue(of({ content: [LOAN] })) };
    TestBed.configureTestingModule({
      providers: [
        FineractWorkingCapitalLoanApi,
        { provide: WorkingCapitalLoansService, useValue: loans },
      ],
    });

    const snapshots = await new Promise((resolve) =>
      TestBed.inject(FineractWorkingCapitalLoanApi).listLoans().subscribe(resolve),
    );

    // `content`, not `pageItems`: this endpoint answers a Spring page.
    expect(snapshots).toHaveLength(1);
    expect(loans.getWorkingCapitalLoans).toHaveBeenCalled();
  });

  it('answers null for a reference that matches nothing', async () => {
    const loans = {
      getWorkingCapitalLoans: vi.fn(),
      getWorkingCapitalLoansExternalIdLoanExternalId: vi
        .fn()
        .mockReturnValue(throwError(() => ({ status: 404 }))),
    };
    TestBed.configureTestingModule({
      providers: [
        FineractWorkingCapitalLoanApi,
        { provide: WorkingCapitalLoansService, useValue: loans },
      ],
    });

    // A typed reference that does not match is the lookup working, not a failure.
    const found = await new Promise((resolve) =>
      TestBed.inject(FineractWorkingCapitalLoanApi).findByExternalId('REF-1').subscribe(resolve),
    );

    expect(found).toBeNull();
  });

  it('lets a real failure through rather than reporting it as not found', async () => {
    const loans = {
      getWorkingCapitalLoans: vi.fn(),
      getWorkingCapitalLoansExternalIdLoanExternalId: vi
        .fn()
        .mockReturnValue(throwError(() => ({ status: 500 }))),
    };
    TestBed.configureTestingModule({
      providers: [
        FineractWorkingCapitalLoanApi,
        { provide: WorkingCapitalLoansService, useValue: loans },
      ],
    });

    // "No such loan" and "the server broke" are different answers and the screen shows
    // different things for them.
    const error = await new Promise((resolve) =>
      TestBed.inject(FineractWorkingCapitalLoanApi)
        .findByExternalId('REF-1')
        .subscribe({ error: resolve }),
    );

    expect(error).toEqual({ status: 500 });
  });

  it('maps the loan a reference does match', async () => {
    const loans = {
      getWorkingCapitalLoans: vi.fn(),
      getWorkingCapitalLoansExternalIdLoanExternalId: vi.fn().mockReturnValue(of(LOAN)),
    };
    TestBed.configureTestingModule({
      providers: [
        FineractWorkingCapitalLoanApi,
        { provide: WorkingCapitalLoansService, useValue: loans },
      ],
    });

    const found = await new Promise((resolve) =>
      TestBed.inject(FineractWorkingCapitalLoanApi).findByExternalId('REF-1').subscribe(resolve),
    );

    expect(found).toMatchObject({ id: 11, accountNo: '000011' });
    expect(loans.getWorkingCapitalLoansExternalIdLoanExternalId).toHaveBeenCalledWith('REF-1');
  });

  it('treats a page with no body as an empty book', async () => {
    const loans = { getWorkingCapitalLoans: vi.fn().mockReturnValue(of({})) };
    TestBed.configureTestingModule({
      providers: [
        FineractWorkingCapitalLoanApi,
        { provide: WorkingCapitalLoansService, useValue: loans },
      ],
    });

    const snapshots = await new Promise((resolve) =>
      TestBed.inject(FineractWorkingCapitalLoanApi).listLoans().subscribe(resolve),
    );

    expect(snapshots).toEqual([]);
  });
});
