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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createSpyObj, SpyObj } from '../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { LoanProductFormComponent } from './loan-product-form.component';
import {
  LoanProductsService,
  FundsService,
  DelinquencyRangeAndBucketsManagementService,
} from '../../api';
import { provideIonicTesting } from '../../testing/ionic-testing';
import {
  ADVANCED_PAYMENT_ALLOCATION_STRATEGY,
  DEFAULT_TRANSACTION_PROCESSING_STRATEGY,
  LOAN_SCHEDULE_TYPE,
} from './loan-schedule-type';
import { ACCOUNTING_RULE, LOAN_ACCOUNTING_FIELDS } from './accounting/product-accounting.model';
import { provideTranslateTesting } from '../../testing/i18n-testing';

const EQUAL_AMORTIZATION_LABEL = 'Equal amortization';

const LOAN_PORTFOLIO = 'Loan Portfolio';

const TEMPLATE = {
  accountingRuleOptions: [
    { id: 1, code: 'accountingRuleType.none', value: 'NONE' },
    { id: 2, code: 'accountingRuleType.cash', value: 'CASH BASED' },
    { id: 3, code: 'accountingRuleType.accrual.periodic', value: 'ACCRUAL PERIODIC' },
    { id: 4, code: 'accountingRuleType.accrual.upfront', value: 'ACCRUAL UPFRONT' },
  ],
  accountingMappingOptions: {
    assetAccountOptions: [{ id: 11, name: LOAN_PORTFOLIO, glCode: '10201' }],
    liabilityAccountOptions: [{ id: 12, name: 'Overpayment', glCode: '20101' }],
    incomeAccountOptions: [{ id: 13, name: 'Interest Income', glCode: '40101' }],
    expenseAccountOptions: [{ id: 14, name: 'Write-off', glCode: '50101' }],
  },
  loanScheduleTypeOptions: [
    { id: 1, code: LOAN_SCHEDULE_TYPE.CUMULATIVE, value: 'Cumulative' },
    { id: 2, code: LOAN_SCHEDULE_TYPE.PROGRESSIVE, value: 'Progressive' },
  ],
  loanScheduleProcessingTypeOptions: [{ id: 1, code: 'HORIZONTAL', value: 'Horizontal' }],
  transactionProcessingStrategyOptions: [
    { id: 1, code: DEFAULT_TRANSACTION_PROCESSING_STRATEGY, name: 'Standard' },
    { id: 2, code: ADVANCED_PAYMENT_ALLOCATION_STRATEGY, name: 'Advanced payment allocation' },
  ],
  advancedPaymentAllocationTypes: [{ id: 1, code: 'PAST_DUE_PENALTY', value: 'Past due penalty' }],
  advancedPaymentAllocationTransactionTypes: [{ id: 1, code: 'DEFAULT', value: 'Default' }],
  advancedPaymentAllocationFutureInstallmentAllocationRules: [
    { id: 1, code: 'NEXT_INSTALLMENT', value: 'Next installment' },
  ],
  creditAllocationAllocationTypes: [],
  creditAllocationTransactionTypes: [],
  currencyOptions: [{ code: 'USD', name: 'US Dollar', decimalPlaces: 2 }],
  capitalizedIncomeTypeOptions: [
    { code: 'FEE', value: 'Fee' },
    { code: 'INTEREST', value: 'Interest' },
  ],
  capitalizedIncomeCalculationTypeOptions: [{ code: 'FLAT', value: 'Flat' }],
  capitalizedIncomeStrategyOptions: [
    { code: 'EQUAL_AMORTIZATION', value: EQUAL_AMORTIZATION_LABEL },
  ],
  buyDownFeeIncomeTypeOptions: [{ code: 'FEE', value: 'Fee' }],
  buyDownFeeCalculationTypeOptions: [{ code: 'FLAT', value: 'Flat' }],
  buyDownFeeStrategyOptions: [{ code: 'EQUAL_AMORTIZATION', value: EQUAL_AMORTIZATION_LABEL }],
  interestRecalculationCompoundingTypeOptions: [
    { id: 0, code: 'interestRecalculationCompoundingMethod.none', description: 'None' },
    { id: 1, code: 'interestRecalculationCompoundingMethod.fee', description: 'Fee' },
  ],
  interestRecalculationFrequencyTypeOptions: [
    {
      id: 1,
      code: 'interestRecalculationFrequencyType.same.as.repayment.period',
      description: 'Same as repayment period',
    },
    { id: 2, code: 'interestRecalculationFrequencyType.daily', description: 'Daily' },
  ],
  rescheduleStrategyTypeOptions: [
    {
      id: 1,
      code: 'loanRescheduleStrategyMethod.reduce.emi.amount',
      description: 'Reduce EMI amount',
    },
  ],
  preClosureInterestCalculationStrategyOptions: [
    {
      id: 1,
      code: 'preClosureInterestCalculationStrategy.tillPreClosureDate',
      description: 'Till pre-close date',
    },
  ],
  repaymentStartDateTypeOptions: [
    { id: 1, code: 'repaymentStartDateType.disbursement', description: 'Disbursement date' },
  ],
  chargeOffBehaviourOptions: [
    { code: 'REGULAR', value: 'Regular' },
    { code: 'ZERO_INTEREST', value: 'Zero interest' },
  ],
};

