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

import { Component, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/adapters';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterModule } from '@angular/router';
import { Subject, merge, of } from 'rxjs';
import { catchError, finalize, map, startWith, switchMap, tap } from 'rxjs/operators';
import {
  StatusBadgeComponent,
  DataTableComponent,
  CellTemplateDirective,
  ColumnDef,
  HasPermissionDirective,
} from '../../shared';
import {
  ClientService,
  ClientSearchV2Service,
  GetClientsPageItemsResponse,
  SortOrder,
} from '../../api';
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
  ],
  template: `
    <app-data-table
      [hasError]="hasError()"
      [isLoading]="isLoading()"
      [searchPlaceholder]="searchPlaceholder()"
      [pageSize]="pageSize()"
      (retry)="onRetry()"
      title="MODULES.CLIENTS_CONTRACTS"
      helpTextKey="HELP.CLIENTS_CONTRACTS_DESC"
      [columns]="columns()"
      [sortState]="currentSort()"
      [data]="clients()"
      [totalRecords]="totalRecords()"
      [exactTotal]="exactTotal()"
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
          <ion-label position="stacked">{{ 'COMMON.STATUS' | appTranslate }}</ion-label>
          <ion-select
            [attr.aria-label]="'COMMON.STATUS' | appTranslate"
            interface="popover"
            [(ngModel)]="activeFilters.status"
            (ionChange)="onFilterChange()"
          >
            <ion-select-option value="">{{ 'COMMON.ALL' | appTranslate }}</ion-select-option>
            <ion-select-option value="active">{{
              'COMMON.ACTIVE' | appTranslate
            }}</ion-select-option>
            <ion-select-option value="pending">{{
              'COMMON.PENDING' | appTranslate
            }}</ion-select-option>
            <ion-select-option value="closed">{{
              'COMMON.CLOSED' | appTranslate
            }}</ion-select-option>
          </ion-select>
        </ion-item>
        @if (activeFilters.status) {
          <p class="search-hint">{{ 'CLIENTS.NAME_SEARCH_HINT' | appTranslate }}</p>
        }
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
          [attr.aria-label]="'COMMON.EDIT' | appTranslate"
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
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        margin-left: 16px;
      }
      .search-hint {
        margin: 0;
        color: var(--text-secondary);
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
  readonly isLoading = signal(false);
  readonly pageSize = signal(10);
  readonly searchPlaceholder = signal('COMMON.SEARCH_PLACEHOLDER');

  /** Re-runs the query behind the table when the user asks to try again. */
  private readonly retrySubject = new Subject<void>();

  private readonly clientService = inject(ClientService);
  private readonly clientSearchService = inject(ClientSearchV2Service);
  private readonly router = inject(Router);

  private readonly broadTextSearch = signal(false);
  readonly columns = computed<ColumnDef[]>(() => [
    { key: 'accountNo', label: 'CLIENTS.ACCOUNT_NO', sortable: true },
    { key: 'fullname', label: 'COMMON.NAME', sortable: true },
    { key: 'status', label: 'COMMON.STATUS', sortable: true },
    { key: 'officeName', label: 'COMMON.OFFICE', sortable: !this.broadTextSearch() },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ]);

  readonly clients = signal<GetClientsPageItemsResponse[]>([]);
  readonly totalRecords = signal(0);
  readonly exactTotal = signal(true);

  // Empty string, not `undefined`, so it round-trips through `<ion-select>`'s ngModel
  // binding as a real match for the "All" option's own `value=""` rather than leaving the
  // select showing nothing selected.
  activeFilters: { status?: string } = { status: '' };

  private searchSubject = new Subject<string>();
  private sortSubject = new Subject<SortEvent>();
  private pageSubject = new Subject<PageEvent>();
  private filterSubject = new Subject<void>();

  private currentFilter = '';
  readonly currentSort = signal<SortEvent>({ active: '', direction: '' });
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
          this.isLoading.set(true);
          return this.loadClients().pipe(
            tap(() => this.hasError.set(false)),
            catchError(() => {
              this.hasError.set(true);
              return of({ totalFilteredRecords: 0, pageItems: [] });
            }),
            finalize(() => this.isLoading.set(false)),
          );
        }),
        map((response) => {
          this.totalRecords.set(response.totalFilteredRecords || 0);
          return response.pageItems || [];
        }),
        takeUntilDestroyed(),
      )
      .subscribe((data) => {
        this.clients.set(data);
      });
  }

  private usesNameSearch(): boolean {
    // The v2 endpoint searches multiple fields but cannot filter by status or sort
    // by the joined office name. Keep these existing v1 capabilities in this table.
    return (
      !!this.activeFilters.status ||
      (!this.currentFilter &&
        this.currentSort().active === 'officeName' &&
        !!this.currentSort().direction)
    );
  }

  private updateSearchPlaceholder(): void {
    this.broadTextSearch.set(!!this.currentFilter && !this.activeFilters.status);
    if (this.broadTextSearch() && this.currentSort().active === 'officeName') {
      this.currentSort.set({ active: '', direction: '' });
    }
    this.searchPlaceholder.set(
      this.usesNameSearch() ? 'CLIENTS.SEARCH_BY_NAME' : 'COMMON.SEARCH_PLACEHOLDER',
    );
  }

  private loadClients() {
    const nameSearch = this.usesNameSearch();
    this.exactTotal.set(!nameSearch);
    if (nameSearch) {
      return this.clientService.getClients(
        undefined,
        undefined,
        this.currentFilter ? `%${this.currentFilter}%` : undefined,
        undefined,
        undefined,
        this.activeFilters.status || undefined,
        undefined,
        this.currentPage.pageIndex * this.currentPage.pageSize,
        this.currentPage.pageSize,
        this.currentSort().active || undefined,
        this.currentSort().direction ? this.currentSort().direction.toUpperCase() : undefined,
        false,
        1,
      );
    }

    const sortProperties: Record<string, string> = {
      accountNo: 'accountNumber',
      fullname: 'displayName',
      status: 'status',
    };
    const property = sortProperties[this.currentSort().active];
    const sorts: SortOrder[] =
      property && this.currentSort().direction
        ? [{ property, direction: this.currentSort().direction === 'asc' ? 'ASC' : 'DESC' }]
        : [];
    return this.clientSearchService
      .postClientsSearch({
        request: { text: this.currentFilter },
        page: this.currentPage.pageIndex,
        size: this.currentPage.pageSize,
        ...(sorts.length ? { sorts } : {}),
      })
      .pipe(
        map((response) => ({
          totalFilteredRecords: response.totalElements ?? 0,
          pageItems: (response.content ?? []).map((client): GetClientsPageItemsResponse => ({
            id: client.id,
            accountNo: client.accountNumber,
            displayName: client.displayName,
            officeId: client.officeId,
            officeName: client.officeName,
            status: client.status,
          })),
        })),
      );
  }

  onSearch(filterValue: string) {
    this.currentFilter = filterValue.trim();
    this.updateSearchPlaceholder();
    this.currentPage.pageIndex = 0;
    this.pageIndex.set(0);
    this.searchSubject.next(filterValue);
  }

  onSort(sort: SortEvent) {
    this.currentSort.set(sort);
    this.updateSearchPlaceholder();
    this.currentPage.pageIndex = 0;
    this.pageIndex.set(0);
    this.sortSubject.next(sort);
  }

  onPage(event: PageEvent) {
    this.currentPage = event;
    this.pageSize.set(event.pageSize);
    this.pageIndex.set(event.pageIndex);
    this.pageSubject.next(event);
  }

  onFilterChange() {
    this.updateSearchPlaceholder();
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
