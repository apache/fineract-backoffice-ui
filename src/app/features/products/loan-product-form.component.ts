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
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonCheckbox,
  IonTextarea,
  IonButton,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol,
} from '@ionic/angular/standalone';
import {
  LoanProductsService,
  PostLoanProductsRequest,
  PutLoanProductsProductIdRequest,
  FundData,
  FundsService,
  DelinquencyRangeAndBucketsManagementService,
  DelinquencyBucketResponse,
  EnumOptionData,
  GetLoanProductsTransactionProcessingStrategyOptions,
  GetLoanProductsInterestRecalculationCompoundingType,
  GetLoanProductsInterestRecalculationCompoundingFrequencyType,
  GetLoanProductsRescheduleStrategyType,
  GetLoanProductsPreClosureInterestCalculationStrategy,
  GetLoanProductsRepaymentStartDateType,
  StringEnumOptionData,
} from '../../api';
import { LOAN_SCHEDULE_TYPE, isAdvancedPaymentAllocationStrategy } from './loan-schedule-type';
import { PaymentCreditAllocationEditorComponent } from './payment-credit-allocation-editor.component';
import { ProductAccountingSectionComponent } from './accounting/product-accounting-section.component';
import {
  AdvancedAccountingMappingsComponent,
  ChargeOption,
  PaymentTypeOption,
} from './accounting/advanced-accounting-mappings.component';
import {
  ACCOUNTING_RULE,
  AccountingMappings,
  GlAccountOptions,
  LOAN_ACCOUNTING_FIELDS,
  mappingsForRule,
  mappingsFromResponse,
  AdvancedAccountingMappings,
  advancedMappingsForRequest,
  advancedMappingsFromResponse,
  emptyAdvancedMappings,
} from './accounting/product-accounting.model';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';

/**
 * Fineract's id for daily interest calculation.
 *
 * Interest recalculation is only supported alongside it: anything else is rejected with
 * `not.supported.for.selected.interest.calculation.type`, and the form's own default —
 * "same as repayment period" — is one of the rejected values.
 */
const DAILY_INTEREST_CALCULATION_PERIOD = 0;

