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
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { Subject, merge, of } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../shared';
import { JournalEntriesService, JournalEntryTransactionItem } from '../../api';
import { PageEvent, SortEvent } from '../../shared/models/table.model';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '../../core/adapters';

/**
 * Component for listing accounting journal entries.
 *
 * Provides a paginated and sortable view of all ledger transactions.
 */
@Component({
  selector: 'app-journal-entries-list',
  standalone: true,
  imports: [
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    DatePipe,
    DecimalPipe,
    NgClass,
    TranslatePipe,
    IonButton,
    IonIcon,
  ],
  template: `
    <app-data-table
      [hasError]="hasError()"
      (retry)="onRetry()"
      title="nav.journalEntries"
      helpTextKey="HELP.JOURNAL_ENTRIES_DESC"
      createButtonLabel="JOURNAL_ENTRIES.CREATE"
      createPermission="CREATE_JOURNALENTRY"
      [columns]="columns"
      [data]="entries()"
      [totalRecords]="totalRecords"
      (create)="onCreateEntry()"
      (sortChange)="onSort($event)"
      [pageIndex]="pageIndex()"
      (pageChange)="onPage($event)"
      (searchChange)="onSearch($event)"
    >
      <ng-template appCellTemplate="transactionDate" let-entry>
        {{ entry.transactionDate | date: 'mediumDate' }}
      </ng-template>

      <ng-template appCellTemplate="entryType" let-entry>
        <span [ngClass]="entry.entryType?.value?.toLowerCase()">
          {{ entry.entryType?.value }}
        </span>
      </ng-template>

      <ng-template appCellTemplate="amount" let-entry>
        {{ entry.amount | number: '1.2-2' }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-entry>
        <ion-button
          fill="clear"
          data-testid="journal-entry-view"
          [title]="'COMMON.VIEW' | appTranslate"
          [attr.aria-label]="'COMMON.VIEW' | appTranslate"
          (click)="onViewEntry(entry)"
        >
          <ion-icon name="eye-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .debit {
        color: #388e3c;
        font-weight: bold;
      }
      .credit {
        color: #c2185b;
        font-weight: bold;
      }
    `,
  ],
})
export class JournalEntriesListComponent {
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  /** Re-runs the query behind the table when the user asks to try again. */
  private readonly retrySubject = new Subject<void>();

  private readonly journalService = inject(JournalEntriesService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'transactionDate', label: 'Transaction Date', sortable: true },
    { key: 'transactionId', label: 'Transaction ID', sortable: true },
    { key: 'glAccountName', label: 'Ledger Account', sortable: true },
    { key: 'entryType', label: 'Type', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true },
    { key: 'actions', label: 'Actions', sortable: false },
  ];

  readonly entries = signal<JournalEntryTransactionItem[]>([]);
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
          const transactionId = this.currentFilter || undefined;

          return this.journalService
            .getJournalentries(
              undefined, // officeId
              undefined, // glAccountId
              undefined, // manualEntriesOnly
              undefined, // fromDate
              undefined, // toDate
              undefined, // submittedOnDateFrom
              undefined, // submittedOnDateTo
              transactionId,
              undefined, // entityType
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
          return response.pageItems || [];
        }),
      )
      .subscribe((data) => {
        this.entries.set(data);
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

  onViewEntry(entry: JournalEntryTransactionItem) {
    void this.router.navigate(['/accounting/journal-entries/view', entry.id]);
  }

  onCreateEntry() {
    this.router.navigate(['/accounting/journal-entries/create']);
  }

  onRetry(): void {
    this.retrySubject.next();
  }
}
