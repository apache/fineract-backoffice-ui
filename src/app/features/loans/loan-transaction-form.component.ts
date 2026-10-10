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
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18N, TranslatePipe } from '../../core/adapters';
import {
  LoanTransactionsService,
  LoansService,
  GetLoansLoanIdTransactions,
  PostLoansLoanIdTransactionsRequest,
  GetLoansLoanIdTransactionsTemplateResponse,
  GetPaymentTypeOptions,
  GetLoansLoanIdLoanChargeData,
  PaymentTypeService,
} from '../../api';
import { LoanSummary } from './loan-summary.model';
import { DialogService } from '../../core/services/dialog.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonDatetime,
  IonDatetimeButton,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';
import { toIsoDate } from '../../core/utils/date-formatter';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { createPickersReady } from '../../shared/utils/pickers-ready';
import { loanContractTerminationPayload } from './loan-contract-termination';
import { isRefundableLoanCharge, refundableChargeAmount } from './loan-charge-refund';

const TRANSACTION_TITLE_KEYS: Record<string, string> = {
  repayment: 'LOANS.REPAYMENT',
  disburse: 'LOANS.DISBURSEMENT',
  approve: 'LOANS.APPROVAL',
  reject: 'LOANS.ACTIONS.REJECT',
  withdrawnByClient: 'LOANS.ACTIONS.WITHDRAWN_BY_CLIENT',
  undoDisbursal: 'LOANS.ACTIONS.UNDO_DISBURSAL',
  waiveinterest: 'LOANS.ACTIONS.WAIVE_INTEREST',
  prepayLoan: 'LOANS.ACTIONS.PREPAY_LOAN',
  foreclosure: 'LOANS.ACTIONS.FORECLOSURE',
  close: 'LOANS.ACTIONS.CLOSE',
  writeoff: 'LOANS.ACTIONS.WRITE_OFF',
  'charge-off': 'LOANS.ACTIONS.CHARGE_OFF',
  merchantIssuedRefund: 'LOANS.ACTIONS.MERCHANT_ISSUED_REFUND',
  payoutRefund: 'LOANS.ACTIONS.PAYOUT_REFUND',
  refundByCash: 'LOANS.ACTIONS.REFUND_BY_CASH',
  contractTermination: 'LOANS.ACTIONS.CONTRACT_TERMINATION',
  undoContractTermination: 'LOANS.ACTIONS.UNDO_CONTRACT_TERMINATION',
  chargeRefund: 'LOANS.ACTIONS.CHARGE_REFUND',
  goodwillCredit: 'LOANS.ACTIONS.GOODWILL_CREDIT',
  downPayment: 'LOANS.ACTIONS.DOWN_PAYMENT',
  interestPaymentWaiver: 'LOANS.ACTIONS.INTEREST_PAYMENT_WAIVER',
  creditBalanceRefund: 'LOANS.ACTIONS.CREDIT_BALANCE_REFUND',
  recoverypayment: 'LOANS.ACTIONS.RECOVERY_PAYMENT',
  undowriteoff: 'LOANS.ACTIONS.UNDO_WRITE_OFF',
  reAge: 'LOANS.ACTIONS.RE_AGE',
  reAmortize: 'LOANS.ACTIONS.RE_AMORTIZE',
  'close-rescheduled': 'LOANS.ACTIONS.CLOSE_AS_RESCHEDULED',
};

/** Commands the template endpoint rejects; verified against a running Fineract. */
const NO_TEMPLATE_TYPES = new Set([
  'approve',
  'undoDisbursal',
  'reAmortize',
  'undowriteoff',
  'contractTermination',
  'undoContractTermination',
  'chargeRefund',
]);

const DESTRUCTIVE_TYPES = new Set([
  'writeoff',
  'foreclosure',
  'close',
  'undoDisbursal',
  'charge-off',
  'undowriteoff',
  'reAge',
  'reAmortize',
  'contractTermination',
  'undoContractTermination',
]);

