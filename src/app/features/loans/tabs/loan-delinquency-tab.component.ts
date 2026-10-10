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

import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle } from '@ionic/angular/standalone';
import { forkJoin } from 'rxjs';

import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
  HasPermissionDirective,
} from '../../../shared';
import { I18N, TranslatePipe } from '../../../core/adapters';
import {
  BusinessDateManagementService,
  GetLoansLoanIdDelinquencySummary,
  LoansService,
} from '../../../api';
import { skipErrorToast } from '../../../core/http/http-context';
import { DialogService } from '../../../core/services/dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatDateToFineract,
} from '../../../core/utils/date-formatter';
import { ButtonComponent } from '../../../ui/button/button.component';
import {
  DELINQUENCY_ACTION,
  LoanDelinquencyPauseResult,
  canResume,
  toIsoDay,
} from './loan-delinquency-action.model';

/**
 * How far behind a loan is, and why — and the two things an officer can do about it: pause
 * delinquency for an agreed period, and resume it early (#505).
 *
 * "How overdue is this, and by how much" is the most-asked question about a loan, and until now
 * the screen made an officer derive it from the schedule and the transaction list. The platform
 * has the answer computed.
 *
 * The summary arrives as an input — `delinquent` is already on the loan response the parent
 * fetched. The tags and the pause/resume history are separate resources, so those are fetched
 * here, together, and a failure gives the tables a retry rather than an empty state that reads
 * as "not delinquent" (issue #223).
 *
 * A pause or a resume changes the loan, not this tab's own data, so a success is reported to the
 * parent through `changed` and the parent re-reads the loan that the summary comes from.
 */
