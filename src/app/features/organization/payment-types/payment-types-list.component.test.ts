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
import { PaymentTypesListComponent } from './payment-types-list.component';
import { PaymentTypeService } from '../../../api';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('PaymentTypesListComponent', () => {
  let component: PaymentTypesListComponent;
  let fixture: ComponentFixture<PaymentTypesListComponent>;
  let paymentTypeServiceSpy: SpyObj<PaymentTypeService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    paymentTypeServiceSpy = createSpyObj([
      'getPaymenttypes',
      'deletePaymenttypesPaymentTypeId',
    ]);
    routerSpy = createSpyObj(['navigate']);
    paymentTypeServiceSpy.getPaymenttypes.mockReturnValue(
      of([
        { id: 1, name: 'Cash', isCashPayment: true, isSystemDefined: false },
      ]) as unknown as ReturnType<PaymentTypeService['getPaymenttypes']>,
    );

    await TestBed.configureTestingModule({
      imports: [PaymentTypesListComponent, provideTranslateTesting()],
      providers: [
        { provide: PaymentTypeService, useValue: paymentTypeServiceSpy },
        { provide: Router, useValue: routerSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentTypesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load payment types on init', () => {
    expect(component).toBeTruthy();
    expect(paymentTypeServiceSpy.getPaymenttypes).toHaveBeenCalled();
    expect(component.paymentTypes()).toHaveLength(1);
  });

  it('should delete after confirmation and reload', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    paymentTypeServiceSpy.deletePaymenttypesPaymentTypeId.mockReturnValue(
      of({}) as unknown as ReturnType<PaymentTypeService['deletePaymenttypesPaymentTypeId']>,
    );

    component.onDelete({ id: 5, name: 'Cheque' });

    expect(paymentTypeServiceSpy.deletePaymenttypesPaymentTypeId).toHaveBeenCalledWith(5);
    expect(paymentTypeServiceSpy.getPaymenttypes).toHaveBeenCalledTimes(2);
  });

  it('should not delete when cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.onDelete({ id: 5, name: 'Cheque' });
    expect(paymentTypeServiceSpy.deletePaymenttypesPaymentTypeId).not.toHaveBeenCalled();
  });
});
