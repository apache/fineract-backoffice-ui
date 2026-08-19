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

import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../shared';
import { ReportsService, GetReportsResponse } from '../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';

@Component({
  selector: 'app-reports-list',
  standalone: true,
  imports: [
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    IonIcon,
    IonButton,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      title="nav.reports"
      helpTextKey="HELP.REPORTS_DESC"
      [columns]="columns"
      [data]="reports()"
      [totalRecords]="reports().length"
      [showSearch]="true"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="actions" let-report>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.RUN' | translate"
          [appTooltip]="'REPORTS.RUN' | translate"
          (click)="onRunReport(report)"
        >
          <ion-icon name="play-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class ReportsListComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'reportName', label: 'REPORTS.NAME', sortable: true },
    { key: 'reportType', label: 'REPORTS.TYPE', sortable: true },
    { key: 'reportCategory', label: 'REPORTS.CATEGORY', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly reports = signal<GetReportsResponse[]>([]);

  ngOnInit(): void {
    this.loadReports();
  }

  private loadReports(): void {
    this.reportsService.getReports().subscribe({
      next: (data) => {
        this.reports.set(data || []);
      },
      error: (err) => console.error('Failed to load reports', err),
    });
  }

  /**
   * The sub-type travels with the type because it is what separates a bar chart from a pie chart,
   * and the run screen has no other way to learn it — the run endpoint returns the same generic
   * resultset whatever the definition says.
   */
  onRunReport(report: GetReportsResponse): void {
    this.router.navigate(['/reporting/run', report.reportName], {
      queryParams: { type: report.reportType, subType: report.reportSubType },
    });
  }
}
