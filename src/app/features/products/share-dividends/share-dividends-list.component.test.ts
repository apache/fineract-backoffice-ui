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
import { ShareDividendsListComponent } from './share-dividends-list.component';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AuthService } from '../../../core/services/auth.service';
import { DialogService } from '../../../core/services/dialog.service';
import {
  SHARE_DIVIDEND_API,
  type ShareDividend,
  type ShareDividendApi,
} from '../../../core/adapters';

const PENDING: ShareDividend = {
  id: 1,
  amount: 100,
  status: 'pending',
  periodStartDate: '2026-01-01',
  periodEndDate: '2026-12-31',
};
const APPROVED: ShareDividend = { ...PENDING, id: 2, status: 'approved' };

describe('ShareDividendsListComponent', () => {
  let component: ShareDividendsListComponent;
  let fixture: ComponentFixture<ShareDividendsListComponent>;
  let api: SpyObj<ShareDividendApi>;
  let dialogService: SpyObj<DialogService>;
  let auth: SpyObj<AuthService>;

  beforeEach(async () => {
    api = createSpyObj<ShareDividendApi>(['list', 'get', 'approve', 'delete']);
    api.list.mockReturnValue(of([PENDING, APPROVED]));
    dialogService = createSpyObj(['confirm']);
    dialogService.confirm.mockResolvedValue(true);
    auth = Object.assign(createSpyObj<AuthService>(['hasPermission']), {
      currentUser: () => ({ permissions: [] }),
    });
    auth.hasPermission.mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [ShareDividendsListComponent],
      providers: [
        ...provideTranslateTesting(),
        provideRouter([]),
        { provide: SHARE_DIVIDEND_API, useValue: api },
        { provide: DialogService, useValue: dialogService },
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ productId: '1' }) } },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareDividendsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const rows = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('tbody tr')) as HTMLElement[];

  it('should load dividends on init', () => {
    expect(api.list).toHaveBeenCalledWith(1);
    expect(component.dividends()).toEqual([PENDING, APPROVED]);
  });

  it('shows each status and links every row to its dividend', () => {
    const [pending, approved] = rows();

    expect(pending.textContent).toContain('SHARE_DIVIDENDS.STATUS_PENDING');
    expect(approved.textContent).toContain('SHARE_DIVIDENDS.STATUS_APPROVED');
    const link = approved.querySelector(
      '[data-testid="share-dividend-view"] [data-testid="ui-button"]',
    );
    expect(link?.getAttribute('href')).toBe('/products/shares/1/dividends/2');
  });

  it('offers Delete only on a pending dividend', () => {
    const [pending, approved] = rows();

    expect(pending.querySelector('[data-testid="share-dividend-delete"]')).not.toBeNull();
    expect(approved.querySelector('[data-testid="share-dividend-delete"]')).toBeNull();
  });

  it('disables Delete for a user without DELETE_DIVIDEND_SHAREPRODUCT', async () => {
    auth.hasPermission.mockReturnValue(false);
    fixture = TestBed.createComponent(ShareDividendsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const button = rows()[0].querySelector(
      '[data-testid="share-dividend-delete"] [data-testid="ui-button"]',
    ) as (HTMLElement & { disabled: boolean }) | null;
    expect(button?.disabled).toBe(true);
    await component.onDelete(PENDING);
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('should delete after confirmation and reload', async () => {
    api.delete.mockReturnValue(of(undefined));

    await component.onDelete(PENDING);

    expect(api.delete).toHaveBeenCalledWith(1, 1);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('does not delete an approved dividend', async () => {
    await component.onDelete(APPROVED);

    expect(dialogService.confirm).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('should not delete when cancelled', async () => {
    dialogService.confirm.mockResolvedValue(false);
    await component.onDelete(PENDING);
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('opens the declare form', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.onCreate();
    expect(navigate).toHaveBeenCalledWith(['/products/shares', 1, 'dividends', 'create']);
  });
});
