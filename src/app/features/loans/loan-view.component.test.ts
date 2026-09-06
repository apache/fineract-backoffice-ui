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

import { createSpyObj, SpyObj } from '../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  LOAN_TAB,
  LoanViewComponent,
  isoToFineractDate,
  toEditableDate,
} from './loan-view.component';
import {
  LoansService,
  LoanBuyDownFeesService,
  LoanCapitalizedIncomeService,
  LoanDisbursementDetailsService,
  LoanTransactionsService,
  BASE_PATH,
} from '../../api';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { DialogService } from '../../core/services/dialog.service';
import { LOAN_SCHEDULE_TYPE } from '../products/loan-schedule-type';

const PRODUCT_NAME = 'Micro Loan Product';
const EXTERNAL_ID = 'ext-456';

describe('LoanViewComponent', () => {
  let component: LoanViewComponent;
  let fixture: ComponentFixture<LoanViewComponent>;
  let loansServiceSpy: SpyObj<LoansService>;
  let buyDownFeesSpy: SpyObj<LoanBuyDownFeesService>;
  let capitalizedIncomeSpy: SpyObj<LoanCapitalizedIncomeService>;
  let routerSpy: SpyObj<Router>;
  let transactionsSpy: SpyObj<LoanTransactionsService>;
  let disbursementsSpy: SpyObj<LoanDisbursementDetailsService>;
  let notificationsSpy: SpyObj<NotificationService>;

  /** A cumulative loan, i.e. one that can carry none of the progressive-only features. */
  const cumulativeLoan = {
    id: 456,
    accountNo: 'L000456',
    loanProductName: PRODUCT_NAME,
    clientName: 'Jane Smith',
    principal: 5000,
    annualInterestRate: 12,
    externalId: EXTERNAL_ID,
    loanScheduleType: { code: LOAN_SCHEDULE_TYPE.CUMULATIVE, value: 'Cumulative' },
    status: { value: 'Active' },
    repaymentSchedule: { periods: [] },
    transactions: [],
    charges: [],
  };

  async function setup(loanOverrides: Record<string, unknown> = {}): Promise<void> {
    TestBed.resetTestingModule();

    loansServiceSpy = createSpyObj(['getLoansLoanId']);
    buyDownFeesSpy = createSpyObj(['getLoansExternalIdLoanExternalIdBuydownFees']);
    capitalizedIncomeSpy = createSpyObj(['getLoansExternalIdLoanExternalIdCapitalizedIncomes']);
    routerSpy = createSpyObj(['navigate']);
    transactionsSpy = createSpyObj(['postLoansLoanIdTransactions']);
    transactionsSpy.postLoansLoanIdTransactions.mockReturnValue(of({}) as any);
    disbursementsSpy = createSpyObj([
      'getLoansLoanIdDisbursementsDisbursementId',
      'putLoansLoanIdDisbursementsDisbursementId',
    ]);
    disbursementsSpy.putLoansLoanIdDisbursementsDisbursementId.mockReturnValue(of({}) as any);
    notificationsSpy = createSpyObj(['success', 'error']);

    const authServiceSpy = Object.assign(createSpyObj<AuthService>(['hasPermission']), {
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

    loansServiceSpy.getLoansLoanId.mockReturnValue(
      of({ ...cumulativeLoan, ...loanOverrides }) as any,
    );
    buyDownFeesSpy.getLoansExternalIdLoanExternalIdBuydownFees.mockReturnValue(of([]) as any);
    capitalizedIncomeSpy.getLoansExternalIdLoanExternalIdCapitalizedIncomes.mockReturnValue(
      of([]) as any,
    );

    await TestBed.configureTestingModule({
      imports: [LoanViewComponent, TranslateModule.forRoot()],
      providers: [
        provideNoopAnimations(),
        provideIonicTesting(),
        { provide: LoansService, useValue: loansServiceSpy },
        { provide: LoanBuyDownFeesService, useValue: buyDownFeesSpy },
        { provide: LoanCapitalizedIncomeService, useValue: capitalizedIncomeSpy },
        { provide: LoanTransactionsService, useValue: transactionsSpy },
        { provide: LoanDisbursementDetailsService, useValue: disbursementsSpy },
        { provide: NotificationService, useValue: notificationsSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: BASE_PATH, useValue: 'https://example.com/fineract-provider/api' },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: (key: string) => (key === 'id' ? '456' : null) }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load loan details on init', () => {
    expect(loansServiceSpy.getLoansLoanId).toHaveBeenCalledWith(456, false, 'all');
    expect(component.loan()?.loanProductName).toBe(PRODUCT_NAME);
  });

  /**
   * Buy-down fees and capitalised income are capabilities of the progressive engine. On a
   * cumulative loan the tabs could never hold anything, and an empty table gives the user no way
   * to tell "none recorded" from "not applicable" — so they must be absent, not merely empty.
   */
  describe('progressive-only tabs on a loan that cannot have them', () => {
    it('hides both tabs', () => {
      expect(component.showBuyDownFees()).toBe(false);
      expect(component.showCapitalizedIncome()).toBe(false);

      const labels = fixture.nativeElement.textContent as string;
      expect(labels).not.toContain('LOANS.BUY_DOWN_FEES');
      expect(labels).not.toContain('LOANS.CAPITALIZED_INCOME');
    });

    it('does not request data it knows cannot exist', () => {
      expect(buyDownFeesSpy.getLoansExternalIdLoanExternalIdBuydownFees).not.toHaveBeenCalled();
      expect(
        capitalizedIncomeSpy.getLoansExternalIdLoanExternalIdCapitalizedIncomes,
      ).not.toHaveBeenCalled();
    });

    it('falls back to the overview if such a tab is somehow selected', () => {
      component.activeTab.set(LOAN_TAB.buyDownFees);
      fixture.detectChanges();

      expect(component.activeTab()).toBe(LOAN_TAB.overview);
    });
  });

  describe('when the loan reports the capability', () => {
    it('shows the buy-down tab and fetches it', async () => {
      await setup({
        loanScheduleType: { code: LOAN_SCHEDULE_TYPE.PROGRESSIVE, value: 'Progressive' },
        enableBuyDownFee: true,
      });

      expect(component.showBuyDownFees()).toBe(true);
      expect(component.showCapitalizedIncome()).toBe(false);
      expect(buyDownFeesSpy.getLoansExternalIdLoanExternalIdBuydownFees).toHaveBeenCalledWith(
        EXTERNAL_ID,
      );
      expect(
        capitalizedIncomeSpy.getLoansExternalIdLoanExternalIdCapitalizedIncomes,
      ).not.toHaveBeenCalled();
    });

    it('shows the capitalised income tab and fetches it', async () => {
      await setup({
        loanScheduleType: { code: LOAN_SCHEDULE_TYPE.PROGRESSIVE, value: 'Progressive' },
        enableIncomeCapitalization: true,
      });

      expect(component.showCapitalizedIncome()).toBe(true);
      expect(component.showBuyDownFees()).toBe(false);
      expect(
        capitalizedIncomeSpy.getLoansExternalIdLoanExternalIdCapitalizedIncomes,
      ).toHaveBeenCalledWith(EXTERNAL_ID);
    });

    it('keeps the tab selectable once it is available', async () => {
      await setup({
        loanScheduleType: { code: LOAN_SCHEDULE_TYPE.PROGRESSIVE, value: 'Progressive' },
        enableBuyDownFee: true,
      });

      component.activeTab.set(LOAN_TAB.buyDownFees);
      fixture.detectChanges();

      expect(component.activeTab()).toBe(LOAN_TAB.buyDownFees);
    });

    it('still skips the request when the loan has no external id to fetch by', async () => {
      await setup({ enableBuyDownFee: true, externalId: undefined });

      expect(component.showBuyDownFees()).toBe(true);
      expect(buyDownFeesSpy.getLoansExternalIdLoanExternalIdBuydownFees).not.toHaveBeenCalled();
    });
  });

  /**
   * Fineract keeps a charged-off loan `Active` and flags it separately, so the status badge alone
   * cannot distinguish it — an officer would otherwise see a normal active loan and act on it.
   */
  describe('charge-off', () => {
    it('offers charge-off on a loan that is not charged off', async () => {
      expect(component.chargedOff()).toBe(false);
      expect(
        fixture.nativeElement.querySelector('[data-testid="loan-charged-off-chip"]'),
      ).toBeNull();
    });

    it('shows that a charged-off loan is charged off', async () => {
      await setup({ chargedOff: true });

      expect(component.chargedOff()).toBe(true);
      expect(
        fixture.nativeElement.querySelector('[data-testid="loan-charged-off-chip"]'),
      ).not.toBeNull();
    });

    it('sends an empty body when undoing, which is what the command accepts', async () => {
      await setup({ chargedOff: true });
      const dialog = TestBed.inject(DialogService);
      vi.spyOn(dialog, 'confirm').mockReturnValue(Promise.resolve(true));

      component.onUndoChargeOff();
      await fixture.whenStable();

      // `undo-charge-off` rejects `locale` and `dateFormat`, so it cannot go through the shared
      // transaction form — hence the direct call with `{}`.
      expect(transactionsSpy.postLoansLoanIdTransactions).toHaveBeenCalledWith(
        456,
        {},
        'undo-charge-off',
      );
    });

    it('does nothing when the confirmation is declined', async () => {
      await setup({ chargedOff: true });
      const dialog = TestBed.inject(DialogService);
      vi.spyOn(dialog, 'confirm').mockReturnValue(Promise.resolve(false));

      component.onUndoChargeOff();
      await fixture.whenStable();

      expect(transactionsSpy.postLoansLoanIdTransactions).not.toHaveBeenCalled();
    });
  });

  /**
   * Every servicing command Fineract exposes is gated on the state that makes it legal. The
   * server enforces these too — re-amortize answers "only available for progressive repayment
   * schedule and Advanced payment allocation strategy", undo-write-off "loan status is not
   * written off" — but a menu that offers an action only to have it rejected is a worse
   * experience than one that does not offer it.
   *
   * Asserted on the gating itself rather than the rendered menu: the actions live inside an
   * `ion-popover` template, which is not in the DOM until the popover is opened. The mocked e2e
   * spec opens it and checks what is actually on screen.
   */
  describe('servicing actions by loan state', () => {
    it('treats a cumulative loan as ineligible for the progressive-only commands', () => {
      expect(component.isProgressiveLoan()).toBe(false);
      expect(component.canTakeDownPayment()).toBe(false);
    });

    it('allows the progressive-only commands on a progressive loan', async () => {
      await setup({
        loanScheduleType: { code: LOAN_SCHEDULE_TYPE.PROGRESSIVE, value: 'Progressive' },
      });

      expect(component.isProgressiveLoan()).toBe(true);
    });

    it('allows a down payment only when the product enabled one', async () => {
      await setup({
        loanScheduleType: { code: LOAN_SCHEDULE_TYPE.PROGRESSIVE, value: 'Progressive' },
      });
      expect(component.canTakeDownPayment()).toBe(false);

      await setup({
        loanScheduleType: { code: LOAN_SCHEDULE_TYPE.PROGRESSIVE, value: 'Progressive' },
        enableDownPayment: true,
      });
      expect(component.canTakeDownPayment()).toBe(true);
    });

    it('requires a down payment product to be progressive as well', async () => {
      await setup({
        loanScheduleType: { code: LOAN_SCHEDULE_TYPE.CUMULATIVE, value: 'Cumulative' },
        enableDownPayment: true,
      });

      expect(component.canTakeDownPayment()).toBe(false);
    });

    it('recognises an overpaid loan, which is the only one with a balance to refund', async () => {
      expect(component.isOverpaid()).toBe(false);

      await setup({ status: { value: 'Overpaid', overpaid: true } });

      expect(component.isOverpaid()).toBe(true);
    });

    it('recognises a written-off loan, which recovery and undo both require', async () => {
      expect(component.isWrittenOff()).toBe(false);

      await setup({ status: { value: 'Closed (written off)', closedWrittenOff: true } });

      expect(component.isWrittenOff()).toBe(true);
    });
  });

  describe('refund by cash', () => {
    const ADVANCE = { paidInAdvance: { paidInAdvance: 250 } };

    it('routes to the shared transaction form under the command name the platform expects', async () => {
      await setup(ADVANCE);

      component.onLoanTransactionAction('refundByCash');

      // The route's :type segment becomes the `command` query parameter on
      // POST /loans/{id}/transactions, so the casing here is not cosmetic —
      // the platform answers "unsupported" to anything it does not match.
      expect(routerSpy.navigate).toHaveBeenCalledWith([
        `/loans/${component.loanId()}/transactions/refundByCash`,
      ]);
    });

    /**
     * The platform refuses a cash refund on a loan with nothing paid ahead (403
     * `error.msg.loan.refund.amount.invalid`), so the action must not be offered there.
     */
    it('is withheld from a loan carrying no advance balance', async () => {
      await setup();
      expect(component.hasAdvanceBalance()).toBe(false);

      await setup({ paidInAdvance: { paidInAdvance: 0 } });
      expect(component.hasAdvanceBalance()).toBe(false);
    });

    it('is offered once the loan is paid ahead of schedule', async () => {
      await setup(ADVANCE);

      expect(component.hasAdvanceBalance()).toBe(true);
    });
  });
  /**
   * `PUT /loans/{loanId}/disbursements/{disbursementId}` runs Fineract's `updateDisbursementDate`
   * command, which is stricter than the screen used to assume. Verified against a multi-tranche
   * loan on a live 1.16.0-SNAPSHOT platform:
   *
   * - `principal` and `note` come back 400 `error.msg.parameter.unsupported`; a single stray
   *   parameter fails the whole request, so the old body never once succeeded.
   * - `expectedDisbursementDate` is mandatory and separate from the edit —
   *   `validation.msg.loan.update.disbursement.expectedDisbursementDate.cannot.be.blank`.
   * - `updatedPrincipal` is mandatory too, reported as
   *   `validation.msg.loan.update.disbursement.principal.cannot.be.blank`.
   * - Omitting `dateFormat`/`locale` fails with `validation.msg.missing.dateFormat.parameter`.
   */
  describe('editing a disbursement tranche', () => {
    const TRANCHE = { id: 1, loanId: 456, expectedDisbursementDate: [2026, 8, 10], principal: 650 };

    async function loadTranche(): Promise<void> {
      disbursementsSpy.getLoansLoanIdDisbursementsDisbursementId.mockReturnValue(
        of(TRANCHE) as any,
      );
      component.editDisbId = 1;
      component.loadDisbursementDetail();
    }

    it('turns the year/month/day array the platform sends into a date the form can bind', async () => {
      await loadTranche();

      expect(component.disbursementEditForm.expectedDisbursementDate).toBe('2026-08-10');
      expect(component.disbursementEditForm.principal).toBe(650);
    });

    it('sends the tranche date as the anchor and the edit as the update', async () => {
      await loadTranche();
      component.disbursementEditForm.expectedDisbursementDate = '2026-08-20';
      component.disbursementEditForm.principal = 700;

      component.saveDisbursementDetail();

      expect(disbursementsSpy.putLoansLoanIdDisbursementsDisbursementId).toHaveBeenCalledWith(
        456,
        1,
        {
          expectedDisbursementDate: '10 August 2026',
          updatedExpectedDisbursementDate: '20 August 2026',
          updatedPrincipal: 700,
          dateFormat: 'dd MMMM yyyy',
          locale: 'en',
        },
      );
    });

    it('sends nothing the command would reject', async () => {
      await loadTranche();

      component.saveDisbursementDetail();

      const body = disbursementsSpy.putLoansLoanIdDisbursementsDisbursementId.mock
        .calls[0][2] as Record<string, unknown>;
      // Named individually rather than compared as a set, so a future addition has to be a
      // deliberate edit here — the command fails outright on anything it does not recognise.
      expect(body).not.toHaveProperty('note');
      expect(body).not.toHaveProperty('principal');
      expect(new Set(Object.keys(body))).toEqual(
        new Set([
          'dateFormat',
          'expectedDisbursementDate',
          'locale',
          'updatedExpectedDisbursementDate',
          'updatedPrincipal',
        ]),
      );
    });

    it('asks for a date rather than letting the platform reject a blank one', async () => {
      await loadTranche();
      component.disbursementEditForm.expectedDisbursementDate = '';

      component.saveDisbursementDetail();

      expect(disbursementsSpy.putLoansLoanIdDisbursementsDisbursementId).not.toHaveBeenCalled();
      expect(notificationsSpy.error).toHaveBeenCalled();
    });
  });

  describe('date conversion for the disbursement command', () => {
    it('reads a bare YYYY-MM-DD in local time', () => {
      // `new Date('2026-08-01')` is UTC midnight, which `formatDateToFineract` then reads back
      // with local getters — one day earlier for anyone west of Greenwich. The 1st of the month
      // is the case that exposes it, because the shift crosses into the previous month.
      expect(isoToFineractDate('2026-08-01')).toBe('01 August 2026');
      expect(isoToFineractDate('2026-01-01')).toBe('01 January 2026');
    });

    it('yields nothing for a value the command could not parse', () => {
      expect(isoToFineractDate('')).toBe('');
      expect(isoToFineractDate('not-a-date')).toBe('');
    });

    it('accepts either shape the disbursement endpoint answers with', () => {
      expect(toEditableDate([2026, 8, 10])).toBe('2026-08-10');
      expect(toEditableDate('2026-08-10T00:00:00')).toBe('2026-08-10');
      expect(toEditableDate(undefined)).toBe('');
      expect(toEditableDate([2026])).toBe('');
    });
  });
});
