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
import { Router } from '@angular/router';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { EntityDataTableService, GetEntityDatatableChecksResponse } from '../../../api';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { DialogService } from '../../../core/services/dialog.service';
import { ButtonComponent } from '../../../ui/button/button.component';

/**
 * Lists entity data-table checks. These records have no update endpoint, so the table
 * supports create and delete only.
 */
@Component({
  selector: 'app-entity-data-table-checks-list',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    ButtonComponent,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      title="nav.entityDataTableChecks"
      helpTextKey="HELP.ENTITY_DATA_TABLE_CHECKS_DESC"
      createButtonLabel="ENTITY_DATA_TABLE_CHECKS.CREATE"
      createPermission="CREATE_ENTITY_DATATABLE_CHECK"
      [columns]="columns"
      [data]="checks()"
      [totalRecords]="checks().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="status" let-row>
        {{ row.status?.value }}
      </ng-template>
      <ng-template appCellTemplate="actions" let-row>
        <app-button
          type="button"
          intent="danger"
          emphasis="quiet"
          [label]="'COMMON.DELETE' | appTranslate"
          icon="trash-outline"
          [appTooltip]="'COMMON.DELETE' | appTranslate"
          (click)="onDelete(row)"
        />
      </ng-template>
    </app-data-table>
  `,
})
export class EntityDataTableChecksListComponent implements OnInit {
  private readonly checksService = inject(EntityDataTableService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'entity', label: 'ENTITY_DATA_TABLE_CHECKS.ENTITY', sortable: true },
    { key: 'datatableName', label: 'ENTITY_DATA_TABLE_CHECKS.DATATABLE_NAME', sortable: true },
    { key: 'status', label: 'ENTITY_DATA_TABLE_CHECKS.STATUS', sortable: false },
    { key: 'productName', label: 'ENTITY_DATA_TABLE_CHECKS.PRODUCT', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly checks = signal<GetEntityDatatableChecksResponse[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.checksService.getEntityDatatableChecks().subscribe({
      next: (data) => {
        this.checks.set(data.pageItems || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load entity data-table checks', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/system/entity-data-table-checks/create']);
  }

  async onDelete(row: GetEntityDatatableChecksResponse): Promise<void> {
    if (!row.id) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('ENTITY_DATA_TABLE_CHECKS.DELETE'),
      message: this.i18n.translate('ENTITY_DATA_TABLE_CHECKS.CONFIRM_DELETE', {
        datatable: row.datatableName ?? '',
        entity: row.entity ?? '',
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.checksService.deleteEntityDatatableChecksEntityDatatableCheckId(row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete data-table check', err),
    });
  }
}
