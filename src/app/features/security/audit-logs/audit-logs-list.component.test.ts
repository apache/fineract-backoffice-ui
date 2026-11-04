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
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { ButtonComponent } from '../../../ui/button/button.component';
import { AuditLogsListComponent } from './audit-logs-list.component';
import { of, throwError } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { expectLookedUp } from '../../../testing/translated-text';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PageEvent, SortEvent } from '../../../shared/models/table.model';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import {
  AUDIT_API,
  DOWNLOAD,
  DownloadAdapter,
  type AuditApi,
  type AuditEntry,
  type AuditPage,
} from '../../../core/adapters';

function entry(overrides: Partial<AuditEntry>): AuditEntry {
  return {
    id: 1,
    actionName: '',
    entityName: '',
    resourceId: null,
    subresourceId: null,
    maker: '',
    madeOnDate: null,
    checker: '',
    checkedOnDate: null,
    processingResult: '',
    officeId: null,
    officeName: '',
    groupId: null,
    groupName: '',
    clientId: null,
    clientName: '',
    loanId: null,
    loanAccountNo: '',
    savingsAccountId: null,
    savingsAccountNo: '',
    commandAsJson: null,
    ...overrides,
  };
}

function page(items: AuditEntry[], totalFilteredRecords = items.length): AuditPage {
  return { items, totalFilteredRecords };
}

