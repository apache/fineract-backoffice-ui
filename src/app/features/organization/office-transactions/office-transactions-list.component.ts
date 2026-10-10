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
import { Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../core/adapters';
import { DefaultService } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { RequiresPermissionDirective } from '../../../shared/directives/requires-permission.directive';
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
    TranslatePipe,
    CdkTableModule,
    IonIcon,
    IonButton,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    HasPermissionDirective,
    RequiresPermissionDirective,
  ],
  template: `
    <div class="list-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'OFFICE_TRANSACTIONS.TITLE' | appTranslate }}</ion-card-title>
          <span class="spacer"></span>
          <!--
            Gated like every other list's create action. This screen builds its own header
            instead of using app-data-table's \`createPermission\`, which is how it came to be
            the one list offering a button whose only destination is Access Denied.
          -->
          <ion-button
            *appHasPermission="'CREATE_OFFICETRANSACTION'"
            color="primary"
            data-testid="office-transaction-create"
            routerLink="/organization/office-transactions/create"
          >
            <ion-icon name="add-outline"></ion-icon>
            {{ 'COMMON.CREATE' | appTranslate }}
          </ion-button>
        </ion-card-header>

        <ion-card-content>
          @if (hasError()) {
            <div class="error-state" role="alert" data-testid="office-transactions-error">
              <ion-icon
                [name]="isForbidden() ? 'lock-closed-outline' : 'alert-circle-outline'"
              ></ion-icon>
              <p>
                {{
                  (isForbidden() ? 'COMMON.ERRORS.LOAD_FORBIDDEN' : 'COMMON.ERRORS.LOAD_FAILED')
                    | appTranslate
                }}
              </p>
            </div>
          } @else {
            <table cdk-table [dataSource]="transactions()" class="full-width">
              <ng-container cdkColumnDef="id">
                <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ID' | appTranslate }}</th>
                <td cdk-cell *cdkCellDef="let row">{{ row.id }}</td>
              </ng-container>

              <ng-container cdkColumnDef="fromOffice">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'OFFICE_TRANSACTIONS.FROM_OFFICE' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.fromOfficeName || row.fromOffice }}</td>
              </ng-container>

              <ng-container cdkColumnDef="toOffice">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'OFFICE_TRANSACTIONS.TO_OFFICE' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.toOfficeName || row.toOffice }}</td>
              </ng-container>

              <ng-container cdkColumnDef="transactionDate">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'OFFICE_TRANSACTIONS.DATE' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ formatDate(row.transactionDate) }}</td>
              </ng-container>

              <ng-container cdkColumnDef="amount">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'OFFICE_TRANSACTIONS.AMOUNT' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.transactionAmount ?? row.amount }}</td>
              </ng-container>

              <ng-container cdkColumnDef="description">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'OFFICE_TRANSACTIONS.DESC' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.description }}</td>
              </ng-container>

              <ng-container cdkColumnDef="actions">
                <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ACTIONS' | appTranslate }}</th>
                <td cdk-cell *cdkCellDef="let row">
                  <ion-button
                    fill="clear"
                    color="danger"
                    (click)="onDelete(row)"
                    appRequiresPermission="DELETE_OFFICETRANSACTION"
                    [attr.aria-label]="'OFFICE_TRANSACTIONS.DELETE' | appTranslate"
                  >
                    <ion-icon name="trash-outline"></ion-icon>
                  </ion-button>
                </td>
              </ng-container>

              <tr cdk-header-row *cdkHeaderRowDef="displayedColumns"></tr>
              <tr cdk-row *cdkRowDef="let row; columns: displayedColumns"></tr>
            </table>
          }
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
      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 32px 16px;
        color: var(--ion-color-medium-shade);
        text-align: center;
      }
      .error-state ion-icon {
        font-size: 32px;
      }
    `,
  ],
})
export class OfficeTransactionsListComponent implements OnInit {
  private readonly api = inject(DefaultService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  readonly transactions = signal<OfficeTransaction[]>([]);

  /**
   * Whether the last load failed, and with what.
   *
   * The handler used to log to the console and nothing else. The global interceptor's toast does
   * appear, but it fades, and what it leaves behind is an empty table under its headers — which
   * reads as "there are no office transactions" rather than "this did not load". Worth separating
   * because the platform refuses the list for a role without READ_OFFICE as well as
   * READ_OFFICETRANSACTION, so the refusal is the case a reader is most likely to hit.
   */
  readonly hasError = signal(false);
  readonly errorStatus = signal<number | null>(null);
  protected readonly isForbidden = computed(() => this.hasError() && this.errorStatus() === 403);

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
        this.hasError.set(false);
        this.errorStatus.set(null);
        try {
          this.transactions.set((JSON.parse(raw) as OfficeTransaction[]) || []);
        } catch {
          this.transactions.set([]);
        }
      },
      error: (err: unknown) => {
        console.error('Failed to load office transactions', err);
        this.hasError.set(true);
        this.errorStatus.set(
          typeof err === 'object' && err !== null && 'status' in err
            ? ((err as { status: unknown }).status as number)
            : null,
        );
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
