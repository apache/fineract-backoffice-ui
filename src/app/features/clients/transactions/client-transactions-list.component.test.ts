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
import { ClientTransactionsListComponent } from './client-transactions-list.component';
import { ClientTransactionService } from '../../../api';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService } from '../../../core/services/dialog.service';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('ClientTransactionsListComponent', () => {
  let component: ClientTransactionsListComponent;
  let fixture: ComponentFixture<ClientTransactionsListComponent>;
  let serviceSpy: SpyObj<ClientTransactionService>;
  let dialogService: SpyObj<DialogService>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getClientsClientIdTransactions',
      'postClientsClientIdTransactionsTransactionId',
    ]);
    dialogService = createSpyObj(['confirm']);
    dialogService.confirm.mockResolvedValue(true);
    serviceSpy.getClientsClientIdTransactions.mockReturnValue(
      of({
        pageItems: [{ id: 1, amount: 100, reversed: false }],
      }) as unknown as ReturnType<ClientTransactionService['getClientsClientIdTransactions']>,
    );

    await TestBed.configureTestingModule({
      imports: [ClientTransactionsListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: ClientTransactionService, useValue: serviceSpy },
        { provide: DialogService, useValue: dialogService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ clientId: '1' }) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientTransactionsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load client transactions on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getClientsClientIdTransactions).toHaveBeenCalledWith(1);
    expect(component.transactions()).toHaveLength(1);
  });

  it('should undo a transaction after confirmation and reload', async () => {
    serviceSpy.postClientsClientIdTransactionsTransactionId.mockReturnValue(
      of({}) as unknown as ReturnType<
        ClientTransactionService['postClientsClientIdTransactionsTransactionId']
      >,
    );

    component.onUndo({ id: 7 });
    await fixture.whenStable();

    expect(serviceSpy.postClientsClientIdTransactionsTransactionId).toHaveBeenCalledWith(
      1,
      7,
      'undo',
    );
    expect(serviceSpy.getClientsClientIdTransactions).toHaveBeenCalledTimes(2);
  });

  it('should not undo when cancelled', async () => {
    dialogService.confirm.mockResolvedValue(false);
    component.onUndo({ id: 7 });
    await fixture.whenStable();
    expect(serviceSpy.postClientsClientIdTransactionsTransactionId).not.toHaveBeenCalled();
  });
});
