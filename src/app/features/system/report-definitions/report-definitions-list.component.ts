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
import { NgClass } from '@angular/common';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

import { GetReportsResponse, ReportsService } from '../../../api';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { DialogService } from '../../../core/services/dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../../shared';

/**
 * The report catalogue — the definitions behind the reports the Reporting section runs.
 *
 * Fineract distinguishes core reports from tenant ones and enforces it in the database: a core
 * report cannot be deleted at all, and only its "in use" flag can be changed. That distinction is
 * shown here rather than discovered through a 403, because the two kinds of row differ in what the
 * user is allowed to do with them and nothing else on the screen would explain why.
 */
@Component({
  selector: 'app-report-definitions-list',
  standalone: true,
  imports: [TranslatePipe, DataTableComponent, CellTemplateDirective, NgClass, IonButton, IonIcon],
  template: `
    <app-data-table
      title="nav.reportDefinitions"
      helpTextKey="HELP.REPORT_DEFINITIONS_DESC"
      createButtonLabel="REPORT_DEFINITIONS.CREATE"
      createPermission="CREATE_REPORT"
      [columns]="columns"
      [data]="reports()"
      [localLogic]="true"
      [hasError]="hasError()"
      (retry)="load()"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="coreReport" let-report>
        <span class="status-chip" [ngClass]="report.coreReport ? 'core' : 'tenant'">
          {{
            (report.coreReport ? 'REPORT_DEFINITIONS.CORE' : 'REPORT_DEFINITIONS.TENANT')
              | appTranslate
          }}
        </span>
      </ng-template>

      <ng-template appCellTemplate="useReport" let-report>
        {{ (report.useReport ? 'COMMON.YES' : 'COMMON.NO') | appTranslate }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-report>
        <ion-button
          fill="clear"
          data-testid="report-definition-edit"
          [title]="'COMMON.EDIT' | appTranslate"
          [attr.aria-label]="'COMMON.EDIT' | appTranslate"
          (click)="onEdit(report)"
        >
          <ion-icon name="create-outline"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="danger"
          data-testid="report-definition-delete"
          [disabled]="report.coreReport"
          [title]="
            (report.coreReport ? 'REPORT_DEFINITIONS.CORE_NOT_DELETABLE' : 'COMMON.DELETE')
              | appTranslate
          "
          [attr.aria-label]="'COMMON.DELETE' | appTranslate"
          (click)="onDelete(report)"
        >
          <ion-icon name="trash-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .status-chip {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
      }
      .core {
        background-color: #e3f2fd;
        color: #1565c0;
      }
      .tenant {
        background-color: #e8f5e9;
        color: #388e3c;
      }
    `,
  ],
})
export class ReportDefinitionsListComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  readonly reports = signal<GetReportsResponse[]>([]);
  readonly hasError = signal(false);

  readonly columns: ColumnDef[] = [
    { key: 'reportName', label: 'Name', sortable: true },
    { key: 'reportType', label: 'Type', sortable: true },
    { key: 'reportCategory', label: 'Category', sortable: true },
    { key: 'coreReport', label: 'Origin', sortable: true },
    { key: 'useReport', label: 'In Use', sortable: true },
    { key: 'actions', label: 'Actions', sortable: false },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.hasError.set(false);
    this.reportsService.getReports().subscribe({
      next: (reports) => this.reports.set(reports),
      error: () => this.hasError.set(true),
    });
  }

  onCreate(): void {
    void this.router.navigate(['/system/report-definitions/create']);
  }

  onEdit(report: GetReportsResponse): void {
    void this.router.navigate(['/system/report-definitions/edit', report.id]);
  }

  async onDelete(report: GetReportsResponse): Promise<void> {
    if (report.coreReport || report.id === undefined) {
      return;
    }
    const confirmed = await this.dialog.confirm({
      title: this.i18n.translate('COMMON.DELETE'),
      message: this.i18n.translate('REPORT_DEFINITIONS.DELETE_CONFIRM'),
      details: [{ label: this.i18n.translate('COMMON.NAME'), value: report.reportName ?? '' }],
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.reportsService.deleteReportsId(report.id).subscribe({
      next: () => {
        this.notifications.success(this.i18n.translate('REPORT_DEFINITIONS.DELETED'));
        this.load();
      },
    });
  }
}
