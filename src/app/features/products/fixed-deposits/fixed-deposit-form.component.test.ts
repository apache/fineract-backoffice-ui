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

import type { Mock } from 'vitest';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FixedDepositAccountFormComponent } from './fixed-deposit-form.component';
import {
  FixedDepositAccountService,
  FixedDepositProductService,
  GetFixedDepositAccountsTemplateResponse,
  GetFixedDepositAccountsAccountIdResponse,
  PostFixedDepositAccountsResponse,
  GetFixedDepositAccountsProductOptions,
} from '../../../api';
import { Observable, of, throwError } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

const SUBMITTED_ON = '2026-06-11';

describe('FixedDepositAccountFormComponent', () => {
  let component: FixedDepositAccountFormComponent;
  let fixture: ComponentFixture<FixedDepositAccountFormComponent>;
  let fixedDepositServiceSpy: SpyObj<FixedDepositAccountService>;
  let productServiceSpy: SpyObj<FixedDepositProductService>;
  let routerSpy: SpyObj<Router>;
  let activatedRouteStub: {
    queryParams: Observable<Record<string, unknown>>;
    paramMap: Observable<{ get: (key: string) => string | null }>;
  };

  /**
   * `GET /fixeddepositaccounts/template?clientId&productId`, as the platform actually answers.
   *
   * Note what is absent: no `depositAmount`, no `depositPeriod`, no `depositPeriodFrequency`.
   * And `nominalAnnualInterestRate` is 0 on a product whose chart pays 7%.
   */
  const REAL_TEMPLATE = {
    clientId: 1,
    minDepositTerm: 12,
    minDepositTermType: { id: 2, value: 'Months' },
    nominalAnnualInterestRate: 0,
    accountChart: {
      chartSlabs: [
        {
          periodType: { id: 2, value: 'Months' },
          fromPeriod: 1,
          toPeriod: 12,
          annualInterestRate: 7,
          description: 'Interest rate',
        },
      ],
    },
    savingsAccounts: [{ id: 5, accountNo: '000000005', status: { active: true } }],
    maturityInstructionOptions: [
      { id: 100, code: 'depositAccountClosureType.withdrawDeposit', value: 'Withdraw Deposit' },
      {
        id: 200,
        code: 'depositAccountClosureType.transferToSavings',
        value: 'Transfer to Savings',
      },
    ],
    productOptions: [{ id: 101, name: 'FD', withHoldTax: false }],
  };

  /** The same, with two rate bands. */
  const TIERED_TEMPLATE = {
    ...REAL_TEMPLATE,
    minDepositTerm: 6,
    accountChart: {
      chartSlabs: [
        { periodType: { id: 2 }, fromPeriod: 1, toPeriod: 11, annualInterestRate: 5 },
        { periodType: { id: 2 }, fromPeriod: 12, annualInterestRate: 9 },
      ],
    },
  };

  const FIXED_DEPOSITS_PATH = '/products/fixed-deposits';
  const API_ERROR = 'API Error';

  beforeEach(async () => {
    fixedDepositServiceSpy = createSpyObj([
      'getFixeddepositaccountsTemplate',
      'getFixeddepositaccountsAccountId',
      'postFixeddepositaccounts',
      'putFixeddepositaccountsAccountId',
    ]);
    productServiceSpy = createSpyObj(['getFixeddepositproductsProductId']);
    // The deposit amount lives on the product, not on the account template.
    productServiceSpy.getFixeddepositproductsProductId.mockReturnValue(
      of({ depositAmount: 1000 }) as never,
    );
    routerSpy = createSpyObj(['navigate']);
    activatedRouteStub = {
      queryParams: of({}),
      paramMap: of({ get: () => null }),
    };

    await TestBed.configureTestingModule({
      imports: [FixedDepositAccountFormComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        { provide: FixedDepositAccountService, useValue: fixedDepositServiceSpy },
        { provide: FixedDepositProductService, useValue: productServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FixedDepositAccountFormComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
      of({} as GetFixedDepositAccountsTemplateResponse),
    );
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should initialize with clientId from query parameters', () => {
    activatedRouteStub.queryParams = of({ clientId: '123' });
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
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
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
      of({
        productOptions,
      } as GetFixedDepositAccountsTemplateResponse),
    );

    component.onClientSelected(456);

    expect(component.account()['clientId']).toBe(456);
    expect(fixedDepositServiceSpy.getFixeddepositaccountsTemplate).toHaveBeenCalledWith(456);
    expect(component.products()).toHaveLength(1);
  });

  it('should handle missing product options in template', () => {
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
      of({} as GetFixedDepositAccountsTemplateResponse),
    );

    (component as unknown as Record<string, () => void>)['loadProducts']();

    expect(component.products()).toEqual([]);
  });

  /**
   * #766. Choosing a product filled nothing in, and this test is part of why it shipped: the
   * fixture it used invented a template shape the platform does not send.
   *
   * Measured against a running Fineract, `GET /fixeddepositaccounts/template?clientId&productId`
   * carries **no** `depositAmount`, `depositPeriod` or `depositPeriodFrequency`, and sends
   * `nominalAnnualInterestRate: 0` for a product whose chart pays 7%. The old prefill read
   * exactly those four fields and wrote `0 || undefined` for the rate, so every one of them
   * landed `undefined` — while this test passed against a fixture that had them all.
   */
  it('fills the term, its unit and the rate from the real template shape', () => {
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
      of(REAL_TEMPLATE as unknown as GetFixedDepositAccountsTemplateResponse),
    );
    component.account()['clientId'] = 1;

    component.onProductSelected(101);

    expect(fixedDepositServiceSpy.getFixeddepositaccountsTemplate).toHaveBeenCalledWith(
      1,
      undefined,
      101,
    );
    expect(component.account()['depositPeriod']).toBe(12);
    expect(component.account()['depositPeriodFrequencyId']).toBe(2);
    // From the chart, not from the template's own zero.
    expect(component.account()['nominalAnnualInterestRate']).toBe(7);
  });

  it('takes the deposit amount from the product, which is the only place it is', () => {
    // `productOptions` on the template lists `{id, name, withHoldTax}` and nothing else, so
    // there is no avoiding the second request.
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
      of(REAL_TEMPLATE as unknown as GetFixedDepositAccountsTemplateResponse),
    );
    component.account()['clientId'] = 1;

    component.onProductSelected(101);

    expect(productServiceSpy.getFixeddepositproductsProductId).toHaveBeenCalledWith(101);
    expect(component.account()['depositAmount']).toBe(1000);
  });

  it('recomputes the rate when the term moves to another slab', () => {
    // A tiered product pays differently for 6 and 24 months. A rate left at the first slab's
    // would disagree with the product, which is the defect #761 reports for savings.
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
      of(TIERED_TEMPLATE as unknown as GetFixedDepositAccountsTemplateResponse),
    );
    component.account()['clientId'] = 1;
    component.onProductSelected(101);

    expect(component.account()['nominalAnnualInterestRate']).toBe(5);

    component.account.update((account) => ({ ...account, depositPeriod: 24 }));
    component.onTermChanged();

    expect(component.account()['nominalAnnualInterestRate']).toBe(9);
  });

  it('treats an open-ended last band as covering any longer term', () => {
    // A tiered chart's final slab usually has no `toPeriod`, which is how "12 months and over"
    // is written. Reading that as a bounded range would leave long deposits with no rate.
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
      of(TIERED_TEMPLATE as unknown as GetFixedDepositAccountsTemplateResponse),
    );
    component.account()['clientId'] = 1;
    component.onProductSelected(101);

    component.account.update((account) => ({ ...account, depositPeriod: 999 }));
    component.onTermChanged();

    expect(component.account()['nominalAnnualInterestRate']).toBe(9);
  });

  it('leaves the rate alone when no slab covers the term at all', () => {
    // Better a rate the user can see and correct than a blank the platform will refuse.
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
      of({
        ...REAL_TEMPLATE,
        minDepositTerm: 6,
        accountChart: {
          chartSlabs: [
            { periodType: { id: 2 }, fromPeriod: 1, toPeriod: 11, annualInterestRate: 5 },
          ],
        },
      } as unknown as GetFixedDepositAccountsTemplateResponse),
    );
    component.account()['clientId'] = 1;
    component.onProductSelected(101);

    component.account.update((account) => ({ ...account, depositPeriod: 999 }));
    component.onTermChanged();

    expect(component.account()['nominalAnnualInterestRate']).toBe(5);
  });

  it('notifies readers of the prefill instead of mutating the model in place', () => {
    // The old prefill assigned to `account()`'s properties, which changes the object without
    // telling anything that reads the signal — so a resolved field could still fail to render.
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
      of(REAL_TEMPLATE as unknown as GetFixedDepositAccountsTemplateResponse),
    );
    component.account()['clientId'] = 1;
    const before = component.account();

    component.onProductSelected(101);

    expect(component.account()).not.toBe(before);
  });

  describe('the frequency that went invalid after choosing a product', () => {
    /*
     * #766's second half: "Frequency shows a preselected value, but the form control is invalid
     * until the user opens the select and picks Months again", with Save disabled and nothing
     * saying why.
     *
     * The cause was the prefill, not the select. The account template carries no
     * `depositPeriodFrequency`, so the old code assigned `undefined` to the model property that
     * `[(ngModel)]` is bound to. That emptied the control — failing its `required` validator —
     * while the Ionic select went on displaying Months. It only showed up *after* choosing a
     * product, which is why the issue's reproduction hits it at step 4 rather than step 1.
     */
    it('starts valid, with months selected', () => {
      expect(component.account()['depositPeriodFrequencyId']).toBe(2);
    });

    it('is not blanked by a template that states no term unit', () => {
      (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
        of({
          ...REAL_TEMPLATE,
          minDepositTermType: undefined,
        } as unknown as GetFixedDepositAccountsTemplateResponse),
      );
      component.account()['clientId'] = 1;

      component.onProductSelected(101);

      expect(component.account()['depositPeriodFrequencyId']).toBe(2);
    });

    it('is not blanked by a template that states nothing at all', () => {
      // The degenerate case, and the one the old code hit on every product: every field it read
      // was absent, so every assignment wrote `undefined`.
      (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
        of({} as unknown as GetFixedDepositAccountsTemplateResponse),
      );
      component.account()['clientId'] = 1;

      component.onProductSelected(101);

      expect(component.account()['depositPeriodFrequencyId']).toBe(2);
    });
  });

  it('should handle error when loading product defaults', () => {
    vi.spyOn(console, 'error');
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
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
    (fixedDepositServiceSpy.getFixeddepositaccountsAccountId as Mock).mockReturnValue(
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
    vi.spyOn(console, 'error');
    (fixedDepositServiceSpy.getFixeddepositaccountsAccountId as Mock).mockReturnValue(
      throwError(() => new Error(API_ERROR)),
    );
    component.accountId = 123;

    (component as unknown as Record<string, () => void>)['loadAccountData']();

    expect(console.error).toHaveBeenCalled();
  });

  it('should submit application in create mode', () => {
    (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
      of({} as GetFixedDepositAccountsTemplateResponse),
    );
    (fixedDepositServiceSpy.postFixeddepositaccounts as Mock).mockReturnValue(
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
    (fixedDepositServiceSpy.putFixeddepositaccountsAccountId as Mock).mockReturnValue(
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
      expect.any(Object),
    );
    expect(routerSpy.navigate).toHaveBeenCalledWith([FIXED_DEPOSITS_PATH]);
  });

  it('should handle submission error', () => {
    (fixedDepositServiceSpy.postFixeddepositaccounts as Mock).mockReturnValue(
      throwError(() => new Error(API_ERROR)),
    );
    component.onSubmit();
    expect(component.isSaving()).toBe(false);
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

  /**
   * #783's half of this form: what happens at maturity, and which savings account funds the
   * deposit.
   *
   * The second one is where the issue was wrong about the platform, and getting it wrong in the
   * UI would move a customer's money. #783 describes `linkAccountId` as "the customer's savings
   * account" for the maturity payout. It is not: activation **debits** the linked account by the
   * deposit amount. Measured — a savings account holding 20,000 went to 15,000 when a 5,000
   * deposit linked to it was activated, and an unfunded linked account makes activation fail
   * with 403 "Insufficient account balance." The payout target is `transferToSavingsId`, which
   * goes with the maturity instruction.
   */
  describe('maturity instruction and funding account', () => {
    beforeEach(() => {
      (fixedDepositServiceSpy.getFixeddepositaccountsTemplate as Mock).mockReturnValue(
        of(REAL_TEMPLATE as unknown as GetFixedDepositAccountsTemplateResponse),
      );
      component.account()['clientId'] = 1;
      component.onProductSelected(101);
    });

    it('offers the instructions and savings accounts the template returned', () => {
      expect(component.maturityInstructions().map((option) => option.id)).toEqual([100, 200]);
      expect(component.savingsAccounts().map((savings) => savings.accountNo)).toEqual([
        '000000005',
      ]);
    });

    it('asks for a transfer target only when the instruction is to transfer', () => {
      component.account.update((account) => ({ ...account, maturityInstructionId: 100 }));
      expect(component.transfersAtMaturity()).toBe(false);

      component.account.update((account) => ({ ...account, maturityInstructionId: 200 }));
      expect(component.transfersAtMaturity()).toBe(true);
    });

    it('sends the instruction, the transfer target and the funding account on create', () => {
      component.account.update((account) => ({
        ...account,
        depositAmount: 5000,
        depositPeriod: 12,
        maturityInstructionId: 200,
        transferToSavingsId: 5,
        linkAccountId: 5,
        transferInterestToSavings: true,
      }));
      (fixedDepositServiceSpy.postFixeddepositaccounts as Mock).mockReturnValue(of({}));

      component.onSubmit();

      const payload = (fixedDepositServiceSpy.postFixeddepositaccounts as Mock).mock
        .calls[0][0] as Record<string, unknown>;
      expect(payload['maturityInstructionId']).toBe(200);
      expect(payload['transferToSavingsId']).toBe(5);
      expect(payload['linkAccountId']).toBe(5);
      expect(payload['transferInterestToSavings']).toBe(true);
    });

    it('carries them through an update, which names its fields one by one', () => {
      // The update builds an explicit payload, so a field not named here is a field the update
      // silently drops — the same trap the product form documents.
      component.accountId = 7;
      component.isEditMode.set(true);
      component.account.update((account) => ({
        ...account,
        depositAmount: 5000,
        depositPeriod: 12,
        maturityInstructionId: 200,
        transferToSavingsId: 5,
        linkAccountId: 5,
      }));
      (fixedDepositServiceSpy.putFixeddepositaccountsAccountId as Mock).mockReturnValue(of({}));

      component.onSubmit();

      const payload = (fixedDepositServiceSpy.putFixeddepositaccountsAccountId as Mock).mock
        .calls[0][1] as Record<string, unknown>;
      expect(payload['maturityInstructionId']).toBe(200);
      expect(payload['transferToSavingsId']).toBe(5);
      expect(payload['linkAccountId']).toBe(5);
    });

    it('omits the transfer target when the instruction is not to transfer', () => {
      // Sending one with instruction 100 describes a transfer that is not going to happen.
      component.accountId = 7;
      component.isEditMode.set(true);
      component.account.update((account) => ({
        ...account,
        maturityInstructionId: 100,
        transferToSavingsId: 5,
      }));
      (fixedDepositServiceSpy.putFixeddepositaccountsAccountId as Mock).mockReturnValue(of({}));

      component.onSubmit();

      const payload = (fixedDepositServiceSpy.putFixeddepositaccountsAccountId as Mock).mock
        .calls[0][1] as Record<string, unknown>;
      expect(payload['transferToSavingsId']).toBeUndefined();
    });
  });
});
