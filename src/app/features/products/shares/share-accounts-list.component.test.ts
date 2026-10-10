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
import { ShareAccountsListComponent } from './share-accounts-list.component';
import {
  ShareAccountService,
  GetAccountsTypeResponse,
  GetAccountsTypeAccountIdResponse,
} from '../../../api';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HttpEvent } from '@angular/common/http';
import { PageEvent } from '../../../shared/models/table.model';
import { provideTranslateTesting } from '../../../testing/i18n-testing';

describe('ShareAccountsListComponent', () => {
  let component: ShareAccountsListComponent;
  let fixture: ComponentFixture<ShareAccountsListComponent>;
  let shareServiceSpy: SpyObj<ShareAccountService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    shareServiceSpy = createSpyObj(['getAccountsType']);
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [ShareAccountsListComponent],
      providers: [
        ...provideTranslateTesting(),
        provideNoopAnimations(),
        { provide: ShareAccountService, useValue: shareServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    shareServiceSpy.getAccountsType.mockReturnValue(
      of({ pageItems: [], totalFilteredRecords: 0 }) as unknown as Observable<
        HttpEvent<GetAccountsTypeResponse>
      >,
    );
    fixture = TestBed.createComponent(ShareAccountsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load accounts on init', () => {
    expect(shareServiceSpy.getAccountsType).toHaveBeenCalledWith('share', 0, 10);
  });

  it('should navigate to create on onCreateAccount', () => {
    component.onCreateAccount();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/shares/create']);
  });

  it('should navigate to edit on onEditAccount', () => {
    const mockAccount = { id: 123 };
    component.onEditAccount(mockAccount as unknown as GetAccountsTypeAccountIdResponse);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/shares/edit', 123]);
  });

  it('should load accounts on page change', () => {
    const pageEvent = { pageIndex: 1, pageSize: 25, length: 100 } as PageEvent;
    component.onPageChange(pageEvent);
    expect(shareServiceSpy.getAccountsType).toHaveBeenCalledWith('share', 25, 25);
  });
});
