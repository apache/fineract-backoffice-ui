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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SavingsAccountViewComponent } from './savings-account-view.component';
import { SavingsAccountService } from '../../api';
import { AuthService } from '../../core/services/auth.service';
import { DialogService } from '../../core/services/dialog.service';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { createSpyObj, SpyObj } from '../../testing/mocks';
import { provideFakeAdapters } from '../../testing/adapters';
import { expectLookedUp } from '../../testing/translated-text';

describe('SavingsAccountViewComponent', () => {
  let component: SavingsAccountViewComponent;
  let fixture: ComponentFixture<SavingsAccountViewComponent>;
  let savingsServiceSpy: SpyObj<SavingsAccountService>;
  let authServiceSpy: SpyObj<AuthService>;
  let routerSpy: SpyObj<Router>;
  let dialogServiceSpy: SpyObj<DialogService>;

  beforeEach(async () => {
    savingsServiceSpy = createSpyObj<SavingsAccountService>([
      'getSavingsaccountsAccountId',
      'postSavingsaccountsAccountId',
    ]);
    authServiceSpy = Object.assign(createSpyObj<AuthService>(['hasPermission']), {
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
    routerSpy = createSpyObj<Router>(['navigate']);
    dialogServiceSpy = createSpyObj<DialogService>(['open', 'confirm']);

    await TestBed.configureTestingModule({
      imports: [SavingsAccountViewComponent],
      providers: [
        provideIonicTesting(),
        provideNoopAnimations(),
        ...provideFakeAdapters().providers,
        { provide: SavingsAccountService, useValue: savingsServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogServiceSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({
              get: (key: string) => (key === 'id' ? '789' : null),
            }),
          },
        },
      ],
    }).compileComponents();

    savingsServiceSpy.postSavingsaccountsAccountId.mockReturnValue(
      of({}) as unknown as ReturnType<SavingsAccountService['postSavingsaccountsAccountId']>,
    );

    savingsServiceSpy.getSavingsaccountsAccountId.mockReturnValue(
      of({
        id: 789,
        accountNo: 'SA000789',
        savingsProductName: 'Regular Savings',
        clientName: 'Jane Smith',
        nominalAnnualInterestRate: 4,
        status: { value: 'Active' },
        transactions: [],
        charges: [],
      }) as any,
    );

    fixture = TestBed.createComponent(SavingsAccountViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load savings details on init', () => {
    expect(savingsServiceSpy.getSavingsaccountsAccountId).toHaveBeenCalledWith(
      789,
      false,
      undefined,
      'all',
    );
    expect(component.account()?.savingsProductName).toBe('Regular Savings');
  });

  it('renders the overview labels through the translation adapter', () => {
    expectLookedUp(fixture.nativeElement, [
      'SAVINGS.INTEREST_SETTINGS',
      'SAVINGS.NOMINAL_ANNUAL_INTEREST_RATE',
      'SAVINGS.COMPOUNDING_PERIOD',
      'SAVINGS.POSTING_PERIOD',
      'SAVINGS.INTEREST_CALC_DAYS_IN_YEAR',
      'SAVINGS.TIMELINE_AND_BALANCE',
      'COMMON.SUBMITTED_ON_DATE',
      'SAVINGS.ACTIVATED_ON_DATE',
      'SAVINGS.FIELD_OFFICER',
      'SAVINGS.BALANCE',
    ]);
  });

  /**
   * Fineract records a block in `subStatus` and leaves `status` as `Active`, so the status badge
   * cannot distinguish a frozen account from a healthy one. It also rejects each reversal unless
   * the matching block is actually in force — `unblockDebit` answers "debits.are.not.blocked" —
   * so each is offered only in the state that permits it.
   */
  describe('block state', () => {
    function withSubStatus(subStatus: Record<string, boolean>): void {
      component.account.set({
        ...component.account(),
        status: { active: true },
        subStatus,
      } as never);
    }

    it('reports no block on a healthy account', () => {
      withSubStatus({ block: false, blockDebit: false, blockCredit: false });

      expect(component.isBlocked()).toBe(false);
      expect(component.isDebitBlocked()).toBe(false);
      expect(component.isCreditBlocked()).toBe(false);
      expect(component.blockLabelKey()).toBeNull();
    });

    it('distinguishes a debit block from a credit block', () => {
      withSubStatus({ block: false, blockDebit: true, blockCredit: false });
      expect(component.blockLabelKey()).toBe('SAVINGS.DEBITS_BLOCKED');

      withSubStatus({ block: false, blockDebit: false, blockCredit: true });
      expect(component.blockLabelKey()).toBe('SAVINGS.CREDITS_BLOCKED');
    });

    it('treats a full block, and both partial blocks together, as frozen', () => {
      withSubStatus({ block: true, blockDebit: false, blockCredit: false });
      expect(component.blockLabelKey()).toBe('SAVINGS.BLOCKED');

      withSubStatus({ block: false, blockDebit: true, blockCredit: true });
      expect(component.blockLabelKey()).toBe('SAVINGS.BLOCKED');
    });
  });

  /**
   * Each command is offered only in the state that permits it. Fineract enforces these too, but a
   * menu that offers an action only to have it rejected is a worse experience than one that does
   * not offer it.
   */
  describe('officer assignment', () => {
    it('reports no officer when Fineract returns the zero sentinel', () => {
      component.account.set({
        ...component.account(),
        status: { active: true },
        fieldOfficerId: 0,
      } as never);

      // Fineract reports "unassigned" as 0 rather than omitting the field, so a plain
      // truthiness check on the id would be right by accident and a `!= null` check wrong.
      expect(component.hasOfficer()).toBe(false);
    });

    it('reports an officer once one is assigned', () => {
      component.account.set({
        ...component.account(),
        status: { active: true },
        fieldOfficerId: 7,
      } as never);

      expect(component.hasOfficer()).toBe(true);
    });
  });

  /**
   * Fineract is lenient about `undo` — it answers 200 for an already-reversed transaction, and for
   * a hold or a release, without doing anything useful. `releaseAmount` is the opposite: it
   * refuses a second release with `validation.msg.amount.is.not.on.hold`. Both cases would leave a
   * teller pressing a button that either lies or errors, so the screen gates them itself.
   */
  describe('transaction actions', () => {
    const deposit = { id: 1, reversed: false, transactionType: { deposit: true } };
    const reversedDeposit = { id: 2, reversed: true, transactionType: { deposit: true } };
    const openHold = {
      id: 3,
      reversed: false,
      releaseTransactionId: 0,
      transactionType: { amountHold: true },
    };
    const releasedHold = {
      id: 4,
      reversed: false,
      releaseTransactionId: 9,
      transactionType: { amountHold: true },
    };
    const release = { id: 5, reversed: false, transactionType: { amountRelease: true } };

    it('offers undo only on a live money movement', () => {
      expect(component.canUndo(deposit as any)).toBe(true);
      expect(component.canUndo(reversedDeposit as any)).toBe(false);
      expect(component.canUndo(openHold as any)).toBe(false);
      expect(component.canUndo(release as any)).toBe(false);
    });

    /**
     * `releaseTransactionId` is `0` while the hold stands rather than absent, so a `!= null`
     * check would report every open hold as already released.
     */
    it('offers release only on a hold that still ties up money', () => {
      expect(component.canRelease(openHold as any)).toBe(true);
      expect(component.canRelease(releasedHold as any)).toBe(false);
      expect(component.canRelease(deposit as any)).toBe(false);
    });
  });

  /**
   * `undoapproval` rejects `dateFormat`/`locale` — the platform answers 400 for parameters it
   * does not expect there, unlike almost every other command on this account. The dialog must
   * therefore send an empty body, or one carrying only `note`, never the pair every other
   * command on this screen sends by default.
   */
  describe('undo approval', () => {
    it('sends an empty body when the dialog is confirmed with no note', async () => {
      dialogServiceSpy.open.mockResolvedValue({});

      component.onUndoApproval();
      await Promise.resolve();

      expect(savingsServiceSpy.postSavingsaccountsAccountId).toHaveBeenCalledWith(
        789,
        {},
        'undoapproval',
      );
    });

    it('sends only the note when the dialog is confirmed with one', async () => {
      dialogServiceSpy.open.mockResolvedValue({ note: 'Approved amount was wrong' });

      component.onUndoApproval();
      await Promise.resolve();

      expect(savingsServiceSpy.postSavingsaccountsAccountId).toHaveBeenCalledWith(
        789,
        { note: 'Approved amount was wrong' } as never,
        'undoapproval',
      );
    });

    it('does nothing when the dialog is dismissed without a result', async () => {
      dialogServiceSpy.open.mockResolvedValue(undefined);

      component.onUndoApproval();
      await Promise.resolve();

      expect(savingsServiceSpy.postSavingsaccountsAccountId).not.toHaveBeenCalled();
    });
  });
  /**
   * The platform refuses a deposit or a withdrawal unless the account is active —
   * `error.msg.savingsaccount.transaction.account.is.not.active`. Offering the buttons on an
   * account that is still awaiting approval led to a filled-in transaction form and a rejection
   * on submit, so they are withheld in exactly the states the platform rejects.
   */
  describe('transaction buttons', () => {
    function withStatus(status: Record<string, unknown>): void {
      component.account.set({ ...component.account(), status } as never);
      fixture.detectChanges();
    }

    const TEST_ID = {
      deposit: '[data-testid="savings-deposit-action"]',
      withdraw: '[data-testid="savings-withdraw-action"]',
    } as const;

    function buttonFor(action: keyof typeof TEST_ID): Element | null {
      return fixture.nativeElement.querySelector(TEST_ID[action]);
    }

    it('offers deposit and withdrawal on an active account', () => {
      withStatus({ value: 'Active', active: true });

      expect(buttonFor('deposit')).not.toBeNull();
      expect(buttonFor('withdraw')).not.toBeNull();
    });

    it('withholds both from an account awaiting approval', () => {
      withStatus({ value: 'Submitted and pending approval', submittedAndPendingApproval: true });

      expect(buttonFor('deposit')).toBeNull();
      expect(buttonFor('withdraw')).toBeNull();
    });

    it('withholds both from a closed account', () => {
      withStatus({ value: 'Closed', closed: true });

      expect(buttonFor('deposit')).toBeNull();
      expect(buttonFor('withdraw')).toBeNull();
    });
  });

  describe('teardown', () => {
    it('dismisses popovers when destroyed', () => {
      component.account.set({ id: 789, status: { active: true } } as never);
      fixture.detectChanges();

      const withPopovers = component as unknown as {
        popovers: () => readonly { dismiss: () => Promise<boolean> }[];
      };
      const popovers = withPopovers.popovers();
      expect(popovers.length).toBeGreaterThan(0);
      const dismissSpies = popovers.map((popover) =>
        vi.spyOn(popover, 'dismiss').mockResolvedValue(true),
      );

      fixture.destroy();

      for (const spy of dismissSpies) {
        expect(spy).toHaveBeenCalled();
      }
    });
  });
});
