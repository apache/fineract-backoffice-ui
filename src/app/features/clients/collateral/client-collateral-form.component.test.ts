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
import { ClientCollateralFormComponent } from './client-collateral-form.component';
import { ClientCollateralManagementService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('ClientCollateralFormComponent', () => {
  let component: ClientCollateralFormComponent;
  let fixture: ComponentFixture<ClientCollateralFormComponent>;
  let serviceSpy: SpyObj<ClientCollateralManagementService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getClientsClientIdCollateralsTemplate',
      'getClientsClientIdCollateralsClientCollateralId',
      'postClientsClientIdCollaterals',
      'putClientsClientIdCollateralsCollateralId',
    ]);
    routerSpy = createSpyObj(['navigate']);
    serviceSpy.getClientsClientIdCollateralsTemplate.mockReturnValue(
      of([{ collateralId: 1, name: 'Gold', quantity: 1 }]) as unknown as ReturnType<
        ClientCollateralManagementService['getClientsClientIdCollateralsTemplate']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [ClientCollateralFormComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: ClientCollateralManagementService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ clientId: '1' }) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientCollateralFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load collateral product options on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getClientsClientIdCollateralsTemplate).toHaveBeenCalledWith(1);
    expect(component.collateralProductOptions()).toHaveLength(1);
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postClientsClientIdCollaterals.mockReturnValue(
      of({}) as unknown as ReturnType<
        ClientCollateralManagementService['postClientsClientIdCollaterals']
      >,
    );
    component.collateral.set({ collateralId: 1, quantity: 5 });
    component.onSubmit();
    expect(serviceSpy.postClientsClientIdCollaterals).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients', 1, 'collaterals']);
  });
});
