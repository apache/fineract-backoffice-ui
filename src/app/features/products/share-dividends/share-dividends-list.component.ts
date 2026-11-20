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

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  I18N,
  SHARE_DIVIDEND_API,
  TranslatePipe,
  type ShareDividend,
} from '../../../core/adapters';
import { ColumnDef, CellTemplateDirective, RequiresPermissionDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigService } from '../../../core/services/config.service';
import { DialogService } from '../../../core/services/dialog.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';

const STATUS_KEYS: Record<ShareDividend['status'], string> = {
  pending: 'SHARE_DIVIDENDS.STATUS_PENDING',
  approved: 'SHARE_DIVIDENDS.STATUS_APPROVED',
  unknown: 'SHARE_DIVIDENDS.STATUS_UNKNOWN',
};

/**
 * Lists the dividends declared for a single share product. The share product id is read
 * from the route snapshot; each row opens the dividend, and a pending one can be deleted here.
 */
@Component({
  selector: 'app-share-dividends-list',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    ButtonComponent,
    TooltipDirective,
    RequiresPermissionDirective,
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
      <ng-template appCellTemplate="periodStartDate" let-row>
        {{ row.periodStartDate ?? '-' }}
      </ng-template>
      <ng-template appCellTemplate="periodEndDate" let-row>
        {{ row.periodEndDate ?? '-' }}
      </ng-template>
      <ng-template appCellTemplate="status" let-row>
        {{ statusKey(row.status) | appTranslate }}
      </ng-template>
      <ng-template appCellTemplate="actions" let-row>
        <app-button
          type="button"
          emphasis="quiet"
          data-testid="share-dividend-view"
          [label]="'COMMON.VIEW' | appTranslate"
          icon="eye-outline"
          [appTooltip]="'COMMON.VIEW' | appTranslate"
          [link]="['/products/shares', productId, 'dividends', row.id]"
        />
        @if (row.status === 'pending') {
          <app-button
            type="button"
            intent="danger"
            emphasis="quiet"
            data-testid="share-dividend-delete"
            [label]="'COMMON.DELETE' | appTranslate"
            icon="trash-outline"
            [appTooltip]="'COMMON.DELETE' | appTranslate"
            appRequiresPermission="DELETE_DIVIDEND_SHAREPRODUCT"
            [disabled]="!canDelete()"
            (click)="onDelete(row)"
          />
        }
      </ng-template>
    </app-data-table>
  `,
})
export class ShareDividendsListComponent implements OnInit {
  private readonly api = inject(SHARE_DIVIDEND_API);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);
  private readonly auth = inject(AuthService);
  private readonly config = inject(ConfigService);

  readonly columns: ColumnDef[] = [
    { key: 'periodStartDate', label: 'SHARE_DIVIDENDS.PERIOD_START_DATE', sortable: false },
    { key: 'periodEndDate', label: 'SHARE_DIVIDENDS.PERIOD_END_DATE', sortable: false },
    { key: 'amount', label: 'SHARE_DIVIDENDS.AMOUNT', sortable: true },
    { key: 'status', label: 'COMMON.STATUS', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  productId!: number;
  readonly dividends = signal<ShareDividend[]>([]);

  /** The directive marks only the host; this keeps the button itself disabled. */
  readonly canDelete = computed(() => {
    this.auth.currentUser();
    return !this.config.rbacEnabled() || this.auth.hasPermission('DELETE_DIVIDEND_SHAREPRODUCT');
  });

  readonly statusKey = (status: ShareDividend['status']): string => STATUS_KEYS[status];

  ngOnInit(): void {
    this.productId = Number(this.route.snapshot.paramMap.get('productId'));
    this.load();
  }

  load(): void {
    this.api.list(this.productId).subscribe({
      next: (rows) => this.dividends.set([...rows]),
      error: (err: unknown) => console.error('Failed to load share dividends', err),
    });
  }

  onCreate(): void {
    this.router.navigate(['/products/shares', this.productId, 'dividends', 'create']);
  }

  async onDelete(row: ShareDividend): Promise<void> {
    // Fineract refuses to delete an approved dividend; the button is not offered for one.
    if (!row.id || row.status !== 'pending' || !this.canDelete()) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('SHARE_DIVIDENDS.DELETE'),
      message: this.i18n.translate('SHARE_DIVIDENDS.CONFIRM_DELETE', {
        amount: row.amount ?? '',
        startDate: row.periodStartDate ?? '-',
        endDate: row.periodEndDate ?? '-',
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.api.delete(this.productId, row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete share dividend', err),
    });
  }
}
