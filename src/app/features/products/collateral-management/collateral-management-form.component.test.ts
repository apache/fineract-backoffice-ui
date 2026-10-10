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
import { CollateralManagementFormComponent } from './collateral-management-form.component';
import { CollateralManagementService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('CollateralManagementFormComponent', () => {
  let component: CollateralManagementFormComponent;
  let fixture: ComponentFixture<CollateralManagementFormComponent>;
  let serviceSpy: SpyObj<CollateralManagementService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getCollateralManagementTemplate',
      'getCollateralManagementCollateralId',
      'postCollateralManagement',
      'putCollateralManagementCollateralId',
    ]);
    routerSpy = createSpyObj(['navigate']);
    serviceSpy.getCollateralManagementTemplate.mockReturnValue(
      of([{ code: 'USD', name: 'US Dollar' }]) as unknown as ReturnType<
        CollateralManagementService['getCollateralManagementTemplate']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [CollateralManagementFormComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: CollateralManagementService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CollateralManagementFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load currency options on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getCollateralManagementTemplate).toHaveBeenCalled();
    expect(component.currencyOptions()).toHaveLength(1);
  });

  // Regression coverage for #626: the currency dropdown had no search and forced users to
  // scroll a long, alphabetical, API-backed list to find one entry.
  it('exposes the currency template as searchable-select options', () => {
    expect(component.currencySelectOptions()).toEqual([{ value: 'USD', label: 'US Dollar (USD)' }]);
  });

  it('renders the currency field as a searchable select rather than a plain ion-select', () => {
    expect(fixture.nativeElement.querySelector('ion-select')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="collateral-currency-select"]'),
    ).not.toBeNull();
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postCollateralManagement.mockReturnValue(
      of({}) as unknown as ReturnType<CollateralManagementService['postCollateralManagement']>,
    );
    component.collateral.set({
      name: 'Gold',
      quality: 'High',
      unitType: 'Gram',
      basePrice: 1000,
      pctToBase: 80,
      currency: 'USD',
      locale: 'en',
    });
    component.onSubmit();
    expect(serviceSpy.postCollateralManagement).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/collateral-management']);
  });
});
