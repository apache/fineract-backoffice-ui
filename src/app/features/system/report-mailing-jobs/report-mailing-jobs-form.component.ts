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
import { TranslatePipe } from '../../../core/adapters';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';
import {
  ReportMailingJobsService,
  ReportsService,
  EnumOptionData,
  GetReportsResponse,
  PostReportMailingJobsRequest,
  PutReportMailingJobsRequest,
} from '../../../api';
import { FINERACT_LOCALE } from '../../../core/utils/date-formatter';

/**
 * Create / edit form for a report-mailing job.
 *
 * `locale` is not optional decoration. `stretchyReportId` is a locale-sensitive parameter, so
 * the platform refuses any payload carrying it without one — "[stretchyReportId] The parameter
 * `stretchyReportId` requires a `locale` parameter to be passed with it". Both the create and the
 * update payload omitted it, which meant neither had ever succeeded.
 *
 * `startDateTime` and `recurrence` are what make the job a *scheduled* job; without them the
 * platform stores a row that never runs, so fixing `locale` alone would have traded a visible
 * failure for a silent one.
 */
type ReportMailingJobUpdate = PutReportMailingJobsRequest & {
  name?: string;
  description?: string;
  emailRecipients?: string;
  emailSubject?: string;
  emailMessage?: string;
  stretchyReportId?: number;
  emailAttachmentFileFormatId?: number;
  startDateTime?: string;
  recurrence?: string;
  isActive?: boolean;
  locale?: string;
  dateFormat?: string;
};

/**
 * The attachment format, which the platform requires and the generated request model omits.
 *
 * Asking `POST /reportmailingjobs` for the minimum names four mandatory parameters:
 * `startDateTime`, `emailMessage`, `emailAttachmentFileFormatId` and `dateFormat`. This form sent
 * none of them.
 */
type ReportMailingJobCreate = PostReportMailingJobsRequest & {
  emailAttachmentFileFormatId?: number;
};

/** The default cadence, and the one the recurrence picker starts on. */
const DAILY_RECURRENCE = 'FREQ=DAILY;INTERVAL=1';

/**
 * `startDateTime` carries a time, so the payload's `dateFormat` has to as well.
 *
 * Not the `dd MMMM yyyy` this codebase uses everywhere else: with a time appended, the platform
 * throws a 500 rather than parsing it. `yyyy-MM-dd HH:mm:ss` is the shape it accepts.
 */
const DATE_TIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';

/**
 * The report the job is wired to.
 *
 * The generated model types `stretchyReport` as `object`, so the id has to be read defensively:
 * a cast to a hand-written shape would go stale silently the next time the spec is regenerated.
 */
function reportIdOf(stretchyReport: object | undefined): number | undefined {
  if (!stretchyReport || !('id' in stretchyReport)) {
    return undefined;
  }
  const { id } = stretchyReport as { id?: unknown };
  return typeof id === 'number' ? id : undefined;
}

/** Turns the `yyyy-MM-ddTHH:mm` an `<input type="datetime-local">` produces into that shape. */
function toFineractDateTime(localValue: string): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(localValue);
  return match ? `${match[1]} ${match[2]}:00` : undefined;
}

/** The inverse, for populating the control when editing. */
function toDateTimeLocal(value: string | undefined): string {
  if (!value) {
    return '';
  }
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(value);
  return match ? `${match[1]}T${match[2]}` : '';
}

