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
import { AccountingClosureFormComponent } from './accounting-closure-form.component';
import { ACCOUNTING_CLOSURE_API, OFFICE_API } from '../../core/adapters';
import type { AccountingClosureApi, OfficeApi } from '../../core/adapters';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { expectLookedUp } from '../../testing/translated-text';

describe('AccountingClosureFormComponent', () => {
  let component: AccountingClosureFormComponent;
  let fixture: ComponentFixture<AccountingClosureFormComponent>;
  let closureApiSpy: SpyObj<AccountingClosureApi>;
  let officeApiSpy: SpyObj<OfficeApi>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    closureApiSpy = createSpyObj(['list', 'create', 'remove']);
    officeApiSpy = createSpyObj(['list']);
    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [AccountingClosureFormComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: ACCOUNTING_CLOSURE_API, useValue: closureApiSpy },
        { provide: OFFICE_API, useValue: officeApiSpy },
        { provide: Router, useValue: routerSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();
    officeApiSpy.list.mockReturnValue(of([]));
    fixture = TestBed.createComponent(AccountingClosureFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('asks the API to close the period the form describes', () => {
    component.request.officeId = 1;
    component.closingDate = '2026-05-31';
    component.request.comments = 'Monthly closure';

    closureApiSpy.create.mockReturnValue(of(undefined));

    component.onSubmit();

    // `dateFormat` and `locale` are deliberately absent. They are how Fineract parses a date,
    // which moved into the adapter with ADR 0006; the adapter's own spec pins them. This screen
    // is specified to send an ISO date and nothing about transport.
    expect(closureApiSpy.create).toHaveBeenCalledWith({
      officeId: 1,
      closingDate: '2026-05-31',
      comments: 'Monthly closure',
    });
  });

  it('navigates back to the list once the period is closed', () => {
    component.request.officeId = 1;
    closureApiSpy.create.mockReturnValue(of(undefined));

    component.onSubmit();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/accounting/closures']);
  });

  it('stops saving when closing the period fails', () => {
    component.request.officeId = 1;
    closureApiSpy.create.mockReturnValue(throwError(() => new Error('rejected')));

    component.onSubmit();

    expect(component.isSaving()).toBe(false);
  });

  it('does not submit without an office, which the API requires', () => {
    component.request.officeId = undefined;

    component.onSubmit();

    expect(closureApiSpy.create).not.toHaveBeenCalled();
    expect(component.isSaving()).toBe(false);
  });

  it('renders its heading and date label through the translation adapter', () => {
    expectLookedUp(fixture.nativeElement, [
      'ACCOUNTING_CLOSURES.CLOSE_ACCOUNTING_PERIOD',
      'ACCOUNTING_CLOSURES.CLOSING_DATE',
    ]);
  });
});
