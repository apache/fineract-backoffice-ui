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
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '../../../core/adapters';
import { CellTemplateDirective, ColumnDef } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { SCHEDULERJOBService, JobDetailHistoryDataSwagger } from '../../../api';
import { ButtonComponent } from '../../../ui/button/button.component';
import { DateTimePipe } from '../../../shared/pipes/date-time.pipe';

/**
 * Read-only run history for a single scheduler job, reached from the jobs list.
 */
@Component({
  selector: 'app-scheduler-job-history',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent,
    ButtonComponent,
    CellTemplateDirective,
    DateTimePipe,
  ],
  template: `
    <div class="history-actions">
      <app-button type="button" emphasis="quiet" (click)="onBack()">{{
        'COMMON.BACK' | appTranslate
      }}</app-button>
    </div>
    <app-data-table
      title="SCHEDULER_JOBS.RUN_HISTORY"
      [columns]="columns"
      [data]="history()"
      [totalRecords]="history().length"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="jobRunStartTime" let-row>
        {{ row.jobRunStartTime | dateTime }}
      </ng-template>
      <ng-template appCellTemplate="jobRunEndTime" let-row>
        {{ row.jobRunEndTime | dateTime }}
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .history-actions {
        padding: 16px 16px 0;
      }
    `,
  ],
})
export class SchedulerJobHistoryComponent implements OnInit {
  private readonly jobService = inject(SCHEDULERJOBService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'version', label: 'SCHEDULER_JOBS.VERSION', sortable: true },
    { key: 'jobRunStartTime', label: 'SCHEDULER_JOBS.START_TIME', sortable: true },
    { key: 'jobRunEndTime', label: 'SCHEDULER_JOBS.END_TIME', sortable: true },
    { key: 'status', label: 'SCHEDULER_JOBS.STATUS', sortable: true },
    { key: 'triggerType', label: 'SCHEDULER_JOBS.TRIGGER_TYPE', sortable: false },
  ];

  jobId: number | null = null;
  readonly history = signal<JobDetailHistoryDataSwagger[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.jobId = +id;
      this.load();
    }
  }

  load(): void {
    if (!this.jobId) return;
    this.jobService.getJobsJobIdRunhistory(this.jobId).subscribe({
      next: (data) => {
        this.history.set(data?.pageItems ?? []);
      },
      error: (err: unknown) => console.error('Failed to load job run history', err),
    });
  }

  onBack(): void {
    this.router.navigate(['/system/scheduler-jobs']);
  }
}
