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
import { WcLoanProductFormComponent } from './wc-loan-product-form.component';
import { WorkingCapitalLoanProductsService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('WcLoanProductFormComponent', () => {
  let component: WcLoanProductFormComponent;
  let fixture: ComponentFixture<WcLoanProductFormComponent>;
  let serviceSpy: jasmine.SpyObj<WorkingCapitalLoanProductsService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('WorkingCapitalLoanProductsService', [
      'getWorkingCapitalLoanProductsTemplate',
      'getWorkingCapitalLoanProductsProductId',
      'postWorkingCapitalLoanProducts',
      'putWorkingCapitalLoanProductsProductId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    serviceSpy.getWorkingCapitalLoanProductsTemplate.and.returnValue(
      of({
        currencyOptions: [{ code: 'USD', name: 'US Dollar' }],
        amortizationTypeOptions: [{ id: '1', code: 'FLAT', value: 'Flat' }],
        periodFrequencyTypeOptions: [{ id: '2', code: 'MONTHS', value: 'Months' }],
      }) as unknown as ReturnType<
        WorkingCapitalLoanProductsService['getWorkingCapitalLoanProductsTemplate']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [WcLoanProductFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: WorkingCapitalLoanProductsService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WcLoanProductFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load template options on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getWorkingCapitalLoanProductsTemplate).toHaveBeenCalled();
    expect(component.currencyOptions()).toHaveSize(1);
    expect(component.amortizationTypeOptions()).toHaveSize(1);
    expect(component.repaymentFrequencyTypeOptions()).toHaveSize(1);
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postWorkingCapitalLoanProducts.and.returnValue(
      of({}) as unknown as ReturnType<
        WorkingCapitalLoanProductsService['postWorkingCapitalLoanProducts']
      >,
    );
    component.product.set({
      name: 'New Product',
      shortName: 'NP',
      currencyCode: 'USD',
      digitsAfterDecimal: 2,
      principal: 1000,
      periodPaymentRate: 5,
      repaymentEvery: 1,
      npvDayCount: 365,
    });
    component.onSubmit();
    expect(serviceSpy.postWorkingCapitalLoanProducts).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/working-capital/loan-products']);
  });
});
