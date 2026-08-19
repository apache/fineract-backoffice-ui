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
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { TaxComponentsService, TaxComponentData } from '../../../api';
import { formatArrayDate } from '../../../core/utils/date-formatter';

/**
 * Lists tax components (name + percentage + start date).
 */
@Component({
  selector: 'app-tax-components-list',
  standalone: true,
  imports: [TranslateModule, IonButton, IonIcon, DataTableComponent, CellTemplateDirective],
  template: `
    <app-data-table
      title="nav.taxComponents"
      helpTextKey="HELP.TAX_COMPONENTS_DESC"
      createButtonLabel="TAX_COMPONENTS.CREATE"
      createPermission="CREATE_TAXCOMPONENT"
      [columns]="columns"
      [data]="components()"
      [totalRecords]="components().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="percentage" let-row> {{ row.percentage }}% </ng-template>
      <ng-template appCellTemplate="startDate" let-row>
        {{ formatDate(row.startDate) }}
      </ng-template>
      <ng-template appCellTemplate="actions" let-row>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          (click)="onEdit(row)"
        >
          <ion-icon name="create-outline" slot="icon-only"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class TaxComponentsListComponent implements OnInit {
  private readonly taxComponentsService = inject(TaxComponentsService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'TAX_COMPONENTS.NAME', sortable: true },
    { key: 'percentage', label: 'TAX_COMPONENTS.PERCENTAGE', sortable: true },
    { key: 'startDate', label: 'TAX_COMPONENTS.START_DATE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly components = signal<TaxComponentData[]>([]);

  ngOnInit(): void {
    this.taxComponentsService.getTaxesComponent().subscribe({
      next: (data: TaxComponentData[]) => {
        this.components.set(data || []);
      },
      error: (err: unknown) => console.error('Failed to load tax components', err),
    });
  }

  formatDate(value: unknown): string {
    return formatArrayDate(value);
  }

  onCreate(): void {
    this.router.navigate(['/products/tax-components/create']);
  }

  onEdit(row: TaxComponentData): void {
    this.router.navigate(['/products/tax-components/edit', row.id]);
  }
}
