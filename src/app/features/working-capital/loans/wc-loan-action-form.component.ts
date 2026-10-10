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
  IonDatetime,
  IonDatetimeButton,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';
import {
  WorkingCapitalLoansService,
  WorkingCapitalLoanTransactionsService,
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

/**
 * Handles WC loan lifecycle commands (approve, reject, undoapproval, disburse, undodisbursal)
 * and repayment transactions. Branches on the :command route param — mirrors the main
 * loan-transaction-form pattern.
 */
@Component({
  selector: 'app-wc-loan-action-form',
  standalone: true,
  imports: [
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
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ title | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
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
              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'WC_LOANS.ACTIONS.EXPECTED_DISBURSEMENT_DATE' | appTranslate
                }}</ion-label>
                @if (pickersReady()) {
                  <ion-datetime-button
                    datetime="expectedDisbursementDate-picker"
                  ></ion-datetime-button>
                }
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="expectedDisbursementDate-picker"
                      data-testid="expectedDisbursementDate-picker"
                      presentation="date"
                      name="expectedDisbursementDate"
                      [(ngModel)]="expectedDisbursementDate"
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>
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

            @if (
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
    `,
  ],
})
export class WcLoanActionFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly loansService = inject(WorkingCapitalLoansService);
  private readonly transactionsService = inject(WorkingCapitalLoanTransactionsService);
  private readonly route = inject(ActivatedRoute);
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

  approvedOnDate: string | null = null;
  expectedDisbursementDate: string | null = null;
  actualDisbursementDate: string | null = null;
  rejectedOnDate: string | null = null;
  transactionDate: string | null = toIsoDate(new Date());
  paymentRateEffectiveDate: string | null = toIsoDate(new Date());

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
    };
    return map[this.command] ?? this.command;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const cmd = this.route.snapshot.paramMap.get('command');
    if (id) this.loanId = +id;
    if (cmd) this.command = cmd;
  }

  onSubmit(): void {
    this.isSaving.set(true);

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
