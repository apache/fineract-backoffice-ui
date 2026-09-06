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

import {
  Component,
  TemplateRef,
  computed,
  contentChildren,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { CdkTableModule } from '@angular/cdk/table';
import { NgTemplateOutlet } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { HelpIconComponent } from '../help-icon/help-icon.component';
import { SearchFilterComponent } from '../search-filter/search-filter.component';
import { PaginatorComponent } from '../paginator/paginator.component';
import { PageEvent, SortDirection, SortEvent } from '../../models/table.model';
import { CellTemplateDirective } from './cell-template.directive';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { HasPermissionDirective } from '../../directives/has-permission.directive';

export interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
  tooltip?: string;
}

/** Tri-state cycle used by the sortable column headers, matching the previous mat-sort behaviour. */
const NEXT_DIRECTION: Record<SortDirection, SortDirection> = {
  '': 'asc',
  asc: 'desc',
  desc: '',
};

/**
 * A highly reusable, generic data table component.
 * Supports both server-side and local pagination/sorting/filtering.
 *
 * Built on `cdk-table` for row/column rendering with Ionic chrome. When `localLogic` is
 * false the component is purely presentational and the parent is responsible for
 * fetching the right page; when true it filters, sorts and paginates `data` itself.
 *
 * @template T - The type of data to be displayed in the table.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  host: {
    '[attr.title]': 'null',
  },
  imports: [
    CdkTableModule,
    TranslateModule,
    NgTemplateOutlet,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonSpinner,
    HelpIconComponent,
    SearchFilterComponent,
    PaginatorComponent,
    TooltipDirective,
    HasPermissionDirective,
  ],
  template: `
    <ion-card class="data-table-card">
      @if (isLoading()) {
        <div class="loading-overlay">
          <ion-spinner name="crescent" data-testid="data-table-spinner"></ion-spinner>
        </div>
      }
      <ion-card-header>
        <ion-card-title>
          {{ title() | translate }}
          @if (helpTextKey()) {
            <app-help-icon [helpTextKey]="helpTextKey()"></app-help-icon>
          }
        </ion-card-title>
        <div class="header-actions">
          @if (createButtonLabel()) {
            <ion-button
              data-testid="data-table-create"
              color="primary"
              *appHasPermission="createPermission()"
              (click)="onCreate()"
            >
              <ion-icon name="add-outline" slot="start"></ion-icon>
              {{ createButtonLabel() | translate }}
            </ion-button>
          }
          <ng-content select="[headerActions]"></ng-content>
        </div>
      </ion-card-header>

      <ion-card-content>
        <div class="table-header">
          @if (showSearch()) {
            <div class="search-container">
              <app-search-filter
                [label]="searchLabel() | translate"
                [placeholder]="searchPlaceholder() | translate"
                (searchChange)="onSearch($event)"
              >
              </app-search-filter>
              <app-help-icon helpTextKey="HELP.SEARCH_DESC"></app-help-icon>
            </div>
          }
          <ng-content select="[filters]"></ng-content>
        </div>

        @if (hasError()) {
          <!-- Replaces the table rather than sitting above it. A failed load leaves the rows
               empty, and an empty table reads as "there is nothing here" — the opposite of
               what happened. -->
          <div class="error-state" role="alert" data-testid="data-table-error">
            <ion-icon name="alert-circle-outline" class="error-icon"></ion-icon>
            <p class="error-text">{{ 'COMMON.ERRORS.LOAD_FAILED' | translate }}</p>
            <ion-button
              fill="outline"
              size="small"
              data-testid="data-table-retry"
              (click)="onRetry()"
            >
              <ion-icon name="refresh-outline" slot="start"></ion-icon>
              {{ 'COMMON.RETRY' | translate }}
            </ion-button>
          </div>
        } @else {
          <div class="table-container">
            <table cdk-table [dataSource]="rows()" class="data-table">
              @for (col of columns(); track col.key) {
                <ng-container [cdkColumnDef]="col.key">
                  <th
                    cdk-header-cell
                    *cdkHeaderCellDef
                    [appTooltip]="col.tooltip || ''"
                    [attr.aria-sort]="ariaSortFor(col)"
                    [class.sortable]="col.sortable"
                  >
                    @if (col.sortable) {
                      <button type="button" class="sort-button" (click)="onSortHeaderClick(col)">
                        {{ col.label | translate }}
                        @if (sort().active === col.key && sort().direction) {
                          <ion-icon
                            aria-hidden="true"
                            class="sort-indicator"
                            [name]="
                              sort().direction === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline'
                            "
                          ></ion-icon>
                        }
                      </button>
                    } @else {
                      {{ col.label | translate }}
                    }
                  </th>
                  <!--
                    data-label is what makes the card layout possible without a second
                    template: below the breakpoint the header row is hidden and each cell
                    renders its own label from this attribute. One source of truth for the
                    columns, so a column added to columns() appears in both layouts.
                  -->
                  <td cdk-cell *cdkCellDef="let row" [attr.data-label]="col.label | translate">
                    @if (columnTemplates()[col.key]) {
                      <ng-container
                        *ngTemplateOutlet="columnTemplates()[col.key]; context: { $implicit: row }"
                      ></ng-container>
                    } @else {
                      <span class="truncate-text" [appTooltip]="getTooltipText(row, col.key)">
                        {{ getCellValue(row, col.key) }}
                      </span>
                    }
                  </td>
                </ng-container>
              }

              <tr cdk-header-row *cdkHeaderRowDef="displayedColumns()"></tr>
              <tr cdk-row *cdkRowDef="let row; columns: displayedColumns()"></tr>

              <tr class="no-data-row" *cdkNoDataRow>
                <td [attr.colspan]="displayedColumns().length">
                  {{ 'COMMON.NO_DATA' | translate }}
                </td>
              </tr>
            </table>

            <app-paginator
              [length]="displayedTotal()"
              [pageSize]="effectivePageSize"
              [pageIndex]="effectivePageIndex"
              [pageSizeOptions]="pageSizeOptions()"
              [exactTotal]="localLogic()"
              (page)="onPage($event)"
            ></app-paginator>
          </div>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      /* The narrow-viewport card layout lives in styles/_common.scss, not here. Angular scopes
         these rules with an _ngcontent attribute, and the <tbody> cdk-table renders into is
         created by the HTML parser rather than by this template — so it never carries that
         attribute and a scoped tbody selector silently does not match it. It stayed
         display: table-row-group, shrank to its content, and the cards came out narrower than
         the page. */
      .table-container {
        overflow: auto;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
      }
      .data-table th,
      .data-table td {
        padding: var(--space-3) var(--space-4);
        text-align: left;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
      }
      .data-table th {
        font-weight: 600;
        color: var(--secondary-color);
        white-space: nowrap;
      }
      .data-table th.sortable {
        user-select: none;
      }
      .data-table th.sortable:hover {
        color: var(--primary-color);
      }
      .sort-button {
        display: inline-flex;
        align-items: center;
        padding: 0;
        border: 0;
        color: inherit;
        font: inherit;
        background: transparent;
        cursor: pointer;
      }
      .sort-button:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 3px;
        border-radius: 2px;
      }
      .data-table th[aria-sort] {
        color: var(--primary-color);
      }
      .data-table tr:hover td {
        background-color: var(--hover-bg);
      }
      .sort-indicator {
        font-size: 14px;
        vertical-align: middle;
        margin-left: 4px;
      }
      .no-data-row td {
        text-align: center;
        color: var(--text-muted, #7f8c8d);
      }
      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-6) var(--space-4);
        text-align: center;
      }
      .error-icon {
        font-size: 2rem;
        color: var(--error-color);
      }
      .error-text {
        margin: 0;
        color: var(--text-muted);
        font-size: 0.9rem;
      }
      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--overlay-bg);
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
      }
      .truncate-text {
        display: inline-block;
        max-width: 200px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        vertical-align: middle;
      }
    `,
  ],
})
export class DataTableComponent<T> {
  readonly title = input('');
  readonly helpTextKey = input('');
  readonly createButtonLabel = input('');
  /**
   * Permission the create button requires, if any.
   *
   * The route behind the button is gated too, so leaving this unset is safe rather than
   * dangerous — a user without the permission simply meets Access Denied instead of being
   * refused up front. Setting it is about not offering the action at all: a button that leads
   * only to a refusal is a worse answer than no button. An empty value shows it to everyone,
   * which keeps every list that has not been reviewed behaving exactly as before.
   */
  readonly createPermission = input<string | string[]>('');
  readonly columns = input<ColumnDef[]>([]);
  readonly data = input<T[]>([]);
  /** Total number of records. If server-side, this comes from API response. */
  readonly totalRecords = input(0);
  readonly pageSize = input(10);
  readonly pageIndex = input(0);
  readonly pageSizeOptions = input([5, 10, 25, 100]);
  readonly showSearch = input(true);
  readonly searchLabel = input('COMMON.SEARCH');
  readonly searchPlaceholder = input('COMMON.SEARCH_PLACEHOLDER');
  /** If true, the component will handle pagination/sorting locally. */
  readonly localLogic = input(false);
  readonly isLoading = input(false);
  /**
   * Whether the last load failed.
   *
   * Set this instead of swallowing the failure into an empty array. A table that renders
   * "No records found" after a request errored tells the user the data does not exist, when
   * in fact nobody knows — and leaves them no way to ask again short of reloading the page.
   */
  readonly hasError = input(false);

  readonly create = output<void>();
  readonly searchChange = output<string>();
  readonly sortChange = output<SortEvent>();
  readonly pageChange = output<PageEvent>();
  /** Emitted when the user asks to load again after a failure. */
  readonly retry = output<void>();

  /**
   * Per-column templates projected by the parent.
   *
   * A signal query rather than `@ContentChildren` + `QueryList`: `QueryList.changes` does not
   * mark an OnPush view dirty, so a template registered after the first pass — one inside an
   * `@if`, say — would never appear.
   */
  readonly cellTemplates = contentChildren(CellTemplateDirective);

  readonly sort = signal<SortEvent>({ active: '', direction: '' });

  protected readonly columnTemplates = computed<Record<string, TemplateRef<unknown>>>(() => {
    const map: Record<string, TemplateRef<unknown>> = {};
    for (const directive of this.cellTemplates()) {
      map[directive.columnName()] = directive.template;
    }
    return map;
  });

  private readonly filterText = signal('');

  /*
   * Page state is tracked here in both modes.
   *
   * Reading the raw input in server-side mode left the paginator pinned to whatever the parent
   * last bound. Since most parents fetch by offset and never bind `pageIndex` back, it stayed 0
   * forever: the range label was always "1 - 10", "previous" was always disabled, and because
   * `goTo()` computes from `pageIndex()`, "next" resolved to page 1 every time — so page 2 was
   * reachable and nothing beyond it.
   *
   * `linkedSignal` keeps both halves of that: writable here, and reset whenever the parent
   * binds a new value, so a parent that drives `pageIndex` (to return to the first page when a
   * filter changes) keeps control. This is what the old `ngOnChanges` did by hand, and it has
   * to be expressed this way now — `ngOnChanges` does not run for signal inputs.
   */
  private readonly localPageIndex = linkedSignal(() => this.pageIndex());
  private readonly localPageSize = linkedSignal(() => this.pageSize());

  readonly displayedColumns = computed(() => this.columns().map((c) => c.key));

  get effectivePageIndex(): number {
    return this.localPageIndex();
  }

  get effectivePageSize(): number {
    return this.localPageSize();
  }

  /**
   * The full result set behind the table: `data` verbatim server-side, filtered and sorted
   * locally otherwise. Derived rather than recomputed on notification, so it cannot fall out
   * of step with the inputs it is built from.
   */
  private readonly resolved = computed<T[]>(() => {
    const data = this.data() ?? [];
    if (!this.localLogic()) {
      return data;
    }

    let result = [...data];

    const filter = this.filterText();
    if (filter) {
      result = result.filter((row) => this.matchesFilter(row, filter));
    }
    const { active, direction } = this.sort();
    if (active && direction) {
      result = this.sortRows(result, active, direction);
    }
    return result;
  });

  /** Rows currently rendered — the visible page when `localLogic`, otherwise `data` verbatim. */
  readonly rows = computed<T[]>(() => {
    if (!this.localLogic()) {
      return this.resolved();
    }
    const pageSize = this.localPageSize();
    const start = this.localPageIndex() * pageSize;
    return this.resolved().slice(start, start + pageSize);
  });

  /** Record count reported to the paginator; local filtering shrinks it. */
  readonly displayedTotal = computed(() =>
    this.localLogic() ? this.resolved().length : this.totalRecords(),
  );

  onCreate(): void {
    this.create.emit();
  }

  onRetry(): void {
    this.retry.emit();
  }

  onSearch(value: string): void {
    // A narrower result set can leave the current page out of range. Server-side
    // parents also refetch from offset 0 on a new search, so the paginator has to
    // agree in both modes or the label drifts from the rows on screen.
    this.localPageIndex.set(0);
    if (this.localLogic()) {
      this.filterText.set(value.trim().toLowerCase());
    }
    this.searchChange.emit(value);
  }

  onSortHeaderClick(col: ColumnDef): void {
    if (!col.sortable) return;

    const current = this.sort();
    const direction =
      current.active === col.key ? NEXT_DIRECTION[current.direction] : ('asc' as SortDirection);
    this.sort.set({ active: direction ? col.key : '', direction });

    // Re-sorting reorders the whole set, so the current page no longer means
    // anything; server-side parents reset to offset 0 for the same reason.
    this.localPageIndex.set(0);
    this.sortChange.emit(this.sort());
  }

  onPage(event: PageEvent): void {
    this.localPageIndex.set(event.pageIndex);
    this.localPageSize.set(event.pageSize);
    this.pageChange.emit(event);
  }

  ariaSortFor(col: ColumnDef): string | null {
    const { active, direction } = this.sort();
    if (!col.sortable || active !== col.key || !direction) return null;
    return direction === 'asc' ? 'ascending' : 'descending';
  }

  getCellValue(row: T, key: string): unknown {
    const keys = key.split('.');
    let value: unknown = row;
    for (const k of keys) {
      if (value === null || value === undefined) return undefined;
      value = (value as Record<string, unknown>)[k];
    }
    if (value && typeof value === 'object' && 'value' in value) {
      return (value as Record<string, unknown>)['value'];
    }
    return value;
  }

  getTooltipText(row: T, key: string): string {
    const val = this.getCellValue(row, key);
    if (val === null || val === undefined) return '';
    return String(val);
  }

  /** Matches the row against the search text across every displayed column. */
  private matchesFilter(row: T, filter: string): boolean {
    return this.columns().some((col) => {
      const value = this.getCellValue(row, col.key);
      return value !== null && value !== undefined
        ? String(value).toLowerCase().includes(filter)
        : false;
    });
  }

  private sortRows(rows: T[], active: string, direction: SortDirection): T[] {
    const factor = direction === 'asc' ? 1 : -1;

    return rows.sort((a, b) => {
      const left = this.getCellValue(a, active);
      const right = this.getCellValue(b, active);

      // Nulls sort last regardless of direction, so empty cells never lead the table.
      if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
      if (right === null || right === undefined) return -1;

      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * factor;
      }
      return String(left).localeCompare(String(right), undefined, { numeric: true }) * factor;
    });
  }
}
