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
import { OnHoldTransactionsListComponent } from './on-hold-transactions-list.component';
import { DepositAccountOnHoldFundTransactionsService } from '../../../api';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('OnHoldTransactionsListComponent', () => {
  let component: OnHoldTransactionsListComponent;
  let fixture: ComponentFixture<OnHoldTransactionsListComponent>;
  let serviceSpy: SpyObj<DepositAccountOnHoldFundTransactionsService>;

  beforeEach(async () => {
    serviceSpy = createSpyObj(['getSavingsaccountsSavingsIdOnholdtransactions']);
    serviceSpy.getSavingsaccountsSavingsIdOnholdtransactions.mockReturnValue(
      of({
        pageItems: [
          {
            id: 1,
            transactionDate: '01 January 2024',
            amount: 250,
            transactionType: { value: 'Hold' },
            loanClientName: 'John Doe',
          },
        ],
        totalFilteredRecords: 1,
      }) as unknown as ReturnType<
        DepositAccountOnHoldFundTransactionsService['getSavingsaccountsSavingsIdOnholdtransactions']
      >,
    );

    await TestBed.configureTestingModule({
      imports: [OnHoldTransactionsListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: DepositAccountOnHoldFundTransactionsService, useValue: serviceSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ savingsId: '1' }) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnHoldTransactionsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load on-hold transactions from the paged envelope on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getSavingsaccountsSavingsIdOnholdtransactions).toHaveBeenCalledWith(1);
    expect(component.transactions()).toHaveLength(1);
    expect(component.transactions()[0].loanClientName).toBe('John Doe');
  });

  it('should fall back to an empty list when the envelope carries no pageItems', () => {
    serviceSpy.getSavingsaccountsSavingsIdOnholdtransactions.mockReturnValue(
      of({ totalFilteredRecords: 0 }) as unknown as ReturnType<
        DepositAccountOnHoldFundTransactionsService['getSavingsaccountsSavingsIdOnholdtransactions']
      >,
    );

    component.load();

    expect(component.transactions()).toEqual([]);
  });
});
