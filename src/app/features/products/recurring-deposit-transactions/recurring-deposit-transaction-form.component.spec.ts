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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecurringDepositTransactionFormComponent } from './recurring-deposit-transaction-form.component';
import { RecurringDepositAccountTransactionsService } from '../../../api';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('RecurringDepositTransactionFormComponent', () => {
  let component: RecurringDepositTransactionFormComponent;
  let fixture: ComponentFixture<RecurringDepositTransactionFormComponent>;
  let serviceSpy: jasmine.SpyObj<RecurringDepositAccountTransactionsService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let commandParam: 'deposit' | 'withdrawal';

  beforeEach(async () => {
    commandParam = 'deposit';
    serviceSpy = jasmine.createSpyObj('RecurringDepositAccountTransactionsService', [
      'getRecurringdepositaccountsRecurringDepositAccountIdTransactionsTemplate',
      'postRecurringdepositaccountsRecurringDepositAccountIdTransactions',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    serviceSpy.getRecurringdepositaccountsRecurringDepositAccountIdTransactionsTemplate.and.returnValue(
      of({ paymentTypeOptions: [1, 2] }) as unknown as ReturnType<
        RecurringDepositAccountTransactionsService['getRecurringdepositaccountsRecurringDepositAccountIdTransactionsTemplate']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [RecurringDepositTransactionFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: RecurringDepositAccountTransactionsService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'accountId' ? '1' : commandParam),
              },
            },
          },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(RecurringDepositTransactionFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should load template payment-type options on init', () => {
    createComponent();

    expect(component).toBeTruthy();
    expect(
      serviceSpy.getRecurringdepositaccountsRecurringDepositAccountIdTransactionsTemplate,
    ).toHaveBeenCalledWith(1);
    expect(component.paymentTypeOptions()).toHaveSize(2);
  });

  it('should post a deposit and navigate to the transactions list', () => {
    createComponent();
    serviceSpy.postRecurringdepositaccountsRecurringDepositAccountIdTransactions.and.returnValue(
      of({}) as unknown as ReturnType<
        RecurringDepositAccountTransactionsService['postRecurringdepositaccountsRecurringDepositAccountIdTransactions']
      >,
    );
    component.transactionAmount = 500;
    component.paymentTypeId = 1;
    component.onSubmit();
    expect(
      serviceSpy.postRecurringdepositaccountsRecurringDepositAccountIdTransactions,
    ).toHaveBeenCalledWith(
      1,
      jasmine.objectContaining({ transactionAmount: 500, paymentTypeId: 1 }),
      'deposit',
    );
    expect(routerSpy.navigate).toHaveBeenCalledWith([
      '/products/recurring-deposits',
      1,
      'transactions',
    ]);
  });

  it('should post a withdrawal command from the route', () => {
    commandParam = 'withdrawal';
    createComponent();
    serviceSpy.postRecurringdepositaccountsRecurringDepositAccountIdTransactions.and.returnValue(
      of({}) as unknown as ReturnType<
        RecurringDepositAccountTransactionsService['postRecurringdepositaccountsRecurringDepositAccountIdTransactions']
      >,
    );
    component.transactionAmount = 200;

    component.onSubmit();

    expect(component.command()).toBe('withdrawal');
    expect(
      serviceSpy.postRecurringdepositaccountsRecurringDepositAccountIdTransactions,
    ).toHaveBeenCalledWith(1, jasmine.objectContaining({ transactionAmount: 200 }), 'withdrawal');
  });
});
