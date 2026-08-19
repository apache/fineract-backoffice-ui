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
import { TranslateModule } from '@ngx-translate/core';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol,
} from '@ionic/angular/standalone';
import {
  SavingsProductService,
  PostSavingsProductsRequest,
  PutSavingsProductsProductIdRequest,
} from '../../api';
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
  SAVINGS_ACCOUNTING_FIELDS,
  mappingsForRule,
  mappingsFromResponse,
  AdvancedAccountingMappings,
  advancedMappingsForRequest,
  advancedMappingsFromResponse,
  emptyAdvancedMappings,
} from './accounting/product-accounting.model';

@Component({
  selector: 'app-savings-product-form',
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
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonSpinner,
    IonGrid,
    IonRow,
    IonCol,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('PRODUCTS.EDIT_SAVINGS_PRODUCT' | translate)
                : ('PRODUCTS.CREATE_SAVINGS_PRODUCT' | translate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #productForm="ngForm" (ngSubmit)="onSubmit()" class="product-form">
            <ion-grid>
              <ion-row>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{ 'COMMON.NAME' | translate }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'COMMON.NAME' | translate"
                      id="savings-product-name"
                      data-testid="savings-product-name"
                      name="name"
                      [(ngModel)]="product().name"
                      required
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
                      id="savings-product-short-name"
                      data-testid="savings-product-short-name"
                      name="shortName"
                      [(ngModel)]="product().shortName"
                      required
                      maxlength="4"
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
                      id="savings-product-description"
                      data-testid="savings-product-description"
                      name="description"
                      [(ngModel)]="product().description"
                      rows="3"
                    ></ion-textarea>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{ 'PRODUCTS.CURRENCY' | translate }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'PRODUCTS.CURRENCY' | translate"
                      interface="popover"
                      id="savings-product-currency-code"
                      data-testid="savings-product-currency-code"
                      name="currencyCode"
                      [(ngModel)]="product().currencyCode"
                      required
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
                      id="savings-product-decimal-places"
                      data-testid="savings-product-decimal-places"
                      type="number"
                      name="digitsAfterDecimal"
                      [(ngModel)]="product().digitsAfterDecimal"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'PRODUCTS.NOMINAL_ANNUAL_INTEREST_RATE' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'PRODUCTS.NOMINAL_ANNUAL_INTEREST_RATE' | translate"
                      id="savings-product-interest-rate"
                      data-testid="savings-product-interest-rate"
                      type="number"
                      name="nominalAnnualInterestRate"
                      [(ngModel)]="product().nominalAnnualInterestRate"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>
              </ion-row>
            </ion-grid>

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
                id="savings-product-cancel-btn"
                data-testid="savings-product-cancel-btn"
                fill="clear"
                color="medium"
                type="button"
                (click)="onCancel()"
                [disabled]="isSaving()"
              >
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button
                id="savings-product-submit-btn"
                data-testid="savings-product-submit-btn"
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
export class SavingsProductFormComponent implements OnInit {
  private readonly productService = inject(SavingsProductService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/products/savings';

  productId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly accountingFields = SAVINGS_ACCOUNTING_FIELDS;
  readonly accountingMappingOptions = signal<GlAccountOptions>({});
  readonly accountingRuleOptions = signal<{ id?: number; value?: string }[]>([]);
  readonly accountingMappings = signal<AccountingMappings>({});

  /** The advanced overrides — see the loan form for why these are held apart from the base ids. */
  readonly advancedMappings = signal<AdvancedAccountingMappings>(emptyAdvancedMappings());
  readonly paymentTypeOptions = signal<PaymentTypeOption[]>([]);
  /** Charges the product carries; the tenant catalogue would invite mappings that never fire. */
  readonly productCharges = signal<ChargeOption[]>([]);

  readonly product = signal<PostSavingsProductsRequest>({
    currencyCode: 'USD',
    digitsAfterDecimal: 2,
    interestCompoundingPeriodType: 1,
    interestPostingPeriodType: 4,
    interestCalculationType: 1,
    interestCalculationDaysInYearType: 365,
    accountingRule: 1,
  });

  ngOnInit() {
    this.productService.getSavingsproductsTemplate().subscribe((template) => {
      const raw = template as unknown as Record<string, unknown>;
      this.accountingMappingOptions.set(
        (raw['accountingMappingOptions'] as GlAccountOptions) ?? {},
      );
      this.accountingRuleOptions.set(
        Array.from((raw['accountingRuleOptions'] as { id?: number; value?: string }[]) ?? []),
      );
      this.paymentTypeOptions.set(
        Array.from((raw['paymentTypeOptions'] as PaymentTypeOption[]) ?? []),
      );
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
    this.productService.getSavingsproductsProductId(this.productId).subscribe((data) => {
      this.product.set({
        name: data.name,
        shortName: data.shortName,
        description: data.description,
        currencyCode: data.currency?.code,
        digitsAfterDecimal: data.currency?.decimalPlaces,
        nominalAnnualInterestRate: data.nominalAnnualInterestRate,
        // Read back rather than re-seeded with the create defaults: every one of these was
        // pinned, so opening a product configured with, say, quarterly posting and saving it
        // silently moved it back to monthly — and reset its accounting rule to NONE, taking
        // every GL mapping under it.
        interestCompoundingPeriodType: data.interestCompoundingPeriodType?.id ?? 1,
        interestPostingPeriodType: data.interestPostingPeriodType?.id ?? 4,
        interestCalculationType: data.interestCalculationType?.id ?? 1,
        interestCalculationDaysInYearType: data.interestCalculationDaysInYearType?.id ?? 365,
        accountingRule: data.accountingRule?.id ?? ACCOUNTING_RULE.NONE,
      });
      this.accountingMappings.set(
        mappingsFromResponse(
          this.accountingFields,
          (data as unknown as Record<string, unknown>)['accountingMappings'] as object,
        ),
      );
      this.advancedMappings.set(advancedMappingsFromResponse(data));
      this.productCharges.set(
        ((data as unknown as Record<string, unknown>)['charges'] as ChargeOption[]) ?? [],
      );
    });
  }

  /** The form's fields plus exactly the account slots the chosen rule has. */
  private buildRequest(): PostSavingsProductsRequest {
    return {
      ...this.product(),
      ...advancedMappingsForRequest(this.product().accountingRule, this.advancedMappings()),
      ...mappingsForRule(
        this.accountingFields,
        this.product().accountingRule ?? ACCOUNTING_RULE.NONE,
        this.accountingMappings(),
      ),
    };
  }

  onSubmit() {
    this.isSaving.set(true);
    this.product().locale = 'en';
    const request = this.buildRequest();

    if (this.isEditMode() && this.productId) {
      this.productService
        .putSavingsproductsProductId(this.productId, request as PutSavingsProductsProductIdRequest)
        .subscribe({
          next: () => this.router.navigate([this.LIST_PATH]),
          error: () => this.isSaving.set(false),
        });
    } else {
      this.productService.postSavingsproducts(request).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel() {
    this.router.navigate([this.LIST_PATH]);
  }
}
