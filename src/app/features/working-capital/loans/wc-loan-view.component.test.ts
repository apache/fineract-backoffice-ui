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

import { WcLoanViewComponent } from './wc-loan-view.component';

import {
  WorkingCapitalLoansService,
  WorkingCapitalLoanChargesService,
  WorkingCapitalLoanTransactionsService,
  WorkingCapitalLoanDelinquencyActionsService,
  WorkingCapitalLoanDelinquencyRangeScheduleService,
  WorkingCapitalLoanBreachScheduleService,
  WorkingCapitalLoanBreachActionsService,
  WorkingCapitalLoanNearBreachActionsService,
  WorkingCapitalLoanOriginatorsService,
  LoanOriginatorsService,
} from '../../../api';

import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { createSpyObj, SpyObj } from '../../../testing/mocks';

describe('WcLoanViewComponent', () => {
  let component: WcLoanViewComponent;
  let fixture: ComponentFixture<WcLoanViewComponent>;

  let loansSpy: SpyObj<WorkingCapitalLoansService>;
  let chargesSpy: SpyObj<WorkingCapitalLoanChargesService>;
  let transactionsSpy: SpyObj<WorkingCapitalLoanTransactionsService>;
  let delinquencyActionsSpy: SpyObj<WorkingCapitalLoanDelinquencyActionsService>;
  let delinquencyRangeSpy: SpyObj<WorkingCapitalLoanDelinquencyRangeScheduleService>;
  let breachScheduleSpy: SpyObj<WorkingCapitalLoanBreachScheduleService>;
  let breachActionsSpy: SpyObj<WorkingCapitalLoanBreachActionsService>;
  let nearBreachActionsSpy: SpyObj<WorkingCapitalLoanNearBreachActionsService>;
  let wcOriginatorsSpy: SpyObj<WorkingCapitalLoanOriginatorsService>;
  let originatorsSpy: SpyObj<LoanOriginatorsService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    loansSpy = createSpyObj<WorkingCapitalLoansService>([
      'getWorkingCapitalLoansLoanId',
      'getWorkingCapitalLoansLoanIdRateChanges',
      'getWorkingCapitalLoansLoanIdAmortizationSchedule',
      'getWorkingCapitalLoansLoanIdDelinquencyrangetags',
    ]);

    chargesSpy = createSpyObj<WorkingCapitalLoanChargesService>([
      'getWorkingCapitalLoansLoanIdCharges',
    ]);

    transactionsSpy = createSpyObj<WorkingCapitalLoanTransactionsService>([
      'getWorkingCapitalLoansLoanIdTransactions',
    ]);

    delinquencyActionsSpy =
      createSpyObj<WorkingCapitalLoanDelinquencyActionsService>([
        'getWorkingCapitalLoansLoanIdDelinquencyActions',
      ]);

    delinquencyRangeSpy =
      createSpyObj<WorkingCapitalLoanDelinquencyRangeScheduleService>([
        'getWorkingCapitalLoansLoanIdDelinquencyRangeSchedule',
      ]);

    breachScheduleSpy =
      createSpyObj<WorkingCapitalLoanBreachScheduleService>([
        'getWorkingCapitalLoansLoanIdBreachSchedule',
      ]);

    breachActionsSpy =
      createSpyObj<WorkingCapitalLoanBreachActionsService>([
        'getWorkingCapitalLoansLoanIdBreachActions',
      ]);

    nearBreachActionsSpy =
      createSpyObj<WorkingCapitalLoanNearBreachActionsService>([
        'getWorkingCapitalLoansLoanIdNearBreachActions',
      ]);

    wcOriginatorsSpy =
      createSpyObj<WorkingCapitalLoanOriginatorsService>([
        'getWorkingCapitalLoansLoanIdOriginators',
        'postWorkingCapitalLoansLoanIdOriginatorsOriginatorId',
        'deleteWorkingCapitalLoansLoanIdOriginatorsOriginatorId',
      ]);

    originatorsSpy = createSpyObj<LoanOriginatorsService>([
      'getLoanOriginators',
    ]);

    routerSpy = createSpyObj<Router>(['navigate']);

    loansSpy.getWorkingCapitalLoansLoanId.mockReturnValue(
      of({
        id: 1,
        accountNo: '000001',
        client: {
          id: 7,
          displayName: 'Acme Ltd',
        },
        status: {
          value: 'Active',
        },
      }) as unknown as ReturnType<
        WorkingCapitalLoansService['getWorkingCapitalLoansLoanId']
      >,
    );

    loansSpy.getWorkingCapitalLoansLoanIdRateChanges.mockReturnValue(
      of([
        {
          id: 1,
          effectiveDate: '01 January 2026',
          previousRate: 5,
          newRate: 6,
        },
      ]) as unknown as ReturnType<
        WorkingCapitalLoansService['getWorkingCapitalLoansLoanIdRateChanges']
      >,
    );

    loansSpy.getWorkingCapitalLoansLoanIdAmortizationSchedule.mockReturnValue(
      of({
        periodPaymentRate: 5,
        netDisbursementAmount: 9800,
        payments: [],
      }) as unknown as ReturnType<
        WorkingCapitalLoansService['getWorkingCapitalLoansLoanIdAmortizationSchedule']
      >,
    );

    loansSpy.getWorkingCapitalLoansLoanIdDelinquencyrangetags.mockReturnValue(
      of([
        {
          id: 1,
          periodNumber: 1,
          delinquentDays: 5,
        },
      ]) as unknown as ReturnType<
        WorkingCapitalLoansService['getWorkingCapitalLoansLoanIdDelinquencyrangetags']
      >,
    );

    chargesSpy.getWorkingCapitalLoansLoanIdCharges.mockReturnValue(
      of([
        {
          id: 1,
          name: 'Fee',
          amount: 100,
        },
      ]) as unknown as ReturnType<
        WorkingCapitalLoanChargesService['getWorkingCapitalLoansLoanIdCharges']
      >,
    );

    transactionsSpy.getWorkingCapitalLoansLoanIdTransactions.mockReturnValue(
      of({
        content: [
          {
            id: 1,
            transactionAmount: 500,
          },
        ],
      }) as unknown as ReturnType<
        WorkingCapitalLoanTransactionsService['getWorkingCapitalLoansLoanIdTransactions']
      >,
    );

    delinquencyActionsSpy.getWorkingCapitalLoansLoanIdDelinquencyActions.mockReturnValue(
      of([
        {
          id: 1,
          action: 'PAUSE',
        },
      ]) as unknown as ReturnType<
        WorkingCapitalLoanDelinquencyActionsService['getWorkingCapitalLoansLoanIdDelinquencyActions']
      >,
    );

    delinquencyRangeSpy.getWorkingCapitalLoansLoanIdDelinquencyRangeSchedule.mockReturnValue(
      of([
        {
          id: 1,
          periodNumber: 1,
        },
      ]) as unknown as ReturnType<
        WorkingCapitalLoanDelinquencyRangeScheduleService['getWorkingCapitalLoansLoanIdDelinquencyRangeSchedule']
      >,
    );

    breachScheduleSpy.getWorkingCapitalLoansLoanIdBreachSchedule.mockReturnValue(
      of([
        {
          id: 1,
          periodNumber: 1,
          breach: true,
        },
      ]) as unknown as ReturnType<
        WorkingCapitalLoanBreachScheduleService['getWorkingCapitalLoansLoanIdBreachSchedule']
      >,
    );

    breachActionsSpy.getWorkingCapitalLoansLoanIdBreachActions.mockReturnValue(
      of([
        {
          id: 1,
          action: 'PAUSE',
        },
      ]) as unknown as ReturnType<
        WorkingCapitalLoanBreachActionsService['getWorkingCapitalLoansLoanIdBreachActions']
      >,
    );

    nearBreachActionsSpy.getWorkingCapitalLoansLoanIdNearBreachActions.mockReturnValue(
      of([
        {
          id: 1,
          action: 'RESCHEDULE',
          threshold: 80,
        },
      ]) as unknown as ReturnType<
        WorkingCapitalLoanNearBreachActionsService['getWorkingCapitalLoansLoanIdNearBreachActions']
      >,
    );

    wcOriginatorsSpy.getWorkingCapitalLoansLoanIdOriginators.mockReturnValue(
      of({
        originators: [
          {
            id: 5,
            name: 'Acme Originator',
          },
        ],
      }) as unknown as ReturnType<
        WorkingCapitalLoanOriginatorsService['getWorkingCapitalLoansLoanIdOriginators']
      >,
    );

    wcOriginatorsSpy.postWorkingCapitalLoansLoanIdOriginatorsOriginatorId.mockReturnValue(
      of({}) as unknown as ReturnType<
        WorkingCapitalLoanOriginatorsService['postWorkingCapitalLoansLoanIdOriginatorsOriginatorId']
      >,
    );

    wcOriginatorsSpy.deleteWorkingCapitalLoansLoanIdOriginatorsOriginatorId.mockReturnValue(
      of({}) as unknown as ReturnType<
        WorkingCapitalLoanOriginatorsService['deleteWorkingCapitalLoansLoanIdOriginatorsOriginatorId']
      >,
    );

    originatorsSpy.getLoanOriginators.mockReturnValue(
      of([
        {
          id: 5,
          name: 'Acme Originator',
        },
        {
          id: 6,
          name: 'Other Originator',
        },
      ]) as unknown as ReturnType<
        LoanOriginatorsService['getLoanOriginators']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [WcLoanViewComponent, provideTranslateTesting()],
      providers: [
        {
          provide: WorkingCapitalLoansService,
          useValue: loansSpy,
        },
        {
          provide: WorkingCapitalLoanChargesService,
          useValue: chargesSpy,
        },
        {
          provide: WorkingCapitalLoanTransactionsService,
          useValue: transactionsSpy,
        },
        {
          provide: WorkingCapitalLoanDelinquencyActionsService,
          useValue: delinquencyActionsSpy,
        },
        {
          provide: WorkingCapitalLoanDelinquencyRangeScheduleService,
          useValue: delinquencyRangeSpy,
        },
        {
          provide: WorkingCapitalLoanBreachScheduleService,
          useValue: breachScheduleSpy,
        },
        {
          provide: WorkingCapitalLoanBreachActionsService,
          useValue: breachActionsSpy,
        },
        {
          provide: WorkingCapitalLoanNearBreachActionsService,
          useValue: nearBreachActionsSpy,
        },
        {
          provide: WorkingCapitalLoanOriginatorsService,
          useValue: wcOriginatorsSpy,
        },
        {
          provide: LoanOriginatorsService,
          useValue: originatorsSpy,
        },
        {
          provide: Router,
          useValue: routerSpy,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                id: '1',
              }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WcLoanViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load the loan and all tab data on init', () => {
    expect(component).toBeTruthy();
    expect(component.loanId).toBe(1);

    expect(
      loansSpy.getWorkingCapitalLoansLoanId,
    ).toHaveBeenCalledWith(1);

    expect(component.loan()?.accountNo).toBe('000001');

    expect(component.charges()).toHaveLength(1);
    expect(component.transactions()).toHaveLength(1);
    expect(component.delinquencyActions()).toHaveLength(1);
    expect(component.delinquencyRangeSchedule()).toHaveLength(1);
    expect(component.breachSchedule()).toHaveLength(1);
    expect(component.breachActions()).toHaveLength(1);
    expect(component.nearBreachActions()).toHaveLength(1);

    expect(component.originators()).toEqual([
      {
        id: 5,
        name: 'Acme Originator',
      },
    ]);
  });

  it('should navigate back to the list', () => {
    component.onBack();

    expect(routerSpy.navigate).toHaveBeenCalledWith([
      '/working-capital/loans',
    ]);
  });

  it('should navigate to the delinquency-action form', () => {
    component.onNewDelinquencyAction();

    expect(routerSpy.navigate).toHaveBeenCalledWith([
      '/working-capital/loans/1/delinquency-action',
    ]);
  });

  it('should navigate to the breach-action form', () => {
    component.onNewBreachAction();

    expect(routerSpy.navigate).toHaveBeenCalledWith([
      '/working-capital/loans/1/breach-action',
    ]);
  });

  it('should navigate to the near-breach-action form', () => {
    component.onNewNearBreachAction();

    expect(routerSpy.navigate).toHaveBeenCalledWith([
      '/working-capital/loans/1/near-breach-action',
    ]);
  });

  it('preselects the tab named in the ?tab query param', async () => {
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [WcLoanViewComponent, provideTranslateTesting()],
      providers: [
        {
          provide: WorkingCapitalLoansService,
          useValue: loansSpy,
        },
        {
          provide: WorkingCapitalLoanChargesService,
          useValue: chargesSpy,
        },
        {
          provide: WorkingCapitalLoanTransactionsService,
          useValue: transactionsSpy,
        },
        {
          provide: WorkingCapitalLoanDelinquencyActionsService,
          useValue: delinquencyActionsSpy,
        },
        {
          provide: WorkingCapitalLoanDelinquencyRangeScheduleService,
          useValue: delinquencyRangeSpy,
        },
        {
          provide: WorkingCapitalLoanBreachScheduleService,
          useValue: breachScheduleSpy,
        },
        {
          provide: WorkingCapitalLoanBreachActionsService,
          useValue: breachActionsSpy,
        },
        {
          provide: WorkingCapitalLoanNearBreachActionsService,
          useValue: nearBreachActionsSpy,
        },
        {
          provide: WorkingCapitalLoanOriginatorsService,
          useValue: wcOriginatorsSpy,
        },
        {
          provide: LoanOriginatorsService,
          useValue: originatorsSpy,
        },
        {
          provide: Router,
          useValue: routerSpy,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                id: '1',
              }),
              queryParamMap: convertToParamMap({
                tab: 'originators',
              }),
            },
          },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    const taggedFixture =
      TestBed.createComponent(WcLoanViewComponent);

    taggedFixture.detectChanges();

    expect(
      taggedFixture.componentInstance.activeTab(),
    ).toBe('originators');
  });

  it('attaches the selected originator and reloads the attached list', () => {
    component.originatorToAttach.set(6);
    component.onAttachOriginator();

    expect(
      wcOriginatorsSpy.postWorkingCapitalLoansLoanIdOriginatorsOriginatorId,
    ).toHaveBeenCalledWith(1, 6);

    expect(component.originatorToAttach()).toBeNull();

    expect(
      wcOriginatorsSpy.getWorkingCapitalLoansLoanIdOriginators,
    ).toHaveBeenCalledTimes(2);
  });

  it('does nothing when attaching without a selection', () => {
    component.originatorToAttach.set(null);
    component.onAttachOriginator();

    expect(
      wcOriginatorsSpy.postWorkingCapitalLoansLoanIdOriginatorsOriginatorId,
    ).not.toHaveBeenCalled();
  });

  it('detaches an originator after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.onDetachOriginator({
      id: 5,
      name: 'Acme Originator',
    });

    expect(
      wcOriginatorsSpy.deleteWorkingCapitalLoansLoanIdOriginatorsOriginatorId,
    ).toHaveBeenCalledWith(1, 5);
  });

  it('does not detach an originator when the confirmation is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.onDetachOriginator({
      id: 5,
      name: 'Acme Originator',
    });

    expect(
      wcOriginatorsSpy.deleteWorkingCapitalLoansLoanIdOriginatorsOriginatorId,
    ).not.toHaveBeenCalled();
  });

  it('excludes already-attached originators from the attachable list', () => {
    // The master list has originators 5 and 6; 5 is already attached
    // (per the default mock), so only 6 should be offered.
    expect(component.attachableOriginators()).toEqual([
      {
        id: 6,
        name: 'Other Originator',
      },
    ]);
  });
});