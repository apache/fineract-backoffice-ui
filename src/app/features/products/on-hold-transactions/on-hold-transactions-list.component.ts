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
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  DepositAccountOnHoldFundTransactionsService,
  DepositAccountOnHoldTransactionData,
  GetSavingsAccountsSavingsAccountIdOnHoldTransactionsResponse,
} from '../../../api';

/**
 * Read-only list of on-hold fund transactions for a single savings account. The savings id is
 * read from the route snapshot. On-hold funds are created as a side effect of loan guarantees,
 * so this screen is view-only with no actions.
 */
@Component({
  selector: 'app-on-hold-transactions-list',
  standalone: true,
  imports: [DataTableComponent, CellTemplateDirective],
  template: `
    <app-data-table
      title="ON_HOLD_TRANSACTIONS.TITLE"
      helpTextKey="HELP.ON_HOLD_TRANSACTIONS_DESC"
      [columns]="columns"
      [data]="transactions()"
      [totalRecords]="transactions().length"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="transactionDate" let-row>
        {{ row.transactionDate }}
      </ng-template>
      <ng-template appCellTemplate="amount" let-row>
        {{ row.amount }}
      </ng-template>
      <ng-template appCellTemplate="transactionType" let-row>
        {{ row.transactionType?.value }}
      </ng-template>
      <ng-template appCellTemplate="reason" let-row>
        {{ row.loanClientName }}
      </ng-template>
    </app-data-table>
  `,
})
export class OnHoldTransactionsListComponent implements OnInit {
  private readonly transactionsService = inject(DepositAccountOnHoldFundTransactionsService);
  private readonly route = inject(ActivatedRoute);

  readonly columns: ColumnDef[] = [
    { key: 'transactionDate', label: 'ON_HOLD_TRANSACTIONS.DATE', sortable: true },
    { key: 'amount', label: 'ON_HOLD_TRANSACTIONS.AMOUNT', sortable: true },
    { key: 'transactionType', label: 'ON_HOLD_TRANSACTIONS.TYPE', sortable: false },
    { key: 'reason', label: 'ON_HOLD_TRANSACTIONS.REASON', sortable: false },
  ];

  savingsId!: number;
  readonly transactions = signal<DepositAccountOnHoldTransactionData[]>([]);

  ngOnInit(): void {
    this.savingsId = Number(this.route.snapshot.paramMap.get('savingsId'));
    this.load();
  }

  load(): void {
    this.transactionsService
      .getSavingsaccountsSavingsIdOnholdtransactions(this.savingsId)
      .subscribe({
        next: (data: GetSavingsAccountsSavingsAccountIdOnHoldTransactionsResponse) => {
          this.transactions.set(data?.pageItems ?? []);
        },
        error: (err: unknown) => {
          console.error('Failed to load on-hold transactions', err);
        },
      });
  }
}
