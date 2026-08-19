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
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { formatArrayDate } from '../../../core/utils/date-formatter';
import { SelfDividendService } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

/**
 * A single share dividend row as returned (within a paged envelope) by the share dividend
 * list endpoint. The endpoint is untyped (returns a JSON string), so a minimal local shape
 * captures the fields shown in the table.
 */
interface ShareDividendRow {
  id?: number;
  amount?: number;
  dividendPeriodStartDate?: unknown;
  dividendPeriodEndDate?: unknown;
}

/**
 * Lists the dividends declared for a single share product. The share product id is read
 * from the route snapshot; create and delete actions operate within that product's dividend
 * collection.
 */
@Component({
  selector: 'app-share-dividends-list',
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
      title="SHARE_DIVIDENDS.TITLE"
      helpTextKey="HELP.SHARE_DIVIDENDS_DESC"
      createButtonLabel="SHARE_DIVIDENDS.CREATE"
      createPermission="CREATE_DIVIDEND_SHAREPRODUCT"
      [columns]="columns"
      [data]="dividends()"
      [totalRecords]="dividends().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="dividendPeriodStartDate" let-row>
        {{ formatDate(row.dividendPeriodStartDate) }}
      </ng-template>
      <ng-template appCellTemplate="dividendPeriodEndDate" let-row>
        {{ formatDate(row.dividendPeriodEndDate) }}
      </ng-template>
      <ng-template appCellTemplate="actions" let-row>
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
export class ShareDividendsListComponent implements OnInit {
  private readonly selfDividendService = inject(SelfDividendService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'dividendPeriodStartDate', label: 'SHARE_DIVIDENDS.PERIOD_START_DATE', sortable: false },
    { key: 'dividendPeriodEndDate', label: 'SHARE_DIVIDENDS.PERIOD_END_DATE', sortable: false },
    { key: 'amount', label: 'SHARE_DIVIDENDS.AMOUNT', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  productId!: number;
  readonly dividends = signal<ShareDividendRow[]>([]);

  formatDate = formatArrayDate;

  ngOnInit(): void {
    this.productId = Number(this.route.snapshot.paramMap.get('productId'));
    this.load();
  }

  load(): void {
    this.selfDividendService.getShareproductProductIdDividend(this.productId).subscribe({
      next: (data: string) => {
        this.dividends.set(this.parseDividends(data));
      },
      error: (err: unknown) => console.error('Failed to load share dividends', err),
    });
  }

  private parseDividends(data: string): ShareDividendRow[] {
    if (!data) return [];
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      const rows = Array.isArray(parsed) ? parsed : (parsed?.pageItems ?? []);
      return rows as ShareDividendRow[];
    } catch {
      return [];
    }
  }

  onCreate(): void {
    this.router.navigate(['/products/shares', this.productId, 'dividends', 'create']);
  }

  onDelete(row: ShareDividendRow): void {
    if (!row.id || !window.confirm('Delete this dividend?')) return;
    this.selfDividendService
      .deleteShareproductProductIdDividendDividendId(this.productId, row.id)
      .subscribe({
        next: () => this.load(),
        error: (err: unknown) => console.error('Failed to delete share dividend', err),
      });
  }
}
