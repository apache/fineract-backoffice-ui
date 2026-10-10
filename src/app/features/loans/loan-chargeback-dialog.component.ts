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

import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LOAN_TRANSACTION_API, OVERLAY, TranslatePipe } from '../../core/adapters';
import type { PaymentTypeOption } from '../../core/adapters';
import { ButtonComponent } from '../../ui/button/button.component';

export interface LoanChargebackData {
  loanId: number;
  transactionId: number;
  /** The repayment being charged back; also the most the platform will allow. */
  amount: number;
  /** The repayment's date, already formatted for display. */
  date?: string;
  currencySymbol?: string;
}

export interface LoanChargebackResult {
  transactionAmount: number;
  paymentTypeId?: number;
}

/** The payment type Fineract ships for exactly this correction. */
const CHARGEBACK_PAYMENT_TYPE_CODE = 'REPAYMENT_ADJUSTMENT_CHARGEBACK';

/**
 * Collects what a chargeback needs: how much of the repayment to take back, and the payment
 * type to record it under.
 *
 * A chargeback is only accepted against a specific transaction, so this opens from a row on the
 * Transactions tab rather than from the loan's Actions menu. It does not reverse the repayment —
 * the platform records a separate `Chargeback` transaction that puts the amount back on the
 * balance, and rejects the command when the amount exceeds what is left of the repayment. That
 * check is the platform's; the amount is prefilled with the full repayment and left editable
 * because a partial chargeback is a legitimate correction.
 */
@Component({
  selector: 'app-loan-chargeback-dialog',
  standalone: true,
  imports: [FormsModule, DecimalPipe, TranslatePipe, ButtonComponent],
  template: `
    <h2 class="dialog-title">{{ 'LOANS.ACTIONS.CHARGEBACK' | appTranslate }}</h2>
    <div class="dialog-content">
      <p class="dialog-message">{{ 'LOANS.CONFIRM_CHARGEBACK' | appTranslate }}</p>

      <dl class="repayment-summary" data-testid="chargeback-summary">
        @if (data().date) {
          <div>
            <dt>{{ 'COMMON.TRANSACTION_DATE' | appTranslate }}</dt>
            <dd>{{ data().date }}</dd>
          </div>
        }
        <div>
          <dt>{{ 'LOANS.CHARGEBACK_REPAYMENT_AMOUNT' | appTranslate }}</dt>
          <dd>{{ data().currencySymbol }}{{ data().amount | number: '1.2-2' }}</dd>
        </div>
      </dl>

      <div class="form-field">
        <label for="chargeback-amount">
          {{ 'COMMON.TRANSACTION_AMOUNT' | appTranslate }}
          @if (data().currencySymbol) {
            ({{ data().currencySymbol }})
          }
        </label>
        <input
          id="chargeback-amount"
          type="number"
          name="transactionAmount"
          data-testid="chargeback-amount"
          min="0"
          step="any"
          [attr.max]="data().amount"
          [class.invalid]="exceedsRepayment()"
          [attr.aria-invalid]="exceedsRepayment()"
          [attr.aria-describedby]="exceedsRepayment() ? 'chargeback-amount-error' : null"
          [ngModel]="amount()"
          (ngModelChange)="amount.set($event)"
          required
        />
        @if (exceedsRepayment()) {
          <p id="chargeback-amount-error" class="field-error" role="alert">
            {{ 'LOANS.CHARGEBACK_AMOUNT_EXCEEDS' | appTranslate }}
          </p>
        }
      </div>

      <div class="form-field">
        <label for="chargeback-payment-type">{{ 'COMMON.PAYMENT_TYPE' | appTranslate }}</label>
        <select
          id="chargeback-payment-type"
          name="paymentTypeId"
          data-testid="chargeback-payment-type"
          [ngModel]="paymentTypeId()"
          (ngModelChange)="paymentTypeId.set($event)"
        >
          @for (type of paymentTypes(); track type.id) {
            <option [ngValue]="type.id">{{ type.name }}</option>
          }
        </select>
      </div>
    </div>
    <div class="dialog-actions">
      <app-button type="button" emphasis="quiet" intent="neutral" (click)="onCancel()">
        {{ 'COMMON.CANCEL' | appTranslate }}
      </app-button>
      <app-button
        type="button"
        intent="danger"
        data-testid="chargeback-confirm"
        [disabled]="!isValid()"
        (click)="onConfirm()"
      >
        {{ 'LOANS.ACTIONS.CHARGEBACK' | appTranslate }}
      </app-button>
    </div>
  `,
  styles: [
    `
      /* Nothing global pads a dialog's contents; Ionic fields bring their own inset, native
         controls do not, so this dialog supplies the spacing itself. */
      :host {
        display: block;
        padding: 24px;
      }
      .dialog-title {
        margin: 0 0 16px;
        font-size: 1.25rem;
      }
      .dialog-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 350px;
      }
      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 24px;
      }
      .dialog-message {
        margin: 0;
        color: var(--text-muted);
      }
      .repayment-summary {
        display: flex;
        gap: 24px;
        margin: 0;
        padding: 12px 16px;
        border-radius: 8px;
        background: var(--surface-sunken);
      }
      .repayment-summary dt {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.7;
      }
      .repayment-summary dd {
        margin: 2px 0 0;
        font-weight: 600;
      }
      .form-field input.invalid {
        border-color: var(--error-color);
      }
      .field-error {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--error-strong);
      }
    `,
  ],
})
export class LoanChargebackDialogComponent implements OnInit {
  private readonly overlay = inject(OVERLAY);
  private readonly transactionApi = inject(LOAN_TRANSACTION_API);

  readonly data = input.required<LoanChargebackData>();

  readonly amount = signal<number | null>(null);
  readonly paymentTypeId = signal<number | undefined>(undefined);
  readonly paymentTypes = signal<readonly PaymentTypeOption[]>([]);

  /** More than the repayment is never accepted, so say so instead of waiting for the platform. */
  readonly exceedsRepayment = computed(() => {
    const amount = this.amount();
    return amount !== null && Number(amount) > this.data().amount;
  });

  ngOnInit(): void {
    this.amount.set(this.data().amount);

    // The transaction template is where the platform lists the enabled payment types; there is
    // no chargeback template to ask (it answers "unsupported value"), so the repayment one serves.
    this.transactionApi.template(this.data().loanId, 'repayment').subscribe({
      next: (template) => {
        const options = template.paymentTypeOptions;
        this.paymentTypes.set(options);
        const shipped = options.find((o) => o.codeName === CHARGEBACK_PAYMENT_TYPE_CODE);
        this.paymentTypeId.set(shipped?.id);
      },
      // Payment type is optional to the command; the dialog still works without the list.
      error: () => undefined,
    });
  }

  isValid(): boolean {
    const amount = this.amount();
    return amount !== null && Number(amount) > 0 && !this.exceedsRepayment();
  }

  onCancel(): void {
    void this.overlay.dismissModal();
  }

  onConfirm(): void {
    if (!this.isValid()) return;
    const paymentTypeId = this.paymentTypeId();
    void this.overlay.dismissModal<LoanChargebackResult>({
      transactionAmount: Number(this.amount()),
      ...(paymentTypeId !== undefined ? { paymentTypeId } : {}),
    });
  }
}
