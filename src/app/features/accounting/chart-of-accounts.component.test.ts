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
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { ChartOfAccountsComponent } from './chart-of-accounts.component';
import { GL_ACCOUNT_API, type GlAccount, type GlAccountApi } from '../../core/adapters';
import { DialogService } from '../../core/services/dialog.service';
import { createSpyObj, type SpyObj } from '../../testing/mocks';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { provideTranslateTesting } from '../../testing/i18n-testing';

/**
 * The chart of accounts, through its contract.
 *
 * This file could not exist while the screen talked to the generated client: a new file
 * importing `src/app/api` fails `local/no-generated-api-import`, which is exactly what ADR 0006
 * intends, so the delete added in #789 had nowhere to be tested. Giving GL accounts a port is
 * what made the test writable, and it dropped the screen's suppression entry at the same time.
 */
describe('ChartOfAccountsComponent', () => {
  const CASH_AT_VAULT: GlAccount = {
    id: 12,
    glCode: '10101',
    name: 'Cash at Vault',
    type: 'Asset',
    usage: 'Detail',
    disabled: false,
    manualEntriesAllowed: true,
    parentId: 4,
  };

  let fixture: ComponentFixture<ChartOfAccountsComponent>;
  let component: ChartOfAccountsComponent;
  let apiSpy: SpyObj<GlAccountApi>;
  let dialogSpy: SpyObj<DialogService>;

  beforeEach(async () => {
    apiSpy = createSpyObj<GlAccountApi>(['list', 'delete']);
    apiSpy.list.mockReturnValue(of([CASH_AT_VAULT]));
    apiSpy.delete.mockReturnValue(of(undefined));
    dialogSpy = createSpyObj<DialogService>(['open', 'confirm']);
    dialogSpy.confirm.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ChartOfAccountsComponent],
      providers: [
        provideNoopAnimations(),
        provideIonicTesting(),
        ...provideTranslateTesting(),
        { provide: GL_ACCOUNT_API, useValue: apiSpy },
        { provide: DialogService, useValue: dialogSpy },
        { provide: Router, useValue: createSpyObj(['navigate']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChartOfAccountsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * The Usage column printed `[object Object]` in every row: the payload sends
   * `{ id, code, value }` and the cell interpolated it. The contract hands the screen a label.
   */
  it('shows the usage label rather than the object Fineract sends', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Detail');
    expect(text).not.toContain('[object Object]');
  });

  it('asks before deleting, naming the account, then deletes and reloads the chart', async () => {
    const loadsBefore = apiSpy.list.mock.calls.length;

    await component.onDeleteAccount(CASH_AT_VAULT);

    const asked = dialogSpy.confirm.mock.lastCall![0];
    expect(asked.destructive).toBe(true);
    expect(asked.details?.[0].value).toBe('10101');
    expect(apiSpy.delete).toHaveBeenCalledWith(12);
    expect(apiSpy.list.mock.calls.length).toBe(loadsBefore + 1);
  });

  it('deletes nothing when the confirmation is declined', async () => {
    dialogSpy.confirm.mockResolvedValue(false);

    await component.onDeleteAccount(CASH_AT_VAULT);

    expect(apiSpy.delete).not.toHaveBeenCalled();
  });

  /**
   * An account with children, journal entries or product mappings is refused. Fineract's reason
   * reaches the operator through the error interceptor; what matters here is that the row is not
   * reloaded away as though the delete had worked.
   */
  it('leaves the chart alone when the platform refuses the delete', async () => {
    apiSpy.delete.mockReturnValue(throwError(() => new Error('error.msg.glaccount.has.children')));
    const loadsBefore = apiSpy.list.mock.calls.length;

    await component.onDeleteAccount(CASH_AT_VAULT);

    expect(apiSpy.list.mock.calls.length).toBe(loadsBefore);
  });

  it('offers a retry only for a load that failed, with the status it failed with', async () => {
    apiSpy.list.mockReturnValue(throwError(() => ({ status: 403 })));

    const failed = TestBed.createComponent(ChartOfAccountsComponent);
    failed.detectChanges();

    expect(failed.componentInstance.hasError()).toBe(true);
    expect(failed.componentInstance.errorStatus()).toBe(403);
  });
});
