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
import type { Mock } from 'vitest';

import { LoanDelinquencyTabComponent } from './loan-delinquency-tab.component';
import { BusinessDateManagementService, LoansService } from '../../../api';
import { AuthService } from '../../../core/services/auth.service';
import { DialogService } from '../../../core/services/dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { provideFakeAdapters } from '../../../testing/adapters';
import { provideTestConfig } from '../../../testing/config';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

const LOAN_ID = 42;
const PAUSE_PERMISSION = 'CREATE_DELINQUENCY_ACTION';
const PAUSE_BUTTON = '[data-testid="loan-delinquency-pause"]';
const RESUME_BUTTON = '[data-testid="loan-delinquency-resume"]';

/**
 * Pause periods as Fineract sends them: `LocalDate` is `[year, month, day]` and the fields are
 * `pausePeriodStart` / `pausePeriodEnd`. The generated model types the dates as strings, so the
 * fixtures are cast — the shape they stand in for is the one the platform produces.
 */
const ENDED = { active: false, pausePeriodStart: [2026, 8, 1], pausePeriodEnd: [2026, 8, 10] };
const IN_EFFECT = { active: true, pausePeriodStart: [2026, 9, 28], pausePeriodEnd: [2026, 10, 15] };
const BUSINESS_DATE = [{ type: 'BUSINESS_DATE', date: [2026, 10, 1] }];