@Component({
  selector: 'app-loan-product-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    ProductAccountingSectionComponent,
    AdvancedAccountingMappingsComponent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonCheckbox,
    IonTextarea,
    IonButton,
    IonSpinner,
    IonGrid,
    IonRow,
    IonCol,
    PaymentCreditAllocationEditorComponent,
    TooltipDirective,
  ],
  template: `
    <div class="form-container">
      <ion-card class="ion-no-margin">
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('PRODUCTS.EDIT_LOAN_PRODUCT' | translate)
                : ('PRODUCTS.CREATE_LOAN_PRODUCT' | translate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #productForm="ngForm" (ngSubmit)="onSubmit()" class="product-form">
            <ion-grid class="ion-no-padding">
              <ion-row>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{ 'COMMON.NAME' | translate }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'COMMON.NAME' | translate"
                      id="loan-product-name"
                      data-testid="loan-product-name"
                      name="name"
                      [(ngModel)]="product().name"
                      required
                      placeholder="{{ 'COMMON.NAME' | translate }}"
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'PRODUCTS.SHORT_NAME' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'PRODUCTS.SHORT_NAME' | translate"
                      id="loan-product-short-name"
                      data-testid="loan-product-short-name"
                      name="shortName"
                      [(ngModel)]="product().shortName"
                      required
                      maxlength="4"
                      placeholder="{{ 'PRODUCTS.SHORT_NAME' | translate }}"
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'PRODUCTS.DESCRIPTION' | translate
                    }}</ion-label>
                    <ion-textarea
                      [attr.aria-label]="'PRODUCTS.DESCRIPTION' | translate"
                      id="loan-product-description"
                      data-testid="loan-product-description"
                      name="description"
                      [(ngModel)]="product().description"
                      rows="3"
                      placeholder="{{ 'PRODUCTS.DESCRIPTION' | translate }}"
                    ></ion-textarea>
                  </ion-item>
                </ion-col>

                <ion-col size="12">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{ 'COMMON.EXTERNAL_ID' | translate }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'COMMON.EXTERNAL_ID' | translate"
                      id="loan-product-external-id"
                      data-testid="loan-product-external-id"
                      name="externalId"
                      [(ngModel)]="product().externalId"
                      placeholder="{{ 'COMMON.EXTERNAL_ID' | translate }}"
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{ 'PRODUCTS.FUND' | translate }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'PRODUCTS.FUND' | translate"
                      interface="popover"
                      id="loan-product-fund-id"
                      data-testid="loan-product-fund-id"
                      name="fundId"
                      [(ngModel)]="product().fundId"
                      placeholder="{{ 'PRODUCTS.FUND' | translate }}"
                    >
                      @for (fund of fundOptions(); track fund.id) {
                        <ion-select-option [value]="fund.id">{{ fund.name }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'PRODUCTS.DELINQUENCY_BUCKET' | translate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'PRODUCTS.DELINQUENCY_BUCKET' | translate"
                      interface="popover"
                      id="loan-product-delinquency-bucket-id"
                      data-testid="loan-product-delinquency-bucket-id"
                      name="delinquencyBucketId"
                      [(ngModel)]="product().delinquencyBucketId"
                      placeholder="{{ 'PRODUCTS.DELINQUENCY_BUCKET' | translate }}"
                    >
                      @for (bucket of delinquencyBucketOptions(); track bucket.id) {
                        <ion-select-option [value]="bucket.id">{{ bucket.name }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{ 'PRODUCTS.CURRENCY' | translate }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'PRODUCTS.CURRENCY' | translate"
                      interface="popover"
                      id="loan-product-currency-code"
                      data-testid="loan-product-currency-code"
                      name="currencyCode"
                      [(ngModel)]="product().currencyCode"
                      required
                      placeholder="{{ 'PRODUCTS.CURRENCY' | translate }}"
                    >
                      <ion-select-option value="USD">USD</ion-select-option>
                      <ion-select-option value="EUR">EUR</ion-select-option>
                      <ion-select-option value="INR">INR</ion-select-option>
                    </ion-select>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'PRODUCTS.DECIMAL_PLACES' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'PRODUCTS.DECIMAL_PLACES' | translate"
                      id="loan-product-digits-after-decimal"
                      data-testid="loan-product-digits-after-decimal"
                      type="number"
                      name="digitsAfterDecimal"
                      [(ngModel)]="product().digitsAfterDecimal"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{ 'PRODUCTS.PRINCIPAL' | translate }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'PRODUCTS.PRINCIPAL' | translate"
                      id="loan-product-principal"
                      data-testid="loan-product-principal"
                      type="number"
                      name="principal"
                      [(ngModel)]="product().principal"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'PRODUCTS.INTEREST_RATE' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'PRODUCTS.INTEREST_RATE' | translate"
                      id="loan-product-interest-rate"
                      data-testid="loan-product-interest-rate"
                      type="number"
                      name="interestRatePerPeriod"
                      [(ngModel)]="product().interestRatePerPeriod"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'LOANS.REPAYMENTS_COUNT' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'LOANS.REPAYMENTS_COUNT' | translate"
                      id="loan-product-repayments-count"
                      data-testid="loan-product-repayments-count"
                      type="number"
                      name="numberOfRepayments"
                      [(ngModel)]="product().numberOfRepayments"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'LOANS.REPAYMENT_EVERY' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'LOANS.REPAYMENT_EVERY' | translate"
                      id="loan-product-repayment-every"
                      data-testid="loan-product-repayment-every"
                      type="number"
                      name="repaymentEvery"
                      [(ngModel)]="product().repaymentEvery"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <!-- Repayment Frequency Type -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{ 'COMMON.FREQUENCY' | translate }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'COMMON.FREQUENCY' | translate"
                      interface="popover"
                      id="loan-product-repayment-frequency"
                      data-testid="loan-product-repayment-frequency"
                      name="repaymentFrequencyType"
                      [(ngModel)]="product().repaymentFrequencyType"
                      required
                    >
                      <ion-select-option [value]="0">{{
                        'COMMON.DAYS' | translate
                      }}</ion-select-option>
                      <ion-select-option [value]="1">{{
                        'COMMON.WEEKS' | translate
                      }}</ion-select-option>
                      <ion-select-option [value]="2">{{
                        'COMMON.MONTHS' | translate
                      }}</ion-select-option>
                      <ion-select-option [value]="3">{{
                        'COMMON.YEARS' | translate
                      }}</ion-select-option>
                    </ion-select>
                  </ion-item>
                </ion-col>

                <!-- Interest Rate Frequency Type -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'PRODUCTS.INTEREST_RATE_FREQUENCY_TYPE' | translate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'PRODUCTS.INTEREST_RATE_FREQUENCY_TYPE' | translate"
                      interface="popover"
                      id="loan-product-interest-frequency"
                      data-testid="loan-product-interest-frequency"
                      name="interestRateFrequencyType"
                      [(ngModel)]="product().interestRateFrequencyType"
                      required
                    >
                      <ion-select-option [value]="2">{{
                        'COMMON.PER_MONTH' | translate
                      }}</ion-select-option>
                      <ion-select-option [value]="3">{{
                        'COMMON.PER_YEAR' | translate
                      }}</ion-select-option>
                    </ion-select>
                  </ion-item>
                </ion-col>

                <!-- Amortization Type -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'PRODUCTS.AMORTIZATION_TYPE' | translate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'PRODUCTS.AMORTIZATION_TYPE' | translate"
                      interface="popover"
                      id="loan-product-amortization-type"
                      data-testid="loan-product-amortization-type"
                      name="amortizationType"
                      [(ngModel)]="product().amortizationType"
                      required
                    >
                      <ion-select-option [value]="1">{{
                        'LOANS.EQUAL_INSTALLMENTS' | translate
                      }}</ion-select-option>
                      <ion-select-option [value]="0">{{
                        'LOANS.EQUAL_PRINCIPAL' | translate
                      }}</ion-select-option>
                    </ion-select>
                  </ion-item>
                </ion-col>

                <!-- Interest Type -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'PRODUCTS.INTEREST_TYPE' | translate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'PRODUCTS.INTEREST_TYPE' | translate"
                      interface="popover"
                      id="loan-product-interest-type"
                      data-testid="loan-product-interest-type"
                      name="interestType"
                      [(ngModel)]="product().interestType"
                      required
                    >
                      <ion-select-option [value]="0">{{
                        'LOANS.DECLINING_BALANCE' | translate
                      }}</ion-select-option>
                      <ion-select-option [value]="1">{{
                        'LOANS.FLAT' | translate
                      }}</ion-select-option>
                    </ion-select>
                  </ion-item>
                </ion-col>

                <!-- Interest Calculation Period Type -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'PRODUCTS.INTEREST_CALCULATION_PERIOD_TYPE' | translate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'PRODUCTS.INTEREST_CALCULATION_PERIOD_TYPE' | translate"
                      interface="popover"
                      id="loan-product-interest-calc-period"
                      data-testid="loan-product-interest-calc-period"
                      name="interestCalculationPeriodType"
                      [(ngModel)]="product().interestCalculationPeriodType"
                      [disabled]="interestRecalculationEnabled()"
                      required
                    >
                      <ion-select-option [value]="0">{{
                        'LOANS.DAILY' | translate
                      }}</ion-select-option>
                      <ion-select-option [value]="1">{{
                        'LOANS.SAME_AS_REPAYMENT' | translate
                      }}</ion-select-option>
                    </ion-select>
                  </ion-item>
                  @if (interestRecalculationEnabled()) {
                    <p class="field-note" data-testid="interest-calc-period-locked-note">
                      {{ 'PRODUCTS.INTEREST_CALC_PERIOD_LOCKED_NOTE' | translate }}
                    </p>
                  }
                </ion-col>

                <!-- Loan Schedule Type -->
                <ion-col size="12" size-md="6">
                  <ion-item
                    fill="outline"
                    class="form-item"
                    [appTooltip]="'HELP.LOAN_SCHEDULE_TYPE_DESC' | translate"
                  >
                    <ion-label position="stacked">{{
                      'PRODUCTS.LOAN_SCHEDULE_TYPE' | translate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'PRODUCTS.LOAN_SCHEDULE_TYPE' | translate"
                      interface="popover"
                      id="loan-product-schedule-type"
                      data-testid="loan-product-schedule-type"
                      name="loanScheduleType"
                      [(ngModel)]="product().loanScheduleType"
                      (ngModelChange)="onLoanScheduleTypeChange($event)"
                      required
                    >
                      @for (option of loanScheduleTypeOptions(); track option.code) {
                        <ion-select-option [value]="option.code">{{
                          option.value
                        }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>

                <!-- Transaction Processing Strategy Code -->
                <ion-col size="12" size-md="6">
                  <ion-item
                    fill="outline"
                    class="form-item"
                    [appTooltip]="'HELP.TRANSACTION_PROCESSING_STRATEGY_DESC' | translate"
                  >
                    <ion-label position="stacked">{{
                      'PRODUCTS.TRANSACTION_PROCESSING_STRATEGY' | translate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'PRODUCTS.TRANSACTION_PROCESSING_STRATEGY' | translate"
                      interface="popover"
                      id="loan-product-transaction-strategy"
                      data-testid="loan-product-transaction-strategy"
                      name="transactionProcessingStrategyCode"
                      [(ngModel)]="product().transactionProcessingStrategyCode"
                      [disabled]="isProgressive()"
                      required
                    >
                      @for (option of transactionProcessingStrategyOptions(); track option.code) {
                        <ion-select-option [value]="option.code">{{
                          option.name
                        }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                  @if (isProgressive()) {
                    <p class="field-note" data-testid="strategy-locked-note">
                      {{ 'PRODUCTS.STRATEGY_LOCKED_NOTE' | translate }}
                    </p>
                  }
                </ion-col>

                <!-- Loan Schedule Processing Type (Progressive only) -->
                @if (isProgressive()) {
                  <ion-col size="12" size-md="6">
                    <ion-item
                      fill="outline"
                      class="form-item"
                      [appTooltip]="'HELP.LOAN_SCHEDULE_PROCESSING_TYPE_DESC' | translate"
                    >
                      <ion-label position="stacked">{{
                        'PRODUCTS.LOAN_SCHEDULE_PROCESSING_TYPE' | translate
                      }}</ion-label>
                      <ion-select
                        [attr.aria-label]="'PRODUCTS.LOAN_SCHEDULE_PROCESSING_TYPE' | translate"
                        interface="popover"
                        id="loan-product-schedule-processing-type"
                        data-testid="loan-product-schedule-processing-type"
                        name="loanScheduleProcessingType"
                        [(ngModel)]="product().loanScheduleProcessingType"
                        required
                      >
                        @for (option of loanScheduleProcessingTypeOptions(); track option.code) {
                          <ion-select-option [value]="option.code">{{
                            option.value
                          }}</ion-select-option>
                        }
                      </ion-select>
                    </ion-item>
                  </ion-col>
                }
              </ion-row>
            </ion-grid>

            <!-- Disbursement and down payment -->
            <ion-grid class="ion-no-padding">
              <ion-row>
                <ion-col size="12">
                  <h3 class="section-heading">
                    {{ 'PRODUCTS.DISBURSEMENT_SETTINGS' | translate }}
                  </h3>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item
                    class="form-item"
                    [appTooltip]="'HELP.MULTI_DISBURSE_LOAN_DESC' | translate"
                  >
                    <ion-checkbox
                      name="multiDisburseLoan"
                      data-testid="loan-product-multi-disburse"
                      [ngModel]="multiDisburseEnabled()"
                      (ngModelChange)="onMultiDisburseChange($event)"
                    >
                      {{ 'PRODUCTS.MULTI_DISBURSE_LOAN' | translate }}
                    </ion-checkbox>
                  </ion-item>
                </ion-col>

                @if (multiDisburseEnabled()) {
                  <ion-col size="12" size-md="6">
                    <ion-item
                      fill="outline"
                      class="form-item"
                      [appTooltip]="'HELP.MAX_TRANCHE_COUNT_DESC' | translate"
                    >
                      <ion-label position="stacked">{{
                        'PRODUCTS.MAX_TRANCHE_COUNT' | translate
                      }}</ion-label>
                      <ion-input
                        [attr.aria-label]="'PRODUCTS.MAX_TRANCHE_COUNT' | translate"
                        type="number"
                        min="1"
                        data-testid="loan-product-max-tranche-count"
                        name="maxTrancheCount"
                        [(ngModel)]="product().maxTrancheCount"
                        required
                      ></ion-input>
                    </ion-item>
                  </ion-col>

                  <ion-col size="12" size-md="6">
                    <ion-item
                      class="form-item"
                      [appTooltip]="'HELP.DISALLOW_EXPECTED_DISBURSEMENTS_DESC' | translate"
                    >
                      <ion-checkbox
                        name="disallowExpectedDisbursements"
                        data-testid="loan-product-disallow-expected-disbursements"
                        [(ngModel)]="product().disallowExpectedDisbursements"
                      >
                        {{ 'PRODUCTS.DISALLOW_EXPECTED_DISBURSEMENTS' | translate }}
                      </ion-checkbox>
                    </ion-item>
                  </ion-col>
                }

                <!-- Down payment is a progressive-engine capability. -->
                @if (isProgressive()) {
                  <ion-col size="12" size-md="6">
                    <ion-item
                      class="form-item"
                      [appTooltip]="'HELP.ENABLE_DOWN_PAYMENT_DESC' | translate"
                    >
                      <ion-checkbox
                        name="enableDownPayment"
                        data-testid="loan-product-enable-down-payment"
                        [ngModel]="downPaymentEnabled()"
                        (ngModelChange)="onEnableDownPaymentChange($event)"
                      >
                        {{ 'PRODUCTS.ENABLE_DOWN_PAYMENT' | translate }}
                      </ion-checkbox>
                    </ion-item>
                  </ion-col>

                  @if (downPaymentEnabled()) {
                    <ion-col size="12" size-md="6">
                      <ion-item
                        fill="outline"
                        class="form-item"
                        [appTooltip]="'HELP.DOWN_PAYMENT_PERCENTAGE_DESC' | translate"
                      >
                        <ion-label position="stacked">{{
                          'PRODUCTS.DOWN_PAYMENT_PERCENTAGE' | translate
                        }}</ion-label>
                        <ion-input
                          [attr.aria-label]="'PRODUCTS.DOWN_PAYMENT_PERCENTAGE' | translate"
                          type="number"
                          min="0"
                          max="100"
                          data-testid="loan-product-down-payment-percentage"
                          name="disbursedAmountPercentageForDownPayment"
                          [(ngModel)]="product().disbursedAmountPercentageForDownPayment"
                          required
                        ></ion-input>
                      </ion-item>
                    </ion-col>

                    <ion-col size="12" size-md="6">
                      <ion-item
                        class="form-item"
                        [appTooltip]="'HELP.AUTO_REPAYMENT_FOR_DOWN_PAYMENT_DESC' | translate"
                      >
                        <ion-checkbox
                          name="enableAutoRepaymentForDownPayment"
                          data-testid="loan-product-auto-repayment-down-payment"
                          [(ngModel)]="product().enableAutoRepaymentForDownPayment"
                        >
                          {{ 'PRODUCTS.ENABLE_AUTO_REPAYMENT_FOR_DOWN_PAYMENT' | translate }}
                        </ion-checkbox>
                      </ion-item>
                    </ion-col>
                  }
                } @else {
                  <ion-col size="12">
                    <p class="field-note" data-testid="down-payment-unavailable-note">
                      {{ 'PRODUCTS.DOWN_PAYMENT_PROGRESSIVE_ONLY_NOTE' | translate }}
                    </p>
                  </ion-col>
                }
              </ion-row>
            </ion-grid>

            <!-- Income recognition. Both groups belong to the progressive engine. -->
            @if (isProgressive()) {
              <ion-grid class="ion-no-padding">
                <ion-row>
                  <ion-col size="12">
                    <h3 class="section-heading">
                      {{ 'PRODUCTS.INCOME_RECOGNITION' | translate }}
                    </h3>
                  </ion-col>

                  <ion-col size="12" size-md="6">
                    <ion-item
                      class="form-item"
                      [appTooltip]="'HELP.ENABLE_INCOME_CAPITALIZATION_DESC' | translate"
                    >
                      <ion-checkbox
                        name="enableIncomeCapitalization"
                        data-testid="loan-product-enable-income-capitalization"
                        [ngModel]="incomeCapitalizationEnabled()"
                        (ngModelChange)="onEnableIncomeCapitalizationChange($event)"
                      >
                        {{ 'PRODUCTS.ENABLE_INCOME_CAPITALIZATION' | translate }}
                      </ion-checkbox>
                    </ion-item>
                  </ion-col>

                  @if (incomeCapitalizationEnabled()) {
                    <ion-col size="12" size-md="6">
                      <ion-item
                        fill="outline"
                        class="form-item"
                        [appTooltip]="'HELP.CAPITALIZED_INCOME_TYPE_DESC' | translate"
                      >
                        <ion-label position="stacked">{{
                          'PRODUCTS.CAPITALIZED_INCOME_TYPE' | translate
                        }}</ion-label>
                        <ion-select
                          [attr.aria-label]="'PRODUCTS.CAPITALIZED_INCOME_TYPE' | translate"
                          interface="popover"
                          data-testid="loan-product-capitalized-income-type"
                          name="capitalizedIncomeType"
                          [(ngModel)]="product().capitalizedIncomeType"
                          required
                        >
                          @for (option of capitalizedIncomeTypeOptions(); track option.code) {
                            <ion-select-option [value]="option.code">{{
                              option.value
                            }}</ion-select-option>
                          }
                        </ion-select>
                      </ion-item>
                    </ion-col>

                    <ion-col size="12" size-md="6">
                      <ion-item
                        fill="outline"
                        class="form-item"
                        [appTooltip]="'HELP.INCOME_CALCULATION_TYPE_DESC' | translate"
                      >
                        <ion-label position="stacked">{{
                          'PRODUCTS.INCOME_CALCULATION_TYPE' | translate
                        }}</ion-label>
                        <ion-select
                          [attr.aria-label]="'PRODUCTS.INCOME_CALCULATION_TYPE' | translate"
                          interface="popover"
                          data-testid="loan-product-capitalized-income-calculation"
                          name="capitalizedIncomeCalculationType"
                          [(ngModel)]="product().capitalizedIncomeCalculationType"
                          required
                        >
                          @for (
                            option of capitalizedIncomeCalculationTypeOptions();
                            track option.code
                          ) {
                            <ion-select-option [value]="option.code">{{
                              option.value
                            }}</ion-select-option>
                          }
                        </ion-select>
                      </ion-item>
                    </ion-col>

                    <ion-col size="12" size-md="6">
                      <ion-item
                        fill="outline"
                        class="form-item"
                        [appTooltip]="'HELP.INCOME_STRATEGY_DESC' | translate"
                      >
                        <ion-label position="stacked">{{
                          'PRODUCTS.INCOME_STRATEGY' | translate
                        }}</ion-label>
                        <ion-select
                          [attr.aria-label]="'PRODUCTS.INCOME_STRATEGY' | translate"
                          interface="popover"
                          data-testid="loan-product-capitalized-income-strategy"
                          name="capitalizedIncomeStrategy"
                          [(ngModel)]="product().capitalizedIncomeStrategy"
                          required
                        >
                          @for (option of capitalizedIncomeStrategyOptions(); track option.code) {
                            <ion-select-option [value]="option.code">{{
                              option.value
                            }}</ion-select-option>
                          }
                        </ion-select>
                      </ion-item>
                    </ion-col>
                  }

                  <ion-col size="12" size-md="6">
                    <ion-item
                      class="form-item"
                      [appTooltip]="'HELP.ENABLE_BUY_DOWN_FEE_DESC' | translate"
                    >
                      <ion-checkbox
                        name="enableBuyDownFee"
                        data-testid="loan-product-enable-buy-down-fee"
                        [ngModel]="buyDownFeeEnabled()"
                        (ngModelChange)="onEnableBuyDownFeeChange($event)"
                      >
                        {{ 'PRODUCTS.ENABLE_BUY_DOWN_FEE' | translate }}
                      </ion-checkbox>
                    </ion-item>
                  </ion-col>

                  @if (buyDownFeeEnabled()) {
                    <ion-col size="12" size-md="6">
                      <ion-item
                        fill="outline"
                        class="form-item"
                        [appTooltip]="'HELP.BUY_DOWN_FEE_INCOME_TYPE_DESC' | translate"
                      >
                        <ion-label position="stacked">{{
                          'PRODUCTS.BUY_DOWN_FEE_INCOME_TYPE' | translate
                        }}</ion-label>
                        <ion-select
                          [attr.aria-label]="'PRODUCTS.BUY_DOWN_FEE_INCOME_TYPE' | translate"
                          interface="popover"
                          data-testid="loan-product-buy-down-fee-income-type"
                          name="buyDownFeeIncomeType"
                          [(ngModel)]="product().buyDownFeeIncomeType"
                          required
                        >
                          @for (option of buyDownFeeIncomeTypeOptions(); track option.code) {
                            <ion-select-option [value]="option.code">{{
                              option.value
                            }}</ion-select-option>
                          }
                        </ion-select>
                      </ion-item>
                    </ion-col>

                    <ion-col size="12" size-md="6">
                      <ion-item
                        fill="outline"
                        class="form-item"
                        [appTooltip]="'HELP.INCOME_CALCULATION_TYPE_DESC' | translate"
                      >
                        <ion-label position="stacked">{{
                          'PRODUCTS.INCOME_CALCULATION_TYPE' | translate
                        }}</ion-label>
                        <ion-select
                          [attr.aria-label]="'PRODUCTS.INCOME_CALCULATION_TYPE' | translate"
                          interface="popover"
                          data-testid="loan-product-buy-down-fee-calculation"
                          name="buyDownFeeCalculationType"
                          [(ngModel)]="product().buyDownFeeCalculationType"
                          required
                        >
                          @for (option of buyDownFeeCalculationTypeOptions(); track option.code) {
                            <ion-select-option [value]="option.code">{{
                              option.value
                            }}</ion-select-option>
                          }
                        </ion-select>
                      </ion-item>
                    </ion-col>

                    <ion-col size="12" size-md="6">
                      <ion-item
                        fill="outline"
                        class="form-item"
                        [appTooltip]="'HELP.INCOME_STRATEGY_DESC' | translate"
                      >
                        <ion-label position="stacked">{{
                          'PRODUCTS.INCOME_STRATEGY' | translate
                        }}</ion-label>
                        <ion-select
                          [attr.aria-label]="'PRODUCTS.INCOME_STRATEGY' | translate"
                          interface="popover"
                          data-testid="loan-product-buy-down-fee-strategy"
                          name="buyDownFeeStrategy"
                          [(ngModel)]="product().buyDownFeeStrategy"
                          required
                        >
                          @for (option of buyDownFeeStrategyOptions(); track option.code) {
                            <ion-select-option [value]="option.code">{{
                              option.value
                            }}</ion-select-option>
                          }
                        </ion-select>
                      </ion-item>
                    </ion-col>
                  }
                </ion-row>
              </ion-grid>
            }

            <!-- Interest recalculation and remaining product settings -->
            <ion-grid class="ion-no-padding">
              <ion-row>
                <ion-col size="12">
                  <h3 class="section-heading">
                    {{ 'PRODUCTS.INTEREST_RECALCULATION' | translate }}
                  </h3>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item
                    class="form-item"
                    [appTooltip]="'HELP.INTEREST_RECALCULATION_DESC' | translate"
                  >
                    <ion-checkbox
                      name="isInterestRecalculationEnabled"
                      data-testid="loan-product-interest-recalculation"
                      [ngModel]="interestRecalculationEnabled()"
                      (ngModelChange)="onInterestRecalculationChange($event)"
                    >
                      {{ 'PRODUCTS.ENABLE_INTEREST_RECALCULATION' | translate }}
                    </ion-checkbox>
                  </ion-item>
                </ion-col>

                @if (interestRecalculationEnabled()) {
                  <ion-col size="12" size-md="6">
                    <ion-item
                      fill="outline"
                      class="form-item"
                      [appTooltip]="'HELP.COMPOUNDING_METHOD_DESC' | translate"
                    >
                      <ion-label position="stacked">{{
                        'PRODUCTS.COMPOUNDING_METHOD' | translate
                      }}</ion-label>
                      <ion-select
                        [attr.aria-label]="'PRODUCTS.COMPOUNDING_METHOD' | translate"
                        interface="popover"
                        data-testid="loan-product-compounding-method"
                        name="interestRecalculationCompoundingMethod"
                        [ngModel]="compoundingMethod()"
                        (ngModelChange)="onCompoundingMethodChange($event)"
                        required
                      >
                        @for (option of compoundingTypeOptions(); track option.id) {
                          <ion-select-option [value]="option.id">{{
                            option.description
                          }}</ion-select-option>
                        }
                      </ion-select>
                    </ion-item>
                  </ion-col>

                  <ion-col size="12" size-md="6">
                    <ion-item
                      fill="outline"
                      class="form-item"
                      [appTooltip]="'HELP.RESCHEDULE_STRATEGY_DESC' | translate"
                    >
                      <ion-label position="stacked">{{
                        'PRODUCTS.RESCHEDULE_STRATEGY' | translate
                      }}</ion-label>
                      <ion-select
                        [attr.aria-label]="'PRODUCTS.RESCHEDULE_STRATEGY' | translate"
                        interface="popover"
                        data-testid="loan-product-reschedule-strategy"
                        name="rescheduleStrategyMethod"
                        [(ngModel)]="product().rescheduleStrategyMethod"
                        required
                      >
                        @for (option of rescheduleStrategyOptions(); track option.id) {
                          <ion-select-option [value]="option.id">{{
                            option.description
                          }}</ion-select-option>
                        }
                      </ion-select>
                    </ion-item>
                  </ion-col>

                  <ion-col size="12" size-md="6">
                    <ion-item
                      fill="outline"
                      class="form-item"
                      [appTooltip]="'HELP.REST_FREQUENCY_DESC' | translate"
                    >
                      <ion-label position="stacked">{{
                        'PRODUCTS.REST_FREQUENCY' | translate
                      }}</ion-label>
                      <ion-select
                        [attr.aria-label]="'PRODUCTS.REST_FREQUENCY' | translate"
                        interface="popover"
                        data-testid="loan-product-rest-frequency"
                        name="recalculationRestFrequencyType"
                        [ngModel]="restFrequencyType()"
                        (ngModelChange)="onRestFrequencyTypeChange($event)"
                        required
                      >
                        @for (option of recalculationFrequencyOptions(); track option.id) {
                          <ion-select-option [value]="option.id">{{
                            option.description
                          }}</ion-select-option>
                        }
                      </ion-select>
                    </ion-item>
                  </ion-col>

                  @if (restIntervalApplies()) {
                    <ion-col size="12" size-md="6">
                      <ion-item
                        fill="outline"
                        class="form-item"
                        [appTooltip]="'HELP.REST_INTERVAL_DESC' | translate"
                      >
                        <ion-label position="stacked">{{
                          'PRODUCTS.REST_INTERVAL' | translate
                        }}</ion-label>
                        <ion-input
                          [attr.aria-label]="'PRODUCTS.REST_INTERVAL' | translate"
                          type="number"
                          min="1"
                          data-testid="loan-product-rest-interval"
                          name="recalculationRestFrequencyInterval"
                          [(ngModel)]="product().recalculationRestFrequencyInterval"
                        ></ion-input>
                      </ion-item>
                    </ion-col>
                  }

                  @if (compoundingSelected()) {
                    <ion-col size="12" size-md="6">
                      <ion-item
                        fill="outline"
                        class="form-item"
                        [appTooltip]="'HELP.COMPOUNDING_FREQUENCY_DESC' | translate"
                      >
                        <ion-label position="stacked">{{
                          'PRODUCTS.COMPOUNDING_FREQUENCY' | translate
                        }}</ion-label>
                        <ion-select
                          [attr.aria-label]="'PRODUCTS.COMPOUNDING_FREQUENCY' | translate"
                          interface="popover"
                          data-testid="loan-product-compounding-frequency"
                          name="recalculationCompoundingFrequencyType"
                          [ngModel]="compoundingFrequencyType()"
                          (ngModelChange)="onCompoundingFrequencyTypeChange($event)"
                        >
                          @for (option of recalculationFrequencyOptions(); track option.id) {
                            <ion-select-option [value]="option.id">{{
                              option.description
                            }}</ion-select-option>
                          }
                        </ion-select>
                      </ion-item>
                    </ion-col>
                  }

                  @if (compoundingIntervalApplies()) {
                    <ion-col size="12" size-md="6">
                      <ion-item
                        fill="outline"
                        class="form-item"
                        [appTooltip]="'HELP.COMPOUNDING_INTERVAL_DESC' | translate"
                      >
                        <ion-label position="stacked">{{
                          'PRODUCTS.COMPOUNDING_INTERVAL' | translate
                        }}</ion-label>
                        <ion-input
                          [attr.aria-label]="'PRODUCTS.COMPOUNDING_INTERVAL' | translate"
                          type="number"
                          min="1"
                          data-testid="loan-product-compounding-interval"
                          name="recalculationCompoundingFrequencyInterval"
                          [(ngModel)]="product().recalculationCompoundingFrequencyInterval"
                        ></ion-input>
                      </ion-item>
                    </ion-col>
                  }

                  <ion-col size="12" size-md="6">
                    <ion-item
                      fill="outline"
                      class="form-item"
                      [appTooltip]="'HELP.PRE_CLOSURE_STRATEGY_DESC' | translate"
                    >
                      <ion-label position="stacked">{{
                        'PRODUCTS.PRE_CLOSURE_STRATEGY' | translate
                      }}</ion-label>
                      <ion-select
                        [attr.aria-label]="'PRODUCTS.PRE_CLOSURE_STRATEGY' | translate"
                        interface="popover"
                        data-testid="loan-product-pre-closure-strategy"
                        name="preClosureInterestCalculationStrategy"
                        [(ngModel)]="product().preClosureInterestCalculationStrategy"
                      >
                        @for (option of preClosureStrategyOptions(); track option.id) {
                          <ion-select-option [value]="option.id">{{
                            option.description
                          }}</ion-select-option>
                        }
                      </ion-select>
                    </ion-item>
                  </ion-col>
                }

                <ion-col size="12">
                  <h3 class="section-heading">
                    {{ 'PRODUCTS.OTHER_SETTINGS' | translate }}
                  </h3>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item
                    fill="outline"
                    class="form-item"
                    [appTooltip]="'HELP.CHARGE_OFF_BEHAVIOUR_DESC' | translate"
                  >
                    <ion-label position="stacked">{{
                      'PRODUCTS.CHARGE_OFF_BEHAVIOUR' | translate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'PRODUCTS.CHARGE_OFF_BEHAVIOUR' | translate"
                      interface="popover"
                      data-testid="loan-product-charge-off-behaviour"
                      name="chargeOffBehaviour"
                      [(ngModel)]="product().chargeOffBehaviour"
                    >
                      <!--
                        The id, not the code. The template offers both — id "REGULAR", code
                        "chargeOffBehaviour.regular" — and the platform accepts only the former.
                        Sending the code answers validation.msg.enum.value.not.found.
                      -->
                      @for (option of chargeOffBehaviourOptions(); track option.id) {
                        <ion-select-option [value]="option.id">{{
                          option.value
                        }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item
                    fill="outline"
                    class="form-item"
                    [appTooltip]="'HELP.REPAYMENT_START_DATE_TYPE_DESC' | translate"
                  >
                    <ion-label position="stacked">{{
                      'PRODUCTS.REPAYMENT_START_DATE_TYPE' | translate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'PRODUCTS.REPAYMENT_START_DATE_TYPE' | translate"
                      interface="popover"
                      data-testid="loan-product-repayment-start-date-type"
                      name="repaymentStartDateType"
                      [(ngModel)]="product().repaymentStartDateType"
                    >
                      @for (option of repaymentStartDateTypeOptions(); track option.id) {
                        <ion-select-option [value]="option.id">{{
                          option.description
                        }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item
                    fill="outline"
                    class="form-item"
                    [appTooltip]="'HELP.FIXED_LENGTH_DESC' | translate"
                  >
                    <ion-label position="stacked">{{
                      'PRODUCTS.FIXED_LENGTH' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'PRODUCTS.FIXED_LENGTH' | translate"
                      type="number"
                      min="1"
                      data-testid="loan-product-fixed-length"
                      name="fixedLength"
                      [(ngModel)]="product().fixedLength"
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item
                    class="form-item"
                    [appTooltip]="'HELP.ACCRUAL_ACTIVITY_POSTING_DESC' | translate"
                  >
                    <ion-checkbox
                      name="enableAccrualActivityPosting"
                      data-testid="loan-product-accrual-activity-posting"
                      [(ngModel)]="product().enableAccrualActivityPosting"
                    >
                      {{ 'PRODUCTS.ENABLE_ACCRUAL_ACTIVITY_POSTING' | translate }}
                    </ion-checkbox>
                  </ion-item>
                </ion-col>
              </ion-row>
            </ion-grid>

            @if (isProgressive()) {
              <app-payment-credit-allocation-editor
                [transactionTypeOptions]="advancedPaymentAllocationTransactionTypes()"
                [allocationRuleOptions]="advancedPaymentAllocationTypes()"
                [futureInstallmentOptions]="
                  advancedPaymentAllocationFutureInstallmentAllocationRules()
                "
                [creditTransactionTypeOptions]="creditAllocationTransactionTypes()"
                [creditAllocationRuleOptions]="creditAllocationAllocationTypes()"
                [paymentAllocation]="product().paymentAllocation ?? []"
                (paymentAllocationChange)="product().paymentAllocation = $event"
                [creditAllocation]="product().creditAllocation ?? []"
                (creditAllocationChange)="product().creditAllocation = $event"
              ></app-payment-credit-allocation-editor>
            }

            <app-product-accounting-section
              [fields]="accountingFields"
              [accountOptions]="accountingMappingOptions()"
              [ruleOptions]="accountingRuleOptions()"
              [accountingRule]="product().accountingRule ?? 1"
              (accountingRuleChange)="product().accountingRule = $event"
              [mappings]="accountingMappings()"
              (mappingsChange)="accountingMappings.set($event)"
            ></app-product-accounting-section>

            <app-advanced-accounting-mappings
              [accountingRule]="product().accountingRule"
              [accountOptions]="accountingMappingOptions()"
              [paymentTypeOptions]="paymentTypeOptions()"
              [charges]="productCharges()"
              [mappings]="advancedMappings()"
              (mappingsChange)="advancedMappings.set($event)"
            ></app-advanced-accounting-mappings>

            <div class="form-actions">
              <ion-button
                id="loan-product-cancel-btn"
                data-testid="loan-product-cancel-btn"
                fill="clear"
                color="medium"
                type="button"
                (click)="onCancel()"
                [disabled]="isSaving()"
              >
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button
                id="loan-product-submit-btn"
                data-testid="loan-product-submit-btn"
                color="primary"
                type="submit"
                [disabled]="productForm.invalid || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent" slot="start"></ion-spinner>
                  {{ 'COMMON.SAVING' | translate }}
                } @else {
                  {{ 'COMMON.SAVE' | translate }}
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
        max-width: 900px;
        margin: 0 auto;
      }
      .product-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-item {
        --background: var(--ion-color-light, #f8f9fa);
        --border-radius: 8px;
        margin-bottom: 12px;
      }
      .section-heading {
        margin: 8px 0 4px;
        font-size: 15px;
        font-weight: 600;
        color: var(--text-color, #1f2937);
      }
      .field-note {
        margin: -6px 0 12px;
        padding: 0 4px;
        font-size: 12px;
        line-height: 1.4;
        color: var(--text-muted, #6b7280);
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 16px;
      }
    `,
  ],
})
export class LoanProductFormComponent implements OnInit {
  private readonly productService = inject(LoanProductsService);
  private readonly fundsService = inject(FundsService);
  private readonly delinquencyService = inject(DelinquencyRangeAndBucketsManagementService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/products/loan';

  productId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly fundOptions = signal<FundData[]>([]);
  readonly delinquencyBucketOptions = signal<DelinquencyBucketResponse[]>([]);

  readonly loanScheduleTypeOptions = signal<EnumOptionData[]>([]);
  readonly loanScheduleProcessingTypeOptions = signal<EnumOptionData[]>([]);
  readonly advancedPaymentAllocationTypes = signal<EnumOptionData[]>([]);
  readonly advancedPaymentAllocationTransactionTypes = signal<EnumOptionData[]>([]);
  readonly advancedPaymentAllocationFutureInstallmentAllocationRules = signal<EnumOptionData[]>([]);
  readonly creditAllocationTransactionTypes = signal<EnumOptionData[]>([]);
  readonly creditAllocationAllocationTypes = signal<EnumOptionData[]>([]);
  transactionProcessingStrategyOptionsBase: GetLoanProductsTransactionProcessingStrategyOptions[] =
    [];
  readonly transactionProcessingStrategyOptions = signal<
    GetLoanProductsTransactionProcessingStrategyOptions[]
  >([]);
  readonly isProgressive = signal(false);
  // Mirrors of two payload flags. `product` is a signal holding an object, so assigning to one of
  // its properties changes nothing the template is watching — the same reason `isProgressive` is
  // its own signal rather than being read off the product.
  readonly downPaymentEnabled = signal(false);
  readonly multiDisburseEnabled = signal(false);
  readonly incomeCapitalizationEnabled = signal(false);
  readonly buyDownFeeEnabled = signal(false);

  // Income-recognition options. These come from the product template — an earlier revision held
  // them as local constants on the belief that the template did not return them, which was wrong.
  readonly capitalizedIncomeTypeOptions = signal<StringEnumOptionData[]>([]);
  readonly capitalizedIncomeCalculationTypeOptions = signal<StringEnumOptionData[]>([]);
  readonly capitalizedIncomeStrategyOptions = signal<StringEnumOptionData[]>([]);
  readonly buyDownFeeIncomeTypeOptions = signal<StringEnumOptionData[]>([]);
  readonly buyDownFeeCalculationTypeOptions = signal<StringEnumOptionData[]>([]);
  readonly buyDownFeeStrategyOptions = signal<StringEnumOptionData[]>([]);

  // Interest recalculation and the remaining product settings.
  readonly interestRecalculationEnabled = signal(false);
  // The three fields the conditional rules key off. Mirrored as signals because `product` holds an
  // object: assigning to one of its properties invalidates nothing, so a `computed` reading
  // `product().x` would never re-run and the dependent controls would never appear.
  readonly compoundingMethod = signal<number | undefined>(undefined);
  readonly restFrequencyType = signal<number | undefined>(undefined);
  readonly compoundingFrequencyType = signal<number | undefined>(undefined);
  readonly compoundingTypeOptions = signal<GetLoanProductsInterestRecalculationCompoundingType[]>(
    [],
  );
  readonly recalculationFrequencyOptions = signal<
    GetLoanProductsInterestRecalculationCompoundingFrequencyType[]
  >([]);
  readonly rescheduleStrategyOptions = signal<GetLoanProductsRescheduleStrategyType[]>([]);
  readonly preClosureStrategyOptions = signal<
    GetLoanProductsPreClosureInterestCalculationStrategy[]
  >([]);
  readonly repaymentStartDateTypeOptions = signal<GetLoanProductsRepaymentStartDateType[]>([]);
  readonly chargeOffBehaviourOptions = signal<StringEnumOptionData[]>([]);

  /**
   * Accounting.
   *
   * The selected accounts are held here rather than on `product()`, and merged into the body at
   * submit. Keeping them out of the request object is what makes a rule change safe: the slots a
   * rule does not have must not be sent, and a model that carried them would send whatever the
   * user picked under a rule they have since moved away from. See `mappingsForRule`.
   */
  readonly accountingFields = LOAN_ACCOUNTING_FIELDS;
  readonly accountingMappingOptions = signal<GlAccountOptions>({});
  readonly accountingRuleOptions = signal<{ id?: number; value?: string }[]>([]);
  readonly accountingMappings = signal<AccountingMappings>({});

  /**
   * The advanced overrides: payment channel to fund source, fee and penalty to income.
   *
   * Held separately from `accountingMappings` because they are arrays the user edits in place
   * rather than a flat set of ids, and because a rule of `NONE` must drop them the same way.
   */
  readonly advancedMappings = signal<AdvancedAccountingMappings>(emptyAdvancedMappings());
  readonly paymentTypeOptions = signal<PaymentTypeOption[]>([]);

  /**
   * The charges this product carries, which is what the fee and penalty tables may map.
   *
   * Read from the loaded product rather than from the template's catalogue. The platform accepts
   * a mapping for a charge the product does not carry and then never fires it, so offering the
   * tenant's whole charge list would invite exactly that. This form has no charge picker of its
   * own, so on create the tables correctly report that there is nothing to map yet.
   */
  readonly productCharges = signal<ChargeOption[]>([]);

  readonly product = signal<PostLoanProductsRequest>({
    currencyCode: 'USD',
    digitsAfterDecimal: 2,
    inMultiplesOf: 0,
    repaymentFrequencyType: 2, // Months
    interestRateFrequencyType: 3, // Per Year
    amortizationType: 1, // Equal Installments
    interestType: 0, // Declining Balance
    interestCalculationPeriodType: 1, // Daily
    loanScheduleType: LOAN_SCHEDULE_TYPE.CUMULATIVE,
    transactionProcessingStrategyCode: 'mifos-standard-strategy',
    accountingRule: 1, // NONE
    daysInYearType: 1,
    daysInMonthType: 1,
    isInterestRecalculationEnabled: false,
  });

  ngOnInit() {
    this.fundsService.getFunds().subscribe((data) => this.fundOptions.set(data));
    this.delinquencyService
      .getDelinquencyBuckets()
      .subscribe((data) => this.delinquencyBucketOptions.set(data));

    this.productService.getLoanproductsTemplate().subscribe((template) => {
      this.loanScheduleTypeOptions.set(template.loanScheduleTypeOptions ?? []);
      this.loanScheduleProcessingTypeOptions.set(template.loanScheduleProcessingTypeOptions ?? []);
      this.advancedPaymentAllocationTypes.set(template.advancedPaymentAllocationTypes ?? []);
      this.advancedPaymentAllocationTransactionTypes.set(
        template.advancedPaymentAllocationTransactionTypes ?? [],
      );
      this.advancedPaymentAllocationFutureInstallmentAllocationRules.set(
        template.advancedPaymentAllocationFutureInstallmentAllocationRules ?? [],
      );
      this.creditAllocationTransactionTypes.set(template.creditAllocationTransactionTypes ?? []);
      this.creditAllocationAllocationTypes.set(template.creditAllocationAllocationTypes ?? []);
      this.transactionProcessingStrategyOptionsBase = template.transactionProcessingStrategyOptions
        ? Array.from(template.transactionProcessingStrategyOptions)
        : [];
      this.capitalizedIncomeTypeOptions.set(template.capitalizedIncomeTypeOptions ?? []);
      this.capitalizedIncomeCalculationTypeOptions.set(
        template.capitalizedIncomeCalculationTypeOptions ?? [],
      );
      this.capitalizedIncomeStrategyOptions.set(template.capitalizedIncomeStrategyOptions ?? []);
      this.buyDownFeeIncomeTypeOptions.set(template.buyDownFeeIncomeTypeOptions ?? []);
      this.buyDownFeeCalculationTypeOptions.set(template.buyDownFeeCalculationTypeOptions ?? []);
      this.buyDownFeeStrategyOptions.set(template.buyDownFeeStrategyOptions ?? []);

      this.compoundingTypeOptions.set(
        Array.from(template.interestRecalculationCompoundingTypeOptions ?? []),
      );
      this.recalculationFrequencyOptions.set(
        Array.from(template.interestRecalculationFrequencyTypeOptions ?? []),
      );
      this.rescheduleStrategyOptions.set(Array.from(template.rescheduleStrategyTypeOptions ?? []));
      this.preClosureStrategyOptions.set(
        Array.from(template.preClosureInterestCalculationStrategyOptions ?? []),
      );
      this.repaymentStartDateTypeOptions.set(
        Array.from(template.repaymentStartDateTypeOptions ?? []),
      );
      this.chargeOffBehaviourOptions.set(template.chargeOffBehaviourOptions ?? []);
      this.accountingMappingOptions.set(template.accountingMappingOptions ?? {});
      this.accountingRuleOptions.set(Array.from(template.accountingRuleOptions ?? []));
      this.paymentTypeOptions.set(Array.from(template.paymentTypeOptions ?? []));

      this.applyTransactionProcessingStrategyFilter();
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.productId = +id;
        this.isEditMode.set(true);
        this.loadProductData();
      }
    });
  }

