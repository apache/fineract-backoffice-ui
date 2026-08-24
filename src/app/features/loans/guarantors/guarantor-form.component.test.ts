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
import { GuarantorFormComponent } from './guarantor-form.component';
import { GuarantorsService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('GuarantorFormComponent', () => {
  let component: GuarantorFormComponent;
  let fixture: ComponentFixture<GuarantorFormComponent>;
  let serviceSpy: SpyObj<GuarantorsService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getLoansLoanIdGuarantorsTemplate',
      'getLoansLoanIdGuarantorsGuarantorId',
      'postLoansLoanIdGuarantors',
      'putLoansLoanIdGuarantorsGuarantorId',
    ]);
    routerSpy = createSpyObj(['navigate']);
    serviceSpy.getLoansLoanIdGuarantorsTemplate.mockReturnValue(
      of({
        guarantorTypeOptions: [{ id: 1, code: 'customer', value: 'Customer' }],
      }) as unknown as ReturnType<GuarantorsService['getLoansLoanIdGuarantorsTemplate']>,
    );

    await TestBed.configureTestingModule({
      imports: [GuarantorFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: GuarantorsService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ loanId: '1' }) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GuarantorFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load template options on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getLoansLoanIdGuarantorsTemplate).toHaveBeenCalledWith(1);
    expect(component.guarantorTypeOptions()).toHaveLength(1);
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postLoansLoanIdGuarantors.mockReturnValue(
      of({}) as unknown as ReturnType<GuarantorsService['postLoansLoanIdGuarantors']>,
    );
    component.guarantor.set({ guarantorTypeId: 1, firstname: 'John', lastname: 'Doe' });
    component.onSubmit();
    expect(serviceSpy.postLoansLoanIdGuarantors).toHaveBeenCalledWith(1, {
      ...component.guarantor(),
      locale: 'en',
      dateFormat: 'dd MMMM yyyy',
    });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/loans', 1, 'guarantors']);
  });
});
