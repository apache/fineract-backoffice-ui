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
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { ColumnDef, CellTemplateDirective, LoadErrorComponent } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  IonButton,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from '@ionic/angular/standalone';
import { CdkTableModule } from '@angular/cdk/table';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { DialogService } from '../../../core/services/dialog.service';
import {
  ReportMailingJobsService,
  GetReportMailingJobsResponse,
  ListReportMailingJobHistoryService,
  ReportMailingJobRunHistoryData,
} from '../../../api';

/**
 * Lists scheduled report-mailing jobs with a Run History tab.
 */
/**
 * The tabs on this screen, named.
 *
 * They were positional strings — '0', '7' — which say nothing at the point of use and shift
 * meaning whenever a tab is inserted in the middle. The values are still strings because
 * `ion-segment` compares them as such.
 */
export const MAILING_TAB = {
  jobs: 'jobs',
  history: 'history',
} as const;

export type MailingTab = (typeof MAILING_TAB)[keyof typeof MAILING_TAB];

/**
 * Normalises the report-mailing-jobs payload into rows.
 *
 * The generated type says `Array`, the endpoint sends `{ totalFilteredRecords, pageItems }`.
 * Both are accepted, and anything else throws so the caller can show a failure instead of an
 * empty table.
 */
export function readJobs(data: unknown): GetReportMailingJobsResponse[] {
  if (data === null || data === undefined) return [];
  if (Array.isArray(data)) return data as GetReportMailingJobsResponse[];
  const pageItems = (data as { pageItems?: unknown })?.pageItems;
  if (Array.isArray(pageItems)) return pageItems as GetReportMailingJobsResponse[];
  throw new TypeError(`Unexpected report-mailing-jobs payload: ${typeof data}`);
}

@Component({
  selector: 'app-report-mailing-jobs-list',
  standalone: true,
  imports: [
    DatePipe,
    TranslatePipe,
    CdkTableModule,
    DataTableComponent,
    CellTemplateDirective,
    IonIcon,
    IonButton,
    IonSpinner,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    TooltipDirective,
    LoadErrorComponent,
  ],
  template: `
    <ion-segment [value]="activeTab()" (ionChange)="activeTab.set($any($event).detail.value)">
      <ion-segment-button [value]="TAB.jobs">
        <ion-label>{{ 'nav.reportMailingJobs' | appTranslate }}</ion-label>
      </ion-segment-button>
      <ion-segment-button [value]="TAB.history">
        <ion-label>{{ 'REPORT_MAILING.RUN_HISTORY' | appTranslate }}</ion-label>
      </ion-segment-button>
    </ion-segment>

    @if (activeTab() === TAB.jobs) {
      @if (loadFailed()) {
        <app-load-error
          testId="report-mailing-jobs-load-error"
          [message]="'REPORT_MAILING.LOAD_FAILED' | appTranslate"
          [actionLabel]="'COMMON.RETRY' | appTranslate"
          (action)="load()"
        ></app-load-error>
      } @else {
        <app-data-table
          title="nav.reportMailingJobs"
          helpTextKey="HELP.REPORT_MAILING_JOBS_DESC"
          createButtonLabel="REPORT_MAILING_JOBS.CREATE"
          createPermission="CREATE_REPORTMAILINGJOB"
          [columns]="columns"
          [data]="jobs()"
          [totalRecords]="jobs().length"
          [localLogic]="true"
          (create)="onCreate()"
        >
          <ng-template appCellTemplate="isActive" let-row>
            {{ (row.isActive ? 'COMMON.YES' : 'COMMON.NO') | appTranslate }}
          </ng-template>
          <ng-template appCellTemplate="actions" let-row>
            <ion-button
              fill="clear"
              color="primary"
              [attr.aria-label]="'COMMON.EDIT' | appTranslate"
              [appTooltip]="'COMMON.EDIT' | appTranslate"
              (click)="onEdit(row)"
            >
              <ion-icon name="create-outline"></ion-icon>
            </ion-button>
            <ion-button
              fill="clear"
              color="danger"
              [attr.aria-label]="'COMMON.DELETE' | appTranslate"
              [appTooltip]="'COMMON.DELETE' | appTranslate"
              (click)="onDelete(row)"
            >
              <ion-icon name="trash-outline"></ion-icon>
            </ion-button>
          </ng-template>
        </app-data-table>
      }
    }
    @if (activeTab() === TAB.history) {
      <div class="history-container">
        @if (historyLoading()) {
          <div class="spinner-wrap">
            <ion-spinner name="crescent"></ion-spinner>
          </div>
        } @else {
          <table cdk-table [dataSource]="runHistory()" class="history-table">
            <ng-container cdkColumnDef="id">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ID' | appTranslate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.id }}</td>
            </ng-container>

            <ng-container cdkColumnDef="jobName">
              <th cdk-header-cell *cdkHeaderCellDef>
                {{ 'REPORT_MAILING_JOBS.NAME' | appTranslate }}
              </th>
              <td cdk-cell *cdkCellDef="let row">{{ row.jobName }}</td>
            </ng-container>

            <ng-container cdkColumnDef="scheduledFireTime">
              <th cdk-header-cell *cdkHeaderCellDef>
                {{ 'REPORT_MAILING.SCHEDULED_FIRE_TIME' | appTranslate }}
              </th>
              <td cdk-cell *cdkCellDef="let row">{{ row.scheduledFireTime | date: 'medium' }}</td>
            </ng-container>

            <ng-container cdkColumnDef="triggerType">
              <th cdk-header-cell *cdkHeaderCellDef>
                {{ 'REPORT_MAILING.TRIGGER_TYPE' | appTranslate }}
              </th>
              <td cdk-cell *cdkCellDef="let row">{{ row.triggerType }}</td>
            </ng-container>

            <ng-container cdkColumnDef="status">
              <th cdk-header-cell *cdkHeaderCellDef>
                {{ 'REPORT_MAILING.STATUS' | appTranslate }}
              </th>
              <td cdk-cell *cdkCellDef="let row">{{ row.status }}</td>
            </ng-container>

            <tr cdk-header-row *cdkHeaderRowDef="historyColumns"></tr>
            <tr cdk-row *cdkRowDef="let row; columns: historyColumns"></tr>

            @if (runHistory().length === 0) {
              <tr class="cdk-row no-data-row">
                <td
                  class="cdk-cell"
                  [attr.colspan]="historyColumns.length"
                  style="text-align:center;padding:1rem;"
                >
                  {{ 'COMMON.NO_DATA' | appTranslate }}
                </td>
              </tr>
            }
          </table>
        }
      </div>
    }
  `,
  styles: [
    `
      .history-container {
        padding: 1rem;
      }
      .spinner-wrap {
        display: flex;
        justify-content: center;
        padding: 2rem;
      }
      .history-table {
        width: 100%;
      }
    `,
  ],
})
export class ReportMailingJobsListComponent implements OnInit {
  /** Selected tab; mat-tab-group tracked this internally, ion-segment does not. */
  /** Exposed so the template names its tabs instead of numbering them. */
  protected readonly TAB = MAILING_TAB;

