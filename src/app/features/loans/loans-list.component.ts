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

import { FormsModule } from '@angular/forms';
import { LOAN_API, TranslatePipe } from '../../core/adapters';
import type { Loan } from '../../core/adapters';
import { Router, RouterModule } from '@angular/router';
import { Subject, merge, of } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';
import {
  StatusBadgeComponent,
  DataTableComponent,
  CellTemplateDirective,
  ColumnDef,
  HasPermissionDirective,
} from '../../shared';
import { PageEvent, SortEvent } from '../../shared/models/table.model';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-loans-list',
  standalone: true,
  imports: [
    RouterModule,
    FormsModule,
    TranslatePipe,
    StatusBadgeComponent,
    DataTableComponent,
    CellTemplateDirective,
    HasPermissionDirective,
    IonIcon,
    IonButton,
    IonItem,
    IonLabel,
    IonSelectOption,
    IonSelect,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      [hasError]="hasError()"
      [errorStatus]="errorStatus()"
      (retry)="onRetry()"
      title="MODULES.LOANS_PORTFOLIO"
      helpTextKey="HELP.LOANS_PORTFOLIO_DESC"
      [columns]="columns"
      [data]="loans()"
      [totalRecords]="totalRecords()"
      (searchChange)="onSearch($event)"
      (sortChange)="onSort($event)"
      [pageIndex]="pageIndex()"
      (pageChange)="onPage($event)"
    >
      <ion-button
        headerActions
        color="primary"
        *appHasPermission="'CREATE_LOAN'"
        (click)="onCreateLoan()"
      >
        <ion-icon name="add-outline"></ion-icon>
        {{ 'LOANS.CREATE_LOAN_ACCOUNT' | appTranslate }}
      </ion-button>

      <div filters class="filter-row">
        <ion-item fill="outline" class="filter-field">
          <ion-label position="stacked">{{ 'COMMON.STATUS' | appTranslate }}</ion-label>
          <ion-select
            [attr.aria-label]="'COMMON.STATUS' | appTranslate"
            interface="popover"
            [(ngModel)]="activeFilters.status"
            (ionChange)="onFilterChange()"
          >
            <ion-select-option value="">{{ 'COMMON.ALL' | appTranslate }}</ion-select-option>
            <ion-select-option value="300">{{ 'COMMON.ACTIVE' | appTranslate }}</ion-select-option>
            <ion-select-option value="100">{{ 'COMMON.PENDING' | appTranslate }}</ion-select-option>
            <ion-select-option value="600">{{ 'COMMON.CLOSED' | appTranslate }}</ion-select-option>
            <ion-select-option value="700">{{
              'COMMON.OVERPAID' | appTranslate
            }}</ion-select-option>
          </ion-select>
        </ion-item>
      </div>

      <ng-template appCellTemplate="status" let-loan>
        <app-status-badge [status]="loan.status"></app-status-badge>
      </ng-template>

      <ng-template appCellTemplate="accountNo" let-loan>
        <a class="clickable-link" [routerLink]="['/loans/view', loan.id]">{{ loan.accountNo }}</a>
      </ng-template>

      <ng-template appCellTemplate="actions" let-loan>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | appTranslate"
          [appTooltip]="'LOANS.EDIT_LOAN_APPLICATION' | appTranslate"
          (click)="onEditLoan(loan)"
          *appHasPermission="'UPDATE_LOAN'"
        >
          <ion-icon name="create-outline"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="secondary"
          [attr.aria-label]="'LOANS.COLLATERAL' | appTranslate"
          [appTooltip]="'LOANS.MANAGE_COLLATERAL' | appTranslate"
          (click)="onViewCollateral(loan)"
          *appHasPermission="'READ_COLLATERAL'"
        >
          <ion-icon name="shield-outline"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'LOANS.RESCHEDULE' | appTranslate"
          [appTooltip]="'LOANS.MANAGE_RESCHEDULING' | appTranslate"
          (click)="onViewRescheduling(loan)"
        >
          <ion-icon name="repeat-outline"></ion-icon>
        </ion-button>

        @if (loan.status.pendingApproval) {
          <ion-button
            fill="clear"
            color="secondary"
            data-testid="loan-list-approve-action"
            [attr.aria-label]="'LOANS.APPROVE_LOAN_APPLICATION' | appTranslate"
            [appTooltip]="'LOANS.APPROVE_LOAN_APPLICATION' | appTranslate"
            (click)="onLoanAction(loan, 'approve')"
          >
            <ion-icon name="checkmark-circle-outline"></ion-icon>
          </ion-button>
        }
        @if (loan.status.waitingForDisbursal) {
          <ion-button
            fill="clear"
            color="secondary"
            data-testid="loan-list-disburse-action"
            [attr.aria-label]="'LOANS.DISBURSE_LOAN' | appTranslate"
            [appTooltip]="'LOANS.DISBURSE_LOAN' | appTranslate"
            (click)="onLoanAction(loan, 'disburse')"
          >
            <ion-icon name="open-outline"></ion-icon>
          </ion-button>
        }
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .filter-row {
        display: flex;
        gap: 12px;
        margin-left: 16px;
      }
      .filter-field {
        width: 150px;
      }
    `,
  ],
})
export class LoansListComponent {
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);
  /**
   * The status that failure came back with, so the table can tell a refused read from a broken
   * one. A role without READ_LOAN gets the same refusal on every attempt, and offering a retry
   * for it is a loop with no end.
   */
  readonly errorStatus = signal<number | null>(null);

  /** Re-runs the query behind the table when the user asks to try again. */
  private readonly retrySubject = new Subject<void>();

  private readonly loanApi = inject(LOAN_API);
  private readonly router = inject(Router);

  columns: ColumnDef[] = [
    { key: 'accountNo', label: 'LOANS.ACCOUNT_NO', sortable: true },
    { key: 'clientName', label: 'LOANS.CLIENT_NAME', sortable: true },
    { key: 'loanProductName', label: 'LOANS.PRODUCT_NAME', sortable: true },
    { key: 'status', label: 'COMMON.STATUS', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly loans = signal<Loan[]>([]);
  readonly totalRecords = signal(0);

  // Empty string, not `undefined`, so it round-trips through `<ion-select>`'s ngModel
  // binding as a real match for the "All" option's own `value=""` rather than leaving the
  // select showing nothing selected.
  activeFilters: { status?: string } = { status: '' };

  private searchSubject = new Subject<string>();
  private sortSubject = new Subject<SortEvent>();
  private pageSubject = new Subject<PageEvent>();
  private filterSubject = new Subject<void>();

  private currentFilter = '';
  private currentSort: SortEvent = { active: '', direction: '' };
  private currentPage: PageEvent = { pageIndex: 0, pageSize: 10, length: 0 };
  /** Mirrors currentPage.pageIndex for the data-table, so resetting to the
      first page on search/sort/filter actually moves the paginator. */
  readonly pageIndex = signal(0);

  constructor() {
    merge(
      this.searchSubject,
      this.sortSubject,
      this.pageSubject,
      this.filterSubject,
      this.retrySubject,
    )
      .pipe(
        startWith({}),
        switchMap(() => {
          const offset = this.currentPage.pageIndex * this.currentPage.pageSize;
          const limit = this.currentPage.pageSize;
          const orderBy = this.currentSort.active || undefined;
          const sortOrder = this.currentSort.direction
            ? this.currentSort.direction.toUpperCase()
            : undefined;

          const searchVal = this.currentFilter || undefined;
          // Fineract's /loans endpoint rejects `status=` and `status=All` outright (a 400,
          // "The Status value '...' is not supported") — the param must be omitted entirely
          // to mean "any status", so the "All" sentinel is never forwarded as-is.
          const status = this.activeFilters.status || undefined;

          return this.loanApi
            .list({ offset, limit, orderBy, sortOrder, accountNo: searchVal, status })
            .pipe(
              tap(() => {
                this.hasError.set(false);
                this.errorStatus.set(null);
              }),
              catchError((error: HttpErrorResponse) => {
                this.hasError.set(true);
                this.errorStatus.set(error.status);
                return of(null);
              }),
            );
        }),
        map((page) => {
          if (page === null) return [];
          this.totalRecords.set(page.totalFilteredRecords);
          return Array.from(page.items);
        }),
      )
      .subscribe((data) => {
        this.loans.set(data);
      });
  }

  onSearch(filterValue: string) {
    this.currentFilter = filterValue;
    this.currentPage.pageIndex = 0;
    this.pageIndex.set(0);
    this.searchSubject.next(filterValue);
  }

  onSort(sort: SortEvent) {
    this.currentSort = sort;
    this.currentPage.pageIndex = 0;
    this.pageIndex.set(0);
    this.sortSubject.next(sort);
  }

  onPage(event: PageEvent) {
    this.currentPage = event;
    this.pageIndex.set(event.pageIndex);
    this.pageSubject.next(event);
  }

  onFilterChange() {
    this.currentPage.pageIndex = 0;
    this.pageIndex.set(0);
    this.filterSubject.next();
  }

  onCreateLoan() {
    this.router.navigate(['/loans/create']);
  }

  onEditLoan(loan: Loan) {
    this.router.navigate(['/loans/edit', loan.id]);
  }

  onViewCollateral(loan: Loan) {
    this.router.navigate(['/loans', loan.id, 'collateral']);
  }

  onViewRescheduling(loan: Loan) {
    this.router.navigate(['/loans', loan.id, 'rescheduling']);
  }

  onLoanAction(loan: Loan, command: string) {
    this.router.navigate([`/products/loan/${loan.id}/action/${command}`]);
  }

  onRetry(): void {
    this.retrySubject.next();
  }
}
