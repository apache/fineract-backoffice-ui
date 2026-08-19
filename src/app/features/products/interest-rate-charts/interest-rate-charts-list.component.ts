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
import { InterestRateChartService, GetInterestRateChartsResponse } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

/**
 * Lists interest rate charts. Charts are master-data records that group interest-rate
 * slabs (interest bands), so the table uses local pagination. Supports create, edit,
 * delete, plus drill-down to a chart's slabs.
 */
@Component({
  selector: 'app-interest-rate-charts-list',
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
      title="nav.interestRateCharts"
      helpTextKey="HELP.INTEREST_RATE_CHARTS_DESC"
      createButtonLabel="INTEREST_RATE_CHARTS.CREATE"
      createPermission="CREATE_INTERESTRATECHART"
      [columns]="columns"
      [data]="charts()"
      [totalRecords]="charts().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="actions" let-row>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'INTEREST_RATE_CHARTS.SLABS' | translate"
          [appTooltip]="'INTEREST_RATE_CHARTS.SLABS' | translate"
          (click)="onSlabs(row)"
        >
          <ion-icon name="list-outline"></ion-icon>
        </ion-button>
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
export class InterestRateChartsListComponent implements OnInit {
  private readonly chartService = inject(InterestRateChartService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'id', label: 'INTEREST_RATE_CHARTS.ID', sortable: true },
    { key: 'fromDate', label: 'INTEREST_RATE_CHARTS.FROM_DATE', sortable: true },
    { key: 'savingsProductName', label: 'INTEREST_RATE_CHARTS.PRODUCT', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly charts = signal<GetInterestRateChartsResponse[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.chartService.getInterestratecharts().subscribe({
      next: (data: GetInterestRateChartsResponse[]) => {
        this.charts.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load interest rate charts', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/products/interest-rate-charts/create']);
  }

  onEdit(row: GetInterestRateChartsResponse): void {
    this.router.navigate(['/products/interest-rate-charts/edit', row.id]);
  }

  onSlabs(row: GetInterestRateChartsResponse): void {
    this.router.navigate(['/products/interest-rate-charts', row.id, 'slabs']);
  }

  onDelete(row: GetInterestRateChartsResponse): void {
    if (!row.id || !window.confirm('Delete this interest rate chart?')) return;
    this.chartService.deleteInterestratechartsChartId(row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete interest rate chart', err),
    });
  }
}