  onLoanScheduleTypeChange(loanScheduleType: string) {
    this.isProgressive.set(loanScheduleType === LOAN_SCHEDULE_TYPE.PROGRESSIVE);
    this.applyTransactionProcessingStrategyFilter();

    if (this.isProgressive()) {
      this.product().loanScheduleProcessingType = 'HORIZONTAL';
      this.product().paymentAllocation = this.buildDefaultPaymentAllocation();
    } else {
      this.product().loanScheduleProcessingType = undefined;
      this.product().paymentAllocation = undefined;
      this.product().creditAllocation = undefined;
      // These are progressive capabilities. Hiding the controls is not enough — the values would
      // still be in the payload, describing a product the cumulative engine cannot honour.
      this.clearDownPayment();
      this.clearIncomeCapitalization();
      this.clearBuyDownFee();
    }
  }

  /** Turning multi-disbursement off leaves no meaning in the settings that depend on it. */
  onMultiDisburseChange(enabled: boolean): void {
    this.multiDisburseEnabled.set(enabled);
    this.product().multiDisburseLoan = enabled;
    if (!enabled) {
      this.product().maxTrancheCount = undefined;
      this.product().disallowExpectedDisbursements = undefined;
      // Only ever reachable through multi-disbursement, so it cannot outlive it.
      this.product().allowFullTermForTranche = undefined;
    }
  }

