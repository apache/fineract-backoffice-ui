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

import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { OVERLAY, TranslatePipe } from '../../../core/adapters';
import { toIsoDate } from '../../../core/utils/date-formatter';
import { ButtonComponent } from '../../../ui/button/button.component';
import {
  LoanDelinquencyPauseDialogData,
  LoanDelinquencyPauseResult,
} from './loan-delinquency-action.model';

/**
 * Collects the period for a delinquency pause: `POST /loans/{id}/delinquency-actions` with
 * `action: pause`, which needs both dates (#505).
 *
 * Native date inputs rather than Ionic's picker: new UI code stays off the vendor tags (ADR
 * 0005), and a native input answers `YYYY-MM-DD` directly, with the keyboard and the platform
 * picker both working.
 *
 * The only local rule is that the pause ends after it starts, because the platform's own rule is
 * the same ("must last at least a day") and a period that runs backwards is never what anyone
 * meant. Everything else it enforces — the loan being active, a start no earlier than
 * disbursement, no overlap with another pause — depends on state this dialog does not hold, so
 * the platform's message for it is shown rather than a second copy of the rule that could
 * disagree.
 */
@Component({
  selector: 'app-loan-delinquency-pause-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, ButtonComponent],
  template: `
    <h2 class="dialog-title">{{ 'LOANS.PAUSE_DELINQUENCY' | appTranslate }}</h2>
    <div class="dialog-content">
      <p class="dialog-message">{{ 'LOANS.PAUSE_DELINQUENCY_HINT' | appTranslate }}</p>

      <div class="form-field">
        <label for="delinquency-pause-start">{{ 'LOANS.PAUSE_START' | appTranslate }}</label>
        <input
          id="delinquency-pause-start"
          type="date"
          name="startDate"
          data-testid="delinquency-pause-start"
          [ngModel]="startDate()"
          (ngModelChange)="startDate.set($event)"
          required
        />
      </div>

      <div class="form-field">
        <label for="delinquency-pause-end">{{ 'LOANS.PAUSE_END' | appTranslate }}</label>
        <input
          id="delinquency-pause-end"
          type="date"
          name="endDate"
          data-testid="delinquency-pause-end"
          [ngModel]="endDate()"
          (ngModelChange)="endDate.set($event)"
          [class.invalid]="endsBeforeItStarts()"
          [attr.aria-invalid]="endsBeforeItStarts() ? 'true' : null"
          [attr.aria-describedby]="endsBeforeItStarts() ? 'delinquency-pause-order-error' : null"
          required
        />
        @if (endsBeforeItStarts()) {
          <p
            id="delinquency-pause-order-error"
            class="field-error"
            role="alert"
            data-testid="delinquency-pause-order-error"
          >
            {{ 'LOANS.PAUSE_END_AFTER_START' | appTranslate }}
          </p>
        }
      </div>
    </div>
    <div class="dialog-actions">
      <app-button type="button" intent="neutral" emphasis="quiet" (click)="onCancel()">
        {{ 'COMMON.CANCEL' | appTranslate }}
      </app-button>
      <app-button
        type="button"
        intent="primary"
        data-testid="delinquency-pause-confirm"
        [disabled]="!isValid()"
        (click)="onConfirm()"
      >
        {{ 'COMMON.CONFIRM' | appTranslate }}
      </app-button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: var(--space-5);
      }
      .dialog-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 8px;
        min-width: 350px;
      }
      .dialog-message {
        margin: 0;
        color: var(--text-muted);
      }
      .form-field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .form-field label {
        font-weight: 500;
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .form-field input {
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        background: var(--card-bg);
        color: var(--text-color);
        font-family: inherit;
        font-size: 0.9rem;
      }
      .form-field input:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: var(--focus-ring);
      }
      .form-field input.invalid {
        border-color: var(--error-color);
      }
      .field-error {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--error-strong);
      }
      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 8px;
      }
    `,
  ],
})
export class LoanDelinquencyPauseDialogComponent implements OnInit {
  private readonly overlay = inject(OVERLAY);

  readonly data = input<LoanDelinquencyPauseDialogData>({});

  readonly startDate = signal<string | null>(null);
  readonly endDate = signal<string | null>(null);

  /** Both dates chosen, and the second is after the first. Compared as `YYYY-MM-DD` strings. */
  readonly endsBeforeItStarts = computed(() => {
    const start = toIsoDate(this.startDate());
    const end = toIsoDate(this.endDate());
    return !!start && !!end && end <= start;
  });

  ngOnInit(): void {
    // A pause normally starts today, and "today" is the platform's business date rather than the
    // browser's clock: the two differ on any tenant whose business date has been moved.
    this.startDate.set(this.data().businessDate ?? null);
  }

  isValid(): boolean {
    return !!this.startDate() && !!this.endDate() && !this.endsBeforeItStarts();
  }

  onCancel(): void {
    void this.overlay.dismissModal();
  }

  onConfirm(): void {
    if (!this.isValid()) return;
    void this.overlay.dismissModal<LoanDelinquencyPauseResult>({
      startDate: toIsoDate(this.startDate()),
      endDate: toIsoDate(this.endDate()),
    });
  }
}
