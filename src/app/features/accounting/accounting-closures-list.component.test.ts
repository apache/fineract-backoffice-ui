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
import { DialogService } from '../../core/services/dialog.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountingClosuresListComponent } from './accounting-closures-list.component';
import { ACCOUNTING_CLOSURE_API } from '../../core/adapters';
import type { AccountingClosure, AccountingClosureApi } from '../../core/adapters';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

/**
 * A closed period, in the application's own shape.
 *
 * This spec used to mock the generated `AccountingClosureService` and build fixtures from
 * `GetGlClosureResponse`, which meant it reproduced that type's blind spots: it passed while
 * the status column read a field no payload contains. Mocking the contract instead tests what
 * the component is specified to do, and the mapping is tested where mapping happens — see
 * `core/adapters/api/fineract-accounting-closure.api.test.ts`.
 *
 * It also drops the `as unknown as Observable<HttpEvent<…>>` casts the generated service's
 * overloads forced on every mock here.
 */
const CLOSURE: AccountingClosure = {
  id: 1,
  officeId: 1,
  officeName: 'Head Office',
  closingDate: '2026-09-01',
  comments: null,
  isClosed: true,
};

describe('AccountingClosuresListComponent', () => {
  let component: AccountingClosuresListComponent;
  let fixture: ComponentFixture<AccountingClosuresListComponent>;
  let closureApiSpy: SpyObj<AccountingClosureApi>;
  let routerSpy: SpyObj<Router>;
  let dialogSpy: SpyObj<DialogService>;

  beforeEach(async () => {
    closureApiSpy = createSpyObj(['list', 'create', 'remove', 'get', 'update']);
    routerSpy = createSpyObj(['navigate']);
    dialogSpy = createSpyObj<DialogService>(['open', 'confirm']);
    dialogSpy.confirm.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [AccountingClosuresListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: ACCOUNTING_CLOSURE_API, useValue: closureApiSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    closureApiSpy.list.mockReturnValue(of([CLOSURE]));
    fixture = TestBed.createComponent(AccountingClosuresListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load closures on init', () => {
    expect(closureApiSpy.list).toHaveBeenCalled();
    expect(component.closures()).toEqual([CLOSURE]);
  });

  it('shows a closed period as closed', () => {
    // The regression this migration fixes: the status cell read `isClosed` off the generated
    // response, which has no such field, so every closed period rendered as "Open".
    const chip = fixture.nativeElement.querySelector('.status-chip');
    expect(chip?.classList.contains('closed')).toBe(true);
    expect(chip?.textContent?.trim()).toBe('COMMON.CLOSED');
  });

  it('shows a re-opened period as open', () => {
    closureApiSpy.list.mockReturnValue(of([{ ...CLOSURE, isClosed: false }]));
    const reopened = TestBed.createComponent(AccountingClosuresListComponent);
    reopened.detectChanges();

    const chip = reopened.nativeElement.querySelector('.status-chip');
    expect(chip?.classList.contains('open')).toBe(true);
    expect(chip?.textContent?.trim()).toBe('COMMON.OPEN');
  });

  it('should navigate to create on onCreateClosure', () => {
    component.onCreateClosure();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/accounting/closures/create']);
  });

  it('should delete closure when confirmed', async () => {
    closureApiSpy.remove.mockReturnValue(of(undefined));

    await component.onDeleteClosure(CLOSURE);

    const asked = dialogSpy.confirm.mock.lastCall![0];
    expect(asked.destructive).toBe(true);
    expect(closureApiSpy.remove).toHaveBeenCalledWith(1);
    expect(closureApiSpy.list).toHaveBeenCalledTimes(2);
  });

  it('leaves the period alone when the confirmation is dismissed', async () => {
    dialogSpy.confirm.mockResolvedValue(false);

    // Awaited, unlike before: the handler is async now, and without the await this assertion
    // would pass whether or not the decline was honoured.
    await component.onDeleteClosure(CLOSURE);

    expect(closureApiSpy.remove).not.toHaveBeenCalled();
  });

  it('sets hasError to true when loading closures fails', () => {
    closureApiSpy.list.mockReturnValue(throwError(() => new Error('Server down')));
    const failedFixture = TestBed.createComponent(AccountingClosuresListComponent);
    failedFixture.detectChanges();

    expect(failedFixture.componentInstance.hasError()).toBe(true);
  });

  it('retries loading closures and resets hasError on retry', () => {
    closureApiSpy.list.mockReturnValue(throwError(() => new Error('Server down')));
    const failedFixture = TestBed.createComponent(AccountingClosuresListComponent);
    failedFixture.detectChanges();

    expect(failedFixture.componentInstance.hasError()).toBe(true);

    closureApiSpy.list.mockReturnValue(of([CLOSURE]));
    failedFixture.componentInstance.onRetry();

    expect(failedFixture.componentInstance.hasError()).toBe(false);
    expect(failedFixture.componentInstance.closures()).toEqual([CLOSURE]);
  });

  /**
   * Correcting a closure's comments (issue #789). Before this the only remedy was to delete the
   * closure — which re-opens the period — and close it again.
   */
  it('opens a closure for comment correction', () => {
    component.onEditClosure(CLOSURE);

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/accounting/closures/edit', CLOSURE.id]);
  });
});
