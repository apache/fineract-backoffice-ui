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

import { Router, RouterModule } from '@angular/router';
import { Subject, merge, of } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';
import {
  StatusBadgeComponent,
  DataTableComponent,
  CellTemplateDirective,
  ColumnDef,
} from '../../shared';
import { GroupsService, GetGroupsPageItems } from '../../api';
import { PageEvent, SortEvent } from '../../shared/models/table.model';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '../../core/adapters';

@Component({
  selector: 'app-groups-list',
  standalone: true,
  imports: [
    RouterModule,
    TranslatePipe,
    StatusBadgeComponent,
    DataTableComponent,
    CellTemplateDirective,
    IonIcon,
    IonButton,
  ],
  template: `
    <app-data-table
      [hasError]="hasError()"
      (retry)="onRetry()"
      title="nav.groups"
      helpTextKey="HELP.GROUPS_DESC"
      createButtonLabel="GROUPS.CREATE_GROUP"
      createPermission="CREATE_GROUP"
      [columns]="columns"
      [data]="groups()"
      [totalRecords]="totalRecords"
      (create)="onCreateGroup()"
      (searchChange)="onSearch($event)"
      (sortChange)="onSort($event)"
      [pageIndex]="pageIndex()"
      (pageChange)="onPage($event)"
    >
      <ng-template appCellTemplate="name" let-group>
        <a [routerLink]="['/groups/view', group.id]" data-testid="group-name-link">
          {{ group.name }}
        </a>
      </ng-template>

      <ng-template appCellTemplate="status" let-group>
        <app-status-badge [status]="group.status?.value"></app-status-badge>
      </ng-template>

      <ng-template appCellTemplate="actions" let-group>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.VIEW' | appTranslate"
          [attr.data-testid]="'group-view-' + group.id"
          [title]="'COMMON.VIEW' | appTranslate"
          (click)="onViewGroup(group)"
        >
          <ion-icon name="eye-outline"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | appTranslate"
          [title]="'COMMON.EDIT' | appTranslate"
          (click)="onEditGroup(group)"
        >
          <ion-icon name="create-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class GroupsListComponent {
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  /** Re-runs the query behind the table when the user asks to try again. */
  private readonly retrySubject = new Subject<void>();

  private readonly groupsService = inject(GroupsService);
  private readonly router = inject(Router);

  columns: ColumnDef[] = [
    { key: 'accountNo', label: 'COMMON.ACCOUNT_NO', sortable: true },
    { key: 'name', label: 'COMMON.NAME', sortable: true },
    { key: 'status', label: 'COMMON.STATUS', sortable: true },
    { key: 'officeName', label: 'COMMON.OFFICE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly groups = signal<GetGroupsPageItems[]>([]);
  totalRecords = 0;

  private searchSubject = new Subject<string>();
  private sortSubject = new Subject<SortEvent>();
  private pageSubject = new Subject<PageEvent>();

  private currentFilter = '';
  private currentSort: SortEvent = { active: '', direction: '' };
  private currentPage: PageEvent = { pageIndex: 0, pageSize: 10, length: 0 };
  /** Mirrors currentPage.pageIndex for the data-table, so resetting to the
      first page on search/sort/filter actually moves the paginator. */
  readonly pageIndex = signal(0);

  constructor() {
    merge(this.searchSubject, this.sortSubject, this.pageSubject, this.retrySubject)
      .pipe(
        startWith({}),
        switchMap(() => {
          const offset = this.currentPage.pageIndex * this.currentPage.pageSize;
          const limit = this.currentPage.pageSize;
          const orderBy = this.currentSort.active || undefined;
          const sortOrder = this.currentSort.direction
            ? this.currentSort.direction.toUpperCase()
            : undefined;

          const nameFilter = this.currentFilter || undefined;

          // Signature: officeId, staffId, externalId, name, underHierarchy, paged, offset, limit, orderBy, sortOrder, orphansOnly
          return this.groupsService
            .getGroups(
              undefined,
              undefined,
              undefined,
              nameFilter,
              undefined,
              true,
              offset,
              limit,
              orderBy,
              sortOrder,
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
          this.totalRecords = response.totalFilteredRecords || 0;
          return response.pageItems ? Array.from(response.pageItems) : [];
        }),
      )
      .subscribe((data) => {
        this.groups.set(data);
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

  onCreateGroup() {
    this.router.navigate(['/groups/create']);
  }

  onEditGroup(group: GetGroupsPageItems) {
    this.router.navigate(['/groups/edit', group.id]);
  }

  onViewGroup(group: GetGroupsPageItems) {
    this.router.navigate(['/groups/view', group.id]);
  }

  onRetry(): void {
    this.retrySubject.next();
  }
}
