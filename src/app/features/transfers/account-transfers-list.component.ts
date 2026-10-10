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
import { DecimalPipe, DatePipe } from '@angular/common';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent } from '@ionic/angular/standalone';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../shared';
import { TranslatePipe } from '../../core/adapters';

import {
  AccountTransfersService,
  GetAccountTransfersResponse,
  GetAccountTransfersPageItems,
} from '../../api';

@Component({
  selector: 'app-account-transfers-list',
  standalone: true,
  imports: [
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    DataTableComponent,
    CellTemplateDirective,
    TranslatePipe,
    DecimalPipe,
    DatePipe,
  ],
  template: `
    <ion-card id="account-transfers-card" data-testid="account-transfers-card">
      <ion-card-header>
        <ion-card-title>{{ 'TRANSFERS.HISTORY_TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <app-data-table
          [columns]="columns"
          [data]="transfers()"
          [isLoading]="isLoading()"
          [localLogic]="true"
        >
          <ng-template appCellTemplate="transferAmount" let-row>
            {{ row.transferAmount | number: '1.2-2' }}
          </ng-template>

          <ng-template appCellTemplate="transferDate" let-row>
            {{ parseDate(row.transferDate) | date: 'mediumDate' }}
          </ng-template>
        </app-data-table>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .spinner-container {
        display: flex;
        justify-content: center;
        padding: 2rem;
      }
      table {
        width: 100%;
      }
    `,
  ],
})
export class AccountTransfersListComponent implements OnInit {
  readonly transfers = signal<GetAccountTransfersPageItems[]>([]);
  readonly isLoading = signal(false);

  columns: ColumnDef[] = [
    { key: 'id', label: 'TRANSFERS.ID' },
    { key: 'fromAccount.id', label: 'TRANSFERS.FROM_ACCOUNT' },
    { key: 'toAccount.id', label: 'TRANSFERS.TO_ACCOUNT' },
    { key: 'currency.code', label: 'TRANSFERS.CURRENCY' },
    { key: 'transferAmount', label: 'TRANSFERS.AMOUNT' },
    { key: 'transferDate', label: 'TRANSFERS.DATE' },
    { key: 'transferDescription', label: 'TRANSFERS.DESCRIPTION' },
  ];

  private accountTransfersService = inject(AccountTransfersService);

  ngOnInit(): void {
    this.loadTransfers();
  }

  loadTransfers(): void {
    this.isLoading.set(true);
    this.accountTransfersService.getAccounttransfers().subscribe({
      next: (response: GetAccountTransfersResponse) => {
        this.transfers.set(Array.from(response.pageItems ?? []));
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  parseDate(transferDate: unknown): Date | null {
    if (!transferDate) return null;
    if (Array.isArray(transferDate)) {
      return new Date(
        (transferDate as number[])[0],
        (transferDate as number[])[1] - 1,
        (transferDate as number[])[2],
      );
    }
    return new Date(transferDate as string | number);
  }
}
