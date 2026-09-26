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
import { SavingsAccountsListComponent } from './savings-accounts-list.component';
import { SavingsAccountService, GetSavingsAccountsResponse } from '../../api';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HttpEvent } from '@angular/common/http';
import { provideFakeAdapters } from '../../testing/adapters';
import { provideTranslateTesting } from '../../testing/i18n-testing';

function savingsResponse(
  pageItems: Record<string, unknown>[],
  totalFilteredRecords: number,
): Observable<HttpEvent<GetSavingsAccountsResponse>> {
  return of({ pageItems, totalFilteredRecords }) as unknown as Observable<
    HttpEvent<GetSavingsAccountsResponse>
  >;
}

describe('SavingsAccountsListComponent', () => {
  let component: SavingsAccountsListComponent;
  let fixture: ComponentFixture<SavingsAccountsListComponent>;
  let savingsServiceSpy: SpyObj<SavingsAccountService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    savingsServiceSpy = createSpyObj(['getSavingsaccounts']);
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [SavingsAccountsListComponent],
      providers: [
        provideNoopAnimations(),
        ...provideFakeAdapters().providers,
        // app-data-table (rendered via the component's template) still uses ngx-translate's
        // own `| translate` internally, so the library itself has to be configured — see
        // provideTranslateTesting's doc comment.
        provideTranslateTesting(),
        { provide: SavingsAccountService, useValue: savingsServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SavingsAccountsListComponent);
    component = fixture.componentInstance;
  });

  it('reports the server-side total, not NaN, when every row survives the client-side filter', () => {
    // Regression test for #620: `response.pageItems` is an array (it has no `.size`), so the
    // "did we filter anything out" guard has to compare `.length`. With every row surviving the
    // deposit-type filter, pageItems.length === items.length and totalRecords must stay exactly
    // what the server reported.
    savingsServiceSpy.getSavingsaccounts.mockReturnValue(
      savingsResponse([{ id: 1, accountNo: '000000001' }], 1),
    );

    fixture.detectChanges();

    expect(component.totalRecords).toBe(1);
    expect(Number.isNaN(component.totalRecords)).toBe(false);
    expect(component.accounts()).toHaveLength(1);
  });

  it('still adjusts totalRecords down when a deposit-type-200 row is filtered out client-side', () => {
    savingsServiceSpy.getSavingsaccounts.mockReturnValue(
      savingsResponse(
        [
          { id: 1, accountNo: '000000001' },
          { id: 2, accountNo: '000000002', depositType: { id: 200 } },
        ],
        2,
      ),
    );

    fixture.detectChanges();

    expect(component.totalRecords).toBe(1);
    expect(component.accounts()).toHaveLength(1);
  });

  it('reports zero, not NaN, for an empty page', () => {
    savingsServiceSpy.getSavingsaccounts.mockReturnValue(savingsResponse([], 0));

    fixture.detectChanges();

    expect(component.totalRecords).toBe(0);
    expect(component.accounts()).toHaveLength(0);
  });
});
