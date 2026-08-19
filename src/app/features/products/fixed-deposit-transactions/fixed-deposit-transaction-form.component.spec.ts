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
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { FixedDepositTransactionFormComponent } from './fixed-deposit-transaction-form.component';
import { FixedDepositAccountTransactionsService } from '../../../api';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('FixedDepositTransactionFormComponent', () => {
  let component: FixedDepositTransactionFormComponent;
  let fixture: ComponentFixture<FixedDepositTransactionFormComponent>;
  let serviceSpy: jasmine.SpyObj<FixedDepositAccountTransactionsService>;
  let routerSpy: jasmine.SpyObj<Router>;

  type PostReturn = ReturnType<
    FixedDepositAccountTransactionsService['postFixeddepositaccountsFixedDepositAccountIdTransactions']
  >;
  type TemplateReturn = ReturnType<
    FixedDepositAccountTransactionsService['getFixeddepositaccountsFixedDepositAccountIdTransactionsTemplate']
  >;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('FixedDepositAccountTransactionsService', [
      'getFixeddepositaccountsFixedDepositAccountIdTransactionsTemplate',
      'postFixeddepositaccountsFixedDepositAccountIdTransactions',
    ]);
    serviceSpy.getFixeddepositaccountsFixedDepositAccountIdTransactionsTemplate.and.returnValue(
      of({
        paymentTypeOptions: [
          { id: 1, name: 'Money Transfer' },
          { id: 2, name: 'Cash' },
        ],
      }) as unknown as TemplateReturn,
    );
    serviceSpy.postFixeddepositaccountsFixedDepositAccountIdTransactions.and.returnValue(
      of({}) as unknown as PostReturn,
    );
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [FixedDepositTransactionFormComponent],
      providers: [
        provideNoopAnimations(),
        provideIonicTesting(),
        ...provideTranslateTesting(),
        { provide: FixedDepositAccountTransactionsService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ accountId: '7' }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FixedDepositTransactionFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('reads the payment types the template actually returns', () => {
    expect(
      serviceSpy.getFixeddepositaccountsFixedDepositAccountIdTransactionsTemplate,
    ).toHaveBeenCalledWith(7);
    // The generated model types these as `Array<number>`; the platform sends objects. Rendering
    // the raw element would put `[object Object]` in the select.
    expect(component.paymentTypeOptions()).toEqual([
      { id: 1, name: 'Money Transfer' },
      { id: 2, name: 'Cash' },
    ]);
  });

  /**
   * The argument order is the whole point of this assertion. The recurring-deposit twin is
   * `(accountId, request, command)` and this operation is `(accountId, command, body)`; a call
   * copied from the twin binds the request object to `command` and still compiles.
   */
  it('posts with the command second and a serialised body third', () => {
    component.transactionAmount = 500;
    component.paymentTypeId = 2;
    component.transactionDate = '2026-08-09';

    component.onSubmit();

    const args =
      serviceSpy.postFixeddepositaccountsFixedDepositAccountIdTransactions.calls.mostRecent().args;
    expect(args[0]).toBe(7);
    expect(args[1]).toBe('deposit');
    expect(JSON.parse(args[2] as string)).toEqual(
      jasmine.objectContaining({
        transactionAmount: 500,
        paymentTypeId: 2,
        transactionDate: '09 August 2026',
      }),
    );
  });

  it('returns to the account once the deposit is recorded', () => {
    component.transactionAmount = 100;

    component.onSubmit();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/fixed-deposits/view', 7]);
  });

  it('re-enables the form when the post fails', () => {
    serviceSpy.postFixeddepositaccountsFixedDepositAccountIdTransactions.and.returnValue(
      throwError(() => new Error('rejected')) as unknown as PostReturn,
    );
    component.transactionAmount = 100;

    component.onSubmit();

    expect(component.isSaving()).toBeFalse();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });
});
