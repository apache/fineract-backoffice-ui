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

import { Component, DestroyRef, NgZone, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import {
  I18N,
  SCHEDULER_JOB_API,
  type SchedulerJob,
  type SchedulerJobUpdate,
  TranslatePipe,
} from '../../../core/adapters';
import { ConfigService } from '../../../core/services/config.service';
import { PlatformDateService } from '../../../core/services/platform-date.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  type CronProblem,
  cronDateTimeIn,
  formatCronDateTime,
  nextFireTimes,
  parseQuartzCron,
} from '../../../core/utils/quartz-cron';
import { LoadErrorComponent } from '../../../shared/components/load-error/load-error.component';
import { ButtonComponent } from '../../../ui/button/button.component';
import { SpinnerComponent } from '../../../ui/spinner/spinner.component';

/** How many upcoming runs the preview lists. */
const PREVIEW_COUNT = 3;
/** How often the preview re-reads the clock. */
const PREVIEW_REFRESH_MS = 30_000;

/** What the cron field currently says about itself. */
type CronCheck =
  | { readonly state: 'empty' }
  | { readonly state: 'invalid'; readonly problem: CronProblem | { readonly kind: 'neverFires' } }
  | { readonly state: 'valid'; readonly nextRuns: readonly string[] };

/**
 * Edits one scheduler job: its display name, its Quartz cron expression and whether it is active.
 *
 * The expression is checked as it is typed, with the same rules Quartz applies on the server,
 * and a valid one previews its next runs. That preview is the point of the screen: a job like
 * interest posting or close-of-business that silently stops running is found days later, in the
 * accounts, and the next fire times are how an administrator sees that before saving.
 */
@Component({
  selector: 'app-scheduler-job-form',
  standalone: true,
  imports: [FormsModule, TranslatePipe, ButtonComponent, SpinnerComponent, LoadErrorComponent],
  template: `
    <div class="form-container">
      <section class="entity-card">
        <h2>{{ 'SCHEDULER_JOBS.EDIT_JOB' | appTranslate }}</h2>

        @if (isLoading()) {
          <app-spinner data-testid="scheduler-job-loading" />
        } @else if (loadFailed()) {
          <app-load-error
            testId="scheduler-job-load-error"
            [message]="'SCHEDULER_JOBS.LOAD_FAILED' | appTranslate"
            [actionLabel]="(canRetry() ? 'COMMON.RETRY' : 'COMMON.BACK') | appTranslate"
            (action)="canRetry() ? load() : onCancel()"
          />
        } @else {
          @if (currentlyRunning()) {
            <p class="notice" role="status" data-testid="scheduler-job-running">
              {{ 'SCHEDULER_JOBS.CURRENTLY_RUNNING' | appTranslate }}
            </p>
          }
          <form #jobForm="ngForm" (ngSubmit)="onSubmit()">
            <fieldset [disabled]="currentlyRunning()">
              <div class="form-grid">
                <div class="form-field full-width">
                  <label for="displayName">{{
                    'SCHEDULER_JOBS.DISPLAY_NAME' | appTranslate
                  }}</label>
                  <input
                    id="displayName"
                    type="text"
                    name="displayName"
                    data-testid="scheduler-job-display-name"
                    required
                    [ngModel]="displayName()"
                    (ngModelChange)="displayName.set($event)"
                  />
                </div>

                <div class="form-field full-width">
                  <label for="cronExpression">{{
                    'SCHEDULER_JOBS.CRON_EXPRESSION' | appTranslate
                  }}</label>
                  <input
                    id="cronExpression"
                    type="text"
                    name="cronExpression"
                    data-testid="scheduler-job-cron"
                    required
                    spellcheck="false"
                    autocomplete="off"
                    aria-describedby="cronExpression-hint cronExpression-check"
                    [attr.aria-invalid]="cronCheck().state === 'invalid'"
                    [ngModel]="cronExpression()"
                    (ngModelChange)="cronExpression.set($event)"
                  />
                  <span id="cronExpression-hint" class="hint">{{
                    'SCHEDULER_JOBS.CRON_HINT' | appTranslate
                  }}</span>
                  <!-- Only the error is announced: the run list changes on every keystroke. -->
                  <div id="cronExpression-check">
                    <span class="error" aria-live="polite" data-testid="scheduler-job-cron-error">{{
                      cronError()
                    }}</span>
                    @switch (cronCheck().state) {
                      @case ('valid') {
                        <span class="hint">{{ nextRunsLabel() }}</span>
                        <ul class="next-runs" data-testid="scheduler-job-next-runs">
                          @for (run of nextRuns(); track run) {
                            <li>{{ run }}</li>
                          }
                        </ul>
                      }
                    }
                  </div>
                </div>

                <div class="form-field full-width">
                  <label class="checkbox">
                    <input
                      type="checkbox"
                      name="active"
                      data-testid="scheduler-job-active"
                      [ngModel]="active()"
                      (ngModelChange)="active.set($event)"
                    />
                    {{ 'SCHEDULER_JOBS.ACTIVE' | appTranslate }}
                  </label>
                </div>
              </div>

              <p class="warning">{{ 'SCHEDULER_JOBS.SCHEDULE_WARNING' | appTranslate }}</p>
            </fieldset>

            <div class="form-actions">
              <app-button
                type="button"
                intent="secondary"
                emphasis="quiet"
                [disabled]="isSaving()"
                (click)="onCancel()"
                >{{ 'COMMON.CANCEL' | appTranslate }}</app-button
              >
              <app-button
                type="submit"
                intent="primary"
                data-testid="scheduler-job-save"
                [disabled]="!canSave() || !!jobForm.invalid"
                >{{ (isSaving() ? 'COMMON.SAVING' : 'COMMON.SAVE') | appTranslate }}</app-button
              >
            </div>
          </form>
        }
      </section>
    </div>
  `,
  styles: [
    `
      .entity-card {
        background: var(--card-bg);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 24px;
      }
      h2 {
        margin: 0 0 16px;
        font-size: 1.1rem;
      }
      fieldset {
        border: 0;
        margin: 0;
        padding: 0;
        min-width: 0;
      }
      .hint {
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .error {
        font-size: 0.75rem;
        color: var(--error-color);
      }
      .next-runs {
        margin: 4px 0 0;
        padding-inline-start: 20px;
        font-family: monospace;
        font-size: 0.85rem;
      }
      .form-field label.checkbox {
        flex-direction: row;
        font-size: 0.9rem;
        color: var(--text-color);
      }
      .form-field label.checkbox input {
        width: auto;
      }
      .notice,
      .warning {
        font-size: 0.85rem;
        color: var(--text-muted);
      }
    `,
  ],
})
export class SchedulerJobFormComponent implements OnInit {
  private readonly jobApi = inject(SCHEDULER_JOB_API);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly platformDate = inject(PlatformDateService);
  private readonly config = inject(ConfigService);

