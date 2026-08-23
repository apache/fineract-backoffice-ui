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
import { AccountNumberFormatsListComponent } from './account-number-formats-list.component';
import { AccountNumberFormatService } from '../../../api';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService } from '../../../core/services/dialog.service';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('AccountNumberFormatsListComponent', () => {
  let component: AccountNumberFormatsListComponent;
  let fixture: ComponentFixture<AccountNumberFormatsListComponent>;
  let serviceSpy: SpyObj<AccountNumberFormatService>;
  let routerSpy: SpyObj<Router>;
  let dialogService: SpyObj<DialogService>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getAccountnumberformats',
      'deleteAccountnumberformatsAccountNumberFormatId',
    ]);
    routerSpy = createSpyObj(['navigate']);
    dialogService = createSpyObj(['confirm']);
    dialogService.confirm.mockResolvedValue(true);
    serviceSpy.getAccountnumberformats.mockReturnValue(
      of([
        { id: 1, accountType: { id: 1, value: 'CLIENT' }, prefixType: { id: 2, value: 'OFFICE' } },
      ]) as unknown as ReturnType<AccountNumberFormatService['getAccountnumberformats']>,
    );

    await TestBed.configureTestingModule({
      imports: [AccountNumberFormatsListComponent],
      providers: [
        { provide: AccountNumberFormatService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogService },
        provideNoopAnimations(),
        ...provideTranslateTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountNumberFormatsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load formats on init', () => {
    expect(component).toBeTruthy();
    expect(serviceSpy.getAccountnumberformats).toHaveBeenCalled();
    expect(component.formats()).toHaveLength(1);
  });

  it('should navigate to edit with the format id', () => {
    component.onEdit({ id: 3, accountType: { id: 1, value: 'LOAN' } });
    expect(routerSpy.navigate).toHaveBeenCalledWith([
      '/organization/account-number-formats/edit',
      3,
    ]);
  });

  it('should delete after confirmation and drop the row', async () => {
    dialogService.confirm.mockResolvedValue(true);
    serviceSpy.deleteAccountnumberformatsAccountNumberFormatId.mockReturnValue(
      of({}) as unknown as ReturnType<
        AccountNumberFormatService['deleteAccountnumberformatsAccountNumberFormatId']
      >,
    );

    component.onDelete({ id: 1, accountType: { id: 1, value: 'CLIENT' } });
    await fixture.whenStable();

    expect(serviceSpy.deleteAccountnumberformatsAccountNumberFormatId).toHaveBeenCalledWith(1);
    expect(component.formats()).toHaveLength(0);
  });

  it('should not delete when cancelled', async () => {
    dialogService.confirm.mockResolvedValue(false);
    component.onDelete({ id: 1, accountType: { id: 1, value: 'CLIENT' } });
    await fixture.whenStable();
    expect(serviceSpy.deleteAccountnumberformatsAccountNumberFormatId).not.toHaveBeenCalled();
    expect(component.formats()).toHaveLength(1);
  });
});
