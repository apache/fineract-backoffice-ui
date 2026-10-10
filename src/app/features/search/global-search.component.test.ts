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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';
import {
  GlobalSearchComponent,
  SearchAPIService,
  GetSearchResponse,
} from './global-search.component';
import {
  NavigationConfigService,
  NavSearchResult,
} from '../../core/services/navigation-config.service';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { provideFakeAdapters } from '../../testing/adapters';

describe('GlobalSearchComponent', () => {
  let fixture: ComponentFixture<GlobalSearchComponent>;
  let component: GlobalSearchComponent;
  let queryParamsSubject: BehaviorSubject<Record<string, string>>;
  let searchApiServiceSpy: {
    getSearchTemplate: ReturnType<typeof vi.fn>;
    getSearch: ReturnType<typeof vi.fn>;
  };
  let navigationConfigSpy: {
    searchRoutes: ReturnType<typeof vi.fn>;
  };
  let routerSpy: {
    navigate: ReturnType<typeof vi.fn>;
    navigateByUrl: ReturnType<typeof vi.fn>;
  };

  const mockSearchResults: GetSearchResponse[] = [
    {
      entityId: 101,
      entityAccountNo: 101,
      entityName: 'Jane Doe',
      entityType: 'CLIENT',
      parentName: 'Head Office',
    },
    {
      entityId: 202,
      entityAccountNo: 202,
      entityName: 'Business Loan',
      entityType: 'LOAN',
      parentName: 'Jane Doe',
    },
  ];

  const mockNavResults: NavSearchResult[] = [
    {
      label: 'Clients List',
      groupLabel: 'Clients',
      route: '/clients',
    },
  ];

  beforeEach(async () => {
    queryParamsSubject = new BehaviorSubject<Record<string, string>>({});

    searchApiServiceSpy = {
      getSearchTemplate: vi.fn().mockReturnValue(of({ allowedSearchTypes: ['clients', 'loans'] })),
      getSearch: vi.fn().mockReturnValue(of(mockSearchResults)),
    };

    navigationConfigSpy = {
      searchRoutes: vi.fn().mockReturnValue(mockNavResults),
    };

    routerSpy = {
      navigate: vi.fn(),
      navigateByUrl: vi.fn(),
    };

    const adapters = provideFakeAdapters();
    adapters.i18n.catalogue.set('SEARCH.TITLE', 'Search');
    adapters.i18n.catalogue.set('SEARCH.QUERY', 'Search Query');
    adapters.i18n.catalogue.set('SEARCH.RESOURCE_TYPE', 'Type');

    await TestBed.configureTestingModule({
      imports: [GlobalSearchComponent],
      providers: [
        ...provideIonicTesting(),
        ...adapters.providers,
        { provide: SearchAPIService, useValue: searchApiServiceSpy },
        { provide: NavigationConfigService, useValue: navigationConfigSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of({
              get: (key: string) => queryParamsSubject.value[key] ?? null,
            }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GlobalSearchComponent);
    component = fixture.componentInstance;
  });

  it('renders search form and initializes allowed search types', () => {
    fixture.detectChanges();
    expect(searchApiServiceSpy.getSearchTemplate).toHaveBeenCalled();
    expect(component.allowedSearchTypes()).toEqual(['clients', 'loans']);
    expect(component.results()).toEqual([]);
    expect(component.searched()).toBe(false);
  });

  it('automatically focuses search input after view init', async () => {
    fixture.detectChanges();
    const inputComponent = component.searchInput();
    if (inputComponent) {
      const setFocusSpy = vi
        .spyOn(inputComponent, 'setFocus')
        .mockResolvedValue(undefined as never);
      component.ngAfterViewInit();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(setFocusSpy).toHaveBeenCalled();
    }
  });

  it('automatically populates query and triggers search when q parameter is provided', () => {
    queryParamsSubject.next({ q: 'Jane' });
    fixture = TestBed.createComponent(GlobalSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.query).toBe('Jane');
    expect(searchApiServiceSpy.getSearch).toHaveBeenCalledWith('Jane', undefined, false);
    expect(component.results()).toEqual(mockSearchResults);
    expect(component.searched()).toBe(true);
  });

  it('executes search on demand and stores navigation and entity results', () => {
    fixture.detectChanges();
    component.query = 'Jane';
    component.selectedResource = 'clients';
    component.exactMatch = true;

    component.onSearch();

    expect(navigationConfigSpy.searchRoutes).toHaveBeenCalledWith('Jane');
    expect(component.navResults()).toEqual(mockNavResults);
    expect(searchApiServiceSpy.getSearch).toHaveBeenCalledWith('Jane', 'clients', true);
    expect(component.results()).toEqual(mockSearchResults);
    expect(component.isLoading()).toBe(false);
    expect(component.searched()).toBe(true);
  });

  it('gracefully handles search API errors without throwing', () => {
    searchApiServiceSpy.getSearch.mockReturnValue(throwError(() => new Error('Server error')));
    fixture.detectChanges();
    component.query = 'BadQuery';

    component.onSearch();

    expect(component.results()).toEqual([]);
    expect(component.isLoading()).toBe(false);
    expect(component.searched()).toBe(true);
  });

  it('navigates to the appropriate route on row click', () => {
    fixture.detectChanges();

    component.onRowClick(mockSearchResults[0]);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients', 101]);

    component.onRowClick(mockSearchResults[1]);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/loans', 202]);

    component.onRowClick({ entityId: 303, entityType: 'GROUP' } as GetSearchResponse);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/groups', 303]);

    component.onRowClick({ entityId: 404, entityType: 'SAVING' } as GetSearchResponse);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/savings', 404]);
  });

  it('navigates by url when navigation search result is clicked', () => {
    fixture.detectChanges();
    component.onNavResultClick(mockNavResults[0]);
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/clients');
  });
});
