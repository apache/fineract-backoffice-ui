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
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WcLoanFormComponent } from './wc-loan-form.component';
import { WorkingCapitalLoansService } from '../../../api';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('WcLoanFormComponent', () => {
  let component: WcLoanFormComponent;
  let fixture: ComponentFixture<WcLoanFormComponent>;
  let serviceSpy: SpyObj<WorkingCapitalLoansService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getWorkingCapitalLoansTemplate',
      'postWorkingCapitalLoans',
    ]);
    routerSpy = createSpyObj(['navigate']);
    serviceSpy.getWorkingCapitalLoansTemplate.mockReturnValue(
      of({
        productOptions: [{ id: 1, name: 'WC Product' }],
        breachOptions: [{ id: 2, name: 'Covenant A' }],
        periodFrequencyTypeOptions: [{ id: '0', code: 'DAYS', value: 'Days' }],
      }) as unknown as ReturnType<WorkingCapitalLoansService['getWorkingCapitalLoansTemplate']>,
    );

    await TestBed.configureTestingModule({
      imports: [WcLoanFormComponent, provideTranslateTesting()],
      providers: [
        { provide: WorkingCapitalLoansService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WcLoanFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load template options on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getWorkingCapitalLoansTemplate).toHaveBeenCalled();
    expect(component.productOptions()).toHaveLength(1);
    expect(component.breachOptions()).toHaveLength(1);
    expect(component.repaymentFrequencyTypeOptions()).toHaveLength(1);
  });

  it('should post on submit and navigate to the list', () => {
    serviceSpy.postWorkingCapitalLoans.mockReturnValue(
      of({}) as unknown as ReturnType<WorkingCapitalLoansService['postWorkingCapitalLoans']>,
    );
    component.loan = { clientId: 7, productId: 1, principalAmount: 5000 };
    component.onSubmit();
    expect(serviceSpy.postWorkingCapitalLoans).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/working-capital/loans']);
  });

  it('should format provided dates into the request', () => {
    serviceSpy.postWorkingCapitalLoans.mockReturnValue(
      of({}) as unknown as ReturnType<WorkingCapitalLoansService['postWorkingCapitalLoans']>,
    );
    component.loan = { clientId: 7, productId: 1, principalAmount: 5000 };
    component.submittedOnDate = '2026-01-15';
    component.onSubmit();
    const arg = serviceSpy.postWorkingCapitalLoans.mock.lastCall![0];
    expect(arg.submittedOnDate).toBe('15 January 2026');
    expect(arg.locale).toBe('en');
  });
});
