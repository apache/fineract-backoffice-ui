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
  StandingInstructionsService,
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
  let fdService: SpyObj<FixedDepositAccountService>;
  let fdTransactions: SpyObj<FixedDepositAccountTransactionsService>;
  let dialogService: SpyObj<DialogService>;
  let standingInstructions: SpyObj<StandingInstructionsService>;

  /** Shared, and only ever read: the submitted-on date the commands are floored on. */
  const SUBMITTED_TIMELINE = { submittedOnDate: [2026, 8, 9] };

  /** The account as the platform returns it, with the timeline the commands are floored on. */
  function account(status: object, timeline: object = SUBMITTED_TIMELINE): object {
    return { id: 7, clientId: 42, status, timeline, currency: { displaySymbol: '$' } };
  }

  async function setup(
    data: object,
    transactions: object[] = [],
    url = '/products/fixed-deposits/view/7',
  ): Promise<void> {
    TestBed.resetTestingModule();

    fdService = createSpyObj([
      'getFixeddepositaccountsAccountId',
      'postFixeddepositaccountsAccountId',
    ]);
    fdService.getFixeddepositaccountsAccountId.mockReturnValue(of(data) as never);
    fdService.postFixeddepositaccountsAccountId.mockReturnValue(of({}) as never);

    const rdService = createSpyObj([
      'getRecurringdepositaccountsAccountId',
      'postRecurringdepositaccountsAccountId',
    ]);
    rdService.getRecurringdepositaccountsAccountId.mockReturnValue(of(data) as never);
    rdService.postRecurringdepositaccountsAccountId.mockReturnValue(of({}) as never);

    fdTransactions = createSpyObj([
      'getFixeddepositaccountsFixedDepositAccountIdTransactions',
      'postFixeddepositaccountsFixedDepositAccountIdTransactionsTransactionId',
    ]);
    fdTransactions.getFixeddepositaccountsFixedDepositAccountIdTransactions.mockReturnValue(
      of(transactions) as never,
    );
    fdTransactions.postFixeddepositaccountsFixedDepositAccountIdTransactionsTransactionId.mockReturnValue(
      of({}) as never,
    );

    const rdTransactions = createSpyObj([
      'postRecurringdepositaccountsRecurringDepositAccountIdTransactionsTransactionId',
    ]);

    dialogService = createSpyObj(['confirm', 'open']);
    dialogService.confirm.mockResolvedValue(true);

    standingInstructions = createSpyObj(['getStandinginstructions']);
    standingInstructions.getStandinginstructions.mockReturnValue(of({ pageItems: [] }) as never);

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
        { provide: StandingInstructionsService, useValue: standingInstructions },
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
    const args = fdService.postFixeddepositaccountsAccountId.mock.lastCall!;
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
    dialogService.open.mockResolvedValue({ onAccountClosureId: 100 });

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
    dialogService.open.mockResolvedValue(undefined);

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
      expect(component.transactions()).toHaveLength(1);
    });

    it('offers undo on a live row and not on a reversed one', async () => {
      await setup(account(ACTIVE), [deposit, reversedDeposit]);

      expect(component.canUndo(deposit)).toBe(true);
      expect(component.canUndo(reversedDeposit)).toBe(false);
    });

    it('withholds undo entirely once the account is no longer active', async () => {
      await setup(account(PENDING), [deposit]);

      expect(component.canUndo(deposit)).toBe(false);
    });

    it('undoes through the transaction endpoint and re-reads the account', async () => {
      await setup(account(ACTIVE), [deposit]);

      component.onUndoTransaction(deposit);
      await fixture.whenStable();

      const args =
        fdTransactions.postFixeddepositaccountsFixedDepositAccountIdTransactionsTransactionId.mock
          .lastCall!;
      expect(args[0]).toBe(7);
      expect(args[1]).toBe(11);
      expect(args[3]).toBe('undo');
      // A reversal moves the balance, so the screen re-reads rather than patching the row.
      expect(fdService.getFixeddepositaccountsAccountId).toHaveBeenCalledTimes(2);
    });

    it('posts nothing when the confirmation is declined', async () => {
      await setup(account(ACTIVE), [deposit]);
      dialogService.confirm.mockResolvedValue(false);

      component.onUndoTransaction(deposit);
      await fixture.whenStable();

      expect(
        fdTransactions.postFixeddepositaccountsFixedDepositAccountIdTransactionsTransactionId,
      ).not.toHaveBeenCalled();
    });

    it('leaves the account on screen when the transaction read fails', async () => {
      await setup(account(ACTIVE));
      fdTransactions.getFixeddepositaccountsFixedDepositAccountIdTransactions.mockReturnValue(
        throwError(() => new Error('unavailable')) as never,
      );

      component.loadData();

      expect(component.transactions()).toEqual([]);
      expect(component.hasError()).toBe(false);
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

    expect(component.isRD).toBe(true);
    // The charges tab issues its own `associations=all` request against the same URL, so the
    // transactions request is picked out by its distinct `associations` value.
    const request = TestBed.inject(HttpTestingController).expectOne(
      (candidate) =>
        candidate.url ===
          'https://example.test/fineract-provider/api/v1/recurringdepositaccounts/7' &&
        candidate.params.get('associations') === 'transactions',
    );
    request.flush({ transactions: [{ id: 21, amount: 100, reversed: false }] });

    expect(component.transactions()).toHaveLength(1);
    // The fixed-deposit list endpoint must not be reached for a recurring deposit.
    expect(
      fdTransactions.getFixeddepositaccountsFixedDepositAccountIdTransactions,
    ).not.toHaveBeenCalled();
  });

  /**
   * Standing instructions target deposit accounts the same way they target ordinary savings —
   * Fineract has no separate portfolio account type for a recurring or fixed deposit — so this
   * reuses `app-savings-standing-instructions-tab` rather than a bespoke deposit version.
   */
  describe('standing instructions tab', () => {
    it('passes this account and its client through to the shared standing instructions tab', async () => {
      await setup(account({ id: 300, value: 'Active', active: true }));

      component.activeTab.set('standingInstructions');
      fixture.detectChanges();

      expect(standingInstructions.getStandinginstructions).toHaveBeenCalled();
      const tabElement = fixture.nativeElement.querySelector(
        'app-savings-standing-instructions-tab',
      );
      expect(tabElement).not.toBeNull();
    });
  });

  /**
   * `GET /fixeddepositaccounts/{id}` and `GET /recurringdepositaccounts/{id}` both omit
   * `charges` unless asked with `?associations=all` — the same class of gap `loadTransactions`
   * already works around for a recurring deposit's transaction list.
   */
  describe('charges tab', () => {
    it('reads charges through the associations escape hatch and renders them', async () => {
      await setup(account({ id: 300, value: 'Active', active: true }));

      const request = TestBed.inject(HttpTestingController).expectOne(
        (candidate) =>
          candidate.url ===
            'https://example.test/fineract-provider/api/v1/fixeddepositaccounts/7' &&
          candidate.params.get('associations') === 'all',
      );
      request.flush({
        charges: [{ name: 'Withdrawal Fee', amount: 5, amountOutstanding: 5 }],
      });

      expect(component.charges()).toHaveLength(1);
      expect(component.charges()[0].name).toBe('Withdrawal Fee');
    });

    it('shows no charges rather than failing the screen when the read errors', async () => {
      await setup(account({ id: 300, value: 'Active', active: true }));

      TestBed.inject(HttpTestingController)
        .expectOne((candidate) => candidate.params.get('associations') === 'all')
        .flush('boom', { status: 500, statusText: 'Server Error' });

      expect(component.charges()).toEqual([]);
      expect(component.hasError()).toBe(false);
    });
  });

  /**
   * `accountChart.chartSlabs` comes off the exact same `associations=all` response the charges
   * tab reads — one request answers both tabs, not two.
   */
  describe('interest rate chart tab', () => {
    const SLAB = {
      fromPeriod: 0,
      toPeriod: 6,
      periodType: { value: 'Months' },
      amountRangeFrom: 0,
      amountRangeTo: 10_000,
      annualInterestRate: 5,
      description: 'Base rate',
      incentives: [
        {
          entityType: { value: 'Client' },
          attributeName: { value: 'Gender' },
          conditionType: { value: 'Equals' },
          attributeValueDesc: 'Female',
          incentiveType: { value: 'Rate' },
          amount: 0.5,
        },
      ],
    };

    it('reads the chart slabs off the same associations response as the charges tab', async () => {
      await setup(account({ id: 300, value: 'Active', active: true }));

      TestBed.inject(HttpTestingController)
        .expectOne((candidate) => candidate.params.get('associations') === 'all')
        .flush({ accountChart: { chartSlabs: [SLAB] } });

      expect(component.chartSlabs()).toEqual([SLAB] as never);
    });

    it('toggles a slab open and closed rather than opening every slab at once', async () => {
      await setup(account({ id: 300, value: 'Active', active: true }));
      TestBed.inject(HttpTestingController)
        .expectOne((candidate) => candidate.params.get('associations') === 'all')
        .flush({ accountChart: { chartSlabs: [SLAB, SLAB] } });

      expect(component.expandedSlabIndex()).toBeNull();

      component.onToggleIncentives(0);
      expect(component.expandedSlabIndex()).toBe(0);

      component.onToggleIncentives(1);
      expect(component.expandedSlabIndex()).toBe(1);

      component.onToggleIncentives(1);
      expect(component.expandedSlabIndex()).toBeNull();
    });

    it('shows no chart rather than failing the screen when the read errors', async () => {
      await setup(account({ id: 300, value: 'Active', active: true }));

      TestBed.inject(HttpTestingController)
        .expectOne((candidate) => candidate.params.get('associations') === 'all')
        .flush('boom', { status: 500, statusText: 'Server Error' });

      expect(component.chartSlabs()).toEqual([]);
      expect(component.hasError()).toBe(false);
    });
  });

  describe('teardown', () => {
    it('dismisses popovers when destroyed', async () => {
      await setup(account({ id: 100, value: 'Active', active: true }));

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