@Component({
  selector: 'app-report-mailing-jobs-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonCheckbox,
    IonNote,
    IonSelect,
    IonSelectOption,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('REPORT_MAILING_JOBS.EDIT' | appTranslate)
                : ('REPORT_MAILING_JOBS.CREATE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #jobForm="ngForm" (ngSubmit)="onSubmit()" class="entity-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'REPORT_MAILING_JOBS.NAME' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'REPORT_MAILING_JOBS.NAME' | appTranslate"
                name="name"
                [(ngModel)]="job().name"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'REPORT_MAILING_JOBS.DESCRIPTION' | appTranslate
              }}</ion-label>
              <ion-textarea
                [attr.aria-label]="'REPORT_MAILING_JOBS.DESCRIPTION' | appTranslate"
                name="description"
                [(ngModel)]="job().description"
              ></ion-textarea>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'REPORT_MAILING_JOBS.EMAIL_RECIPIENTS' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'REPORT_MAILING_JOBS.EMAIL_RECIPIENTS' | appTranslate"
                name="emailRecipients"
                [(ngModel)]="job().emailRecipients"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'REPORT_MAILING_JOBS.EMAIL_SUBJECT' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'REPORT_MAILING_JOBS.EMAIL_SUBJECT' | appTranslate"
                name="emailSubject"
                [(ngModel)]="job().emailSubject"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'REPORT_MAILING_JOBS.EMAIL_MESSAGE' | appTranslate
              }}</ion-label>
              <ion-textarea
                [attr.aria-label]="'REPORT_MAILING_JOBS.EMAIL_MESSAGE' | appTranslate"
                name="emailMessage"
                [(ngModel)]="job().emailMessage"
              ></ion-textarea>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'REPORT_MAILING_JOBS.STRETCHY_REPORT_ID' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'REPORT_MAILING_JOBS.STRETCHY_REPORT_ID' | appTranslate"
                interface="popover"
                name="stretchyReportId"
                data-testid="report-mailing-job-report"
                [(ngModel)]="job().stretchyReportId"
                required
              >
                @for (report of reports(); track report.id) {
                  <ion-select-option [value]="report.id">{{ report.reportName }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'REPORT_MAILING_JOBS.ATTACHMENT_FORMAT' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'REPORT_MAILING_JOBS.ATTACHMENT_FORMAT' | appTranslate"
                interface="popover"
                name="emailAttachmentFileFormatId"
                data-testid="report-mailing-job-format"
                [(ngModel)]="attachmentFormatId"
                required
              >
                @for (format of attachmentFormats(); track format.id) {
                  <ion-select-option [value]="format.id">{{ format.value }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'REPORT_MAILING_JOBS.START_DATE_TIME' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'REPORT_MAILING_JOBS.START_DATE_TIME' | appTranslate"
                type="datetime-local"
                name="startDateTime"
                data-testid="report-mailing-job-start"
                [(ngModel)]="startDateTimeLocal"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'REPORT_MAILING_JOBS.RECURRENCE' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'REPORT_MAILING_JOBS.RECURRENCE' | appTranslate"
                interface="popover"
                name="recurrence"
                data-testid="report-mailing-job-recurrence"
                [(ngModel)]="job().recurrence"
              >
                @for (option of recurrenceOptions; track option.value) {
                  <ion-select-option [value]="option.value">{{
                    option.label | appTranslate
                  }}</ion-select-option>
                }
              </ion-select>
            </ion-item>
            <ion-note class="field-hint">{{
              'REPORT_MAILING_JOBS.RECURRENCE_HINT' | appTranslate
            }}</ion-note>

            <ion-checkbox name="isActive" [(ngModel)]="job().isActive">
              {{ 'REPORT_MAILING_JOBS.IS_ACTIVE' | appTranslate }}
            </ion-checkbox>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="jobForm.invalid || isSaving()">
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | appTranslate }}
                } @else {
                  {{ 'COMMON.SAVE' | appTranslate }}
                }
              </ion-button>
            </div>
          </form>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 24px;
        max-width: 600px;
        margin: 0 auto;
      }
      .entity-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class ReportMailingJobsFormComponent implements OnInit {
  private readonly jobsService = inject(ReportMailingJobsService);
  private readonly reportsService = inject(ReportsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/system/report-mailing-jobs';

  jobId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly job = signal<PostReportMailingJobsRequest>({
    name: '',
    emailRecipients: '',
    emailSubject: '',
    isActive: true,
    recurrence: DAILY_RECURRENCE,
  });

  /** Reports the job can mail, so the operator picks one instead of recalling its numeric id. */
  readonly reports = signal<GetReportsResponse[]>([]);

  /** XLS / PDF / CSV, from `GET /reportmailingjobs/template`. */
  readonly attachmentFormats = signal<EnumOptionData[]>([]);
  attachmentFormatId?: number;

  /**
   * Bound to `<input type="datetime-local">`, whose value is always `yyyy-MM-ddTHH:mm`.
   *
   * Kept apart from `job().startDateTime` because the platform wants it in the same
   * `dd MMMM yyyy HH:mm` shape as every other date it is sent, and converting on submit keeps
   * the control's own format from leaking into the payload.
   */
  startDateTimeLocal = '';

  /**
   * The recurrences worth offering, as iCalendar RRULEs — the format
   * `POST /reportmailingjobs` expects. A free-text box here would be a way to fail validation.
   */
  readonly recurrenceOptions = [
    { value: DAILY_RECURRENCE, label: 'REPORT_MAILING_JOBS.RECURRENCE_DAILY' },
    { value: 'FREQ=WEEKLY;INTERVAL=1', label: 'REPORT_MAILING_JOBS.RECURRENCE_WEEKLY' },
    { value: 'FREQ=MONTHLY;INTERVAL=1', label: 'REPORT_MAILING_JOBS.RECURRENCE_MONTHLY' },
  ];

  ngOnInit(): void {
    this.reportsService.getReports().subscribe({
      next: (data) => this.reports.set(data ?? []),
      error: () => this.reports.set([]),
    });
    this.jobsService.getReportmailingjobsTemplate().subscribe({
      next: (template) => {
        const options = template.emailAttachmentFileFormatOptions ?? [];
        this.attachmentFormats.set(options);
        this.attachmentFormatId ??= options[0]?.id;
      },
      error: () => this.attachmentFormats.set([]),
    });
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.jobId = +id;
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  load(): void {
    if (!this.jobId) return;
    this.jobsService.getReportmailingjobsEntityId(this.jobId).subscribe((data) => {
      this.job.set({
        name: data.name,
        description: data.description,
        emailRecipients: data.emailRecipients,
        emailSubject: data.emailSubject,
        emailMessage: data.emailMessage,
        recurrence: data.recurrence ?? DAILY_RECURRENCE,
        stretchyReportId: reportIdOf(data.stretchyReport),
        isActive: data.isActive,
      });
      this.startDateTimeLocal = toDateTimeLocal(data.startDateTime);
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const startDateTime = toFineractDateTime(this.startDateTimeLocal);
    let request$;
    if (this.isEditMode() && this.jobId) {
      const update: ReportMailingJobUpdate = {
        name: this.job().name,
        description: this.job().description,
        emailRecipients: this.job().emailRecipients,
        emailSubject: this.job().emailSubject,
        emailMessage: this.job().emailMessage,
        stretchyReportId: this.job().stretchyReportId,
        emailAttachmentFileFormatId: this.attachmentFormatId,
        recurrence: this.job().recurrence,
        ...(startDateTime ? { startDateTime } : {}),
        isActive: this.job().isActive,
        locale: FINERACT_LOCALE,
        dateFormat: DATE_TIME_FORMAT,
      };
      request$ = this.jobsService.putReportmailingjobsEntityId(this.jobId, update);
    } else {
      const create: ReportMailingJobCreate = {
        ...this.job(),
        emailAttachmentFileFormatId: this.attachmentFormatId,
        ...(startDateTime ? { startDateTime } : {}),
        locale: FINERACT_LOCALE,
        dateFormat: DATE_TIME_FORMAT,
      };
      request$ = this.jobsService.postReportmailingjobs(create);
    }

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
