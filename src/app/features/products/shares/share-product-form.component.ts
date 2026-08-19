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
import { ProductsService, PostProductsTypeRequest } from '../../../api';
import { I18N } from '../../../core/adapters';
import { ProductAccountingSectionComponent } from '../accounting/product-accounting-section.component';
import {
  ACCOUNTING_RULE,
  AccountingMappings,
  GlAccountOptions,
  SHARE_ACCOUNTING_FIELDS,
  SHARE_ACCOUNTING_RULES,
  mappingsForRule,
  mappingsFromResponse,
} from '../accounting/product-accounting.model';

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_LOCALE = 'en';
const REDIRECT_URL = '/products/share';
const PRODUCT_TYPE = 'share';

@Component({
  selector: 'app-share-product-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    ProductAccountingSectionComponent,
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
                ? ('PRODUCTS.EDIT_SHARE_PRODUCT' | translate)
                : ('PRODUCTS.CREATE_SHARE_PRODUCT' | translate)
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
                      id="share-product-name"
                      data-testid="share-product-name"
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
                      id="share-product-short-name"
                      data-testid="share-product-short-name"
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
                      id="share-product-description"
                      data-testid="share-product-description"
                      name="description"
                      [(ngModel)]="product().description"
                      rows="2"
                    ></ion-textarea>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{ 'PRODUCTS.CURRENCY' | translate }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'PRODUCTS.CURRENCY' | translate"
                      interface="popover"
                      id="share-product-currency-code"
                      data-testid="share-product-currency-code"
                      name="currencyCode"
                      [(ngModel)]="product().currencyCode"
                      required
                    >
                      <ion-select-option [value]="DEFAULT_CURRENCY">{{
                        DEFAULT_CURRENCY
                      }}</ion-select-option>
                      <ion-select-option value="EUR">EUR</ion-select-option>
                      <ion-select-option value="INR">INR</ion-select-option>
                    </ion-select>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'PRODUCTS.TOTAL_SHARES' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'PRODUCTS.TOTAL_SHARES' | translate"
                      id="share-product-total-shares"
                      data-testid="share-product-total-shares"
                      type="number"
                      name="totalShares"
                      [(ngModel)]="product().totalShares"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'PRODUCTS.UNIT_PRICE' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'PRODUCTS.UNIT_PRICE' | translate"
                      id="share-product-unit-price"
                      data-testid="share-product-unit-price"
                      type="number"
                      name="unitPrice"
                      [(ngModel)]="product().unitPrice"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'PRODUCTS.NOMINAL_SHARES' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'PRODUCTS.NOMINAL_SHARES' | translate"
                      id="share-product-nominal-shares"
                      data-testid="share-product-nominal-shares"
                      type="number"
                      name="nominalShares"
                      [(ngModel)]="product().nominalShares"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>
              </ion-row>
            </ion-grid>

            <app-product-accounting-section
              [fields]="accountingFields"
              [accountOptions]="accountOptions()"
              [ruleOptions]="ruleOptions"
              [accountingRule]="product().accountingRule ?? 1"
              (accountingRuleChange)="product().accountingRule = $event"
              [mappings]="accountingMappings()"
              (mappingsChange)="accountingMappings.set($event)"
            ></app-product-accounting-section>

            <div class="form-actions">
              <ion-button
                id="share-product-cancel-btn"
                data-testid="share-product-cancel-btn"
                fill="clear"
                color="medium"
                type="button"
                (click)="onCancel()"
                [disabled]="isSaving()"
              >
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button
                id="share-product-submit-btn"
                data-testid="share-product-submit-btn"
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
export class ShareProductFormComponent implements OnInit {
  private readonly productService = inject(ProductsService);
  private readonly i18n = inject(I18N);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly DEFAULT_CURRENCY = DEFAULT_CURRENCY;

  productId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  protected readonly accountingFields = SHARE_ACCOUNTING_FIELDS;
  readonly accountOptions = signal<GlAccountOptions>({});
  readonly accountingMappings = signal<AccountingMappings>({});

  /**
   * The rule selector's options.
   *
   * Every other product family reads these from `accountingRuleOptions` on its template. The
   * share template does not carry that key, so the two rules a share product can meaningfully
   * hold are named here — see {@link SHARE_ACCOUNTING_RULES} for why accrual is not among them.
   */
  readonly ruleOptions = SHARE_ACCOUNTING_RULES.map((id) => ({
    id,
    value: this.i18n.translate(
      id === ACCOUNTING_RULE.NONE
        ? 'PRODUCTS.ACCOUNTING.RULE_NONE'
        : 'PRODUCTS.ACCOUNTING.RULE_CASH',
    ),
  }));

  readonly product = signal<PostProductsTypeRequest>({
    currencyCode: DEFAULT_CURRENCY,
    digitsAfterDecimal: 2,
    inMultiplesOf: 1,
    totalShares: 1000,
    unitPrice: 1,
    nominalShares: 1,
    accountingRule: ACCOUNTING_RULE.NONE,
    allowDividendCalculationForInactiveClients: false,
  });

  ngOnInit() {
    this.loadTemplate();
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.productId = +id;
        this.isEditMode.set(true);
        this.loadProductData();
      }
    });
  }

  /**
   * Reads the chart of accounts the mapping selects offer.
   *
   * The response is typed `string` by the document although it is JSON, hence the cast. Note
   * that Fineract omits an option list entirely when the tenant holds no accounts of that class
   * — a chart with no equity account returns no `equityAccountOptions` at all, rather than an
   * empty array — so the section is written to tolerate any of them being absent.
   */
  private loadTemplate(): void {
    this.productService.getProductsTypeTemplate(PRODUCT_TYPE).subscribe({
      next: (template) => {
        const options = (template as unknown as { accountingMappingOptions?: GlAccountOptions })
          .accountingMappingOptions;
        this.accountOptions.set(options ?? {});
      },
      error: () => this.accountOptions.set({}),
    });
  }

  loadProductData() {
    if (!this.productId) return;
    this.productService.getProductsTypeProductId(this.productId, PRODUCT_TYPE).subscribe((data) => {
      this.product.set({
        name: data.name,
        shortName: data.shortName,
        description: data.description,
        currencyCode: data.currency?.code,
        digitsAfterDecimal: data.currency?.decimalPlaces,
        totalShares: data.totalShares,
        unitPrice: data.unitPrice,
        nominalShares: data.nominalShares,
        accountingRule: data.accountingRule?.id ?? ACCOUNTING_RULE.NONE,
      });
      this.accountingMappings.set(
        mappingsFromResponse(
          this.accountingFields,
          (data as unknown as { accountingMappings?: object }).accountingMappings,
        ),
      );
    });
  }

  /**
   * The product plus the mapping ids the selected rule requires, and no others.
   *
   * `accountingRule` used to be pinned to `1` here and on load, so every share product this
   * screen created was unaccounted and editing an accounted one silently reset it. Share capital
   * is the members' stake in the institution; posting nothing against it is the one line on the
   * balance sheet that cannot be reconstructed afterwards.
   */
  private buildRequest(): PostProductsTypeRequest {
    return {
      ...this.product(),
      locale: DEFAULT_LOCALE,
      ...mappingsForRule(
        this.accountingFields,
        this.product().accountingRule ?? ACCOUNTING_RULE.NONE,
        this.accountingMappings(),
      ),
    };
  }

  onSubmit() {
    this.isSaving.set(true);
    const request = this.buildRequest();

    if (this.isEditMode() && this.productId) {
      this.productService
        .putProductsTypeProductId(PRODUCT_TYPE, this.productId, request)
        .subscribe({
          next: () => this.router.navigate([REDIRECT_URL]),
          error: () => this.isSaving.set(false),
        });
    } else {
      this.productService.postProductsType(PRODUCT_TYPE, request).subscribe({
        next: () => this.router.navigate([REDIRECT_URL]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel() {
    this.router.navigate([REDIRECT_URL]);
  }
}
