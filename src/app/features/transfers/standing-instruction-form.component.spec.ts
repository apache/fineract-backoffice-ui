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
import { StandingInstructionFormComponent } from './standing-instruction-form.component';
import { StandingInstructionsService, OfficesService, ClientService } from '../../api';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Observable } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('StandingInstructionFormComponent', () => {
  let component: StandingInstructionFormComponent;
  let fixture: ComponentFixture<StandingInstructionFormComponent>;
  let instructionsServiceSpy: jasmine.SpyObj<StandingInstructionsService>;
  let officesServiceSpy: jasmine.SpyObj<OfficesService>;
  let clientServiceSpy: jasmine.SpyObj<ClientService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    instructionsServiceSpy = jasmine.createSpyObj('StandingInstructionsService', [
      'getStandinginstructionsStandingInstructionId',
      'postStandinginstructions',
      'putStandinginstructionsStandingInstructionId',
    ]);
    officesServiceSpy = jasmine.createSpyObj('OfficesService', ['getOffices']);
    clientServiceSpy = jasmine.createSpyObj('ClientService', [
      'getClients',
      'getClientsClientIdAccounts',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    officesServiceSpy.getOffices.and.returnValue(
      of([{ id: 1, name: 'Head Office' }]) as unknown as Observable<never>,
    );
    clientServiceSpy.getClients.and.returnValue(
      of({ pageItems: [{ id: 10, displayName: 'John Doe' }] }) as unknown as Observable<never>,
    );
    clientServiceSpy.getClientsClientIdAccounts.and.returnValue(
      of({
        savingsAccounts: [{ id: 22, accountNo: 'S01', productName: 'Savings A' }],
        loanAccounts: [{ id: 11, accountNo: 'L01', productName: 'Loan A' }],
      }) as unknown as Observable<never>,
    );

    await TestBed.configureTestingModule({
      imports: [StandingInstructionFormComponent, TranslateModule.forRoot()],
      providers: [
        { provide: StandingInstructionsService, useValue: instructionsServiceSpy },
        { provide: OfficesService, useValue: officesServiceSpy },
        { provide: ClientService, useValue: clientServiceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => null,
              },
            },
          },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();
  });

  describe('Create Mode', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(StandingInstructionFormComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      routerSpy.navigate.calls.reset();
    });

    it('should create and load initial metadata', () => {
      expect(component).toBeTruthy();
      expect(officesServiceSpy.getOffices).toHaveBeenCalled();
      expect(clientServiceSpy.getClients).toHaveBeenCalled();
      expect(component.isEditMode).toBeFalse();
    });

    it('should load loan accounts when account type changes to loan', () => {
      component.request.fromClientId = '10';
      component.request.fromAccountType = '1';
      component.onAccountTypeChange('from');

      expect(clientServiceSpy.getClientsClientIdAccounts).toHaveBeenCalledWith(10);
      expect(component.fromAccounts()[0].id).toBe(11); // Loan A
    });

    it('should submit create request successfully', () => {
      instructionsServiceSpy.postStandinginstructions.and.returnValue(
        of({}) as unknown as Observable<never>,
      );
      component.request.name = 'Test SI';
      component.request.fromOfficeId = '1';
      component.request.fromClientId = '10';
      component.request.fromAccountId = '22';
      component.request.fromAccountType = '2';
      component.request.toOfficeId = '1';
      component.request.toClientId = '10';
      component.request.toAccountId = '22';
      component.request.toAccountType = '2';
      component.request.amount = '100';
      component.validFrom = '2026-06-16';

      component.onSubmit();

      expect(instructionsServiceSpy.postStandinginstructions).toHaveBeenCalled();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/transfers/standing-instructions']);
    });

    it('should handle cancel', () => {
      component.onCancel();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/transfers/standing-instructions']);
    });
  });

  describe('Edit Mode', () => {
    it('should load standing instruction details and update successfully', async () => {
      TestBed.resetTestingModule();

      const editParamMap = {
        get: (key: string) => (key === 'id' ? '99' : null),
      };

      instructionsServiceSpy.getStandinginstructionsStandingInstructionId.and.returnValue(
        of({
          id: 99,
          name: 'Existing SI',
          amount: 250,
          fromOffice: { id: 1 },
          fromClient: { id: 10 },
          fromAccountType: { id: 2 },
          fromAccount: { id: 22 },
          toOffice: { id: 1 },
          toClient: { id: 10 },
          toAccountType: { id: 2 },
          toAccount: { id: 22 },
          transferType: { id: 1 },
          instructionType: { id: 1 },
          priority: { id: 2 },
          recurrenceType: { id: 1 },
          recurrenceFrequency: { id: 3 },
          recurrenceInterval: 1,
          status: { id: 1 },
          validFrom: [2026, 6, 16] as unknown as number[],
        }) as unknown as Observable<never>,
      );

      instructionsServiceSpy.putStandinginstructionsStandingInstructionId.and.returnValue(
        of({}) as unknown as Observable<never>,
      );

      await TestBed.configureTestingModule({
        imports: [StandingInstructionFormComponent, TranslateModule.forRoot()],
        providers: [
          { provide: StandingInstructionsService, useValue: instructionsServiceSpy },
          { provide: OfficesService, useValue: officesServiceSpy },
          { provide: ClientService, useValue: clientServiceSpy },
          { provide: Router, useValue: routerSpy },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                paramMap: editParamMap,
              },
            },
          },
          provideNoopAnimations(),
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(StandingInstructionFormComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.isEditMode).toBeTrue();
      expect(component.instructionId).toBe(99);
      expect(
        instructionsServiceSpy.getStandinginstructionsStandingInstructionId,
      ).toHaveBeenCalledWith(99);
      expect(component.request.name).toBe('Existing SI');
      expect(component.validFrom).toBe('2026-06-16');

      component.onSubmit();
      expect(
        instructionsServiceSpy.putStandinginstructionsStandingInstructionId,
      ).toHaveBeenCalled();
    });
  });
});
