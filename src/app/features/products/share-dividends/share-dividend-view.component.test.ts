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

import { HttpErrorResponse } from '@angular/common/http';
import { Injector } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  SHARE_DIVIDEND_API,
  type ShareDividend,
  type ShareDividendApi,
  type ShareDividendPayoutPage,
} from '../../../core/adapters';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigService } from '../../../core/services/config.service';
import { DialogService } from '../../../core/services/dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  provideTranslateTesting,
  setTranslateTestingTranslations,
} from '../../../testing/i18n-testing';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { ShareDividendViewComponent } from './share-dividend-view.component';

const PENDING: ShareDividend = {
  id: 4,
  amount: 1200,
  status: 'pending',
  periodStartDate: '2025-01-01',
  periodEndDate: '2025-12-31',
};

const PAGE: ShareDividendPayoutPage = {
  totalFilteredRecords: 42,
  items: [
    {
      id: 9,
      accountId: 7,
      accountNo: '000000101',
      clientName: 'Jane Doe',
      amount: 28.57,
      status: 'pending',
    },
  ],
};

describe('ShareDividendViewComponent', () => {
  let fixture: ComponentFixture<ShareDividendViewComponent>;
  let component: ShareDividendViewComponent;
  let api: SpyObj<ShareDividendApi>;
  let auth: SpyObj<AuthService>;
  let dialog: SpyObj<DialogService>;
  let notifications: SpyObj<NotificationService>;

  beforeEach(async () => {
    api = createSpyObj<ShareDividendApi>(['list', 'get', 'approve', 'delete']);
    api.list.mockReturnValue(of([PENDING, { ...PENDING, id: 5, status: 'approved' }]));
    api.get.mockReturnValue(of(PAGE));
    auth = Object.assign(createSpyObj<AuthService>(['hasPermission']), {
      currentUser: () => ({ permissions: [] }),
    });
    auth.hasPermission.mockReturnValue(true);
    dialog = createSpyObj(['confirm']);
    dialog.confirm.mockResolvedValue(true);
    notifications = createSpyObj(['success', 'error', 'show']);

    await TestBed.configureTestingModule({
      imports: [ShareDividendViewComponent],
      providers: [
        ...provideTranslateTesting(),
        provideIonicTesting(),
        provideRouter([]),
        { provide: SHARE_DIVIDEND_API, useValue: api },
        { provide: AuthService, useValue: auth },
        { provide: DialogService, useValue: dialog },
        { provide: NotificationService, useValue: notifications },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ productId: '2', dividendId: '4' }) },
          },
        },
      ],
    }).compileComponents();
  });

  function create(): void {
    fixture = TestBed.createComponent(ShareDividendViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const query = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${CSS.escape(testId)}"]`);

  /** The control the user actually presses: the Ionic button inside `app-button`. */
  const control = (testId: string): (HTMLElement & { disabled: boolean }) | null =>
    query(testId)?.querySelector('[data-testid="ui-button"]') ?? null;

  it('reads the header from the dividend list and the first page of payouts', () => {
    create();

    expect(api.list).toHaveBeenCalledWith(2);
    expect(api.get).toHaveBeenCalledWith(2, 4, { offset: 0, limit: 10 });
    expect(component.dividend()).toEqual(PENDING);
    expect(component.accountCount()).toBe(42);
    expect(component.payouts()).toEqual(PAGE.items);
    expect(query('share-dividend-status')?.textContent).toContain('SHARE_DIVIDENDS.STATUS_PENDING');
  });

  it('pages the payouts by offset', () => {
    create();

    component.onPage({ pageIndex: 2, pageSize: 10, length: 42 });

    expect(api.get).toHaveBeenLastCalledWith(2, 4, { offset: 20, limit: 10 });
  });

  it('searches by account number from the first page and keeps the dividend-wide count', () => {
    create();
    component.onPage({ pageIndex: 3, pageSize: 10, length: 42 });
    api.get.mockReturnValue(of({ totalFilteredRecords: 1, items: PAGE.items }));

    component.onSearch(' 000000101 ');

    expect(api.get).toHaveBeenLastCalledWith(2, 4, {
      offset: 0,
      limit: 10,
      accountNo: '000000101',
    });
    expect(component.pageIndex()).toBe(0);
    expect(component.totalRecords()).toBe(1);
    expect(component.accountCount()).toBe(42);
  });

  it('keeps Approve disabled without APPROVE_DIVIDEND_SHAREPRODUCT after the data arrives', async () => {
    auth.hasPermission.mockImplementation((code) => code !== 'APPROVE_DIVIDEND_SHAREPRODUCT');
    const dividends = new Subject<readonly ShareDividend[]>();
    api.list.mockReturnValue(dividends);
    create();
    await fixture.whenStable();

    dividends.next([PENDING]);
    dividends.complete();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(control('share-dividend-approve')?.disabled).toBe(true);
    expect(control('share-dividend-delete')?.disabled).toBe(false);
    await component.onApprove();
    expect(dialog.confirm).not.toHaveBeenCalled();
    expect(api.approve).not.toHaveBeenCalled();
  });

  it('keeps Delete disabled without DELETE_DIVIDEND_SHAREPRODUCT after the data arrives', async () => {
    auth.hasPermission.mockImplementation((code) => code !== 'DELETE_DIVIDEND_SHAREPRODUCT');
    const dividends = new Subject<readonly ShareDividend[]>();
    api.list.mockReturnValue(dividends);
    create();
    await fixture.whenStable();

    dividends.next([PENDING]);
    dividends.complete();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(control('share-dividend-delete')?.disabled).toBe(true);
    expect(control('share-dividend-approve')?.disabled).toBe(false);
    await component.onDelete();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('leaves both actions enabled when the deployment turns RBAC display off', async () => {
    auth.hasPermission.mockReturnValue(false);
    TestBed.overrideProvider(ConfigService, { useValue: { rbacEnabled: () => false } });
    create();
    await fixture.whenStable();

    expect(control('share-dividend-approve')?.disabled).toBe(false);
    expect(control('share-dividend-delete')?.disabled).toBe(false);
  });

  it('enables Approve for a user who holds the permission', async () => {
    create();
    await fixture.whenStable();

    expect(control('share-dividend-approve')?.disabled).toBe(false);
  });

  it('confirms with the total and the account count, approves, and reloads', async () => {
    setTranslateTestingTranslations(TestBed.inject(Injector), 'en', {
      SHARE_DIVIDENDS: { CONFIRM_APPROVE: 'pay {{amount}} to {{count}}', APPROVED: 'approved' },
    });
    api.approve.mockReturnValue(of({ pendingApproval: false }));
    create();

    await component.onApprove();

    expect(dialog.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'pay 1200 to 42' }),
    );
    expect(api.approve).toHaveBeenCalledWith(2, 4);
    expect(notifications.success).toHaveBeenCalledWith('approved');
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('says the approval was submitted when maker-checker queues it', async () => {
    setTranslateTestingTranslations(TestBed.inject(Injector), 'en', {
      COMMON: { MUTATION_SUBMITTED_FOR_APPROVAL: 'submitted' },
      SHARE_DIVIDENDS: { APPROVED: 'approved' },
    });
    api.approve.mockReturnValue(of({ pendingApproval: true }));
    create();

    await component.onApprove();

    expect(notifications.success).toHaveBeenCalledWith('submitted');
    expect(notifications.success).not.toHaveBeenCalledWith('approved');
  });

  it('holds Approve off once maker-checker has queued the approval', async () => {
    api.approve.mockReturnValue(of({ pendingApproval: true }));
    create();

    await component.onApprove();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.dividend()?.status).toBe('pending');
    expect(query('share-dividend-approval-submitted')).not.toBeNull();
    expect(control('share-dividend-approve')?.disabled).toBe(true);
    await component.onApprove();
    expect(api.approve).toHaveBeenCalledTimes(1);
    expect(dialog.confirm).toHaveBeenCalledTimes(1);
  });

  it('refreshes in place after approving, keeping the header and the account search', async () => {
    api.approve.mockReturnValue(of({ pendingApproval: false }));
    create();
    component.onSearch('000000101');
    const refreshed = new Subject<readonly ShareDividend[]>();
    api.list.mockReturnValue(refreshed);

    await component.onApprove();

    expect(component.dividend()).toEqual(PENDING);
    expect(api.get).toHaveBeenLastCalledWith(2, 4, {
      offset: 0,
      limit: 10,
      accountNo: '000000101',
    });
    refreshed.next([{ ...PENDING, status: 'approved' }]);
    refreshed.complete();
    expect(component.dividend()?.status).toBe('approved');
    expect(component.accountCount()).toBe(42);
  });

  it('keeps Approve disabled until the refresh after approving lands', async () => {
    api.approve.mockReturnValue(of({ pendingApproval: false }));
    create();
    const refreshed = new Subject<readonly ShareDividend[]>();
    api.list.mockReturnValue(refreshed);

    await component.onApprove();
    fixture.detectChanges();

    expect(control('share-dividend-approve')?.disabled).toBe(true);
    await component.onApprove();
    expect(api.approve).toHaveBeenCalledTimes(1);

    refreshed.next([{ ...PENDING, status: 'approved' }]);
    refreshed.complete();
    fixture.detectChanges();
    expect(component.approving()).toBe(false);
    expect(query('share-dividend-approve')).toBeNull();
  });

  it('still updates the status when the user searches while the refresh is in flight', async () => {
    api.approve.mockReturnValue(of({ pendingApproval: false }));
    create();
    const refreshed = new Subject<readonly ShareDividend[]>();
    api.list.mockReturnValue(refreshed);

    await component.onApprove();
    component.onSearch('000000101');
    refreshed.next([{ ...PENDING, status: 'approved' }]);
    refreshed.complete();

    expect(component.dividend()?.status).toBe('approved');
  });

  it('keeps the page on screen when the refresh after approving fails', async () => {
    api.approve.mockReturnValue(of({ pendingApproval: false }));
    create();
    api.list.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    await component.onApprove();

    expect(component.loadError()).toBeNull();
    expect(component.dividend()).toEqual(PENDING);
    expect(component.approving()).toBe(false);
    fixture.detectChanges();
    expect(control('share-dividend-approve')?.disabled).toBe(true);
    expect(control('share-dividend-delete')?.disabled).toBe(true);
    await component.onApprove();
    expect(api.approve).toHaveBeenCalledTimes(1);
  });

  it('holds Delete off once an approval is waiting for a checker', async () => {
    api.approve.mockReturnValue(of({ pendingApproval: true }));
    create();

    await component.onApprove();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(control('share-dividend-delete')?.disabled).toBe(true);
    await component.onDelete();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('does not show Approve as busy while a delete is running', async () => {
    api.delete.mockReturnValue(new Subject<void>());
    create();

    await component.onDelete();

    fixture.detectChanges();

    expect(component.deleting()).toBe(true);
    expect(control('share-dividend-approve')?.getAttribute('aria-busy')).toBeNull();
    expect(control('share-dividend-delete')?.disabled).toBe(true);
  });

  it('ignores a payout page that answers after a newer request', () => {
    create();
    const older = new Subject<ShareDividendPayoutPage>();
    const newer = new Subject<ShareDividendPayoutPage>();
    api.get.mockReturnValueOnce(older).mockReturnValueOnce(newer);

    component.onPage({ pageIndex: 1, pageSize: 10, length: 42 });
    component.onSearch('000000101');
    newer.next({ totalFilteredRecords: 1, items: PAGE.items });
    newer.complete();
    older.next({ totalFilteredRecords: 42, items: [] });
    older.complete();

    expect(component.payouts()).toEqual(PAGE.items);
    expect(component.totalRecords()).toBe(1);
  });

  it('does not approve when the confirmation is cancelled', async () => {
    dialog.confirm.mockResolvedValue(false);
    create();

    await component.onApprove();

    expect(api.approve).not.toHaveBeenCalled();
  });

  it('offers neither Approve nor Delete once the dividend is approved', async () => {
    api.list.mockReturnValue(of([{ ...PENDING, status: 'approved' }]));
    create();
    await fixture.whenStable();

    expect(query('share-dividend-status')?.textContent).toContain(
      'SHARE_DIVIDENDS.STATUS_APPROVED',
    );
    expect(query('share-dividend-approve')).toBeNull();
    expect(query('share-dividend-delete')).toBeNull();
    await component.onDelete();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('deletes a pending dividend after confirmation and returns to the list', async () => {
    api.delete.mockReturnValue(of(undefined));
    create();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await component.onDelete();

    expect(api.delete).toHaveBeenCalledWith(2, 4);
    expect(navigate).toHaveBeenCalledWith(['/products/shares', 2, 'dividends']);
  });

  describe('load errors', () => {
    const fail = (status: number): Observable<never> =>
      throwError(() => new HttpErrorResponse({ status }));

    it('reports a refused read with no retry', () => {
      api.list.mockReturnValue(fail(403));
      create();

      expect(component.loadError()).toBe('forbidden');
      expect(query('share-dividend-load-error')).not.toBeNull();
      expect(query('share-dividend-load-error-action')).toBeNull();
    });

    it('reports a missing dividend with no retry', () => {
      api.get.mockReturnValue(fail(404));
      create();

      expect(component.loadError()).toBe('not-found');
      expect(query('share-dividend-load-error-action')).toBeNull();
    });

    it('reports a dividend absent from the product list as not found', () => {
      api.list.mockReturnValue(of([{ ...PENDING, id: 5 }]));
      create();

      expect(component.loadError()).toBe('not-found');
      expect(component.dividend()).toBeNull();
    });

    it('offers a retry for any other failure, and the retry loads again', () => {
      api.list.mockReturnValue(fail(500));
      create();

      expect(component.loadError()).toBe('failed');
      expect(query('share-dividend-load-error-action')).not.toBeNull();

      api.list.mockReturnValue(of([PENDING]));
      component.load();
      fixture.detectChanges();

      expect(component.loadError()).toBeNull();
      expect(component.dividend()).toEqual(PENDING);
    });
  });
});
