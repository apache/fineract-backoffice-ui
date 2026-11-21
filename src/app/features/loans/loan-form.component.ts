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

import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { PlatformDateService } from '../../core/services/platform-date.service';
import { FormsModule, NgForm } from '@angular/forms';
import { ButtonComponent } from '../../ui/button/button.component';
import { I18N, TranslatePipe } from '../../core/adapters';
import { MutationOutcomeService } from '../../core/services/mutation-outcome.service';
import { ClientSearchComponent } from '../../shared/components/client-search/client-search.component';
import {
  LoansService,
  PostLoansRequest,
  PostLoansRequestChargeData,
  PutLoansLoanIdRequest,
  LoanProductsService,
  GetLoanProductsResponse,
  GetLoanProductsProductIdResponse,
  GetLoansLoanIdResponse,
} from '../../api';
import {
  ADVANCED_PAYMENT_ALLOCATION_STRATEGY,
  LOAN_SCHEDULE_TYPE,
  isAdvancedPaymentAllocationStrategy,
  isProgressiveScheduleType,
  readScheduleTypeCode,
  requiredStrategyFor,
} from '../products/loan-schedule-type';
import { NotificationService } from '../../core/services/notification.service';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonChip,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonNote,
} from '@ionic/angular/standalone';
import {
  formatArrayDate,
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../core/utils/date-formatter';
import { createPickersReady } from '../../shared/utils/pickers-ready';
import { toIsoFineractDate } from '../../core/adapters/api/fineract-date';

// The loan read API exposes this date, but the generated response model omits it.
type LoanResponseWithRepaymentDate = GetLoansLoanIdResponse & {
  expectedFirstRepaymentOnDate?: string | number[] | null;
};

const OPERATION_FAILED_MESSAGE = 'Operation failed. Please try again.';

/**
 * The three attributes Fineract accepts on an application and the generated model does not declare.
 *
 * `POST /loans` and `PUT /loans/{loanId}` both take `loanOfficerId`, `loanPurposeId` and `fundId`,
 * and the loan template offers the options for all three. `PostLoansRequest` declares none of them
 * — the same class of gap as #653 — while `linkAccountId`, `createStandingInstructionAtDisbursement`
 * and `charges` are declared and need no widening here.
 */
type LoanApplicationRequest = PostLoansRequest & {
  loanOfficerId?: number;
  loanPurposeId?: number;
  fundId?: number;
};

/**
 * The option lists the loan template carries, with the field each one is labelled by.
 *
 * Measured against a running Fineract rather than read off the generated response model, because
 * the label field differs per list and getting it wrong shows the operator a row of blanks:
 * an officer is `displayName` ("Officer, Tpl"), a purpose is a code value so it is `name` rather
 * than `value`, a fund is `{id, name}` and nothing else, a linkable account carries `accountNo`
 * and `productName`, and a charge carries its own `amount` and whether it is a `penalty`.
 *
 * The lists arrive only when the request names both a client and a product; with either missing,
 * the template answers `productOptions` and little else, which is why {@link loadApplicationTemplate}
 * waits for both.
 */
interface LoanOfficerOption {
  id?: number;
  displayName?: string;
}
interface NamedOption {
  id?: number;
  name?: string;
}
interface LinkableAccountOption {
  id?: number;
  accountNo?: string;
  productName?: string;
}
interface ChargeOption {
  id?: number;
  name?: string;
  amount?: number;
  penalty?: boolean;
  chargeTimeType?: { id?: number; code?: string; value?: string };
}
interface LoanApplicationTemplate {
  loanOfficerOptions?: LoanOfficerOption[];
  loanPurposeOptions?: NamedOption[];
  fundOptions?: NamedOption[];
  accountLinkingOptions?: LinkableAccountOption[];
  chargeOptions?: ChargeOption[];
}

/**
 * The charges already on a loan, for an edit.
 *
 * Read defensively: the loan response's charge rows carry the label and timing this form shows,
 * and the generated `charges` item type declares almost none of it.
 */
function readLoanCharges(loan: GetLoansLoanIdResponse): SelectedCharge[] {
  const rows = (loan.charges ?? []) as unknown as {
    chargeId?: number;
    id?: number;
    name?: string;
    amount?: number;
    penalty?: boolean;
    dueDate?: string | number[];
    chargeTimeType?: { code?: string; value?: string };
  }[];
  return rows
    .map((row) => ({
      chargeId: (row.chargeId ?? row.id) as number,
      name: row.name ?? '',
      amount: row.amount ?? null,
      penalty: row.penalty === true,
      timing: row.chargeTimeType?.value ?? '',
      dueDate: toIsoFineractDate(row.dueDate),
      requiresDueDate: CHARGE_TIMINGS_NEEDING_DUE_DATE.has(row.chargeTimeType?.code ?? ''),
    }))
    .filter((row) => row.chargeId !== undefined);
}

/**
 * The `loanType` the platform will take back on an update.
 *
 * Mandatory on `PUT /loans/{id}`: without it the update is refused outright, 400
 * `validation.msg.loan.loanType.cannot.be.blank`, so editing a loan application failed whatever
 * was changed. The edit mapping never carried it, and nothing caught that -- a mocked save
 * answers whatever the client asks it to, and this is the platform's rule.
 *
 * The two sides disagree on the shape: the response states it as an enum,
 * `{ id: 1, code: 'accountType.individual', value: 'Individual' }`, while the request wants the
 * bare word. Hence the last segment of the code, with the form's own default behind it.
 */
function readLoanType(loan: GetLoansLoanIdResponse): string {
  const code = (loan as unknown as { loanType?: { code?: string } }).loanType?.code;
  return code?.split('.').pop() || 'individual';
}

/** A charge on the application being built: the catalogue entry, plus the amount as edited. */
interface SelectedCharge {
  chargeId: number;
  name: string;
  amount: number | null;
  penalty: boolean;
  timing: string;
  /** `YYYY-MM-DD`, as `<ion-input type="date">` holds it. */
  dueDate: string | null;
  requiresDueDate: boolean;
}

/**
 * Charge timings the platform refuses without a due date of their own.
 *
 * Measured, not inferred: a `specifiedDueDate` charge submitted as `{chargeId, amount}` comes
 * back 403 `error.msg.loanCharge.cannot.be.added.as.specified.due.date.outside.range`, naming
 * the submission date, so the platform has no usable default to fall back on and the date has to
 * be asked for. The disbursement date is itself outside that range; the same charge is accepted
 * with a date inside the schedule.
 *
 * Keyed on the code rather than the numeric id, which is what the response labels a timing with
 * and what the Fineract enum is named after.
 */
const CHARGE_TIMINGS_NEEDING_DUE_DATE = new Set([
  'chargeTimeType.specifiedDueDate',
  'chargeTimeType.annualFee',
  'chargeTimeType.monthlyFee',
]);

@Component({
  selector: 'app-loan-form',
  standalone: true,
  imports: [
    FormsModule,
    ButtonComponent,
    TranslatePipe,
    ClientSearchComponent,
    IonIcon,
    IonButton,
    IonSpinner,
    IonNote,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonCheckbox,
    IonChip,
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
            {{
              isEditMode()
                ? ('LOANS.EDIT_LOAN' | appTranslate)
                : ('LOANS.CREATE_LOAN' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          @if (!isModelReady()) {
            <ion-spinner data-testid="loan-form-loading"></ion-spinner>
          } @else {
            <form #loanForm="ngForm" (ngSubmit)="onSubmit()" class="loan-form">
              <div class="form-grid">
                <!-- Client Search with Create Option -->
                <div class="field-container-row">
                  <app-client-search
                    [label]="'COMMON.CLIENT_ID' | appTranslate"
                    [required]="true"
                    [initialClientId]="loan().clientId || null"
                    (clientSelected)="onClientSelected($event)"
                    class="flex-grow"
                  >
                  </app-client-search>
                  <ion-button
                    fill="clear"
                    type="button"
                    [attr.aria-label]="'CLIENTS.CREATE_CLIENT' | appTranslate"
                    [appTooltip]="'CLIENTS.CREATE_CLIENT' | appTranslate"
                    (click)="onCreateClient()"
                    style="margin-top: 4px;"
                  >
                    <ion-icon color="primary" name="add-circle-outline"></ion-icon>
                  </ion-button>
                </div>

                <!-- Product Selection with Create Option -->
                <div class="field-container-row">
                  <ion-item
                    fill="outline"
                    [appTooltip]="'HELP.LOAN_PRODUCT_DESC' | appTranslate"
                    class="flex-grow"
                  >
                    <ion-label position="stacked"
                      >{{ 'LOANS.PRODUCT' | appTranslate
                      }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                    >
                    <ion-select
                      [attr.aria-label]="'LOANS.PRODUCT' | appTranslate"
                      interface="popover"
                      name="productId"
                      [(ngModel)]="loan().productId"
                      (ngModelChange)="onProductSelected($event)"
                      required
                      [disabled]="isEditMode()"
                    >
                      @for (product of products(); track product.id) {
                        <ion-select-option [value]="product.id">{{
                          product.name
                        }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                  <ion-button
                    fill="clear"
                    type="button"
                    [attr.aria-label]="'PRODUCTS.CREATE_LOAN_PRODUCT' | appTranslate"
                    [appTooltip]="'PRODUCTS.CREATE_LOAN_PRODUCT' | appTranslate"
                    (click)="onCreateProduct()"
                    style="margin-top: 4px;"
                    [disabled]="isEditMode()"
                  >
                    <ion-icon color="primary" name="add-circle-outline"></ion-icon>
                  </ion-button>
                </div>

                @if (selectedProductDetails()?.loanScheduleType?.value; as scheduleType) {
                  <div class="field-container-row full-width">
                    <div>
                      <ion-chip [appTooltip]="'HELP.LOAN_SCHEDULE_TYPE_DESC' | appTranslate">
                        {{ 'PRODUCTS.LOAN_SCHEDULE_TYPE' | appTranslate }}: {{ scheduleType }}
                      </ion-chip>
                    </div>
                  </div>
                }

                <!-- Principal -->
                <ion-item fill="outline" [appTooltip]="'HELP.PRINCIPAL_DESC' | appTranslate">
                  <ion-label position="stacked"
                    >{{ 'LOANS.PRINCIPAL' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-input
                    [attr.aria-label]="'LOANS.PRINCIPAL' | appTranslate"
                    type="number"
                    name="principal"
                    [(ngModel)]="loan().principal"
                    required
                  ></ion-input>
                </ion-item>

                <!-- External ID -->
                <ion-item fill="outline" [appTooltip]="'HELP.EXTERNAL_ID_DESC' | appTranslate">
                  <ion-label position="stacked">{{
                    'COMMON.EXTERNAL_ID' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'COMMON.EXTERNAL_ID' | appTranslate"
                    name="externalId"
                    [(ngModel)]="loan().externalId"
                  ></ion-input>
                </ion-item>

                <!-- Submitted On -->
                <ion-item fill="outline" [appTooltip]="'HELP.SUBMITTED_ON_DESC' | appTranslate">
                  <ion-label position="stacked"
                    >{{ 'COMMON.SUBMITTED_ON' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  @if (pickersReady()) {
                    <ion-datetime-button datetime="submittedOnDate-picker"></ion-datetime-button>
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="submittedOnDate-picker"
                        data-testid="submittedOnDate-picker"
                        presentation="date"
                        name="submittedOnDate"
                        [ngModel]="submittedOnDate()"
                        (ngModelChange)="submittedOnDate.set($event)"
                        required
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>

                <!-- Expected Disbursement -->
                <ion-item
                  fill="outline"
                  [appTooltip]="'HELP.EXPECTED_DISBURSEMENT_DESC' | appTranslate"
                >
                  <ion-label position="stacked"
                    >{{ 'LOANS.EXPECTED_DISBURSEMENT' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
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
                        [ngModel]="expectedDisbursementDate()"
                        (ngModelChange)="expectedDisbursementDate.set($event)"
                        required
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>

                <!-- Term Frequency -->
                <ion-item fill="outline" [appTooltip]="'HELP.TERM_FREQUENCY_DESC' | appTranslate">
                  <ion-label position="stacked"
                    >{{ 'LOANS.TERM_FREQUENCY' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-input
                    [attr.aria-label]="'LOANS.TERM_FREQUENCY' | appTranslate"
                    type="number"
                    name="loanTermFrequency"
                    [(ngModel)]="loan().loanTermFrequency"
                    required
                  ></ion-input>
                </ion-item>

                <!-- Term Type -->
                <ion-item fill="outline" [appTooltip]="'HELP.TERM_TYPE_DESC' | appTranslate">
                  <ion-label position="stacked"
                    >{{ 'LOANS.TERM_TYPE' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-select
                    [attr.aria-label]="'LOANS.TERM_TYPE' | appTranslate"
                    interface="popover"
                    name="loanTermFrequencyType"
                    [(ngModel)]="loan().loanTermFrequencyType"
                    required
                  >
                    <ion-select-option [value]="0">{{
                      'COMMON.DAYS' | appTranslate
                    }}</ion-select-option>
                    <ion-select-option [value]="1">{{
                      'COMMON.WEEKS' | appTranslate
                    }}</ion-select-option>
                    <ion-select-option [value]="2">{{
                      'COMMON.MONTHS' | appTranslate
                    }}</ion-select-option>
                    <ion-select-option [value]="3">{{
                      'COMMON.YEARS' | appTranslate
                    }}</ion-select-option>
                  </ion-select>
                </ion-item>

                <!-- Number of Repayments -->
                <ion-item fill="outline" [appTooltip]="'HELP.REPAYMENTS_COUNT_DESC' | appTranslate">
                  <ion-label position="stacked"
                    >{{ 'LOANS.REPAYMENTS_COUNT' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-input
                    [attr.aria-label]="'LOANS.REPAYMENTS_COUNT' | appTranslate"
                    type="number"
                    name="numberOfRepayments"
                    [(ngModel)]="loan().numberOfRepayments"
                    required
                  ></ion-input>
                </ion-item>

                <!-- Repayment Every -->
                <ion-item fill="outline" [appTooltip]="'HELP.REPAYMENT_EVERY_DESC' | appTranslate">
                  <ion-label position="stacked"
                    >{{ 'LOANS.REPAYMENT_EVERY' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-input
                    [attr.aria-label]="'LOANS.REPAYMENT_EVERY' | appTranslate"
                    type="number"
                    name="repaymentEvery"
                    [(ngModel)]="loan().repaymentEvery"
                    required
                  ></ion-input>
                </ion-item>

                <!-- Repayment Frequency Type -->
                <ion-item fill="outline">
                  <ion-label position="stacked"
                    >{{ 'COMMON.FREQUENCY' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-select
                    [attr.aria-label]="'COMMON.FREQUENCY' | appTranslate"
                    interface="popover"
                    name="repaymentFrequencyType"
                    [(ngModel)]="loan().repaymentFrequencyType"
                    required
                  >
                    <ion-select-option [value]="0">{{
                      'COMMON.DAYS' | appTranslate
                    }}</ion-select-option>
                    <ion-select-option [value]="1">{{
                      'COMMON.WEEKS' | appTranslate
                    }}</ion-select-option>
                    <ion-select-option [value]="2">{{
                      'COMMON.MONTHS' | appTranslate
                    }}</ion-select-option>
                  </ion-select>
                </ion-item>

                <!-- Interest Rate Per Period -->
                <ion-item fill="outline">
                  <ion-label position="stacked"
                    >{{ 'COMMON.INTEREST_RATE' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-input
                    [attr.aria-label]="'COMMON.INTEREST_RATE' | appTranslate"
                    type="number"
                    name="interestRatePerPeriod"
                    [(ngModel)]="loan().interestRatePerPeriod"
                    required
                  ></ion-input>
                </ion-item>

                <!-- Interest Type -->
                <ion-item fill="outline">
                  <ion-label position="stacked"
                    >{{ 'PRODUCTS.INTEREST_TYPE' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-select
                    [attr.aria-label]="'PRODUCTS.INTEREST_TYPE' | appTranslate"
                    interface="popover"
                    name="interestType"
                    [(ngModel)]="loan().interestType"
                    required
                  >
                    <ion-select-option [value]="0">{{
                      'LOANS.DECLINING_BALANCE' | appTranslate
                    }}</ion-select-option>
                    <ion-select-option [value]="1">{{
                      'LOANS.FLAT' | appTranslate
                    }}</ion-select-option>
                  </ion-select>
                </ion-item>

                <!-- Amortization Type -->
                <ion-item fill="outline">
                  <ion-label position="stacked"
                    >{{ 'PRODUCTS.AMORTIZATION_TYPE' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-select
                    [attr.aria-label]="'PRODUCTS.AMORTIZATION_TYPE' | appTranslate"
                    interface="popover"
                    name="amortizationType"
                    [(ngModel)]="loan().amortizationType"
                    required
                  >
                    <ion-select-option [value]="1">{{
                      'LOANS.EQUAL_INSTALLMENTS' | appTranslate
                    }}</ion-select-option>
                    <ion-select-option [value]="0">{{
                      'LOANS.EQUAL_PRINCIPAL' | appTranslate
                    }}</ion-select-option>
                  </ion-select>
                </ion-item>

                <!-- Interest Calculation Period Type -->
                <ion-item fill="outline">
                  <ion-label position="stacked"
                    >{{ 'PRODUCTS.INTEREST_CALCULATION_PERIOD_TYPE' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-select
                    [attr.aria-label]="'PRODUCTS.INTEREST_CALCULATION_PERIOD_TYPE' | appTranslate"
                    interface="popover"
                    name="interestCalculationPeriodType"
                    [(ngModel)]="loan().interestCalculationPeriodType"
                    required
                  >
                    <ion-select-option [value]="0">{{
                      'LOANS.DAILY' | appTranslate
                    }}</ion-select-option>
                    <ion-select-option [value]="1">{{
                      'LOANS.SAME_AS_REPAYMENT' | appTranslate
                    }}</ion-select-option>
                  </ion-select>
                </ion-item>

                <!-- Grace on Principal Payment -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'LOANS.GRACE_ON_PRINCIPAL_PAYMENT' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.GRACE_ON_PRINCIPAL_PAYMENT' | appTranslate"
                    type="number"
                    name="graceOnPrincipalPayment"
                    [(ngModel)]="loan().graceOnPrincipalPayment"
                  ></ion-input>
                </ion-item>

                <!-- Grace on Interest Payment -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'LOANS.GRACE_ON_INTEREST_PAYMENT' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.GRACE_ON_INTEREST_PAYMENT' | appTranslate"
                    type="number"
                    name="graceOnInterestPayment"
                    [(ngModel)]="loan().graceOnInterestPayment"
                  ></ion-input>
                </ion-item>

                <!-- Grace on Interest Charged -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'LOANS.GRACE_ON_INTEREST_CHARGED' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.GRACE_ON_INTEREST_CHARGED' | appTranslate"
                    type="number"
                    name="graceOnInterestCharged"
                    [(ngModel)]="loan().graceOnInterestCharged"
                  ></ion-input>
                </ion-item>

                <!-- In Arrears Tolerance -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'LOANS.IN_ARREARS_TOLERANCE' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.IN_ARREARS_TOLERANCE' | appTranslate"
                    type="number"
                    name="inArrearsTolerance"
                    [(ngModel)]="loan().inArrearsTolerance"
                  ></ion-input>
                </ion-item>

                <!-- Repayments Starting From Date -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'LOANS.REPAYMENTS_STARTING_FROM_DATE' | appTranslate
                  }}</ion-label>
                  @if (pickersReady()) {
                    <ion-datetime-button datetime="repaymentsStartingFromDate-picker">
                      @if (!repaymentsStartingFromDate && !storedRepaymentStartDate()) {
                        <span slot="date-target">{{
                          'LOANS.REPAYMENT_START_DATE_NOT_SET' | appTranslate
                        }}</span>
                      }
                    </ion-datetime-button>
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="repaymentsStartingFromDate-picker"
                        data-testid="repaymentsStartingFromDate-picker"
                        presentation="date"
                        name="repaymentsStartingFromDate"
                        [ngModel]="repaymentsStartingFromDate ?? storedRepaymentStartDate()"
                        (ngModelChange)="repaymentsStartingFromDate = $event"
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                  @if (!isEditMode() && repaymentsStartingFromDate) {
                    <app-button
                      type="button"
                      intent="neutral"
                      emphasis="quiet"
                      size="small"
                      data-testid="clear-repayment-start-date"
                      (click)="repaymentsStartingFromDate = null"
                    >
                      {{ 'LOANS.CLEAR_REPAYMENT_START_DATE' | appTranslate }}
                    </app-button>
                  }
                </ion-item>

                @if (isProgressive()) {
                  <ion-checkbox
                    name="interestRecognitionOnDisbursementDate"
                    [(ngModel)]="loan().interestRecognitionOnDisbursementDate"
                  >
                    {{ 'LOANS.INTEREST_RECOGNITION_ON_DISBURSEMENT_DATE' | appTranslate }}
                  </ion-checkbox>
                }

                @if (isProgressive() && selectedProductDetails()?.multiDisburseLoan) {
                  <ion-checkbox
                    name="allowFullTermForTranche"
                    [(ngModel)]="loan().allowFullTermForTranche"
                  >
                    {{ 'LOANS.ALLOW_FULL_TERM_FOR_TRANCHE' | appTranslate }}
                  </ion-checkbox>
                }
              </div>

              <!--
                Ownership, linkage and charges. Every control here is optional, so none is marked
                required and none belongs in requiredFieldLabels; the options arrive from the loan
                template, which answers them only once a client and a product are both chosen.
              -->
              @if (!loan().clientId || !loan().productId) {
                <ion-note color="medium" class="field-note" data-testid="loan-options-hint">
                  {{ 'LOANS.OPTIONS_NEED_CLIENT_AND_PRODUCT' | appTranslate }}
                </ion-note>
              } @else {
                <h3 class="section-heading">{{ 'LOANS.OWNERSHIP_SECTION' | appTranslate }}</h3>
                <div class="form-grid">
                  <ion-item fill="outline" [appTooltip]="'HELP.LOAN_OFFICER_DESC' | appTranslate">
                    <ion-label position="stacked">{{
                      'LOANS.LOAN_OFFICER' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'LOANS.LOAN_OFFICER' | appTranslate"
                      interface="popover"
                      name="loanOfficerId"
                      data-testid="loan-officer-select"
                      [(ngModel)]="loan().loanOfficerId"
                    >
                      @for (officer of applicationTemplate().loanOfficerOptions; track officer.id) {
                        <ion-select-option [value]="officer.id">{{
                          officer.displayName
                        }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>

                  <ion-item fill="outline" [appTooltip]="'HELP.LOAN_PURPOSE_DESC' | appTranslate">
                    <ion-label position="stacked">{{
                      'LOANS.LOAN_PURPOSE' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'LOANS.LOAN_PURPOSE' | appTranslate"
                      interface="popover"
                      name="loanPurposeId"
                      data-testid="loan-purpose-select"
                      [(ngModel)]="loan().loanPurposeId"
                    >
                      @for (purpose of applicationTemplate().loanPurposeOptions; track purpose.id) {
                        <ion-select-option [value]="purpose.id">{{
                          purpose.name
                        }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>

                  <ion-item fill="outline" [appTooltip]="'HELP.LOAN_FUND_DESC' | appTranslate">
                    <ion-label position="stacked">{{ 'LOANS.FUND' | appTranslate }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'LOANS.FUND' | appTranslate"
                      interface="popover"
                      name="fundId"
                      data-testid="loan-fund-select"
                      [(ngModel)]="loan().fundId"
                    >
                      @for (fund of applicationTemplate().fundOptions; track fund.id) {
                        <ion-select-option [value]="fund.id">{{ fund.name }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </div>

                <h3 class="section-heading">{{ 'LOANS.LINKAGE_SECTION' | appTranslate }}</h3>
                @if (applicationTemplate().accountLinkingOptions?.length) {
                  <div class="form-grid">
                    <ion-item
                      fill="outline"
                      [appTooltip]="'HELP.LINKED_SAVINGS_DESC' | appTranslate"
                    >
                      <ion-label position="stacked">{{
                        'LOANS.LINKED_SAVINGS' | appTranslate
                      }}</ion-label>
                      <ion-select
                        [attr.aria-label]="'LOANS.LINKED_SAVINGS' | appTranslate"
                        interface="popover"
                        name="linkAccountId"
                        data-testid="loan-linked-account-select"
                        [(ngModel)]="loan().linkAccountId"
                      >
                        @for (
                          account of applicationTemplate().accountLinkingOptions;
                          track account.id
                        ) {
                          <ion-select-option [value]="account.id">{{
                            'LOANS.ACCOUNT_OPTION'
                              | appTranslate
                                : { accountNo: account.accountNo, product: account.productName }
                          }}</ion-select-option>
                        }
                      </ion-select>
                    </ion-item>
                  </div>
                  @if (loan().linkAccountId) {
                    <ion-checkbox
                      labelPlacement="end"
                      name="createStandingInstructionAtDisbursement"
                      data-testid="loan-standing-instruction-checkbox"
                      [(ngModel)]="loan().createStandingInstructionAtDisbursement"
                    >
                      {{ 'LOANS.STANDING_INSTRUCTION_AT_DISBURSEMENT' | appTranslate }}
                    </ion-checkbox>
                  }
                } @else {
                  <ion-note
                    color="medium"
                    class="field-note"
                    data-testid="loan-no-linkable-accounts"
                  >
                    {{ 'LOANS.NO_LINKABLE_ACCOUNTS' | appTranslate }}
                  </ion-note>
                }

                <h3 class="section-heading">{{ 'LOANS.CHARGES_SECTION' | appTranslate }}</h3>
                @if (selectedCharges().length === 0) {
                  <ion-note color="medium" class="field-note" data-testid="loan-no-charges">
                    {{ 'LOANS.NO_CHARGES' | appTranslate }}
                  </ion-note>
                } @else {
                  @for (charge of selectedCharges(); track charge.chargeId) {
                    <div class="charge-row" [attr.data-testid]="'loan-charge-' + charge.chargeId">
                      <span class="charge-name">{{ charge.name }}</span>
                      @if (charge.penalty) {
                        <ion-chip color="warning">{{ 'LOANS.PENALTY' | appTranslate }}</ion-chip>
                      }
                      @if (charge.timing) {
                        <ion-note color="medium">{{ charge.timing }}</ion-note>
                      }
                      <ion-item fill="outline" class="charge-amount">
                        <ion-label position="stacked">{{
                          'COMMON.AMOUNT' | appTranslate
                        }}</ion-label>
                        <ion-input
                          type="number"
                          [attr.aria-label]="
                            'LOANS.CHARGE_AMOUNT_FOR' | appTranslate: { charge: charge.name }
                          "
                          [name]="'chargeAmount-' + charge.chargeId"
                          [attr.data-testid]="'loan-charge-amount-' + charge.chargeId"
                          [ngModel]="charge.amount"
                          (ngModelChange)="onChargeAmountChange(charge.chargeId, $event)"
                        ></ion-input>
                      </ion-item>
                      @if (charge.requiresDueDate) {
                        <ion-item fill="outline" class="charge-amount">
                          <ion-label position="stacked">{{
                            'LOANS.CHARGE_DUE_DATE' | appTranslate
                          }}</ion-label>
                          <ion-input
                            type="date"
                            [attr.aria-label]="
                              'LOANS.CHARGE_DUE_DATE_FOR' | appTranslate: { charge: charge.name }
                            "
                            [name]="'chargeDueDate-' + charge.chargeId"
                            [attr.data-testid]="'loan-charge-due-date-' + charge.chargeId"
                            [ngModel]="charge.dueDate"
                            (ngModelChange)="onChargeDueDateChange(charge.chargeId, $event)"
                          ></ion-input>
                        </ion-item>
                      }
                      <ion-button
                        fill="clear"
                        type="button"
                        color="danger"
                        [attr.aria-label]="
                          'LOANS.REMOVE_CHARGE' | appTranslate: { charge: charge.name }
                        "
                        [attr.data-testid]="'loan-charge-remove-' + charge.chargeId"
                        (click)="onRemoveCharge(charge.chargeId)"
                      >
                        <ion-icon name="trash-outline"></ion-icon>
                      </ion-button>
                    </div>
                  }
                }
                @if (addableCharges().length) {
                  <div class="field-container-row">
                    <ion-item fill="outline" class="flex-grow">
                      <ion-label position="stacked">{{
                        'LOANS.ADD_CHARGE' | appTranslate
                      }}</ion-label>
                      <ion-select
                        [attr.aria-label]="'LOANS.ADD_CHARGE' | appTranslate"
                        interface="popover"
                        name="chargeToAdd"
                        data-testid="loan-charge-add-select"
                        [(ngModel)]="chargeToAdd"
                      >
                        @for (option of addableCharges(); track option.id) {
                          <ion-select-option [value]="option.id">{{
                            option.name
                          }}</ion-select-option>
                        }
                      </ion-select>
                    </ion-item>
                    <ion-button
                      fill="clear"
                      type="button"
                      [disabled]="!chargeToAdd"
                      [attr.aria-label]="'LOANS.ADD_CHARGE' | appTranslate"
                      data-testid="loan-charge-add-btn"
                      (click)="onAddCharge()"
                    >
                      <ion-icon color="primary" name="add-circle-outline"></ion-icon>
                    </ion-button>
                  </div>
                }
              }

              <div class="form-actions">
                @if (missingRequiredFields(loanForm); as missing) {
                  <ion-note
                    color="medium"
                    class="submit-hint"
                    id="loan-submit-hint"
                    data-testid="loan-submit-hint"
                    aria-live="polite"
                  >
                    {{ 'COMMON.COMPLETE_FIELDS' | appTranslate: { fields: missing } }}
                  </ion-note>
                }
                <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                  {{ 'COMMON.CANCEL' | appTranslate }}
                </ion-button>
                <ion-button
                  color="primary"
                  type="submit"
                  [disabled]="
                    loanForm.invalid ||
                    !loan().clientId ||
                    chargesMissingDueDate().length > 0 ||
                    isSaving()
                  "
                  [attr.aria-describedby]="
                    missingRequiredFields(loanForm) ? 'loan-submit-hint' : null
                  "
                  id="loan-submit-btn"
                  data-testid="loan-submit-btn"
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
          }
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 24px;
        max-width: 900px;
        margin: 0 auto;
      }
      .loan-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
      .field-container-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .flex-grow {
        flex-grow: 1;
      }
      .section-heading {
        margin: 8px 0 4px;
        font-size: 15px;
        font-weight: 600;
      }
      .field-note {
        display: block;
        padding: 0 4px;
        font-size: 12px;
        line-height: 1.4;
      }
      .charge-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }
      .charge-name {
        font-weight: 500;
      }
      .charge-amount {
        min-width: 140px;
      }
      .required-marker {
        color: var(--ion-color-danger, #eb445a);
        margin-inline-start: 2px;
      }
      .submit-hint {
        display: block;
        align-self: center;
        text-align: end;
        font-size: 0.8125rem;
      }
    `,
  ],
})
export class LoanFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly loansService = inject(LoansService);
  private readonly productService = inject(LoanProductsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly platformDate = inject(PlatformDateService);
  private readonly notifications = inject(NotificationService);
  private readonly mutationOutcome = inject(MutationOutcomeService);
  private readonly i18n = inject(I18N);

  private readonly LIST_PATH = '/loans';

  loanId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly loan = signal<LoanApplicationRequest>({
    loanType: 'individual',
  });

  /**
   * Whether the model the form binds to is final.
   *
   * In edit mode the record arrives after the view would otherwise have been created, and
   * `[(ngModel)]` writes its value back in a microtask — so the first change-detection pass read
   * `undefined` and the verification pass read the loaded value, which is
   * ExpressionChangedAfterItHasBeenChecked (NG0100), logged on every visit to an existing loan.
   * Holding the form back until the record is in place removes the cause rather than the symptom,
   * and stops an edit form flashing empty defaults over a real loan.
   */
  readonly isModelReady = signal(false);
  readonly submittedOnDate = signal(this.platformDate.today());
  readonly expectedDisbursementDate = signal(this.platformDate.today());
  repaymentsStartingFromDate: string | null = null;
  readonly storedRepaymentStartDate = signal<string | null>(null);
  readonly products = signal<GetLoanProductsResponse[]>([]);
  readonly selectedProductDetails = signal<GetLoanProductsProductIdResponse | null>(null);

  /** The template's option lists, empty until a client and a product are both chosen. */
  readonly applicationTemplate = signal<LoanApplicationTemplate>({});
  /** The charges on this application, seeded from the product and editable before submit. */
  readonly selectedCharges = signal<SelectedCharge[]>([]);
  /** Which catalogue charge the add control is pointing at. */
  chargeToAdd: number | null = null;

  /** The charges not already on the application, so the add list never offers a duplicate. */
  /** Charges whose timing the platform will not accept without a date, still missing one. */
  readonly chargesMissingDueDate = computed(() =>
    this.selectedCharges().filter((charge) => charge.requiresDueDate && !charge.dueDate),
  );
  readonly addableCharges = computed(() => {
    const taken = new Set(this.selectedCharges().map((charge) => charge.chargeId));
    return (this.applicationTemplate().chargeOptions ?? []).filter(
      (option) => option.id !== undefined && !taken.has(option.id),
    );
  });

  ngOnInit() {
    this.seedPlatformDates();
    this.loadProducts();

    this.route.queryParams.subscribe((queryParams) => {
      const clientId = queryParams['clientId'];
      if (clientId) {
        this.loan().clientId = +clientId;
        this.loadApplicationTemplate();
      }
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loanId = +id;
        this.isEditMode.set(true);
        this.loadLoanData();
      } else {
        // Nothing to wait for when creating: the model is already the empty one the form binds to.
        this.isModelReady.set(true);
      }
    });
  }

  /**
   * Seeds the date defaults from the platform, not the browser.
   *
   * Fineract judges "the future" by its own reckoning — the tenant's timezone, or the business
   * date when that feature is on — so a default taken from `new Date()` is refused whenever the
   * browser is ahead of it (#758). Only on create: an edit loads the record's own dates and must
   * not have them overwritten.
   */
  private seedPlatformDates(): void {
    if (this.isEditMode()) return;
    this.platformDate.resolveToday().subscribe((today) => {
      if (this.isEditMode()) return;
      this.submittedOnDate.set(today);
      this.expectedDisbursementDate.set(today);
    });
  }

  onCreateClient() {
    this.router.navigate(['/clients/create']);
  }

  onCreateProduct() {
    this.router.navigate(['/products/loan/create']);
  }

  private loadProducts() {
    this.productService.getLoanproducts().subscribe({
      next: (data: GetLoanProductsResponse[]) => this.products.set(data || []),
      error: () => this.notifications.error(OPERATION_FAILED_MESSAGE),
    });
  }

  onProductSelected(productId: number, resetProgressiveFields = true) {
    this.selectedProductDetails.set(null);
    if (resetProgressiveFields) {
      this.loan().interestRecognitionOnDisbursementDate = undefined;
      this.loan().allowFullTermForTranche = undefined;
    }
    if (!productId) return;
    this.productService.getLoanproductsProductId(productId).subscribe({
      next: (data: GetLoanProductsProductIdResponse) => {
        this.selectedProductDetails.set(data);
        // Editing an existing loan already has its own values; only a new application is filled in.
        if (!this.isEditMode()) {
          this.applyProductDefaults(data);
        }
        // The product and the template are fetched in parallel and either can answer first.
        // Seeding needs both, so both callbacks attempt it; the guards inside make the second
        // attempt a no-op.
        this.seedProductCharges();
      },
      error: () => this.notifications.error(OPERATION_FAILED_MESSAGE),
    });
    this.loadApplicationTemplate();
  }

  onClientSelected(clientId: number | null): void {
    this.loan().clientId = clientId ?? undefined;
    this.loadApplicationTemplate();
  }

  /**
   * Loads the option lists for the ownership, linkage and charge sections.
   *
   * Only once a client and a product are both chosen: asked with either missing, the template
   * answers `productOptions` and the booleans and none of these lists, so calling it earlier
   * would quietly leave every select empty. Measured on a running platform.
   *
   * A failure is not reported to the operator. Every field it populates is optional, the form
   * stays submittable without them, and a toast here would fire on the ordinary path of picking a
   * product before a client.
   */
  private loadApplicationTemplate(): void {
    const clientId = this.loan().clientId;
    const productId = this.loan().productId;
    if (!clientId || !productId) {
      this.applicationTemplate.set({});
      return;
    }
    this.loansService.getLoansTemplate(clientId, undefined, productId, 'individual').subscribe({
      next: (template) => {
        this.applicationTemplate.set((template ?? {}) as LoanApplicationTemplate);
        this.seedProductCharges();
      },
      error: () => this.applicationTemplate.set({}),
    });
  }

  /**
   * Puts the product's own charges on a new application.
   *
   * The product names only the charge ids; their names and default amounts come from the
   * template's `chargeOptions`, which is also the only declared place to read them from — the
   * generated `LoanProductChargeData` carries `id` and `amount` and nothing to label a row with.
   *
   * Only on create, and only while the operator has not touched the list: an edit loads the
   * loan's own charges, and re-seeding after a product change must not discard a charge that was
   * added or an amount that was overridden.
   */
  private seedProductCharges(): void {
    if (this.isEditMode() || this.selectedCharges().length > 0) return;
    const catalogue = this.applicationTemplate().chargeOptions ?? [];
    const productCharges = this.selectedProductDetails()?.charges ?? [];
    const seeded = productCharges
      .map((charge) => catalogue.find((option) => option.id === charge.id))
      .filter((option): option is ChargeOption => option !== undefined)
      .map((option) => this.toSelectedCharge(option));
    if (seeded.length > 0) this.selectedCharges.set(seeded);
  }

  private toSelectedCharge(option: ChargeOption): SelectedCharge {
    return {
      chargeId: option.id as number,
      name: option.name ?? '',
      amount: option.amount ?? null,
      penalty: option.penalty === true,
      timing: option.chargeTimeType?.value ?? '',
      dueDate: null,
      requiresDueDate: CHARGE_TIMINGS_NEEDING_DUE_DATE.has(option.chargeTimeType?.code ?? ''),
    };
  }

  onChargeDueDateChange(chargeId: number, dueDate: string | null): void {
    this.selectedCharges.update((charges) =>
      charges.map((charge) => (charge.chargeId === chargeId ? { ...charge, dueDate } : charge)),
    );
  }

  onAddCharge(): void {
    const option = (this.applicationTemplate().chargeOptions ?? []).find(
      (charge) => charge.id === this.chargeToAdd,
    );
    if (!option) return;
    this.selectedCharges.update((charges) => [...charges, this.toSelectedCharge(option)]);
    this.chargeToAdd = null;
  }

  onRemoveCharge(chargeId: number): void {
    this.selectedCharges.update((charges) =>
      charges.filter((charge) => charge.chargeId !== chargeId),
    );
  }

  onChargeAmountChange(chargeId: number, amount: number | null): void {
    this.selectedCharges.update((charges) =>
      charges.map((charge) => (charge.chargeId === chargeId ? { ...charge, amount } : charge)),
    );
  }

  /**
   * Seeds the terms from the product the user just picked.
   *
   * The product response was previously kept only for the schedule-type chip, which left every
   * term field empty after selection — the officer retyped the product's own defaults by hand,
   * and a slip booked the loan on terms the product never described. This is the same mapping
   * {@link loadLoanData} performs, sourced from the product rather than from an existing loan.
   *
   * Anything the operator has already typed is left alone, so this cannot overwrite deliberate
   * input when the product is changed after the fact.
   */
  private applyProductDefaults(product: GetLoanProductsProductIdResponse): void {
    const loan = this.loan();
    const keep = <T>(current: T | undefined, fallback: T | undefined): T | undefined =>
      current === undefined || current === null || (current as unknown) === '' ? fallback : current;

    this.loan.set({
      ...loan,
      principal: keep(loan.principal, product.principal),
      numberOfRepayments: keep(loan.numberOfRepayments, product.numberOfRepayments),
      repaymentEvery: keep(loan.repaymentEvery, product.repaymentEvery),
      repaymentFrequencyType: keep(loan.repaymentFrequencyType, product.repaymentFrequencyType?.id),
      interestRatePerPeriod: keep(loan.interestRatePerPeriod, product.interestRatePerPeriod),
      interestType: keep(loan.interestType, product.interestType?.id),
      amortizationType: keep(loan.amortizationType, product.amortizationType?.id),
      interestCalculationPeriodType: keep(
        loan.interestCalculationPeriodType,
        product.interestCalculationPeriodType?.id,
      ),
      transactionProcessingStrategyCode: keep(
        loan.transactionProcessingStrategyCode,
        product.transactionProcessingStrategyCode,
      ),
      inArrearsTolerance: keep(loan.inArrearsTolerance, product.inArrearsTolerance),
      graceOnPrincipalPayment: keep(loan.graceOnPrincipalPayment, product.graceOnPrincipalPayment),
      graceOnInterestPayment: keep(loan.graceOnInterestPayment, product.graceOnInterestPayment),
      // The loan term defaults to covering every repayment, which is what the product implies
      // when it states a count and a period but no separate term.
      loanTermFrequency: keep(loan.loanTermFrequency, product.numberOfRepayments),
      loanTermFrequencyType: keep(loan.loanTermFrequencyType, product.repaymentFrequencyType?.id),
    });
  }

  isProgressive(): boolean {
    return this.selectedProductDetails()?.loanScheduleType?.code === LOAN_SCHEDULE_TYPE.PROGRESSIVE;
  }

  private loadLoanData() {
    if (!this.loanId) return;
    // `charges` and `linkedAccount` are associations: asked for without them, the response
    // carries neither key at all, and editing an application would show no charges and no
    // linked account however many the loan has. Measured against a running platform -- the
    // mocked spec and the unit tests both agreed with the wrong belief, because a mock answers
    // whatever the client asks it to.
    this.loansService.getLoansLoanId(this.loanId, undefined, 'charges,linkedAccount').subscribe({
      next: (data: LoanResponseWithRepaymentDate) => {
        // A loaded value is display state, not an officer-selected replacement.
        this.repaymentsStartingFromDate = null;
        this.storedRepaymentStartDate.set(toIsoFineractDate(data.expectedFirstRepaymentOnDate));
        const subDateArray = data.timeline?.submittedOnDate as unknown as number[];
        if (subDateArray) {
          this.submittedOnDate.set(formatArrayDate(subDateArray));
        }
        const expDisbDateArray = data.timeline?.expectedDisbursementDate as unknown as number[];
        if (expDisbDateArray) {
          this.expectedDisbursementDate.set(formatArrayDate(expDisbDateArray));
        }

        this.loan.set({
          clientId: data.clientId,
          productId: data.loanProductId,
          loanType: readLoanType(data),
          principal: data.principal,
          externalId: data.externalId,
          loanTermFrequency: data.termFrequency,
          loanTermFrequencyType: data.termPeriodFrequencyType?.id,
          numberOfRepayments: data.numberOfRepayments,
          repaymentEvery: data.repaymentEvery,
          repaymentFrequencyType: data.repaymentFrequencyType?.id,
          interestRatePerPeriod: data.interestRatePerPeriod,
          interestType: data.interestType?.id,
          amortizationType: data.amortizationType?.id,
          interestCalculationPeriodType: data.interestCalculationPeriodType?.id,
          transactionProcessingStrategyCode: data.transactionProcessingStrategyCode,
          interestRecognitionOnDisbursementDate: data.interestRecognitionOnDisbursementDate,
          allowFullTermForTranche: data.allowFullTermForTranche,
          // So that editing an application preserves them rather than clearing them on save.
          // `fundId` and the linked account are read through a cast: the loan response carries
          // both and the generated model declares neither, the same gap as the request side.
          loanOfficerId: data.loanOfficerId,
          loanPurposeId: data.loanPurposeId,
          fundId: (data as unknown as { fundId?: number }).fundId,
          linkAccountId: (data as unknown as { linkedAccount?: { id?: number } }).linkedAccount?.id,
        });
        this.selectedCharges.set(readLoanCharges(data));
        if (data.loanProductId) {
          this.onProductSelected(data.loanProductId, false);
        }
        this.isModelReady.set(true);
      },
      error: () => {
        this.notifications.error(OPERATION_FAILED_MESSAGE);
        // Show the form anyway: a failed load must not leave a spinner with no way forward.
        this.isModelReady.set(true);
      },
    });
  }

  /**
   * Which label belongs to which required control, for the summary beside Save.
   *
   * Keyed by the `name` on the control. Held here rather than derived from the template because
   * the template is where a reviewer checks it, and the unit test holds the two sides together:
   * it reads the form's own required controls and fails if one of them has no entry, so a field
   * added or renamed without touching this map is reported rather than silently unnamed.
   */
  private readonly requiredFieldLabels: Record<string, string> = {
    productId: 'LOANS.PRODUCT',
    principal: 'LOANS.PRINCIPAL',
    submittedOnDate: 'COMMON.SUBMITTED_ON',
    expectedDisbursementDate: 'LOANS.EXPECTED_DISBURSEMENT',
    loanTermFrequency: 'LOANS.TERM_FREQUENCY',
    loanTermFrequencyType: 'LOANS.TERM_TYPE',
    numberOfRepayments: 'LOANS.REPAYMENTS_COUNT',
    repaymentEvery: 'LOANS.REPAYMENT_EVERY',
    repaymentFrequencyType: 'COMMON.FREQUENCY',
    interestRatePerPeriod: 'COMMON.INTEREST_RATE',
    interestType: 'PRODUCTS.INTEREST_TYPE',
    amortizationType: 'PRODUCTS.AMORTIZATION_TYPE',
    interestCalculationPeriodType: 'PRODUCTS.INTEREST_CALCULATION_PERIOD_TYPE',
  };

  /**
   * The fields standing between the operator and Save, named.
   *
   * `COMPLETE_REQUIRED_FIELDS` on its own — "Complete the required fields to continue" — is no
   * use on a form of twenty controls where thirteen are required and the empty one is off
   * screen. Naming them is the difference between reading the message and hunting the form.
   *
   * The client is listed first and by hand: `app-client-search` holds its own reactive control
   * and never joins this `NgForm`, so the form's validity says nothing about it. That is also
   * why Save now tests `loan().clientId` — without it the button enabled on a form with no
   * client, and the platform refused the result.
   *
   * Empty string when nothing is missing, so the template's `@if` drops the note entirely.
   */
  missingRequiredFields(form: NgForm): string {
    const missing: string[] = [];
    if (!this.loan().clientId) {
      missing.push(this.i18n.translate('COMMON.CLIENT_ID'));
    }
    // Charge rows are not controls of this form -- their names are generated per charge, so they
    // cannot be entries in `requiredFieldLabels` -- but a charge timed on a due date is refused
    // without one, so the gap belongs in the same summary rather than in a 403 after Save.
    for (const charge of this.chargesMissingDueDate()) {
      missing.push(this.i18n.translate('LOANS.CHARGE_DUE_DATE_FOR', { charge: charge.name }));
    }
    for (const [name, label] of Object.entries(this.requiredFieldLabels)) {
      if (form.controls[name]?.invalid) {
        missing.push(this.i18n.translate(label));
      }
    }
    return missing.join(', ');
  }

  onSubmit() {
    this.isSaving.set(true);

    this.loan().submittedOnDate = formatDateToFineract(this.submittedOnDate());
    this.loan().expectedDisbursementDate = formatDateToFineract(this.expectedDisbursementDate());
    if (this.repaymentsStartingFromDate) {
      this.loan().repaymentsStartingFromDate = formatDateToFineract(
        this.repaymentsStartingFromDate,
      );
    } else if (!this.isEditMode()) {
      // A rejected create may have left a previously chosen date in the request object.
      delete this.loan().repaymentsStartingFromDate;
    }
    this.loan().dateFormat = FINERACT_DATE_FORMAT;
    this.loan().locale = FINERACT_LOCALE;

    if (this.isEditMode()) {
      // The update command does not take this one, and refuses the whole update over it:
      //
      //     PUT /loans/{id}  interestRecognitionOnDisbursementDate: false
      //     400 error.msg.parameter.unsupported
      //
      // It is read back from the loan and sent straight out again, so every edit carried it and
      // every edit was refused. Measured alongside `allowFullTermForTranche`, which the same
      // command does accept, so only this field is dropped.
      delete this.loan().interestRecognitionOnDisbursementDate;
    }

    this.applyOptionalApplicationFields();

    // Read the signal once: TypeScript cannot narrow a call expression, so the
    // guard above does not carry over to a second call.
    const productDetails = this.selectedProductDetails();
    const selectedProduct = this.products().find((p) => p.id === this.loan().productId);
    // The detail request may not have resolved, or may have failed; the list row still carries
    // the schedule type, so the engine is knowable either way.
    const scheduleTypeCode =
      productDetails?.loanScheduleType?.code ?? readScheduleTypeCode(selectedProduct);

    if (productDetails?.transactionProcessingStrategyCode) {
      this.loan().transactionProcessingStrategyCode =
        productDetails.transactionProcessingStrategyCode;
    } else if (selectedProduct?.transactionProcessingStrategy) {
      this.loan().transactionProcessingStrategyCode = selectedProduct.transactionProcessingStrategy;
    } else if (!this.loan().transactionProcessingStrategyCode) {
      // Never fall back to the standard strategy for a progressive product — it is the one code
      // such a product may not carry, and Fineract rejects the pairing. Before this, a slow or
      // failed product fetch could submit a loan whose strategy contradicted its own product.
      this.loan().transactionProcessingStrategyCode = requiredStrategyFor(scheduleTypeCode);
    }

    // A strategy copied from a stale product selection can still contradict the engine.
    if (
      isProgressiveScheduleType(scheduleTypeCode) &&
      !isAdvancedPaymentAllocationStrategy(this.loan().transactionProcessingStrategyCode)
    ) {
      this.loan().transactionProcessingStrategyCode = ADVANCED_PAYMENT_ALLOCATION_STRATEGY;
    }

    if (this.isEditMode() && this.loanId) {
      this.loansService
        .putLoansLoanId(this.loanId, this.loan() as PutLoansLoanIdRequest)
        .subscribe({
          next: (response) => {
            this.isSaving.set(false);
            this.mutationOutcome.complete({
              response,
              successMessage: this.i18n.translate('LOANS.UPDATE_SUCCESS'),
              recordRoute: (id) => ['/loans/view', id],
              recordId: this.loanId ?? undefined,
              fallbackRoute: [this.LIST_PATH],
            });
          },
          error: () => this.isSaving.set(false),
        });
    } else {
      this.loansService.postLoans(this.loan()).subscribe({
        next: (response) => {
          this.isSaving.set(false);
          this.mutationOutcome.complete({
            response,
            successMessage: this.i18n.translate('LOANS.CREATE_SUCCESS'),
            recordRoute: (id) => ['/loans/view', id],
            fallbackRoute: [this.LIST_PATH],
          });
        },
        error: () => this.isSaving.set(false),
      });
    }
  }

  /**
   * Puts the optional sections into the payload, and keeps the unfilled ones out of it.
   *
   * An `ion-select` the operator never opened binds `null`, not `undefined`, and a null
   * `loanOfficerId` is not the same request as an absent one: the platform validates the
   * parameter it was sent. So each one is deleted when empty rather than sent as null, which also
   * means a cleared select on an edit clears the value rather than failing the save.
   *
   * Charges are sent as the pair the platform takes — the charge and the amount for this loan —
   * and omitted entirely when there are none, because `charges: []` on an edit is a request to
   * remove every charge and that is not what an untouched section means.
   */
  private applyOptionalApplicationFields(): void {
    const loan = this.loan();
    for (const field of ['loanOfficerId', 'loanPurposeId', 'fundId', 'linkAccountId'] as const) {
      if (loan[field] === null || loan[field] === undefined || (loan[field] as unknown) === '') {
        delete loan[field];
      }
    }
    if (!loan.linkAccountId) {
      // The flag means nothing without an account to pay from, and the platform refuses the pair.
      delete loan.createStandingInstructionAtDisbursement;
    }

    const charges = this.selectedCharges();
    if (charges.length === 0) {
      delete loan.charges;
      return;
    }
    loan.charges = charges.map((charge): PostLoansRequestChargeData => ({
      chargeId: charge.chargeId,
      amount: charge.amount ?? undefined,
      // Read against the `dateFormat`/`locale` that `onSubmit` has already set on the request.
      ...(charge.dueDate ? { dueDate: formatDateToFineract(charge.dueDate) } : {}),
    }));
  }

  onCancel() {
    this.router.navigate([this.LIST_PATH]);
  }
}
