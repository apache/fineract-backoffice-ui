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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { Subject, merge, of } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../shared';
import {
  GeneralLedgerAccountService,
  GetGLAccountsResponse,
  GetOfficesResponse,
  JournalEntriesService,
  JournalEntryTransactionItem,
  OfficesService,
} from '../../api';
import { PageEvent, SortEvent } from '../../shared/models/table.model';
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '../../core/adapters';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatDateToFineract,
} from '../../core/utils/date-formatter';
import { createPickersReady } from '../../shared/utils/pickers-ready';

interface JournalEntryFilters {
  officeId?: number;
  glAccountId?: number;
  manualEntriesOnly: '' | 'true' | 'false';
  fromDate: Date | null;
  toDate: Date | null;
}

function defaultFilters(): JournalEntryFilters {
  return {
    officeId: undefined,
    glAccountId: undefined,
    manualEntriesOnly: '',
    fromDate: null,
    toDate: null,
  };
}

/**
 * Component for listing accounting journal entries.
 *
 * Provides a paginated and sortable view of all ledger transactions.
 */
@Component({
  selector: 'app-journal-entries-list',
  standalone: true,
  imports: [
    FormsModule,
    DataTableComponent,
    CellTemplateDirective,
    DatePipe,
    DecimalPipe,
    NgClass,
    TranslatePipe,
    IonButton,
    IonIcon,
    IonAccordion,
    IonAccordionGroup,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <div class="journal-entries-container">
      <ion-accordion-group class="filter-panel">
        <ion-accordion value="filters">
          <ion-item slot="header">
            <ion-icon slot="start" name="filter-outline"></ion-icon>
            <ion-label>{{ 'COMMON.FILTERS' | appTranslate }}</ion-label>
          </ion-item>
          <div slot="content">
            <div class="filter-grid">
              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.OFFICE' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'COMMON.OFFICE' | appTranslate"
                  interface="popover"
                  [(ngModel)]="activeFilters.officeId"
                >
                  <ion-select-option [value]="undefined">{{
                    'JOURNAL_ENTRIES.ALL_OFFICES' | appTranslate
                  }}</ion-select-option>
                  @for (office of offices(); track office.id) {
                    <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'JOURNAL_ENTRIES.GL_ACCOUNT' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'JOURNAL_ENTRIES.GL_ACCOUNT' | appTranslate"
                  interface="popover"
                  [(ngModel)]="activeFilters.glAccountId"
                >
                  <ion-select-option [value]="undefined">{{
                    'JOURNAL_ENTRIES.ALL_ACCOUNTS' | appTranslate
                  }}</ion-select-option>
                  @for (account of glAccounts(); track account.id) {
                    <ion-select-option [value]="account.id">{{ account.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'JOURNAL_ENTRIES.MANUAL_ENTRIES_ONLY' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'JOURNAL_ENTRIES.MANUAL_ENTRIES_ONLY' | appTranslate"
                  interface="popover"
                  [(ngModel)]="activeFilters.manualEntriesOnly"
                >
                  <ion-select-option value="">{{
                    'JOURNAL_ENTRIES.ALL_ENTRIES' | appTranslate
                  }}</ion-select-option>
                  <ion-select-option value="true">{{
                    'JOURNAL_ENTRIES.MANUAL_ENTRIES' | appTranslate
                  }}</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.FROM_DATE' | appTranslate }}</ion-label>
                @if (pickersReady()) {
                  <ion-datetime-button datetime="journal-fromDate-picker" />
                }
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="journal-fromDate-picker"
                      data-testid="journal-fromDate-picker"
                      presentation="date"
                      [(ngModel)]="activeFilters.fromDate"
                    />
                  </ng-template>
                </ion-modal>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.TO_DATE' | appTranslate }}</ion-label>
                @if (pickersReady()) {
                  <ion-datetime-button datetime="journal-toDate-picker" />
                }
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="journal-toDate-picker"
                      data-testid="journal-toDate-picker"
                      presentation="date"
                      [(ngModel)]="activeFilters.toDate"
                    />
                  </ng-template>
                </ion-modal>
              </ion-item>
            </div>

            <div class="filter-actions">
              <ion-button fill="clear" color="danger" (click)="onResetFilters()">
                {{ 'COMMON.RESET' | appTranslate }}
              </ion-button>
              <ion-button color="primary" (click)="onApplyFilters()">
                {{ 'COMMON.APPLY' | appTranslate }}
              </ion-button>
            </div>
          </div>
        </ion-accordion>
      </ion-accordion-group>

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
    </div>
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
      .filter-panel {
        margin-bottom: 16px;
      }
      .filter-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
        padding-top: 16px;
      }
      .filter-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 8px 0;
      }
    `,
  ],
})
export class JournalEntriesListComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  /** Re-runs the query behind the table when the user asks to try again. */
  private readonly retrySubject = new Subject<void>();

  private readonly journalService = inject(JournalEntriesService);
  private readonly officesService = inject(OfficesService);
  private readonly glAccountService = inject(GeneralLedgerAccountService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'id', label: 'COMMON.ID', sortable: true },
    { key: 'transactionDate', label: 'JOURNAL_ENTRIES.TRANSACTION_DATE', sortable: true },
    { key: 'transactionId', label: 'LOANS.TRANSACTION_ID', sortable: true },
    { key: 'glAccountName', label: 'JOURNAL_ENTRIES.LEDGER_ACCOUNT', sortable: true },
    { key: 'entryType', label: 'COMMON.TYPE', sortable: true },
    { key: 'amount', label: 'COMMON.AMOUNT', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly entries = signal<JournalEntryTransactionItem[]>([]);
  readonly offices = signal<GetOfficesResponse[]>([]);
  readonly glAccounts = signal<GetGLAccountsResponse[]>([]);
  totalRecords = 0;

  activeFilters: JournalEntryFilters = defaultFilters();

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
          const transactionId = this.currentFilter || undefined;
          const { officeId, glAccountId, manualEntriesOnly, fromDate, toDate } = this.activeFilters;
          // The generated client types `fromDate`/`toDate` as `object` — a generator artifact
          // from an ambiguous OpenAPI date schema — but the endpoint's own documented example
          // (`fromDate=1 July 2013&dateFormat=dd MMMM yyyy`) shows it wants the same Fineract
          // date string every other dated command in this codebase sends.
          const asFineractDate = (date: Date | null): object | undefined =>
            date ? (formatDateToFineract(date) as unknown as object) : undefined;

          return this.journalService
            .getJournalentries(
              officeId,
              glAccountId,
              manualEntriesOnly === '' ? undefined : manualEntriesOnly === 'true',
              asFineractDate(fromDate),
              asFineractDate(toDate),
              undefined, // submittedOnDateFrom
              undefined, // submittedOnDateTo
              transactionId,
              undefined, // entityType
              offset,
              limit,
              orderBy,
              sortOrder,
              FINERACT_LOCALE,
              FINERACT_DATE_FORMAT,
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

  ngOnInit(): void {
    this.officesService.getOffices().subscribe((data) => this.offices.set(data));
    this.glAccountService.getGlaccounts().subscribe((data) => this.glAccounts.set(data));
  }

  onSearch(filterValue: string) {
    this.currentFilter = filterValue;
    this.currentPage.pageIndex = 0;
    this.pageIndex.set(0);
    this.searchSubject.next(filterValue);
  }

  onApplyFilters(): void {
    this.currentPage.pageIndex = 0;
    this.pageIndex.set(0);
    this.filterSubject.next();
  }

  onResetFilters(): void {
    this.activeFilters = defaultFilters();
    this.onApplyFilters();
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
