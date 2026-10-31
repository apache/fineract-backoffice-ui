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
import { PlatformDateService } from '../../../core/services/platform-date.service';
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
import {
  WorkingCapitalLoansService,
  WorkingCapitalLoanProductsService,
  WorkingCapitalLoanTransactionsService,
  CodeValueData,
  PostWorkingCapitalLoansLoanIdRequest,
  PostWorkingCapitalLoanTransactionsRequest,
  PutWorkingCapitalLoansLoanIdDiscountRequest,
  PutWorkingCapitalLoansLoanIdRateRequest,
} from '../../../api';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatDateToFineract,
  toIsoDate,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';
import { DateFieldComponent } from '../../../ui/date-field/date-field.component';

/**
 * The command each route segment posts to the transactions endpoint.
 *
 * Mostly an identity map, deliberately: the segment is Fineract's own command name, so the URL,
 * the posted command and the permission in `WC_LOAN_COMMAND_PERMISSIONS` all read the same. The
 * spellings are from `WorkingCapitalLoanConstants` and the `@Operation` description on
 * `WorkingCapitalLoanTransactionsApiResource`.
 *
 * `prepay` is the exception. Fineract has no prepay command — a prepayment is a repayment settling
 * the whole balance — so it posts `repayment` with the amount the `prepayLoan` template offers.
 */
const POSTED_TRANSACTION_COMMAND: Readonly<Record<string, string>> = {
  prepay: 'repayment',
  goodwillCredit: 'goodwillCredit',
  discountFee: 'discountFee',
  payoutRefund: 'payoutRefund',
  creditBalanceRefund: 'creditBalanceRefund',
  recoveryPayment: 'recoveryPayment',
  chargeOff: 'chargeOff',
  undoChargeOff: 'undoChargeOff',
  writeOff: 'writeOff',
  undoWriteOff: 'undoWriteOff',
};

/**
 * What each form asks `GET …/transactions/template?command=…` for.
 *
 * Absent means the form has nothing to prefill: the two undo commands carry no amount or date, and
 * `writeOff`'s reasons do not come from here — see {@link loadWriteOffReasons}.
 */
const TEMPLATE_COMMAND: Readonly<Record<string, string>> = {
  prepay: 'prepayLoan',
  goodwillCredit: 'goodwillCredit',
  discountFee: 'discountFee',
  payoutRefund: 'payoutRefund',
  creditBalanceRefund: 'creditBalanceRefund',
  recoveryPayment: 'recoveryPayment',
  chargeOff: 'chargeOff',
};

/** Commands whose amount the user enters. `prepay` shows the template's figure read-only. */
const AMOUNT_COMMANDS = new Set([
  'goodwillCredit',
  'payoutRefund',
  'creditBalanceRefund',
  'recoveryPayment',
  // The discount fee is entered, not offered: its template carries the currency and the
  // classification options but no amount, and the platform refuses the command without one —
  // without `transactionAmount` it fails the not-null constraint on the transaction row rather
  // than validating, which is a platform defect but still a refusal.
  'discountFee',
]);

/** Commands that carry a transaction date. */
/**
 * Commands that carry a transaction date.
 *
 * `discountFee` carries one for a reason worth stating: the date identifies the disbursement the
 * fee attaches to. Fineract resolves `relatedResourceId` from it — the response's `changes` name
 * the disbursement it picked — and a date that matches no disbursement is refused.
 */
const DATED_COMMANDS = new Set([...AMOUNT_COMMANDS, 'prepay', 'chargeOff', 'writeOff']);

/**
 * Handles WC loan lifecycle commands (approve, reject, undoapproval, disburse, undodisbursal),
 * the `PUT` sub-resources (mark as fraud, discount, payment rate) and every transaction command
 * the module supports. Branches on the :command route param — mirrors the main
 * loan-transaction-form pattern.
 *
 * Each command is reachable only from the loan screen, which offers it only in a status Fineract
 * accepts it in, and the route is gated on the command's own permission code (issue #777).
 */
