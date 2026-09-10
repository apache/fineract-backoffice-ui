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

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BASE_PATH } from '../../api';
import { ClientsListComponent } from './clients-list.component';
import { CLIENTS_ROUTES } from './clients.routes';

const SEARCH_URL = '/api/v2/clients/search';
const CLIENTS_URL = '/api/v1/clients';
const EMPTY_PAGE = { content: [], totalElements: 0 };

describe('ClientsListComponent search', () => {
  let component: ClientsListComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BASE_PATH, useValue: '/api' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    component = TestBed.runInInjectionContext(() => new ClientsListComponent());
  });

  afterEach(() => http.verify());

  it('browses all clients with an empty v2 query and displays accountNumber', () => {
    const req = http.expectOne(SEARCH_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ request: { text: '' }, page: 0, size: 10 });
    expect(component.isLoading()).toBe(true);
    req.flush({
      content: [{ id: 4, accountNumber: '0004', displayName: 'Jane', officeName: 'HQ' }],
      totalElements: 37,
    });
    expect(component.clients()[0]).toMatchObject({ accountNo: '0004', displayName: 'Jane' });
    expect(component.totalRecords()).toBe(37);
    expect(component.isLoading()).toBe(false);
  });

  it('keeps the text and page size across pages, then resets a new search to page zero', () => {
    http.expectOne(SEARCH_URL).flush(EMPTY_PAGE);
    component.onSearch('  external-id-42  ');
    expect(http.expectOne(SEARCH_URL).request.body.request.text).toBe('external-id-42');
    component.onPage({ pageIndex: 2, pageSize: 25, length: 90 });
    const page = http.expectOne(SEARCH_URL);
    expect(page.request.body).toEqual({ request: { text: 'external-id-42' }, page: 2, size: 25 });
    page.flush(EMPTY_PAGE);
    expect(component.pageIndex()).toBe(2);
    expect(component.pageSize()).toBe(25);
    component.onSearch('mobile');
    const search = http.expectOne(SEARCH_URL);
    expect(search.request.body).toEqual({ request: { text: 'mobile' }, page: 0, size: 25 });
    search.flush(EMPTY_PAGE);
    expect(component.pageIndex()).toBe(0);
  });

  it.each([
    ['accountNo', 'accountNumber'],
    ['fullname', 'displayName'],
    ['status', 'status'],
  ])('maps the %s column to the supported v2 sort property', (active, property) => {
    http.expectOne(SEARCH_URL).flush(EMPTY_PAGE);
    component.onSort({ active, direction: 'desc' });
    const req = http.expectOne(SEARCH_URL);
    expect(req.request.body.sorts).toEqual([{ property, direction: 'DESC' }]);
    req.flush(EMPTY_PAGE);
  });

  it('preserves status filtering and name matching with v1, then returns to v2 for All', () => {
    http.expectOne(SEARCH_URL).flush(EMPTY_PAGE);
    component.activeFilters.status = 'closed';
    component.onFilterChange();
    const filtered = http.expectOne((req) => req.url === CLIENTS_URL);
    expect(filtered.request.params.get('status')).toBe('closed');
    filtered.flush({ pageItems: [], totalFilteredRecords: 0 });
    component.onSearch('Jane');
    const named = http.expectOne((req) => req.url === CLIENTS_URL);
    expect(
      new URL(named.request.urlWithParams, 'https://localhost').searchParams.get('displayName'),
    ).toBe('%Jane%');
    expect(named.request.params.get('status')).toBe('closed');
    named.flush({ pageItems: [], totalFilteredRecords: 0 });
    expect(component.searchPlaceholder()).toBe('CLIENTS.SEARCH_BY_NAME');
    component.activeFilters.status = '';
    component.onFilterChange();
    const all = http.expectOne(SEARCH_URL);
    expect(all.request.body).toEqual({ request: { text: 'Jane' }, page: 0, size: 10 });
    all.flush(EMPTY_PAGE);
    expect(component.searchPlaceholder()).toBe('COMMON.SEARCH_PLACEHOLDER');
  });

  it('preserves office sorting without sending unsupported officeName to v2', () => {
    http.expectOne(SEARCH_URL).flush(EMPTY_PAGE);
    component.onSort({ active: 'officeName', direction: 'asc' });
    const req = http.expectOne((request) => request.url === CLIENTS_URL);
    expect(req.request.params.get('orderBy')).toBe('officeName');
    expect(req.request.params.get('sortOrder')).toBe('ASC');
    expect(req.request.params.has('status')).toBe(false);
    req.flush({ pageItems: [], totalFilteredRecords: 0 });
    component.onSort({ active: 'officeName', direction: '' });
    http.expectOne(SEARCH_URL).flush(EMPTY_PAGE);
  });

  it('keeps account and external-ID searches broad when Office sorting is requested', () => {
    http.expectOne(SEARCH_URL).flush(EMPTY_PAGE);
    component.onSort({ active: 'officeName', direction: 'asc' });
    http
      .expectOne((request) => request.url === CLIENTS_URL)
      .flush({ pageItems: [], totalFilteredRecords: 0 });
    component.onSearch('external-id-42');
    const broad = http.expectOne(SEARCH_URL);
    expect(broad.request.body.request.text).toBe('external-id-42');
    expect(broad.request.body.sorts).toBeUndefined();
    broad.flush(EMPTY_PAGE);
    expect(component.currentSort()).toEqual({ active: '', direction: '' });
    expect(component.columns().find((column) => column.key === 'officeName')?.sortable).toBe(false);
    component.onSort({ active: 'officeName', direction: 'asc' });
    const sorted = http.expectOne(SEARCH_URL);
    expect(sorted.request.body.request.text).toBe('external-id-42');
    expect(sorted.request.body.sorts).toBeUndefined();
    sorted.flush(EMPTY_PAGE);
  });

  it('clears stale rows and totals on errors, and retries the same search', () => {
    http.expectOne(SEARCH_URL).flush({ content: [{ id: 1 }], totalElements: 15 });
    component.onSearch('missing');
    http.expectOne(SEARCH_URL).flush({}, { status: 500, statusText: 'Server Error' });
    expect(component.hasError()).toBe(true);
    expect(component.clients()).toEqual([]);
    expect(component.totalRecords()).toBe(0);
    expect(component.isLoading()).toBe(false);
    component.onRetry();
    const retry = http.expectOne(SEARCH_URL);
    expect(retry.request.body.request.text).toBe('missing');
    retry.flush(EMPTY_PAGE);
    expect(component.hasError()).toBe(false);
  });

  it('cancels an obsolete search so it cannot replace newer results', () => {
    const old = http.expectOne(SEARCH_URL);
    component.onSearch('new');
    expect(old.cancelled).toBe(true);
    http
      .expectOne(SEARCH_URL)
      .flush({ content: [{ id: 2, displayName: 'New' }], totalElements: 1 });
    expect(component.clients()[0].id).toBe(2);
  });

  it('redirects the old standalone search URL to the single client list', () => {
    http.expectOne(SEARCH_URL).flush(EMPTY_PAGE);
    expect(CLIENTS_ROUTES.find((route) => route.path === 'search')).toMatchObject({
      redirectTo: '/clients',
      pathMatch: 'full',
    });
  });
});
