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
import { AuditLogsListComponent } from './audit-logs-list.component';
import { AuditsService } from '../../../api';
import { of, Observable } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { expectLookedUp } from '../../../testing/translated-text';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PageEvent, SortEvent } from '../../../shared/models/table.model';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { DialogService } from '../../../core/services/dialog.service';
import { DOWNLOAD, DownloadAdapter } from '../../../core/adapters';

describe('AuditLogsListComponent', () => {
  let component: AuditLogsListComponent;
  let fixture: ComponentFixture<AuditLogsListComponent>;
  let auditsServiceSpy: SpyObj<AuditsService>;
  let dialogSpy: SpyObj<DialogService>;
  let downloadSpy: SpyObj<DownloadAdapter>;

  const MOCK_PAYLOAD = '{"key":"value"}';

  beforeEach(async () => {
    auditsServiceSpy = createSpyObj(['getAudits']);
    dialogSpy = createSpyObj<DialogService>(['open', 'confirm']);
    downloadSpy = createSpyObj<DownloadAdapter>(['save', 'saveText']);

    const mockResponse = {
      pageItems: [
        {
          id: 1,
          resourceId: 10,
          entityName: 'Client',
          actionName: 'CREATE',
          maker: 'mifos',
          madeOnDate: '2026-06-16T12:00:00Z',
          checker: 'mifos',
          checkedOnDate: '2026-06-16T12:05:00Z',
          processingResult: 'success',
          commandAsJson: MOCK_PAYLOAD,
        },
      ],
      totalFilteredRecords: 1,
      totalRecords: 1,
    };
    auditsServiceSpy.getAudits.mockReturnValue(of(mockResponse) as unknown as Observable<never>);

    await TestBed.configureTestingModule({
      imports: [AuditLogsListComponent],
      providers: [
        ...provideTranslateTesting(),
        provideIonicTesting(),
        { provide: AuditsService, useValue: auditsServiceSpy },
        { provide: DialogService, useValue: dialogSpy },
        { provide: DOWNLOAD, useValue: downloadSpy },
        provideNoopAnimations(),
      ],
    })
      .overrideComponent(AuditLogsListComponent, {
        add: {
          providers: [{ provide: DialogService, useValue: dialogSpy }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AuditLogsListComponent);
    component = fixture.componentInstance;
  });

  it('should create and load audit logs on init', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(auditsServiceSpy.getAudits).toHaveBeenCalled();
    expect(component.auditLogs()).toHaveLength(1);
    expect(component.auditLogs()[0]['entityName']).toBe('Client');
  });

  it('renders the filter labels through the translation adapter', () => {
    fixture.detectChanges();
    expectLookedUp(fixture.nativeElement, [
      'SECURITY.ACTION_NAME',
      'SECURITY.ENTITY_NAME',
      'SECURITY.RESOURCE_ID',
      'SECURITY.MAKER_ID',
      'SECURITY.MAKER_DATE_FROM',
      'SECURITY.MAKER_DATE_TO',
      'SECURITY.PROCESSING_RESULT',
    ]);
  });

  it('should handle apply and reset filters', () => {
    fixture.detectChanges();

    component.activeFilters.actionName = 'CREATE';
    component.onApplyFilters();
    expect(component.pageIndex()).toBe(0);

    component.onResetFilters();
    expect(component.activeFilters.actionName).toBe('');
  });

  it('should handle pagination changes', () => {
    fixture.detectChanges();

    const pageEvent: PageEvent = { pageIndex: 2, pageSize: 20, length: 100 } as PageEvent;
    component.onPage(pageEvent);

    expect(component.pageIndex()).toBe(2);
    expect(component.pageSize()).toBe(20);
  });

  it('should handle sorting changes', () => {
    fixture.detectChanges();

    const sortEvent: SortEvent = { active: 'entityName', direction: 'asc' };
    component.onSort(sortEvent);

    expect(component.pageIndex()).toBe(0);
  });

  it('should open details dialog', async () => {
    fixture.detectChanges();

    const mockRow = {
      id: 1,
      commandAsJson: MOCK_PAYLOAD,
    };
    dialogSpy.open.mockResolvedValue(undefined);

    await component.onViewDetails(mockRow);

    expect(dialogSpy.open).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ data: { payload: MOCK_PAYLOAD } }),
    );
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
      auditsServiceSpy.getAudits.mockReturnValue(
        of({
          pageItems: [
            { id: 2, entityName: 'Loan', actionName: 'UPDATE', maker: 'mifos', checker: null },
          ],
          totalFilteredRecords: 1,
        }) as unknown as Observable<never>,
      );
      fixture.detectChanges();

      expect(columnKeys()).not.toContain('checker');
      expect(columnKeys()).not.toContain('checkedOnDate');
      expect(columnKeys()).toContain('processingResult');
    });
  });

  describe('search', () => {
    beforeEach(() => {
      auditsServiceSpy.getAudits.mockReturnValue(
        of({
          pageItems: [
            { id: 1, entityName: 'Client', actionName: 'CREATE', maker: 'mifos' },
            { id: 2, entityName: 'Loan', actionName: 'APPROVE', maker: 'admin' },
          ],
          totalFilteredRecords: 2,
        }) as unknown as Observable<never>,
      );
      fixture.detectChanges();
    });

    it('narrows the loaded rows to those matching any visible field, ignoring case', () => {
      component.onSearch('  APPROVE ');
      expect(component.visibleLogs().map((r) => r['id'])).toEqual([2]);

      component.onSearch('mifos');
      expect(component.visibleLogs().map((r) => r['id'])).toEqual([1]);
    });

    it('restores every row when the search is cleared', () => {
      component.onSearch('loan');
      expect(component.visibleLogs()).toHaveLength(1);

      component.onSearch('');
      expect(component.visibleLogs()).toHaveLength(2);
    });

    it('does not refetch, since the endpoint has no free-text parameter', () => {
      auditsServiceSpy.getAudits.mockClear();
      component.onSearch('loan');
      expect(auditsServiceSpy.getAudits).not.toHaveBeenCalled();
    });
  });
});