// Only these commands accept a transaction amount / payment type — the
// others (writeoff, foreclosure, close, waiveinterest) compute their amount
// on the backend from the outstanding balance and reject an explicit
// transactionAmount with a 400.
const AMOUNT_VISIBLE_TYPES = new Set([
  'repayment',
  'prepayLoan',
  'merchantIssuedRefund',
  'payoutRefund',
  'refundByCash',
  'chargeRefund',
  'goodwillCredit',
  'downPayment',
  'interestPaymentWaiver',
  'creditBalanceRefund',
  'recoverypayment',
]);

const CONFIRM_MESSAGE_KEYS: Record<string, string> = {
  writeoff: 'LOANS.CONFIRM_WRITE_OFF',
  foreclosure: 'LOANS.CONFIRM_FORECLOSURE',
  close: 'LOANS.CONFIRM_CLOSE',
  undoDisbursal: 'LOANS.CONFIRM_UNDO_DISBURSAL',
  'charge-off': 'LOANS.CONFIRM_CHARGE_OFF',
  undowriteoff: 'LOANS.CONFIRM_UNDO_WRITE_OFF',
  reAge: 'LOANS.CONFIRM_RE_AGE',
  reAmortize: 'LOANS.CONFIRM_RE_AMORTIZE',
  'close-rescheduled': 'LOANS.CONFIRM_CLOSE_AS_RESCHEDULED',
  contractTermination: 'LOANS.CONFIRM_CONTRACT_TERMINATION',
  undoContractTermination: 'LOANS.CONFIRM_UNDO_CONTRACT_TERMINATION',
};