describe('AuditLogsListComponent', () => {
  let component: AuditLogsListComponent;
  let fixture: ComponentFixture<AuditLogsListComponent>;
  let api: SpyObj<AuditApi>;
  let downloadSpy: SpyObj<DownloadAdapter>;

  beforeEach(async () => {
    api = createSpyObj<AuditApi>(['list', 'get', 'searchTemplate']);
    downloadSpy = createSpyObj<DownloadAdapter>(['save', 'saveText']);

    api.list.mockReturnValue(
      of(
        page([
          entry({
            id: 1,
            resourceId: 10,
            entityName: 'Client',
            actionName: 'CREATE',
            maker: 'mifos',
            madeOnDate: '2026-06-16T12:00:00Z',
            checker: 'mifos',
            checkedOnDate: '2026-06-16T12:05:00Z',
            processingResult: 'success',
          }),
        ]),
      ),
    );
    api.searchTemplate.mockReturnValue(
      of({
        users: [{ id: 3, username: 'officer1' }],
        actionNames: ['CREATE', 'APPROVE'],
        entityNames: ['CLIENT', 'LOAN'],
        statuses: [{ id: 1, name: 'processed' }],
      }),
    );

    await TestBed.configureTestingModule({
      imports: [AuditLogsListComponent],
      providers: [
        ...provideTranslateTesting(),
        provideIonicTesting(),
        provideRouter([]),
        { provide: AUDIT_API, useValue: api },
        { provide: DOWNLOAD, useValue: downloadSpy },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditLogsListComponent);
    component = fixture.componentInstance;
  });

  const lastQuery = () => api.list.mock.lastCall![0];

  it('keeps an unknown total for a full audit page', () => {
    api.list.mockReturnValue(
      of(
        page(
          Array.from({ length: 10 }, (_, id) => entry({ id, entityName: 'Client' })),
          10,
        ),
      ),
    );
    fixture.detectChanges();

    expect(component.totalRecords()).toBe(11);
    const range = fixture.nativeElement.querySelector('[data-testid="paginator-range-label"]');
    expect(range.textContent.trim()).toBe('1 - 10 of many');
  });

  it('should create and load audit logs on init', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(api.list).toHaveBeenCalled();
    expect(component.auditLogs()).toHaveLength(1);
    expect(component.auditLogs()[0].entityName).toBe('Client');
  });

  it('asks for the newest entries first, one page at a time', () => {
    fixture.detectChanges();

    expect(lastQuery()).toMatchObject({ offset: 0, limit: 10, orderBy: 'id', sortOrder: 'DESC' });
  });

  it('renders the filter labels through the translation adapter', () => {
    fixture.detectChanges();
    expectLookedUp(fixture.nativeElement, [
      'COMMON.MAKER',
      'COMMON.CHECKER',
      'SECURITY.ACTION_NAME',
      'SECURITY.ENTITY_NAME',
      'SECURITY.PROCESSING_RESULT',
      'SECURITY.MAKER_DATE_FROM',
      'SECURITY.MAKER_DATE_TO',
      'SECURITY.RESOURCE_ID',
      'AUDIT.CLIENT_ID',
      'AUDIT.LOAN_ID',
    ]);
  });

  describe('filter choices', () => {
    it('offers what the search template publishes, after an "Any" choice', () => {
      fixture.detectChanges();

      expect(component.userOptions()).toEqual([
        { value: '', label: 'AUDIT.ANY' },
        { value: 3, label: 'officer1' },
      ]);
      expect(component.actionOptions().map((o) => o.value)).toEqual(['', 'CREATE', 'APPROVE']);
      expect(component.entityOptions().map((o) => o.value)).toEqual(['', 'CLIENT', 'LOAN']);
      expect(component.statusOptions()).toEqual([
        { value: '', label: 'AUDIT.ANY' },
        { value: 1, label: 'processed' },
      ]);
    });

    it('still loads the list when the template cannot be read', () => {
      api.searchTemplate.mockReturnValue(throwError(() => new Error('403')));
      fixture.detectChanges();

      expect(component.userOptions()).toEqual([{ value: '', label: 'AUDIT.ANY' }]);
      expect(component.auditLogs()).toHaveLength(1);
    });
  });

  describe('server-side filters', () => {
    beforeEach(() => fixture.detectChanges());

    it('sends the applied filters with the query, from the first page', () => {
      component.onPage({ pageIndex: 2, pageSize: 10 } as PageEvent);
      component.activeFilters = {
        ...component.activeFilters,
        actionName: 'APPROVE',
        entityName: 'LOAN',
        makerId: 3,
        statusId: 1,
        loanId: '457',
        madeFrom: '2026-10-01',
        madeTo: '2026-10-16',
      };
      component.onApplyFilters();

      expect(component.pageIndex()).toBe(0);
      expect(lastQuery()).toMatchObject({
        actionName: 'APPROVE',
        entityName: 'LOAN',
        makerId: 3,
        statusId: 1,
        loanId: 457,
        madeFrom: '2026-10-01',
        madeTo: '2026-10-16',
        offset: 0,
      });
    });

    it('keeps the applied filters when paging, not half-edited ones', () => {
      component.activeFilters = { ...component.activeFilters, actionName: 'APPROVE' };
      component.onApplyFilters();
      component.activeFilters = { ...component.activeFilters, actionName: 'DELETE' };

      component.onPage({ pageIndex: 1, pageSize: 10 } as PageEvent);

      expect(lastQuery()).toMatchObject({ actionName: 'APPROVE', offset: 10 });
    });

    it('clears every filter on reset', () => {
      component.activeFilters = { ...component.activeFilters, actionName: 'APPROVE', makerId: 3 };
      component.onApplyFilters();

      component.onResetFilters();

      expect(component.activeFilters.actionName).toBe('');
      expect(lastQuery()).toMatchObject({ actionName: undefined, makerId: undefined });
    });
  });

  it('should handle pagination changes', () => {
    fixture.detectChanges();

    const pageEvent: PageEvent = { pageIndex: 2, pageSize: 20, length: 100 } as PageEvent;
    component.onPage(pageEvent);

    expect(component.pageIndex()).toBe(2);
    expect(component.pageSize()).toBe(20);
    expect(lastQuery()).toMatchObject({ offset: 40, limit: 20 });
  });

  it('should handle sorting changes', () => {
    fixture.detectChanges();

    const sortEvent: SortEvent = { active: 'entityName', direction: 'asc' };
    component.onSort(sortEvent);

    expect(component.pageIndex()).toBe(0);
    expect(lastQuery()).toMatchObject({ orderBy: 'entityName', sortOrder: 'ASC' });
  });

  it('links each row to its entry', () => {
    fixture.detectChanges();

    const open = fixture.debugElement.query(By.css('[data-testid="audit-open-1"]'));
    expect((open.componentInstance as ButtonComponent).link()).toEqual(['/security/audits', 1]);
  });

  it('shows the retry state when the list fails, and recovers on retry', () => {
    api.list.mockReturnValue(throwError(() => new Error('500')));
    fixture.detectChanges();
    expect(component.hasError()).toBe(true);

    api.list.mockReturnValue(of(page([entry({ id: 2 })])));
    component.onRetry();

    expect(component.hasError()).toBe(false);
    expect(component.auditLogs().map((r) => r.id)).toEqual([2]);
  });

  it('exports the currently-loaded rows as CSV, excluding the actions column', () => {
    fixture.detectChanges();

    component.onExportCsv();

    expect(downloadSpy.saveText).toHaveBeenCalledTimes(1);
    const [csv, filename, mimeType] = downloadSpy.saveText.mock.lastCall!;
    expect(filename).toBe('audit-logs.csv');
    expect(mimeType).toBe('text/csv');
    expect(csv).toContain('Client');
    expect(csv).toContain('CREATE');
    expect(csv).not.toContain('COMMON.ACTIONS');
  });

  describe('checker columns', () => {
    const columnKeys = () => component.columns().map((c) => c.key);

    it('shows Checker and Checked Date when a loaded row has been checked', () => {
      fixture.detectChanges();

      expect(columnKeys()).toContain('checker');
      expect(columnKeys()).toContain('checkedOnDate');
    });

    it('hides them when no loaded row has a checker, as with maker-checker off', () => {
      api.list.mockReturnValue(
        of(page([entry({ id: 2, entityName: 'Loan', actionName: 'UPDATE', maker: 'mifos' })])),
      );
      fixture.detectChanges();

      expect(columnKeys()).not.toContain('checker');
      expect(columnKeys()).not.toContain('checkedOnDate');
      expect(columnKeys()).toContain('processingResult');
    });
  });

  describe('search', () => {
    beforeEach(() => {
      api.list.mockReturnValue(
        of(
          page([
            entry({ id: 1, entityName: 'Client', actionName: 'CREATE', maker: 'mifos' }),
            entry({ id: 2, entityName: 'Loan', actionName: 'APPROVE', maker: 'admin' }),
          ]),
        ),
      );
      fixture.detectChanges();
    });

    it('narrows the loaded rows to those matching any visible field, ignoring case', () => {
      component.onSearch('  APPROVE ');
      expect(component.visibleLogs().map((r) => r.id)).toEqual([2]);

      component.onSearch('mifos');
      expect(component.visibleLogs().map((r) => r.id)).toEqual([1]);
    });

    it('restores every row when the search is cleared', () => {
      component.onSearch('loan');
      expect(component.visibleLogs()).toHaveLength(1);

      component.onSearch('');
      expect(component.visibleLogs()).toHaveLength(2);
    });

    it('does not refetch, since the endpoint has no free-text parameter', () => {
      api.list.mockClear();
      component.onSearch('loan');
      expect(api.list).not.toHaveBeenCalled();
    });
  });
});
