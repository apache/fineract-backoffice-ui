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
import { BUSINESS_DATE_API } from '../../core/adapters';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientFormComponent } from './client-form.component';
import { ClientService, OfficesService } from '../../api';
import { ActivatedRoute, Router } from '@angular/router';
import { DialogService } from '../../core/services/dialog.service';
import { of, Observable, throwError } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { FakeOverlayAdapter, provideFakeAdapters } from '../../testing/adapters';

describe('ClientFormComponent', () => {
  const HEAD_OFFICE = 'Head Office';

  let component: ClientFormComponent;
  let fixture: ComponentFixture<ClientFormComponent>;
  let clientServiceSpy: SpyObj<ClientService>;
  let officesServiceSpy: SpyObj<OfficesService>;
  let routerSpy: SpyObj<Router>;
  let dialogSpy: SpyObj<DialogService>;
  let overlay: FakeOverlayAdapter;

  beforeEach(async () => {
    const fakes = provideFakeAdapters();
    overlay = fakes.overlay;
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
      imports: [ClientFormComponent],
      providers: [
        ...fakes.providers,
        ...provideTranslateTesting(),
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

    it('describes the create wizard rather than the clients list in its help', () => {
      const help = fixture.nativeElement.querySelector('app-help-icon [data-testid="help-icon"]');
      expect(help.getAttribute('aria-label')).toContain('HELP.CREATE_CLIENT_DESC');
    });

    it('renders an unset DOB placeholder instead of a fabricated date', () => {
      component.pickersReady.set(true);
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector(
        'ion-datetime-button[datetime="dateOfBirth-picker"]',
      );
      expect(component.dateOfBirth()).toBeNull();
      expect(button.querySelector('[slot="date-target"]')?.textContent ?? '').toContain(
        'CLIENTS.DATE_OF_BIRTH_NOT_SET',
      );
      expect(fixture.nativeElement.querySelector('[data-testid="clear-date-of-birth"]')).toBeNull();
    });

    it('clears a chosen create DOB without submitting and omits it from the request', () => {
      clientServiceSpy.postClients.mockReturnValue(
        of({ clientId: 10 }) as unknown as Observable<never>,
      );
      component.client.set({
        firstname: 'Synthetic',
        lastname: 'Client',
        officeId: 1,
        legalFormId: 1,
      });
      component.dateOfBirth.set('1990-01-05');
      component.pickersReady.set(true);
      fixture.detectChanges();
      const clear = fixture.nativeElement.querySelector('[data-testid="clear-date-of-birth"]');
      expect(clear).not.toBeNull();
      clear.click();
      fixture.detectChanges();
      expect(component.dateOfBirth()).toBeNull();
      expect(clientServiceSpy.postClients).not.toHaveBeenCalled();
      component.onSubmit();
      expect(clientServiceSpy.postClients.mock.calls[0][0]).not.toHaveProperty('dateOfBirth');
    });

    it('drops the prior DOB when clearing after a failed create request', () => {
      clientServiceSpy.postClients
        .mockReturnValueOnce(throwError(() => new Error('Synthetic failed save')))
        .mockReturnValue(of({ clientId: 10 }) as unknown as Observable<never>);
      component.client.set({
        firstname: 'Synthetic',
        lastname: 'Client',
        officeId: 1,
        legalFormId: 1,
      });
      component.dateOfBirth.set('1990-01-05');
      component.onSubmit();
      expect(component.isSaving()).toBe(false);
      expect(clientServiceSpy.postClients.mock.calls[0][0]).toHaveProperty(
        'dateOfBirth',
        '05 January 1990',
      );
      fixture.detectChanges();
      fixture.nativeElement.querySelector('[data-testid="clear-date-of-birth"]').click();
      component.onSubmit();
      expect(clientServiceSpy.postClients.mock.calls[1][0]).not.toHaveProperty('dateOfBirth');
    });

    it('preserves the selected DOB calendar day in the create payload', () => {
      clientServiceSpy.postClients.mockReturnValue(
        of({ clientId: 10 }) as unknown as Observable<never>,
      );
      component.client.set({
        firstname: 'Synthetic',
        lastname: 'Client',
        officeId: 1,
        legalFormId: 1,
      });
      component.dateOfBirth.set('1990-01-05');
      component.pickersReady.set(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[slot="date-target"]')).toBeNull();
      component.onSubmit();
      expect(clientServiceSpy.postClients.mock.calls[0][0]).toHaveProperty(
        'dateOfBirth',
        '05 January 1990',
      );
    });

    it('does not offer a create-only clear action while editing an existing DOB', () => {
      component.isEditMode.set(true);
      component.dateOfBirth.set('1990-01-05');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="clear-date-of-birth"]')).toBeNull();
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
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients/view', 10]);
      expect(overlay.lastToast?.message).toBe('CLIENTS.CREATE_SUCCESS');
    });

    it('should handle cancel', () => {
      component.onCancel();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients']);
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

    it('displays required asterisks for required fields', () => {
      const markers = fixture.nativeElement.querySelectorAll('.required-marker');
      expect(markers.length).toBeGreaterThanOrEqual(2);
    });

    it('shows hint when step 1 has incomplete required fields', async () => {
      await fixture.whenStable();
      fixture.detectChanges();
      const hint = fixture.nativeElement.querySelector('[data-testid="client-form-step-hint"]');
      expect(hint).toBeTruthy();
    });
  });

  describe('Edit Mode', () => {
    it('should load client details and update successfully', async () => {
      TestBed.resetTestingModule();

      const fakes = provideFakeAdapters();
      overlay = fakes.overlay;

      await TestBed.configureTestingModule({
        imports: [ClientFormComponent],
        providers: [
          ...fakes.providers,
          ...provideTranslateTesting(),
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
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients/view', 10]);
      expect(overlay.lastToast?.message).toBe('CLIENTS.UPDATE_SUCCESS');
    });

    it('shows every step flat, with no stepper, when editing an existing client', async () => {
      TestBed.resetTestingModule();

      await TestBed.configureTestingModule({
        imports: [ClientFormComponent],
        providers: [
          {
            // A tenant without the business-date feature: `PlatformDateService` then seeds this
            // form's dates from the platform's clock and asks the backend nothing. Without it the
            // service reaches the generated client, and the request would need answering here.
            provide: BUSINESS_DATE_API,
            useValue: {
              getBusinessDates: () => of([]),
              isBusinessDateEnabled: () => of(false),
            },
          },
          ...provideTranslateTesting(),
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