describe('LoanProductFormComponent', () => {
  let component: LoanProductFormComponent;
  let fixture: ComponentFixture<LoanProductFormComponent>;
  let productServiceSpy: SpyObj<LoanProductsService>;

  async function setup(productId: string | null = null): Promise<void> {
    TestBed.resetTestingModule();

    productServiceSpy = createSpyObj([
      'getLoanproductsTemplate',
      'getLoanproductsProductId',
      'postLoanproducts',
      'putLoanproductsProductId',
    ]);
    productServiceSpy.getLoanproductsTemplate.mockReturnValue(of(TEMPLATE) as any);

    const fundsSpy = createSpyObj(['getFunds']);
    fundsSpy.getFunds.mockReturnValue(of([]) as any);
    const delinquencySpy = createSpyObj(['getDelinquencyBuckets']);
    delinquencySpy.getDelinquencyBuckets.mockReturnValue(of([]) as any);

    await TestBed.configureTestingModule({
      imports: [LoanProductFormComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        provideIonicTesting(),
        { provide: LoanProductsService, useValue: productServiceSpy },
        { provide: FundsService, useValue: fundsSpy },
        {
          provide: DelinquencyRangeAndBucketsManagementService,
          useValue: delinquencySpy,
        },
        { provide: Router, useValue: createSpyObj(['navigate']) },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of({ get: () => productId }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanProductFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup();
  });

  it('creates, defaulting to a cumulative product', () => {
    expect(component).toBeTruthy();
    expect(component.product().loanScheduleType).toBe(LOAN_SCHEDULE_TYPE.CUMULATIVE);
    expect(component.isProgressive()).toBe(false);
  });

  it('notifies the product signal when an ngModel field changes', () => {
    const before = component.product();

    fixture.debugElement
      .query(By.css('[name="shortName"]'))
      .triggerEventHandler('ngModelChange', 'NXA0');

    expect(component.product()).not.toBe(before);
    expect(component.product().shortName).toBe('NXA0');
  });

  describe('down payment', () => {
    /**
     * Down payment is a progressive-engine capability. Hiding the controls on a cumulative
     * product is not enough — a value left behind would still be in the payload, describing a
     * product the cumulative engine cannot honour.
     */
    it('is cleared when the product is switched back to cumulative', () => {
      component.onLoanScheduleTypeChange(LOAN_SCHEDULE_TYPE.PROGRESSIVE);
      component.onEnableDownPaymentChange(true);
      component.product().disbursedAmountPercentageForDownPayment = 20;
      component.product().enableAutoRepaymentForDownPayment = true;

      component.onLoanScheduleTypeChange(LOAN_SCHEDULE_TYPE.CUMULATIVE);

      expect(component.product().enableDownPayment).toBeUndefined();
      expect(component.product().disbursedAmountPercentageForDownPayment).toBeUndefined();
      expect(component.product().enableAutoRepaymentForDownPayment).toBeUndefined();
    });

    it('drops its dependent settings when it is turned off directly', () => {
      component.onLoanScheduleTypeChange(LOAN_SCHEDULE_TYPE.PROGRESSIVE);
      component.onEnableDownPaymentChange(true);
      component.product().disbursedAmountPercentageForDownPayment = 25;

      component.onEnableDownPaymentChange(false);

      expect(component.product().enableDownPayment).toBeUndefined();
      expect(component.product().disbursedAmountPercentageForDownPayment).toBeUndefined();
    });

    it('is offered only on a progressive product', async () => {
      expect(
        fixture.nativeElement.querySelector('[data-testid="down-payment-unavailable-note"]'),
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="loan-product-enable-down-payment"]'),
      ).toBeNull();

      component.onLoanScheduleTypeChange(LOAN_SCHEDULE_TYPE.PROGRESSIVE);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="loan-product-enable-down-payment"]'),
      ).not.toBeNull();
    });
  });

  describe('multi-tranche disbursement', () => {
    it('drops the tranche settings when it is turned off', () => {
      component.onMultiDisburseChange(true);
      component.product().maxTrancheCount = 4;
      component.product().disallowExpectedDisbursements = true;
      component.product().allowFullTermForTranche = true;

      component.onMultiDisburseChange(false);

      expect(component.product().multiDisburseLoan).toBe(false);
      expect(component.product().maxTrancheCount).toBeUndefined();
      expect(component.product().disallowExpectedDisbursements).toBeUndefined();
      // Only ever reachable through multi-disbursement, so it must not outlive it.
      expect(component.product().allowFullTermForTranche).toBeUndefined();
    });

    it('reveals the tranche count once it is on', () => {
      expect(
        fixture.nativeElement.querySelector('[data-testid="loan-product-max-tranche-count"]'),
      ).toBeNull();

      component.onMultiDisburseChange(true);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="loan-product-max-tranche-count"]'),
      ).not.toBeNull();
    });

    it('is available regardless of schedule type', () => {
      expect(component.isProgressive()).toBe(false);
      expect(
        fixture.nativeElement.querySelector('[data-testid="loan-product-multi-disburse"]'),
      ).not.toBeNull();
    });
  });

  describe('income recognition', () => {
    /**
     * Capitalised income and buy-down fees are progressive-engine capabilities. #187 gated the
     * matching account tabs on these flags, so until they were settable the tabs could only ever
     * appear for products created outside this application.
     */
    it('is offered only on a progressive product', () => {
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="loan-product-enable-income-capitalization"]',
        ),
      ).toBeNull();

      component.onLoanScheduleTypeChange(LOAN_SCHEDULE_TYPE.PROGRESSIVE);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="loan-product-enable-income-capitalization"]',
        ),
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="loan-product-enable-buy-down-fee"]'),
      ).not.toBeNull();
    });

    it('seeds the detail fields when capitalisation is switched on', () => {
      component.onLoanScheduleTypeChange(LOAN_SCHEDULE_TYPE.PROGRESSIVE);
      component.onEnableIncomeCapitalizationChange(true);

      const product = component.product();
      expect(product.enableIncomeCapitalization).toBe(true);
      expect(product.capitalizedIncomeType).toBe('FEE');
      expect(product.capitalizedIncomeCalculationType).toBe('FLAT');
      expect(product.capitalizedIncomeStrategy).toBe('EQUAL_AMORTIZATION');
    });

    it('keeps a choice the user already made rather than resetting it', () => {
      component.onLoanScheduleTypeChange(LOAN_SCHEDULE_TYPE.PROGRESSIVE);
      component.onEnableIncomeCapitalizationChange(true);
      component.product().capitalizedIncomeType = 'INTEREST';

      component.onEnableIncomeCapitalizationChange(false);
      component.onEnableIncomeCapitalizationChange(true);

      // Cleared on the way out, so re-enabling starts from the default again.
      expect(component.product().capitalizedIncomeType).toBe('FEE');
    });

    it('clears both groups when the product returns to cumulative', () => {
      component.onLoanScheduleTypeChange(LOAN_SCHEDULE_TYPE.PROGRESSIVE);
      component.onEnableIncomeCapitalizationChange(true);
      component.onEnableBuyDownFeeChange(true);

      component.onLoanScheduleTypeChange(LOAN_SCHEDULE_TYPE.CUMULATIVE);

      const product = component.product();
      expect(product.enableIncomeCapitalization).toBeUndefined();
      expect(product.capitalizedIncomeType).toBeUndefined();
      expect(product.capitalizedIncomeStrategy).toBeUndefined();
      expect(product.enableBuyDownFee).toBeUndefined();
      expect(product.buyDownFeeIncomeType).toBeUndefined();
      expect(product.buyDownFeeStrategy).toBeUndefined();
      expect(component.incomeCapitalizationEnabled()).toBe(false);
      expect(component.buyDownFeeEnabled()).toBe(false);
    });

    it('reveals the buy-down detail fields only once it is on', () => {
      component.onLoanScheduleTypeChange(LOAN_SCHEDULE_TYPE.PROGRESSIVE);
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="loan-product-buy-down-fee-income-type"]',
        ),
      ).toBeNull();

      component.onEnableBuyDownFeeChange(true);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="loan-product-buy-down-fee-income-type"]',
        ),
      ).not.toBeNull();
    });
  });

  describe('interest recalculation', () => {
    /**
     * `POST /loanproducts` documents the chain: the compounding method, reschedule strategy and
     * rest frequency are mandatory once recalculation is on, and each interval applies only when
     * its frequency is something other than the repayment period. Before this, the flag was a
     * hardcoded `false` with no control at all.
     */
    it('seeds the three mandatory fields when it is switched on', () => {
      component.onInterestRecalculationChange(true);

      const product = component.product();
      expect(product.isInterestRecalculationEnabled).toBe(true);
      expect(product.interestRecalculationCompoundingMethod).toBe(0);
      expect(product.rescheduleStrategyMethod).toBe(1);
      expect(product.recalculationRestFrequencyType).toBe(1);
    });

    it('hides the rest interval while the frequency matches the repayment period', () => {
      component.onInterestRecalculationChange(true);
      component.onRestFrequencyTypeChange(1); // same as repayment period

      expect(component.restIntervalApplies()).toBe(false);

      component.onRestFrequencyTypeChange(2); // daily

      expect(component.restIntervalApplies()).toBe(true);
    });

    it('drops a rest interval that no longer applies', () => {
      component.onInterestRecalculationChange(true);
      component.onRestFrequencyTypeChange(2);
      component.product().recalculationRestFrequencyInterval = 3;

      component.onRestFrequencyTypeChange(1);

      expect(component.product().recalculationRestFrequencyInterval).toBeUndefined();
    });

    it('treats a "none" compounding method as no compounding', () => {
      component.onInterestRecalculationChange(true);
      component.onCompoundingMethodChange(0);
      expect(component.compoundingSelected()).toBe(false);

      component.onCompoundingMethodChange(1);
      expect(component.compoundingSelected()).toBe(true);
    });

    it('drops the compounding settings when the method goes back to none', () => {
      component.onInterestRecalculationChange(true);
      component.onCompoundingMethodChange(1);
      component.onCompoundingFrequencyTypeChange(2);
      component.product().recalculationCompoundingFrequencyInterval = 2;

      component.onCompoundingMethodChange(0);

      expect(component.product().recalculationCompoundingFrequencyType).toBeUndefined();
      expect(component.product().recalculationCompoundingFrequencyInterval).toBeUndefined();
    });

    it('needs a compounding interval only when compounding is on and not per repayment period', () => {
      component.onInterestRecalculationChange(true);
      component.onCompoundingMethodChange(1);

      component.onCompoundingFrequencyTypeChange(1);
      expect(component.compoundingIntervalApplies()).toBe(false);

      component.onCompoundingFrequencyTypeChange(2);
      expect(component.compoundingIntervalApplies()).toBe(true);
    });

    it('clears the whole group when it is switched off', () => {
      component.onInterestRecalculationChange(true);
      component.onCompoundingMethodChange(1);
      component.onCompoundingFrequencyTypeChange(2);
      component.product().preClosureInterestCalculationStrategy = 1;

      component.onInterestRecalculationChange(false);

      const product = component.product();
      expect(product.isInterestRecalculationEnabled).toBe(false);
      expect(product.interestRecalculationCompoundingMethod).toBeUndefined();
      expect(product.rescheduleStrategyMethod).toBeUndefined();
      expect(product.recalculationRestFrequencyType).toBeUndefined();
      expect(product.recalculationCompoundingFrequencyType).toBeUndefined();
      expect(product.preClosureInterestCalculationStrategy).toBeUndefined();
      expect(component.interestRecalculationEnabled()).toBe(false);
    });

    /**
     * Fineract rejects recalculation alongside any interest calculation period other than daily
     * with `not.supported.for.selected.interest.calculation.type`, and the form's own default is
     * one of the rejected values — so enabling it used to build a product the server refused.
     */
    it('forces daily interest calculation, which is the only period Fineract supports with it', () => {
      expect(component.product().interestCalculationPeriodType).toBe(1);

      component.onInterestRecalculationChange(true);

      expect(component.product().interestCalculationPeriodType).toBe(0);
    });

    it('explains why the interest calculation period is locked', () => {
      component.onInterestRecalculationChange(true);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="interest-calc-period-locked-note"]'),
      ).not.toBeNull();
    });

    it('renders its controls only once it is on', () => {
      expect(
        fixture.nativeElement.querySelector('[data-testid="loan-product-compounding-method"]'),
      ).toBeNull();

      component.onInterestRecalculationChange(true);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="loan-product-compounding-method"]'),
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="loan-product-reschedule-strategy"]'),
      ).not.toBeNull();
    });
  });

  describe('option lists', () => {
    /** These come from the product template; an earlier revision held them as local constants. */
    it('takes the income-recognition options from the template', () => {
      expect(component.capitalizedIncomeTypeOptions()).toHaveLength(2);
      expect(component.capitalizedIncomeStrategyOptions()[0].value).toBe(EQUAL_AMORTIZATION_LABEL);
      expect(component.chargeOffBehaviourOptions()).toHaveLength(2);
      expect(component.repaymentStartDateTypeOptions()).toHaveLength(1);
    });
  });

  describe('editing an existing product', () => {
    /**
     * The payload is rebuilt field by field, so anything the form does not name is dropped on
     * save. Opening a product configured with tranches or a down payment and pressing Save used
     * to remove both silently.
     */
    it('carries the disbursement and down payment settings through the load', async () => {
      await setup('7');
      productServiceSpy.getLoanproductsProductId.mockReturnValue(
        of({
          name: 'Asset Finance',
          shortName: 'AF',
          currency: { code: 'USD', decimalPlaces: 2 },
          loanScheduleType: { code: LOAN_SCHEDULE_TYPE.PROGRESSIVE, value: 'Progressive' },
          transactionProcessingStrategyCode: ADVANCED_PAYMENT_ALLOCATION_STRATEGY,
          multiDisburseLoan: true,
          maxTrancheCount: 3,
          disallowExpectedDisbursements: true,
          allowFullTermForTranche: true,
          enableDownPayment: true,
          disbursedAmountPercentageForDownPayment: 20,
          enableAutoRepaymentForDownPayment: true,
          enableIncomeCapitalization: true,
          capitalizedIncomeType: { code: 'INTEREST', value: 'Interest' },
          capitalizedIncomeCalculationType: { code: 'FLAT', value: 'Flat' },
          capitalizedIncomeStrategy: {
            code: 'EQUAL_AMORTIZATION',
            value: EQUAL_AMORTIZATION_LABEL,
          },
          enableBuyDownFee: true,
          buyDownFeeIncomeType: { code: 'FEE', value: 'Fee' },
          buyDownFeeCalculationType: { code: 'FLAT', value: 'Flat' },
          buyDownFeeStrategy: { code: 'EQUAL_AMORTIZATION', value: EQUAL_AMORTIZATION_LABEL },
        }) as any,
      );

      component.loadProductData();

      const product = component.product();
      expect(product.multiDisburseLoan).toBe(true);
      expect(product.maxTrancheCount).toBe(3);
      expect(product.disallowExpectedDisbursements).toBe(true);
      expect(product.allowFullTermForTranche).toBe(true);
      expect(product.enableDownPayment).toBe(true);
      expect(product.disbursedAmountPercentageForDownPayment).toBe(20);
      expect(product.enableAutoRepaymentForDownPayment).toBe(true);
      // The response wraps these as `{ code, value }`; the request takes the bare code.
      expect(product.enableIncomeCapitalization).toBe(true);
      expect(product.capitalizedIncomeType).toBe('INTEREST');
      expect(product.capitalizedIncomeStrategy).toBe('EQUAL_AMORTIZATION');
      expect(product.enableBuyDownFee).toBe(true);
      expect(product.buyDownFeeIncomeType).toBe('FEE');
      expect(component.incomeCapitalizationEnabled()).toBe(true);
      expect(component.buyDownFeeEnabled()).toBe(true);
    });
  });
  describe('accounting', () => {
    /** Fills every slot the rule requires, the way a user working down the section would. */
    function fillMappings(rule: number): void {
      component.product().accountingRule = rule;
      const byType: Record<string, number> = {
        asset: 11,
        liability: 12,
        income: 13,
        expense: 14,
      };
      const mappings: Record<string, number> = {};
      for (const field of LOAN_ACCOUNTING_FIELDS) {
        if (field.rules.includes(rule as never)) mappings[field.key] = byType[field.accountType];
      }
      component.accountingMappings.set(mappings);
    }

    it('defaults to NONE, so behaviour is unchanged until a rule is chosen', () => {
      expect(component.product().accountingRule).toBe(ACCOUNTING_RULE.NONE);
      expect(component.accountingMappings()).toEqual({});
    });

    it('reads the account options and rule labels off the template', () => {
      // Hardcoding either would break on every tenant but the one it was written against.
      expect(component.accountingRuleOptions().map((option) => option.id)).toEqual([1, 2, 3, 4]);
      expect(
        Array.from(component.accountingMappingOptions().assetAccountOptions ?? []).map((a) => a.id),
      ).toEqual([11]);
    });

    it('submits no mapping keys under NONE', () => {
      productServiceSpy.postLoanproducts.mockReturnValue(of({}) as never);

      component.onSubmit();

      const body = productServiceSpy.postLoanproducts.mock.lastCall![0] as Record<string, unknown>;
      expect(body['accountingRule']).toBe(ACCOUNTING_RULE.NONE);
      expect(Object.keys(body).filter((key) => key.endsWith('AccountId'))).toEqual([]);
    });

    it('submits the nine slots cash accounting requires', () => {
      productServiceSpy.postLoanproducts.mockReturnValue(of({}) as never);
      fillMappings(ACCOUNTING_RULE.CASH);

      component.onSubmit();

      const body = productServiceSpy.postLoanproducts.mock.lastCall![0] as Record<string, unknown>;
      expect(body['fundSourceAccountId']).toBe(11);
      expect(body['overpaymentLiabilityAccountId']).toBe(12);
      expect(body['incomeFromRecoveryAccountId']).toBe(13);
      expect(body['writeOffAccountId']).toBe(14);
      expect(body['receivableInterestAccountId']).toBeUndefined();
    });

    it('adds the receivables under accrual', () => {
      productServiceSpy.postLoanproducts.mockReturnValue(of({}) as never);
      fillMappings(ACCOUNTING_RULE.ACCRUAL_PERIODIC);

      component.onSubmit();

      const body = productServiceSpy.postLoanproducts.mock.lastCall![0] as Record<string, unknown>;
      expect(body['receivableInterestAccountId']).toBe(11);
      expect(body['receivableFeeAccountId']).toBe(11);
      expect(body['receivablePenaltyAccountId']).toBe(11);
    });

    it('does not send the down-payment auto-repayment flag while down payment is off', () => {
      productServiceSpy.postLoanproducts.mockReturnValue(of({}) as never);
      component.product().enableDownPayment = false;
      component.product().enableAutoRepaymentForDownPayment = false;

      component.onSubmit();

      // The platform refuses the pair outright on update, which made every loan product without
      // down payment unsaveable from the edit screen.
      const body = productServiceSpy.postLoanproducts.mock.lastCall![0] as Record<string, unknown>;
      expect('enableAutoRepaymentForDownPayment' in body).toBe(false);
    });

    it('keeps the flag once down payment is on', () => {
      productServiceSpy.postLoanproducts.mockReturnValue(of({}) as never);
      component.product().enableDownPayment = true;
      component.product().enableAutoRepaymentForDownPayment = true;

      component.onSubmit();

      const body = productServiceSpy.postLoanproducts.mock.lastCall![0] as Record<string, unknown>;
      expect(body['enableAutoRepaymentForDownPayment']).toBe(true);
    });

    it('populates the mappings of a product opened for editing', async () => {
      await setup('7');
      productServiceSpy.getLoanproductsProductId.mockReturnValue(
        of({
          name: 'Configured',
          currency: { code: 'USD', decimalPlaces: 2 },
          accountingRule: { id: 3, value: 'ACCRUAL PERIODIC' },
          accountingMappings: {
            fundSourceAccount: { id: 11, name: LOAN_PORTFOLIO },
            overpaymentLiabilityAccount: { id: 12, name: 'Overpayment' },
            receivableFeeAccount: { id: 11, name: LOAN_PORTFOLIO },
          },
        }) as never,
      );
      component.loadProductData();

      expect(component.product().accountingRule).toBe(ACCOUNTING_RULE.ACCRUAL_PERIODIC);
      expect(component.accountingMappings()).toEqual({
        fundSourceAccountId: 11,
        overpaymentLiabilityAccountId: 12,
        receivableFeeAccountId: 11,
      });
    });

    it("carries a configured product's mappings back out on save", async () => {
      await setup('7');
      productServiceSpy.getLoanproductsProductId.mockReturnValue(
        of({
          name: 'Configured',
          currency: { code: 'USD', decimalPlaces: 2 },
          accountingRule: { id: 2, value: 'CASH BASED' },
          accountingMappings: {
            fundSourceAccount: { id: 11 },
            loanPortfolioAccount: { id: 11 },
            transfersInSuspenseAccount: { id: 11 },
            interestOnLoanAccount: { id: 13 },
            incomeFromFeeAccount: { id: 13 },
            incomeFromPenaltyAccount: { id: 13 },
            incomeFromRecoveryAccount: { id: 13 },
            writeOffAccount: { id: 14 },
            overpaymentLiabilityAccount: { id: 12 },
          },
        }) as never,
      );
      component.loadProductData();
      productServiceSpy.putLoanproductsProductId.mockReturnValue(of({}) as never);

      // Opening a product, changing one unrelated field and saving must not blank the ledger.
      component.product().name = 'Renamed';
      component.onSubmit();

      const body = productServiceSpy.putLoanproductsProductId.mock.lastCall![1] as Record<
        string,
        unknown
      >;
      expect(body['name']).toBe('Renamed');
      expect(Object.keys(body).filter((key) => key.endsWith('AccountId'))).toHaveLength(9);
      expect(body['fundSourceAccountId']).toBe(11);
    });
  });
});
