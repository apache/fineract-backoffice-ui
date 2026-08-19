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
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { FrequentPostingsComponent } from './frequent-postings.component';
import {
  AccountingRulesService,
  CurrencyService,
  JournalEntriesService,
  PaymentTypeService,
} from '../../api';
import { NotificationService } from '../../core/services/notification.service';
import { provideFakeAdapters } from '../../testing/adapters';

const SINGLE_ACCOUNT_RULE = {
  id: 1,
  name: 'Probe Rule',
  officeId: 1,
  officeName: 'Head Office',
  debitAccounts: [{ id: 1, name: 'Cash', glCode: 'A-1' }],
  creditAccounts: [{ id: 2, name: 'Income', glCode: 'I-1' }],
};

const MULTI_ACCOUNT_RULE = {
  ...SINGLE_ACCOUNT_RULE,
  id: 2,
  debitAccounts: [
    { id: 1, name: 'Cash', glCode: 'A-1' },
    { id: 3, name: 'Bank', glCode: 'A-2' },
  ],
};

describe('FrequentPostingsComponent', () => {
  let component: FrequentPostingsComponent;
  let fixture: ComponentFixture<FrequentPostingsComponent>;
  let journalSpy: jasmine.SpyObj<JournalEntriesService>;
  let notificationsSpy: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    journalSpy = jasmine.createSpyObj('JournalEntriesService', ['postJournalentries']);
    notificationsSpy = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    const rulesSpy = jasmine.createSpyObj('AccountingRulesService', ['getAccountingrules']);
    rulesSpy.getAccountingrules.and.returnValue(
      of([SINGLE_ACCOUNT_RULE, MULTI_ACCOUNT_RULE]) as never,
    );
    const currencySpy = jasmine.createSpyObj('CurrencyService', ['getCurrencies']);
    currencySpy.getCurrencies.and.returnValue(
      of({ selectedCurrencyOptions: [{ code: 'USD', name: 'US Dollar' }] }) as never,
    );
    const paymentSpy = jasmine.createSpyObj('PaymentTypeService', ['getPaymenttypes']);
    paymentSpy.getPaymenttypes.and.returnValue(of([]) as never);

    await TestBed.configureTestingModule({
      imports: [FrequentPostingsComponent],
      providers: [
        { provide: JournalEntriesService, useValue: journalSpy },
        { provide: AccountingRulesService, useValue: rulesSpy },
        { provide: CurrencyService, useValue: currencySpy },
        { provide: PaymentTypeService, useValue: paymentSpy },
        { provide: NotificationService, useValue: notificationsSpy },
        ...provideFakeAdapters().providers,
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FrequentPostingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('expands the rule into debit and credit lines and never sends accountingRuleId', () => {
    journalSpy.postJournalentries.and.returnValue(of({}) as unknown as Observable<never>);
    component.ruleId = 1;
    component.currencyCode = 'USD';
    component.amount = 250;
    component.transactionDate = '2026-08-16';

    component.onSubmit();

    const [command, payload] = journalSpy.postJournalentries.calls.mostRecent().args;
    expect(command).toBeUndefined();
    expect(payload).toBeDefined();
    expect((payload as Record<string, unknown>)['accountingRuleId']).toBeUndefined();
    expect(payload?.debits).toEqual([{ glAccountId: 1, amount: 250 }]);
    expect(payload?.credits).toEqual([{ glAccountId: 2, amount: 250 }]);
    expect(payload?.officeId).toBe(1);
  });

  it('refuses a rule naming several accounts on a side rather than splitting the amount', () => {
    component.ruleId = 2;
    component.currencyCode = 'USD';
    component.amount = 250;

    component.onSubmit();

    expect(journalSpy.postJournalentries).not.toHaveBeenCalled();
    expect(notificationsSpy.error).toHaveBeenCalledWith('FREQUENT_POSTINGS.MULTI_ACCOUNT_RULE');
  });

  it('cannot be submitted without a rule, a currency and an amount', () => {
    expect(component.canSubmit).toBeFalse();

    component.ruleId = 1;
    expect(component.canSubmit).toBeFalse();

    component.currencyCode = 'USD';
    expect(component.canSubmit).toBeFalse();

    component.amount = 100;
    expect(component.canSubmit).toBeTrue();
  });
});
