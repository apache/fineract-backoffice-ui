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
import { FixedDepositTransactionsListComponent } from './fixed-deposit-transactions-list.component';
import { FixedDepositAccountTransactionsService } from '../../../api';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('FixedDepositTransactionsListComponent', () => {
  let component: FixedDepositTransactionsListComponent;
  let fixture: ComponentFixture<FixedDepositTransactionsListComponent>;
  let serviceSpy: SpyObj<FixedDepositAccountTransactionsService>;

  beforeEach(async () => {
    serviceSpy = createSpyObj(['getFixeddepositaccountsFixedDepositAccountIdTransactions']);
    serviceSpy.getFixeddepositaccountsFixedDepositAccountIdTransactions.mockReturnValue(
      of([
        { id: 1, date: '01 January 2024', amount: 1000, transactionType: { code: 'deposit' } },
      ]) as unknown as ReturnType<
        FixedDepositAccountTransactionsService['getFixeddepositaccountsFixedDepositAccountIdTransactions']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [FixedDepositTransactionsListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: FixedDepositAccountTransactionsService, useValue: serviceSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ accountId: '1' }) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FixedDepositTransactionsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load transactions on init', () => {
    expect(component).toBeTruthy();
    expect(
      serviceSpy.getFixeddepositaccountsFixedDepositAccountIdTransactions,
    ).toHaveBeenCalledWith(1);
    expect(component.transactions()).toHaveLength(1);
  });
});
