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
import { PaymentTypeFormComponent } from './payment-type-form.component';
import { PaymentTypeService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('PaymentTypeFormComponent', () => {
  let component: PaymentTypeFormComponent;
  let fixture: ComponentFixture<PaymentTypeFormComponent>;
  let paymentTypeServiceSpy: SpyObj<PaymentTypeService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    paymentTypeServiceSpy = createSpyObj([
      'getPaymenttypesPaymentTypeId',
      'postPaymenttypes',
      'putPaymenttypesPaymentTypeId',
    ]);
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [PaymentTypeFormComponent, provideTranslateTesting()],
      providers: [
        { provide: PaymentTypeService, useValue: paymentTypeServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentTypeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create in add mode', () => {
    expect(component).toBeTruthy();
    expect(component.isEditMode()).toBe(false);
  });

  it('should post a new payment type on submit', () => {
    paymentTypeServiceSpy.postPaymenttypes.mockReturnValue(
      of({}) as unknown as ReturnType<PaymentTypeService['postPaymenttypes']>,
    );
    component.paymentType.set({
      name: 'Mobile Money',
      description: 'MoMo',
      position: 3,
      isCashPayment: false,
      isSystemDefined: false,
    });

    component.onSubmit();

    expect(paymentTypeServiceSpy.postPaymenttypes).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Mobile Money', isSystemDefined: false }),
    );
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/organization/payment-types']);
  });
});
