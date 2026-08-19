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
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { OpeningBalancesComponent } from './opening-balances.component';
import { CurrencyService, JournalEntriesService, OfficesService } from '../../api';
import { NotificationService } from '../../core/services/notification.service';
import { provideFakeAdapters } from '../../testing/adapters';

/** The template exactly as the platform returns it, including its own spelling of 'liabity'. */
const TEMPLATE = {
  officeId: 1,
  officeName: 'Head Office',
  transactionDate: [2026, 8, 16],
  contraAccount: { id: 3, name: 'Opening Contra', glCode: 'PRB-3000' },
  assetAccountOpeningBalances: [{ glAccountId: 1, glAccountName: 'Cash', glAccountCode: 'A-1' }],
  liabityAccountOpeningBalances: [
    { glAccountId: 2, glAccountName: 'Deposits', glAccountCode: 'L-1' },
  ],
  incomeAccountOpeningBalances: [],
  equityAccountOpeningBalances: [],
  expenseAccountOpeningBalances: [],
};

describe('OpeningBalancesComponent', () => {
  let component: OpeningBalancesComponent;
  let fixture: ComponentFixture<OpeningBalancesComponent>;
  let journalSpy: jasmine.SpyObj<JournalEntriesService>;

  beforeEach(async () => {
    journalSpy = jasmine.createSpyObj('JournalEntriesService', [
      'getJournalentriesOpeningbalance',
      'postJournalentries',
    ]);
    const officesSpy = jasmine.createSpyObj('OfficesService', ['getOffices']);
    officesSpy.getOffices.and.returnValue(of([{ id: 1, name: 'Head Office' }]) as never);
    const currencySpy = jasmine.createSpyObj('CurrencyService', ['getCurrencies']);
    currencySpy.getCurrencies.and.returnValue(
      of({ selectedCurrencyOptions: [{ code: 'USD', name: 'US Dollar' }] }) as never,
    );

    await TestBed.configureTestingModule({
      imports: [OpeningBalancesComponent],
      providers: [
        { provide: JournalEntriesService, useValue: journalSpy },
        { provide: OfficesService, useValue: officesSpy },
        { provide: CurrencyService, useValue: currencySpy },
        { provide: NotificationService, useValue: jasmine.createSpyObj('N', ['success', 'error']) },
        ...provideFakeAdapters().providers,
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OpeningBalancesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function selectOfficeAndCurrency(): void {
    component.officeId = 1;
    component.currencyCode = 'USD';
    component.onSelectionChange();
  }

  it('reads every account group, including the one the platform misspells', () => {
    journalSpy.getJournalentriesOpeningbalance.and.returnValue(
      of(TEMPLATE) as unknown as Observable<never>,
    );

    selectOfficeAndCurrency();

    expect(component.rows()).toHaveSize(2);
    expect(component.rows().map((row) => row.accountType)).toEqual(['ASSET', 'LIABILITY']);
  });

  it('explains a 404 as an unmapped contra account rather than a missing screen', () => {
    journalSpy.getJournalentriesOpeningbalance.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );

    selectOfficeAndCurrency();

    expect(component.unavailableReason()).toBe('OPENING_BALANCES.CONTRA_NOT_MAPPED');
    expect(component.rows()).toHaveSize(0);
  });

  it('refuses to save until debits and credits agree', () => {
    journalSpy.getJournalentriesOpeningbalance.and.returnValue(
      of(TEMPLATE) as unknown as Observable<never>,
    );
    selectOfficeAndCurrency();

    component.rows()[0].debit = 100;
    component.recalculate();
    expect(component.isBalanced()).toBeFalse();

    component.rows()[1].credit = 100;
    component.recalculate();
    expect(component.isBalanced()).toBeTrue();
  });

  it('sends the date the platform proposed, not one derived in the browser', () => {
    journalSpy.getJournalentriesOpeningbalance.and.returnValue(
      of(TEMPLATE) as unknown as Observable<never>,
    );
    journalSpy.postJournalentries.and.returnValue(of({}) as unknown as Observable<never>);
    selectOfficeAndCurrency();

    component.rows()[0].debit = 100;
    component.rows()[1].credit = 100;
    component.recalculate();
    component.onSave();

    const [command, payload] = journalSpy.postJournalentries.calls.mostRecent().args;
    expect(command).toBe('defineOpeningBalance');
    expect(payload?.transactionDate).toBe('16 August 2026');
    expect(payload?.debits).toEqual([{ glAccountId: 1, amount: 100 }]);
    expect(payload?.credits).toEqual([{ glAccountId: 2, amount: 100 }]);
  });

  it('does not post an unbalanced set even if asked to', () => {
    journalSpy.getJournalentriesOpeningbalance.and.returnValue(
      of(TEMPLATE) as unknown as Observable<never>,
    );
    selectOfficeAndCurrency();
    component.rows()[0].debit = 100;
    component.recalculate();

    component.onSave();

    expect(journalSpy.postJournalentries).not.toHaveBeenCalled();
  });
});
