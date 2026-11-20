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
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { AccountNumberFormatsComponent } from './account-number-formats.component';
import {
  ACCOUNT_NUMBER_FORMAT_API,
  type AccountNumberFormat,
  type AccountNumberFormatApi,
  type AccountNumberFormatTemplate,
} from '../../../core/adapters';
import { DialogService } from '../../../core/services/dialog.service';
import { createSpyObj, type SpyObj } from '../../../testing/mocks';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

/**
 * Account number formats.
 *
 * Two platform facts shape this screen, and both are asserted here rather than described in a
 * comment: Fineract keeps at most one format per account type, and `PUT` carries `prefixType`
 * alone. So Add is withheld once every type is configured, and the prefix is its own action.
 */
describe('AccountNumberFormatsComponent', () => {
  const CLIENT_FORMAT: AccountNumberFormat = {
    id: 1,
    accountType: 'CLIENT',
    accountTypeId: 1,
    prefix: null,
  };

  const TEMPLATE: AccountNumberFormatTemplate = {
    accountTypes: [
      { id: 1, name: 'CLIENT' },
      { id: 2, name: 'LOAN' },
    ],
    prefixesByAccountType: {
      CLIENT: [{ id: 1, name: 'OFFICE_NAME' }],
      LOAN: [{ id: 101, name: 'PRODUCT_SHORT_NAME' }],
    },
  };

  let fixture: ComponentFixture<AccountNumberFormatsComponent>;
  let component: AccountNumberFormatsComponent;
  let apiSpy: SpyObj<AccountNumberFormatApi>;
  let dialogSpy: SpyObj<DialogService>;

  async function render(
    formats: AccountNumberFormat[] = [CLIENT_FORMAT],
    template: AccountNumberFormatTemplate = TEMPLATE,
  ) {
    apiSpy = createSpyObj<AccountNumberFormatApi>([
      'list',
      'template',
      'create',
      'setPrefix',
      'delete',
    ]);
    apiSpy.list.mockReturnValue(of(formats));
    apiSpy.template.mockReturnValue(of(template));
    apiSpy.create.mockReturnValue(of(undefined));
    apiSpy.setPrefix.mockReturnValue(of(undefined));
    apiSpy.delete.mockReturnValue(of(undefined));
    dialogSpy = createSpyObj<DialogService>(['open', 'confirm', 'prompt']);
    dialogSpy.confirm.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [AccountNumberFormatsComponent],
      providers: [
        provideNoopAnimations(),
        provideIonicTesting(),
        ...provideTranslateTesting(),
        { provide: ACCOUNT_NUMBER_FORMAT_API, useValue: apiSpy },
        { provide: DialogService, useValue: dialogSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountNumberFormatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return fixture;
  }

  it('shows a configured format, and says so when it has no prefix', async () => {
    await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('CLIENT');
    // 'No prefix', not an empty cell: an unset prefix is a fact about the format.
    expect(text).toContain('SYSTEM.NO_PREFIX');
  });

  it('offers only the account types that have no format yet', async () => {
    await render();

    expect(component.availableTypes().map((type) => type.name)).toEqual(['LOAN']);
    expect(component.addLabel()).toBe('SYSTEM.ADD_ACCOUNT_NUMBER_FORMAT');
  });

  /**
   * An empty `createButtonLabel` is what hides the button in `app-data-table`. Fineract refuses
   * a second format for a type, so offering Add here would promise a refusal.
   */
  it('withholds Add once every account type is configured', async () => {
    await render([
      CLIENT_FORMAT,
      { ...CLIENT_FORMAT, id: 2, accountType: 'LOAN', accountTypeId: 2 },
    ]);

    expect(component.availableTypes()).toEqual([]);
    expect(component.addLabel()).toBe('');
  });

  it('creates a format for the chosen type, without a prefix', async () => {
    await render();
    dialogSpy.prompt.mockResolvedValue({ accountType: '2' });

    await component.onAddFormat();

    expect(apiSpy.create).toHaveBeenCalledWith(2);
  });

  it('creates nothing when the dialog is dismissed', async () => {
    await render();
    dialogSpy.prompt.mockResolvedValue(undefined);

    await component.onAddFormat();

    expect(apiSpy.create).not.toHaveBeenCalled();
  });

  it("offers only the prefixes the row's own account type allows", async () => {
    await render();

    expect(component.prefixesFor(CLIENT_FORMAT).map((option) => option.name)).toEqual([
      'OFFICE_NAME',
    ]);
  });

  it('sets the prefix on the format it was asked about', async () => {
    await render();
    dialogSpy.prompt.mockResolvedValue({ prefixType: '1' });

    await component.onSetPrefix(CLIENT_FORMAT);

    expect(apiSpy.setPrefix).toHaveBeenCalledWith(1, 1);
  });

  it('asks before deleting, naming the account type', async () => {
    await render();

    await component.onDeleteFormat(CLIENT_FORMAT);

    const asked = dialogSpy.confirm.mock.lastCall![0];
    expect(asked.destructive).toBe(true);
    expect(asked.details?.[0].value).toBe('CLIENT');
    expect(apiSpy.delete).toHaveBeenCalledWith(1);
  });

  it('deletes nothing when the confirmation is declined', async () => {
    await render();
    dialogSpy.confirm.mockResolvedValue(false);

    await component.onDeleteFormat(CLIENT_FORMAT);

    expect(apiSpy.delete).not.toHaveBeenCalled();
  });

  it('offers a retry when the list cannot be read', async () => {
    await render();
    apiSpy.list.mockReturnValue(throwError(() => new Error('403')));

    const failed = TestBed.createComponent(AccountNumberFormatsComponent);
    failed.detectChanges();

    expect(failed.componentInstance.hasError()).toBe(true);
  });
});
