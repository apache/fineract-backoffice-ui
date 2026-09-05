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
import { CLIENT_TAB, ClientViewComponent } from './client-view.component';
import {
  ClientService,
  NotesService,
  ClientsAddressService,
  DocumentsService,
  ClientFamilyMemberService,
  ClientIdentifierService,
  ShareAccountService,
} from '../../api';
import { AuthService } from '../../core/services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { createSpyObj, SpyObj } from '../../testing/mocks';

describe('ClientViewComponent', () => {
  let component: ClientViewComponent;
  let fixture: ComponentFixture<ClientViewComponent>;
  let clientServiceSpy: SpyObj<ClientService>;
  let notesServiceSpy: SpyObj<NotesService>;
  let addressServiceSpy: SpyObj<ClientsAddressService>;
  let documentServiceSpy: SpyObj<DocumentsService>;
  let familyMemberServiceSpy: SpyObj<ClientFamilyMemberService>;
  let identifierServiceSpy: SpyObj<ClientIdentifierService>;
  let authServiceSpy: SpyObj<AuthService>;
  let shareAccountServiceSpy: SpyObj<ShareAccountService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    clientServiceSpy = createSpyObj(['getClientsClientId', 'getClientsClientIdAccounts']);
    notesServiceSpy = createSpyObj([
      'postResourceTypeResourceIdNotes',
      'getResourceTypeResourceIdNotes',
    ]);
    addressServiceSpy = createSpyObj(['getClientClientidAddresses']);
    documentServiceSpy = createSpyObj(['getEntityTypeEntityIdDocuments']);
    familyMemberServiceSpy = createSpyObj(['getClientsClientIdFamilymembers']);
    identifierServiceSpy = createSpyObj(['getClientsClientIdIdentifiers']);

    shareAccountServiceSpy = createSpyObj(['getAccountsType']);
    shareAccountServiceSpy.getAccountsType.mockReturnValue(of({ pageItems: [] }) as any);

    authServiceSpy = Object.assign(createSpyObj<AuthService>(['hasPermission']), {
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
    routerSpy = createSpyObj(['navigate']);

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
        { provide: ShareAccountService, useValue: shareAccountServiceSpy },
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

    clientServiceSpy.getClientsClientId.mockReturnValue(
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

    clientServiceSpy.getClientsClientIdAccounts.mockReturnValue(
      of({
        loanAccounts: [] as any,
        savingsAccounts: [] as any,
      }) as any,
    );

    addressServiceSpy.getClientClientidAddresses.mockReturnValue(of([]) as any);
    documentServiceSpy.getEntityTypeEntityIdDocuments.mockReturnValue(of([]) as any);
    familyMemberServiceSpy.getClientsClientIdFamilymembers.mockReturnValue(of([]) as any);
    identifierServiceSpy.getClientsClientIdIdentifiers.mockReturnValue(of([]) as any);
    notesServiceSpy.getResourceTypeResourceIdNotes.mockReturnValue(of([]) as any);

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

  describe('empty account tabs', () => {
    it('offers a contextual action to create a savings account', () => {
      component.onTabChange(CLIENT_TAB.savings);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('[data-testid="client-create-savings-account"]').click();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/savings-accounts/create'], {
        queryParams: { clientId: 123 },
      });
    });

    it('offers a contextual action to create a loan', () => {
      component.onTabChange(CLIENT_TAB.loans);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('[data-testid="client-create-loan-account"]').click();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/loans/create'], {
        queryParams: { clientId: 123 },
      });
    });
  });

  describe('deposit accounts', () => {
    /**
     * The platform returns savings, fixed deposits and recurring deposits in one array, told
     * apart only by `depositType.id` — 100, 200 and 300, confirmed by opening one of each against
     * a running Fineract. Before this split all three were listed as savings accounts and linked
     * to the savings screen.
     */
    beforeEach(() => {
      clientServiceSpy.getClientsClientIdAccounts.mockReturnValue(
        of({
          loanAccounts: [] as any,
          savingsAccounts: [
            { id: 2, accountNo: '2', depositType: { id: 100, value: 'Savings' } },
            { id: 6, accountNo: '6', depositType: { id: 200, value: 'Fixed Deposit' } },
            { id: 7, accountNo: '7', depositType: { id: 300, value: 'Recurring Deposit' } },
          ] as any,
        }) as any,
      );
      component.loadClientAccounts();
    });

    it('keeps only true savings on the savings tab', () => {
      expect(component.plainSavingsAccounts().map((account) => account.id)).toEqual([2]);
    });

    it('separates fixed from recurring deposits', () => {
      expect(component.fixedDepositAccounts().map((account) => account.id)).toEqual([6]);
      expect(component.recurringDepositAccounts().map((account) => account.id)).toEqual([7]);
    });

    it('treats an account with no deposit type as savings, which is what it is', () => {
      clientServiceSpy.getClientsClientIdAccounts.mockReturnValue(
        of({ savingsAccounts: [{ id: 11, accountNo: '11' }] as any }) as any,
      );
      component.loadClientAccounts();

      expect(component.plainSavingsAccounts().map((account) => account.id)).toEqual([11]);
    });
  });

  describe('share accounts', () => {
    beforeEach(() => {
      shareAccountServiceSpy.getAccountsType.mockReturnValue(
        of({
          pageItems: [
            { id: 1, accountNo: '000000001', clientId: 123, productName: 'Shares' },
            { id: 2, accountNo: '000000002', clientId: 999, productName: 'Shares' },
          ],
        }) as any,
      );
    });

    it('is not fetched until the tab is opened', () => {
      component.loadClientAccounts();

      // Most visits to a client never open this tab, and the request is not free.
      expect(shareAccountServiceSpy.getAccountsType).not.toHaveBeenCalled();
    });

    it('shows only the accounts belonging to this client', () => {
      component.onTabChange(CLIENT_TAB.shares);

      expect(component.shareAccounts().map((account) => account.id)).toEqual([1]);
    });

    it('does not refetch when the tab is opened again', () => {
      component.onTabChange(CLIENT_TAB.shares);
      component.onTabChange(CLIENT_TAB.details);
      component.onTabChange(CLIENT_TAB.shares);

      expect(shareAccountServiceSpy.getAccountsType).toHaveBeenCalledTimes(1);
    });
  });
});
