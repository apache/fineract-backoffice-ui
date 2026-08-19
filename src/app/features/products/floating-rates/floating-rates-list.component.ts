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
import { FloatingRatesService, FloatingRateData } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

/**
 * Lists floating interest rates (name, base-lending-rate flag, active flag).
 */
@Component({
  selector: 'app-floating-rates-list',
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
      title="nav.floatingRates"
      helpTextKey="HELP.FLOATING_RATES_DESC"
      createButtonLabel="FLOATING_RATES.CREATE"
      createPermission="CREATE_FLOATINGRATE"
      [columns]="columns"
      [data]="rates()"
      [totalRecords]="rates().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="isBaseLendingRate" let-row>
        {{ (row.isBaseLendingRate ? 'COMMON.YES' : 'COMMON.NO') | translate }}
      </ng-template>
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
      </ng-template>
    </app-data-table>
  `,
})
export class FloatingRatesListComponent implements OnInit {
  private readonly floatingRatesService = inject(FloatingRatesService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'FLOATING_RATES.NAME', sortable: true },
    { key: 'isBaseLendingRate', label: 'FLOATING_RATES.IS_BASE_LENDING_RATE', sortable: true },
    { key: 'isActive', label: 'COMMON.ACTIVE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly rates = signal<FloatingRateData[]>([]);

  ngOnInit(): void {
    this.floatingRatesService.getFloatingrates().subscribe({
      next: (data: FloatingRateData[]) => {
        this.rates.set(data || []);
      },
      error: (err: unknown) => console.error('Failed to load floating rates', err),
    });
  }

  onCreate(): void {
    this.router.navigate(['/products/floating-rates/create']);
  }

  onEdit(row: FloatingRateData): void {
    this.router.navigate(['/products/floating-rates/edit', row.id]);
  }
}
