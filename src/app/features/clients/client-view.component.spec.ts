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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientViewComponent } from './client-view.component';
import {
  ClientService,
  NotesService,
  ClientsAddressService,
  DocumentsService,
  ClientFamilyMemberService,
  ClientIdentifierService,
} from '../../api';
import { AuthService } from '../../core/services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { provideIonicTesting } from '../../testing/ionic-testing';

describe('ClientViewComponent', () => {
  let component: ClientViewComponent;
  let fixture: ComponentFixture<ClientViewComponent>;
  let clientServiceSpy: jasmine.SpyObj<ClientService>;
  let notesServiceSpy: jasmine.SpyObj<NotesService>;
  let addressServiceSpy: jasmine.SpyObj<ClientsAddressService>;
  let documentServiceSpy: jasmine.SpyObj<DocumentsService>;
  let familyMemberServiceSpy: jasmine.SpyObj<ClientFamilyMemberService>;
  let identifierServiceSpy: jasmine.SpyObj<ClientIdentifierService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    clientServiceSpy = jasmine.createSpyObj('ClientService', [
      'getClientsClientId',
      'getClientsClientIdAccounts',
    ]);
    notesServiceSpy = jasmine.createSpyObj('NotesService', [
      'postResourceTypeResourceIdNotes',
      'getResourceTypeResourceIdNotes',
    ]);
    addressServiceSpy = jasmine.createSpyObj('ClientsAddressService', [
      'getClientClientidAddresses',
    ]);
    documentServiceSpy = jasmine.createSpyObj('DocumentsService', [
      'getEntityTypeEntityIdDocuments',
    ]);
    familyMemberServiceSpy = jasmine.createSpyObj('ClientFamilyMemberService', [
      'getClientsClientIdFamilymembers',
    ]);
    identifierServiceSpy = jasmine.createSpyObj('ClientIdentifierService', [
      'getClientsClientIdIdentifiers',
    ]);

    authServiceSpy = jasmine.createSpyObj('AuthService', ['hasPermission'], {
      currentUser: signal({
        username: 'mifos',
        base64EncodedAuthenticationKey: 'key',
        authenticated: true,
        officeId: 1,
        officeName: 'Head Office',
        userId: 1,
        permissions: ['ALL_FUNCTIONS'],
      }),
    });
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ClientViewComponent, TranslateModule.forRoot()],
      providers: [
        provideIonicTesting(),
        provideNoopAnimations(),
        { provide: ClientService, useValue: clientServiceSpy },
        { provide: NotesService, useValue: notesServiceSpy },
        { provide: ClientsAddressService, useValue: addressServiceSpy },
        { provide: DocumentsService, useValue: documentServiceSpy },
        { provide: ClientFamilyMemberService, useValue: familyMemberServiceSpy },
        { provide: ClientIdentifierService, useValue: identifierServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({
              get: (key: string) => (key === 'id' ? '123' : null),
            }),
          },
        },
      ],
    }).compileComponents();

    clientServiceSpy.getClientsClientId.and.returnValue(
      of({
        id: 123,
        accountNo: 'CL00123',
        displayName: 'John Doe',
        firstname: 'John',
        lastname: 'Doe',
        officeName: 'Head Office',
        activationDate: [2026, 5, 30] as any,
      }) as any,
    );

    clientServiceSpy.getClientsClientIdAccounts.and.returnValue(
      of({
        loanAccounts: [] as any,
        savingsAccounts: [] as any,
      }) as any,
    );

    addressServiceSpy.getClientClientidAddresses.and.returnValue(of([]) as any);
    documentServiceSpy.getEntityTypeEntityIdDocuments.and.returnValue(of([]) as any);
    familyMemberServiceSpy.getClientsClientIdFamilymembers.and.returnValue(of([]) as any);
    identifierServiceSpy.getClientsClientIdIdentifiers.and.returnValue(of([]) as any);
    notesServiceSpy.getResourceTypeResourceIdNotes.and.returnValue(of([]) as any);

    fixture = TestBed.createComponent(ClientViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load client details and accounts on init', () => {
    expect(clientServiceSpy.getClientsClientId).toHaveBeenCalledWith(123);
    expect(clientServiceSpy.getClientsClientIdAccounts).toHaveBeenCalledWith(123);
    expect(component.client()?.displayName).toBe('John Doe');
  });

  it('shows create actions in empty savings and loan tabs', () => {
    component.activeTab.set('1');
    fixture.detectChanges();

    const savingsButton = fixture.nativeElement.querySelector(
      '[data-testid="client-empty-savings-create"]',
    );
    expect(savingsButton).toBeTruthy();

    component.activeTab.set('2');
    fixture.detectChanges();

    const loanButton = fixture.nativeElement.querySelector(
      '[data-testid="client-empty-loans-create"]',
    );
    expect(loanButton).toBeTruthy();
  });

  it('navigates to create savings from the empty savings tab', () => {
    component.activeTab.set('1');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="client-empty-savings-create"]').click();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/savings-accounts/create'], {
      queryParams: { clientId: 123 },
    });
  });

  it('navigates to create loan from the empty loan tab', () => {
    component.activeTab.set('2');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="client-empty-loans-create"]').click();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/loans/create'], {
      queryParams: { clientId: 123 },
    });
  });
});
