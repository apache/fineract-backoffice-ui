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
import { ActivatedRoute } from '@angular/router';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ClientTransactionService, GetClientsPageItems } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { formatArrayDate } from '../../../core/utils/date-formatter';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';

/**
 * Lists the transactions for a single client. The client id is read from the route
 * snapshot. Transactions are read-only here except for an undo action that reverses a
 * transaction via the post-by-id endpoint with the `undo` command.
 */
@Component({
  selector: 'app-client-transactions-list',
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
      title="CLIENT_TRANSACTIONS.TITLE"
      helpTextKey="HELP.CLIENT_TRANSACTIONS_DESC"
      [columns]="columns"
      [data]="transactions()"
      [totalRecords]="transactions().length"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="date" let-row>
        {{ formatDate(row.date) }}
      </ng-template>
      <ng-template appCellTemplate="type" let-row>
        {{ row.type?.value }}
      </ng-template>
      <ng-template appCellTemplate="actions" let-row>
        <app-button
          type="button"
          intent="danger"
          emphasis="quiet"
          [label]="'CLIENT_TRANSACTIONS.UNDO' | appTranslate"
          icon="arrow-undo-outline"
          [appTooltip]="'CLIENT_TRANSACTIONS.UNDO' | appTranslate"
          [disabled]="row.reversed"
          (click)="onUndo(row)"
        />
      </ng-template>
    </app-data-table>
  `,
})
export class ClientTransactionsListComponent implements OnInit {
  private readonly transactionService = inject(ClientTransactionService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'id', label: 'CLIENT_TRANSACTIONS.ID', sortable: true },
    { key: 'date', label: 'CLIENT_TRANSACTIONS.DATE', sortable: false },
    { key: 'amount', label: 'CLIENT_TRANSACTIONS.AMOUNT', sortable: true },
    { key: 'type', label: 'CLIENT_TRANSACTIONS.TYPE', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  clientId!: number;
  readonly transactions = signal<GetClientsPageItems[]>([]);

  ngOnInit(): void {
    this.clientId = Number(this.route.snapshot.paramMap.get('clientId'));
    this.load();
  }

  load(): void {
    this.transactionService.getClientsClientIdTransactions(this.clientId).subscribe({
      next: (data) => {
        this.transactions.set(data?.pageItems ? Array.from(data.pageItems) : []);
      },
      error: (err: unknown) => {
        console.error('Failed to load client transactions', err);
      },
    });
  }

  formatDate(value: unknown): string {
    return formatArrayDate(value);
  }

  async onUndo(row: GetClientsPageItems): Promise<void> {
    if (!row.id) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('CLIENT_TRANSACTIONS.UNDO'),
      message: this.i18n.translate('CLIENT_TRANSACTIONS.CONFIRM_UNDO', {
        id: row.id,
        amount: row.amount ?? '',
        date: this.formatDate(row.date),
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.transactionService
      .postClientsClientIdTransactionsTransactionId(this.clientId, row.id, 'undo')
      .subscribe({
        next: () => this.load(),
        error: (err: unknown) => console.error('Failed to undo client transaction', err),
      });
  }
}
