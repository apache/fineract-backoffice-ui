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
import { SavingsChargeFormComponent } from './savings-charge-form.component';
import { SavingsChargesService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('SavingsChargeFormComponent', () => {
  let component: SavingsChargeFormComponent;
  let fixture: ComponentFixture<SavingsChargeFormComponent>;
  let serviceSpy: SpyObj<SavingsChargesService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getSavingsaccountsSavingsAccountIdChargesTemplate',
      'postSavingsaccountsSavingsAccountIdCharges',
    ]);
    routerSpy = createSpyObj(['navigate']);
    serviceSpy.getSavingsaccountsSavingsAccountIdChargesTemplate.mockReturnValue(
      of({
        chargeOptions: [{ id: 1, name: 'Withdrawal Fee' }],
      }) as unknown as ReturnType<
        SavingsChargesService['getSavingsaccountsSavingsAccountIdChargesTemplate']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [SavingsChargeFormComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: SavingsChargesService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ savingsAccountId: '1' }) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SavingsChargeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load charge options on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getSavingsaccountsSavingsAccountIdChargesTemplate).toHaveBeenCalledWith(1);
    expect(component.chargeOptions()).toHaveLength(1);
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postSavingsaccountsSavingsAccountIdCharges.mockReturnValue(
      of({}) as unknown as ReturnType<
        SavingsChargesService['postSavingsaccountsSavingsAccountIdCharges']
      >,
    );
    component.charge = { chargeId: 1, amount: 10 };
    component.onSubmit();
    expect(serviceSpy.postSavingsaccountsSavingsAccountIdCharges).toHaveBeenCalled();
    const [accountId, request] =
      serviceSpy.postSavingsaccountsSavingsAccountIdCharges.mock.lastCall!;
    expect(accountId).toBe(1);
    expect(request.chargeId).toBe(1);
    expect(request.amount).toBe(10);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/savings-accounts', 1, 'charges']);
  });
});
