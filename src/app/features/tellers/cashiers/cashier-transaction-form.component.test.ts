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
import { CashierTransactionFormComponent } from './cashier-transaction-form.component';
import { TELLER_API, type TellerApi } from '../../../core/adapters';
import { asyncOf, renderComponent } from '../../../testing/render';
import { provideFakeAdapters } from '../../../testing/adapters';
import { provideIonicTesting } from '../../../testing/ionic-testing';

describe('CashierTransactionFormComponent', () => {
  let tellerApiSpy: SpyObj<TellerApi>;
  let routerSpy: SpyObj<Router>;

  const TELLER_ID = 7;
  const CASHIER_ID = 3;

  /** Renders the form for one of the two commands the route distinguishes. */
  async function render(command: 'allocate' | 'settle') {
    return renderComponent(CashierTransactionFormComponent, {
      providers: [
        ...provideFakeAdapters().providers,
        provideNoopAnimations(),
        provideIonicTesting(),
        { provide: TELLER_API, useValue: tellerApiSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ tellerId: String(TELLER_ID), cashierId: String(CASHIER_ID), command }),
          },
        },
      ],
    });
  }

  beforeEach(() => {
    tellerApiSpy = createSpyObj<TellerApi>([
      'cashierTransactionTemplate',
      'allocateCash',
      'settleCash',
    ]);
    routerSpy = createSpyObj(['navigate']);

    tellerApiSpy.cashierTransactionTemplate.mockReturnValue(
      asyncOf({
        cashierName: 'Officer, Probe',
        tellerName: 'Main Teller',
        currencies: [{ code: 'USD', label: 'US Dollar ($)' }],
      }) as unknown as Observable<never>,
    );
    tellerApiSpy.allocateCash.mockReturnValue(of(undefined) as unknown as Observable<never>);
    tellerApiSpy.settleCash.mockReturnValue(of(undefined) as unknown as Observable<never>);
  });

  it('preselects the only currency the cashier may transact in', async () => {
    const fixture = await render('allocate');

    // Fineract scopes the currency list to the teller's office, so a single-option dropdown is
    // the common case. Leaving it blank would make the form invalid for a field with no choice.
    expect(fixture.componentInstance.currencyCode).toBe('USD');
  });

  it('allocates the amount, note and day the form holds', async () => {
    const fixture = await render('allocate');
    const component = fixture.componentInstance;

    component.txnAmount = 5000;
    component.txnNote = 'vault float';
    component.txnDate = new Date(2026, 7, 5);
    component.onSubmit();

    expect(tellerApiSpy.settleCash).not.toHaveBeenCalled();
    // The day is sent as an ISO date. The adapter writes it in Fineract's padded format; that
    // is asserted where it is written, in the adapter's spec.
    expect(tellerApiSpy.allocateCash).toHaveBeenCalledWith(TELLER_ID, CASHIER_ID, {
      currencyCode: 'USD',
      amount: 5000,
      date: '2026-08-05',
      note: 'vault float',
    });
  });

  it('settles when the route says so', async () => {
    const fixture = await render('settle');

    fixture.componentInstance.txnAmount = 1200;
    fixture.componentInstance.onSubmit();

    expect(tellerApiSpy.allocateCash).not.toHaveBeenCalled();
    expect(tellerApiSpy.settleCash).toHaveBeenCalled();
  });

  // One render per spec: TestBed cannot be reconfigured once a fixture has been created, so the
  // two commands are asserted separately rather than in a single body.
  it('labels the allocate command with its own title', async () => {
    const fixture = await render('allocate');
    expect(fixture.componentInstance.titleKey()).toBe('TELLERS.ALLOCATE_CASH');
    expect(fixture.componentInstance.submitLabelKey()).toBe('TELLERS.ALLOCATE');
  });

  it('labels the settle command with its own title', async () => {
    const fixture = await render('settle');
    expect(fixture.componentInstance.titleKey()).toBe('TELLERS.SETTLE_CASH');
    expect(fixture.componentInstance.submitLabelKey()).toBe('TELLERS.SETTLE');
  });

  it('returns to the cashier transactions view after a successful post', async () => {
    const fixture = await render('allocate');
    fixture.componentInstance.txnAmount = 10;
    fixture.componentInstance.onSubmit();

    expect(routerSpy.navigate).toHaveBeenCalledWith([
      '/tellers',
      TELLER_ID,
      'cashiers',
      CASHIER_ID,
      'transactions',
    ]);
  });

  it('re-enables the submit button when the post fails', async () => {
    tellerApiSpy.allocateCash.mockReturnValue(
      new Observable((subscriber) => subscriber.error(new Error('rejected'))) as Observable<never>,
    );
    const fixture = await render('allocate');

    fixture.componentInstance.txnAmount = 10;
    fixture.componentInstance.onSubmit();

    // Fineract rejects a settlement above the cashier's balance and an allocation outside the
    // cashier's date range. The form has to stay usable so the amount or date can be corrected.
    expect(fixture.componentInstance.isSaving()).toBe(false);
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });
});
