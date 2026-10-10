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
  CurrencyData,
  WorkingCapitalBreachData,
  WorkingCapitalNearBreachData,
  GetDelinquencyBucket,
  FundData,
} from '../../../api';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatArrayDate,
  formatDateToFineract,
  toIsoDate,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';

/**
 * Create / edit form for a working-capital loan product. Covers the core mandatory
 * and common fields; currency / amortization / repayment-frequency options come from
 * the product template endpoint. Mirrors the working-capital breach form.
 */
@Component({
  selector: 'app-wc-loan-product-form',
  standalone: true,
  imports: [
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
                      'WC_LOAN_PRODUCTS.ACCOUNTING_RULE' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'WC_LOAN_PRODUCTS.ACCOUNTING_RULE' | appTranslate"
                      interface="popover"
                      id="wc-product-accounting-rule"
                      data-testid="wc-product-accounting-rule"
                      name="accountingRule"
                      [ngModel]="product().accountingRule"
                      (ngModelChange)="patchProduct('accountingRule', $event)"
                    >
                      @for (opt of accountingRuleOptions(); track opt.id) {
                        <ion-select-option [value]="opt.code">{{ opt.value }}</ion-select-option>
                      }
                    </ion-select>
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
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.START_DATE' | appTranslate
                    }}</ion-label>
                    @if (pickersReady()) {
                      <ion-datetime-button datetime="wc-product-start-date"></ion-datetime-button>
                    }
                    <ion-modal [keepContentsMounted]="true">
                      <ng-template>
                        <ion-datetime
                          id="wc-product-start-date"
                          data-testid="wc-product-start-date"
                          presentation="date"
                          name="startDate"
                          [(ngModel)]="startDate"
                        ></ion-datetime>
                      </ng-template>
                    </ion-modal>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'WC_LOAN_PRODUCTS.CLOSE_DATE' | appTranslate
                    }}</ion-label>
                    @if (pickersReady()) {
                      <ion-datetime-button datetime="wc-product-close-date"></ion-datetime-button>
                    }
                    <ion-modal [keepContentsMounted]="true">
                      <ng-template>
                        <ion-datetime
                          id="wc-product-close-date"
                          data-testid="wc-product-close-date"
                          presentation="date"
                          name="closeDate"
                          [ngModel]="closeDate()"
                          (ngModelChange)="closeDate.set($event)"
                        ></ion-datetime>
                      </ng-template>
                    </ion-modal>
                  </ion-item>
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
    const payload: PostWorkingCapitalLoanProductsRequest = {
      ...this.product(),
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

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
