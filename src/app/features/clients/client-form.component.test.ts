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

import { createSpyObj, SpyObj } from '../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientFormComponent } from './client-form.component';
import { ClientService, OfficesService } from '../../api';
import { ActivatedRoute, Router } from '@angular/router';
import { DialogService } from '../../core/services/dialog.service';
import { of, Observable } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideIonicTesting } from '../../testing/ionic-testing';

describe('ClientFormComponent', () => {
  const HEAD_OFFICE = 'Head Office';

  let component: ClientFormComponent;
  let fixture: ComponentFixture<ClientFormComponent>;
  let clientServiceSpy: SpyObj<ClientService>;
  let officesServiceSpy: SpyObj<OfficesService>;
  let routerSpy: SpyObj<Router>;
  let dialogSpy: SpyObj<DialogService>;

  beforeEach(async () => {
    clientServiceSpy = createSpyObj(['getClientsClientId', 'postClients', 'putClientsClientId']);
    officesServiceSpy = createSpyObj(['getOffices']);
    routerSpy = createSpyObj(['navigate']);
    dialogSpy = createSpyObj<DialogService>(['open', 'confirm']);
    dialogSpy.open.mockResolvedValue(undefined);

    officesServiceSpy.getOffices.mockReturnValue(
      of([{ id: 1, name: HEAD_OFFICE }]) as unknown as Observable<never>,
    );
    clientServiceSpy.getClientsClientId.mockReturnValue(
      of({
        id: 10,
        firstname: 'John',
        lastname: 'Doe',
        officeId: 1,
        legalFormId: 1,
        submittedOnDate: [2026, 6, 16] as unknown as number[],
        activationDate: [2026, 6, 17] as unknown as number[],
        dateOfBirth: [1990, 1, 5] as unknown as number[],
        active: true,
      }) as unknown as Observable<never>,
    );

    await TestBed.configureTestingModule({
      imports: [ClientFormComponent, TranslateModule.forRoot()],
      providers: [
        provideIonicTesting(),
        { provide: ClientService, useValue: clientServiceSpy },
        { provide: OfficesService, useValue: officesServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({
              get: () => null,
            }),
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
      fixture = TestBed.createComponent(ClientFormComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should create and load offices', () => {
      expect(component).toBeTruthy();
      expect(officesServiceSpy.getOffices).toHaveBeenCalled();
      expect(component.isEditMode()).toBe(false);
    });

    it('should open create office dialog and add new office', async () => {
      dialogSpy.open.mockResolvedValue(2);

      // Initially offices has 1 office.
      component.offices.set([{ id: 1, name: HEAD_OFFICE }]);
      // After addOffice, getOffices should be called again and we can make it return 2 offices.
      officesServiceSpy.getOffices.mockReturnValue(
        of([
          { id: 1, name: HEAD_OFFICE },
          { id: 2, name: 'Branch Office' },
        ]) as unknown as Observable<never>,
      );

      await component.addOffice();

      expect(dialogSpy.open).toHaveBeenCalled();
      expect(component.offices()).toHaveLength(2);
      expect(component.client().officeId).toBe(2);
    });

    it('should submit client create request successfully', () => {
      clientServiceSpy.postClients.mockReturnValue(
        of({ clientId: 10 }) as unknown as Observable<never>,
      );
      component.client.set({
        firstname: 'John',
        lastname: 'Doe',
        officeId: 1,
        legalFormId: 1,
        active: true,
      });
      component.submittedOnDate.set('2026-06-16');
      component.activationDate.set('2026-06-17');

      component.onSubmit();

      expect(clientServiceSpy.postClients).toHaveBeenCalled();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients']);
    });

    it('should handle cancel', () => {
      component.onCancel();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients']);
    });

    it('uses unique date picker IDs across client form instances', () => {
      const secondFixture = TestBed.createComponent(ClientFormComponent);

      const datetimeReferences = (element: HTMLElement) =>
        Array.from(element.querySelectorAll('ion-datetime-button')).map(
          (button) => (button as HTMLIonDatetimeButtonElement).datetime,
        );
      const datetimeIds = (element: HTMLElement) =>
        Array.from(element.querySelectorAll('ion-datetime')).map((picker) => picker.id);
      const firstPickerIds = [
        component.submittedOnDatePickerId,
        component.activationDatePickerId,
        component.dateOfBirthPickerId,
      ];
      const secondComponent = secondFixture.componentInstance;
      const secondPickerIds = [
        secondComponent.submittedOnDatePickerId,
        secondComponent.activationDatePickerId,
        secondComponent.dateOfBirthPickerId,
      ];

      expect(datetimeReferences(fixture.nativeElement)).toEqual(firstPickerIds);
      expect(datetimeIds(fixture.nativeElement)).toEqual(firstPickerIds);
      expect(new Set([...firstPickerIds, ...secondPickerIds]).size).toBe(6);

      secondFixture.destroy();
    });

    it('shows the wizard stepper and only the first step initially', () => {
      expect(component.showWizard()).toBe(true);
      expect(component.currentStep()).toBe(0);

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('app-stepper')).not.toBeNull();

      const steps = el.querySelectorAll('.form-grid');
      expect(steps).toHaveLength(3);
      expect(steps[0].classList).not.toContain('hidden');
      expect(steps[1].classList).toContain('hidden');
      expect(steps[2].classList).toContain('hidden');
    });

    it('advances through steps with Next and back with Back', () => {
      component.client.set({ legalFormId: 1, officeId: 1, active: true });
      fixture.detectChanges();

      component.onNextStep();
      expect(component.currentStep()).toBe(1);

      component.onNextStep();
      expect(component.currentStep()).toBe(2);

      // Clamped at the last step.
      component.onNextStep();
      expect(component.currentStep()).toBe(2);

      component.onPreviousStep();
      expect(component.currentStep()).toBe(1);

      component.onPreviousStep();
      component.onPreviousStep();
      // Clamped at the first step.
      expect(component.currentStep()).toBe(0);
    });
  });

  describe('Edit Mode', () => {
    it('should load client details and update successfully', async () => {
      TestBed.resetTestingModule();

      await TestBed.configureTestingModule({
        imports: [ClientFormComponent, TranslateModule.forRoot()],
        providers: [
          { provide: ClientService, useValue: clientServiceSpy },
          { provide: OfficesService, useValue: officesServiceSpy },
          { provide: Router, useValue: routerSpy },
          { provide: DialogService, useValue: dialogSpy },
          {
            provide: ActivatedRoute,
            useValue: {
              paramMap: of({
                get: (key: string) => (key === 'id' ? '10' : null),
              }),
              snapshot: {
                paramMap: {
                  get: (key: string) => (key === 'id' ? '10' : null),
                },
              },
            },
          },
          provideNoopAnimations(),
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(ClientFormComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.isEditMode()).toBe(true);
      expect(component.clientId).toBe(10);
      expect(clientServiceSpy.getClientsClientId).toHaveBeenCalledWith(10);
      expect(component.submittedOnDate()).toBe('2026-06-16');
      expect(component.activationDate()).toBe('2026-06-17');
      expect(component.dateOfBirth()).toBe('1990-01-05');

      clientServiceSpy.putClientsClientId.mockReturnValue(of({}) as unknown as Observable<never>);
      component.onSubmit();

      expect(clientServiceSpy.putClientsClientId).toHaveBeenCalled();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients']);
    });

    it('shows every step flat, with no stepper, when editing an existing client', async () => {
      TestBed.resetTestingModule();

      await TestBed.configureTestingModule({
        imports: [ClientFormComponent, TranslateModule.forRoot()],
        providers: [
          { provide: ClientService, useValue: clientServiceSpy },
          { provide: OfficesService, useValue: officesServiceSpy },
          { provide: Router, useValue: routerSpy },
          { provide: DialogService, useValue: dialogSpy },
          {
            provide: ActivatedRoute,
            useValue: {
              paramMap: of({
                get: (key: string) => (key === 'id' ? '10' : null),
              }),
              snapshot: {
                paramMap: {
                  get: (key: string) => (key === 'id' ? '10' : null),
                },
              },
            },
          },
          provideNoopAnimations(),
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(ClientFormComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.showWizard()).toBe(false);

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('app-stepper')).toBeNull();

      const steps = el.querySelectorAll('.form-grid');
      expect(steps).toHaveLength(3);
      steps.forEach((step) => expect(step.classList).not.toContain('hidden'));
    });
  });
});
