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
import { TranslateModule } from '@ngx-translate/core';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { AdhocQueryApiService, AdHocData } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

/**
 * Lists ad-hoc SQL queries that can be scheduled to write into report tables.
 */
@Component({
  selector: 'app-adhoc-query-list',
  standalone: true,
  imports: [
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    IonIcon,
    IonButton,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      title="nav.adhocQuery"
      helpTextKey="HELP.ADHOC_QUERY_DESC"
      createButtonLabel="ADHOC_QUERY.CREATE"
      createPermission="CREATE_ADHOC"
      [columns]="columns"
      [data]="queries()"
      [totalRecords]="queries().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="isActive" let-row>
        {{ (row.isActive ? 'COMMON.YES' : 'COMMON.NO') | translate }}
      </ng-template>
      <ng-template appCellTemplate="actions" let-row>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          [appTooltip]="'COMMON.EDIT' | translate"
          (click)="onEdit(row)"
        >
          <ion-icon name="create-outline"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="danger"
          [attr.aria-label]="'COMMON.DELETE' | translate"
          [appTooltip]="'COMMON.DELETE' | translate"
          (click)="onDelete(row)"
        >
          <ion-icon name="trash-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class AdhocQueryListComponent implements OnInit {
  private readonly adhocService = inject(AdhocQueryApiService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'ADHOC_QUERY.NAME', sortable: true },
    { key: 'tableName', label: 'ADHOC_QUERY.TABLE_NAME', sortable: true },
    { key: 'isActive', label: 'ADHOC_QUERY.IS_ACTIVE', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly queries = signal<AdHocData[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.adhocService.getAdhocquery().subscribe({
      next: (data: AdHocData[]) => {
        this.queries.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load ad-hoc queries', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/system/adhoc-query/create']);
  }

  onEdit(row: AdHocData): void {
    this.router.navigate(['/system/adhoc-query/edit', row.id]);
  }

  onDelete(row: AdHocData): void {
    if (!row.id || !window.confirm('Delete this ad-hoc query?')) return;
    this.adhocService.deleteAdhocqueryAdHocId(row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete ad-hoc query', err),
    });
  }
}