  onEnableDownPaymentChange(enabled: boolean): void {
    if (enabled) {
      this.downPaymentEnabled.set(true);
      this.product().enableDownPayment = true;
      return;
    }
    this.clearDownPayment();
  }

  /**
   * Whether a compounding method other than "none" is selected.
   *
   * Matched on the option's code rather than its id, because the ids are Fineract's own and would
   * be a magic number here; the code carries the meaning.
   */
  readonly compoundingSelected = computed(() => {
    const method = this.compoundingMethod();
    if (method === undefined || method === null) return false;
    const option = this.compoundingTypeOptions().find((o) => o.id === method);
    return !this.isNoneOption(option?.code);
  });

  /** The rest interval only matters when the rest frequency differs from the repayment period. */
  readonly restIntervalApplies = computed(() =>
    this.isIntervalBearing(
      this.recalculationFrequencyOptions().find((o) => o.id === this.restFrequencyType())?.code,
    ),
  );

  readonly compoundingIntervalApplies = computed(
    () =>
      this.compoundingSelected() &&
      this.isIntervalBearing(
        this.recalculationFrequencyOptions().find((o) => o.id === this.compoundingFrequencyType())
          ?.code,
      ),
  );

  private isNoneOption(code: string | undefined): boolean {
    return (code ?? '').toLowerCase().includes('none');
  }