@Component({
  selector: 'app-loan-transaction-form',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardSubtitle,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    TooltipDirective,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ transactionTitleKey | appTranslate }}
          </ion-card-title>
          @if (loanSummary(); as summary) {
            <ion-card-subtitle>
              {{ 'LOANS.ACCOUNT_NO' | appTranslate }}: {{ summary.accountNo }} &middot;
              {{ 'COMMON.CLIENT' | appTranslate }}: {{ summary.clientName }} &middot;
              {{ 'LOANS.PRODUCT_NAME' | appTranslate }}: {{ summary.loanProductName }}
            </ion-card-subtitle>
          }
        </ion-card-header>

        <ion-card-content>
          <form #transactionForm="ngForm" (ngSubmit)="onSubmit()" class="transaction-form">
            <div class="form-grid">
              @if (dateVisible) {
                <!-- Transaction Date -->
                <ion-item fill="outline" [appTooltip]="'HELP.TRANSACTION_DATE_DESC' | appTranslate">
                  <ion-label position="stacked">
                    {{
                      transactionType() === 'approve'
                        ? ('COMMON.ACTIVATION_DATE' | appTranslate)
                        : ('COMMON.TRANSACTION_DATE' | appTranslate)
                    }}
                  </ion-label>
                  @if (pickersReady()) {
                    <ion-datetime-button datetime="transactionDate-picker"></ion-datetime-button>
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="transactionDate-picker"
                        data-testid="transactionDate-picker"
                        presentation="date"
                        name="transactionDate"
                        [ngModel]="transactionDate()"
                        (ngModelChange)="transactionDate.set($event)"
                        required
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>
              }

              @if (amountVisible) {
                <!-- Transaction Amount -->
                <ion-item
                  fill="outline"
                  [appTooltip]="'HELP.TRANSACTION_AMOUNT_DESC' | appTranslate"
                >
                  <ion-label position="stacked">{{
                    'COMMON.TRANSACTION_AMOUNT' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'COMMON.TRANSACTION_AMOUNT' | appTranslate"
                    type="number"
                    name="transactionAmount"
                    [(ngModel)]="transaction.transactionAmount"
                    required
                  ></ion-input>
                </ion-item>

                <!-- Payment Type -->
                <ion-item fill="outline" [appTooltip]="'HELP.PAYMENT_TYPE_DESC' | appTranslate">
                  <ion-label position="stacked">{{
                    'COMMON.PAYMENT_TYPE' | appTranslate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'COMMON.PAYMENT_TYPE' | appTranslate"
                    interface="popover"
                    name="paymentTypeId"
                    [(ngModel)]="transaction.paymentTypeId"
                  >
                    @for (type of paymentTypeOptions(); track type.id) {
                      <ion-select-option [value]="type.id">{{ type.name }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
              }

              @if (transactionType() === 'chargeRefund') {
                <ion-item fill="outline" class="full-width">
                  <ion-label position="stacked">{{
                    'LOANS.CHARGE_REFUND_CHARGE' | appTranslate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'LOANS.CHARGE_REFUND_CHARGE' | appTranslate"
                    interface="popover"
                    name="loanChargeId"
                    data-testid="charge-refund-charge"
                    [ngModel]="chargeId()"
                    (ngModelChange)="onChargeSelected($event)"
                    required
                  >
                    @for (charge of chargeOptions(); track charge.id) {
                      <ion-select-option [value]="charge.id">
                        {{ charge.name }} &mdash;
                        {{ remainingRefundAmount(charge) | number: '1.2-2' }}
                      </ion-select-option>
                    }
                  </ion-select>
                </ion-item>
              }

              @if (transactionType() === 'repayment') {
                <!-- Receipt Number -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'LOANS.RECEIPT_NUMBER' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.RECEIPT_NUMBER' | appTranslate"
                    name="receiptNumber"
                    [(ngModel)]="transaction.receiptNumber"
                  ></ion-input>
                </ion-item>

                <!-- Bank Number -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'LOANS.BANK_NUMBER' | appTranslate }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.BANK_NUMBER' | appTranslate"
                    name="bankNumber"
                    [(ngModel)]="transaction.bankNumber"
                  ></ion-input>
                </ion-item>

                <!-- Check Number -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'LOANS.CHECK_NUMBER' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.CHECK_NUMBER' | appTranslate"
                    name="checkNumber"
                    [(ngModel)]="transaction.checkNumber"
                  ></ion-input>
                </ion-item>

                <!-- Routing Code -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'LOANS.ROUTING_CODE' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.ROUTING_CODE' | appTranslate"
                    name="routingCode"
                    [(ngModel)]="transaction.routingCode"
                  ></ion-input>
                </ion-item>
              }

              <!-- Charge-off reason. Optional, and only present when the deployment has
                   configured code values for it — the template returns an empty list otherwise. -->
              @if (chargeOffReasonOptions().length) {
                <ion-item
                  fill="outline"
                  [appTooltip]="'HELP.CHARGE_OFF_REASON_DESC' | appTranslate"
                  class="full-width"
                >
                  <ion-label position="stacked">{{
                    'LOANS.CHARGE_OFF_REASON' | appTranslate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'LOANS.CHARGE_OFF_REASON' | appTranslate"
                    interface="popover"
                    data-testid="charge-off-reason"
                    name="chargeOffReasonId"
                    [(ngModel)]="chargeOffReasonId"
                  >
                    @for (reason of chargeOffReasonOptions(); track reason.id) {
                      <ion-select-option [value]="reason.id">{{ reason.name }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
              }

              <!-- Note -->
              <ion-item
                fill="outline"
                [appTooltip]="'HELP.NOTE_DESC' | appTranslate"
                class="full-width"
              >
                <ion-label position="stacked">{{ 'COMMON.NOTE' | appTranslate }}</ion-label>
                <ion-textarea
                  [attr.aria-label]="'COMMON.NOTE' | appTranslate"
                  name="note"
                  [(ngModel)]="transaction.note"
                  rows="3"
                ></ion-textarea>
              </ion-item>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="transactionForm.invalid || isSaving()"
              >
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
        max-width: 800px;
        margin: 0 auto;
      }
      .transaction-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
    `,
  ],
})
export class LoanTransactionFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly transactionService = inject(LoanTransactionsService);
  private readonly loansService = inject(LoansService);
  private readonly paymentTypeService = inject(PaymentTypeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationService);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  private readonly DATE_FORMAT = 'yyyy-MM-dd';

  loanId = 0;
  readonly transactionType = signal('');
  readonly isSaving = signal(false);

  transaction: PostLoansLoanIdTransactionsRequest = {};
  readonly transactionDate = signal(toIsoDate(new Date()));
  readonly paymentTypeOptions = signal<GetPaymentTypeOptions[]>([]);
  readonly loanSummary = signal<LoanSummary | null>(null);
  readonly chargeOffReasonOptions = signal<{ id?: number; name?: string }[]>([]);
  readonly chargeOptions = signal<GetLoansLoanIdLoanChargeData[]>([]);
  private readonly loanTransactions = signal<GetLoansLoanIdTransactions[]>([]);
  readonly chargeId = signal<number | null>(null);
  chargeOffReasonId: number | null = null;

  get transactionTitleKey(): string {
    return TRANSACTION_TITLE_KEYS[this.transactionType()] || this.transactionType();
  }

  get amountVisible(): boolean {
    return AMOUNT_VISIBLE_TYPES.has(this.transactionType());
  }

  /** These commands use Fineract's business date, not a client-supplied date field. */
  get dateVisible(): boolean {
    return ![
      'undoDisbursal',
      'contractTermination',
      'undoContractTermination',
      'chargeRefund',
    ].includes(this.transactionType());
  }

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.loanId = +params['loanId'];
      this.transactionType.set(params['type'] ?? this.route.snapshot.data['transactionType']);
      this.loadTemplate();
      this.loadLoanSummary();
    });
  }

  private loadLoanSummary(): void {
    const chargeRefund = this.transactionType() === 'chargeRefund';
    const request = chargeRefund
      ? this.loansService.getLoansLoanId(this.loanId, false, 'all')
      : this.loansService.getLoansLoanId(this.loanId);

    if (chargeRefund) this.loadPaymentTypes();

    request.subscribe({
      next: (data) => {
        this.loanSummary.set({
          accountNo: data.accountNo,
          clientName: data.clientName,
          loanProductName: data.loanProductName,
        });
        if (chargeRefund) {
          const transactions = data.transactions ?? [];
          this.loanTransactions.set(transactions);
          const options = (data.charges ?? []).filter((charge) =>
            isRefundableLoanCharge(charge, transactions),
          );
          this.chargeOptions.set(options);
          if (options.length === 1) this.onChargeSelected(options[0].id ?? null);
        }
      },
      error: () => {
        // Non-critical context display; the form still works without it.
        if (chargeRefund) this.notifications.error('Operation failed. Please try again.');
      },
    });
  }

  private loadPaymentTypes(): void {
    this.paymentTypeService.getPaymenttypes().subscribe({
      next: (options) =>
        this.paymentTypeOptions.set(
          options.map(({ id, name, position }) => ({ id, name, position })),
        ),
      error: () => this.paymentTypeOptions.set([]),
    });
  }

  onChargeSelected(chargeId: number | null): void {
    this.chargeId.set(chargeId);
    const charge = this.chargeOptions().find((option) => option.id === chargeId);
    this.transaction.loanChargeId = charge?.id;
    this.transaction.transactionAmount = charge
      ? refundableChargeAmount(charge, this.loanTransactions())
      : undefined;
  }

  remainingRefundAmount(charge: GetLoansLoanIdLoanChargeData): number {
    return refundableChargeAmount(charge, this.loanTransactions());
  }

  private loadTemplate(): void {
    // The transaction *template* endpoint accepts fewer commands than the transaction endpoint
    // itself — reAmortize, chargeRefund and undowriteoff are rejected there with "unsupported
    // value" even though the POST works. Asking anyway would only produce a failed request.
    if (NO_TEMPLATE_TYPES.has(this.transactionType())) {
      return;
    }
    this.transactionService
      .getLoansLoanIdTransactionsTemplate(this.loanId, this.transactionType())
      .subscribe({
        next: (template: GetLoansLoanIdTransactionsTemplateResponse) => {
          this.transaction.transactionAmount = template.amount;
          const dateArray = template.date as unknown as number[];
          if (dateArray) {
            const templateDate = new Date(dateArray[0], dateArray[1] - 1, dateArray[2]);
            // Fineract's transaction template returns the *next installment's due
            // date*, which on a healthy loan is in the future — and it then rejects
            // any transaction dated in the future ("The transaction date cannot be
            // in the future"). Prefilling it verbatim meant Save always failed with
            // a 403 until the user noticed and corrected the date by hand.
            const today = new Date();
            this.transactionDate.set(toIsoDate(templateDate > today ? today : templateDate));
          }
          this.paymentTypeOptions.set(template.paymentTypeOptions || []);
          // Only charge-off returns these, and only when the deployment has configured them.
          this.chargeOffReasonOptions.set(
            (template as unknown as { chargeOffReasonOptions?: { id?: number; name?: string }[] })
              .chargeOffReasonOptions ?? [],
          );
        },
        error: () => {
          this.notifications.error('Operation failed. Please try again.');
        },
      });
  }

  onSubmit(): void {
    if (DESTRUCTIVE_TYPES.has(this.transactionType())) {
      this.dialogService
        .confirm({
          title: this.i18n.translate(this.transactionTitleKey),
          message: this.i18n.translate(
            CONFIRM_MESSAGE_KEYS[this.transactionType()] || 'COMMON.CONFIRM',
          ),
          destructive: true,
        })
        .then((confirmed) => {
          if (confirmed) this.performSubmit();
        });
    } else {
      this.performSubmit();
    }
  }

  private performSubmit(): void {
    if (this.transactionType() === 'chargeRefund' && !this.transaction.loanChargeId) return;
    this.isSaving.set(true);

    const formattedDate = toIsoDate(this.transactionDate());

    if (this.transactionType() === 'approve') {
      const payload = {
        approvedOnDate: formattedDate,
        dateFormat: this.DATE_FORMAT,
        locale: 'en',
        note: this.transaction.note,
      };
      this.loansService.postLoansLoanId(this.loanId, payload, 'approve').subscribe({
        next: () => this.router.navigate(['/loans']),
        error: () => this.isSaving.set(false),
      });
    } else if (this.transactionType() === 'disburse') {
      // Disbursement is a loan state-transition command (POST /loans/{id}?command=disburse),
      // not a transaction sub-resource call — it does not accept `transactionDate`,
      // only `actualDisbursementDate`.
      const payload = {
        actualDisbursementDate: formattedDate,
        dateFormat: this.DATE_FORMAT,
        locale: 'en',
        transactionAmount: this.transaction.transactionAmount,
        paymentTypeId: this.transaction.paymentTypeId,
        note: this.transaction.note,
      };
      this.loansService.postLoansLoanId(this.loanId, payload, 'disburse').subscribe({
        next: () => this.router.navigate(['/loans']),
        error: () => this.isSaving.set(false),
      });
    } else if (this.transactionType() === 'undoDisbursal') {
      // Undo-disbursal is also a loan state-transition command, not a
      // transaction sub-resource entry — it takes no date/amount, just an
      // optional note.
      const payload = { note: this.transaction.note };
      this.loansService.postLoansLoanId(this.loanId, payload, 'undoDisbursal').subscribe({
        next: () => this.router.navigate(['/loans']),
        error: () => this.isSaving.set(false),
      });
    } else if (
      ['contractTermination', 'undoContractTermination'].includes(this.transactionType())
    ) {
      this.loansService
        .postLoansLoanId(
          this.loanId,
          loanContractTerminationPayload(this.transaction.note),
          this.transactionType(),
        )
        .subscribe({
          next: () => this.router.navigate(['/loans']),
          error: () => this.isSaving.set(false),
        });
    } else {
      if (this.dateVisible) {
        this.transaction.transactionDate = formattedDate;
        this.transaction.dateFormat = this.DATE_FORMAT;
        this.transaction.locale = 'en';
      }
      if (!this.amountVisible) {
        // writeoff/foreclosure/close/waiveinterest compute their amount
        // server-side from the outstanding balance and reject an explicit
        // transactionAmount/paymentTypeId with a 400.
        delete this.transaction.transactionAmount;
        delete this.transaction.paymentTypeId;
      }

      if (this.transactionType() === 'charge-off' && this.chargeOffReasonId !== null) {
        (this.transaction as Record<string, unknown>)['chargeOffReasonId'] = this.chargeOffReasonId;
      }

      this.transactionService
        .postLoansLoanIdTransactions(this.loanId, this.transaction, this.transactionType())
        .subscribe({
          next: () => this.router.navigate(['/loans']),
          error: () => this.isSaving.set(false),
        });
    }
  }

  onCancel(): void {
    this.router.navigate(['/loans']);
  }
}
