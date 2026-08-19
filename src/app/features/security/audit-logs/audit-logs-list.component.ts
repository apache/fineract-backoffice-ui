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
import {} from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { Subject, merge, of } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../../shared';
import { AuditsService } from '../../../api';
import { DatePipe } from '@angular/common';
import { ViewPayloadDialogComponent } from '../../tasks/checker-inbox/view-payload-dialog.component';
import { PageEvent, SortEvent } from '../../../shared/models/table.model';
import { DialogService } from '../../../core/services/dialog.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

export interface AuditFilters {
  actionName: string;
  entityName: string;
  resourceId?: number;
  makerId?: number;
  makerDateTimeFrom: Date | null;
  makerDateTimeTo: Date | null;
  processingResult: string;
}

@Component({
  selector: 'app-audit-logs-list',
  standalone: true,
  imports: [
    TranslateModule,
    FormsModule,
    DataTableComponent,
    CellTemplateDirective,
    DatePipe,
    IonIcon,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonSelectOption,
    IonSelect,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonAccordion,
    IonAccordionGroup,
    TooltipDirective,
  ],
  template: `
    <div class="audit-logs-container">
      <ion-accordion-group class="filter-panel">
        <ion-accordion value="filters">
          <ion-item slot="header">
            <ion-icon slot="start" name="filter-outline"></ion-icon>
            <ion-label>{{ 'COMMON.FILTERS' | translate }}</ion-label>
          </ion-item>
          <div slot="content">
            <div class="filter-grid">
              <ion-item fill="outline">
                <ion-label position="stacked">Action Name</ion-label>
                <ion-input
                  aria-label="Action Name"
                  [(ngModel)]="activeFilters.actionName"
                  (keyup.enter)="onApplyFilters()"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">Entity Name</ion-label>
                <ion-input
                  aria-label="Entity Name"
                  [(ngModel)]="activeFilters.entityName"
                  (keyup.enter)="onApplyFilters()"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">Resource ID</ion-label>
                <ion-input
                  aria-label="Resource ID"
                  type="number"
                  [(ngModel)]="activeFilters.resourceId"
                  (keyup.enter)="onApplyFilters()"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">Maker ID</ion-label>
                <ion-input
                  aria-label="Maker ID"
                  type="number"
                  [(ngModel)]="activeFilters.makerId"
                  (keyup.enter)="onApplyFilters()"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">Maker Date From</ion-label>
                <ion-datetime-button
                  datetime="activeFiltersmakerDateTimeFrom-picker"
                ></ion-datetime-button>
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="activeFiltersmakerDateTimeFrom-picker"
                      data-testid="activeFiltersmakerDateTimeFrom-picker"
                      presentation="date"
                      name="activeFiltersmakerDateTimeFrom"
                      [(ngModel)]="activeFilters.makerDateTimeFrom"
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">Maker Date To</ion-label>
                <ion-datetime-button
                  datetime="activeFiltersmakerDateTimeTo-picker"
                ></ion-datetime-button>
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="activeFiltersmakerDateTimeTo-picker"
                      data-testid="activeFiltersmakerDateTimeTo-picker"
                      presentation="date"
                      name="activeFiltersmakerDateTimeTo"
                      [(ngModel)]="activeFilters.makerDateTimeTo"
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">Processing Result</ion-label>
                <ion-select
                  aria-label="Processing Result"
                  interface="popover"
                  [(ngModel)]="activeFilters.processingResult"
                >
                  <ion-select-option value="">All</ion-select-option>
                  <ion-select-option value="success">Success</ion-select-option>
                  <ion-select-option value="failure">Failure</ion-select-option>
                </ion-select>
              </ion-item>
            </div>

            <div class="filter-actions">
              <ion-button fill="clear" color="danger" (click)="onResetFilters()">
                {{ 'COMMON.RESET' | translate }}
              </ion-button>
              <ion-button color="primary" (click)="onApplyFilters()">
                {{ 'COMMON.APPLY' | translate }}
              </ion-button>
            </div>
          </div>
        </ion-accordion>
      </ion-accordion-group>

      <app-data-table
        [hasError]="hasError()"
        (retry)="onRetry()"
        title="SECURITY.AUDIT_LOGS"
        [columns]="columns"
        [data]="auditLogs()"
        [totalRecords]="totalRecords()"
        [pageSize]="pageSize()"
        [pageIndex]="pageIndex()"
        [isLoading]="isLoading()"
        [showSearch]="false"
        (pageChange)="onPage($event)"
        (sortChange)="onSort($event)"
      >
        <ng-template appCellTemplate="madeOnDate" let-row>
          {{ row['madeOnDate'] | date: 'medium' }}
        </ng-template>

        <ng-template appCellTemplate="checkedOnDate" let-row>
          {{ row['checkedOnDate'] | date: 'medium' }}
        </ng-template>

        <ng-template appCellTemplate="actions" let-row>
          <ion-button
            fill="clear"
            color="primary"
            (click)="onViewDetails(row)"
            [attr.aria-label]="'COMMON.VIEW_DETAILS' | translate"
            [appTooltip]="'COMMON.VIEW_DETAILS' | translate"
          >
            <ion-icon name="eye-outline"></ion-icon>
          </ion-button>
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
        margin: 24px;
        margin-bottom: 0;
      }
      .filter-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
        padding-top: 16px;
      }
    `,
  ],
})
export class AuditLogsListComponent implements OnInit {
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  /** Re-runs the query behind the table when the user asks to try again. */
  private readonly retrySubject = new Subject<void>();

