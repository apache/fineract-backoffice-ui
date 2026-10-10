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

import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { CashierTransactionsComponent } from './cashier-transactions.component';
import { TELLER_API, type TellerApi } from '../../../core/adapters';
import { asyncOf, renderComponent } from '../../../testing/render';
import { provideFakeAdapters } from '../../../testing/adapters';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideIonicTesting } from '../../../testing/ionic-testing';

describe('CashierTransactionsComponent', () => {
  let tellerApiSpy: SpyObj<TellerApi>;
  let routerSpy: SpyObj<Router>;

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
        { provide: TELLER_API, useValue: tellerApiSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ tellerId: String(TELLER_ID), cashierId: String(CASHIER_ID) }) },
        },
      ],
    });
  }

  beforeEach(() => {
    tellerApiSpy = createSpyObj<TellerApi>(['cashierTransactionTemplate', 'cashierSummary']);
    routerSpy = createSpyObj(['navigate']);

    tellerApiSpy.cashierTransactionTemplate.mockReturnValue(
      asyncOf({
        cashierName: 'Officer, Probe',
        tellerName: 'Main Teller',
        currencies: [{ code: 'USD', label: 'US Dollar ($)' }],
      }) as unknown as Observable<never>,
    );

    tellerApiSpy.cashierSummary.mockReturnValue(
      asyncOf({
        cashierName: 'Officer, Probe',
        tellerName: 'Main Teller',
        allocated: 5000,
        settled: 1200,
        netCash: 3800,
        transactions: [{ type: 'Allocate Cash', amount: 5000, date: AUG_5, note: 'vault float' }],
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
    expect(tellerApiSpy.cashierSummary).toHaveBeenCalledWith(TELLER_ID, CASHIER_ID, 'USD');
  });

  it('exposes the transactions the summary carried', async () => {
    const fixture = await render();

    expect(fixture.componentInstance.transactions()).toEqual([
      { type: 'Allocate Cash', amount: 5000, date: AUG_5, note: 'vault float' },
    ]);
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
    tellerApiSpy.cashierSummary.mockReturnValue(
      new Observable((subscriber) => subscriber.error(new Error('boom'))) as Observable<never>,
    );
    const fixture = await render();

    expect(fixture.componentInstance.transactions()).toEqual([]);
  });
});