describe('LoanDelinquencyTabComponent', () => {
  let fixture: ComponentFixture<LoanDelinquencyTabComponent>;
  let component: LoanDelinquencyTabComponent;
  let loansService: SpyObj<LoansService>;
  let businessDates: SpyObj<BusinessDateManagementService>;
  let dialogs: SpyObj<DialogService>;
  let notifications: SpyObj<NotificationService>;
  let changed: Mock<() => void>;

  interface SetupOptions {
    fails?: boolean;
    periods?: unknown[];
    active?: boolean;
    /** Holds CREATE_DELINQUENCY_ACTION. Defaults to true. */
    permitted?: boolean;
    /** What the business date read answers with. */
    businessDate?: 'known' | 'fails';
  }

  async function setup(options: SetupOptions = {}): Promise<void> {
    const { periods = [ENDED, IN_EFFECT], active = true, permitted = true } = options;

    loansService = createSpyObj([
      'getLoansLoanIdDelinquencytags',
      'getLoansLoanIdDelinquencyActions',
      'postLoansLoanIdDelinquencyActions',
    ]);
    if (options.fails) {
      loansService.getLoansLoanIdDelinquencytags.mockReturnValue(
        throwError(() => new Error('boom')) as never,
      );
      loansService.getLoansLoanIdDelinquencyActions.mockReturnValue(of([]) as never);
    } else {
      loansService.getLoansLoanIdDelinquencytags.mockReturnValue(
        of([{ classification: 'Delinquent 30', addedOnDate: [2026, 7, 1] }]) as never,
      );
      loansService.getLoansLoanIdDelinquencyActions.mockReturnValue(
        of([{ action: 'PAUSE' }]) as never,
      );
    }
    loansService.postLoansLoanIdDelinquencyActions.mockReturnValue(of({ resourceId: 9 }) as never);

    businessDates = createSpyObj(['getBusinessdate']);
    businessDates.getBusinessdate.mockReturnValue(
      (options.businessDate === 'fails'
        ? throwError(() => new Error('down'))
        : of(BUSINESS_DATE)) as never,
    );

    dialogs = createSpyObj(['open', 'confirm']);
    notifications = createSpyObj(['success']);
    const auth = Object.assign(createSpyObj<AuthService>(['hasPermission']), {
      currentUser: () => ({ permissions: permitted ? [PAUSE_PERMISSION] : [] }),
    });
    auth.hasPermission.mockReturnValue(permitted);

    const adapters = provideFakeAdapters();
    await TestBed.configureTestingModule({
      imports: [LoanDelinquencyTabComponent],
      providers: [
        provideNoopAnimations(),
        // `app-data-table` renders through ngx-translate directly, not the I18N adapter,
        // so the fake adapters alone leave it without a TranslateService.
        ...provideTranslateTesting(),
        ...adapters.providers,
        provideTestConfig({ rbacEnabled: true }),
        { provide: LoansService, useValue: loansService },
        { provide: BusinessDateManagementService, useValue: businessDates },
        { provide: DialogService, useValue: dialogs },
        { provide: NotificationService, useValue: notifications },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanDelinquencyTabComponent);
    component = fixture.componentInstance;
    changed = vi.fn();
    component.changed.subscribe(() => changed());
    fixture.componentRef.setInput('loanId', LOAN_ID);
    fixture.componentRef.setInput('isActive', active);
    fixture.componentRef.setInput('summary', {
      pastDueDays: 12,
      delinquentDays: 9,
      delinquentAmount: 1500,
      nextPaymentDueDate: [2026, 10, 15],
      lastRepaymentDate: [2026, 7, 20],
      delinquencyPausePeriods: periods,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const button = (selector: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(selector);

  describe('reading', () => {
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
      expect(component.pausePeriods()).toHaveLength(2);
    });

    it('reports a failed load rather than showing no tags', async () => {
      await setup({ fails: true });

      // The distinction that matters: "this loan has no delinquency tags" and "we could not find
      // out" must not look the same. See issue #223.
      expect(component.hasError()).toBe(true);
      expect(component.isLoading()).toBe(false);
      expect(component.tags()).toEqual([]);
    });

    it('shows the dates as dates, not as the arrays the platform sends them in', async () => {
      await setup();

      const text: string = fixture.nativeElement.textContent;
      // Summary, tags and pause periods all carry dates.
      expect(text).toContain('2026-10-15');
      expect(text).toContain('2026-07-20');
      expect(text).toContain('2026-07-01');
      expect(text).toContain('2026-09-28');
      expect(text).not.toContain('2026,10,15');
    });

    it('says which pause is in effect', async () => {
      await setup();

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('LOANS.PAUSE_IN_EFFECT');
      expect(text).toContain('LOANS.PAUSE_NOT_IN_EFFECT');
    });
  });

  describe('which actions are offered', () => {
    it('offers pause and resume to someone permitted, on an active loan with a pause in effect', async () => {
      await setup();

      expect(button(PAUSE_BUTTON)).not.toBeNull();
      expect(button(RESUME_BUTTON)).not.toBeNull();
    });

    it('offers neither without the permission to create a delinquency action', async () => {
      await setup({ permitted: false });

      expect(button(PAUSE_BUTTON)).toBeNull();
      expect(button(RESUME_BUTTON)).toBeNull();
    });

    it('offers neither on a loan that is not active', async () => {
      // The platform: "Delinquency actions can be created only for active loans."
      await setup({ active: false });

      expect(button(PAUSE_BUTTON)).toBeNull();
      expect(button(RESUME_BUTTON)).toBeNull();
    });

    it('offers only pause when nothing is paused', async () => {
      await setup({ periods: [ENDED] });

      expect(button(PAUSE_BUTTON)).not.toBeNull();
      expect(button(RESUME_BUTTON)).toBeNull();
    });

    it('does not offer resume for a pause that ends today', async () => {
      // The state right after a resume: the pause was cut short to the business date.
      await setup({ periods: [{ ...IN_EFFECT, pausePeriodEnd: [2026, 10, 1] }] });

      expect(button(RESUME_BUTTON)).toBeNull();
    });

    it('still offers pause, but not resume, when the business date could not be read', async () => {
      await setup({ businessDate: 'fails' });

      expect(button(PAUSE_BUTTON)).not.toBeNull();
      expect(button(RESUME_BUTTON)).toBeNull();
      // Its failure is not the tables' failure.
      expect(component.hasError()).toBe(false);
    });
  });

  describe('pausing', () => {
    it('opens the dialog at the business date and sends the period it returns', async () => {
      await setup();
      dialogs.open.mockResolvedValue({ startDate: '2026-10-01', endDate: '2026-10-15' });

      await component.onPause();

      expect(dialogs.open).toHaveBeenCalledWith(expect.any(Function), {
        data: { businessDate: '2026-10-01' },
      });
      expect(loansService.postLoansLoanIdDelinquencyActions).toHaveBeenCalledWith(LOAN_ID, {
        action: 'pause',
        startDate: '01 October 2026',
        endDate: '15 October 2026',
        dateFormat: 'dd MMMM yyyy',
        locale: 'en',
      });
    });

    it('tells the parent the loan changed, says so, and reads the tags again', async () => {
      await setup();
      dialogs.open.mockResolvedValue({ startDate: '2026-10-01', endDate: '2026-10-15' });
      loansService.getLoansLoanIdDelinquencytags.mockClear();

      await component.onPause();

      expect(changed).toHaveBeenCalledTimes(1);
      expect(notifications.success).toHaveBeenCalledWith('LOANS.DELINQUENCY_PAUSED');
      expect(loansService.getLoansLoanIdDelinquencytags).toHaveBeenCalledTimes(1);
      expect(component.isActing()).toBe(false);
    });

    it('sends nothing when the dialog is cancelled', async () => {
      await setup();
      dialogs.open.mockResolvedValue(undefined);

      await component.onPause();

      expect(loansService.postLoansLoanIdDelinquencyActions).not.toHaveBeenCalled();
      expect(changed).not.toHaveBeenCalled();
    });

    it('reports nothing as changed when the platform refuses, and can be tried again', async () => {
      await setup();
      dialogs.open.mockResolvedValue({ startDate: '2026-10-01', endDate: '2026-10-15' });
      loansService.postLoansLoanIdDelinquencyActions.mockReturnValue(
        throwError(() => new Error('overlapping')) as never,
      );

      await component.onPause();

      // The refusal itself is toasted by the error interceptor, with the platform's wording.
      expect(changed).not.toHaveBeenCalled();
      expect(notifications.success).not.toHaveBeenCalled();
      expect(component.isActing()).toBe(false);
    });

    it('opens the dialog with no start when the business date is not known', async () => {
      await setup({ businessDate: 'fails' });
      dialogs.open.mockResolvedValue(undefined);

      await component.onPause();

      expect(dialogs.open).toHaveBeenCalledWith(expect.any(Function), {
        data: { businessDate: undefined },
      });
    });
  });

  describe('resuming', () => {
    it('asks first, naming the date, and then sends a resume dated the business date', async () => {
      await setup();
      dialogs.confirm.mockResolvedValue(true);

      await component.onResume();

      expect(dialogs.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          details: [{ label: 'LOANS.RESUME_DATE', value: '2026-10-01' }],
        }),
      );
      // No endDate: the platform refuses a resume that carries one.
      expect(loansService.postLoansLoanIdDelinquencyActions).toHaveBeenCalledWith(LOAN_ID, {
        action: 'resume',
        startDate: '01 October 2026',
        dateFormat: 'dd MMMM yyyy',
        locale: 'en',
      });
      expect(changed).toHaveBeenCalledTimes(1);
      expect(notifications.success).toHaveBeenCalledWith('LOANS.DELINQUENCY_RESUMED');
    });

    it('sends nothing when the confirmation is declined', async () => {
      await setup();
      dialogs.confirm.mockResolvedValue(false);

      await component.onResume();

      expect(loansService.postLoansLoanIdDelinquencyActions).not.toHaveBeenCalled();
      expect(changed).not.toHaveBeenCalled();
    });

    it('does not ask, or send, without a business date to date it by', async () => {
      await setup({ businessDate: 'fails' });

      await component.onResume();

      expect(dialogs.confirm).not.toHaveBeenCalled();
      expect(loansService.postLoansLoanIdDelinquencyActions).not.toHaveBeenCalled();
    });
  });
});
