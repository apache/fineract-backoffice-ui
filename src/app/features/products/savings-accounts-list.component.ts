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
import { CurrencyPipe } from '@angular/common';
import { Subject, merge, of } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';
import {
  DataTableComponent,
  ColumnDef,
  CellTemplateDirective,
  StatusBadgeComponent,
  HasPermissionDirective,
} from '../../shared';
import { SavingsAccountService, GetSavingsAccountsResponse, GetSavingsPageItems } from '../../api';
import { PageEvent, SortEvent } from '../../shared/models/table.model';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  resolveAccountActionType,
  resolveAccountRoutePrefix,
} from '../../core/utils/account-type-resolver';

@Component({
  selector: 'app-savings-accounts-list',
  standalone: true,
  imports: [
    RouterModule,
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    HasPermissionDirective,
    CurrencyPipe,
    IonIcon,
    IonButton,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      [hasError]="hasError()"
      (retry)="onRetry()"
      title="nav.savingsAccounts"
      helpTextKey="HELP.SAVINGS_ACCOUNTS_DESC"
      [columns]="columns"
      [data]="accounts()"
      [totalRecords]="totalRecords"
      [showSearch]="true"
      [isLoading]="isLoading"
      (searchChange)="onSearch($event)"
      (sortChange)="onSort($event)"
      [pageIndex]="pageIndex()"
      (pageChange)="onPage($event)"
    >
      <ion-button
        headerActions
        color="primary"
        *appHasPermission="'CREATE_SAVINGSACCOUNT'"
        (click)="onCreateAccount()"
      >
        <ion-icon name="add-outline"></ion-icon>
        {{ 'SAVINGS.CREATE_ACCOUNT' | translate }}
      </ion-button>

      <ng-template appCellTemplate="accountNo" let-account>
        <a
          class="clickable-link"
          [routerLink]="['/products', getAccountRoutePrefix(account), 'view', account.id]"
          >{{ account.accountNo }}</a
        >
      </ng-template>

      <ng-template appCellTemplate="summary.accountBalance" let-account>
        {{ account.summary?.accountBalance | currency: account.currency?.code }}
      </ng-template>

      <ng-template appCellTemplate="status" let-account>
        <app-status-badge [status]="account.status"></app-status-badge>
      </ng-template>

      <ng-template appCellTemplate="actions" let-account>
        @if (account.status?.submittedAndPendingApproval) {
          <ion-button
            fill="clear"
            color="secondary"
            [attr.aria-label]="'LOANS.APPROVE' | translate"
            [appTooltip]="'LOANS.APPROVE' | translate"
            (click)="onApprove(account)"
            *appHasPermission="'APPROVE_SAVINGSACCOUNT'"
          >
            <ion-icon name="checkmark-circle-outline"></ion-icon>
          </ion-button>
        }
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          [appTooltip]="'COMMON.EDIT' | translate"
          (click)="onEditAccount(account)"
          *appHasPermission="'UPDATE_SAVINGSACCOUNT'"
        >
          <ion-icon name="create-outline"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="secondary"
          [attr.aria-label]="'SAVINGS.DEPOSIT' | translate"
          [appTooltip]="'SAVINGS.DEPOSIT_CASH' | translate"
          (click)="onTransaction(account, 'deposit')"
          *appHasPermission="'DEPOSIT_SAVINGSACCOUNT'"
        >
          <ion-icon name="add-circle-outline"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="danger"
          [attr.aria-label]="'SAVINGS.WITHDRAWAL' | translate"
          [appTooltip]="'SAVINGS.WITHDRAW_CASH' | translate"
          (click)="onTransaction(account, 'withdrawal')"
          *appHasPermission="'WITHDRAW_SAVINGSACCOUNT'"
        >
          <ion-icon name="remove-circle-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class SavingsAccountsListComponent implements OnInit {
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  /** Re-runs the query behind the table when the user asks to try again. */
  private readonly retrySubject = new Subject<void>();

  private readonly savingsService = inject(SavingsAccountService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'accountNo', label: 'COMMON.ACCOUNT_NO', sortable: true },
    { key: 'clientName', label: 'COMMON.NAME', sortable: true },
    { key: 'savingsProductName', label: 'COMMON.PRODUCT', sortable: true },
    { key: 'summary.accountBalance', label: 'COMMON.BALANCE', sortable: true },
    { key: 'status', label: 'COMMON.STATUS', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly accounts = signal<GetSavingsPageItems[]>([]);
  totalRecords = 0;
  isLoading = false;

  private searchSubject = new Subject<string>();
  private sortSubject = new Subject<SortEvent>();
  private pageSubject = new Subject<PageEvent>();

  private currentFilter = '';
  private currentSort: SortEvent = { active: '', direction: '' };
  private currentPage: PageEvent = { pageIndex: 0, pageSize: 10, length: 0 };
  /** Mirrors currentPage.pageIndex for the data-table, so resetting to the
      first page on search/sort/filter actually moves the paginator. */
  readonly pageIndex = signal(0);

  ngOnInit(): void {
    merge(this.searchSubject, this.sortSubject, this.pageSubject, this.retrySubject)
      .pipe(
        startWith({}),
        switchMap(() => {
          this.isLoading = true;
          const offset = this.currentPage.pageIndex * this.currentPage.pageSize;
          const limit = this.currentPage.pageSize;
          const orderBy = this.currentSort.active || undefined;
          const sortOrder = this.currentSort.direction
            ? this.currentSort.direction.toUpperCase()
            : undefined;

          // Note: SavingsAccountService.retrieveAll33 supports offset/limit.
          // Fineract 1.x doesn't always support 'externalId' as a partial name search,
          // but we use it if search is provided.
          const searchVal = this.currentFilter || undefined;

          return this.savingsService
            .getSavingsaccounts(searchVal, offset, limit, orderBy, sortOrder)
            .pipe(
              tap(() => this.hasError.set(false)),
              catchError(() => {
                this.hasError.set(true);
                return of(null);
              }),
            );
        }),
        map((response: GetSavingsAccountsResponse | null) => {
          this.isLoading = false;
          if (!response) return [];
          const items = Array.from(response.pageItems || []).filter((account) => {
            const acc = account as Record<string, unknown>;
            const depositType = acc['depositType'] as Record<string, unknown> | undefined;
            const depositTypeId = depositType ? depositType['id'] : acc['depositTypeId'];
            return depositTypeId !== 200;
          });
          this.totalRecords = response.totalFilteredRecords || 0;
          // If server-side count is returned, but we filtered client-side, adjust totalRecords accordingly
          if (response.pageItems && response.pageItems.size !== items.length) {
            this.totalRecords = Math.max(
              0,
              this.totalRecords - (response.pageItems.size - items.length),
            );
          }
          return items;
        }),
      )
      .subscribe((data) => {
        this.accounts.set(data);
      });
  }

  onSearch(query: string): void {
    this.currentFilter = query;
    this.currentPage.pageIndex = 0;
    this.pageIndex.set(0);
    this.searchSubject.next(query);
  }

  onSort(sort: SortEvent): void {
    this.currentSort = sort;
    this.currentPage.pageIndex = 0;
    this.pageIndex.set(0);
    this.sortSubject.next(sort);
  }

  onPage(event: PageEvent): void {
    this.currentPage = event;
    this.pageIndex.set(event.pageIndex);
    this.pageSubject.next(event);
  }

  onCreateAccount(): void {
    this.router.navigate(['/products/savings-accounts/create']);
  }

  getAccountRoutePrefix(account: GetSavingsPageItems): string {
    return resolveAccountRoutePrefix(account as Record<string, unknown>);
  }

  getAccountActionType(account: GetSavingsPageItems): string {
    return resolveAccountActionType(account as Record<string, unknown>);
  }

  onEditAccount(account: GetSavingsPageItems): void {
    this.router.navigate(['/products', this.getAccountRoutePrefix(account), 'edit', account.id]);
  }

  onTransaction(account: GetSavingsPageItems, command: string): void {
    this.router.navigate([
      '/products',
      this.getAccountRoutePrefix(account),
      account.id,
      'transactions',
      command,
    ]);
  }

  onApprove(account: GetSavingsPageItems): void {
    this.router.navigate([
      `/products/${this.getAccountActionType(account)}/${account.id}/action/approve`,
    ]);
  }

  onRetry(): void {
    this.retrySubject.next();
  }
}