  private readonly LIST_PATH = '/system/scheduler-jobs';

  private jobId?: number;
  /** False when no retry can load the job (a malformed id, a 403 or a 404); the action leaves. */
  readonly canRetry = signal(true);

  readonly displayName = signal('');
  readonly cronExpression = signal('');
  readonly active = signal(false);
  readonly currentlyRunning = signal(false);
  /** The job as loaded, so a save sends only what the administrator changed. */
  private readonly loaded = signal<SchedulerJob | null>(null);

  readonly isLoading = signal(false);
  readonly loadFailed = signal(false);
  readonly isSaving = signal(false);

  /** The platform's clock, re-read so a form left open does not list past runs. */
  private readonly now = signal(this.platformDate.serverNow());

  /** Quartz fires Fineract's triggers in the tenant's zone, so the preview counts in it too. */
  private readonly timeZone = computed(() => this.config.config().tenantTimezone ?? null);

  readonly nextRunsLabel = computed(() => {
    // `translate` reads no signal; reading the language makes a switch rebuild the label.
    this.i18n.currentLang();
    const zone = this.timeZone();
    return zone
      ? this.i18n.translate('SCHEDULER_JOBS.NEXT_RUNS_IN_ZONE', { zone })
      : this.i18n.translate('SCHEDULER_JOBS.NEXT_RUNS');
  });

  readonly cronCheck = computed<CronCheck>(() => {
    const expression = this.cronExpression().trim();
    if (!expression) return { state: 'empty' };
    const parsed = parseQuartzCron(expression);
    if (!parsed.ok) return { state: 'invalid', problem: parsed.problem };
    const after = cronDateTimeIn(this.now(), this.timeZone());
    const runs = nextFireTimes(parsed.schedule, after, PREVIEW_COUNT);
    if (runs.length === 0) return { state: 'invalid', problem: { kind: 'neverFires' } };
    return { state: 'valid', nextRuns: runs.map(formatCronDateTime) };
  });

  readonly nextRuns = computed(() => {
    const check = this.cronCheck();
    return check.state === 'valid' ? check.nextRuns : [];
  });

  readonly cronError = computed(() => {
    const check = this.cronCheck();
    if (check.state !== 'invalid') return '';
    const problem = check.problem;
    switch (problem.kind) {
      case 'fieldCount':
        return this.i18n.translate('SCHEDULER_JOBS.CRON_FIELD_COUNT');
      case 'dayConflict':
        return this.i18n.translate('SCHEDULER_JOBS.CRON_DAY_CONFLICT');
      case 'neverFires':
        return this.i18n.translate('SCHEDULER_JOBS.CRON_NEVER_FIRES');
      case 'field':
        return this.i18n.translate('SCHEDULER_JOBS.CRON_INVALID_FIELD', {
          field: this.i18n.translate(CRON_FIELD_LABELS[problem.field]),
          value: problem.value,
        });
    }
  });

