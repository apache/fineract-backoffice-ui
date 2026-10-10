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
import {
  FixedDepositProductService,
  GetInterestRateChartsResponse,
  InterestRateChartService,
  RecurringDepositProductService,
} from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

/**
 * Lists interest rate charts across the deposit products that own them.
 *
 * Charts are master-data records grouping interest-rate slabs (interest bands), so the table
 * uses local pagination. Supports create, edit, delete, plus drill-down to a chart's slabs.
 *
 * The charts are gathered per product rather than in one call. `productId` is documented as
 * optional, but the platform answers a bare `GET /interestratecharts` with a 500 — this screen
 * used to make exactly that call, so it failed on every visit, showing "No records found." under
 * a toast carrying the raw request URL. A chart cannot exist without a product, so asking each
 * product for its own is both the working form of the question and the accurate one.
 */
@Component({
  selector: 'app-interest-rate-charts-list',
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
      title="nav.interestRateCharts"
      helpTextKey="HELP.INTEREST_RATE_CHARTS_DESC"
      createButtonLabel="INTEREST_RATE_CHARTS.CREATE"
      createPermission="CREATE_INTERESTRATECHART"
      [columns]="columns"
      [data]="charts()"
      [totalRecords]="charts().length"
      [localLogic]="true"
      [isLoading]="isLoading()"
      [hasError]="loadFailed()"
      (create)="onCreate()"
      (retry)="load()"
    >
      <ng-template appCellTemplate="actions" let-row>
        <app-button
          type="button"
          intent="primary"
          emphasis="quiet"
          [label]="'INTEREST_RATE_CHARTS.SLABS' | appTranslate"
          icon="list-outline"
          [appTooltip]="'INTEREST_RATE_CHARTS.SLABS' | appTranslate"
          (click)="onSlabs(row)"
        />
        <app-button
          type="button"
          intent="primary"
          emphasis="quiet"
          [label]="'COMMON.EDIT' | appTranslate"
          icon="create-outline"
          [appTooltip]="'COMMON.EDIT' | appTranslate"
          (click)="onEdit(row)"
        />
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
export class InterestRateChartsListComponent implements OnInit {
  private readonly chartService = inject(InterestRateChartService);
  private readonly fixedDepositProducts = inject(FixedDepositProductService);
  private readonly recurringDepositProducts = inject(RecurringDepositProductService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'id', label: 'INTEREST_RATE_CHARTS.ID', sortable: true },
    { key: 'fromDate', label: 'INTEREST_RATE_CHARTS.FROM_DATE', sortable: true },
    { key: 'savingsProductName', label: 'INTEREST_RATE_CHARTS.PRODUCT', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly charts = signal<GetInterestRateChartsResponse[]>([]);
  readonly isLoading = signal(false);
  readonly loadFailed = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadFailed.set(false);
    this.depositProductIds()
      .pipe(
        switchMap((productIds) =>
          productIds.length === 0
            ? of([] as GetInterestRateChartsResponse[])
            : forkJoin(
                productIds.map((productId) =>
                  // One product's charts failing must not blank the rest of the table.
                  this.chartService
                    .getInterestratecharts(productId)
                    .pipe(catchError(() => of([] as GetInterestRateChartsResponse[]))),
                ),
              ).pipe(map((perProduct) => perProduct.flat())),
        ),
      )
      .subscribe({
        next: (data) => {
          this.charts.set(data);
          this.isLoading.set(false);
        },
        error: () => {
          this.charts.set([]);
          this.isLoading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  /** The products that can own a chart: fixed and recurring deposits. */
  private depositProductIds() {
    return forkJoin({
      fixed: this.fixedDepositProducts.getFixeddepositproducts(),
      recurring: this.recurringDepositProducts.getRecurringdepositproducts(),
    }).pipe(
      map(({ fixed, recurring }) =>
        [...(fixed ?? []), ...(recurring ?? [])]
          .map((product) => product?.id)
          .filter((id): id is number => typeof id === 'number'),
      ),
    );
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

  async onDelete(row: GetInterestRateChartsResponse): Promise<void> {
    if (!row.id) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('INTEREST_RATE_CHARTS.DELETE'),
      message: this.i18n.translate('INTEREST_RATE_CHARTS.CONFIRM_DELETE', {
        id: row.id,
        product: row.savingsProductName ?? '',
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.chartService.deleteInterestratechartsChartId(row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete interest rate chart', err),
    });
  }
}
