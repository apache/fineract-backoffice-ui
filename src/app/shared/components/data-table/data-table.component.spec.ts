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

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DataTableComponent, ColumnDef } from './data-table.component';
import { CellTemplateDirective } from './cell-template.directive';
import { PageEvent, SortEvent } from '../../models/table.model';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { provideTestConfig } from '../../../testing/config';
import { AuthService } from '../../../core/services/auth.service';

interface TestData {
  id: number;
  name: string;
  status: { value: string; code: string };
}

const COLUMNS: ColumnDef[] = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'status', label: 'Status', sortable: false },
];

const ROWS: TestData[] = [
  { id: 1, name: 'Alice', status: { value: 'Active', code: 'active' } },
  { id: 2, name: 'Bob', status: { value: 'Inactive', code: 'inactive' } },
];

const CUSTOM_CELL = '.custom-cell';
const SORT_BUTTON = 'button.sort-button';

describe('DataTableComponent', () => {
  let fixture: ComponentFixture<DataTableComponent<TestData>>;
  let component: DataTableComponent<TestData>;

  /** Names in the second column of each rendered row, in render order. */
  const renderedNames = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('tr[cdk-row]')).map((row) =>
      (row as HTMLElement).children[1].textContent!.trim(),
    );

  const setInputs = (inputs: Record<string, unknown>): void => {
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataTableComponent, TranslateModule.forRoot()],
      providers: [
        provideIonicTesting(),
        // The create button is now gated by `*appHasPermission`, which reads both the session
        // and the deployment's `rbacEnabled`; neither has a usable default in a bare TestBed.
        provideTestConfig(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent<DataTableComponent<TestData>>(DataTableComponent);
    component = fixture.componentInstance;
    setInputs({ columns: COLUMNS, data: ROWS, localLogic: true });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a row per record', () => {
    expect(component.rows()).toHaveSize(2);
    expect(renderedNames()).toEqual(['Alice', 'Bob']);
  });

  it('renders the no-data row when there are no records', () => {
    setInputs({ data: [] });

    expect(fixture.nativeElement.querySelector('.no-data-row')).toBeTruthy();
  });

  describe('cell values', () => {
    it('unwraps Fineract { value, code } option objects', () => {
      expect(component.getCellValue(ROWS[0], 'status')).toBe('Active');
    });

    it('resolves nested values using dot notation', () => {
      const nested = { user: { profile: { name: 'John Doe' } } };

      expect(component.getCellValue(nested as unknown as TestData, 'user.profile.name')).toBe(
        'John Doe',
      );
    });

    it('returns undefined rather than throwing on a missing branch', () => {
      expect(component.getCellValue({} as TestData, 'user.profile.name')).toBeUndefined();
    });
  });

  describe('local logic', () => {
    it('filters rows on search', () => {
      component.onSearch('alice');
      fixture.detectChanges();

      expect(renderedNames()).toEqual(['Alice']);
    });

    it('matches case-insensitively across any displayed column', () => {
      component.onSearch('INACTIVE');
      fixture.detectChanges();

      expect(renderedNames()).toEqual(['Bob']);
    });

    it('sorts ascending, then descending, then clears', () => {
      const nameColumn = COLUMNS[1];

      component.onSortHeaderClick(nameColumn);
      fixture.detectChanges();
      expect(renderedNames()).toEqual(['Alice', 'Bob']);

      component.onSortHeaderClick(nameColumn);
      fixture.detectChanges();
      expect(renderedNames()).toEqual(['Bob', 'Alice']);

      component.onSortHeaderClick(nameColumn);
      fixture.detectChanges();
      expect(component.sort()).toEqual({ active: '', direction: '' });
    });

    it('ignores clicks on non-sortable columns', () => {
      let emitted: SortEvent | undefined;
      component.sortChange.subscribe((event) => (emitted = event));

      component.onSortHeaderClick(COLUMNS[2]);

      expect(component.sort().direction).toBe('');
      expect(emitted).toBeUndefined();
    });

    it('sorts numerically rather than lexically', () => {
      setInputs({
        data: [
          { id: 10, name: 'Ten', status: { value: 'A', code: 'a' } },
          { id: 9, name: 'Nine', status: { value: 'B', code: 'b' } },
        ],
      });

      component.onSortHeaderClick(COLUMNS[0]);
      fixture.detectChanges();

      expect(renderedNames()).toEqual(['Nine', 'Ten']);
    });

    it('sorts rows with a missing value last, in both directions', () => {
      setInputs({
        data: [
          { id: 1, name: 'Zoe', status: { value: 'A', code: 'a' } },
          { id: 2, name: null as unknown as string, status: { value: 'B', code: 'b' } },
          { id: 3, name: 'Amy', status: { value: 'C', code: 'c' } },
        ],
      });

      component.onSortHeaderClick(COLUMNS[1]);
      fixture.detectChanges();
      expect(renderedNames()).toEqual(['Amy', 'Zoe', '']);

      component.onSortHeaderClick(COLUMNS[1]);
      fixture.detectChanges();
      expect(renderedNames()).toEqual(['Zoe', 'Amy', '']);
    });

    it('paginates and reports the filtered total', () => {
      setInputs({ pageSize: 1 });

      expect(component.rows()).toHaveSize(1);
      expect(component.displayedTotal()).toBe(2);

      component.onPage({ pageIndex: 1, pageSize: 1, length: 2 });
      fixture.detectChanges();

      expect(renderedNames()).toEqual(['Bob']);
    });

    it('returns to the first page when a search narrows the results', () => {
      setInputs({ pageSize: 1 });
      component.onPage({ pageIndex: 1, pageSize: 1, length: 2 });

      component.onSearch('alice');
      fixture.detectChanges();

      expect(renderedNames()).toEqual(['Alice']);
    });
  });

  describe('server-side mode', () => {
    beforeEach(() => {
      setInputs({ localLogic: false, totalRecords: 250 });
    });

    it('passes data straight through without slicing', () => {
      expect(renderedNames()).toEqual(['Alice', 'Bob']);
      expect(component.displayedTotal()).toBe(250);
    });

    it('does not filter locally, leaving the parent to refetch', () => {
      component.onSearch('alice');
      fixture.detectChanges();

      expect(renderedNames()).toEqual(['Alice', 'Bob']);
    });

    it('emits sort changes for the parent to act on', () => {
      let emitted: SortEvent | undefined;
      component.sortChange.subscribe((event) => (emitted = event));

      component.onSortHeaderClick(COLUMNS[1]);

      expect(emitted).toEqual({ active: 'name', direction: 'asc' });
    });

    /*
     * These pin the bug that made pagination unusable. effectivePageIndex read
     * the raw @Input, which server-side parents never bind back, so it stayed 0:
     * the range label never moved off "1 - 10", "previous" stayed disabled, and
     * goTo() — which computes from the current index — resolved "next" to page 1
     * every time, making page 2 the only page reachable.
     */
    it('advances its own page index without the parent binding it back', () => {
      expect(component.effectivePageIndex).toBe(0);

      component.onPage({ pageIndex: 1, pageSize: 10, length: 250 });
      expect(component.effectivePageIndex).toBe(1);

      component.onPage({ pageIndex: 2, pageSize: 10, length: 250 });
      expect(component.effectivePageIndex).toBe(2);
    });

    it('still lets a parent drive the page index through the input', () => {
      // Parents mirror the index back from (pageChange) — see onPage() in clients-list and
      // centers-list — so the bound value tracks the table while the user pages.
      component.onPage({ pageIndex: 3, pageSize: 10, length: 250 });
      setInputs({ pageIndex: 3 });
      expect(component.effectivePageIndex).toBe(3);

      // What a parent does when a filter changes and it refetches from offset 0.
      setInputs({ pageIndex: 0 });

      expect(component.effectivePageIndex).toBe(0);
    });

    it('returns to the first page on search, matching the parent refetch', () => {
      component.onPage({ pageIndex: 4, pageSize: 10, length: 250 });

      component.onSearch('alice');

      expect(component.effectivePageIndex).toBe(0);
    });

    it('returns to the first page on sort, since the order changed', () => {
      component.onPage({ pageIndex: 4, pageSize: 10, length: 250 });

      component.onSortHeaderClick(COLUMNS[1]);

      expect(component.effectivePageIndex).toBe(0);
    });

    it('tracks page size changes too', () => {
      component.onPage({ pageIndex: 1, pageSize: 25, length: 250 });

      expect(component.effectivePageSize).toBe(25);
    });
  });

  describe('create button permission', () => {
    const createButton = (): HTMLElement | null =>
      fixture.nativeElement.querySelector('[data-testid="data-table-create"]');

    /** Signs a permission set in, so `*appHasPermission` has something to evaluate. */
    const signIn = (permissions: string[]): void => {
      TestBed.inject(AuthService).currentUser.set({
        username: 'tester',
        base64EncodedAuthenticationKey: 'key',
        authenticated: true,
        officeId: 1,
        officeName: 'Head Office',
        userId: 1,
        permissions,
      });
      fixture.detectChanges();
    };

    it('shows the button to everyone when no permission is named', () => {
      signIn([]);
      setInputs({ createButtonLabel: 'CREATE' });
      expect(createButton()).toBeTruthy();
    });

    it('shows the button to a user who holds the permission', () => {
      signIn(['CREATE_CLIENT']);
      setInputs({ createButtonLabel: 'CREATE', createPermission: 'CREATE_CLIENT' });
      expect(createButton()).toBeTruthy();
    });

    it('withholds the button from a user who does not', () => {
      signIn(['READ_CLIENT']);
      setInputs({ createButtonLabel: 'CREATE', createPermission: 'CREATE_CLIENT' });
      expect(createButton()).toBeNull();
    });

    it('withholds it from a read-only user, whose create route would refuse them anyway', () => {
      signIn(['ALL_FUNCTIONS_READ']);
      setInputs({ createButtonLabel: 'CREATE', createPermission: 'CREATE_CLIENT' });
      expect(createButton()).toBeNull();
    });

    it('shows it to a superuser', () => {
      signIn(['ALL_FUNCTIONS']);
      setInputs({ createButtonLabel: 'CREATE', createPermission: 'CREATE_CLIENT' });
      expect(createButton()).toBeTruthy();
    });
  });

  describe('outputs', () => {
    it('emits create', () => {
      spyOn(component.create, 'emit');
      component.onCreate();

      expect(component.create.emit).toHaveBeenCalled();
    });

    it('emits searchChange', () => {
      spyOn(component.searchChange, 'emit');
      component.onSearch('test');

      expect(component.searchChange.emit).toHaveBeenCalledWith('test');
    });

    it('emits pageChange', () => {
      let emitted: PageEvent | undefined;
      component.pageChange.subscribe((event) => (emitted = event));

      component.onPage({ pageIndex: 1, pageSize: 10, length: 2 });

      expect(emitted).toEqual({ pageIndex: 1, pageSize: 10, length: 2 });
    });
  });

  describe('accessibility', () => {
    it('renders native buttons only for sortable headers', () => {
      const headers = fixture.nativeElement.querySelectorAll('th[cdk-header-cell]');
      const sortButtons = fixture.nativeElement.querySelectorAll(SORT_BUTTON);

      expect(sortButtons).toHaveSize(2);
      expect(sortButtons[0].getAttribute('type')).toBe('button');
      expect(headers[0].querySelector(SORT_BUTTON)).toBe(sortButtons[0]);
      expect(headers[1].querySelector(SORT_BUTTON)).toBe(sortButtons[1]);
      expect(headers[2].querySelector(SORT_BUTTON)).toBeNull();
    });

    it('sorts through the rendered keyboard-operable control', () => {
      const nameSortButton: HTMLButtonElement =
        fixture.nativeElement.querySelectorAll(SORT_BUTTON)[1];

      nameSortButton.focus();
      nameSortButton.click();
      fixture.detectChanges();

      expect(document.activeElement).toBe(nameSortButton);
      expect(component.sort()).toEqual({ active: 'name', direction: 'asc' });
    });

    it('exposes the sorted column via aria-sort', () => {
      component.onSortHeaderClick(COLUMNS[1]);
      fixture.detectChanges();

      const headers = fixture.nativeElement.querySelectorAll('th[cdk-header-cell]');
      expect(headers[1].getAttribute('aria-sort')).toBe('ascending');
      expect(headers[0].getAttribute('aria-sort')).toBeNull();
    });
  });
  describe('error state', () => {
    const errorPanel = () =>
      fixture.nativeElement.querySelector('[data-testid="data-table-error"]');

    it('should not show anything about errors on a normal load', () => {
      expect(errorPanel()).toBeNull();
      expect(renderedNames()).toEqual(['Alice', 'Bob']);
    });

    it('should replace the table rather than showing an empty one', () => {
      setInputs({ hasError: true });

      // "No records found" under a failed request tells the user the data does not exist,
      // when in fact nobody knows.
      expect(errorPanel()).not.toBeNull();
      expect(fixture.nativeElement.querySelector('table.data-table')).toBeNull();
    });

    it('should ask the parent to load again when the user retries', () => {
      setInputs({ hasError: true });
      let retries = 0;
      component.retry.subscribe(() => retries++);

      fixture.nativeElement.querySelector('[data-testid="data-table-retry"]').click();

      expect(retries).toBe(1);
    });

    it('should restore the table once a retry succeeds', () => {
      setInputs({ hasError: true });
      setInputs({ hasError: false });

      expect(errorPanel()).toBeNull();
      expect(renderedNames()).toEqual(['Alice', 'Bob']);
    });
  });
  describe('projected cell templates', () => {
    /**
     * The template for `name` sits inside an `@if`, so it registers after the table's first
     * content pass. Under `@ContentChildren` + `QueryList` this is the case that silently
     * failed: `QueryList.changes` does not mark an OnPush view dirty, so the late template
     * was never picked up and the column kept rendering its plain value.
     */
    @Component({
      standalone: true,
      imports: [DataTableComponent, CellTemplateDirective],
      template: `
        <app-data-table [columns]="columns" [data]="data" [localLogic]="true">
          @if (showCustom()) {
            <ng-template appCellTemplate="name" let-row>
              <span class="custom-cell">custom:{{ row.name }}</span>
            </ng-template>
          }
        </app-data-table>
      `,
    })
    class HostComponent {
      readonly columns = COLUMNS;
      readonly data = ROWS;
      readonly showCustom = signal(false);
    }

    it('picks up a template that registers after the first pass', () => {
      const host = TestBed.createComponent(HostComponent);
      host.detectChanges();

      expect(host.nativeElement.querySelectorAll(CUSTOM_CELL)).toHaveSize(0);

      host.componentInstance.showCustom.set(true);
      host.detectChanges();

      expect(host.nativeElement.querySelectorAll(CUSTOM_CELL)).toHaveSize(2);
      expect(host.nativeElement.querySelector(CUSTOM_CELL).textContent.trim()).toBe('custom:Alice');
    });
  });
});
