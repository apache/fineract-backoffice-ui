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
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonNote,
} from '@ionic/angular/standalone';
import {
  RecurringDepositProductService,
  GetRecurringDepositProductsProductIdResponse,
  PutRecurringDepositProductsRequest,
  PostRecurringDepositProductsRequest,
} from '../../../api';
import { ProductAccountingSectionComponent } from '../accounting/product-accounting-section.component';
import {
  ACCOUNTING_RULE,
  AccountingMappings,
  GlAccountOptions,
  TERM_DEPOSIT_ACCOUNTING_FIELDS,
  mappingsForRule,
  mappingsFromResponse,
} from '../accounting/product-accounting.model';
import {
  DepositChart,
  DepositChartSlab,
  chartForRequest,
  chartFromResponse,
  emptySlab,
  slabsFromResponse,
} from '../deposit-chart';
import {
  ChartPeriodTypeOption,
  DepositChartEditorComponent,
} from '../deposit-chart-editor.component';

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_LOCALE = 'en';
const REDIRECT_URL = '/products/recurring';

@Component({
  selector: 'app-recurring-deposit-product-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    ProductAccountingSectionComponent,
    DepositChartEditorComponent,
    IonButton,
    IonSpinner,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonNote,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('PRODUCTS.EDIT_RECURRING_DEPOSIT_PRODUCT' | appTranslate)
                : ('PRODUCTS.CREATE_RECURRING_DEPOSIT_PRODUCT' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #productForm="ngForm" (ngSubmit)="onSubmit()" class="product-form">
            <div class="form-grid">
              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.NAME' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.NAME' | appTranslate"
                  name="name"
                  [(ngModel)]="product()['name']"
                  required
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'PRODUCTS.SHORT_NAME' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'PRODUCTS.SHORT_NAME' | appTranslate"
                  name="shortName"
                  [(ngModel)]="product()['shortName']"
                  required
                  maxlength="4"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline" class="full-width">
                <ion-label position="stacked">{{
                  'PRODUCTS.DESCRIPTION' | appTranslate
                }}</ion-label>
                <ion-textarea
                  [attr.aria-label]="'PRODUCTS.DESCRIPTION' | appTranslate"
                  name="description"
                  [(ngModel)]="product()['description']"
                  rows="2"
                  required
                ></ion-textarea>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'PRODUCTS.CURRENCY' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'PRODUCTS.CURRENCY' | appTranslate"
                  interface="popover"
                  name="currencyCode"
                  [(ngModel)]="product()['currencyCode']"
                  required
                >
                  <ion-select-option [value]="DEFAULT_CURRENCY">{{
                    DEFAULT_CURRENCY
                  }}</ion-select-option>
                  <ion-select-option value="EUR">EUR</ion-select-option>
                  <ion-select-option value="INR">INR</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'PRODUCTS.DECIMAL_PLACES' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'PRODUCTS.DECIMAL_PLACES' | appTranslate"
                  type="number"
                  name="digitsAfterDecimal"
                  [(ngModel)]="product()['digitsAfterDecimal']"
                  required
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'PRODUCTS.RECURRING_FREQUENCY' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'PRODUCTS.RECURRING_FREQUENCY' | appTranslate"
                  type="number"
                  name="recurringFrequency"
                  [(ngModel)]="product()['recurringFrequency']"
                  required
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'PRODUCTS.FREQUENCY_TYPE' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'PRODUCTS.FREQUENCY_TYPE' | appTranslate"
                  interface="popover"
                  name="recurringFrequencyType"
                  [(ngModel)]="product()['recurringFrequencyType']"
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
            </div>

            <!-- Compounding, posting, calculation and days-in-year. All four were hard-coded
                 and invisible before #765, so a product's interest behaviour was whatever the
                 form happened to default to. The options come from the product template. -->
            <div class="form-grid">
              <ion-item fill="outline">
                <ion-label position="stacked"
                  >{{ 'PRODUCTS.INTEREST_COMPOUNDING_PERIOD' | appTranslate }}
                  <span class="required-marker" aria-hidden="true">*</span></ion-label
                >
                <ion-select
                  [attr.aria-label]="'PRODUCTS.INTEREST_COMPOUNDING_PERIOD' | appTranslate"
                  interface="popover"
                  data-testid="interestCompoundingPeriodType"
                  name="interestCompoundingPeriodType"
                  [(ngModel)]="product()['interestCompoundingPeriodType']"
                  required
                >
                  @for (option of compoundingOptions(); track option.id) {
                    <ion-select-option [value]="option.id">{{ option.value }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked"
                  >{{ 'PRODUCTS.INTEREST_POSTING_PERIOD' | appTranslate }}
                  <span class="required-marker" aria-hidden="true">*</span></ion-label
                >
                <ion-select
                  [attr.aria-label]="'PRODUCTS.INTEREST_POSTING_PERIOD' | appTranslate"
                  interface="popover"
                  data-testid="interestPostingPeriodType"
                  name="interestPostingPeriodType"
                  [(ngModel)]="product()['interestPostingPeriodType']"
                  required
                >
                  @for (option of postingOptions(); track option.id) {
                    <ion-select-option [value]="option.id">{{ option.value }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked"
                  >{{ 'PRODUCTS.INTEREST_CALCULATED_USING' | appTranslate }}
                  <span class="required-marker" aria-hidden="true">*</span></ion-label
                >
                <ion-select
                  [attr.aria-label]="'PRODUCTS.INTEREST_CALCULATED_USING' | appTranslate"
                  interface="popover"
                  data-testid="interestCalculationType"
                  name="interestCalculationType"
                  [(ngModel)]="product()['interestCalculationType']"
                  required
                >
                  @for (option of calculationOptions(); track option.id) {
                    <ion-select-option [value]="option.id">{{ option.value }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked"
                  >{{ 'PRODUCTS.INTEREST_CALC_DAYS_IN_YEAR' | appTranslate }}
                  <span class="required-marker" aria-hidden="true">*</span></ion-label
                >
                <ion-select
                  [attr.aria-label]="'PRODUCTS.INTEREST_CALC_DAYS_IN_YEAR' | appTranslate"
                  interface="popover"
                  data-testid="interestCalculationDaysInYearType"
                  name="interestCalculationDaysInYearType"
                  [(ngModel)]="product()['interestCalculationDaysInYearType']"
                  required
                >
                  @for (option of daysInYearOptions(); track option.id) {
                    <ion-select-option [value]="option.id">{{ option.value }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>
            </div>

            <app-deposit-chart-editor
              #chartEditor
              [periodTypes]="chartPeriodTypes()"
              [(slabs)]="chartSlabs"
            ></app-deposit-chart-editor>

            <app-product-accounting-section
              [fields]="accountingFields"
              [accountOptions]="accountingMappingOptions()"
              [ruleOptions]="accountingRuleOptions()"
              [accountingRule]="$any(product()['accountingRule']) ?? 1"
              (accountingRuleChange)="product()['accountingRule'] = $event"
              [mappings]="accountingMappings()"
              (mappingsChange)="accountingMappings.set($event)"
            ></app-product-accounting-section>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                data-testid="product-submit"
                [disabled]="productForm.invalid || !chartEditor.complete() || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | appTranslate }}
                } @else {
                  {{ 'COMMON.SAVE' | appTranslate }}
                }
              </ion-button>
            </div>
            @if (productForm.invalid || !chartEditor.complete()) {
              <ion-note
                color="medium"
                class="submit-hint"
                data-testid="product-submit-hint"
                aria-live="polite"
                >{{ 'COMMON.COMPLETE_REQUIRED_FIELDS' | appTranslate }}</ion-note
              >
            }
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
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
    `,
  ],
})
export class RecurringDepositProductFormComponent implements OnInit {
  private readonly productService = inject(RecurringDepositProductService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly DEFAULT_CURRENCY = DEFAULT_CURRENCY;

  productId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly accountingFields = TERM_DEPOSIT_ACCOUNTING_FIELDS;
  readonly accountingMappingOptions = signal<GlAccountOptions>({});
  readonly accountingRuleOptions = signal<{ id?: number; value?: string }[]>([]);
  readonly accountingMappings = signal<AccountingMappings>({});

  /** The product's own interest chart, kept so an update can send it back untouched. */
  readonly existingChart = signal<DepositChart | null>(null);

  /** The editable rate slabs. One empty row on create, the product's own on edit. */
  readonly chartSlabs = signal<DepositChartSlab[]>([emptySlab()]);

  /** Period and interest options, all from `GET /recurringdepositproducts/template`. */
  readonly chartPeriodTypes = signal<ChartPeriodTypeOption[]>([]);
  readonly compoundingOptions = signal<{ id?: number; value?: string }[]>([]);
  readonly postingOptions = signal<{ id?: number; value?: string }[]>([]);
  readonly calculationOptions = signal<{ id?: number; value?: string }[]>([]);
  readonly daysInYearOptions = signal<{ id?: number; value?: string }[]>([]);

  readonly product = signal<Record<string, unknown>>({
    currencyCode: DEFAULT_CURRENCY,
    digitsAfterDecimal: 2,
    inMultiplesOf: 0,
    interestCompoundingPeriodType: 4, // Monthly
    interestPostingPeriodType: 4, // Monthly
    interestCalculationType: 1, // Daily
    interestCalculationDaysInYearType: 365,
    accountingRule: 1, // NONE
    recurringFrequency: 1,
    recurringFrequencyType: 2, // Months
    minDepositTerm: 1,
    minDepositTermTypeId: 2,
    depositAmount: 1000,
  });

  ngOnInit() {
    this.productService.getRecurringdepositproductsTemplate().subscribe((template) => {
      const raw = template as unknown as Record<string, unknown>;
      this.accountingMappingOptions.set(
        (raw['accountingMappingOptions'] as GlAccountOptions) ?? {},
      );
      this.accountingRuleOptions.set(
        Array.from((raw['accountingRuleOptions'] as { id?: number; value?: string }[]) ?? []),
      );

      const chartTemplate = raw['chartTemplate'] as Record<string, unknown> | undefined;
      this.chartPeriodTypes.set(
        Array.from((chartTemplate?.['periodTypes'] as ChartPeriodTypeOption[]) ?? []),
      );
      this.compoundingOptions.set(this.options(raw, 'interestCompoundingPeriodTypeOptions'));
      this.postingOptions.set(this.options(raw, 'interestPostingPeriodTypeOptions'));
      this.calculationOptions.set(this.options(raw, 'interestCalculationTypeOptions'));
      this.daysInYearOptions.set(this.options(raw, 'interestCalculationDaysInYearTypeOptions'));
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

  loadProductData() {
    if (!this.productId) return;
    this.productService
      .getRecurringdepositproductsProductId(this.productId)
      .subscribe((data: GetRecurringDepositProductsProductIdResponse) => {
        const raw = data as unknown as Record<string, unknown>;
        this.product.set({
          name: data.name,
          shortName: data.shortName,
          description: data.description,
          currencyCode: data.currency?.code,
          digitsAfterDecimal: data.currency?.decimalPlaces,
          inMultiplesOf:
            (raw['currency'] as { inMultiplesOf?: number } | undefined)?.inMultiplesOf ?? 0,
          recurringFrequency: data.recurringDepositFrequency,
          recurringFrequencyType: data.recurringDepositFrequencyType?.id,
          minDepositTerm: raw['minDepositTerm'],
          minDepositTermTypeId: (raw['minDepositTermType'] as { id?: number } | undefined)?.id,
          depositAmount: raw['depositAmount'],
          minDepositAmount: raw['minDepositAmount'],
          maxDepositAmount: raw['maxDepositAmount'],
          interestCompoundingPeriodType: data.interestCompoundingPeriodType?.id,
          interestPostingPeriodType: data.interestPostingPeriodType?.id,
          interestCalculationType: data.interestCalculationType?.id,
          interestCalculationDaysInYearType: data.interestCalculationDaysInYearType?.id,
          preClosurePenalApplicable: raw['preClosurePenalApplicable'] ?? false,
          accountingRule: (raw['accountingRule'] as { id?: number } | undefined)?.id ?? 1,
        });
        this.existingChart.set(chartFromResponse(raw['activeChart']));
        const slabs = slabsFromResponse(raw['activeChart']);
        this.chartSlabs.set(slabs.length ? slabs : [emptySlab()]);
        this.accountingMappings.set(
          mappingsFromResponse(this.accountingFields, raw['accountingMappings'] as object),
        );
      });
  }

  onSubmit() {
    this.isSaving.set(true);
    this.product()['locale'] = DEFAULT_LOCALE;

    // `recurringFrequency` and `recurringFrequencyType` are what the platform accepts, and they
    // used to be deleted here along with two `recurringDeposit…` spellings that it does not.
    // Nothing carried the recurrence at all, so a recurring deposit product could be neither
    // created nor updated — the request came back 400 naming `recurringDepositFrequency`, which
    // is the *entity* field rather than the parameter, and is what sent the guess wrong.
    const payload = {
      ...this.product(),
      ...mappingsForRule(
        this.accountingFields,
        (this.product()['accountingRule'] as number) ?? ACCOUNTING_RULE.NONE,
        this.accountingMappings(),
      ),
      charts: [chartForRequest(this.chartSlabs(), this.existingChart())],
    };

    if (this.isEditMode() && this.productId) {
      this.productService
        .putRecurringdepositproductsProductId(
          this.productId,
          payload as unknown as PutRecurringDepositProductsRequest,
        )
        .subscribe({
          next: () => this.router.navigate([REDIRECT_URL]),
          error: () => this.isSaving.set(false),
        });
    } else {
      this.productService
        .postRecurringdepositproducts(payload as unknown as PostRecurringDepositProductsRequest)
        .subscribe({
          next: () => this.router.navigate([REDIRECT_URL]),
          error: () => this.isSaving.set(false),
        });
    }
  }

  private options(
    template: Record<string, unknown>,
    key: string,
  ): { id?: number; value?: string }[] {
    return Array.from((template[key] as { id?: number; value?: string }[]) ?? []);
  }

  onCancel() {
    this.router.navigate([REDIRECT_URL]);
  }
}
