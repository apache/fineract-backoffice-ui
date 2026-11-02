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
  IonCol,
  IonDatetime,
  IonDatetimeButton,
  IonGrid,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';
import {
  WorkingCapitalLoanProductsService,
  PostWorkingCapitalLoanProductsRequest,
  StringEnumOptionData,
  CodeValueData,
  CurrencyData,
  WorkingCapitalBreachData,
  WorkingCapitalNearBreachData,
  GetDelinquencyBucket,
  FundData,
  AdvancedPaymentData,
  EnumOptionData,
  PaymentTypeData,
  PostPaymentAllocation,
} from '../../../api';
import { ProductAccountingSectionComponent } from '../../products/accounting/product-accounting-section.component';
import {
  AdvancedAccountingMappingsComponent,
  ChargeOption,
} from '../../products/accounting/advanced-accounting-mappings.component';
import {
  AccountingMappings,
  AccountingRuleKey,
  AdvancedAccountingMappings,
  GlAccountOptions,
  ReasonAccountingMappings,
  WC_ACCOUNTING_RULE,
  WC_ACCOUNTING_RULES_WITH_MAPPINGS,
  WC_LOAN_ACCOUNTING_FIELDS,
  advancedMappingsForRequest,
  advancedMappingsFromResponse,
  emptyAdvancedMappings,
  emptyReasonMappings,
  mappingsForRule,
  mappingsFromResponse,
  reasonMappingsForRequest,
  reasonMappingsFromResponse,
} from '../../products/accounting/product-accounting.model';
import { PaymentCreditAllocationEditorComponent } from '../../products/payment-credit-allocation-editor.component';
import { EntityDatatablesComponent } from '../../../shared/components/entity-datatables/entity-datatables.component';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatArrayDate,
  formatDateToFineract,
  toIsoDate,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';
import { DateFieldComponent } from '../../../ui/date-field/date-field.component';

/**
 * Create / edit form for a working-capital loan product. Covers the core mandatory
 * and common fields; currency / amortization / repayment-frequency options come from
 * the product template endpoint. Mirrors the working-capital breach form.
 */
