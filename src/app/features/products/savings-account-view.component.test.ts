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
import { SavingsAccountService, SavingsAccountTransactionsService } from '../../api';
import { AuthService } from '../../core/services/auth.service';
import { DialogService } from '../../core/services/dialog.service';
import { ActivatedRoute, ParamMap, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, Observable, Subject, finalize, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { createSpyObj, SpyObj } from '../../testing/mocks';
import { provideFakeAdapters } from '../../testing/adapters';
import { expectLookedUp } from '../../testing/translated-text';
import { BreadcrumbService } from '../../core/services/breadcrumb.service';

type AccountResponse = NonNullable<ReturnType<SavingsAccountViewComponent['account']>>;

describe('SavingsAccountViewComponent', () => {
  let component: SavingsAccountViewComponent;
  let fixture: ComponentFixture<SavingsAccountViewComponent>;
  let savingsServiceSpy: SpyObj<SavingsAccountService>;
  let transactionsServiceSpy: SpyObj<SavingsAccountTransactionsService>;
  let authServiceSpy: SpyObj<AuthService>;
  let routerSpy: SpyObj<Router>;
  let dialogServiceSpy: SpyObj<DialogService>;
  let routeParams: BehaviorSubject<ParamMap>;

  beforeEach(async () => {
    routeParams = new BehaviorSubject(convertToParamMap({ id: '789' }));
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
    transactionsServiceSpy = createSpyObj<SavingsAccountTransactionsService>([
      'postSavingsaccountsSavingsIdTransactionsTransactionId',
    ]);
    transactionsServiceSpy.postSavingsaccountsSavingsIdTransactionsTransactionId.mockReturnValue(
      of({}) as any,
    );
    routerSpy = createSpyObj<Router>(['navigate']);
    dialogServiceSpy = createSpyObj<DialogService>(['open', 'confirm']);

    await TestBed.configureTestingModule({
      imports: [SavingsAccountViewComponent],
      providers: [
        provideIonicTesting(),
        provideNoopAnimations(),
        ...provideFakeAdapters().providers,
        { provide: SavingsAccountService, useValue: savingsServiceSpy },
        { provide: SavingsAccountTransactionsService, useValue: transactionsServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogServiceSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routeParams,
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
        clientId: 42,
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
    // `associations=all` is what brings the transactions and charges with the account; the
    // trailing arguments are the generated signature's `observe`, `reportProgress` and options —
    // the last carrying `skipErrorToast`, because this screen reports a failure itself.
    expect(savingsServiceSpy.getSavingsaccountsAccountId).toHaveBeenCalledWith(
      789,
      false,
      undefined,
      'all',
      'body',
      false,
      expect.objectContaining({ context: expect.anything() }),
    );
    expect(component.account()?.savingsProductName).toBe('Regular Savings');
    expect(component.loadError()).toBeNull();
    expect(component.isLoading()).toBe(false);
  });

  describe('breadcrumbs and account reloads', () => {
    function mockResponse(response: Observable<AccountResponse>): void {
      savingsServiceSpy.getSavingsaccountsAccountId.mockReturnValue(
        response as unknown as ReturnType<SavingsAccountService['getSavingsaccountsAccountId']>,
      );
    }

    it.each<{
      owner: Partial<AccountResponse>;
      listKey: string;
      path: string;
      name: string;
    }>([
      {
        owner: { clientId: 42, clientName: 'Jane Smith' },
        listKey: 'nav.clients',
        path: '/clients/view/42',
        name: 'Jane Smith',
      },
      {
        owner: { groupId: 7, groupName: 'Savings Group' },
        listKey: 'nav.groups',
        path: '/groups/view/7',
        name: 'Savings Group',
      },
      {
        owner: { clientId: 42, clientName: 'Jane Smith', groupId: 7, groupName: 'Savings Group' },
        listKey: 'nav.clients',
        path: '/clients/view/42',
        name: 'Jane Smith',
      },
    ])('builds the owner trail for $path', ({ owner, listKey, path, name }) => {
      mockResponse(of({ ...owner, accountNo: 'SA000789' }));
      component.loadAccountData();

      expect(TestBed.inject(BreadcrumbService).override()).toEqual([
        {
          label: { kind: 'translation', key: listKey },
          url: path.startsWith('/clients') ? '/clients' : '/groups',
        },
        { label: { kind: 'text', text: name }, url: path },
        {
          label: {
            kind: 'translation',
            key: 'BREADCRUMBS.SAVINGS_ACCOUNT',
            params: { accountNo: 'SA000789' },
          },
        },
      ]);
    });

    it.each<AccountResponse>([
      { accountNo: 'SA000789' },
      { clientId: 42, clientName: ' ', accountNo: 'SA000789' },
      { groupId: 7, groupName: ' ', accountNo: 'SA000789' },
      { clientId: 42, clientName: 'Jane Smith', accountNo: ' ' },
    ])('clears the previous trail when owner or account data is incomplete: %j', (data) => {
      const breadcrumbs = TestBed.inject(BreadcrumbService);
      expect(breadcrumbs.override()).toHaveLength(3);
      mockResponse(of(data));
      component.loadAccountData();
      expect(breadcrumbs.override()).toEqual([]);
    });

    it('cancels a pending reload and keeps the spinner active for the replacement', () => {
      const first = new Subject<AccountResponse>();
      const second = new Subject<AccountResponse>();
      const cancelled = vi.fn();
      mockResponse(first.pipe(finalize(cancelled)));
      component.loadAccountData();
      expect(component.isLoading()).toBe(true);
      mockResponse(second);
      component.loadAccountData();
      expect(cancelled).toHaveBeenCalledOnce();
      expect(component.isLoading()).toBe(true);

      second.next({ clientId: 43, clientName: 'New owner', accountNo: 'NEW' });
      second.complete();
      first.next({ clientId: 42, clientName: 'Stale owner', accountNo: 'OLD' });
      expect(component.account()?.clientName).toBe('New owner');
      expect(component.isLoading()).toBe(false);
      expect(TestBed.inject(BreadcrumbService).override()?.[1].label).toEqual({
        kind: 'text',
        text: 'New owner',
      });
    });

    it('clears the previous trail and cancels the request when the account ID changes', () => {
      const first = new Subject<AccountResponse>();
      const second = new Subject<AccountResponse>();
      const cancelled = vi.fn();
      mockResponse(first.pipe(finalize(cancelled)));
      component.loadAccountData();
      mockResponse(second);
      routeParams.next(convertToParamMap({ id: '790' }));

      expect(cancelled).toHaveBeenCalledOnce();
      expect(component.accountId).toBe(790);
      expect(savingsServiceSpy.getSavingsaccountsAccountId).toHaveBeenLastCalledWith(
        790,
        false,
        undefined,
        'all',
        'body',
        false,
        expect.objectContaining({ context: expect.anything() }),
      );
      expect(TestBed.inject(BreadcrumbService).override()).toEqual([]);
      expect(component.isLoading()).toBe(true);
    });

    it('can reload successfully after an error and clears the old breadcrumb on failure', () => {
      mockResponse(throwError(() => new HttpErrorResponse({ status: 500 })));
      component.loadAccountData();
      expect(component.loadError()).toBe('failed');
      expect(component.isLoading()).toBe(false);
      expect(TestBed.inject(BreadcrumbService).override()).toEqual([]);

      mockResponse(of({ clientId: 42, clientName: 'Recovered owner', accountNo: 'SA000789' }));
      component.loadAccountData();
      expect(component.loadError()).toBeNull();
      expect(component.isLoading()).toBe(false);
      expect(component.account()?.clientName).toBe('Recovered owner');
      expect(TestBed.inject(BreadcrumbService).override()).toHaveLength(3);
    });

    it('cancels the request and prevents late breadcrumbs after destruction', () => {
      const response = new Subject<AccountResponse>();
      const cancelled = vi.fn();
      const breadcrumbs = TestBed.inject(BreadcrumbService);
      mockResponse(response.pipe(finalize(cancelled)));
      component.loadAccountData();
      fixture.destroy();
      expect(cancelled).toHaveBeenCalledOnce();
      response.next({ clientId: 99, clientName: 'Late owner', accountNo: 'OLD' });
      expect(breadcrumbs.override()).toBeNull();
      expect(component.account()?.clientName).toBe('Jane Smith');
      savingsServiceSpy.getSavingsaccountsAccountId.mockClear();
      component.loadAccountData();
      routeParams.next(convertToParamMap({ id: '790' }));
      expect(savingsServiceSpy.getSavingsaccountsAccountId).not.toHaveBeenCalled();
    });
  });

  /**
   * #763. A failed account read rendered the breadcrumb and an empty page: no message, no retry,
   * no spinner, so staff could not tell a missing account from a broken request.
   */
  describe('when the account cannot be loaded', () => {
    function failWith(status: number): void {
      savingsServiceSpy.getSavingsaccountsAccountId.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status })) as never,
      );
      component.loadAccountData();
      fixture.detectChanges();
    }

    it('shows the shared error state with a working retry', () => {
      failWith(500);

      expect(component.loadError()).toBe('failed');
      const panel = fixture.nativeElement.querySelector('[data-testid="savings-load-error"]');
      expect(panel).not.toBeNull();
      expect(panel.getAttribute('role')).toBe('alert');

      const retry = fixture.nativeElement.querySelector(
        '[data-testid="savings-load-error-action"]',
      );
      expect(retry).not.toBeNull();

      // And the retry actually re-reads: the count goes up when it is pressed.
      const before = savingsServiceSpy.getSavingsaccountsAccountId.mock.calls.length;
      retry.click();
      expect(savingsServiceSpy.getSavingsaccountsAccountId.mock.calls.length).toBe(before + 1);
    });

    it('offers no retry for a 404 or a 403, which cannot succeed on a second try', () => {
      failWith(404);
      expect(component.loadError()).toBe('not-found');

      failWith(403);
      expect(component.loadError()).toBe('not-found');
    });

    it('stops showing the spinner once the read has failed', () => {
      failWith(500);

      expect(component.isLoading()).toBe(false);
      expect(fixture.nativeElement.querySelector('[data-testid="savings-loading"]')).toBeNull();
    });
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

    /**
     * Modify is stricter than undo, and the three conditions are the ones
     * `adjustSavingsTransaction` checks before it does anything — each answered with an error
     * rather than a no-op, so offering the control would be offering a failure.
     */
    describe('modify', () => {
      const withdrawal = { id: 6, reversed: false, transactionType: { withdrawal: true } };
      const interestPosting = {
        id: 7,
        reversed: false,
        transactionType: { interestPosting: true },
      };
      const transferredDeposit = {
        id: 8,
        reversed: false,
        transactionType: { deposit: true },
        transfer: { id: 3 },
      };

      it('offers modify on a deposit or a withdrawal', () => {
        expect(component.canModify(deposit as any)).toBe(true);
        expect(component.canModify(withdrawal as any)).toBe(true);
      });

      it('withholds it from anything the platform will not adjust', () => {
        // TransactionUpdateNotAllowedException for the first three.
        expect(component.canModify(reversedDeposit as any)).toBe(false);
        expect(component.canModify(interestPosting as any)).toBe(false);
        expect(component.canModify(openHold as any)).toBe(false);
        // error.msg.saving.account.transfer.transaction.update.not.allowed.
        expect(component.canModify(transferredDeposit as any)).toBe(false);
      });

      /**
       * The id travels as a query parameter so the dispatch route keeps one shape, and with it
       * the single permission gate resolved from `:command`.
       */
      it('opens the transaction form for that transaction', () => {
        component.onModifyTransaction(deposit as any);

        expect(routerSpy.navigate).toHaveBeenCalledWith(
          ['/products/savings-accounts', 789, 'transactions', 'modify'],
          { queryParams: { transactionId: 1 } },
        );
      });
    });

    describe('reverse', () => {
      it('asks first, then posts the reverse command against that transaction', async () => {
        dialogServiceSpy.confirm.mockResolvedValue(true);

        await component.onReverseTransaction(deposit as any);

        expect(dialogServiceSpy.confirm).toHaveBeenCalled();
        expect(dialogServiceSpy.confirm.mock.lastCall![0].destructive).toBe(true);
        expect(
          transactionsServiceSpy.postSavingsaccountsSavingsIdTransactionsTransactionId,
        ).toHaveBeenCalledWith(789, 1, {}, 'reverse');
      });

      it('does nothing when the user declines', async () => {
        dialogServiceSpy.confirm.mockResolvedValue(false);

        await component.onReverseTransaction(deposit as any);

        expect(
          transactionsServiceSpy.postSavingsaccountsSavingsIdTransactionsTransactionId,
        ).not.toHaveBeenCalled();
      });
    });
  });

  /**
   * `undoapproval` rejects `dateFormat`/`locale` — the platform answers 400 for parameters it
   * does not expect there, unlike almost every other command on this account. The dialog must
   * therefore send an empty body, or one carrying only `note`, never the pair every other
   * command on this screen sends by default.
   */
  describe('undo approval', () => {
    it('sends an empty body and refreshes the account after undoing approval', async () => {
      dialogServiceSpy.open.mockResolvedValue({});
      savingsServiceSpy.getSavingsaccountsAccountId.mockReturnValueOnce(
        of({
          ...component.account(),
          status: { submittedAndPendingApproval: true },
        }) as unknown as ReturnType<SavingsAccountService['getSavingsaccountsAccountId']>,
      );

      component.onUndoApproval();
      await fixture.whenStable();

      expect(savingsServiceSpy.postSavingsaccountsAccountId).toHaveBeenCalledWith(
        789,
        {},
        'undoapproval',
      );
      expect(savingsServiceSpy.getSavingsaccountsAccountId).toHaveBeenCalledTimes(2);
      expect(component.account()?.status?.submittedAndPendingApproval).toBe(true);
      expect(TestBed.inject(BreadcrumbService).override()?.[1].url).toBe('/clients/view/42');
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

  /** Issue #797: the account list was never where the user came from. */
  it('goes back to the client who owns the account', () => {
    routerSpy.navigate.mockClear();

    component.onBack();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients/view', 42]);
  });
});
