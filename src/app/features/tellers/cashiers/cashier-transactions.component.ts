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

import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonGrid,
  IonIcon,
  IonNote,
  IonRow,
} from '@ionic/angular/standalone';
import { CellTemplateDirective, ColumnDef } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { TranslatePipe } from '../../../core/adapters';
import { switchMap } from 'rxjs/operators';
import { CashierTransactionData, CurrencyData, TellerCashManagementService } from '../../../api';
import { formatArrayDate } from '../../../core/utils/date-formatter';

/**
 * The running cash position for one cashier, and the entries that produced it.
 *
 * Fineract returns the totals and the transaction page from a single endpoint, so they are
 * always consistent with each other — which is the reason this is one screen rather than a
 * summary card that fetches separately from the table below it.
 */
@Component({
  selector: 'app-cashier-transactions',
  standalone: true,
  imports: [
    TranslatePipe,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
    IonNote,
    IonButton,
    IonIcon,
    DataTableComponent,
    CellTemplateDirective,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title data-testid="cashier-summary-title">
            {{ 'TELLERS.CASHIER_SUMMARY' | appTranslate }}
          </ion-card-title>
          @if (cashierName()) {
            <ion-note data-testid="cashier-summary-name">
              {{ cashierName() }} &middot; {{ tellerName() }}
            </ion-note>
          }
        </ion-card-header>

        <ion-card-content>
          <ion-grid class="ion-no-padding">
            <ion-row>
              <ion-col size="6" size-md="3">
                <ion-note>{{ 'TELLERS.TOTAL_ALLOCATED' | appTranslate }}</ion-note>
                <div class="summary-value" data-testid="cashier-sum-allocated">
                  {{ sumAllocated() }}
                </div>
              </ion-col>
              <ion-col size="6" size-md="3">
                <ion-note>{{ 'TELLERS.TOTAL_SETTLED' | appTranslate }}</ion-note>
                <div class="summary-value" data-testid="cashier-sum-settled">
                  {{ sumSettled() }}
                </div>
              </ion-col>
              <ion-col size="6" size-md="3">
                <ion-note>{{ 'TELLERS.NET_CASH' | appTranslate }}</ion-note>
                <div class="summary-value" data-testid="cashier-net-cash">{{ netCash() }}</div>
              </ion-col>
              <ion-col size="6" size-md="3" class="summary-actions">
                <ion-button
                  size="small"
                  (click)="onAllocate()"
                  data-testid="cashier-allocate-btn"
                  [attr.aria-label]="'TELLERS.ALLOCATE_CASH' | appTranslate"
                >
                  <ion-icon name="add-outline" slot="start"></ion-icon>
                  {{ 'TELLERS.ALLOCATE' | appTranslate }}
                </ion-button>
                <ion-button
                  size="small"
                  fill="outline"
                  (click)="onSettle()"
                  data-testid="cashier-settle-btn"
                  [attr.aria-label]="'TELLERS.SETTLE_CASH' | appTranslate"
                >
                  <ion-icon name="remove-outline" slot="start"></ion-icon>
                  {{ 'TELLERS.SETTLE' | appTranslate }}
                </ion-button>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ion-card-content>
      </ion-card>

      <app-data-table
        title="TELLERS.CASHIER_TRANSACTIONS"
        [columns]="columns"
        [data]="transactions()"
        [totalRecords]="transactions().length"
        [localLogic]="true"
      >
        <ng-template appCellTemplate="txnType" let-txn>
          {{ txn.txnType?.value || '-' }}
        </ng-template>
        <ng-template appCellTemplate="txnDate" let-txn>
          {{ formatDate(txn.txnDate) }}
        </ng-template>
      </app-data-table>
    </div>
  `,
  styles: [
    `
      .summary-value {
        font-size: 1.25rem;
        font-weight: 600;
      }
      .summary-actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
    `,
  ],
})
export class CashierTransactionsComponent {
  private readonly tellerService = inject(TellerCashManagementService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly tellerId = signal(0);
  private readonly cashierId = signal(0);

  readonly cashierName = signal('');
  readonly tellerName = signal('');
  readonly currencies = signal<CurrencyData[]>([]);
  readonly currencyCode = signal('');
  readonly sumAllocated = signal(0);
  readonly sumSettled = signal(0);
  readonly netCash = signal(0);
  readonly transactions = signal<CashierTransactionData[]>([]);

  readonly columns: ColumnDef[] = [
    { key: 'txnType', label: 'COMMON.TYPE', sortable: false },
    { key: 'txnAmount', label: 'COMMON.AMOUNT', sortable: true },
    { key: 'txnDate', label: 'COMMON.DATE', sortable: true },
    { key: 'txnNote', label: 'COMMON.NOTE', sortable: false },
  ];

  constructor() {
    this.route.params.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.tellerId.set(+params['tellerId']);
      this.cashierId.set(+params['cashierId']);
      this.load();
    });
  }

  /**
   * Reads the cashier's currencies, then the summary for one of them.
   *
   * The two calls are sequential because `currencyCode` is not optional in practice: the
   * endpoint accepts the request without it and answers `200` with every total set to zero and
   * an empty transaction list. A cashier holding cash is indistinguishable from one that never
   * transacted, so omitting it renders a confidently wrong screen rather than an error.
   */
  private load(): void {
    this.tellerService
      .getTellersTellerIdCashiersCashierIdTransactionsTemplate(this.tellerId(), this.cashierId())
      .pipe(
        switchMap((template) => {
          const currencies = template.currencyOptions ?? [];
          this.currencies.set(currencies);
          const code = this.currencyCode() || currencies[0]?.code || '';
          this.currencyCode.set(code);
          return this.tellerService.getTellersTellerIdCashiersCashierIdSummaryandtransactions(
            this.tellerId(),
            this.cashierId(),
            code,
          );
        }),
      )
      .subscribe({
        next: (summary) => {
          this.cashierName.set(summary.cashierName ?? '');
          this.tellerName.set(summary.tellerName ?? '');
          this.sumAllocated.set(summary.sumCashAllocation ?? 0);
          this.sumSettled.set(summary.sumCashSettlement ?? 0);
          this.netCash.set(summary.netCash ?? 0);
          this.transactions.set(summary.cashierTransactions?.pageItems ?? []);
        },
        error: () => this.transactions.set([]),
      });
  }

  /**
   * Renders a transaction date.
   *
   * This endpoint returns `txnDate` as an ISO `'2026-08-05'` string, unlike the cashier and
   * teller resources, which return `[year, month, day]` arrays for their own dates. Both shapes
   * are handled because the difference is per-endpoint rather than per-version, and rendering
   * `[2026,8,5]` into a table cell is the failure mode either assumption produces alone.
   */
  formatDate(value: unknown): string {
    if (typeof value === 'string') return value.split('T', 1)[0];
    return formatArrayDate(value);
  }

  onAllocate(): void {
    void this.router.navigate([
      '/tellers',
      this.tellerId(),
      'cashiers',
      this.cashierId(),
      'transactions',
      'allocate',
    ]);
  }

  onSettle(): void {
    void this.router.navigate([
      '/tellers',
      this.tellerId(),
      'cashiers',
      this.cashierId(),
      'transactions',
      'settle',
    ]);
  }
}
