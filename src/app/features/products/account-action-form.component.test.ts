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
import { AccountActionFormComponent } from './account-action-form.component';
import {
  SavingsAccountService,
  FixedDepositAccountService,
  RecurringDepositAccountService,
  LoansService,
  StaffService,
  ChargesService,
  LoanChargesService,
} from '../../api';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError, Observable } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateTesting } from '../../testing/i18n-testing';

describe('AccountActionFormComponent', () => {
  const SAVINGS_PATH = '/products/savings-accounts';
  const LOAN_PATH_PREFIX = '/loans/view/';

  let component: AccountActionFormComponent;
  let fixture: ComponentFixture<AccountActionFormComponent>;

  let savingsSpy: SpyObj<SavingsAccountService>;
  let fixedSpy: SpyObj<FixedDepositAccountService>;
  let recurringSpy: SpyObj<RecurringDepositAccountService>;
  let loansSpy: SpyObj<LoansService>;
  let staffSpy: SpyObj<StaffService>;
  let chargesSpy: SpyObj<ChargesService>;
  let loanChargesSpy: SpyObj<LoanChargesService>;
  let routerSpy: SpyObj<Router>;

  let routeParams: Record<string, string>;

  beforeEach(async () => {
    routeParams = {
      ['accountId']: '123',
      ['accountType']: 'loan',
      ['command']: 'approve',
    };

    savingsSpy = createSpyObj(['getSavingsaccountsAccountId', 'postSavingsaccountsAccountId']);
    fixedSpy = createSpyObj([
      'getFixeddepositaccountsAccountId',
      'postFixeddepositaccountsAccountId',
    ]);
    recurringSpy = createSpyObj([
      'getRecurringdepositaccountsAccountId',
      'postRecurringdepositaccountsAccountId',
    ]);
    loansSpy = createSpyObj(['getLoansLoanId', 'postLoansLoanId']);
    staffSpy = createSpyObj(['getStaff']);
    chargesSpy = createSpyObj(['getCharges']);
    loanChargesSpy = createSpyObj(['postLoansLoanIdCharges']);
    routerSpy = createSpyObj(['navigate']);

    // Mock initial returns
    loansSpy.getLoansLoanId.mockReturnValue(
      of({
        id: 123,
        accountNo: 'L001',
        principal: 1000,
        timeline: {
          expectedDisbursementDate: [2026, 6, 16],
          submittedOnDate: [2026, 6, 1],
        },
      }) as unknown as Observable<never>,
    );
    savingsSpy.getSavingsaccountsAccountId.mockReturnValue(
      of({ id: 123, accountNo: 'S001' }) as unknown as Observable<never>,
    );
    fixedSpy.getFixeddepositaccountsAccountId.mockReturnValue(
      of({ id: 123, accountNo: 'F001' }) as unknown as Observable<never>,
    );
    recurringSpy.getRecurringdepositaccountsAccountId.mockReturnValue(
      of({ id: 123, accountNo: 'R001' }) as unknown as Observable<never>,
    );

    staffSpy.getStaff.mockReturnValue(
      of([{ id: 1, displayName: 'John Staff' }]) as unknown as Observable<never>,
    );
    chargesSpy.getCharges.mockReturnValue(
      of([
        {
          id: 5,
          name: 'Fee',
          amount: 50,
          active: true,
          chargeAppliesTo: { id: 1, value: 'Loan' },
        },
      ]) as unknown as Observable<never>,
    );

    await TestBed.configureTestingModule({
      imports: [AccountActionFormComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: SavingsAccountService, useValue: savingsSpy },
        { provide: FixedDepositAccountService, useValue: fixedSpy },
        { provide: RecurringDepositAccountService, useValue: recurringSpy },
        { provide: LoansService, useValue: loansSpy },
        { provide: StaffService, useValue: staffSpy },
        { provide: ChargesService, useValue: chargesSpy },
        { provide: LoanChargesService, useValue: loanChargesSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of(routeParams),
          },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();
  });

  const createComponent = () => {
    fixture = TestBed.createComponent(AccountActionFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('should initialize and load loan details for approve command', () => {
    createComponent();
    expect(component).toBeTruthy();
    expect(loansSpy.getLoansLoanId).toHaveBeenCalledWith(123);
    expect(component.title).toBe('ACTIONS.APPROVE_ACCOUNT');
    expect(component.dateLabel).toBe('ACTIONS.APPROVAL_DATE');
  });

  it('should format arrays and strings into Dates correctly via getFineractDate', () => {
    createComponent();
    const date1 = component.getFineractDate([2026, 6, 16]);
    expect(date1?.getFullYear()).toBe(2026);
    expect(date1?.getMonth()).toBe(5); // 0-indexed

    const date2 = component.getFineractDate('2026-06-16');
    expect(date2?.getFullYear()).toBe(2026);
  });

  it('should handle cancel redirects correctly for each accountType', () => {
    createComponent();
    component.accountType.set('savings');
    component.onCancel();
    expect(routerSpy.navigate).toHaveBeenCalledWith([SAVINGS_PATH]);

    component.accountType.set('fixed');
    component.onCancel();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/fixed-deposits']);

    component.accountType.set('recurring');
    component.onCancel();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/recurring-deposits']);

    component.accountType.set('loan');
    component.onCancel();
    expect(routerSpy.navigate).toHaveBeenCalledWith([`${LOAN_PATH_PREFIX}123`]);

    component.accountType.set('unknown');
    component.onCancel();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should submit approve loan action successfully', () => {
    loansSpy.postLoansLoanId.mockReturnValue(of({}) as unknown as Observable<never>);
    createComponent();

    component.note = 'Approving loan';
    component.actionDate = new Date(2026, 5, 16);
    component.onSubmit();

    expect(loansSpy.postLoansLoanId).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith([`${LOAN_PATH_PREFIX}123`]);
  });

  it('should submit disburse loan action successfully', () => {
    routeParams['command'] = 'disburse';
    loansSpy.postLoansLoanId.mockReturnValue(of({}) as unknown as Observable<never>);
    createComponent();

    component.note = 'Disbursing';
    component.onSubmit();

    expect(loansSpy.postLoansLoanId).toHaveBeenCalled();
  });

  it('should load staff options for assignloanofficer command', () => {
    routeParams['command'] = 'assignloanofficer';
    createComponent();

    expect(staffSpy.getStaff).toHaveBeenCalled();
    expect(component.staffOptions()).toHaveLength(1);

    loansSpy.postLoansLoanId.mockReturnValue(of({}) as unknown as Observable<never>);
    component.toLoanOfficerId = 1;
    component.onSubmit();
    expect(loansSpy.postLoansLoanId).toHaveBeenCalled();
  });

  it('should submit unassignloanofficer successfully', () => {
    routeParams['command'] = 'unassignloanofficer';
    loansSpy.postLoansLoanId.mockReturnValue(of({}) as unknown as Observable<never>);
    createComponent();

    component.onSubmit();
    expect(loansSpy.postLoansLoanId).toHaveBeenCalled();
  });

  it('should load charge options and submit applycharges successfully', () => {
    routeParams['command'] = 'applycharges';
    loanChargesSpy.postLoansLoanIdCharges.mockReturnValue(of({}) as unknown as Observable<never>);
    createComponent();

    expect(chargesSpy.getCharges).toHaveBeenCalled();
    component.onChargeSelected(5);
    expect(component.amount).toBe(50);

    component.chargeId = 5;
    component.onSubmit();
    expect(loanChargesSpy.postLoansLoanIdCharges).toHaveBeenCalled();
  });

  it('should submit deposit account actions for savings, fixed and recurring', () => {
    routeParams['accountType'] = 'savings';
    routeParams['command'] = 'approve';
    savingsSpy.postSavingsaccountsAccountId.mockReturnValue(of({}) as unknown as Observable<never>);

    createComponent();
    expect(savingsSpy.getSavingsaccountsAccountId).toHaveBeenCalledWith(123);

    component.onSubmit();
    expect(savingsSpy.postSavingsaccountsAccountId).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith([SAVINGS_PATH]);
  });

  it('should submit fixed deposit approve action successfully', () => {
    routeParams['accountType'] = 'fixed';
    routeParams['command'] = 'approve';
    fixedSpy.postFixeddepositaccountsAccountId.mockReturnValue(
      of({}) as unknown as Observable<never>,
    );

    createComponent();
    expect(fixedSpy.getFixeddepositaccountsAccountId).toHaveBeenCalledWith(123);

    component.onSubmit();
    expect(fixedSpy.postFixeddepositaccountsAccountId).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/fixed-deposits']);
  });

  it('should submit recurring deposit approve action successfully', () => {
    routeParams['accountType'] = 'recurring';
    routeParams['command'] = 'approve';
    recurringSpy.postRecurringdepositaccountsAccountId.mockReturnValue(
      of({}) as unknown as Observable<never>,
    );

    createComponent();
    expect(recurringSpy.getRecurringdepositaccountsAccountId).toHaveBeenCalledWith(123);

    component.onSubmit();
    expect(recurringSpy.postRecurringdepositaccountsAccountId).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/recurring-deposits']);
  });

  it('should handle API errors and toggle isSaving flag', () => {
    routeParams['accountType'] = 'savings';
    routeParams['command'] = 'approve';
    savingsSpy.postSavingsaccountsAccountId.mockReturnValue(
      throwError(() => new Error('API Error')) as unknown as Observable<never>,
    );

    createComponent();
    component.onSubmit();

    expect(component.isSaving()).toBe(false);
  });

  it('should extract currency code and frequency value safely', () => {
    createComponent();
    expect(component.getCurrencyCode({ code: 'USD' })).toBe('USD');
    expect(component.getCurrencyCode(null)).toBeUndefined();

    expect(component.getFrequencyValue({ value: 'Monthly' })).toBe('Monthly');
    expect(component.getFrequencyValue(null)).toBeUndefined();

    expect(component.getTimelineSubmittedOnDate({ submittedOnDate: [2026, 6, 16] })).toEqual([
      2026, 6, 16,
    ]);
    expect(component.getTimelineSubmittedOnDate(null)).toBeUndefined();

    expect(component.getAmount(100, 200)).toBe(100);
    expect(component.getAmount(0, 200)).toBe(200);
  });
});
