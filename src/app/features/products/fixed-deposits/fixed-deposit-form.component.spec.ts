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
import { FixedDepositAccountFormComponent } from './fixed-deposit-form.component';
import {
  FixedDepositAccountService,
  GetFixedDepositAccountsTemplateResponse,
  GetFixedDepositAccountsAccountIdResponse,
  PostFixedDepositAccountsResponse,
  GetFixedDepositAccountsProductOptions,
} from '../../../api';
import { Observable, of, throwError } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';

const SUBMITTED_ON = '2026-06-11';

describe('FixedDepositAccountFormComponent', () => {
  let component: FixedDepositAccountFormComponent;
  let fixture: ComponentFixture<FixedDepositAccountFormComponent>;
  let fixedDepositServiceSpy: jasmine.SpyObj<FixedDepositAccountService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let activatedRouteStub: {
    queryParams: Observable<Record<string, unknown>>;
    paramMap: Observable<{ get: (key: string) => string | null }>;
  };

  const FIXED_DEPOSITS_PATH = '/products/fixed-deposits';
  const API_ERROR = 'API Error';

  beforeEach(async () => {
    fixedDepositServiceSpy = jasmine.createSpyObj('FixedDepositAccountService', [
      'getFixeddepositaccountsTemplate',
      'getFixeddepositaccountsAccountId',
      'postFixeddepositaccounts',
      'putFixeddepositaccountsAccountId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    activatedRouteStub = {
      queryParams: of({}),
      paramMap: of({ get: () => null }),
    };

    await TestBed.configureTestingModule({
      imports: [FixedDepositAccountFormComponent, TranslateModule.forRoot()],
      providers: [
        provideNoopAnimations(),
        { provide: FixedDepositAccountService, useValue: fixedDepositServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FixedDepositAccountFormComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as jasmine.Spy).and.returnValue(
      of({} as GetFixedDepositAccountsTemplateResponse),
    );
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should initialize with clientId from query parameters', () => {
    activatedRouteStub.queryParams = of({ clientId: '123' });
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as jasmine.Spy).and.returnValue(
      of({} as GetFixedDepositAccountsTemplateResponse),
    );

    component.ngOnInit();

    expect(component.account()['clientId']).toBe(123);
    expect(fixedDepositServiceSpy.getFixeddepositaccountsTemplate).toHaveBeenCalledWith(123);
  });

  it('should load product options on client selection', () => {
    const productOptions = new Set<GetFixedDepositAccountsProductOptions>([
      { id: 1, name: 'Product 1' } as GetFixedDepositAccountsProductOptions,
    ]);
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as jasmine.Spy).and.returnValue(
      of({
        productOptions,
      } as GetFixedDepositAccountsTemplateResponse),
    );

    component.onClientSelected(456);

    expect(component.account()['clientId']).toBe(456);
    expect(fixedDepositServiceSpy.getFixeddepositaccountsTemplate).toHaveBeenCalledWith(456);
    expect(component.products()).toHaveSize(1);
  });

  it('should handle missing product options in template', () => {
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as jasmine.Spy).and.returnValue(
      of({} as GetFixedDepositAccountsTemplateResponse),
    );

    (component as unknown as Record<string, () => void>)['loadProducts']();

    expect(component.products()).toEqual([]);
  });

  it('should load product defaults when a product is selected', () => {
    const mockTemplate = {
      depositAmount: 5000,
      depositPeriod: 12,
      depositPeriodFrequency: { id: 2 },
      nominalAnnualInterestRate: 5.5,
    };
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as jasmine.Spy).and.returnValue(
      of(mockTemplate as unknown as GetFixedDepositAccountsTemplateResponse),
    );
    component.account()['clientId'] = 1;

    component.onProductSelected(101);

    expect(fixedDepositServiceSpy.getFixeddepositaccountsTemplate).toHaveBeenCalledWith(
      1,
      undefined,
      101,
    );
    expect(component.account()['depositAmount']).toBe(5000);
    expect(component.account()['depositPeriod']).toBe(12);
    expect(component.account()['depositPeriodFrequencyId']).toBe(2);
    expect(component.account()['nominalAnnualInterestRate']).toBe(5.5);
  });

  it('should handle error when loading product defaults', () => {
    spyOn(console, 'error');
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as jasmine.Spy).and.returnValue(
      throwError(() => new Error(API_ERROR)),
    );
    component.account()['clientId'] = 1;

    component.onProductSelected(101);

    expect(console.error).toHaveBeenCalled();
  });

  it('should load existing account data in edit mode', () => {
    const mockAccount = {
      clientId: 1,
      savingsProductId: 101,
      depositAmount: 1000,
      depositPeriod: 6,
      depositPeriodFrequency: { id: 2 },
      nominalAnnualInterestRate: 4.5,
      timeline: {
        submittedOnDate: [2026, 6, 11] as unknown as string,
      },
    };
    (fixedDepositServiceSpy.getFixeddepositaccountsAccountId as jasmine.Spy).and.returnValue(
      of(mockAccount as unknown as GetFixedDepositAccountsAccountIdResponse),
    );
    component.accountId = 123;
    component.isEditMode.set(true);

    (component as unknown as Record<string, () => void>)['loadAccountData']();

    expect(fixedDepositServiceSpy.getFixeddepositaccountsAccountId).toHaveBeenCalledWith(123);
    expect(component.account()['clientId']).toBe(1);
    expect(component.account()['productId']).toBe(101);
    expect(component.account()['nominalAnnualInterestRate']).toBe(4.5);
    expect(component.submittedOnDate()).toEqual(SUBMITTED_ON);
  });

  it('should handle error when loading account data', () => {
    spyOn(console, 'error');
    (fixedDepositServiceSpy.getFixeddepositaccountsAccountId as jasmine.Spy).and.returnValue(
      throwError(() => new Error(API_ERROR)),
    );
    component.accountId = 123;

    (component as unknown as Record<string, () => void>)['loadAccountData']();

    expect(console.error).toHaveBeenCalled();
  });

  it('should submit application in create mode', () => {
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as jasmine.Spy).and.returnValue(
      of({} as GetFixedDepositAccountsTemplateResponse),
    );
    (fixedDepositServiceSpy.postFixeddepositaccounts as jasmine.Spy).and.returnValue(
      of({} as PostFixedDepositAccountsResponse),
    );
    fixture.detectChanges();

    component.account.set({
      clientId: 1,
      productId: 101,
      depositAmount: 1000,
      depositPeriod: 12,
      depositPeriodFrequencyId: 2,
      nominalAnnualInterestRate: 5,
    });
    component.submittedOnDate.set(SUBMITTED_ON);

    component.onSubmit();

    expect(fixedDepositServiceSpy.postFixeddepositaccounts).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith([FIXED_DEPOSITS_PATH]);
  });

  it('should update application in edit mode', () => {
    (fixedDepositServiceSpy.putFixeddepositaccountsAccountId as jasmine.Spy).and.returnValue(
      of({} as PostFixedDepositAccountsResponse),
    );
    component.accountId = 123;
    component.isEditMode.set(true);
    component.account.set({
      depositAmount: 2000,
      depositPeriod: 24,
      depositPeriodFrequencyId: 2,
      nominalAnnualInterestRate: 6,
    });
    component.submittedOnDate.set(SUBMITTED_ON);

    component.onSubmit();

    expect(fixedDepositServiceSpy.putFixeddepositaccountsAccountId).toHaveBeenCalledWith(
      123,
      jasmine.any(Object),
    );
    expect(routerSpy.navigate).toHaveBeenCalledWith([FIXED_DEPOSITS_PATH]);
  });

  it('should handle submission error', () => {
    (fixedDepositServiceSpy.postFixeddepositaccounts as jasmine.Spy).and.returnValue(
      throwError(() => new Error(API_ERROR)),
    );
    component.onSubmit();
    expect(component.isSaving()).toBeFalse();
  });

  it('should navigate on cancel', () => {
    component.onCancel();
    expect(routerSpy.navigate).toHaveBeenCalledWith([FIXED_DEPOSITS_PATH]);
  });

  it('should navigate to create client', () => {
    component.onCreateClient();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients/create']);
  });

  it('should navigate to create product', () => {
    component.onCreateProduct();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/fixed/create']);
  });

  it('should return clientId from account', () => {
    component.account()['clientId'] = 789;
    expect(component.getClientId()).toBe(789);
  });

  it('should return null if clientId is missing', () => {
    component.account()['clientId'] = undefined;
    expect(component.getClientId()).toBeNull();
  });
});
