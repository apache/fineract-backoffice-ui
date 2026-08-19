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

import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
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
import { ClientService, GetClientsPageItemsResponse } from '../../api';
import { PageEvent, SortEvent } from '../../shared/models/table.model';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [
    RouterModule,
    FormsModule,
    TranslateModule,
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
  ],
  template: `
    <app-data-table
      [hasError]="hasError()"
      (retry)="onRetry()"
      title="MODULES.CLIENTS_CONTRACTS"
      helpTextKey="HELP.CLIENTS_CONTRACTS_DESC"
      [columns]="columns"
      [data]="clients()"
      [totalRecords]="totalRecords()"
      (searchChange)="onSearch($event)"
      (sortChange)="onSort($event)"
      [pageIndex]="pageIndex()"
      (pageChange)="onPage($event)"
    >
      <ion-button
        headerActions
        color="primary"
        *appHasPermission="'CREATE_CLIENT'"
        (click)="onCreateClient()"
      >
        <ion-icon name="add-outline"></ion-icon>
        Create Client
      </ion-button>

      <div filters class="filter-row">
        <ion-item fill="outline" class="filter-field">
          <ion-label position="stacked">{{ 'COMMON.STATUS' | translate }}</ion-label>
          <ion-select
            [attr.aria-label]="'COMMON.STATUS' | translate"
            interface="popover"
            [(ngModel)]="activeFilters.status"
            (ionChange)="onFilterChange()"
          >
            <ion-select-option value="">{{ 'COMMON.ALL' | translate }}</ion-select-option>
            <ion-select-option value="active">{{ 'COMMON.ACTIVE' | translate }}</ion-select-option>
            <ion-select-option value="pending">{{
              'COMMON.PENDING' | translate
            }}</ion-select-option>
            <ion-select-option value="closed">{{ 'COMMON.CLOSED' | translate }}</ion-select-option>
          </ion-select>
        </ion-item>
      </div>

      <ng-template appCellTemplate="status" let-client>
        <app-status-badge [status]="client.status?.value"></app-status-badge>
      </ng-template>

      <ng-template appCellTemplate="accountNo" let-client>
        <a class="clickable-link" [routerLink]="['/clients/view', client.id]">{{
          client.accountNo
        }}</a>
      </ng-template>

      <ng-template appCellTemplate="fullname" let-client>
        <a class="clickable-link" [routerLink]="['/clients/view', client.id]">
          {{ client.fullname || client.displayName }}
        </a>
      </ng-template>

      <ng-template appCellTemplate="actions" let-client>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          title="Edit Client Details"
          (click)="onEditClient(client)"
          *appHasPermission="'UPDATE_CLIENT'"
        >
          <ion-icon name="create-outline"></ion-icon>
        </ion-button>
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
      .clickable-link {
        color: #3f51b5;
        font-weight: 500;
        cursor: pointer;
        text-decoration: none;
      }
      .clickable-link:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class ClientsListComponent {
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  /** Re-runs the query behind the table when the user asks to try again. */
  private readonly retrySubject = new Subject<void>();

  private readonly clientService = inject(ClientService);
  private readonly router = inject(Router);

  columns: ColumnDef[] = [
    { key: 'accountNo', label: 'CLIENTS.ACCOUNT_NO', sortable: true },
    { key: 'fullname', label: 'COMMON.NAME', sortable: true },
    { key: 'status', label: 'COMMON.STATUS', sortable: true },
    { key: 'officeName', label: 'COMMON.OFFICE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly clients = signal<GetClientsPageItemsResponse[]>([]);
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

          const displayName = this.currentFilter ? `%${this.currentFilter}%` : undefined;
          // Fineract's /clients endpoint rejects `status=` and `status=All` outright (a 400,
          // "The Status value '...' is not supported") — the param must be omitted entirely
          // to mean "any status", so the "All" sentinel is never forwarded as-is.
          const status = this.activeFilters.status || undefined;

          return this.clientService
            .getClients(
              undefined,
              undefined,
              displayName,
              undefined,
              undefined,
              status,
              undefined,
              offset,
              limit,
              orderBy,
              sortOrder,
              false,
              1,
            )
            .pipe(
              tap(() => this.hasError.set(false)),
              catchError(() => {
                this.hasError.set(true);
                return of(null);
              }),
            );
        }),
        map((response) => {
          if (response === null) return [];
          this.totalRecords.set(response.totalFilteredRecords || 0);
          return response.pageItems || [];
        }),
      )
      .subscribe((data) => {
        this.clients.set(data);
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

  onCreateClient() {
    this.router.navigate(['/clients/create']);
  }

  onEditClient(client: GetClientsPageItemsResponse) {
    this.router.navigate(['/clients/edit', client.id]);
  }

  onViewClient(client: GetClientsPageItemsResponse) {
    this.router.navigate(['/clients/view', client.id]);
  }

  onRetry(): void {
    this.retrySubject.next();
  }
}
