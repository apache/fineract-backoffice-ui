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

import type { Mock } from 'vitest';
import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogService } from '../../../core/services/dialog.service';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError, Observable } from 'rxjs';
import { EntityDatatablesComponent } from './entity-datatables.component';
import { DatatableEntryDialogComponent } from '../datatable-entry-dialog/datatable-entry-dialog.component';
import { DataTablesService, GetDataTablesResponse } from '../../../api';

describe('EntityDatatablesComponent', () => {
  let component: EntityDatatablesComponent;
  let fixture: ComponentFixture<EntityDatatablesComponent>;
  let datatablesServiceSpy: SpyObj<DataTablesService>;
  let dialogServiceSpy: SpyObj<DialogService>;
  let dialogSpy: Mock;

  const mockDatatables: GetDataTablesResponse[] = [
    {
      registeredTableName: 'm_client_details',
      columnHeaderData: [
        // Real Fineract API responses mark the entity's own FK column (here
        // "client_id", not "id") as the primary key — that's what the
        // getColumnDefs/dialog column filtering keys off of.
        { columnName: 'client_id', isColumnPrimaryKey: true },
        { columnName: 'business_type' },
        { columnName: 'revenue' },
      ],
    },
    {
      registeredTableName: 'm_client_more_details',
      columnHeaderData: [
        { columnName: 'client_id', isColumnPrimaryKey: true },
        { columnName: 'notes' },
      ],
    },
  ];

  const mockTableDataResultSet = {
    columnHeaders: [{ columnName: 'business_type' }, { columnName: 'revenue' }],
    data: [
      ['Retail', 100_000],
      ['Corporate', 500_000],
    ],
  };

  beforeEach(async () => {
    datatablesServiceSpy = createSpyObj(['getDatatables', 'getDatatablesDatatableApptableId']);
    dialogServiceSpy = createSpyObj<DialogService>(['open', 'confirm']);
    dialogServiceSpy.open.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), EntityDatatablesComponent],
      providers: [
        provideIonicTesting(),
        { provide: DataTablesService, useValue: datatablesServiceSpy },
        { provide: DialogService, useValue: dialogServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EntityDatatablesComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('apptableName', 'client');
    fixture.componentRef.setInput('entityId', 123);

    dialogSpy = dialogServiceSpy.open;
  });

  it('should create and load datatables on init', () => {
    datatablesServiceSpy.getDatatables.mockReturnValue(
      of(mockDatatables) as unknown as Observable<never>,
    );
    datatablesServiceSpy.getDatatablesDatatableApptableId.mockReturnValue(
      of(mockTableDataResultSet) as unknown as Observable<never>,
    );

    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(datatablesServiceSpy.getDatatables).toHaveBeenCalledWith('client');
    expect(component.datatables()).toEqual(mockDatatables);
    expect(component.activeTable()).toEqual(mockDatatables[0]);

    expect(datatablesServiceSpy.getDatatablesDatatableApptableId).toHaveBeenCalledWith(
      'm_client_details',
      123,
    );
    expect(component.tableData()).toEqual([
      { business_type: 'Retail', revenue: 100_000 },
      { business_type: 'Corporate', revenue: 500_000 },
    ]);
  });

  it('should handle empty datatables on load', () => {
    datatablesServiceSpy.getDatatables.mockReturnValue(of([]) as unknown as Observable<never>);

    fixture.detectChanges();

    expect(component.datatables()).toHaveLength(0);
    expect(datatablesServiceSpy.getDatatablesDatatableApptableId).not.toHaveBeenCalled();
  });

  it('should handle error when loading datatables', () => {
    vi.spyOn(console, 'error');
    datatablesServiceSpy.getDatatables.mockReturnValue(
      throwError(() => new Error('API Error')) as unknown as Observable<never>,
    );

    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it('should handle table data response as string', () => {
    datatablesServiceSpy.getDatatables.mockReturnValue(
      of(mockDatatables) as unknown as Observable<never>,
    );
    datatablesServiceSpy.getDatatablesDatatableApptableId.mockReturnValue(
      of(JSON.stringify(mockTableDataResultSet)) as unknown as Observable<never>,
    );

    fixture.detectChanges();

    expect(component.tableData()).toHaveLength(2);
  });

  it('should handle error when loading table data', () => {
    vi.spyOn(console, 'error');
    datatablesServiceSpy.getDatatables.mockReturnValue(
      of(mockDatatables) as unknown as Observable<never>,
    );
    datatablesServiceSpy.getDatatablesDatatableApptableId.mockReturnValue(
      throwError(() => new Error('Data Error')) as unknown as Observable<never>,
    );

    fixture.detectChanges();

    expect(component.isTableLoading()).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it('should fetch new table data on tab change', () => {
    datatablesServiceSpy.getDatatables.mockReturnValue(
      of(mockDatatables) as unknown as Observable<never>,
    );
    datatablesServiceSpy.getDatatablesDatatableApptableId.mockReturnValue(
      of(mockTableDataResultSet) as unknown as Observable<never>,
    );

    fixture.detectChanges();

    // Trigger tab change to second tab
    const secondTab = fixture.nativeElement.querySelectorAll('[role=tab]')[1] as HTMLButtonElement;
    secondTab.click();
    fixture.detectChanges();
    expect(secondTab.getAttribute('aria-selected')).toBe('true');
    const panel = fixture.nativeElement.querySelector('[role=tabpanel]') as HTMLElement;
    expect(panel.getAttribute('aria-labelledby')).toBe(secondTab.id);
    expect(secondTab.getAttribute('aria-controls')).toBe(panel.id);

    expect(component.activeTable()).toEqual(mockDatatables[1]);
    expect(datatablesServiceSpy.getDatatablesDatatableApptableId).toHaveBeenCalledWith(
      'm_client_more_details',
      123,
    );
  });

  it('should format column defs and filter out standard ID columns', () => {
    const colDefs = component.getColumnDefs(mockDatatables[0]);
    expect(colDefs).toHaveLength(2);
    expect(colDefs[0].key).toBe('business_type');
    expect(colDefs[1].key).toBe('revenue');
  });

  it('should open the add-entry dialog with the table columns and entity id', async () => {
    dialogSpy.mockResolvedValue(false);

    await component.onAddEntry(mockDatatables[0]);

    expect(dialogSpy).toHaveBeenCalledWith(
      DatatableEntryDialogComponent,
      expect.objectContaining({
        data: {
          datatableName: 'm_client_details',
          apptableId: 123,
          columns: mockDatatables[0].columnHeaderData,
        },
      }),
    );
  });

  it('should reload table data after a saved add-entry dialog closes', async () => {
    datatablesServiceSpy.getDatatablesDatatableApptableId.mockReturnValue(
      of(mockTableDataResultSet) as unknown as Observable<never>,
    );
    dialogSpy.mockResolvedValue(true);

    await component.onAddEntry(mockDatatables[0]);

    expect(datatablesServiceSpy.getDatatablesDatatableApptableId).toHaveBeenCalledWith(
      'm_client_details',
      123,
    );
  });

  it('should not reload table data when the dialog is dismissed without saving', async () => {
    dialogSpy.mockResolvedValue(false);
    datatablesServiceSpy.getDatatablesDatatableApptableId.mockClear();

    await component.onAddEntry(mockDatatables[0]);

    expect(datatablesServiceSpy.getDatatablesDatatableApptableId).not.toHaveBeenCalled();
  });
});
