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
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { LoanDelinquencyTabComponent } from './loan-delinquency-tab.component';
import { LoansService } from '../../../api';
import { provideFakeAdapters } from '../../../testing/adapters';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

const LOAN_ID = 42;

describe('LoanDelinquencyTabComponent', () => {
  let fixture: ComponentFixture<LoanDelinquencyTabComponent>;
  let component: LoanDelinquencyTabComponent;
  let loansService: SpyObj<LoansService>;

  async function setup(options: { fails?: boolean } = {}): Promise<void> {
    loansService = createSpyObj([
      'getLoansLoanIdDelinquencytags',
      'getLoansLoanIdDelinquencyActions',
    ]);
    if (options.fails) {
      loansService.getLoansLoanIdDelinquencytags.mockReturnValue(
        throwError(() => new Error('boom')) as never,
      );
      loansService.getLoansLoanIdDelinquencyActions.mockReturnValue(of([]) as never);
    } else {
      loansService.getLoansLoanIdDelinquencytags.mockReturnValue(
        of([{ classification: 'Delinquent 30', addedOnDate: '2026-07-01' }]) as never,
      );
      loansService.getLoansLoanIdDelinquencyActions.mockReturnValue(
        of([{ action: 'PAUSE' }]) as never,
      );
    }

    const adapters = provideFakeAdapters();
    await TestBed.configureTestingModule({
      imports: [LoanDelinquencyTabComponent],
      providers: [
        provideNoopAnimations(),
        // `app-data-table` renders through ngx-translate directly, not the I18N adapter,
        // so the fake adapters alone leave it without a TranslateService.
        ...provideTranslateTesting(),
        ...adapters.providers,
        { provide: LoansService, useValue: loansService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanDelinquencyTabComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('loanId', LOAN_ID);
    fixture.componentRef.setInput('summary', {
      pastDueDays: 12,
      delinquentDays: 9,
      delinquentAmount: 1500,
      delinquencyPausePeriods: [{ startDate: '2026-06-01', endDate: '2026-06-15', active: false }],
    });
    fixture.detectChanges();
  }

  it('fetches the tags and the actions for the loan it was given', async () => {
    await setup();

    expect(loansService.getLoansLoanIdDelinquencytags).toHaveBeenCalledWith(LOAN_ID);
    expect(loansService.getLoansLoanIdDelinquencyActions).toHaveBeenCalledWith(LOAN_ID);
    expect(component.tags()).toHaveLength(1);
  });

  it('reads the pause periods off the summary rather than fetching them', async () => {
    await setup();

    // They ride along on the loan response; a request here would be a second copy of data
    // the page already holds.
    expect(component.pausePeriods()).toHaveLength(1);
  });

  it('reports a failed load rather than showing no tags', async () => {
    await setup({ fails: true });

    // The distinction that matters: "this loan has no delinquency tags" and "we could not find
    // out" must not look the same. See issue #223.
    expect(component.hasError()).toBe(true);
    expect(component.isLoading()).toBe(false);
    expect(component.tags()).toEqual([]);
  });
});
