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
import { Router } from '@angular/router';
import { DateTimePipe } from '../../../shared/pipes/date-time.pipe';
import { forkJoin } from 'rxjs';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { IonButton, IonCard, IonCheckbox, IonIcon, IonToggle } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { DialogService } from '../../../core/services/dialog.service';
import {
  SCHEDULERJOBService,
  SchedulerService,
  GetJobsResponse,
  GetSchedulerResponse,
} from '../../../api';

/**
 * Lists Fineract scheduler jobs (name, active, next run) with a "Run now" action,
 * and surfaces the global scheduler status with a start/stop toggle.
 *
 * The global scheduler is controlled via postScheduler with a `command` query param
 * ('start' | 'stop'); job execution is triggered via postJobsJobId(jobId, 'executeJob').
 */
@Component({
  selector: 'app-scheduler-jobs-list',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    IonIcon,
    IonButton,
    IonCard,
    IonCheckbox,
    IonToggle,
    TooltipDirective,
    DateTimePipe,
  ],
  template: `
    <ion-card class="scheduler-status">
      <div class="status-row">
        <span class="status-label">{{ 'SCHEDULER_JOBS.GLOBAL_STATUS' | appTranslate }}:</span>
        <span>{{
          (schedulerActive() ? 'SCHEDULER_JOBS.RUNNING' : 'SCHEDULER_JOBS.STOPPED') | appTranslate
        }}</span>
        <ion-toggle
          [checked]="schedulerActive()"
          (ionChange)="onToggleScheduler($event.detail.checked)"
        >
          {{ 'SCHEDULER_JOBS.TOGGLE_SCHEDULER' | appTranslate }}
        </ion-toggle>
      </div>
    </ion-card>

    <app-data-table
      title="nav.schedulerJobs"
      helpTextKey="HELP.SCHEDULER_JOBS_DESC"
      [columns]="columns"
      [data]="jobs()"
      [totalRecords]="jobs().length"
      [localLogic]="true"
    >
      <ion-checkbox
        headerActions
        [attr.aria-label]="'SCHEDULER_JOBS.SELECT_ALL' | appTranslate"
        [checked]="allSelected()"
        (ionChange)="onToggleSelectAll($event.detail.checked)"
      >
        {{ 'SCHEDULER_JOBS.SELECT_ALL' | appTranslate }}
      </ion-checkbox>
      <ion-button
        headerActions
        fill="outline"
        [disabled]="selectedJobIds().size === 0"
        (click)="onRunSelected()"
      >
        <ion-icon name="play-outline" slot="start"></ion-icon>
        {{ 'SCHEDULER_JOBS.RUN_SELECTED' | appTranslate }} ({{ selectedJobIds().size }})
      </ion-button>

      <ng-template appCellTemplate="select" let-row>
        <ion-checkbox
          [attr.aria-label]="'SCHEDULER_JOBS.SELECT_JOB' | appTranslate"
          [checked]="isSelected(row)"
          (ionChange)="onToggleSelect(row, $event.detail.checked)"
        ></ion-checkbox>
      </ng-template>
      <ng-template appCellTemplate="active" let-row>
        {{ (row.active ? 'COMMON.YES' : 'COMMON.NO') | appTranslate }}
      </ng-template>
      <ng-template appCellTemplate="nextRunTime" let-row>
        {{ row.nextRunTime | dateTime }}
      </ng-template>
      <ng-template appCellTemplate="actions" let-row>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'SCHEDULER_JOBS.RUN_NOW' | appTranslate"
          [appTooltip]="'SCHEDULER_JOBS.RUN_NOW' | appTranslate"
          (click)="onRunNow(row)"
        >
          <ion-icon name="play-outline"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'SCHEDULER_JOBS.HISTORY' | appTranslate"
          [appTooltip]="'SCHEDULER_JOBS.HISTORY' | appTranslate"
          (click)="onHistory(row)"
        >
          <ion-icon name="time-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .scheduler-status {
        margin: 16px;
      }
      .status-row {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .status-label {
        font-weight: 600;
      }
    `,
  ],
})
export class SchedulerJobsListComponent implements OnInit {
  private readonly jobService = inject(SCHEDULERJOBService);
  private readonly schedulerService = inject(SchedulerService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'select', label: '', sortable: false, width: '48px' },
    { key: 'displayName', label: 'SCHEDULER_JOBS.NAME', sortable: true },
    { key: 'active', label: 'SCHEDULER_JOBS.ACTIVE', sortable: true, width: '100px' },
    { key: 'nextRunTime', label: 'SCHEDULER_JOBS.NEXT_RUN', sortable: true, width: '200px' },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false, width: '100px' },
  ];

  readonly jobs = signal<GetJobsResponse[]>([]);
  readonly schedulerActive = signal(false);
  readonly selectedJobIds = signal<Set<number>>(new Set());
  readonly allSelected = computed(
    () => this.jobs().length > 0 && this.jobs().every((j) => this.selectedJobIds().has(j.jobId!)),
  );

  ngOnInit(): void {
    this.loadJobs();
    this.loadSchedulerStatus();
  }

  loadJobs(): void {
    this.jobService.getJobs().subscribe({
      next: (data: GetJobsResponse[]) => {
        this.jobs.set(data || []);
      },
      error: (err: unknown) => console.error('Failed to load scheduler jobs', err),
    });
  }

  loadSchedulerStatus(): void {
    this.schedulerService.getScheduler().subscribe({
      next: (data: GetSchedulerResponse) => {
        this.schedulerActive.set(!!data?.active);
      },
      error: (err: unknown) => console.error('Failed to load scheduler status', err),
    });
  }

  onToggleScheduler(checked: boolean): void {
    const command = checked ? 'start' : 'stop';
    this.schedulerService.postScheduler(command).subscribe({
      next: () => this.loadSchedulerStatus(),
      error: (err: unknown) => console.error('Failed to update scheduler', err),
    });
  }

  onRunNow(row: GetJobsResponse): void {
    if (!row.jobId) return;
    this.jobService.postJobsJobId(row.jobId, 'executeJob').subscribe({
      next: () => this.loadJobs(),
      error: (err: unknown) => console.error('Failed to run job', err),
    });
  }

  onHistory(row: GetJobsResponse): void {
    if (!row.jobId) return;
    this.router.navigate(['/system/scheduler-jobs', row.jobId, 'history']);
  }

  isSelected(row: GetJobsResponse): boolean {
    return row.jobId != null && this.selectedJobIds().has(row.jobId);
  }

  onToggleSelect(row: GetJobsResponse, checked: boolean): void {
    if (row.jobId == null) return;
    const next = new Set(this.selectedJobIds());
    if (checked) next.add(row.jobId);
    else next.delete(row.jobId);
    this.selectedJobIds.set(next);
  }

  onToggleSelectAll(checked: boolean): void {
    if (!checked) {
      this.selectedJobIds.set(new Set());
      return;
    }
    const ids = this.jobs()
      .map((j) => j.jobId)
      .filter((id): id is number => id != null);
    this.selectedJobIds.set(new Set(ids));
  }

  async onRunSelected(): Promise<void> {
    const ids = [...this.selectedJobIds()];
    if (ids.length === 0) return;

    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('SCHEDULER_JOBS.RUN_SELECTED'),
      message: this.i18n.translate('SCHEDULER_JOBS.RUN_SELECTED_CONFIRM', { count: ids.length }),
    });
    if (!confirmed) return;

    forkJoin(ids.map((id) => this.jobService.postJobsJobId(id, 'executeJob'))).subscribe({
      next: () => {
        this.selectedJobIds.set(new Set());
        this.loadJobs();
      },
      error: (err: unknown) => console.error('Failed to run selected jobs', err),
    });
  }
}
