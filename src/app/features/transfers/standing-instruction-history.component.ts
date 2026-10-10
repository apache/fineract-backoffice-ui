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
import { DatePipe, DecimalPipe } from '@angular/common';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../shared';
import {
  StandingInstructionsHistoryService,
  GetStandingInstructionHistoryPageItemsResponse,
} from '../../api';

@Component({
  selector: 'app-standing-instruction-history',
  standalone: true,
  imports: [DataTableComponent, CellTemplateDirective, DatePipe, DecimalPipe],
  template: `
    <app-data-table
      title="CLIENTS.STANDING_INSTRUCTIONS_HISTORY"
      [columns]="columns"
      [data]="history()"
      [isLoading]="isLoading()"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="amount" let-row>
        {{ row.amount | number: '1.2-2' }}
      </ng-template>

      <ng-template appCellTemplate="executionTime" let-row>
        {{ row.executionTime | date: 'medium' }}
      </ng-template>
    </app-data-table>
  `,
})
export class StandingInstructionHistoryComponent implements OnInit {
  private readonly historyService = inject(StandingInstructionsHistoryService);

  readonly history = signal<GetStandingInstructionHistoryPageItemsResponse[]>([]);
  readonly isLoading = signal<boolean>(false);

  columns: ColumnDef[] = [
    { key: 'name', label: 'COMMON.NAME' },
    { key: 'fromClientName', label: 'CLIENTS.FROM_CLIENT' },
    { key: 'fromAccount.accountNo', label: 'CLIENTS.FROM_ACCOUNT' },
    { key: 'toClientName', label: 'CLIENTS.TO_CLIENT' },
    { key: 'toAccount.accountNo', label: 'CLIENTS.TO_ACCOUNT' },
    { key: 'amount', label: 'COMMON.AMOUNT' },
    { key: 'executionTime', label: 'CLIENTS.EXECUTION_TIME' },
    { key: 'status', label: 'COMMON.STATUS' },
    { key: 'errorLog', label: 'COMMON.ERROR' },
  ];

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.isLoading.set(true);
    this.historyService.getStandinginstructionrunhistory().subscribe({
      next: (data) => {
        this.history.set(Array.from(data.pageItems || []));
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load standing instructions history', err);
        this.isLoading.set(false);
      },
    });
  }
}
