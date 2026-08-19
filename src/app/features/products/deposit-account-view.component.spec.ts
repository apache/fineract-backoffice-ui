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
import { ActivatedRoute, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { DepositAccountViewComponent } from './deposit-account-view.component';
import {
  FixedDepositAccountService,
  FixedDepositAccountTransactionsService,
  RecurringDepositAccountService,
  RecurringDepositAccountTransactionsService,
} from '../../api';
import { BASE_PATH } from '../../api/variables';
import { DialogService } from '../../core/services/dialog.service';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { toIsoDate } from '../../core/utils/date-formatter';

const PENDING = {
  id: 100,
  value: 'Submitted and pending approval',
  submittedAndPendingApproval: true,
  approved: false,
  active: false,
};

describe('DepositAccountViewComponent', () => {
  let fixture: ComponentFixture<DepositAccountViewComponent>;
  let component: DepositAccountViewComponent;
  let fdService: jasmine.SpyObj<FixedDepositAccountService>;
  let fdTransactions: jasmine.SpyObj<FixedDepositAccountTransactionsService>;
  let dialogService: jasmine.SpyObj<DialogService>;

  /** The account as the platform returns it, with the timeline the commands are floored on. */
  function account(status: object, timeline: object = { submittedOnDate: [2026, 8, 9] }): object {
    return { id: 7, status, timeline, currency: { displaySymbol: '$' } };
  }

  async function setup(
    data: object,
    transactions: object[] = [],
    url = '/products/fixed-deposits/view/7',
  ): Promise<void> {
    TestBed.resetTestingModule();

    fdService = jasmine.createSpyObj('FixedDepositAccountService', [
      'getFixeddepositaccountsAccountId',
      'postFixeddepositaccountsAccountId',
    ]);
    fdService.getFixeddepositaccountsAccountId.and.returnValue(of(data) as never);
    fdService.postFixeddepositaccountsAccountId.and.returnValue(of({}) as never);

    const rdService = jasmine.createSpyObj('RecurringDepositAccountService', [
      'getRecurringdepositaccountsAccountId',
      'postRecurringdepositaccountsAccountId',
    ]);
    rdService.getRecurringdepositaccountsAccountId.and.returnValue(of(data) as never);
    rdService.postRecurringdepositaccountsAccountId.and.returnValue(of({}) as never);

    fdTransactions = jasmine.createSpyObj('FixedDepositAccountTransactionsService', [
      'getFixeddepositaccountsFixedDepositAccountIdTransactions',
      'postFixeddepositaccountsFixedDepositAccountIdTransactionsTransactionId',
    ]);
    fdTransactions.getFixeddepositaccountsFixedDepositAccountIdTransactions.and.returnValue(
      of(transactions) as never,
    );
    fdTransactions.postFixeddepositaccountsFixedDepositAccountIdTransactionsTransactionId.and.returnValue(
      of({}) as never,
    );

    const rdTransactions = jasmine.createSpyObj('RecurringDepositAccountTransactionsService', [
      'postRecurringdepositaccountsRecurringDepositAccountIdTransactionsTransactionId',
    ]);

    dialogService = jasmine.createSpyObj('DialogService', ['confirm', 'open']);
    dialogService.confirm.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [DepositAccountViewComponent],
      providers: [
        provideNoopAnimations(),
        provideIonicTesting(),
        ...provideTranslateTesting(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FixedDepositAccountService, useValue: fdService },
        { provide: RecurringDepositAccountService, useValue: rdService },
        { provide: FixedDepositAccountTransactionsService, useValue: fdTransactions },
        { provide: RecurringDepositAccountTransactionsService, useValue: rdTransactions },
        { provide: BASE_PATH, useValue: 'https://example.test/fineract-provider/api' },
        { provide: DialogService, useValue: dialogService },
        { provide: Router, useValue: { url, navigate: () => undefined } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '7' } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DepositAccountViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** The body of the most recent command, and the command name. */
  function lastCommand(): { command: string; body: Record<string, unknown> } {
    const args = fdService.postFixeddepositaccountsAccountId.calls.mostRecent().args;
    return { body: args[1] as Record<string, unknown>, command: args[2] as string };
  }

  it('loads the account through the generated service rather than a name that does not exist', async () => {
    await setup(account(PENDING));

    // The regression this guards: the screen used to look the method up as
    // `service['retrieveOne14']`, which is on neither service, so it threw out of ngOnInit and
    // the whole template — wrapped in @if (account()) — rendered as nothing.
    expect(fdService.getFixeddepositaccountsAccountId).toHaveBeenCalledWith(7);
    expect(component.account()).toBeTruthy();
  });

  it('offers only the actions the account status allows', async () => {
    await setup(account(PENDING));
    expect(component.isPending()).toBe(true);
    expect(component.isApproved()).toBe(false);
    expect(component.isActive()).toBe(false);

    await setup(account({ id: 300, value: 'Active', active: true }));
    expect(component.isActive()).toBe(true);
    expect(component.isPending()).toBe(false);
  });

  it('sends undoapproval with an empty body', async () => {
    await setup(account({ id: 200, value: 'Approved', approved: true }));

    component.onUndoApproval();
    await fixture.whenStable();

    // The command refuses `locale` and `dateFormat` outright, which every other command here
    // requires — so a uniformly built payload makes exactly this one fail.
    const { command, body } = lastCommand();
    expect(command).toBe('undoapproval');
    expect(body).toEqual({});
  });

  it('floors a command date at the date the platform stamped', async () => {
    // A tenant whose timezone is already on tomorrow: approving "today" by the browser's clock
    // would be approving before submission, which the platform refuses.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [year, month, day] = toIsoDate(tomorrow).split('-').map(Number);
    await setup(account(PENDING, { submittedOnDate: [year, month, day] }));

    component.onApprove();
    await fixture.whenStable();

    const { body } = lastCommand();
    expect(body['approvedOnDate']).toContain(String(year));
    expect(body['approvedOnDate']).toContain(String(day).padStart(2, '0'));
  });

  it('keeps today when the stamped date is already behind it', async () => {
    await setup(account(PENDING, { submittedOnDate: [2020, 1, 2] }));

    component.onApprove();
    await fixture.whenStable();

    const today = new Date();
    expect(lastCommand().body['approvedOnDate']).toContain(String(today.getFullYear()));
  });

  it('closes with the closure type the dialog collected, and no withdrawBalance', async () => {
    await setup(
      account({ id: 300, value: 'Active', active: true }, { activatedOnDate: [2026, 1, 1] }),
    );
    dialogService.open.and.resolveTo({ onAccountClosureId: 100 });

    component.onPrematureClose();
    await fixture.whenStable();
    await fixture.whenStable();

    const { command, body } = lastCommand();
    expect(command).toBe('prematureClose');
    // `onAccountClosureId` is mandatory; `withdrawBalance` — which the savings screens send — is
    // not a parameter these commands accept at all.
    expect(body['onAccountClosureId']).toBe(100);
    expect('withdrawBalance' in body).toBe(false);
  });

  it('sends nothing when the closure dialog is dismissed', async () => {
    await setup(account({ id: 300, value: 'Active', active: true }));
    dialogService.open.and.resolveTo(undefined);

    component.onClose();
    await fixture.whenStable();

    expect(fdService.postFixeddepositaccountsAccountId).not.toHaveBeenCalled();
  });

  /**
   * The account response carries no `transactions` key unless asked for one, and the generated
   * getter has no parameter to ask with. The tab therefore read `undefined` on every account and
   * was empty by construction — these cases pin the separate read that fixes it.
   */
  describe('transactions', () => {
    const ACTIVE = { id: 300, value: 'Active', active: true };
    const deposit = { id: 11, amount: 500, reversed: false, entryType: 'CREDIT' };
    const reversedDeposit = { id: 12, amount: 300, reversed: true, entryType: 'CREDIT' };

    it('reads a fixed deposit list from its own endpoint, not from the account', async () => {
      await setup(account(ACTIVE), [deposit]);

      expect(
        fdTransactions.getFixeddepositaccountsFixedDepositAccountIdTransactions,
      ).toHaveBeenCalledWith(7);
      expect(component.transactions()).toHaveSize(1);
    });

    it('offers undo on a live row and not on a reversed one', async () => {
      await setup(account(ACTIVE), [deposit, reversedDeposit]);

      expect(component.canUndo(deposit)).toBeTrue();
      expect(component.canUndo(reversedDeposit)).toBeFalse();
    });

    it('withholds undo entirely once the account is no longer active', async () => {
      await setup(account(PENDING), [deposit]);

      expect(component.canUndo(deposit)).toBeFalse();
    });

    it('undoes through the transaction endpoint and re-reads the account', async () => {
      await setup(account(ACTIVE), [deposit]);

      component.onUndoTransaction(deposit);
      await fixture.whenStable();

      const args =
        fdTransactions.postFixeddepositaccountsFixedDepositAccountIdTransactionsTransactionId.calls.mostRecent()
          .args;
      expect(args[0]).toBe(7);
      expect(args[1]).toBe(11);
      expect(args[3]).toBe('undo');
      // A reversal moves the balance, so the screen re-reads rather than patching the row.
      expect(fdService.getFixeddepositaccountsAccountId).toHaveBeenCalledTimes(2);
    });

    it('posts nothing when the confirmation is declined', async () => {
      await setup(account(ACTIVE), [deposit]);
      dialogService.confirm.and.resolveTo(false);

      component.onUndoTransaction(deposit);
      await fixture.whenStable();

      expect(
        fdTransactions.postFixeddepositaccountsFixedDepositAccountIdTransactionsTransactionId,
      ).not.toHaveBeenCalled();
    });

    it('leaves the account on screen when the transaction read fails', async () => {
      await setup(account(ACTIVE));
      fdTransactions.getFixeddepositaccountsFixedDepositAccountIdTransactions.and.returnValue(
        throwError(() => new Error('unavailable')) as never,
      );

      component.loadData();

      expect(component.transactions()).toEqual([]);
      expect(component.hasError()).toBeFalse();
      expect(component.account()).toBeTruthy();
    });
  });

  /**
   * A recurring deposit has no transaction list endpoint — `GET .../transactions` answers 405 —
   * and the generated account getter cannot send `associations`, so this one read goes out
   * through `HttpClient`.
   */
  it('asks for a recurring deposit list through the associations escape hatch', async () => {
    await setup(
      account({ id: 300, value: 'Active', active: true }),
      [],
      '/products/recurring-deposits/view/7',
    );

    expect(component.isRD).toBeTrue();
    const request = TestBed.inject(HttpTestingController).expectOne(
      (candidate) =>
        candidate.url ===
        'https://example.test/fineract-provider/api/v1/recurringdepositaccounts/7',
    );
    expect(request.request.params.get('associations')).toBe('transactions');
    request.flush({ transactions: [{ id: 21, amount: 100, reversed: false }] });

    expect(component.transactions()).toHaveSize(1);
    // The fixed-deposit list endpoint must not be reached for a recurring deposit.
    expect(
      fdTransactions.getFixeddepositaccountsFixedDepositAccountIdTransactions,
    ).not.toHaveBeenCalled();
  });
});
