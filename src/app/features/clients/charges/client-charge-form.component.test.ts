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
import { ClientChargeFormComponent } from './client-charge-form.component';
import { ClientChargesService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('ClientChargeFormComponent', () => {
  let component: ClientChargeFormComponent;
  let fixture: ComponentFixture<ClientChargeFormComponent>;
  let serviceSpy: SpyObj<ClientChargesService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj(['getClientsClientIdChargesTemplate', 'postClientsClientIdCharges']);
    routerSpy = createSpyObj(['navigate']);
    serviceSpy.getClientsClientIdChargesTemplate.mockReturnValue(
      of({ chargeOptions: [{ id: 1, name: 'Fee', amount: 100 }] }) as unknown as ReturnType<
        ClientChargesService['getClientsClientIdChargesTemplate']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [ClientChargeFormComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: ClientChargesService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ clientId: '1' }) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientChargeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load charge options on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getClientsClientIdChargesTemplate).toHaveBeenCalledWith(1);
    expect(component.chargeOptions()).toHaveLength(1);
  });

  it('should post on create and navigate to the list', () => {
    serviceSpy.postClientsClientIdCharges.mockReturnValue(
      of({}) as unknown as ReturnType<ClientChargesService['postClientsClientIdCharges']>,
    );
    component.charge = { chargeId: 1, amount: 100 };
    component.dueDate = '2026-01-15';
    component.onSubmit();
    expect(serviceSpy.postClientsClientIdCharges).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients', 1, 'charges']);
  });
});
