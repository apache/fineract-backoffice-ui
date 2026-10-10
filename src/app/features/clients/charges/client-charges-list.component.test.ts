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
import { ClientChargesListComponent } from './client-charges-list.component';
import { ClientChargesService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService } from '../../../core/services/dialog.service';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('ClientChargesListComponent', () => {
  let component: ClientChargesListComponent;
  let fixture: ComponentFixture<ClientChargesListComponent>;
  let serviceSpy: SpyObj<ClientChargesService>;
  let routerSpy: SpyObj<Router>;
  let dialogService: SpyObj<DialogService>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getClientsClientIdCharges',
      'deleteClientsClientIdChargesChargeId',
    ]);
    routerSpy = createSpyObj(['navigate']);
    dialogService = createSpyObj(['confirm']);
    dialogService.confirm.mockResolvedValue(true);
    serviceSpy.getClientsClientIdCharges.mockReturnValue(
      of({
        pageItems: [{ id: 1, name: 'Fee', amount: 100 }],
      }) as unknown as ReturnType<ClientChargesService['getClientsClientIdCharges']>,
    );

    await TestBed.configureTestingModule({
      imports: [ClientChargesListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: ClientChargesService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ clientId: '1' }) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientChargesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load client charges on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getClientsClientIdCharges).toHaveBeenCalledWith(1);
    expect(component.charges()).toHaveLength(1);
  });

  it('should delete after confirmation and reload', async () => {
    serviceSpy.deleteClientsClientIdChargesChargeId.mockReturnValue(
      of({}) as unknown as ReturnType<ClientChargesService['deleteClientsClientIdChargesChargeId']>,
    );

    component.onDelete({ id: 5, name: 'X' });
    await fixture.whenStable();

    expect(serviceSpy.deleteClientsClientIdChargesChargeId).toHaveBeenCalledWith(1, 5);
    expect(serviceSpy.getClientsClientIdCharges).toHaveBeenCalledTimes(2);
  });

  it('should not delete when cancelled', async () => {
    dialogService.confirm.mockResolvedValue(false);
    component.onDelete({ id: 5, name: 'X' });
    await fixture.whenStable();
    expect(serviceSpy.deleteClientsClientIdChargesChargeId).not.toHaveBeenCalled();
  });

  it('sets hasError to true when loading client charges fails', () => {
    serviceSpy.getClientsClientIdCharges.mockReturnValue(
      throwError(() => new Error('Network error')) as unknown as ReturnType<
        ClientChargesService['getClientsClientIdCharges']
      >,
    );
    const failedFixture = TestBed.createComponent(ClientChargesListComponent);
    failedFixture.detectChanges();

    expect(failedFixture.componentInstance.hasError()).toBe(true);
  });

  it('retries loading client charges and resets hasError on retry', () => {
    serviceSpy.getClientsClientIdCharges.mockReturnValue(
      throwError(() => new Error('Network error')) as unknown as ReturnType<
        ClientChargesService['getClientsClientIdCharges']
      >,
    );
    const failedFixture = TestBed.createComponent(ClientChargesListComponent);
    failedFixture.detectChanges();

    expect(failedFixture.componentInstance.hasError()).toBe(true);

    serviceSpy.getClientsClientIdCharges.mockReturnValue(
      of({
        pageItems: [{ id: 1, name: 'Fee', amount: 100 }],
      }) as unknown as ReturnType<ClientChargesService['getClientsClientIdCharges']>,
    );
    failedFixture.componentInstance.onRetry();

    expect(failedFixture.componentInstance.hasError()).toBe(false);
    expect(failedFixture.componentInstance.charges()).toHaveLength(1);
  });
});
