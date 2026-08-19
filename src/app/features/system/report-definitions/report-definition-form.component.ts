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
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonToggle,
} from '@ionic/angular/standalone';

import { GetReportsResponse, ReportsService } from '../../../api';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { NotificationService } from '../../../core/services/notification.service';
import { HelpIconComponent } from '../../../shared';

/** What the create and update endpoints accept, which is wider than the generated PUT model. */
interface ReportDefinitionPayload {
  reportName?: string;
  reportType?: string;
  reportSubType?: string;
  reportCategory?: string;
  description?: string;
  reportSql?: string;
  useReport?: boolean;
  reportParameters?: { id?: number; parameterId?: number; reportParameterName?: string }[];
}

/**
 * Creating and editing a report definition.
 *
 * A core report is a special case the platform enforces rather than a convention: everything but
 * "in use" is rejected on update. So for a core report this form shows its definition read-only
 * and offers only that toggle — the alternative is a full form where every field silently fails
 * to save.
 *
 * The SQL is the report. It is left as free text on purpose: the platform validates it when the
 * report runs, and a client-side dialect check here would reject queries the server accepts.
 */
@Component({
  selector: 'app-report-definition-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    HelpIconComponent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonButton,
    IonSpinner,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              (isEdit() ? 'REPORT_DEFINITIONS.EDIT' : 'REPORT_DEFINITIONS.CREATE') | appTranslate
            }}
            <app-help-icon [helpTextKey]="'HELP.REPORT_DEFINITIONS_DESC'"></app-help-icon>
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          @if (!isModelReady()) {
            <ion-spinner data-testid="report-definition-loading"></ion-spinner>
          } @else {
            @if (isCoreReport()) {
              <p class="note" role="note" data-testid="report-definition-core-note">
                {{ 'REPORT_DEFINITIONS.CORE_READ_ONLY' | appTranslate }}
              </p>
            }

            <div class="form-grid">
              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.NAME' | appTranslate }}</ion-label>
                <ion-input
                  name="reportName"
                  data-testid="report-definition-name"
                  [attr.aria-label]="'COMMON.NAME' | appTranslate"
                  [disabled]="isCoreReport()"
                  [(ngModel)]="report.reportName"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.TYPE' | appTranslate }}</ion-label>
                <ion-select
                  interface="popover"
                  name="reportType"
                  data-testid="report-definition-type"
                  [attr.aria-label]="'COMMON.TYPE' | appTranslate"
                  [disabled]="isCoreReport()"
                  [(ngModel)]="report.reportType"
                >
                  @for (type of reportTypes(); track type) {
                    <ion-select-option [value]="type">{{ type }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              @if (report.reportType === 'Chart') {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'REPORT_DEFINITIONS.SUB_TYPE' | appTranslate
                  }}</ion-label>
                  <ion-select
                    interface="popover"
                    name="reportSubType"
                    data-testid="report-definition-sub-type"
                    [attr.aria-label]="'REPORT_DEFINITIONS.SUB_TYPE' | appTranslate"
                    [disabled]="isCoreReport()"
                    [(ngModel)]="report.reportSubType"
                  >
                    @for (subType of reportSubTypes(); track subType) {
                      <ion-select-option [value]="subType">{{ subType }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
              }

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'REPORT_DEFINITIONS.CATEGORY' | appTranslate
                }}</ion-label>
                <ion-input
                  name="reportCategory"
                  data-testid="report-definition-category"
                  [attr.aria-label]="'REPORT_DEFINITIONS.CATEGORY' | appTranslate"
                  [disabled]="isCoreReport()"
                  [(ngModel)]="report.reportCategory"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline" class="span-two">
                <ion-label position="stacked">{{ 'COMMON.DESCRIPTION' | appTranslate }}</ion-label>
                <ion-textarea
                  name="description"
                  data-testid="report-definition-description"
                  [attr.aria-label]="'COMMON.DESCRIPTION' | appTranslate"
                  [disabled]="isCoreReport()"
                  [(ngModel)]="report.description"
                ></ion-textarea>
              </ion-item>

              <ion-item fill="outline" class="span-two">
                <ion-label position="stacked">{{
                  'REPORT_DEFINITIONS.SQL' | appTranslate
                }}</ion-label>
                <ion-textarea
                  name="reportSql"
                  rows="8"
                  data-testid="report-definition-sql"
                  [attr.aria-label]="'REPORT_DEFINITIONS.SQL' | appTranslate"
                  [disabled]="isCoreReport()"
                  [(ngModel)]="report.reportSql"
                ></ion-textarea>
              </ion-item>

              <ion-item fill="outline">
                <ion-label>{{ 'REPORT_DEFINITIONS.IN_USE' | appTranslate }}</ion-label>
                <ion-toggle
                  name="useReport"
                  data-testid="report-definition-in-use"
                  [(ngModel)]="report.useReport"
                ></ion-toggle>
              </ion-item>
            </div>

            <div class="actions">
              <ion-button fill="outline" (click)="onCancel()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                data-testid="report-definition-save"
                [disabled]="!canSave || isSaving()"
                (click)="onSave()"
              >
                @if (isSaving()) {
                  <ion-spinner name="dots"></ion-spinner>
                } @else {
                  {{ 'COMMON.SAVE' | appTranslate }}
                }
              </ion-button>
            </div>
          }
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
      }
      .span-two {
        grid-column: 1 / -1;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-top: 16px;
      }
      .note {
        color: var(--ion-color-medium);
      }
    `,
  ],
})
export class ReportDefinitionFormComponent implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  readonly reportTypes = signal<string[]>([]);
  readonly reportSubTypes = signal<string[]>([]);
  readonly isSaving = signal(false);
  readonly isEdit = signal(false);
  readonly isCoreReport = signal(false);

  /**
   * Whether the model the form binds to is final.
   *
   * Editing loads the record after the view would otherwise exist, and `[(ngModel)]` writes its
   * value back in a microtask — the first change-detection pass reads undefined and the
   * verification pass reads the loaded name, which is NG0100. Same cause, same remedy as the loan
   * form: bind the fields only once there is something to bind them to.
   */
  readonly isModelReady = signal(false);

  report: ReportDefinitionPayload = { reportType: 'Table', useReport: true, reportParameters: [] };

  private reportId: number | undefined;

  get canSave(): boolean {
    if (this.isCoreReport()) {
      return true;
    }
    return !!this.report.reportName && !!this.report.reportType;
  }

  ngOnInit(): void {
    this.reportsService.getReportsTemplate().subscribe({
      next: (template) => {
        this.reportTypes.set((template.allowedReportTypes as string[]) ?? []);
        this.reportSubTypes.set((template.allowedReportSubTypes as string[]) ?? []);
      },
      error: () => {
        this.reportTypes.set([]);
        this.reportSubTypes.set([]);
      },
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.reportId = Number(id);
      this.isEdit.set(true);
      this.load(this.reportId);
    } else {
      this.isModelReady.set(true);
    }
  }

  private load(id: number): void {
    this.reportsService.getReportsId(id).subscribe({
      next: (report: GetReportsResponse) => {
        this.isCoreReport.set(report.coreReport === true);
        this.report = {
          reportName: report.reportName,
          reportType: report.reportType,
          reportSubType: report.reportSubType,
          reportCategory: report.reportCategory,
          description: report.description,
          reportSql: report.reportSql,
          useReport: report.useReport,
          reportParameters: report.reportParameters ?? [],
        };
        this.isModelReady.set(true);
      },
      // A failed load must still leave a usable screen rather than a spinner.
      error: () => this.isModelReady.set(true),
    });
  }

  onSave(): void {
    this.isSaving.set(true);

    // Core reports accept exactly one change; sending the rest earns a 403 that says so.
    const payload: ReportDefinitionPayload = this.isCoreReport()
      ? { useReport: this.report.useReport }
      : { ...this.report };

    const request$ =
      this.isEdit() && this.reportId !== undefined
        ? this.reportsService.putReportsId(this.reportId, payload)
        : this.reportsService.postReports(payload);

    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.notifications.success(this.i18n.translate('REPORT_DEFINITIONS.SAVED'));
        void this.router.navigate(['/system/report-definitions']);
      },
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    void this.router.navigate(['/system/report-definitions']);
  }
}
