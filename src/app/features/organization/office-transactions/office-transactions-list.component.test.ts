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

/**
 * The refused-list state, which no end-to-end test can reach any more.
 *
 * `e2e/rbac-dead-end-controls.spec.ts` used to drive it with a real user holding
 * `READ_OFFICETRANSACTION` and not `READ_OFFICE`: the route admitted them and the platform then
 * refused `GET /officetransactions`, leaving a bare set of column headers that read as "there
 * are no office transactions". Gating the route on `READ_OFFICE` — the code the platform
 * actually checks — closes that door, so the only way left to produce a refused load is to
 * refuse the request directly.
 *
 * Still worth holding: the refusal is one of several ways the load can fail, and the empty
 * table under its headers is wrong for all of them.
 *
 * The request is driven through `HttpTestingController` rather than by mocking the generated
 * `DefaultService`, which would put an ADR 0006 boundary violation in a test file. Matching on
 * the path rather than the full URL is what makes that work without naming the generated
 * client's `BASE_PATH` either.
 */

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { OfficeTransactionsListComponent } from './office-transactions-list.component';

const TRANSACTION = {
  id: 7,
  fromOfficeName: 'Head Office',
  toOfficeName: 'Branch',
  transactionDate: [2026, 10, 3],
  transactionAmount: 250,
  description: 'Cash transfer',
};

describe('OfficeTransactionsListComponent', () => {
  let fixture: ComponentFixture<OfficeTransactionsListComponent>;
  let http: HttpTestingController;

  /** The one request `ngOnInit` makes, whatever base path the generated client was built with. */
  const listRequest = () => http.expectOne((req) => req.url.endsWith('/officetransactions'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OfficeTransactionsListComponent],
      providers: [
        ...provideTranslateTesting(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OfficeTransactionsListComponent);
    fixture.detectChanges();
  });

  const error = () =>
    fixture.nativeElement.querySelector('[data-testid="office-transactions-error"]');
  const table = () => fixture.nativeElement.querySelector('table[cdk-table]');

  it('shows the transactions once the list loads', () => {
    listRequest().flush(JSON.stringify([TRANSACTION]));
    fixture.detectChanges();

    expect(fixture.componentInstance.transactions()).toEqual([TRANSACTION]);
    expect(error()).toBeNull();
    expect(table()).not.toBeNull();
  });

  it('says the list was refused instead of showing an empty table', () => {
    listRequest().flush(null, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(error()?.textContent).toContain('COMMON.ERRORS.LOAD_FORBIDDEN');
    // The headers are what made the empty state read as "there is nothing here".
    expect(table()).toBeNull();
  });

  it('distinguishes a refusal from a load that simply failed', () => {
    listRequest().flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    // The message, not the icon: `[name]` on an `ion-icon` sets a property that the custom
    // element does not reflect to an attribute, so the icon is not readable from the DOM here.
    expect(error()?.textContent).toContain('COMMON.ERRORS.LOAD_FAILED');
    expect(error()?.textContent).not.toContain('COMMON.ERRORS.LOAD_FORBIDDEN');
    expect(table()).toBeNull();
  });

  it('leaves no table behind when the payload is not the array it claims', () => {
    // The platform answers this endpoint as text, and the component parses it itself.
    listRequest().flush('not json at all');
    fixture.detectChanges();

    expect(fixture.componentInstance.transactions()).toEqual([]);
    expect(error()).toBeNull();
  });

  afterEach(() => http.verify());
});