  /** The fields that differ from the loaded job. Empty means there is nothing to save. */
  readonly changes = computed<SchedulerJobUpdate>(() => {
    const job = this.loaded();
    if (!job) return {};
    const displayName = this.displayName().trim();
    const cronExpression = this.cronExpression().trim();
    return {
      ...(displayName === job.displayName.trim() ? {} : { displayName }),
      ...(cronExpression === job.cronExpression.trim() ? {} : { cronExpression }),
      ...(this.active() === job.active ? {} : { active: this.active() }),
    };
  });

  /**
   * A stored expression this parser refuses must not block other edits: unticking Active is how
   * an administrator stops a job, so the cron is only required to be valid when it was changed.
   */
  readonly canSave = computed(() => {
    const changes = this.changes();
    return (
      !this.isSaving() &&
      !this.currentlyRunning() &&
      Object.keys(changes).length > 0 &&
      changes.displayName !== '' &&
      (changes.cronExpression === undefined || this.cronCheck().state === 'valid')
    );
  });

  constructor() {
    // Outside the zone, so a timer that never ends does not keep the page from going stable;
    // the signal write still schedules change detection.
    const tick = inject(NgZone).runOutsideAngular(() =>
      setInterval(() => this.now.set(this.platformDate.serverNow()), PREVIEW_REFRESH_MS),
    );
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isInteger(id) && id > 0) {
      this.jobId = id;
      this.load();
    } else {
      // Nothing to retry: a malformed id never loads.
      this.canRetry.set(false);
      this.loadFailed.set(true);
    }
  }

  load(): void {
    if (!this.jobId) return;
    this.isLoading.set(true);
    this.loadFailed.set(false);
    this.jobApi.get(this.jobId).subscribe({
      next: (job) => {
        this.loaded.set(job);
        this.displayName.set(job.displayName);
        this.cronExpression.set(job.cronExpression);
        this.active.set(job.active);
        this.currentlyRunning.set(job.currentlyRunning);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        // Neither a missing job nor a refused read changes on retry.
        const final = error instanceof HttpErrorResponse && [403, 404].includes(error.status);
        this.canRetry.set(!final);
        this.loadFailed.set(true);
        this.isLoading.set(false);
      },
    });
  }

  onSubmit(): void {
    // The button is disabled in these states, but a second Enter can land before it is.
    if (!this.jobId || !this.canSave()) return;
    const jobId = this.jobId;
    const changes = this.changes();
    this.isSaving.set(true);
    // Fineract does not refuse a PUT while the job runs, and rescheduling clears its running
    // flag, which can let a second run start on top. Checking again just before saving narrows
    // that window from "since the form opened" to one round trip.
    this.jobApi
      .get(jobId)
      .pipe(
        switchMap((latest) => {
          if (!latest.currentlyRunning) return this.jobApi.update(jobId, changes);
          this.currentlyRunning.set(true);
          this.isSaving.set(false);
          void this.notifications.error(this.i18n.translate('SCHEDULER_JOBS.STARTED_RUNNING'));
          return EMPTY;
        }),
      )
      .subscribe({
        next: (outcome) => {
          void this.notifications.success(
            this.i18n.translate(
              outcome.pendingApproval
                ? 'SCHEDULER_JOBS.SUBMITTED_FOR_APPROVAL'
                : 'SCHEDULER_JOBS.SAVED',
            ),
          );
          // Back to the list, which reloads and shows the next run the platform computed.
          void this.router.navigate([this.LIST_PATH]);
        },
        error: () => this.isSaving.set(false),
      });
  }

  onCancel(): void {
    void this.router.navigate([this.LIST_PATH]);
  }
}

const CRON_FIELD_LABELS = {
  second: 'SCHEDULER_JOBS.CRON_FIELD_SECOND',
  minute: 'SCHEDULER_JOBS.CRON_FIELD_MINUTE',
  hour: 'SCHEDULER_JOBS.CRON_FIELD_HOUR',
  dayOfMonth: 'SCHEDULER_JOBS.CRON_FIELD_DAY_OF_MONTH',
  month: 'SCHEDULER_JOBS.CRON_FIELD_MONTH',
  dayOfWeek: 'SCHEDULER_JOBS.CRON_FIELD_DAY_OF_WEEK',
  year: 'SCHEDULER_JOBS.CRON_FIELD_YEAR',
} as const;
