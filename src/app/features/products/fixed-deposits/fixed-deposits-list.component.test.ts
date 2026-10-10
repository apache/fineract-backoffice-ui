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

import type { Mock } from 'vitest';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FixedDepositAccountsListComponent } from './fixed-deposits-list.component';
import { FixedDepositAccountService, GetFixedDepositAccountsResponse } from '../../../api';
import { of, throwError } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('FixedDepositAccountsListComponent', () => {
  let component: FixedDepositAccountsListComponent;
  let fixture: ComponentFixture<FixedDepositAccountsListComponent>;
  let fixedDepositServiceSpy: SpyObj<FixedDepositAccountService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    fixedDepositServiceSpy = createSpyObj(['getFixeddepositaccounts']);
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [FixedDepositAccountsListComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        { provide: FixedDepositAccountService, useValue: fixedDepositServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FixedDepositAccountsListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    (fixedDepositServiceSpy.getFixeddepositaccounts as Mock).mockReturnValue(
      of([] as GetFixedDepositAccountsResponse[]),
    );
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load accounts on initialization', () => {
    const mockAccounts = [
      { id: 1, accountNo: 1001, clientName: 'John Doe' } as GetFixedDepositAccountsResponse,
    ];
    (fixedDepositServiceSpy.getFixeddepositaccounts as Mock).mockReturnValue(of(mockAccounts));

    fixture.detectChanges();

    expect(fixedDepositServiceSpy.getFixeddepositaccounts).toHaveBeenCalled();
    expect(component.accounts()).toHaveLength(1);
    expect(component.accounts()[0].accountNo).toBe(1001);
  });

  it('should handle error when loading accounts', () => {
    vi.spyOn(console, 'error');
    (fixedDepositServiceSpy.getFixeddepositaccounts as Mock).mockReturnValue(
      throwError(() => new Error('API Error')),
    );

    fixture.detectChanges();

    expect(console.error).toHaveBeenCalled();
  });

  it('should navigate to create account form', () => {
    component.onCreateAccount();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/fixed-deposits/create']);
  });

  it('should navigate to edit account form', () => {
    const mockAccount = { id: 123 } as GetFixedDepositAccountsResponse;
    component.onEditAccount(mockAccount);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/fixed-deposits/edit', 123]);
  });

  it('should navigate to approve account action', () => {
    const mockAccount = { id: 456 } as GetFixedDepositAccountsResponse;
    component.onApprove(mockAccount);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/fixed/456/action/approve']);
  });
});
