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

import { Component, inject, signal } from '@angular/core';
import type { Observable } from 'rxjs';

import {
  I18N,
  TranslatePipe,
  WORKING_CAPITAL_LOAN_TEST_TOOLS_API,
} from '../../../../core/adapters';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../ui/button/button.component';

/**
 * Drives a working-capital loan into states the ordinary commands cannot reach.
 *
 * Tooling for a test instance, not a product screen: every command here is a
 * `/v1/internal/**` endpoint, which Fineract serves only under its `test` Spring profile. On a
 * normal deployment they answer 404, which is why the route is behind `developerToolsGuard` and
 * the screen says so before offering anything.
 *
 * The optional date parameters each endpoint accepts are left to the platform's own default.
 * Their expected format cannot be verified without an instance running that profile, and a
 * guessed format would turn a tool into a source of confusing 400s; the port accepts them for
 * when there is somewhere to check them against.
 */
@Component({
  selector: 'app-wc-loan-test-tools',
  standalone: true,
  imports: [TranslatePipe, ButtonComponent],
  template: `
    <div class="tools-container">
      <h1 class="page-title">{{ 'WC_LOAN_TEST_TOOLS.TITLE' | appTranslate }}</h1>
      <p class="test-only" role="note" data-testid="wc-test-tools-notice">
        {{ 'WC_LOAN_TEST_TOOLS.TEST_ONLY' | appTranslate }}
      </p>

      <div class="field">
        <label for="wc-test-tools-loan-id">
          {{ 'WC_LOAN_TEST_TOOLS.LOAN_ID' | appTranslate }}
        </label>
        <input
          id="wc-test-tools-loan-id"
          data-testid="wc-test-tools-loan-id"
          type="number"
          min="1"
          [value]="loanId() ?? ''"
          (input)="onLoanIdChange($event)"
        />
      </div>

      <div class="actions">
        <app-button
          type="button"
          intent="primary"
          data-testid="wc-test-tools-activate"
          [disabled]="!canRun()"
          (click)="onActivate()"
          >{{ 'WC_LOAN_TEST_TOOLS.ACTIVATE' | appTranslate }}</app-button
        >
        <app-button
          type="button"
          intent="neutral"
          data-testid="wc-test-tools-schedule"
          [disabled]="!canRun()"
          (click)="onRegenerateSchedule()"
          >{{ 'WC_LOAN_TEST_TOOLS.REGENERATE_SCHEDULE' | appTranslate }}</app-button
        >
        <app-button
          type="button"
          intent="neutral"
          data-testid="wc-test-tools-delinquency"
          [disabled]="!canRun()"
          (click)="onNextDelinquencyPeriod()"
          >{{ 'WC_LOAN_TEST_TOOLS.NEXT_DELINQUENCY_PERIOD' | appTranslate }}</app-button
        >
      </div>
    </div>
  `,
  styles: [
    `
      .tools-container {
        padding: 24px;
        max-width: 720px;
        margin: 0 auto;
      }
      .page-title {
        font-size: 1.4rem;
        margin: 0 0 8px;
      }
      .test-only {
        font-size: 0.875rem;
        color: var(--ion-color-warning-shade, #b88600);
        margin: 0 0 16px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-width: 240px;
        margin-bottom: 16px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
    `,
  ],
})
export class WcLoanTestToolsComponent {
  private readonly tools = inject(WORKING_CAPITAL_LOAN_TEST_TOOLS_API);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  readonly loanId = signal<number | null>(null);
  readonly isRunning = signal(false);

  /** Nothing runs without a loan to run it against. */
  canRun(): boolean {
    return this.loanId() !== null && !this.isRunning();
  }

  onLoanIdChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    const parsed = Number(value);
    this.loanId.set(value === '' || !Number.isInteger(parsed) || parsed < 1 ? null : parsed);
  }

  onActivate(): void {
    this.run((loanId) => this.tools.activate(loanId));
  }

  onRegenerateSchedule(): void {
    this.run((loanId) => this.tools.regenerateAmortizationSchedule(loanId));
  }

  onNextDelinquencyPeriod(): void {
    this.run((loanId) => this.tools.generateNextDelinquencyPeriod(loanId));
  }

  /**
   * Runs one command and reports what the platform said.
   *
   * The success message names the command having been accepted rather than claiming an outcome:
   * these endpoints act on the test instance's own state, and the screen has not re-read it.
   */
  private run(command: (loanId: number) => Observable<void>): void {
    const loanId = this.loanId();
    if (loanId === null) return;

    this.isRunning.set(true);
    command(loanId).subscribe({
      next: () => {
        this.isRunning.set(false);
        void this.notifications.success(this.i18n.translate('WC_LOAN_TEST_TOOLS.ACCEPTED'));
      },
      // Reported by the error interceptor, which on a deployment without the test profile will
      // be the 404 that says these endpoints are not served here.
      error: () => this.isRunning.set(false),
    });
  }
}