  /** "Same as repayment period" needs no interval; every other frequency does. */
  private isIntervalBearing(code: string | undefined): boolean {
    if (!code) return false;
    return !code.toLowerCase().includes('same');
  }

  /**
   * Interest recalculation, and the fields the API documents as depending on it.
   *
   * `POST /loanproducts` states the chain: the compounding method, reschedule strategy and rest
   * frequency are mandatory once this is on, and the two intervals apply only when their
   * frequency is something other than the repayment period. The form follows that rather than
   * showing every field at once.
   */
  onInterestRecalculationChange(enabled: boolean): void {
    if (!enabled) {
      this.clearInterestRecalculation();
      return;
    }
    this.interestRecalculationEnabled.set(true);
    const product = this.product();
    product.isInterestRecalculationEnabled = true;
    product.interestRecalculationCompoundingMethod ??= this.compoundingTypeOptions()[0]?.id;
    product.rescheduleStrategyMethod ??= this.rescheduleStrategyOptions()[0]?.id;
    product.recalculationRestFrequencyType ??= this.recalculationFrequencyOptions()[0]?.id;
    // Fineract only supports recalculation with daily interest calculation, and rejects the
    // form's own default outright. Setting it here means the user cannot build a product the
    // server will refuse; the control is locked and says why.
    product.interestCalculationPeriodType = DAILY_INTEREST_CALCULATION_PERIOD;
    this.compoundingMethod.set(product.interestRecalculationCompoundingMethod);
    this.restFrequencyType.set(product.recalculationRestFrequencyType);
    this.compoundingFrequencyType.set(product.recalculationCompoundingFrequencyType);
  }

