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
import { TranslatePipe } from '../../../core/adapters';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { RateService, RateData } from '../../../api';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';

/**
 * Lists interest rates (name + percentage master data). Rates are small master-data
 * records, so the table uses local pagination. Supports create and edit (no delete).
 */
@Component({
  selector: 'app-rates-list',
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
      title="nav.rates"
      helpTextKey="HELP.RATES_DESC"
      createButtonLabel="RATES.CREATE"
      createPermission="CREATE_RATE"
      [columns]="columns"
      [data]="rates()"
      [totalRecords]="rates().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="active" let-row>
        {{ (row.active ? 'COMMON.YES' : 'COMMON.NO') | appTranslate }}
      </ng-template>
      <ng-template appCellTemplate="actions" let-row>
        <app-button
          type="button"
          intent="primary"
          emphasis="quiet"
          [label]="'COMMON.EDIT' | appTranslate"
          icon="create-outline"
          [appTooltip]="'COMMON.EDIT' | appTranslate"
          (click)="onEdit(row)"
        />
      </ng-template>
    </app-data-table>
  `,
})
export class RatesListComponent implements OnInit {
  private readonly rateService = inject(RateService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'RATES.NAME', sortable: true },
    { key: 'percentage', label: 'RATES.PERCENTAGE', sortable: true },
    { key: 'active', label: 'COMMON.ACTIVE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly rates = signal<RateData[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.rateService.getRates().subscribe({
      next: (data: RateData[]) => {
        this.rates.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load rates', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/products/rates/create']);
  }

  onEdit(row: RateData): void {
    this.router.navigate(['/products/rates/edit', row.id]);
  }
}
