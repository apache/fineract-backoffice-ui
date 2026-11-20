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
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject, Subject, finalize, of, throwError } from 'rxjs';

import { ShareAccountViewComponent } from './share-account-view.component';
import { ShareAccountService } from '../../../api';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { DialogService } from '../../../core/services/dialog.service';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { toIsoDate } from '../../../core/utils/date-formatter';

const PENDING = {
  id: 100,
  value: 'Submitted and pending approval',
  submittedAndPendingApproval: true,
  approved: false,
  active: false,
};
const ACTIVE = { id: 300, value: 'Active', active: true, submittedAndPendingApproval: false };

describe('ShareAccountViewComponent', () => {
  let fixture: ComponentFixture<ShareAccountViewComponent>;
  let component: ShareAccountViewComponent;
  let shareService: SpyObj<ShareAccountService>;
  let dialogService: SpyObj<DialogService>;
  let routeParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  /** Shared, and only ever read: the submitted-on date the commands are floored on. */
  const SUBMITTED_TIMELINE = { submittedOnDate: [2026, 8, 9] };

  function account(status: object, timeline: object = SUBMITTED_TIMELINE): object {
    return {
      id: 7,
      accountNo: '000000007',
      productName: 'Ordinary Shares',
      currency: { displaySymbol: '$' },
      status,
      timeline,
      summary: { totalApprovedShares: 100, totalPendingForApprovalShares: 20 },
      purchasedShares: [],
    };
  }

  async function setup(data: object): Promise<void> {
    TestBed.resetTestingModule();
    routeParams = new BehaviorSubject(convertToParamMap({ id: '7' }));

    shareService = createSpyObj(['getAccountsTypeAccountId', 'postAccountsTypeAccountId']);
    shareService.getAccountsTypeAccountId.mockReturnValue(of(data) as never);
    shareService.postAccountsTypeAccountId.mockReturnValue(of({}) as never);

    dialogService = createSpyObj(['confirm', 'open']);
    dialogService.confirm.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ShareAccountViewComponent],
      providers: [
        provideNoopAnimations(),
        provideIonicTesting(),
        ...provideTranslateTesting(),
        { provide: ShareAccountService, useValue: shareService },
        { provide: DialogService, useValue: dialogService },
        { provide: Router, useValue: { navigate: () => undefined } },
        { provide: ActivatedRoute, useValue: { paramMap: routeParams } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareAccountViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** The command name and body of the most recent post. */
  function lastCommand(): { command: string; body: Record<string, unknown> } {
    const args = shareService.postAccountsTypeAccountId.mock.lastCall!;
    return { body: args[2] as Record<string, unknown>, command: args[3] as string };
  }

  it('reads the account through the share type of the accounts endpoint', async () => {
    await setup(account(PENDING));

    expect(shareService.getAccountsTypeAccountId).toHaveBeenCalledWith(7, 'share');
    expect(component.account()).toBeTruthy();
    expect(component.approvedShares()).toBe(100);
    expect(component.pendingShares()).toBe(20);
  });

  it('offers only the actions the status allows', async () => {
    await setup(account(PENDING));
    expect(component.isPending()).toBe(true);
    expect(component.isActive()).toBe(false);

    await setup(account(ACTIVE));
    expect(component.isActive()).toBe(true);
    expect(component.isPending()).toBe(false);
  });

  it('names the date field each command expects', async () => {
    await setup(account(PENDING));
    component.onApprove();
    await fixture.whenStable();
    // The five commands disagree: approvedDate, rejectedDate, activatedDate, closedDate,
    // requestedDate. A shared spelling is refused.
    expect(lastCommand().command).toBe('approve');
    expect('approvedDate' in lastCommand().body).toBe(true);

    await setup(account(PENDING));
    component.onReject();
    await fixture.whenStable();
    expect('rejectedDate' in lastCommand().body).toBe(true);
  });

  it('sends undoapproval with an empty body and refreshes the account', async () => {
    const owner = { clientId: 42, clientName: 'Jane Smith' };
    await setup({ ...account({ id: 200, value: 'Approved', approved: true }), ...owner });
    shareService.getAccountsTypeAccountId.mockReturnValueOnce(
      of({ ...account(PENDING), ...owner }) as never,
    );

    component.onUndoApproval();
    await fixture.whenStable();

    expect(lastCommand()).toEqual({ command: 'undoapproval', body: {} });
    expect(shareService.getAccountsTypeAccountId).toHaveBeenCalledTimes(2);
    expect(shareService.getAccountsTypeAccountId).toHaveBeenLastCalledWith(7, 'share');
    expect(component.isPending()).toBe(true);
    expect(TestBed.inject(BreadcrumbService).override()?.[1].url).toBe('/clients/view/42');
  });

  it('floors a command date at the date the platform stamped', async () => {
    // A tenant already on tomorrow: approving by the browser's clock would precede submission.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [year, , day] = toIsoDate(tomorrow).split('-').map(Number);
    await setup(account(PENDING, { submittedOnDate: toIsoDate(tomorrow).split('-').map(Number) }));

    component.onApprove();
    await fixture.whenStable();

    const approvedOn = String(lastCommand().body['approvedDate']);
    expect(approvedOn).toContain(String(year));
    expect(approvedOn).toContain(String(day).padStart(2, '0'));
  });

  it('applies for more shares with the quantity the dialog collected', async () => {
    await setup(account(ACTIVE, { activatedDate: [2026, 1, 1] }));
    dialogService.open.mockResolvedValue({ requestedShares: 25 });

    await component.onApplyShares();

    const { command, body } = lastCommand();
    expect(command).toBe('applyadditionalshares');
    expect(body['requestedShares']).toBe(25);
    expect('requestedDate' in body).toBe(true);
  });

  it('redeems shares through the same command shape', async () => {
    await setup(account(ACTIVE, { activatedDate: [2026, 1, 1] }));
    dialogService.open.mockResolvedValue({ requestedShares: 5 });

    await component.onRedeemShares();

    expect(lastCommand().command).toBe('redeemshares');
    expect(lastCommand().body['requestedShares']).toBe(5);
  });

  it('sends nothing when the quantity dialog is dismissed', async () => {
    await setup(account(ACTIVE));
    dialogService.open.mockResolvedValue(undefined);

    await component.onRedeemShares();

    expect(shareService.postAccountsTypeAccountId).not.toHaveBeenCalled();
  });

  describe('account breadcrumbs and reloads', () => {
    const ownedAccount = {
      ...account(PENDING),
      clientId: 42,
      clientName: 'Jane Smith',
    };

    it('links the client and shows the share account number', async () => {
      await setup(ownedAccount);

      expect(TestBed.inject(BreadcrumbService).override()).toEqual([
        { label: { kind: 'translation', key: 'nav.clients' }, url: '/clients' },
        { label: { kind: 'text', text: 'Jane Smith' }, url: '/clients/view/42' },
        {
          label: {
            kind: 'translation',
            key: 'BREADCRUMBS.SHARE_ACCOUNT',
            params: { accountNo: '000000007' },
          },
        },
      ]);
    });

    it('clears the owner trail when a reload lacks owner details', async () => {
      await setup(ownedAccount);
      shareService.getAccountsTypeAccountId.mockReturnValue(of(account(PENDING)) as never);

      component.loadAccount();

      expect(TestBed.inject(BreadcrumbService).override()).toEqual([]);
    });

    it('cancels the previous load and ignores a late response after an ID change', async () => {
      await setup(ownedAccount);
      const breadcrumbs = TestBed.inject(BreadcrumbService);
      const first = new Subject<object>();
      const second = new Subject<object>();
      const cancelled = vi.fn();
      shareService.getAccountsTypeAccountId.mockReturnValue(
        first.pipe(finalize(cancelled)) as never,
      );
      component.loadAccount();
      expect(cancelled).not.toHaveBeenCalled();

      shareService.getAccountsTypeAccountId.mockReturnValue(second as never);
      routeParams.next(convertToParamMap({ id: '8' }));

      expect(cancelled).toHaveBeenCalledOnce();
      expect(shareService.getAccountsTypeAccountId).toHaveBeenLastCalledWith(8, 'share');
      expect(breadcrumbs.override()).toEqual([]);
      expect(component.isLoading()).toBe(true);

      second.next({ ...ownedAccount, id: 8, clientName: 'New owner', accountNo: '000000008' });
      second.complete();
      first.next({ ...ownedAccount, clientName: 'Stale owner' });

      expect(component.account()?.id).toBe(8);
      expect(component.isLoading()).toBe(false);
      expect(breadcrumbs.override()?.[1].label).toEqual({ kind: 'text', text: 'New owner' });
    });

    it('surfaces a failed load, clears the old trail and accepts a retry', async () => {
      await setup(ownedAccount);
      const breadcrumbs = TestBed.inject(BreadcrumbService);
      shareService.getAccountsTypeAccountId.mockReturnValue(
        throwError(() => new Error('Account unavailable')),
      );

      component.loadAccount();

      expect(component.hasError()).toBe(true);
      expect(component.isLoading()).toBe(false);
      expect(breadcrumbs.override()).toEqual([]);

      shareService.getAccountsTypeAccountId.mockReturnValue(of(ownedAccount) as never);
      component.loadAccount();

      expect(component.hasError()).toBe(false);
      expect(component.account()?.clientName).toBe('Jane Smith');
      expect(breadcrumbs.override()?.[1].url).toBe('/clients/view/42');
    });

    it('cancels a pending load and clears the trail on destruction', async () => {
      await setup(ownedAccount);
      const breadcrumbs = TestBed.inject(BreadcrumbService);
      const response = new Subject<object>();
      const cancelled = vi.fn();
      shareService.getAccountsTypeAccountId.mockReturnValue(
        response.pipe(finalize(cancelled)) as never,
      );
      component.loadAccount();

      fixture.destroy();

      expect(cancelled).toHaveBeenCalledOnce();
      response.next({ ...ownedAccount, clientName: 'Late owner' });
      expect(breadcrumbs.override()).toBeNull();
      expect(component.account()?.clientName).toBe('Jane Smith');
    });
  });

  describe('teardown', () => {
    it('dismisses popovers when destroyed', async () => {
      await setup(account(ACTIVE));

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