  private clearInterestRecalculation(): void {
    this.interestRecalculationEnabled.set(false);
    const product = this.product();
    // Left in the payload, these would describe recalculation settings for a product that does
    // not recalculate.
    product.isInterestRecalculationEnabled = false;
    product.interestRecalculationCompoundingMethod = undefined;
    product.rescheduleStrategyMethod = undefined;
    product.recalculationRestFrequencyType = undefined;
    product.recalculationRestFrequencyInterval = undefined;
    product.recalculationCompoundingFrequencyType = undefined;
    product.recalculationCompoundingFrequencyInterval = undefined;
    product.preClosureInterestCalculationStrategy = undefined;
    this.compoundingMethod.set(undefined);
    this.restFrequencyType.set(undefined);
    this.compoundingFrequencyType.set(undefined);
  }

  /** Dropping the compounding method takes the settings that only exist because of it. */
  onCompoundingMethodChange(method: number | undefined): void {
    this.product().interestRecalculationCompoundingMethod = method;
    this.compoundingMethod.set(method);
    if (!this.compoundingSelected()) {
      this.product().recalculationCompoundingFrequencyType = undefined;
      this.product().recalculationCompoundingFrequencyInterval = undefined;
      this.compoundingFrequencyType.set(undefined);
    }
  }

