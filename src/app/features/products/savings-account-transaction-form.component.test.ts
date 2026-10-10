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

import { createSpyObj, SpyObj } from '../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SavingsAccountTransactionFormComponent } from './savings-account-transaction-form.component';
import { SavingsAccountTransactionsService } from '../../api';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideFakeAdapters } from '../../testing/adapters';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { NgForm } from '@angular/forms';
import { By } from '@angular/platform-browser';

function createComponent(command: string) {
  const transactionSpy: SpyObj<SavingsAccountTransactionsService> = createSpyObj([
    'getSavingsaccountsSavingsIdTransactionsTemplate',
    'postSavingsaccountsSavingsIdTransactions',
  ]);
  const routerSpy: SpyObj<Router> = createSpyObj(['navigate']);

  transactionSpy.getSavingsaccountsSavingsIdTransactionsTemplate.mockReturnValue(
    of(JSON.stringify({ paymentTypeOptions: [{ id: 1, name: 'Cash' }] })) as unknown as ReturnType<
      SavingsAccountTransactionsService['getSavingsaccountsSavingsIdTransactionsTemplate']
    >,
  );
  transactionSpy.postSavingsaccountsSavingsIdTransactions.mockReturnValue(
    of({}) as unknown as ReturnType<
      SavingsAccountTransactionsService['postSavingsaccountsSavingsIdTransactions']
    >,
  );

  const adapters = provideFakeAdapters();

  TestBed.configureTestingModule({
    imports: [SavingsAccountTransactionFormComponent],
    providers: [
      ...provideTranslateTesting(),
      ...adapters.providers,
      { provide: SavingsAccountTransactionsService, useValue: transactionSpy },
      { provide: Router, useValue: routerSpy },
      {
        provide: ActivatedRoute,
        useValue: { params: of({ accountId: '7', command }) },
      },
      provideNoopAnimations(),
    ],
  });

  const fixture: ComponentFixture<SavingsAccountTransactionFormComponent> = TestBed.createComponent(
    SavingsAccountTransactionFormComponent,
  );
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, transactionSpy, routerSpy };
}

describe('SavingsAccountTransactionFormComponent', () => {
  it('parses the account id and command from the route', () => {
    const { component } = createComponent('deposit');
    expect(component.accountId).toBe(7);
    expect(component.command()).toBe('deposit');
  });

  it('sends amount, payment type, and note for a deposit', () => {
    const { component, transactionSpy } = createComponent('deposit');
    component.transaction.transactionAmount = 500;
    component.transaction.paymentTypeId = 1;
    component.note = 'Cash deposit';

    component.onSubmit();

    expect(transactionSpy.postSavingsaccountsSavingsIdTransactions).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ transactionAmount: 500, paymentTypeId: 1, note: 'Cash deposit' }),
      'deposit',
    );
  });

  it('sends only the date and the as-on flag for postInterestAsOn, no amount or note', () => {
    const { component, transactionSpy } = createComponent('postInterestAsOn');

    component.onSubmit();

    expect(transactionSpy.postSavingsaccountsSavingsIdTransactions).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ isPostInterestAsOn: true, transactionDate: expect.any(String) }),
      'postInterestAsOn',
    );
    const payload = transactionSpy.postSavingsaccountsSavingsIdTransactions.mock.calls[0][1];
    expect(payload).not.toHaveProperty('transactionAmount');
    expect(payload).not.toHaveProperty('note');
  });

  it('navigates back to the accounts list on success', () => {
    const { component, routerSpy } = createComponent('postInterestAsOn');

    component.onSubmit();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/savings-accounts']);
  });

  it('cancel navigates back without submitting', () => {
    const { component, transactionSpy, routerSpy } = createComponent('deposit');

    component.onCancel();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/savings-accounts']);
    expect(transactionSpy.postSavingsaccountsSavingsIdTransactions).not.toHaveBeenCalled();
  });
});

describe('SavingsAccountTransactionFormComponent payment type', () => {
  /**
   * The payment type's own control, not the whole form: the amount is also required, so the
   * form's validity would not show which field refused.
   */
  async function paymentTypeControl(
    fixture: ComponentFixture<SavingsAccountTransactionFormComponent>,
  ) {
    fixture.detectChanges();
    await fixture.whenStable();
    const form = fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm);
    return form.controls['paymentTypeId'];
  }

  /** Chooses an option the way the select does: its value, then `ionChange`, which the form reads. */
  function choosePaymentType(
    fixture: ComponentFixture<SavingsAccountTransactionFormComponent>,
    id: number,
  ) {
    const select = fixture.debugElement.query(By.css('ion-select[name="paymentTypeId"]'))
      .nativeElement as HTMLElement & { value: unknown };
    select.value = id;
    select.dispatchEvent(new CustomEvent('ionChange', { detail: { value: id } }));
  }

  it.each(['deposit', 'withdrawal'])(
    'does not accept a %s without a payment type, which the platform refuses',
    async (command) => {
      const { fixture } = createComponent(command);

      expect((await paymentTypeControl(fixture)).invalid).toBe(true);

      choosePaymentType(fixture, 1);
      expect((await paymentTypeControl(fixture)).valid).toBe(true);
    },
  );

  it('does not render a payment type to post interest, which moves no money', async () => {
    const { fixture } = createComponent('postInterestAsOn');

    expect(await paymentTypeControl(fixture)).toBeUndefined();
  });
});
