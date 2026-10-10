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

import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { I18N, TranslatePipe } from '../../../core/adapters';
import {
  DataTableComponent,
  ColumnDef,
  HasPermissionDirective,
  CellTemplateDirective,
} from '../../../shared';
import { DataTablesService, GetDataTablesResponse } from '../../../api';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { DialogService } from '../../../core/services/dialog.service';
import { ButtonComponent } from '../../../ui/button/button.component';

@Component({
  selector: 'app-datatables-list',
  standalone: true,
  imports: [
    RouterModule,
    TranslatePipe,
    DataTableComponent,
    HasPermissionDirective,
    CellTemplateDirective,
    ButtonComponent,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      title="SYSTEM.DATA_TABLES"
      [columns]="columns"
      [data]="datatables()"
      [isLoading]="isLoading()"
      [localLogic]="true"
    >
      <app-button
        type="button"
        intent="primary"
        [link]="['create']"
        icon="add-outline"
        headerActions
        *appHasPermission="'CREATE_DATATABLE'"
        >{{ 'SYSTEM.CREATE_DATA_TABLE' | appTranslate }}</app-button
      >

      <ng-template appCellTemplate="actions" let-row>
        <div class="action-buttons">
          <app-button
            type="button"
            intent="primary"
            emphasis="quiet"
            [label]="'COMMON.EDIT' | appTranslate"
            [link]="['edit', row.registeredTableName]"
            icon="create-outline"
            *appHasPermission="'UPDATE_DATATABLE'"
            [appTooltip]="'COMMON.EDIT' | appTranslate"
          />
          <app-button
            type="button"
            intent="danger"
            emphasis="quiet"
            [label]="'COMMON.DELETE' | appTranslate"
            icon="trash-outline"
            (click)="onDelete(row.registeredTableName)"
            *appHasPermission="'DELETE_DATATABLE'"
            [appTooltip]="'COMMON.DELETE' | appTranslate"
          />
        </div>
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .action-buttons {
        display: flex;
        gap: 8px;
      }
    `,
  ],
})
export class DatatablesListComponent implements OnInit {
  private readonly datatablesService = inject(DataTablesService);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly datatables = signal<GetDataTablesResponse[]>([]);
  readonly isLoading = signal<boolean>(false);

  columns: ColumnDef[] = [
    {
      key: 'registeredTableName',
      label: 'SYSTEM.TABLE_NAME',
      sortable: true,
    },
    {
      key: 'applicationTableName',
      label: 'SYSTEM.APP_TABLE',
      sortable: true,
    },
    {
      key: 'actions',
      label: 'COMMON.ACTIONS',
    },
  ];

  ngOnInit(): void {
    this.loadDatatables();
  }

  loadDatatables(): void {
    this.isLoading.set(true);
    this.datatablesService.getDatatables().subscribe({
      next: (data) => {
        this.datatables.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load datatables', err);
        this.isLoading.set(false);
      },
    });
  }

  async onDelete(name: string): Promise<void> {
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('SYSTEM.DELETE_DATA_TABLE'),
      message: this.i18n.translate('SYSTEM.CONFIRM_DELETE_DATA_TABLE', { name }),
      destructive: true,
    });
    if (!confirmed) return;
    this.datatablesService.deleteDatatablesDatatableName(name).subscribe({
      next: () => this.loadDatatables(),
      error: (err) => console.error('Failed to delete datatable', err),
    });
  }
}