  onRestFrequencyTypeChange(type: number | undefined): void {
    this.product().recalculationRestFrequencyType = type;
    this.restFrequencyType.set(type);
    if (!this.restIntervalApplies()) {
      this.product().recalculationRestFrequencyInterval = undefined;
    }
  }

  onCompoundingFrequencyTypeChange(type: number | undefined): void {
    this.product().recalculationCompoundingFrequencyType = type;
    this.compoundingFrequencyType.set(type);
    if (!this.compoundingIntervalApplies()) {
      this.product().recalculationCompoundingFrequencyInterval = undefined;
    }
  }

  onEnableIncomeCapitalizationChange(enabled: boolean): void {
    if (!enabled) {
      this.clearIncomeCapitalization();
      return;
    }
    this.incomeCapitalizationEnabled.set(true);
    const product = this.product();
    product.enableIncomeCapitalization = true;
    // Seeded explicitly so the product records what it was created with, rather than relying on
    // whatever the server would default to.
    product.capitalizedIncomeType ??= 'FEE';
    product.capitalizedIncomeCalculationType ??= 'FLAT';
    product.capitalizedIncomeStrategy ??= 'EQUAL_AMORTIZATION';
  }

  onEnableBuyDownFeeChange(enabled: boolean): void {
    if (!enabled) {
      this.clearBuyDownFee();
      return;
    }
    this.buyDownFeeEnabled.set(true);
    const product = this.product();
    product.enableBuyDownFee = true;
    product.buyDownFeeIncomeType ??= 'FEE';
    product.buyDownFeeCalculationType ??= 'FLAT';
    product.buyDownFeeStrategy ??= 'EQUAL_AMORTIZATION';
  }

  private clearIncomeCapitalization(): void {
    this.incomeCapitalizationEnabled.set(false);
    const product = this.product();
    product.enableIncomeCapitalization = undefined;
    product.capitalizedIncomeType = undefined;
    product.capitalizedIncomeCalculationType = undefined;
    product.capitalizedIncomeStrategy = undefined;
  }

  private clearBuyDownFee(): void {
    this.buyDownFeeEnabled.set(false);
    const product = this.product();
    product.enableBuyDownFee = undefined;
    product.buyDownFeeIncomeType = undefined;
    product.buyDownFeeCalculationType = undefined;
    product.buyDownFeeStrategy = undefined;
  }

  private clearDownPayment(): void {
    this.downPaymentEnabled.set(false);
    this.product().enableDownPayment = undefined;
    this.product().disbursedAmountPercentageForDownPayment = undefined;
    this.product().enableAutoRepaymentForDownPayment = undefined;
  }

