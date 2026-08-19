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
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DefaultService } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
import { CdkTableModule } from '@angular/cdk/table';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
} from '@ionic/angular/standalone';

interface OfficeTransaction {
  id: number;
  fromOfficeName?: string;
  fromOffice?: unknown;
  toOfficeName?: string;
  toOffice?: unknown;
  transactionDate?: unknown;
  transactionAmount?: number;
  amount?: number;
  description?: string;
}

@Component({
  selector: 'app-office-transactions-list',
  standalone: true,
  imports: [
    RouterModule,
    TranslateModule,
    CdkTableModule,
    IonIcon,
    IonButton,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
  ],
  template: `
    <div class="list-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'OFFICE_TRANSACTIONS.TITLE' | translate }}</ion-card-title>
          <span class="spacer"></span>
          <ion-button color="primary" routerLink="/organization/office-transactions/create">
            <ion-icon name="add-outline"></ion-icon>
            {{ 'COMMON.CREATE' | translate }}
          </ion-button>
        </ion-card-header>

        <ion-card-content>
          <table cdk-table [dataSource]="transactions()" class="full-width">
            <ng-container cdkColumnDef="id">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ID' | translate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.id }}</td>
            </ng-container>

            <ng-container cdkColumnDef="fromOffice">
              <th cdk-header-cell *cdkHeaderCellDef>
                {{ 'OFFICE_TRANSACTIONS.FROM_OFFICE' | translate }}
              </th>
              <td cdk-cell *cdkCellDef="let row">{{ row.fromOfficeName || row.fromOffice }}</td>
            </ng-container>

            <ng-container cdkColumnDef="toOffice">
              <th cdk-header-cell *cdkHeaderCellDef>
                {{ 'OFFICE_TRANSACTIONS.TO_OFFICE' | translate }}
              </th>
              <td cdk-cell *cdkCellDef="let row">{{ row.toOfficeName || row.toOffice }}</td>
            </ng-container>

            <ng-container cdkColumnDef="transactionDate">
              <th cdk-header-cell *cdkHeaderCellDef>
                {{ 'OFFICE_TRANSACTIONS.DATE' | translate }}
              </th>
              <td cdk-cell *cdkCellDef="let row">{{ formatDate(row.transactionDate) }}</td>
            </ng-container>

            <ng-container cdkColumnDef="amount">
              <th cdk-header-cell *cdkHeaderCellDef>
                {{ 'OFFICE_TRANSACTIONS.AMOUNT' | translate }}
              </th>
              <td cdk-cell *cdkCellDef="let row">{{ row.transactionAmount ?? row.amount }}</td>
            </ng-container>

            <ng-container cdkColumnDef="description">
              <th cdk-header-cell *cdkHeaderCellDef>
                {{ 'OFFICE_TRANSACTIONS.DESC' | translate }}
              </th>
              <td cdk-cell *cdkCellDef="let row">{{ row.description }}</td>
            </ng-container>

            <ng-container cdkColumnDef="actions">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ACTIONS' | translate }}</th>
              <td cdk-cell *cdkCellDef="let row">
                <ion-button
                  fill="clear"
                  color="danger"
                  (click)="onDelete(row)"
                  [attr.aria-label]="'OFFICE_TRANSACTIONS.DELETE' | translate"
                >
                  <ion-icon name="trash-outline"></ion-icon>
                </ion-button>
              </td>
            </ng-container>

            <tr cdk-header-row *cdkHeaderRowDef="displayedColumns"></tr>
            <tr cdk-row *cdkRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .list-container {
        padding: 24px;
      }
      mat-card-header {
        display: flex;
        align-items: center;
        margin-bottom: 16px;
      }
      .spacer {
        flex: 1;
      }
      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class OfficeTransactionsListComponent implements OnInit {
  private readonly api = inject(DefaultService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  readonly transactions = signal<OfficeTransaction[]>([]);

  readonly displayedColumns = [
    'id',
    'fromOffice',
    'toOffice',
    'transactionDate',
    'amount',
    'description',
    'actions',
  ];

  ngOnInit(): void {
    this.loadTransactions();
  }

  private loadTransactions(): void {
    this.api.getOfficetransactions().subscribe({
      next: (raw: string) => {
        try {
          this.transactions.set((JSON.parse(raw) as OfficeTransaction[]) || []);
        } catch {
          this.transactions.set([]);
        }
      },
      error: (err: unknown) => {
        console.error('Failed to load office transactions', err);
      },
    });
  }

  onDelete(row: OfficeTransaction): void {
    const id = row.id;
    this.api.deleteOfficetransactionsTransactionId(id).subscribe({
      next: () => {
        this.transactions.update((list) => list.filter((t) => t.id !== id));
        this.notifications.success('Transaction deleted');
      },
      error: (err: unknown) => {
        console.error('Failed to delete office transaction', err);
        this.notifications.error('Failed to delete transaction');
      },
    });
  }

  formatDate(value: unknown): string {
    if (!value || !Array.isArray(value) || value.length < 3) {
      return value ? String(value) : '-';
    }
    return `${value[0]}-${String(value[1]).padStart(2, '0')}-${String(value[2]).padStart(2, '0')}`;
  }
}