  readonly activeTab = signal<MailingTab>(MAILING_TAB.jobs);
  private readonly jobsService = inject(ReportMailingJobsService);
  private readonly historyService = inject(ListReportMailingJobHistoryService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'REPORT_MAILING_JOBS.NAME', sortable: true },
    { key: 'emailRecipients', label: 'REPORT_MAILING_JOBS.EMAIL_RECIPIENTS', sortable: false },
    { key: 'emailSubject', label: 'REPORT_MAILING_JOBS.EMAIL_SUBJECT', sortable: false },
    { key: 'isActive', label: 'REPORT_MAILING_JOBS.IS_ACTIVE', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly historyColumns = ['id', 'jobName', 'scheduledFireTime', 'triggerType', 'status'];

  readonly jobs = signal<GetReportMailingJobsResponse[]>([]);

  readonly runHistory = signal<ReportMailingJobRunHistoryData[]>([]);
  readonly historyLoading = signal(false);
  /** True once a load has failed, so the screen can say so instead of reading as empty. */
  readonly loadFailed = signal(false);
  private historyLoaded = false;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.jobsService.getReportmailingjobs().subscribe({
      // Generated as `Array<GetReportMailingJobsResponse>`, but the endpoint returns the paged
      // envelope `{ totalFilteredRecords, pageItems }`. Assigning that object straight into a
      // signal typed as an array made a downstream computed throw `t is not iterable`, after a
      // successful response, so `error` below never saw it — see issue #611. `loadRunHistory`
      // below already guards the same way.
      next: (data: unknown) => {
        this.jobs.set(readJobs(data));
        this.loadFailed.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load report-mailing jobs', err);
        this.jobs.set([]);
        this.loadFailed.set(true);
      },
    });
  }

  onTabChange(index: number): void {
    if (index === 1 && !this.historyLoaded) {
      this.loadRunHistory();
    }
  }

  loadRunHistory(): void {
    this.historyLoading.set(true);
    this.historyService.getReportmailingjobrunhistory(undefined, 0, 20).subscribe({
      next: (data) => {
        const historyList = Array.isArray(data)
          ? data
          : (((data as Record<string, unknown>)?.[`pageItems`] as
              ReportMailingJobRunHistoryData[] | undefined) ?? []);
        this.runHistory.set(historyList);
        this.historyLoaded = true;
        this.historyLoading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load run history', err);
        this.historyLoading.set(false);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/system/report-mailing-jobs/create']);
  }

  onEdit(row: GetReportMailingJobsResponse): void {
    this.router.navigate(['/system/report-mailing-jobs/edit', row.id]);
  }

  async onDelete(row: GetReportMailingJobsResponse): Promise<void> {
    if (!row.id) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('REPORT_MAILING_JOBS.DELETE'),
      message: this.i18n.translate('REPORT_MAILING_JOBS.CONFIRM_DELETE', {
        name: row.name ?? '',
        recipients: row.emailRecipients ?? '',
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.jobsService.deleteReportmailingjobsEntityId(row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete report-mailing job', err),
    });
  }
}
