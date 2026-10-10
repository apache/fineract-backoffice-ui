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
import { JournalEntryFormComponent } from './journal-entry-form.component';
import {
  JournalEntriesService,
  GeneralLedgerAccountService,
  OfficesService,
  CurrencyService,
  GetOfficesResponse,
  CurrencyConfigurationData,
  GetGLAccountsResponse,
  PostJournalEntriesResponse,
} from '../../api';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HttpEvent } from '@angular/common/http';
import { expectLookedUp } from '../../testing/translated-text';

describe('JournalEntryFormComponent', () => {
  let component: JournalEntryFormComponent;
  let fixture: ComponentFixture<JournalEntryFormComponent>;
  let journalServiceSpy: SpyObj<JournalEntriesService>;
  let glAccountServiceSpy: SpyObj<GeneralLedgerAccountService>;
  let officeServiceSpy: SpyObj<OfficesService>;
  let currencyServiceSpy: SpyObj<CurrencyService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    journalServiceSpy = createSpyObj(['postJournalentries']);
    glAccountServiceSpy = createSpyObj(['getGlaccounts']);
    officeServiceSpy = createSpyObj(['getOffices']);
    currencyServiceSpy = createSpyObj(['getCurrencies']);
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [JournalEntryFormComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        { provide: JournalEntriesService, useValue: journalServiceSpy },
        { provide: GeneralLedgerAccountService, useValue: glAccountServiceSpy },
        { provide: OfficesService, useValue: officeServiceSpy },
        { provide: CurrencyService, useValue: currencyServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    officeServiceSpy.getOffices.mockReturnValue(
      of([]) as unknown as Observable<HttpEvent<GetOfficesResponse[]>>,
    );
    currencyServiceSpy.getCurrencies.mockReturnValue(
      of({ selectedCurrencyOptions: [] }) as unknown as Observable<
        HttpEvent<CurrencyConfigurationData>
      >,
    );
    glAccountServiceSpy.getGlaccounts.mockReturnValue(
      of([]) as unknown as Observable<HttpEvent<GetGLAccountsResponse[]>>,
    );

    fixture = TestBed.createComponent(JournalEntryFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should validate balance', () => {
    component.debits = [{ glAccountId: 1, amount: 100 }];
    component.credits = [{ glAccountId: 2, amount: 100 }];
    expect(component.isBalanced()).toBe(true);

    component.credits[0].amount = 50;
    expect(component.isBalanced()).toBe(false);
  });

  it('should format payload correctly on submission', () => {
    component.command.officeId = 1;
    component.command.currencyCode = 'USD';
    component.transactionDate = '2026-05-15';
    component.debits = [{ glAccountId: 10, amount: 500 }];
    component.credits = [{ glAccountId: 20, amount: 500 }];

    journalServiceSpy.postJournalentries.mockReturnValue(
      of({}) as unknown as Observable<HttpEvent<PostJournalEntriesResponse>>,
    );

    component.onSubmit();

    expect(journalServiceSpy.postJournalentries).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        officeId: 1,
        currencyCode: 'USD',
        transactionDate: '2026-05-15',
        debits: component.debits,
        credits: component.credits,
      }),
    );
  });

  it('renders its labels through the translation adapter', () => {
    expectLookedUp(fixture.nativeElement, [
      'JOURNAL_ENTRIES.CREATE',
      'JOURNAL_ENTRIES.TRANSACTION_DATE',
      'JOURNAL_ENTRIES.REFERENCE_NUMBER',
      'JOURNAL_ENTRIES.ADD_DEBIT',
      'JOURNAL_ENTRIES.ADD_CREDIT',
    ]);
  });
});
