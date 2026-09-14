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
import { LoanProductQuickCreateDialogComponent } from './loan-product-quick-create-dialog.component';
import { ModalController } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { LoanProductsService, PostLoanProductsResponse } from '../../api';
import { NotificationService } from '../../core/services/notification.service';
import { LOAN_SCHEDULE_TYPE } from './loan-schedule-type';
import { of, throwError } from 'rxjs';

describe('LoanProductQuickCreateDialogComponent', () => {
  let component: LoanProductQuickCreateDialogComponent;
  let fixture: ComponentFixture<LoanProductQuickCreateDialogComponent>;
  let mockModalController: SpyObj<ModalController>;
  let mockLoanProductsService: SpyObj<LoanProductsService>;
  let mockNotificationService: SpyObj<NotificationService>;

  beforeEach(async () => {
    mockModalController = createSpyObj<ModalController>(['dismiss']);
    mockLoanProductsService = createSpyObj<LoanProductsService>(['postLoanproducts']);
    mockNotificationService = createSpyObj<NotificationService>(['error']);

    await TestBed.configureTestingModule({
      imports: [LoanProductQuickCreateDialogComponent, TranslateModule.forRoot()],
      providers: [
        provideIonicTesting(),
        { provide: ModalController, useValue: mockModalController },
        { provide: LoanProductsService, useValue: mockLoanProductsService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanProductQuickCreateDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should close dialog on cancel', () => {
    component.onCancel();
    expect(mockModalController.dismiss).toHaveBeenCalled();
  });

  it('should not submit when required fields are empty', () => {
    component.name = '';
    component.shortName = '';
    component.principal = null;
    component.interestRatePerPeriod = null;
    component.numberOfRepayments = null;
    component.repaymentEvery = null;

    component.onSubmit();

    expect(mockLoanProductsService.postLoanproducts).not.toHaveBeenCalled();
    expect(mockModalController.dismiss).not.toHaveBeenCalled();
  });

  it('should submit postLoanproducts with 6 form values merged with fixed defaults and dismiss modal on success', () => {
    const mockResponse: PostLoanProductsResponse = { resourceId: 42 };
    mockLoanProductsService.postLoanproducts.mockReturnValue(of(mockResponse));

    component.name = 'Quick Loan Product';
    component.shortName = 'QLP';
    component.principal = 10000;
    component.interestRatePerPeriod = 5;
    component.numberOfRepayments = 12;
    component.repaymentEvery = 1;

    component.onSubmit();

    expect(mockLoanProductsService.postLoanproducts).toHaveBeenCalledWith({
      name: 'Quick Loan Product',
      shortName: 'QLP',
      principal: 10000,
      interestRatePerPeriod: 5,
      numberOfRepayments: 12,
      repaymentEvery: 1,

      currencyCode: 'USD',
      digitsAfterDecimal: 2,
      inMultiplesOf: 0,
      repaymentFrequencyType: 2,
      interestRateFrequencyType: 3,
      amortizationType: 1,
      interestType: 0,
      interestCalculationPeriodType: 1,
      loanScheduleType: LOAN_SCHEDULE_TYPE.CUMULATIVE,
      transactionProcessingStrategyCode: 'mifos-standard-strategy',
      accountingRule: 1,
      daysInYearType: 1,
      daysInMonthType: 1,
      isInterestRecalculationEnabled: false,
      locale: 'en',
    });

    expect(mockModalController.dismiss).toHaveBeenCalledWith({ id: 42, resourceId: 42 });
  });

  it('should show error notification, keep modal open, and preserve form values when submit fails', () => {
    mockLoanProductsService.postLoanproducts.mockReturnValue(
      throwError(() => new Error('Creation failed')),
    );

    component.name = 'Failed Product';
    component.shortName = 'FP';
    component.principal = 5000;
    component.interestRatePerPeriod = 10;
    component.numberOfRepayments = 6;
    component.repaymentEvery = 1;

    component.onSubmit();

    expect(mockLoanProductsService.postLoanproducts).toHaveBeenCalled();
    expect(mockNotificationService.error).toHaveBeenCalledWith(
      'Operation failed. Please try again.',
    );
    expect(mockModalController.dismiss).not.toHaveBeenCalled();
    expect(component.isSaving()).toBe(false);

    // Verify form values are preserved
    expect(component.name).toBe('Failed Product');
    expect(component.shortName).toBe('FP');
    expect(component.principal).toBe(5000);
    expect(component.interestRatePerPeriod).toBe(10);
    expect(component.numberOfRepayments).toBe(6);
    expect(component.repaymentEvery).toBe(1);
  });
});
