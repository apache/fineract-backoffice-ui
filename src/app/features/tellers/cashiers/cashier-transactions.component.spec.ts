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

import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { CashierTransactionsComponent } from './cashier-transactions.component';
import { TellerCashManagementService } from '../../../api';
import { asyncOf, renderComponent } from '../../../testing/render';
import { provideFakeAdapters } from '../../../testing/adapters';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideIonicTesting } from '../../../testing/ionic-testing';

describe('CashierTransactionsComponent', () => {
  let tellerServiceSpy: jasmine.SpyObj<TellerCashManagementService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const AUG_5 = '2026-08-05';
  const TELLER_ID = 7;
  const CASHIER_ID = 3;

  async function render() {
    return renderComponent(CashierTransactionsComponent, {
      providers: [
        ...provideFakeAdapters().providers,
        // app-data-table still uses `| translate`, so the library must be configured here.
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        provideIonicTesting(),
        { provide: TellerCashManagementService, useValue: tellerServiceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ tellerId: String(TELLER_ID), cashierId: String(CASHIER_ID) }) },
        },
      ],
    });
  }

  beforeEach(() => {
    tellerServiceSpy = jasmine.createSpyObj('TellerCashManagementService', [
      'getTellersTellerIdCashiersCashierIdTransactionsTemplate',
      'getTellersTellerIdCashiersCashierIdSummaryandtransactions',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    tellerServiceSpy.getTellersTellerIdCashiersCashierIdTransactionsTemplate.and.returnValue(
      asyncOf({
        currencyOptions: [{ code: 'USD', name: 'US Dollar', displayLabel: 'US Dollar ($)' }],
      }) as unknown as Observable<never>,
    );

    tellerServiceSpy.getTellersTellerIdCashiersCashierIdSummaryandtransactions.and.returnValue(
      asyncOf({
        cashierName: 'Officer, Probe',
        tellerName: 'Main Teller',
        sumCashAllocation: 5000,
        sumCashSettlement: 1200,
        netCash: 3800,
        cashierTransactions: {
          pageItems: [
            {
              id: 3,
              txnType: { id: 101, value: 'Allocate Cash' },
              txnAmount: 5000,
              txnDate: [2026, 8, 5],
              txnNote: 'vault float',
            },
          ],
          totalFilteredRecords: 1,
        },
      }) as unknown as Observable<never>,
    );
  });

  it('renders the totals returned alongside the transactions', async () => {
    const fixture = await render();
    const text = (id: string) =>
      (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${CSS.escape(id)}"]`)
        ?.textContent;

    // Rendered, not just assigned: the summary arrives from an async response, which is exactly
    // the case a forced detectChanges() would paper over.
    expect(text('cashier-sum-allocated')).toContain('5000');
    expect(text('cashier-sum-settled')).toContain('1200');
    expect(text('cashier-net-cash')).toContain('3800');
  });

  it('requests the summary for a currency', async () => {
    await render();

    // Not cosmetic: called without a currencyCode the endpoint answers 200 with every total at
    // zero and no transactions, so a cashier holding cash renders identically to one that never
    // transacted. The bug is silent by construction, which is why it is asserted here.
    const args =
      tellerServiceSpy.getTellersTellerIdCashiersCashierIdSummaryandtransactions.calls.mostRecent()
        .args;
    expect(args[0]).toBe(TELLER_ID);
    expect(args[1]).toBe(CASHIER_ID);
    expect(args[2]).toBe('USD');
  });

  it('formats the transaction date in either shape the platform returns', async () => {
    const fixture = await render();

    // This endpoint returns an ISO string; the cashier and teller resources return [y, m, d].
    expect(fixture.componentInstance.formatDate(AUG_5)).toBe(AUG_5);
    expect(fixture.componentInstance.formatDate([2026, 8, 5])).toBe(AUG_5);
    expect(fixture.componentInstance.formatDate(null)).toBe('-');
  });

  it('exposes the transactions the summary carried', async () => {
    const fixture = await render();

    expect(fixture.componentInstance.transactions()).toHaveSize(1);
    expect(fixture.componentInstance.transactions()[0].txnNote).toBe('vault float');
  });

  it('routes to each command with the cashier it belongs to', async () => {
    const fixture = await render();

    fixture.componentInstance.onAllocate();
    expect(routerSpy.navigate).toHaveBeenCalledWith([
      '/tellers',
      TELLER_ID,
      'cashiers',
      CASHIER_ID,
      'transactions',
      'allocate',
    ]);

    fixture.componentInstance.onSettle();
    expect(routerSpy.navigate).toHaveBeenCalledWith([
      '/tellers',
      TELLER_ID,
      'cashiers',
      CASHIER_ID,
      'transactions',
      'settle',
    ]);
  });

  it('shows an empty table rather than failing when the summary cannot be read', async () => {
    tellerServiceSpy.getTellersTellerIdCashiersCashierIdSummaryandtransactions.and.returnValue(
      new Observable((subscriber) => subscriber.error(new Error('boom'))) as Observable<never>,
    );
    const fixture = await render();

    expect(fixture.componentInstance.transactions()).toEqual([]);
  });
});
