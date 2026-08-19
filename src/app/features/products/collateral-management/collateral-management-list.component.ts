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
import { CollateralManagementService, CollateralManagementData } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

/**
 * Lists collateral product master-data records (name, quality, unit type, base price).
 * Collateral products are a small reference list, so the table uses local pagination.
 */
@Component({
  selector: 'app-collateral-management-list',
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
      title="nav.collateralManagement"
      helpTextKey="HELP.COLLATERAL_MANAGEMENT_DESC"
      createButtonLabel="COLLATERAL_MANAGEMENT.CREATE"
      createPermission="CREATE_COLLATERAL_PRODUCT"
      [columns]="columns"
      [data]="collaterals()"
      [totalRecords]="collaterals().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
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
export class CollateralManagementListComponent implements OnInit {
  private readonly collateralService = inject(CollateralManagementService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'COLLATERAL_MANAGEMENT.NAME', sortable: true },
    { key: 'quality', label: 'COLLATERAL_MANAGEMENT.QUALITY', sortable: true },
    { key: 'unitType', label: 'COLLATERAL_MANAGEMENT.UNIT_TYPE', sortable: true },
    { key: 'basePrice', label: 'COLLATERAL_MANAGEMENT.BASE_PRICE', sortable: true },
    { key: 'pctToBase', label: 'COLLATERAL_MANAGEMENT.PCT_TO_BASE', sortable: true },
    { key: 'currency', label: 'COLLATERAL_MANAGEMENT.CURRENCY', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly collaterals = signal<CollateralManagementData[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.collateralService.getCollateralManagement().subscribe({
      next: (data: CollateralManagementData[]) => {
        this.collaterals.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load collateral products', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/products/collateral-management/create']);
  }

  onEdit(row: CollateralManagementData): void {
    this.router.navigate(['/products/collateral-management/edit', row.id]);
  }

  onDelete(row: CollateralManagementData): void {
    if (!row.id || !window.confirm('Delete this collateral product?')) return;
    this.collateralService.deleteCollateralManagementCollateralId(row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete collateral product', err),
    });
  }
}
