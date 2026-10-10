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
import { ClientCollateralListComponent } from './client-collateral-list.component';
import { ClientCollateralManagementService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService } from '../../../core/services/dialog.service';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('ClientCollateralListComponent', () => {
  let component: ClientCollateralListComponent;
  let fixture: ComponentFixture<ClientCollateralListComponent>;
  let serviceSpy: SpyObj<ClientCollateralManagementService>;
  let routerSpy: SpyObj<Router>;
  let dialogService: SpyObj<DialogService>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getClientsClientIdCollaterals',
      'deleteClientsClientIdCollateralsCollateralId',
    ]);
    routerSpy = createSpyObj(['navigate']);
    dialogService = createSpyObj(['confirm']);
    dialogService.confirm.mockResolvedValue(true);
    serviceSpy.getClientsClientIdCollaterals.mockReturnValue(
      of([{ id: 1, name: 'Gold', quantity: 5 }]) as unknown as ReturnType<
        ClientCollateralManagementService['getClientsClientIdCollaterals']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [ClientCollateralListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: ClientCollateralManagementService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ clientId: '1' }) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientCollateralListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load client collaterals on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getClientsClientIdCollaterals).toHaveBeenCalledWith(1);
    expect(component.collaterals()).toHaveLength(1);
  });

  it('should delete after confirmation and reload', async () => {
    serviceSpy.deleteClientsClientIdCollateralsCollateralId.mockReturnValue(
      of({}) as unknown as ReturnType<
        ClientCollateralManagementService['deleteClientsClientIdCollateralsCollateralId']
      >,
    );

    component.onDelete({ id: 5, name: 'Y' });
    await fixture.whenStable();

    expect(serviceSpy.deleteClientsClientIdCollateralsCollateralId).toHaveBeenCalledWith(1, 5);
    expect(serviceSpy.getClientsClientIdCollaterals).toHaveBeenCalledTimes(2);
  });

  it('should not delete when cancelled', async () => {
    dialogService.confirm.mockResolvedValue(false);
    component.onDelete({ id: 5, name: 'Y' });
    await fixture.whenStable();
    expect(serviceSpy.deleteClientsClientIdCollateralsCollateralId).not.toHaveBeenCalled();
  });

  it('sets hasError to true when loading client collaterals fails', () => {
    serviceSpy.getClientsClientIdCollaterals.mockReturnValue(
      throwError(() => new Error('Network error')) as unknown as ReturnType<
        ClientCollateralManagementService['getClientsClientIdCollaterals']
      >,
    );
    const failedFixture = TestBed.createComponent(ClientCollateralListComponent);
    failedFixture.detectChanges();

    expect(failedFixture.componentInstance.hasError()).toBe(true);
  });

  it('retries loading client collaterals and resets hasError on retry', () => {
    serviceSpy.getClientsClientIdCollaterals.mockReturnValue(
      throwError(() => new Error('Network error')) as unknown as ReturnType<
        ClientCollateralManagementService['getClientsClientIdCollaterals']
      >,
    );
    const failedFixture = TestBed.createComponent(ClientCollateralListComponent);
    failedFixture.detectChanges();

    expect(failedFixture.componentInstance.hasError()).toBe(true);

    serviceSpy.getClientsClientIdCollaterals.mockReturnValue(
      of([{ id: 1, name: 'Gold', quantity: 5 }]) as unknown as ReturnType<
        ClientCollateralManagementService['getClientsClientIdCollaterals']
      >,
    );
    failedFixture.componentInstance.onRetry();

    expect(failedFixture.componentInstance.hasError()).toBe(false);
    expect(failedFixture.componentInstance.collaterals()).toHaveLength(1);
  });
});