  private readonly auditsService = inject(AuditsService);
  private readonly dialogService = inject(DialogService);

  columns: ColumnDef[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'resourceId', label: 'Resource ID', sortable: true },
    { key: 'entityName', label: 'Entity', sortable: true },
    { key: 'actionName', label: 'Action', sortable: true },
    { key: 'maker', label: 'Maker', sortable: true },
    { key: 'madeOnDate', label: 'Date', sortable: true },
    { key: 'checker', label: 'Checker', sortable: true },
    { key: 'checkedOnDate', label: 'Checked Date', sortable: true },
    { key: 'processingResult', label: 'Result', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS' },
  ];

  readonly auditLogs = signal<Record<string, unknown>[]>([]);
  readonly totalRecords = signal<number>(0);
  readonly isLoading = signal<boolean>(false);
  readonly pageSize = signal<number>(10);
  readonly pageIndex = signal<number>(0);

  activeFilters: AuditFilters = {
    actionName: '',
    entityName: '',
    resourceId: undefined,
    makerId: undefined,
    makerDateTimeFrom: null,
    makerDateTimeTo: null,
    processingResult: '',
  };

  private sortSubject = new Subject<SortEvent>();
  private pageSubject = new Subject<PageEvent>();
  private filterSubject = new Subject<void>();

  private currentSort: SortEvent = { active: 'id', direction: 'desc' };

  ngOnInit(): void {
    merge(this.sortSubject, this.pageSubject, this.filterSubject, this.retrySubject)
      .pipe(
        startWith({}),
        switchMap(() => {
          this.isLoading.set(true);
          const limit = this.pageSize();
          const offset = this.pageIndex() * limit;
          const orderBy = this.currentSort.active;
          const sortOrder = this.currentSort.direction.toUpperCase() || 'DESC';

          const fromDate = this.activeFilters.makerDateTimeFrom
            ? this.activeFilters.makerDateTimeFrom.toISOString().split('T', 1)[0]
            : undefined;
          const toDate = this.activeFilters.makerDateTimeTo
            ? this.activeFilters.makerDateTimeTo.toISOString().split('T', 1)[0]
            : undefined;

          return this.auditsService
            .getAudits(
              this.activeFilters.actionName || undefined,
              this.activeFilters.entityName || undefined,
              this.activeFilters.resourceId,
              this.activeFilters.makerId,
              fromDate,
              toDate,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              this.activeFilters.processingResult || undefined,
              'yyyy-MM-dd',
              'en',
              offset,
              limit,
              orderBy,
              sortOrder,
              true,
            )
            .pipe(
              tap(() => this.hasError.set(false)),
              catchError(() => {
                this.hasError.set(true);
                return of(null);
              }),
            );
        }),
        map((data: unknown) => {
          this.isLoading.set(false);
          if (data === null) return [];

          const result = (typeof data === 'string' ? JSON.parse(data) : data) as Record<
            string,
            unknown
          >;
          const items = result['pageItems']
            ? (result['pageItems'] as unknown[])
            : (result as unknown);

          if (Array.isArray(items)) {
            const limit = this.pageSize();
            const offset = this.pageIndex() * limit;

            // If we received exactly 'limit' items, assume there might be more.
            // Some Fineract versions return totalFilteredRecords as the same as current page size.
            const total =
              items.length === limit
                ? offset + limit + 1
                : (result['totalFilteredRecords'] as number) ||
                  (result['totalRecords'] as number) ||
                  offset + items.length;

            this.totalRecords.set(total);
            return items as Record<string, unknown>[];
          }
          return [];
        }),
      )
      .subscribe((data) => {
        this.auditLogs.set(data);
      });
  }

  onApplyFilters(): void {
    this.pageIndex.set(0);
    this.filterSubject.next();
  }

  onResetFilters(): void {
    this.activeFilters = {
      actionName: '',
      entityName: '',
      resourceId: undefined,
      makerId: undefined,
      makerDateTimeFrom: null,
      makerDateTimeTo: null,
      processingResult: '',
    };
    this.onApplyFilters();
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

  onViewDetails(row: Record<string, unknown>): Promise<void> {
    const payload = (row['commandAsJson'] as string) || JSON.stringify(row, null, 2);
    return this.dialogService
      .open(ViewPayloadDialogComponent, { data: { payload } })
      .then(() => undefined);
  }

  onRetry(): void {
    this.retrySubject.next();
  }
}
