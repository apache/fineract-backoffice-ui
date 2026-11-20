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
import { FormsModule } from '@angular/forms';
import { Subject, merge, of } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';
import {
  DataTableComponent,
  ColumnDef,
  CellTemplateDirective,
  StatusBadgeComponent,
} from '../../../shared';
import { DateTimePipe } from '../../../shared/pipes/date-time.pipe';
import { PageEvent, SortEvent } from '../../../shared/models/table.model';
import {
  AUDIT_API,
  DOWNLOAD,
  I18N,
  TranslatePipe,
  type AuditEntry,
  type AuditSearchTemplate,
} from '../../../core/adapters';
import { toCsv } from '../../../core/utils/csv';
import {
  IonAccordion,
  IonAccordionGroup,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
} from '@ionic/angular/standalone';
import { ButtonComponent } from '../../../ui/button/button.component';
import { DateFieldComponent } from '../../../ui/date-field/date-field.component';
import {
  SearchableSelectComponent,
  type SearchableSelectOption,
} from '../../../ui/searchable-select/searchable-select.component';
import { emptyAuditFilters, toAuditQuery, type AuditFilters } from './audit-query';

const EMPTY_TEMPLATE: AuditSearchTemplate = {
  users: [],
  actionNames: [],
  entityNames: [],
  statuses: [],
};

@Component({
  selector: 'app-audit-logs-list',
  standalone: true,
  imports: [
    TranslatePipe,
    FormsModule,
    DataTableComponent,
    CellTemplateDirective,
    DateTimePipe,
    StatusBadgeComponent,
    ButtonComponent,
    DateFieldComponent,
    SearchableSelectComponent,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonAccordion,
    IonAccordionGroup,
  ],
  template: `
    <div class="audit-logs-container">
      <ion-accordion-group class="filter-panel">
        <ion-accordion value="filters">
          <ion-item slot="header">
            <ion-icon slot="start" name="filter-outline"></ion-icon>
            <ion-label>{{ 'COMMON.FILTERS' | appTranslate }}</ion-label>
          </ion-item>
          <div slot="content">
            <div class="filter-grid">
              <div class="select-field">
                <span class="select-label">{{ 'COMMON.MAKER' | appTranslate }}</span>
                <app-searchable-select
                  name="makerId"
                  testId="audit-filter-maker"
                  [ariaLabel]="'COMMON.MAKER' | appTranslate"
                  [options]="userOptions()"
                  [(ngModel)]="activeFilters.makerId"
                />
              </div>

              <div class="select-field">
                <span class="select-label">{{ 'COMMON.CHECKER' | appTranslate }}</span>
                <app-searchable-select
                  name="checkerId"
                  testId="audit-filter-checker"
                  [ariaLabel]="'COMMON.CHECKER' | appTranslate"
                  [options]="userOptions()"
                  [(ngModel)]="activeFilters.checkerId"
                />
              </div>

              <div class="select-field">
                <span class="select-label">{{ 'SECURITY.ACTION_NAME' | appTranslate }}</span>
                <app-searchable-select
                  name="actionName"
                  testId="audit-filter-action"
                  [ariaLabel]="'SECURITY.ACTION_NAME' | appTranslate"
                  [options]="actionOptions()"
                  [(ngModel)]="activeFilters.actionName"
                />
              </div>

              <div class="select-field">
                <span class="select-label">{{ 'SECURITY.ENTITY_NAME' | appTranslate }}</span>
                <app-searchable-select
                  name="entityName"
                  testId="audit-filter-entity"
                  [ariaLabel]="'SECURITY.ENTITY_NAME' | appTranslate"
                  [options]="entityOptions()"
                  [(ngModel)]="activeFilters.entityName"
                />
              </div>

              <div class="select-field">
                <span class="select-label">{{ 'SECURITY.PROCESSING_RESULT' | appTranslate }}</span>
                <app-searchable-select
                  name="statusId"
                  testId="audit-filter-status"
                  [ariaLabel]="'SECURITY.PROCESSING_RESULT' | appTranslate"
                  [options]="statusOptions()"
                  [(ngModel)]="activeFilters.statusId"
                />
              </div>

              <app-date-field
                name="madeFrom"
                label="SECURITY.MAKER_DATE_FROM"
                pickerId="audit-made-from-picker"
                [clearable]="true"
                [(ngModel)]="activeFilters.madeFrom"
              ></app-date-field>

              <app-date-field
                name="madeTo"
                label="SECURITY.MAKER_DATE_TO"
                pickerId="audit-made-to-picker"
                [clearable]="true"
                [(ngModel)]="activeFilters.madeTo"
              ></app-date-field>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'SECURITY.RESOURCE_ID' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'SECURITY.RESOURCE_ID' | appTranslate"
                  data-testid="audit-filter-resource-id"
                  type="number"
                  [(ngModel)]="activeFilters.resourceId"
                  (keyup.enter)="onApplyFilters()"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'AUDIT.CLIENT_ID' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'AUDIT.CLIENT_ID' | appTranslate"
                  data-testid="audit-filter-client-id"
                  type="number"
                  [(ngModel)]="activeFilters.clientId"
                  (keyup.enter)="onApplyFilters()"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'AUDIT.LOAN_ID' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'AUDIT.LOAN_ID' | appTranslate"
                  data-testid="audit-filter-loan-id"
                  type="number"
                  [(ngModel)]="activeFilters.loanId"
                  (keyup.enter)="onApplyFilters()"
                ></ion-input>
              </ion-item>
            </div>

            <div class="filter-actions">
              <app-button
                type="button"
                intent="danger"
                emphasis="quiet"
                data-testid="audit-filter-reset"
                (click)="onResetFilters()"
                >{{ 'COMMON.RESET' | appTranslate }}</app-button
              >
              <app-button
                type="button"
                data-testid="audit-filter-apply"
                (click)="onApplyFilters()"
                >{{ 'COMMON.APPLY' | appTranslate }}</app-button
              >
            </div>
          </div>
        </ion-accordion>
      </ion-accordion-group>

      <app-data-table
        [hasError]="hasError()"
        (retry)="onRetry()"
        title="SECURITY.AUDIT_LOGS"
        [columns]="columns()"
        [data]="visibleLogs()"
        [totalRecords]="totalRecords()"
        [exactTotal]="false"
        [pageSize]="pageSize()"
        [pageIndex]="pageIndex()"
        [isLoading]="isLoading()"
        (searchChange)="onSearch($event)"
        (pageChange)="onPage($event)"
        (sortChange)="onSort($event)"
      >
        <app-button
          headerActions
          type="button"
          emphasis="outline"
          icon="download-outline"
          [disabled]="auditLogs().length === 0"
          (click)="onExportCsv()"
          >{{ 'COMMON.EXPORT_CSV' | appTranslate }}</app-button
        >

        <ng-template appCellTemplate="madeOnDate" let-row>
          {{ row['madeOnDate'] | dateTime }}
        </ng-template>

        <ng-template appCellTemplate="checkedOnDate" let-row>
          {{ row['checkedOnDate'] | dateTime }}
        </ng-template>

        <ng-template appCellTemplate="processingResult" let-row>
          <app-status-badge [status]="row['processingResult']"></app-status-badge>
        </ng-template>

        <ng-template appCellTemplate="actions" let-row>
          <app-button
            type="button"
            emphasis="quiet"
            icon="eye-outline"
            [attr.data-testid]="'audit-open-' + row['id']"
            [link]="['/security/audits', row['id']]"
            [label]="'COMMON.VIEW_DETAILS' | appTranslate"
          ></app-button>
        </ng-template>
      </app-data-table>
    </div>
  `,
  styles: [
    `
      .audit-logs-container {
        padding: 16px;
      }
      .filter-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 8px 0;
      }
      .filter-panel {
        margin: 0 0 var(--space-4);
      }
      .filter-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
        padding-top: 16px;
      }
      .select-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .select-label {
        font-size: 0.75rem;
        color: var(--ion-color-medium-shade, #808289);
      }
    `,
  ],
})
export class AuditLogsListComponent implements OnInit {
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  /** Re-runs the query behind the table when the user asks to try again. */
  private readonly retrySubject = new Subject<void>();