@Component({
  selector: 'app-wc-loan-action-form',
  standalone: true,
  imports: [
    DateFieldComponent,
    FormsModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonCheckbox,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonSelect,
    IonSelectOption,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ title | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <!-- Withheld until the template has answered, for the same reason the application
               form withholds itself: the template fills the request with the platform's own
               figures, and writing to bindings that have already been checked is an NG0100 in
               development and a value that appears a frame late in production. -->
          @if (isReady()) {
            <form #actionForm="ngForm" (ngSubmit)="onSubmit()" class="wc-form">
              @if (command === 'approve') {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.APPROVED_ON_DATE' | appTranslate
                  }}</ion-label>
                  @if (pickersReady()) {
                    <ion-datetime-button datetime="approvedOnDate-picker"></ion-datetime-button>
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="approvedOnDate-picker"
                        data-testid="approvedOnDate-picker"
                        presentation="date"
                        name="approvedOnDate"
                        [(ngModel)]="approvedOnDate"
                        required
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.APPROVED_AMOUNT' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'WC_LOANS.ACTIONS.APPROVED_AMOUNT' | appTranslate"
                    type="number"
                    name="approvedLoanAmount"
                    [(ngModel)]="lifecycle.approvedLoanAmount"
                  ></ion-input>
                </ion-item>
              }

              @if (command === 'disburse') {
                <app-date-field
                  label="WC_LOANS.ACTIONS.EXPECTED_DISBURSEMENT_DATE"
                  [required]="true"
                  pickerId="expectedDisbursementDate-picker"
                  name="expectedDisbursementDate"
                  [(ngModel)]="expectedDisbursementDate"
                ></app-date-field>
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.ACTUAL_DISBURSEMENT_DATE' | appTranslate
                  }}</ion-label>
                  @if (pickersReady()) {
                    <ion-datetime-button
                      datetime="actualDisbursementDate-picker"
                    ></ion-datetime-button>
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="actualDisbursementDate-picker"
                        data-testid="actualDisbursementDate-picker"
                        presentation="date"
                        name="actualDisbursementDate"
                        [(ngModel)]="actualDisbursementDate"
                        required
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.TRANSACTION_AMOUNT' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'WC_LOANS.ACTIONS.TRANSACTION_AMOUNT' | appTranslate"
                    type="number"
                    name="transactionAmount"
                    [(ngModel)]="lifecycle.transactionAmount"
                    required
                  ></ion-input>
                </ion-item>
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.DISCOUNT_AMOUNT' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'WC_LOANS.ACTIONS.DISCOUNT_AMOUNT' | appTranslate"
                    type="number"
                    name="discountAmount"
                    [(ngModel)]="lifecycle.discountAmount"
                  ></ion-input>
                </ion-item>
              }

              @if (command === 'reject') {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.REJECTED_ON_DATE' | appTranslate
                  }}</ion-label>
                  @if (pickersReady()) {
                    <ion-datetime-button datetime="rejectedOnDate-picker"></ion-datetime-button>
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="rejectedOnDate-picker"
                        data-testid="rejectedOnDate-picker"
                        presentation="date"
                        name="rejectedOnDate"
                        [(ngModel)]="rejectedOnDate"
                        required
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>
              }

              @if (command === 'repayment') {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.TRANSACTION_DATE' | appTranslate
                  }}</ion-label>
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
                        [(ngModel)]="transactionDate"
                        required
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.TRANSACTION_AMOUNT' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'WC_LOANS.ACTIONS.TRANSACTION_AMOUNT' | appTranslate"
                    type="number"
                    name="repaymentAmount"
                    [(ngModel)]="repayment.transactionAmount"
                    required
                  ></ion-input>
                </ion-item>
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.NOTE' | appTranslate
                  }}</ion-label>
                  <ion-textarea
                    [attr.aria-label]="'WC_LOANS.ACTIONS.NOTE' | appTranslate"
                    name="repaymentNote"
                    [(ngModel)]="repayment.note"
                  ></ion-textarea>
                </ion-item>
              }

              @if (command === 'markasfraud') {
                <ion-item>
                  <ion-checkbox name="fraud" [(ngModel)]="fraud">
                    {{ 'WC_LOANS.ACTIONS.MARK_AS_FRAUD' | appTranslate }}
                  </ion-checkbox>
                </ion-item>
              }

              @if (command === 'discount') {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.DISCOUNT_AMOUNT' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'WC_LOANS.ACTIONS.DISCOUNT_AMOUNT' | appTranslate"
                    type="number"
                    name="discountAmount"
                    [(ngModel)]="discount.discountAmount"
                  ></ion-input>
                </ion-item>
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.NOTE' | appTranslate
                  }}</ion-label>
                  <ion-textarea
                    [attr.aria-label]="'WC_LOANS.ACTIONS.NOTE' | appTranslate"
                    name="discountNote"
                    [(ngModel)]="discount.note"
                  ></ion-textarea>
                </ion-item>
              }

              @if (command === 'paymentrate') {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.EFFECTIVE_DATE' | appTranslate
                  }}</ion-label>
                  @if (pickersReady()) {
                    <ion-datetime-button
                      datetime="paymentRateEffectiveDate-picker"
                    ></ion-datetime-button>
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="paymentRateEffectiveDate-picker"
                        data-testid="paymentRateEffectiveDate-picker"
                        presentation="date"
                        name="paymentRateEffectiveDate"
                        [(ngModel)]="paymentRateEffectiveDate"
                        required
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.PERIOD_PAYMENT_RATE' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'WC_LOANS.PERIOD_PAYMENT_RATE' | appTranslate"
                    type="number"
                    name="periodPaymentRate"
                    [(ngModel)]="paymentRate.periodPaymentRate"
                  ></ion-input>
                </ion-item>
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.NOTE' | appTranslate
                  }}</ion-label>
                  <ion-textarea
                    [attr.aria-label]="'WC_LOANS.ACTIONS.NOTE' | appTranslate"
                    name="paymentRateNote"
                    [(ngModel)]="paymentRate.note"
                  ></ion-textarea>
                </ion-item>
              }

              @if (isDated) {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.TRANSACTION_DATE' | appTranslate
                  }}</ion-label>
                  @if (pickersReady()) {
                    <ion-datetime-button datetime="txnDate-picker"></ion-datetime-button>
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="txnDate-picker"
                        data-testid="txnDate-picker"
                        presentation="date"
                        name="txnDate"
                        [(ngModel)]="transactionDate"
                        required
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>
              }

              @if (command === 'prepay') {
                <!-- Read-only: Fineract settles the whole balance, and the figure is the
                   template's as-of-date outstanding, not something to re-type. -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.PAYOFF_AMOUNT' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'WC_LOANS.ACTIONS.PAYOFF_AMOUNT' | appTranslate"
                    type="number"
                    name="payoffAmount"
                    [ngModel]="transaction.transactionAmount"
                    readonly
                  ></ion-input>
                </ion-item>
              }

              @if (isAmountEntered) {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.TRANSACTION_AMOUNT' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'WC_LOANS.ACTIONS.TRANSACTION_AMOUNT' | appTranslate"
                    type="number"
                    name="transactionAmount"
                    [(ngModel)]="transaction.transactionAmount"
                    required
                  ></ion-input>
                </ion-item>
              }

              @if (command === 'chargeOff' && chargeOffReasonOptions().length) {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.CHARGE_OFF_REASON' | appTranslate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'WC_LOANS.ACTIONS.CHARGE_OFF_REASON' | appTranslate"
                    name="chargeOffReasonId"
                    [(ngModel)]="transaction.chargeOffReasonId"
                  >
                    @for (reason of chargeOffReasonOptions(); track reason.id) {
                      <ion-select-option [value]="reason.id">{{ reason.name }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
              }

              @if (command === 'writeOff' && writeOffReasonOptions().length) {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.WRITE_OFF_REASON' | appTranslate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'WC_LOANS.ACTIONS.WRITE_OFF_REASON' | appTranslate"
                    name="writeoffReasonId"
                    [(ngModel)]="transaction.writeoffReasonId"
                  >
                    @for (reason of writeOffReasonOptions(); track reason.id) {
                      <ion-select-option [value]="reason.id">{{ reason.name }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
              }

              @if (command === 'undoWriteOff') {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.REVERSAL_EXTERNAL_ID' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'WC_LOANS.ACTIONS.REVERSAL_EXTERNAL_ID' | appTranslate"
                    name="reversalExternalId"
                    [(ngModel)]="transaction.reversalExternalId"
                  ></ion-input>
                </ion-item>
              }

              @if (isDated) {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.EXTERNAL_ID' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'WC_LOANS.ACTIONS.EXTERNAL_ID' | appTranslate"
                    name="externalId"
                    [(ngModel)]="transaction.externalId"
                  ></ion-input>
                </ion-item>
              }

              @if (isTransaction && command !== 'undoChargeOff') {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.NOTE' | appTranslate
                  }}</ion-label>
                  <ion-textarea
                    [attr.aria-label]="'WC_LOANS.ACTIONS.NOTE' | appTranslate"
                    name="transactionNote"
                    [(ngModel)]="transaction.note"
                  ></ion-textarea>
                </ion-item>
              }

              @if (
                !isTransaction &&
                command !== 'repayment' &&
                command !== 'markasfraud' &&
                command !== 'discount' &&
                command !== 'paymentrate'
              ) {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'WC_LOANS.ACTIONS.NOTE' | appTranslate
                  }}</ion-label>
                  <ion-textarea
                    [attr.aria-label]="'WC_LOANS.ACTIONS.NOTE' | appTranslate"
                    name="note"
                    [(ngModel)]="lifecycle.note"
                  ></ion-textarea>
                </ion-item>
              }

              <div class="form-actions">
                <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                  {{ 'COMMON.CANCEL' | appTranslate }}
                </ion-button>
                <ion-button
                  color="primary"
                  type="submit"
                  [disabled]="actionForm.invalid || isSaving()"
                >
                  @if (isSaving()) {
                    <ion-spinner name="crescent"></ion-spinner>
                    {{ 'COMMON.SAVING' | appTranslate }}
                  } @else {
                    {{ 'COMMON.SUBMIT' | appTranslate }}
                  }
                </ion-button>
              </div>
            </form>
          } @else {
            <div class="form-loading">
              <ion-spinner name="crescent"></ion-spinner>
            </div>
          }
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
      .wc-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-loading {
        display: flex;
        justify-content: center;
        padding: 32px;
      }
    `,
  ],
})
export class WcLoanActionFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly loansService = inject(WorkingCapitalLoansService);
  private readonly productsService = inject(WorkingCapitalLoanProductsService);
  private readonly transactionsService = inject(WorkingCapitalLoanTransactionsService);
  private readonly route = inject(ActivatedRoute);
  /**
   * Today, as the platform reckons it: the business date when one governs, and the platform's
   * own clock otherwise. Fineract judges "the future" by that reckoning, so a date seeded from
   * `new Date()` is refused whenever the browser runs ahead of it (#758).
   */
  private readonly platformDate = inject(PlatformDateService);
  private readonly router = inject(Router);

  loanId = 0;
  command = '';
  readonly isSaving = signal(false);

  lifecycle: PostWorkingCapitalLoansLoanIdRequest = {
    dateFormat: FINERACT_DATE_FORMAT,
    locale: FINERACT_LOCALE,
  };
  repayment: PostWorkingCapitalLoanTransactionsRequest = {
    dateFormat: FINERACT_DATE_FORMAT,
    locale: FINERACT_LOCALE,
  };
  discount: PutWorkingCapitalLoansLoanIdDiscountRequest = {
    dateFormat: FINERACT_DATE_FORMAT,
    locale: FINERACT_LOCALE,
  };
  paymentRate: PutWorkingCapitalLoansLoanIdRateRequest = {
    dateFormat: FINERACT_DATE_FORMAT,
    locale: FINERACT_LOCALE,
    effectiveDate: '',
  };
  fraud = false;

  /** Body for every command that posts to the transactions endpoint. */
  transaction: PostWorkingCapitalLoanTransactionsRequest = {
    dateFormat: FINERACT_DATE_FORMAT,
    locale: FINERACT_LOCALE,
  };

  /** False only while the transaction template is in flight. */
  readonly isReady = signal(true);

  readonly chargeOffReasonOptions = signal<CodeValueData[]>([]);
  readonly writeOffReasonOptions = signal<CodeValueData[]>([]);

  approvedOnDate: string | null = null;
  expectedDisbursementDate: string | null = null;
  actualDisbursementDate: string | null = null;
  rejectedOnDate: string | null = null;
  transactionDate: string | null = this.platformDate.today();
  paymentRateEffectiveDate: string | null = this.platformDate.today();

  get title(): string {
    const map: Record<string, string> = {
      approve: 'WC_LOANS.APPROVE',
      disburse: 'WC_LOANS.DISBURSE',
      reject: 'WC_LOANS.ACTIONS.REJECT',
      undoapproval: 'WC_LOANS.ACTIONS.UNDO_APPROVAL',
      undodisbursal: 'WC_LOANS.ACTIONS.UNDO_DISBURSAL',
      repayment: 'WC_LOANS.REPAYMENT',
      markasfraud: 'WC_LOANS.ACTIONS.MARK_AS_FRAUD',
      discount: 'WC_LOANS.ACTIONS.APPLY_DISCOUNT',
      paymentrate: 'WC_LOANS.ACTIONS.CHANGE_PAYMENT_RATE',
      prepay: 'WC_LOANS.ACTIONS.PREPAY',
      goodwillCredit: 'WC_LOANS.ACTIONS.GOODWILL_CREDIT',
      payoutRefund: 'WC_LOANS.ACTIONS.PAYOUT_REFUND',
      creditBalanceRefund: 'WC_LOANS.ACTIONS.CREDIT_BALANCE_REFUND',
      discountFee: 'WC_LOANS.ACTIONS.DISCOUNT_FEE',
      chargeOff: 'WC_LOANS.ACTIONS.CHARGE_OFF',
      undoChargeOff: 'WC_LOANS.ACTIONS.UNDO_CHARGE_OFF',
      writeOff: 'WC_LOANS.ACTIONS.WRITE_OFF',
      undoWriteOff: 'WC_LOANS.ACTIONS.UNDO_WRITE_OFF',
      recoveryPayment: 'WC_LOANS.ACTIONS.RECOVERY_PAYMENT',
    };
    return map[this.command] ?? this.command;
  }

  /** True for the commands posted to `…/transactions`, as opposed to the lifecycle and PUT ones. */
  get isTransaction(): boolean {
    return this.command in POSTED_TRANSACTION_COMMAND;
  }

  get isDated(): boolean {
    return DATED_COMMANDS.has(this.command);
  }

  get isAmountEntered(): boolean {
    return AMOUNT_COMMANDS.has(this.command);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const cmd = this.route.snapshot.paramMap.get('command');
    if (id) this.loanId = +id;
    if (cmd) this.command = cmd;

    if (this.isTransaction) {
      this.loadTransactionTemplate();
    }
    if (this.command === 'writeOff') {
      this.loadWriteOffReasons();
    }
  }

  /**
   * Prefills from `GET …/transactions/template?command=…`.
   *
   * The template is a convenience, not a precondition: the form stays usable when the call fails,
   * because every field it fills is one the user can supply. The one exception is `prepay`, whose
   * amount is the platform's own payoff figure — if that does not arrive, there is nothing
   * truthful to put in the box, so the submit button stays disabled by the required field.
   */
  private loadTransactionTemplate(): void {
    const templateCommand = TEMPLATE_COMMAND[this.command];
    if (!templateCommand) return;
    this.isReady.set(false);
    this.transactionsService
      .getWorkingCapitalLoansLoanIdTransactionsTemplate(this.loanId, templateCommand)
      .subscribe({
        next: (template) => {
          this.chargeOffReasonOptions.set(template.chargeOffReasonOptions ?? []);
          if (template.expectedAmount != null) {
            this.transaction.transactionAmount = template.expectedAmount;
          }
          const suggestedDate = template.chargeOffDate ?? template.transactionDate;
          if (suggestedDate) {
            this.transactionDate = toIsoDate(new Date(suggestedDate));
          }
          this.isReady.set(true);
        },
        error: (err: unknown) => {
          // Show the form rather than an endless spinner: every field the template fills is one
          // the user can supply, and the interceptor has already surfaced the failure.
          this.isReady.set(true);
          console.error(`Failed to load the ${templateCommand} transaction template`, err);
        },
      });
  }

  /**
   * Write-off reasons come from the product template, not the transaction one.
   *
   * Fineract assembles `writeOffReasonOptions` in the loan *product* read service; the transaction
   * template carries only `chargeOffReasonOptions`. A user without
   * `READ_WORKINGCAPITALLOANPRODUCT` therefore gets no reason list — and the write-off still
   * posts, because the reason is optional.
   */
  private loadWriteOffReasons(): void {
    this.productsService.getWorkingCapitalLoanProductsTemplate().subscribe({
      next: (template) => this.writeOffReasonOptions.set(template.writeOffReasonOptions ?? []),
      error: (err: unknown) => console.error('Failed to load write-off reasons', err),
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);

    if (this.isTransaction) {
      return this.submitTransaction();
    }

    switch (this.command) {
      case 'repayment':
        return this.submitRepayment();
      case 'markasfraud':
        return this.submitMarkAsFraud();
      case 'discount':
        return this.submitDiscount();
      case 'paymentrate':
        return this.submitPaymentRate();
      default:
        return this.submitLifecycleCommand();
    }
  }

  private submitRepayment(): void {
    if (this.transactionDate) {
      this.repayment.transactionDate = formatDateToFineract(this.transactionDate);
    }
    this.transactionsService
      .postWorkingCapitalLoansLoanIdTransactions(this.loanId, 'repayment', this.repayment)
      .subscribe({
        next: () => this.router.navigate([`/working-capital/loans/view/${this.loanId}`]),
        error: () => this.isSaving.set(false),
      });
  }

  /**
   * Posts one of the transaction commands.
   *
   * Only the fields the command actually takes are sent. Fineract rejects a request carrying a
   * parameter the command does not support, so an amount left over from another branch of the form
   * would turn a valid undo into a 400.
   */
  private submitTransaction(): void {
    const body: PostWorkingCapitalLoanTransactionsRequest = {
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };
    if (this.isDated && this.transactionDate) {
      body.transactionDate = formatDateToFineract(this.transactionDate);
    }
    if (this.isAmountEntered || this.command === 'prepay') {
      body.transactionAmount = this.transaction.transactionAmount;
    }
    if (this.command === 'chargeOff' && this.transaction.chargeOffReasonId != null) {
      body.chargeOffReasonId = this.transaction.chargeOffReasonId;
    }
    if (this.command === 'writeOff' && this.transaction.writeoffReasonId != null) {
      body.writeoffReasonId = this.transaction.writeoffReasonId;
    }
    if (this.command === 'undoWriteOff' && this.transaction.reversalExternalId) {
      body.reversalExternalId = this.transaction.reversalExternalId;
    }
    if (this.isDated && this.transaction.externalId) {
      body.externalId = this.transaction.externalId;
    }
    if (this.command !== 'undoChargeOff' && this.transaction.note) {
      body.note = this.transaction.note;
    }

    this.transactionsService
      .postWorkingCapitalLoansLoanIdTransactions(
        this.loanId,
        POSTED_TRANSACTION_COMMAND[this.command],
        body,
      )
      .subscribe({
        next: () => this.router.navigate([`/working-capital/loans/view/${this.loanId}`]),
        error: () => this.isSaving.set(false),
      });
  }

  private submitMarkAsFraud(): void {
    this.loansService
      .putWorkingCapitalLoansLoanIdMarkAsFraud(this.loanId, { fraud: this.fraud })
      .subscribe({
        next: () => this.router.navigate([`/working-capital/loans/view/${this.loanId}`]),
        error: () => this.isSaving.set(false),
      });
  }

  private submitDiscount(): void {
    this.loansService.putWorkingCapitalLoansLoanIdDiscount(this.loanId, this.discount).subscribe({
      next: () => this.router.navigate([`/working-capital/loans/view/${this.loanId}`]),
      error: () => this.isSaving.set(false),
    });
  }

  private submitPaymentRate(): void {
    if (this.paymentRateEffectiveDate) {
      this.paymentRate.effectiveDate = formatDateToFineract(this.paymentRateEffectiveDate);
    }
    this.loansService
      .putWorkingCapitalLoansLoanIdPaymentRate(this.loanId, this.paymentRate)
      .subscribe({
        next: () =>
          this.router.navigate([`/working-capital/loans/view/${this.loanId}`], {
            queryParams: { tab: 'rateChanges' },
          }),
        error: () => this.isSaving.set(false),
      });
  }

  private submitLifecycleCommand(): void {
    if (this.command === 'approve' && this.approvedOnDate) {
      this.lifecycle.approvedOnDate = formatDateToFineract(this.approvedOnDate);
    }
    if (this.command === 'disburse') {
      if (this.expectedDisbursementDate) {
        this.lifecycle.expectedDisbursementDate = formatDateToFineract(
          this.expectedDisbursementDate,
        );
      }
      if (this.actualDisbursementDate) {
        this.lifecycle.actualDisbursementDate = formatDateToFineract(this.actualDisbursementDate);
      }
    }
    if (this.command === 'reject' && this.rejectedOnDate) {
      this.lifecycle.rejectedOnDate = formatDateToFineract(this.rejectedOnDate);
    }

    this.loansService
      .postWorkingCapitalLoansLoanId(this.loanId, this.command, this.lifecycle)
      .subscribe({
        next: () => this.router.navigate([`/working-capital/loans/view/${this.loanId}`]),
        error: () => this.isSaving.set(false),
      });
  }

  onCancel(): void {
    this.router.navigate([`/working-capital/loans/view/${this.loanId}`]);
  }
}
