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
import { CollateralManagementFormComponent } from './collateral-management-form.component';
import { CollateralManagementService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('CollateralManagementFormComponent', () => {
  let component: CollateralManagementFormComponent;
  let fixture: ComponentFixture<CollateralManagementFormComponent>;
  let serviceSpy: jasmine.SpyObj<CollateralManagementService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('CollateralManagementService', [
      'getCollateralManagementTemplate',
      'getCollateralManagementCollateralId',
      'postCollateralManagement',
      'putCollateralManagementCollateralId',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    serviceSpy.getCollateralManagementTemplate.and.returnValue(
      of([{ code: 'USD', name: 'US Dollar' }]) as unknown as ReturnType<
        CollateralManagementService['getCollateralManagementTemplate']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [CollateralManagementFormComponent, TranslateModule.forRoot()],
      providers: [
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
    expect(component.currencyOptions()).toHaveSize(1);
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postCollateralManagement.and.returnValue(
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