@Component({
  selector: 'app-loan-delinquency-tab',
  standalone: true,
  imports: [
    DecimalPipe,
    TranslatePipe,
    ButtonComponent,
    CellTemplateDirective,
    DataTableComponent,
    HasPermissionDirective,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'LOANS.DELINQUENCY_SUMMARY' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content class="summary-grid">
        <div class="summary-item">
          <span class="label">{{ 'LOANS.PAST_DUE_DAYS' | appTranslate }}</span>
          <span class="value" data-testid="loan-past-due-days">
            {{ summary()?.pastDueDays ?? 0 }}
          </span>
        </div>
        <div class="summary-item">
          <span class="label">{{ 'LOANS.DELINQUENT_DAYS' | appTranslate }}</span>
          <span class="value" data-testid="loan-delinquent-days">
            {{ summary()?.delinquentDays ?? 0 }}
          </span>
        </div>
        <div class="summary-item">
          <span class="label">{{ 'LOANS.DELINQUENT_AMOUNT' | appTranslate }}</span>
          <span class="value" data-testid="loan-delinquent-amount">
            {{ summary()?.delinquentAmount | number }}
          </span>
        </div>
        <div class="summary-item">
          <span class="label">{{ 'LOANS.NEXT_PAYMENT_DUE' | appTranslate }}</span>
          <span class="value">{{ displayDate(summary()?.nextPaymentDueDate) }}</span>
        </div>
        <div class="summary-item">
          <span class="label">{{ 'LOANS.NEXT_PAYMENT_AMOUNT' | appTranslate }}</span>
          <span class="value">{{ summary()?.nextPaymentAmount | number }}</span>
        </div>
        <div class="summary-item">
          <span class="label">{{ 'LOANS.LAST_REPAYMENT' | appTranslate }}</span>
          <span class="value">{{ displayDate(summary()?.lastRepaymentDate) }}</span>
        </div>
      </ion-card-content>
    </ion-card>

    <h3 class="section-title">{{ 'LOANS.DELINQUENCY_TAGS' | appTranslate }}</h3>
    <app-data-table
      [data]="tags()"
      [columns]="tagColumns"
      [isLoading]="isLoading()"
      [hasError]="hasError()"
      (retry)="load()"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="addedOnDate" let-row>{{
        displayDate(row.addedOnDate)
      }}</ng-template>
      <ng-template appCellTemplate="liftedOnDate" let-row>{{
        displayDate(row.liftedOnDate)
      }}</ng-template>
    </app-data-table>

    <div class="section-header">
      <h3 class="section-title">{{ 'LOANS.DELINQUENCY_PAUSES' | appTranslate }}</h3>
      @if (isActive()) {
        <div class="section-actions" *appHasPermission="'CREATE_DELINQUENCY_ACTION'">
          <app-button
            type="button"
            intent="primary"
            emphasis="outline"
            icon="pause-outline"
            data-testid="loan-delinquency-pause"
            [busy]="isActing()"
            (click)="onPause()"
          >
            {{ 'LOANS.PAUSE_DELINQUENCY' | appTranslate }}
          </app-button>
          @if (resumable()) {
            <app-button
              type="button"
              intent="primary"
              emphasis="outline"
              icon="play-outline"
              data-testid="loan-delinquency-resume"
              [busy]="isActing()"
              (click)="onResume()"
            >
              {{ 'LOANS.RESUME_DELINQUENCY' | appTranslate }}
            </app-button>
          }
        </div>
      }
    </div>
    <app-data-table [data]="pausePeriods()" [columns]="pauseColumns" [localLogic]="true">
      <ng-template appCellTemplate="pausePeriodStart" let-row>{{
        displayDate(row.pausePeriodStart)
      }}</ng-template>
      <ng-template appCellTemplate="pausePeriodEnd" let-row>{{
        displayDate(row.pausePeriodEnd)
      }}</ng-template>
      <ng-template appCellTemplate="active" let-row>{{
        (row.active ? 'LOANS.PAUSE_IN_EFFECT' : 'LOANS.PAUSE_NOT_IN_EFFECT') | appTranslate
      }}</ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px 24px;
      }
      .summary-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .summary-item .label {
        font-size: 12px;
        color: var(--text-muted, #6b7280);
      }
      .summary-item .value {
        font-size: 16px;
        font-weight: 600;
      }
      .section-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin: 24px 0 8px;
      }
      .section-header .section-title {
        margin: 0;
      }
      .section-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .section-title {
        margin: 24px 0 8px;
        font-size: 1rem;
      }
    `,
  ],
})
export class LoanDelinquencyTabComponent implements OnInit {
  readonly loanId = input.required<number>();
  readonly summary = input<GetLoansLoanIdDelinquencySummary | undefined>(undefined);
  /** Delinquency actions are accepted only on an active loan; the platform refuses the rest. */
  readonly isActive = input(false);

  /** A pause or a resume went through: the loan the summary came from is out of date. */
  readonly changed = output<void>();

  private readonly loansService = inject(LoansService);
  private readonly businessDateService = inject(BusinessDateManagementService);
  private readonly dialogs = inject(DialogService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  readonly tags = signal<unknown[]>([]);
  readonly actions = signal<unknown[]>([]);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);
  /** A pause or resume request is in flight; both buttons wait for it. */
  readonly isActing = signal(false);

  /** The platform's business date as `YYYY-MM-DD`, once known. */
  readonly businessDate = signal<string | undefined>(undefined);

  /** Pause periods ride along on the summary rather than being a resource of their own. */
  readonly pausePeriods = computed(() => this.summary()?.delinquencyPausePeriods ?? []);

  readonly resumable = computed(() => canResume(this.pausePeriods(), this.businessDate()));

  tagColumns: ColumnDef[] = [
    { key: 'classification', label: 'LOANS.CLASSIFICATION' },
    { key: 'addedOnDate', label: 'LOANS.ADDED_ON' },
    { key: 'liftedOnDate', label: 'LOANS.LIFTED_ON' },
  ];

  pauseColumns: ColumnDef[] = [
    { key: 'pausePeriodStart', label: 'LOANS.PAUSE_START' },
    { key: 'pausePeriodEnd', label: 'LOANS.PAUSE_END' },
    { key: 'active', label: 'COMMON.STATUS' },
  ];

  ngOnInit(): void {
    this.load();
    this.loadBusinessDate();
  }

  /** A date from the platform, as the `YYYY-MM-DD` it is shown in; `-` when there is none. */
  displayDate(value: unknown): string {
    return toIsoDay(value) || '-';
  }

  /**
   * Not part of the tab's own load: it only dates a pause and decides whether a resume can be
   * offered, so a failure must not put the tables into their error state. The toast is skipped
   * for the same reason — the header reads the same date and reports its own failure — and
   * without a date the tab simply does not offer Resume.
   */
  private loadBusinessDate(): void {
    this.businessDateService
      .getBusinessdate('body', false, { context: skipErrorToast() })
      .subscribe({
        next: (dates) => {
          const business = dates.find(({ type }) => type === 'BUSINESS_DATE');
          this.businessDate.set(toIsoDay(business?.date) || undefined);
        },
        error: () => undefined,
      });
  }

  async onPause(): Promise<void> {
    const { LoanDelinquencyPauseDialogComponent } =
      await import('./loan-delinquency-pause-dialog.component');
    const period = await this.dialogs.open<LoanDelinquencyPauseResult>(
      LoanDelinquencyPauseDialogComponent,
      { data: { businessDate: this.businessDate() } },
    );
    if (!period) return;

    this.submit(
      {
        action: DELINQUENCY_ACTION.Pause,
        startDate: formatDateToFineract(period.startDate),
        endDate: formatDateToFineract(period.endDate),
      },
      'LOANS.DELINQUENCY_PAUSED',
    );
  }

  async onResume(): Promise<void> {
    const businessDate = this.businessDate();
    if (!businessDate) return;

    const confirmed = await this.dialogs.confirm({
      title: this.i18n.translate('LOANS.RESUME_DELINQUENCY'),
      message: this.i18n.translate('LOANS.CONFIRM_RESUME_DELINQUENCY'),
      details: [{ label: this.i18n.translate('LOANS.RESUME_DATE'), value: businessDate }],
    });
    if (!confirmed) return;

    // The platform takes a resume only on the business date and with no end date; there is
    // nothing else to send, and an `endDate` here is refused outright.
    this.submit(
      { action: DELINQUENCY_ACTION.Resume, startDate: formatDateToFineract(businessDate) },
      'LOANS.DELINQUENCY_RESUMED',
    );
  }

  private submit(
    action: { action: string; startDate: string; endDate?: string },
    successKey: string,
  ): void {
    this.isActing.set(true);
    this.loansService
      .postLoansLoanIdDelinquencyActions(this.loanId(), {
        ...action,
        dateFormat: FINERACT_DATE_FORMAT,
        locale: FINERACT_LOCALE,
      })
      .subscribe({
        next: () => {
          this.isActing.set(false);
          this.notifications.success(this.i18n.translate(successKey));
          this.changed.emit();
          this.load();
        },
        // No toast here: errorInterceptor already raises one with the platform's own message.
        error: () => this.isActing.set(false),
      });
  }

  load(): void {
    this.isLoading.set(true);
    // Fetched together: two tables that describe one thing should not be able to disagree
    // about whether the load succeeded.
    forkJoin({
      tags: this.loansService.getLoansLoanIdDelinquencytags(this.loanId()),
      actions: this.loansService.getLoansLoanIdDelinquencyActions(this.loanId()),
    }).subscribe({
      next: ({ tags, actions }) => {
        this.tags.set((tags as unknown[]) ?? []);
        this.actions.set((actions as unknown[]) ?? []);
        this.hasError.set(false);
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }
}
