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

import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { of } from 'rxjs';
import { catchError, startWith, tap } from 'rxjs/operators';
import {
  DataTableComponent,
  CellTemplateDirective,
  ColumnDef,
  RequiresPermissionDirective,
} from '../../shared';
import { GL_ACCOUNT_API, I18N, TranslatePipe, type GlAccount } from '../../core/adapters';
import { DialogService } from '../../core/services/dialog.service';
import { ButtonComponent } from '../../ui/button/button.component';

@Component({
  selector: 'app-chart-of-accounts',
  standalone: true,
  imports: [
    DataTableComponent,
    CellTemplateDirective,
    RequiresPermissionDirective,
    TranslatePipe,
    NgClass,
    ButtonComponent,
  ],
  template: `
    <app-data-table
      [hasError]="hasError()"
      [errorStatus]="errorStatus()"
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
        <span class="type-tag" [ngClass]="account.type.toLowerCase()">
          {{ account.type }}
        </span>
      </ng-template>

      <ng-template appCellTemplate="actions" let-account>
        <app-button
          type="button"
          emphasis="quiet"
          intent="primary"
          icon="create-outline"
          (click)="onEditAccount(account)"
          [label]="'ACCOUNTING.EDIT_ACCOUNT' | appTranslate"
        />
        <app-button
          type="button"
          emphasis="quiet"
          intent="danger"
          icon="trash-outline"
          appRequiresPermission="DELETE_GLACCOUNT"
          (click)="onDeleteAccount(account)"
          [label]="'ACCOUNTING.DELETE_ACCOUNT' | appTranslate"
        />
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
  /**
   * The status that failure came back with, so the table can tell a refused read from a broken
   * one. READ_GLACCOUNT is a permission a role may simply not hold, and "try again" is the wrong
   * thing to offer someone whose next attempt will be refused in exactly the same way.
   */
  readonly errorStatus = signal<number | null>(null);

  private readonly glAccountApi = inject(GL_ACCOUNT_API);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private readonly i18n = inject(I18N);

  columns: ColumnDef[] = [
    { key: 'glCode', label: 'ACCOUNTING.GL_CODE', sortable: true },
    { key: 'name', label: 'ACCOUNTING.ACCOUNT_NAME', sortable: true },
    { key: 'type', label: 'COMMON.TYPE', sortable: true },
    { key: 'usage', label: 'TELLERS.USAGE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly accounts = signal<GlAccount[]>([]);

  constructor() {
    this.loadAccounts();
  }

  onRetry(): void {
    this.loadAccounts();
  }

  private loadAccounts(): void {
    this.glAccountApi
      .list()
      .pipe(
        startWith([]),
        tap(() => {
          this.hasError.set(false);
          this.errorStatus.set(null);
        }),
        catchError((error: HttpErrorResponse) => {
          this.hasError.set(true);
          this.errorStatus.set(error.status);
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

  onEditAccount(account: GlAccount) {
    this.router.navigate(['/accounting/chart-of-accounts/edit', account.id]);
  }

  /**
   * Deletes a GL account.
   *
   * The confirmation states the platform's refusal conditions up front — children, journal
   * entries, product mappings — rather than offering an action that looks available and then
   * explaining why it was not. The refusal itself reaches the operator in Fineract's own words
   * through the error interceptor, and the chart is reloaded only on success, so an account the
   * platform kept is still on screen (#789).
   */
  async onDeleteAccount(account: GlAccount): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: this.i18n.translate('ACCOUNTING.DELETE_ACCOUNT'),
      message: this.i18n.translate('ACCOUNTING.DELETE_ACCOUNT_CONFIRM'),
      details: [
        { label: this.i18n.translate('ACCOUNTING.GL_CODE'), value: account.glCode },
        { label: this.i18n.translate('ACCOUNTING.ACCOUNT_NAME'), value: account.name },
      ],
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    this.glAccountApi.delete(account.id).subscribe({
      next: () => this.loadAccounts(),
      error: (err: unknown) => {
        console.error('Failed to delete the GL account', err);
      },
    });
  }
}
