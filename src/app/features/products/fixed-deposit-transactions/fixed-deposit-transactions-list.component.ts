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
  FixedDepositAccountTransactionsService,
  GetFixedDepositAccountsAccountIdTransactionsResponse,
} from '../../../api';

/**
 * Read-only list of transactions for a single fixed deposit account. The account id is read
 * from the route snapshot. Deposits and withdrawals are command-driven elsewhere, so this is a
 * view-only screen with no create action.
 */
@Component({
  selector: 'app-fixed-deposit-transactions-list',
  standalone: true,
  imports: [DataTableComponent, CellTemplateDirective],
  template: `
    <app-data-table
      title="FIXED_DEPOSIT_TRANSACTIONS.TITLE"
      helpTextKey="HELP.FIXED_DEPOSIT_TRANSACTIONS_DESC"
      [columns]="columns"
      [data]="transactions()"
      [totalRecords]="transactions().length"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="date" let-row>
        {{ row.date }}
      </ng-template>
      <ng-template appCellTemplate="amount" let-row>
        {{ row.amount }}
      </ng-template>
      <ng-template appCellTemplate="transactionType" let-row>
        {{ row.transactionType?.code }}
      </ng-template>
    </app-data-table>
  `,
})
export class FixedDepositTransactionsListComponent implements OnInit {
  private readonly transactionsService = inject(FixedDepositAccountTransactionsService);
  private readonly route = inject(ActivatedRoute);

  readonly columns: ColumnDef[] = [
    { key: 'date', label: 'FIXED_DEPOSIT_TRANSACTIONS.DATE', sortable: true },
    { key: 'amount', label: 'FIXED_DEPOSIT_TRANSACTIONS.AMOUNT', sortable: true },
    { key: 'transactionType', label: 'FIXED_DEPOSIT_TRANSACTIONS.TYPE', sortable: false },
  ];

  accountId!: number;
  readonly transactions = signal<GetFixedDepositAccountsAccountIdTransactionsResponse[]>([]);

  ngOnInit(): void {
    this.accountId = Number(this.route.snapshot.paramMap.get('accountId'));
    this.load();
  }

  load(): void {
    this.transactionsService
      .getFixeddepositaccountsFixedDepositAccountIdTransactions(this.accountId)
      .subscribe({
        next: (data: GetFixedDepositAccountsAccountIdTransactionsResponse[]) => {
          this.transactions.set(data || []);
        },
        error: (err: unknown) => {
          console.error('Failed to load fixed deposit transactions', err);
        },
      });
  }
}