  private applyTransactionProcessingStrategyFilter() {
    if (this.isProgressive()) {
      this.transactionProcessingStrategyOptions.set(
        this.transactionProcessingStrategyOptionsBase.filter((option) =>
          isAdvancedPaymentAllocationStrategy(option.code),
        ),
      );
      if (this.transactionProcessingStrategyOptions().length) {
        this.product().transactionProcessingStrategyCode =
          this.transactionProcessingStrategyOptions()[0].code;
      }
    } else {
      this.transactionProcessingStrategyOptions.set(
        this.transactionProcessingStrategyOptionsBase.filter(
          (option) => !isAdvancedPaymentAllocationStrategy(option.code),
        ),
      );
      if (
        isAdvancedPaymentAllocationStrategy(this.product().transactionProcessingStrategyCode) &&
        this.transactionProcessingStrategyOptions().length
      ) {
        this.product().transactionProcessingStrategyCode =
          this.transactionProcessingStrategyOptions()[0].code;
      }
    }
  }

  private buildDefaultPaymentAllocation() {
    return [
      {
        transactionType: 'DEFAULT',
        futureInstallmentAllocationRule: 'NEXT_INSTALLMENT',
        paymentAllocationOrder: this.advancedPaymentAllocationTypes().map((type, index) => ({
          order: index + 1,
          paymentAllocationRule: type.code,
        })),
      },
    ];
  }

  loadProductData() {
    if (!this.productId) return;
    this.productService.getLoanproductsProductId(this.productId).subscribe((data) => {
      this.product.set({
        name: data.name,
        shortName: data.shortName,
        description: data.description,
        currencyCode: data.currency?.code,
        digitsAfterDecimal: data.currency?.decimalPlaces,
        principal: data.principal,
        interestRatePerPeriod: data.interestRatePerPeriod,
        numberOfRepayments: data.numberOfRepayments,
        repaymentEvery: data.repaymentEvery,
        inMultiplesOf: 0,
        repaymentFrequencyType: data.repaymentFrequencyType?.id ?? 2,
        interestRateFrequencyType: data.interestRateFrequencyType?.id ?? 3,
        amortizationType: data.amortizationType?.id ?? 1,
        interestType: data.interestType?.id ?? 0,
        interestCalculationPeriodType: data.interestCalculationPeriodType?.id ?? 1,
        transactionProcessingStrategyCode:
          data.transactionProcessingStrategyCode ?? 'mifos-standard-strategy',
        accountingRule: data.accountingRule?.id ?? 1,
        daysInYearType: data.daysInYearType?.id ?? 1,
        daysInMonthType: data.daysInMonthType?.id ?? 1,
        isInterestRecalculationEnabled: data.isInterestRecalculationEnabled ?? false,
        loanScheduleType: data.loanScheduleType?.code ?? LOAN_SCHEDULE_TYPE.CUMULATIVE,
        loanScheduleProcessingType: data.loanScheduleProcessingType?.code,
        paymentAllocation: data.paymentAllocation,
        creditAllocation: data.creditAllocation,
        // Carried through explicitly: this payload is rebuilt field by field, so anything the
        // form does not name is dropped on save. Before these lines, opening a product configured
        // with tranches or a down payment and pressing Save silently removed both.
        multiDisburseLoan: data.multiDisburseLoan,
        maxTrancheCount: data.maxTrancheCount,
        disallowExpectedDisbursements: data.disallowExpectedDisbursements,
        allowFullTermForTranche: data.allowFullTermForTranche,
        enableDownPayment: data.enableDownPayment,
        disbursedAmountPercentageForDownPayment: data.disbursedAmountPercentageForDownPayment,
        enableAutoRepaymentForDownPayment: data.enableAutoRepaymentForDownPayment,
        enableIncomeCapitalization: data.enableIncomeCapitalization,
        capitalizedIncomeType: data.capitalizedIncomeType?.code as never,
        capitalizedIncomeCalculationType: data.capitalizedIncomeCalculationType?.code as never,
        capitalizedIncomeStrategy: data.capitalizedIncomeStrategy?.code as never,
        enableBuyDownFee: data.enableBuyDownFee,
        buyDownFeeIncomeType: data.buyDownFeeIncomeType?.code as never,
        buyDownFeeCalculationType: data.buyDownFeeCalculationType?.code as never,
        buyDownFeeStrategy: data.buyDownFeeStrategy?.code as never,
        interestRecalculationCompoundingMethod:
          data.interestRecalculationData?.interestRecalculationCompoundingType?.id,
        rescheduleStrategyMethod: data.interestRecalculationData?.rescheduleStrategyType?.id,
        recalculationRestFrequencyType:
          data.interestRecalculationData?.recalculationRestFrequencyType?.id,
        recalculationRestFrequencyInterval:
          data.interestRecalculationData?.recalculationRestFrequencyInterval,
        recalculationCompoundingFrequencyType:
          data.interestRecalculationData?.interestRecalculationCompoundingFrequencyType?.id,
        recalculationCompoundingFrequencyInterval:
          data.interestRecalculationData?.recalculationCompoundingFrequencyInterval,
        preClosureInterestCalculationStrategy:
          data.interestRecalculationData?.preClosureInterestCalculationStrategy?.id,
        chargeOffBehaviour: data.chargeOffBehaviour?.id,
        enableAccrualActivityPosting: data.enableAccrualActivityPosting,
        fixedLength: data.fixedLength,
        repaymentStartDateType: data.repaymentStartDateType?.id,
      });
      // Without this, opening a configured product shows empty account pickers, and the first
      // save under a *changed* rule would submit the product with nothing mapped.
      this.accountingMappings.set(
        mappingsFromResponse(this.accountingFields, data.accountingMappings),
      );
      this.advancedMappings.set(advancedMappingsFromResponse(data));
      this.productCharges.set((data.charges ?? []) as ChargeOption[]);
      this.isProgressive.set(this.product().loanScheduleType === LOAN_SCHEDULE_TYPE.PROGRESSIVE);
      this.downPaymentEnabled.set(this.product().enableDownPayment === true);
      this.multiDisburseEnabled.set(this.product().multiDisburseLoan === true);
      this.incomeCapitalizationEnabled.set(this.product().enableIncomeCapitalization === true);
      this.buyDownFeeEnabled.set(this.product().enableBuyDownFee === true);
      this.interestRecalculationEnabled.set(this.product().isInterestRecalculationEnabled === true);
      this.compoundingMethod.set(this.product().interestRecalculationCompoundingMethod);
      this.restFrequencyType.set(this.product().recalculationRestFrequencyType);
      this.compoundingFrequencyType.set(this.product().recalculationCompoundingFrequencyType);
      this.applyTransactionProcessingStrategyFilter();
    });
  }

  /**
   * The request body: the form's own fields plus exactly the account slots the chosen rule has.
   *
   * Under `NONE` that adds nothing at all — the platform rejects a mapping key it has no slot
   * for, including one whose value is null.
   */
  private buildRequest(): PostLoanProductsRequest {
    const request: PostLoanProductsRequest = {
      ...this.product(),
      ...mappingsForRule(
        this.accountingFields,
        this.product().accountingRule ?? ACCOUNTING_RULE.NONE,
        this.accountingMappings(),
      ),
      ...advancedMappingsForRequest(this.product().accountingRule, this.advancedMappings()),
    };

    // `enableAutoRepaymentForDownPayment` is only a valid parameter while down payment is on.
    // Sending `false` alongside `enableDownPayment: false` is refused —
    // `validation.msg.loanproduct.enableAutoRepaymentForDownPayment.supported.only.for.enable.down.payment.true`
    // — and a product loaded for editing carries exactly that pair, because Fineract returns the
    // flag as `false` rather than omitting it. Create tolerates the combination; update does not,
    // so every loan product without down payment was unsaveable from the edit screen.
    if (request.enableDownPayment !== true) {
      delete request.enableAutoRepaymentForDownPayment;
    }

    return request;
  }

  onSubmit() {
    this.isSaving.set(true);
    this.product().locale = 'en';
    const request = this.buildRequest();

    if (this.isEditMode() && this.productId) {
      this.productService
        .putLoanproductsProductId(this.productId, request as PutLoanProductsProductIdRequest)
        .subscribe({
          next: () => this.router.navigate([this.LIST_PATH]),
          error: () => this.isSaving.set(false),
        });
    } else {
      this.productService.postLoanproducts(request).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel() {
    this.router.navigate([this.LIST_PATH]);
  }
}
