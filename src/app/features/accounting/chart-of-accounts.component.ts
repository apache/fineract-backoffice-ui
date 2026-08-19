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
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { of } from 'rxjs';
import { catchError, startWith, tap } from 'rxjs/operators';
import { DataTableComponent, CellTemplateDirective, ColumnDef } from '../../shared';
import { GeneralLedgerAccountService, GetGLAccountsResponse } from '../../api';
import { TranslatePipe } from '../../core/adapters';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-chart-of-accounts',
  standalone: true,
  imports: [
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    TranslatePipe,
    NgClass,
    IonIcon,
    IonButton,
  ],
  template: `
    <app-data-table
      [hasError]="hasError()"
      (retry)="onRetry()"
      title="nav.chartOfAccounts"
      helpTextKey="HELP.CHART_OF_ACCOUNTS_DESC"
      createButtonLabel="ACCOUNTING.ADD_LEDGER_ACCOUNT"
      createPermission="CREATE_GLACCOUNT"
      [columns]="columns"
      [data]="accounts()"
      [localLogic]="true"
      (create)="onCreateAccount()"
    >
      <ng-template appCellTemplate="type" let-account>
        <span class="type-tag" [ngClass]="account.type?.value?.toLowerCase()">
          {{ account.type?.value }}
        </span>
      </ng-template>

      <ng-template appCellTemplate="actions" let-account>
        <ion-button
          fill="clear"
          color="primary"
          [title]="'ACCOUNTING.EDIT_ACCOUNT' | appTranslate"
          (click)="onEditAccount(account)"
          [attr.aria-label]="'ACCOUNTING.EDIT_ACCOUNT' | translate"
        >
          <ion-icon name="create-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .type-tag {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
      }
      .asset {
        background-color: #e3f2fd;
        color: #1976d2;
      }
      .liability {
        background-color: #fce4ec;
        color: #c2185b;
      }
      .equity {
        background-color: #f3e5f5;
        color: #7b1fa2;
      }
      .income {
        background-color: #e8f5e9;
        color: #388e3c;
      }
      .expense {
        background-color: #fff3e0;
        color: #f57c00;
      }
    `,
  ],
})
export class ChartOfAccountsComponent {
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  private readonly glAccountService = inject(GeneralLedgerAccountService);
  private readonly router = inject(Router);

  columns: ColumnDef[] = [
    { key: 'glCode', label: 'GL Code', sortable: true },
    { key: 'name', label: 'Account Name', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'usage', label: 'Usage', sortable: true },
    { key: 'actions', label: 'Actions', sortable: false },
  ];

  readonly accounts = signal<GetGLAccountsResponse[]>([]);

  constructor() {
    this.loadAccounts();
  }

  onRetry(): void {
    this.loadAccounts();
  }

  private loadAccounts(): void {
    this.glAccountService
      .getGlaccounts()
      .pipe(
        startWith([]),
        tap(() => this.hasError.set(false)),
        catchError(() => {
          this.hasError.set(true);
          return of([]);
        }),
      )
      .subscribe((data) => {
        this.accounts.set(data);
      });
  }

  onCreateAccount() {
    this.router.navigate(['/accounting/chart-of-accounts/create']);
  }

  onEditAccount(account: GetGLAccountsResponse) {
    this.router.navigate(['/accounting/chart-of-accounts/edit', account.id]);
  }
}