@Component({
  selector: 'app-wc-loan-product-form',
  standalone: true,
  imports: [
    DateFieldComponent,
    FormsModule,
    TranslatePipe,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonButton,
    IonSpinner,
    IonGrid,
    IonRow,
    IonCol,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    ProductAccountingSectionComponent,
    AdvancedAccountingMappingsComponent,
    PaymentCreditAllocationEditorComponent,
    EntityDatatablesComponent,
  ],
  template: `
    <div class="form-container">
      <ion-card class="ion-no-margin">
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('WC_LOAN_PRODUCTS.EDIT' | appTranslate)
                : ('WC_LOAN_PRODUCTS.CREATE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #productForm="ngForm" (ngSubmit)="onSubmit()" class="wc-form">
            <ion-grid class="ion-no-padding">
              <ion-row>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.NAME' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.NAME' | appTranslate"
                      id="wc-product-name"
                      data-testid="wc-product-name"
                      name="name"
                      [ngModel]="product().name"
                      (ngModelChange)="patchProduct('name', $event)"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.SHORT_NAME' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.SHORT_NAME' | appTranslate"
                      id="wc-product-short-name"
                      data-testid="wc-product-short-name"
                      name="shortName"
                      [ngModel]="product().shortName"
                      (ngModelChange)="patchProduct('shortName', $event)"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.DESCRIPTION' | appTranslate
                    }}</ion-label>
                    <ion-textarea
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.DESCRIPTION' | appTranslate"
                      id="wc-product-description"
                      data-testid="wc-product-description"
                      name="description"
                      [ngModel]="product().description"
                      (ngModelChange)="patchProduct('description', $event)"
                    ></ion-textarea>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.CURRENCY' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.CURRENCY' | appTranslate"
                      interface="popover"
                      id="wc-product-currency-code"
                      data-testid="wc-product-currency-code"
                      name="currencyCode"
                      [ngModel]="product().currencyCode"
                      (ngModelChange)="patchProduct('currencyCode', $event)"
                      required
                    >
                      @for (opt of currencyOptions(); track opt.code) {
                        <ion-select-option [value]="opt.code"
                          >{{ opt.name }} ({{ opt.code }})</ion-select-option
                        >
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.DIGITS_AFTER_DECIMAL' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.DIGITS_AFTER_DECIMAL' | appTranslate"
                      id="wc-product-digits-after-decimal"
                      data-testid="wc-product-digits-after-decimal"
                      type="number"
                      name="digitsAfterDecimal"
                      [ngModel]="product().digitsAfterDecimal"
                      (ngModelChange)="patchProduct('digitsAfterDecimal', $event)"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.IN_MULTIPLES_OF' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.IN_MULTIPLES_OF' | appTranslate"
                      id="wc-product-in-multiples-of"
                      data-testid="wc-product-in-multiples-of"
                      type="number"
                      name="inMultiplesOf"
                      [ngModel]="product().inMultiplesOf"
                      (ngModelChange)="patchProduct('inMultiplesOf', $event)"
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.PRINCIPAL' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.PRINCIPAL' | appTranslate"
                      id="wc-product-principal"
                      data-testid="wc-product-principal"
                      type="number"
                      name="principal"
                      [ngModel]="product().principal"
                      (ngModelChange)="patchProduct('principal', $event)"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.PERIOD_PAYMENT_RATE' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.PERIOD_PAYMENT_RATE' | appTranslate"
                      id="wc-product-period-payment-rate"
                      data-testid="wc-product-period-payment-rate"
                      type="number"
                      name="periodPaymentRate"
                      [ngModel]="product().periodPaymentRate"
                      (ngModelChange)="patchProduct('periodPaymentRate', $event)"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.REPAYMENT_EVERY' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.REPAYMENT_EVERY' | appTranslate"
                      id="wc-product-repayment-every"
                      data-testid="wc-product-repayment-every"
                      type="number"
                      name="repaymentEvery"
                      [ngModel]="product().repaymentEvery"
                      (ngModelChange)="patchProduct('repaymentEvery', $event)"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.REPAYMENT_FREQUENCY' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.REPAYMENT_FREQUENCY' | appTranslate"
                      interface="popover"
                      id="wc-product-repayment-frequency"
                      data-testid="wc-product-repayment-frequency"
                      name="repaymentFrequencyType"
                      [ngModel]="product().repaymentFrequencyType"
                      (ngModelChange)="patchProduct('repaymentFrequencyType', $event)"
                      required
                    >
                      @for (opt of repaymentFrequencyTypeOptions(); track opt.id) {
                        <ion-select-option [value]="opt.code">{{ opt.value }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.AMORTIZATION_TYPE' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.AMORTIZATION_TYPE' | appTranslate"
                      interface="popover"
                      id="wc-product-amortization-type"
                      data-testid="wc-product-amortization-type"
                      name="amortizationType"
                      [ngModel]="product().amortizationType"
                      (ngModelChange)="patchProduct('amortizationType', $event)"
                      required
                    >
                      @for (opt of amortizationTypeOptions(); track opt.id) {
                        <ion-select-option [value]="opt.code">{{ opt.value }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.NPV_DAY_COUNT' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.NPV_DAY_COUNT' | appTranslate"
                      id="wc-product-npv-day-count"
                      data-testid="wc-product-npv-day-count"
                      type="number"
                      name="npvDayCount"
                      [ngModel]="product().npvDayCount"
                      (ngModelChange)="patchProduct('npvDayCount', $event)"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.MIN_PRINCIPAL' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.MIN_PRINCIPAL' | appTranslate"
                      id="wc-product-min-principal"
                      data-testid="wc-product-min-principal"
                      type="number"
                      name="minPrincipal"
                      [ngModel]="product().minPrincipal"
                      (ngModelChange)="patchProduct('minPrincipal', $event)"
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.MAX_PRINCIPAL' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.MAX_PRINCIPAL' | appTranslate"
                      id="wc-product-max-principal"
                      data-testid="wc-product-max-principal"
                      type="number"
                      name="maxPrincipal"
                      [ngModel]="product().maxPrincipal"
                      (ngModelChange)="patchProduct('maxPrincipal', $event)"
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.MIN_PERIOD_PAYMENT_RATE' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.MIN_PERIOD_PAYMENT_RATE' | appTranslate"
                      id="wc-product-min-period-payment-rate"
                      data-testid="wc-product-min-period-payment-rate"
                      type="number"
                      name="minPeriodPaymentRate"
                      [ngModel]="product().minPeriodPaymentRate"
                      (ngModelChange)="patchProduct('minPeriodPaymentRate', $event)"
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.MAX_PERIOD_PAYMENT_RATE' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.MAX_PERIOD_PAYMENT_RATE' | appTranslate"
                      id="wc-product-max-period-payment-rate"
                      data-testid="wc-product-max-period-payment-rate"
                      type="number"
                      name="maxPeriodPaymentRate"
                      [ngModel]="product().maxPeriodPaymentRate"
                      (ngModelChange)="patchProduct('maxPeriodPaymentRate', $event)"
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.BREACH' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.BREACH' | appTranslate"
                      interface="popover"
                      id="wc-product-breach-id"
                      data-testid="wc-product-breach-id"
                      name="breachId"
                      [ngModel]="product().breachId"
                      (ngModelChange)="patchProduct('breachId', $event)"
                    >
                      @for (opt of breachOptions(); track opt.id) {
                        <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.NEAR_BREACH' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.NEAR_BREACH' | appTranslate"
                      interface="popover"
                      id="wc-product-near-breach-id"
                      data-testid="wc-product-near-breach-id"
                      name="nearBreachId"
                      [ngModel]="product().nearBreachId"
                      (ngModelChange)="patchProduct('nearBreachId', $event)"
                    >
                      @for (opt of nearBreachOptions(); track opt.id) {
                        <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.DELINQUENCY_BUCKET' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.DELINQUENCY_BUCKET' | appTranslate"
                      interface="popover"
                      id="wc-product-delinquency-bucket-id"
                      data-testid="wc-product-delinquency-bucket-id"
                      name="delinquencyBucketId"
                      [ngModel]="product().delinquencyBucketId"
                      (ngModelChange)="patchProduct('delinquencyBucketId', $event)"
                    >
                      @for (opt of delinquencyBucketOptions(); track opt.id) {
                        <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.FUND' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.FUND' | appTranslate"
                      interface="popover"
                      id="wc-product-fund-id"
                      data-testid="wc-product-fund-id"
                      name="fundId"
                      [ngModel]="product().fundId"
                      (ngModelChange)="patchProduct('fundId', $event)"
                    >
                      @for (opt of fundOptions(); track opt.id) {
                        <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <app-date-field
                    class="form-item"
                    label="WC_LOAN_PRODUCTS.START_DATE"
                    pickerId="wc-product-start-date"
                    [clearable]="true"
                    name="startDate"
                    [(ngModel)]="startDate"
                  ></app-date-field>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <app-date-field
                    class="form-item"
                    label="WC_LOAN_PRODUCTS.CLOSE_DATE"
                    pickerId="wc-product-close-date"
                    [clearable]="true"
                    name="closeDate"
                    [ngModel]="closeDate()"
                    (ngModelChange)="closeDate.set($event)"
                  ></app-date-field>
                </ion-col>

                <ion-col size="12">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.EXTERNAL_ID' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.EXTERNAL_ID' | appTranslate"
                      id="wc-product-external-id"
                      data-testid="wc-product-external-id"
                      name="externalId"
                      [ngModel]="product().externalId"
                      (ngModelChange)="patchProduct('externalId', $event)"
                    ></ion-input>
                  </ion-item>
                </ion-col>
              </ion-row>
            </ion-grid>

            <!--
              Payment allocation, then accounting. The order follows the request: how a repayment
              is split comes before where the split is posted.
            -->
            <app-payment-credit-allocation-editor
              [transactionTypeOptions]="paymentAllocationTransactionTypes()"
              [allocationRuleOptions]="paymentAllocationTypes()"
              [showFutureInstallmentRule]="false"
              [showCreditAllocation]="false"
              [paymentAllocation]="paymentAllocation()"
              (paymentAllocationChange)="onPaymentAllocationChange($event)"
            ></app-payment-credit-allocation-editor>

            <app-product-accounting-section
              [fields]="accountingFields"
              [accountOptions]="accountingMappingOptions()"
              [ruleOptions]="accountingRuleOptions()"
              [noneRule]="NONE_RULE"
              [accountingRule]="product().accountingRule ?? NONE_RULE"
              (accountingRuleChange)="onAccountingRuleChange($event)"
              [mappings]="accountingMappings()"
              (mappingsChange)="accountingMappings.set($event)"
            ></app-product-accounting-section>

            <app-advanced-accounting-mappings
              [accountingRule]="product().accountingRule"
              [rulesWithMappings]="POSTING_RULES"
              [accountOptions]="accountingMappingOptions()"
              [paymentTypeOptions]="paymentTypeOptions()"
              [charges]="chargeOptions()"
              [chargeOffReasonOptions]="chargeOffReasonOptions()"
              [writeOffReasonOptions]="writeOffReasonOptions()"
              [mappings]="advancedMappings()"
              (mappingsChange)="advancedMappings.set($event)"
              [reasonMappings]="reasonMappings()"
              (reasonMappingsChange)="reasonMappings.set($event)"
            ></app-advanced-accounting-mappings>

            @if (isEditMode() && productId) {
              <!--
                Product-level custom fields, on edit only: a datatable row is keyed by the
                product, so there is nothing to attach them to until it exists. EntityTables
                declares WC_LOAN_PRODUCT, so m_wc_loan_product takes datatables exactly as
                m_product_loan does (issue #776).
              -->
              <h3 class="section-title">{{ 'SYSTEM.CUSTOM_FIELDS' | appTranslate }}</h3>
              <app-entity-datatables apptableName="m_wc_loan_product" [entityId]="productId" />
            }

            <div class="form-actions">
              <ion-button
                id="wc-product-cancel-btn"
                data-testid="wc-product-cancel-btn"
                fill="clear"
                color="medium"
                type="button"
                (click)="onCancel()"
                [disabled]="isSaving()"
              >
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                id="wc-product-submit-btn"
                data-testid="wc-product-submit-btn"
                color="primary"
                type="submit"
                [disabled]="productForm.invalid || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent" slot="start"></ion-spinner>
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
      .wc-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-item {
        --border-radius: 8px;
        margin-bottom: 12px;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 16px;
      }
      .section-title {
        margin: 24px 0 0;
        font-size: 16px;
        font-weight: 600;
      }
    `,
  ],
})
export class WcLoanProductFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly productService = inject(WorkingCapitalLoanProductsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/working-capital/loan-products';

  productId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly product = signal<Partial<PostWorkingCapitalLoanProductsRequest>>({});

  /**
   * Replace the signal payload for one form control.
   *
   * A two-way `ngModel` binding into `product()` would mutate the object held by the signal
   * without changing its reference, so consumers would not be notified. The template binds one
   * way and routes every edit through this method.
   */
  protected patchProduct<K extends keyof PostWorkingCapitalLoanProductsRequest>(
    field: K,
    value: PostWorkingCapitalLoanProductsRequest[K],
  ): void {
    this.product.update((product) => ({ ...product, [field]: value }));
  }

  startDate: string | null = null;
  readonly closeDate = signal<string | null>(null);

  /**
   * Accounting.
   *
   * The field list, the rule options and the account options are all passed to
   * `app-product-accounting-section`, which is shared with the five other product families; what
   * is specific to this one is the field list and the fact that its rule is a **named string**
   * rather than a numeric id.
   */
  readonly accountingFields = WC_LOAN_ACCOUNTING_FIELDS;
  readonly NONE_RULE: AccountingRuleKey = WC_ACCOUNTING_RULE.NONE;
  readonly POSTING_RULES = WC_ACCOUNTING_RULES_WITH_MAPPINGS;
  readonly accountingMappingOptions = signal<GlAccountOptions>({});
  readonly accountingMappings = signal<AccountingMappings>({});
  /** Held apart from the base slots because these are arrays the user edits in place. */
  readonly advancedMappings = signal<AdvancedAccountingMappings>(emptyAdvancedMappings());
  readonly reasonMappings = signal<ReasonAccountingMappings>(emptyReasonMappings());
  readonly chargeOffReasonOptions = signal<CodeValueData[]>([]);
  readonly writeOffReasonOptions = signal<CodeValueData[]>([]);
  readonly paymentTypeOptions = signal<PaymentTypeData[]>([]);
  /**
   * Charges the fee and penalty tables may map, from the **tenant catalogue**.
   *
   * The loan product form passes the charges attached to the product instead, which is the
   * narrower and better source — mapping a charge the product does not carry can never fire. A
   * Working Capital product carries none: its request has no `charges` field at all, and charges
   * are attached per loan. The catalogue is therefore the only honest option list here, and the
   * component still splits it by the `penalty` flag so neither table offers the other's charges.
   */
  readonly chargeOptions = signal<ChargeOption[]>([]);

  /** Payment allocation. The product has one list and no credit allocation. */
  readonly paymentAllocationTypes = signal<StringEnumOptionData[]>([]);
  readonly paymentAllocationTransactionTypes = signal<EnumOptionData[]>([]);

  readonly currencyOptions = signal<CurrencyData[]>([]);
  readonly amortizationTypeOptions = signal<StringEnumOptionData[]>([]);
  readonly repaymentFrequencyTypeOptions = signal<StringEnumOptionData[]>([]);
  readonly accountingRuleOptions = signal<StringEnumOptionData[]>([]);
  readonly breachOptions = signal<WorkingCapitalBreachData[]>([]);
  readonly nearBreachOptions = signal<WorkingCapitalNearBreachData[]>([]);
  readonly delinquencyBucketOptions = signal<GetDelinquencyBucket[]>([]);
  readonly fundOptions = signal<FundData[]>([]);

  ngOnInit(): void {
    this.productService.getWorkingCapitalLoanProductsTemplate().subscribe((tpl) => {
      this.currencyOptions.set(tpl.currencyOptions ?? []);
      this.amortizationTypeOptions.set(tpl.amortizationTypeOptions ?? []);
      this.repaymentFrequencyTypeOptions.set(tpl.periodFrequencyTypeOptions ?? []);
      this.accountingRuleOptions.set(tpl.accountingRuleOptions ?? []);
      this.breachOptions.set(tpl.breachOptions ?? []);
      this.nearBreachOptions.set(tpl.nearBreachOptions ?? []);
      this.delinquencyBucketOptions.set(tpl.delinquencyBucketOptions ?? []);
      this.fundOptions.set(tpl.fundOptions ?? []);
      // `accountingMappingOptions` is typed as a loose map because the generator cannot express
      // "one list per account class"; the four lists inside it are the shape every product
      // template uses, and the platform omits a class the tenant has no accounts of entirely.
      this.accountingMappingOptions.set((tpl.accountingMappingOptions ?? {}) as GlAccountOptions);
      this.chargeOffReasonOptions.set(tpl.chargeOffReasonOptions ?? []);
      this.writeOffReasonOptions.set(tpl.writeOffReasonOptions ?? []);
      this.paymentTypeOptions.set(tpl.paymentTypeOptions ?? []);
      this.chargeOptions.set([...(tpl.chargeOptions ?? []), ...(tpl.penaltyOptions ?? [])]);
      this.paymentAllocationTypes.set(tpl.advancedPaymentAllocationTypes ?? []);
      this.paymentAllocationTransactionTypes.set(
        tpl.advancedPaymentAllocationTransactionTypes ?? [],
      );
      // A product the platform accepts allocates every one of the six rules, so a new product
      // starts with the default list rather than an empty editor. On edit the product's own
      // allocation replaces it.
      if (!this.isEditMode() && !this.product().paymentAllocation) {
        this.patchProduct('paymentAllocation', this.defaultPaymentAllocation());
      }
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.productId = +id;
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  load(): void {
    if (!this.productId) return;
    this.productService.getWorkingCapitalLoanProductsProductId(this.productId).subscribe((data) => {
      this.product.set({
        name: data.name,
        shortName: data.shortName,
        description: data.description,
        currencyCode: data.currency?.code,
        digitsAfterDecimal: data.currency?.decimalPlaces,
        inMultiplesOf: data.currency?.inMultiplesOf,
        principal: data.principal,
        minPrincipal: data.minPrincipal,
        maxPrincipal: data.maxPrincipal,
        periodPaymentRate: data.periodPaymentRate,
        minPeriodPaymentRate: data.minPeriodPaymentRate,
        maxPeriodPaymentRate: data.maxPeriodPaymentRate,
        repaymentEvery: data.repaymentEvery,
        repaymentFrequencyType: data.repaymentFrequencyType
          ?.code as PostWorkingCapitalLoanProductsRequest.RepaymentFrequencyTypeEnum,
        amortizationType: data.amortizationType
          ?.code as PostWorkingCapitalLoanProductsRequest.AmortizationTypeEnum,
        npvDayCount: data.npvDayCount,
        accountingRule: data.accountingRule
          ?.id as PostWorkingCapitalLoanProductsRequest.AccountingRuleEnum,
        breachId: data.breach?.id,
        nearBreachId: data.nearBreach?.id,
        delinquencyBucketId: data.delinquencyBucket?.id,
        fundId: data.fundId,
        externalId: data.externalId,
      });
      // Without these three, opening a configured product shows empty pickers and the next save
      // posts the product with its accounting stripped.
      this.accountingMappings.set(
        mappingsFromResponse(this.accountingFields, data.accountingMappings),
      );
      this.advancedMappings.set(advancedMappingsFromResponse(data));
      this.reasonMappings.set(reasonMappingsFromResponse(data));
      this.patchProduct(
        'paymentAllocation',
        (data.paymentAllocation ?? []) as PostPaymentAllocation[],
      );
      if (data.closeDate) {
        const cd = data.closeDate as unknown as number[];
        this.closeDate.set(
          Array.isArray(cd) ? formatArrayDate(cd) : toIsoDate(new Date(data.closeDate)),
        );
      }
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const rule = this.product().accountingRule;
    const payload: PostWorkingCapitalLoanProductsRequest = {
      ...this.product(),
      // Exactly the slots the chosen rule has, and nothing left over from another: the platform
      // rejects a mapping key the rule has no slot for, including one whose value is null.
      ...mappingsForRule(this.accountingFields, rule, this.accountingMappings()),
      ...advancedMappingsForRequest(rule, this.advancedMappings(), this.POSTING_RULES),
      ...reasonMappingsForRequest(rule, this.reasonMappings(), this.POSTING_RULES),
      locale: FINERACT_LOCALE,
      dateFormat: FINERACT_DATE_FORMAT,
    };
    if (this.startDate) payload.startDate = formatDateToFineract(this.startDate);
    if (this.closeDate()) payload.closeDate = formatDateToFineract(this.closeDate());

    const request$ =
      this.isEditMode() && this.productId
        ? this.productService.putWorkingCapitalLoanProductsProductId(this.productId, payload)
        : this.productService.postWorkingCapitalLoanProducts(payload);

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  /**
   * The allocation as the editor holds it.
   *
   * `AdvancedPaymentData` is the editor's shape and a superset of this product's
   * `PostPaymentAllocation`: it also carries `futureInstallmentAllocationRule`, which this
   * family has no rule for and refuses as an unsupported parameter. The editor is told not to
   * offer that field, so the extra key is never populated and the two shapes agree in practice.
   */
  paymentAllocation(): AdvancedPaymentData[] {
    return (this.product().paymentAllocation ?? []) as AdvancedPaymentData[];
  }

  onPaymentAllocationChange(allocation: AdvancedPaymentData[]): void {
    this.patchProduct('paymentAllocation', allocation as PostPaymentAllocation[]);
  }

  /** `DEFAULT`, allocating all six rules in the order the platform lists them. */
  private defaultPaymentAllocation(): PostPaymentAllocation[] {
    return [
      {
        transactionType: 'DEFAULT' as PostPaymentAllocation.TransactionTypeEnum,
        paymentAllocationOrder: this.paymentAllocationTypes().map((type, index) => ({
          order: index + 1,
          paymentAllocationRule: type.code,
        })),
      },
    ];
  }

  /**
   * Records the chosen rule, as the name the request carries.
   *
   * The select used to bind each option's `code`, the dotted `wcAccountingRuleType.*` spelling,
   * which the platform refuses —
   * `validation.msg.workingcapitalloanproduct.accountingRule.is.not.one.of.expected.enumerations`
   * — so a product could not be saved at all once a rule had been picked. The shared section
   * binds `id`, which is the name (`NONE`, `ACC_DEF_REV_AM`).
   */
  onAccountingRuleChange(rule: AccountingRuleKey): void {
    this.patchProduct(
      'accountingRule',
      rule as PostWorkingCapitalLoanProductsRequest.AccountingRuleEnum,
    );
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