  private readonly audits = inject(AUDIT_API);
  private readonly download = inject(DOWNLOAD);
  private readonly i18n = inject(I18N);

  private static readonly CHECKER_COLUMNS = ['checker', 'checkedOnDate'];

  private readonly allColumns: ColumnDef[] = [
    { key: 'id', label: 'COMMON.ID', sortable: true },
    { key: 'resourceId', label: 'SECURITY.RESOURCE_ID', sortable: true },
    { key: 'entityName', label: 'COMMON.ENTITY', sortable: true },
    { key: 'actionName', label: 'COMMON.ACTION', sortable: true },
    { key: 'maker', label: 'COMMON.MAKER', sortable: true },
    { key: 'madeOnDate', label: 'COMMON.DATE', sortable: true },
    { key: 'checker', label: 'COMMON.CHECKER', sortable: true },
    { key: 'checkedOnDate', label: 'COMMON.CHECKED_DATE', sortable: true },
    { key: 'processingResult', label: 'INLINE_JOB.RESULT', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS' },
  ];

  readonly auditLogs = signal<AuditEntry[]>([]);

  /** The choices Fineract publishes for each filter; empty until the template loads. */
  readonly searchTemplate = signal<AuditSearchTemplate>(EMPTY_TEMPLATE);

  readonly userOptions = computed(() =>
    this.withAny(this.searchTemplate().users.map((u) => ({ value: u.id, label: u.username }))),
  );
  readonly actionOptions = computed(() =>
    this.withAny(this.searchTemplate().actionNames.map((name) => ({ value: name, label: name }))),
  );
  readonly entityOptions = computed(() =>
    this.withAny(this.searchTemplate().entityNames.map((name) => ({ value: name, label: name }))),
  );
  readonly statusOptions = computed(() =>
    this.withAny(this.searchTemplate().statuses.map((s) => ({ value: s.id, label: s.name }))),
  );

  /** Free-text search, applied to the rows of the page that is currently loaded. */
  private readonly searchText = signal('');

  /**
   * The rows on screen: the loaded page narrowed by the search box.
   *
   * The audits endpoint has no free-text parameter — only the structured filters above — so this
   * matches against every visible field of the loaded page rather than querying the server.
   */
  readonly visibleLogs = computed(() => {
    const needle = this.searchText();
    const rows = this.auditLogs();
    if (!needle) return rows;
    return rows.filter((row) =>
      this.allColumns.some((col) => {
        const value = row[col.key as keyof AuditEntry];
        return value != null && String(value).toLowerCase().includes(needle);
      }),
    );
  });

  /**
   * Checker and Checked Date are only meaningful when maker-checker is in use. With it off,
   * no entry is ever checked and the pair would be two permanently blank columns, so they are
   * left out unless at least one loaded row has a checker.
   */
  readonly columns = computed<ColumnDef[]>(() => {
    const anyChecked = this.auditLogs().some((row) => !!row.checker || !!row.checkedOnDate);
    return anyChecked
      ? this.allColumns
      : this.allColumns.filter((col) => !AuditLogsListComponent.CHECKER_COLUMNS.includes(col.key));
  });
  readonly totalRecords = signal<number>(0);
  readonly isLoading = signal<boolean>(false);
  readonly pageSize = signal<number>(10);
  readonly pageIndex = signal<number>(0);

  activeFilters: AuditFilters = emptyAuditFilters();

  /** The filters behind the rows on screen. Paging and sorting reuse them, not the edited form. */
  private appliedFilters: AuditFilters = emptyAuditFilters();

  private sortSubject = new Subject<SortEvent>();
  private pageSubject = new Subject<PageEvent>();
  private filterSubject = new Subject<void>();

  private currentSort: SortEvent = { active: 'id', direction: 'desc' };

  ngOnInit(): void {
    // Without the template the selects offer only "Any"; the list itself still loads.
    this.audits
      .searchTemplate()
      .pipe(catchError(() => of(EMPTY_TEMPLATE)))
      .subscribe((template) => this.searchTemplate.set(template));

    merge(this.sortSubject, this.pageSubject, this.filterSubject, this.retrySubject)
      .pipe(
        startWith({}),
        switchMap(() => {
          this.isLoading.set(true);
          const query = toAuditQuery(
            this.appliedFilters,
            { pageIndex: this.pageIndex(), pageSize: this.pageSize() },
            this.currentSort,
          );
          return this.audits.list(query).pipe(
            tap(() => this.hasError.set(false)),
            catchError(() => {
              this.hasError.set(true);
              return of(null);
            }),
          );
        }),
        map((page) => {
          this.isLoading.set(false);
          if (page === null) return [];

          const limit = this.pageSize();
          const offset = this.pageIndex() * limit;
          const items = page.items;

          // If we received exactly 'limit' items, assume there might be more.
          // Some Fineract versions return totalFilteredRecords as the same as current page size.
          const total =
            items.length === limit
              ? offset + limit + 1
              : page.totalFilteredRecords || offset + items.length;

          this.totalRecords.set(total);
          return [...items];
        }),
      )
      .subscribe((data) => {
        this.auditLogs.set(data);
      });
  }

  onApplyFilters(): void {
    this.appliedFilters = { ...this.activeFilters };
    this.pageIndex.set(0);
    this.filterSubject.next();
  }

  onResetFilters(): void {
    this.activeFilters = emptyAuditFilters();
    this.onApplyFilters();
  }

  onSearch(value: string): void {
    this.searchText.set(value.trim().toLowerCase());
  }

  onPage(event: PageEvent): void {
    this.pageSize.set(event.pageSize);
    this.pageIndex.set(event.pageIndex);
    this.pageSubject.next(event);
  }

  onSort(sort: SortEvent): void {
    this.currentSort = sort;
    this.pageIndex.set(0);
    this.sortSubject.next(sort);
  }

  onRetry(): void {
    this.retrySubject.next();
  }

  /** Exports the currently-loaded page — matches what the table shows, not the full result set. */
  onExportCsv(): void {
    const exportColumns = this.columns().filter((c) => c.key !== 'actions');
    const csv = toCsv(exportColumns, this.auditLogs());
    this.download.saveText(csv, 'audit-logs.csv', 'text/csv');
  }

  /**
   * Every select starts with "Any", which clears that filter. Reads the language signal so the
   * option lists re-translate when the user switches language.
   */
  private withAny(options: SearchableSelectOption[]): SearchableSelectOption[] {
    this.i18n.currentLang();
    return [{ value: '', label: this.i18n.translate('AUDIT.ANY') }, ...options];
  }
}
