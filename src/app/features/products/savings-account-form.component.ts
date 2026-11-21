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
import { FormsModule } from '@angular/forms';
import { I18N, TranslatePipe } from '../../core/adapters';
import { ClientSearchComponent } from '../../shared/components/client-search/client-search.component';
import { MutationOutcomeService } from '../../core/services/mutation-outcome.service';
import { NotificationService } from '../../core/services/notification.service';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { AuthService } from '../../core/services/auth.service';
import { RequiresPermissionDirective } from '../../shared/directives/requires-permission.directive';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  SavingsAccountService,
  SavingsProductService,
  PostSavingsAccountsRequest,
  GetSavingsProductsResponse,
  SavingsAccountData,
} from '../../api';
import {
  formatArrayDate,
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../core/utils/date-formatter';
import { createPickersReady } from '../../shared/utils/pickers-ready';

/**
 * Account form payload including fields not present in the generated API request model.
 *
 * Generated models omit `nominalAnnualInterestRate` and the overdraft fields. This local interface
 * avoids hand-editing `src/app/api`, which is overwritten on weekly OpenAPI sync.
 */
export interface SavingsAccountFormPayload extends PostSavingsAccountsRequest {
  nominalAnnualInterestRate?: number;
  allowOverdraft?: boolean;
  overdraftLimit?: number;
  nominalAnnualInterestRateOverdraft?: number;
  minOverdraftForInterestCalculation?: number;
}

@Component({
  selector: 'app-savings-account-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    ClientSearchComponent,
    IonIcon,
    IonButton,
    IonSpinner,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonCheckbox,
    IonNote,
    IonSelectOption,
    IonSelect,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    TooltipDirective,
    RequiresPermissionDirective,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('SAVINGS.EDIT_ACCOUNT' | appTranslate)
                : ('SAVINGS.CREATE_ACCOUNT' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #accountForm="ngForm" (ngSubmit)="onSubmit()" class="savings-form">
            <div class="form-grid">
              <!-- Client Search with Create Option -->
              <div class="field-container-row">
                <app-client-search
                  [label]="'COMMON.CLIENT_ID' | appTranslate"
                  [required]="true"
                  [initialClientId]="account().clientId || null"
                  (clientSelected)="account().clientId = $event"
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
                  [appTooltip]="'HELP.SAVINGS_PRODUCT_DESC' | appTranslate"
                  class="flex-grow"
                >
                  <ion-label position="stacked">{{ 'COMMON.PRODUCT' | appTranslate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'COMMON.PRODUCT' | appTranslate"
                    interface="popover"
                    name="productId"
                    [ngModel]="account().productId"
                    (ngModelChange)="onProductChanged($event)"
                    required
                    [disabled]="isEditMode()"
                  >
                    @for (product of products(); track product.id) {
                      <ion-select-option [value]="product.id">{{ product.name }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
                <ion-button
                  fill="clear"
                  type="button"
                  [attr.aria-label]="'PRODUCTS.CREATE_SAVINGS_PRODUCT' | appTranslate"
                  [appTooltip]="'PRODUCTS.CREATE_SAVINGS_PRODUCT' | appTranslate"
                  (click)="onCreateProduct()"
                  style="margin-top: 4px;"
                  [disabled]="isEditMode()"
                >
                  <ion-icon color="primary" name="add-circle-outline"></ion-icon>
                </ion-button>
              </div>

              <!-- Submitted On -->
              <ion-item fill="outline" [appTooltip]="'HELP.SUBMITTED_ON_DESC' | appTranslate">
                <ion-label position="stacked">{{ 'COMMON.SUBMITTED_ON' | appTranslate }}</ion-label>
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

              <!-- Nominal Annual Interest Rate -->
              <ion-item fill="outline" [appTooltip]="'HELP.INTEREST_RATE_DESC' | appTranslate">
                <ion-label position="stacked">{{
                  'COMMON.INTEREST_RATE' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.INTEREST_RATE' | appTranslate"
                  type="number"
                  name="nominalAnnualInterestRate"
                  data-testid="savings-interest-rate"
                  [ngModel]="interestRate()"
                  (ngModelChange)="onInterestRateChanged($event)"
                ></ion-input>
              </ion-item>
            </div>

            <!-- Overdraft Section (separate group, shown only when product allows overdraft) -->
            @if (productAllowsOverdraft()) {
              <fieldset
                class="form-fieldset overdraft-group"
                data-testid="savings-overdraft-group"
                [appRequiresPermission]="overdraftPermission()"
              >
                <legend class="fieldset-legend">
                  <ion-icon name="card-outline" aria-hidden="true"></ion-icon>
                  {{ 'SAVINGS.OVERDRAFT' | appTranslate }}
                </legend>

                <div class="form-grid">
                  <!-- Allow Overdraft Checkbox -->
                  <div class="field-container-checkbox">
                    <ion-item lines="none" class="checkbox-item" [appTooltip]="'HELP.ALLOW_OVERDRAFT_DESC' | appTranslate">
                      <ion-checkbox
                        name="allowOverdraft"
                        [ngModel]="allowOverdraft()"
                        (ngModelChange)="onAllowOverdraftChanged($event)"
                        [disabled]="!canEditOverdraft()"
                        [appRequiresPermission]="overdraftPermission()"
                        data-testid="savings-allow-overdraft"
                      >
                        {{ 'SAVINGS.ALLOW_OVERDRAFT' | appTranslate }}
                      </ion-checkbox>
                    </ion-item>
                  </div>

                  @if (allowOverdraft()) {
                    <!-- Overdraft Limit -->
                    <div class="field-container">
                      <ion-item fill="outline" [appTooltip]="'HELP.OVERDRAFT_LIMIT_DESC' | appTranslate">
                        <ion-label position="stacked">
                          {{ 'SAVINGS.OVERDRAFT_LIMIT' | appTranslate }}
                          <span class="required-marker" aria-hidden="true">*</span>
                        </ion-label>
                        <ion-input
                          type="number"
                          name="overdraftLimit"
                          data-testid="savings-overdraft-limit"
                          [attr.aria-label]="'SAVINGS.OVERDRAFT_LIMIT' | appTranslate"
                          [ngModel]="overdraftLimit()"
                          (ngModelChange)="onOverdraftLimitChanged($event)"
                          [required]="true"
                          [disabled]="!canEditOverdraft()"
                          [appRequiresPermission]="overdraftPermission()"
                        ></ion-input>
                      </ion-item>
                      @if (productOverdraftMax() !== null && productOverdraftMax()! > 0) {
                        <ion-note color="medium" class="field-hint" data-testid="savings-overdraft-max-hint">
                          {{ 'SAVINGS.MAX_OVERDRAFT_LIMIT' | appTranslate: { max: productOverdraftMax() } }}
                        </ion-note>
                      }
                      @if (isOverdraftLimitExceeded()) {
                        <ion-note color="danger" class="field-error" data-testid="savings-overdraft-limit-error">
                          {{ 'SAVINGS.OVERDRAFT_LIMIT_EXCEEDS_MAX' | appTranslate: { max: productOverdraftMax() } }}
                        </ion-note>
                      }
                    </div>

                    <!-- Nominal Annual Interest Rate Overdraft -->
                    <div class="field-container">
                      <ion-item fill="outline" [appTooltip]="'HELP.NOMINAL_ANNUAL_INTEREST_RATE_OVERDRAFT_DESC' | appTranslate">
                        <ion-label position="stacked">
                          {{ 'SAVINGS.NOMINAL_ANNUAL_INTEREST_RATE_OVERDRAFT' | appTranslate }}
                        </ion-label>
                        <ion-input
                          type="number"
                          name="nominalAnnualInterestRateOverdraft"
                          data-testid="savings-overdraft-rate"
                          [attr.aria-label]="'SAVINGS.NOMINAL_ANNUAL_INTEREST_RATE_OVERDRAFT' | appTranslate"
                          [ngModel]="nominalAnnualInterestRateOverdraft()"
                          (ngModelChange)="onNominalAnnualInterestRateOverdraftChanged($event)"
                          [disabled]="!canEditOverdraft()"
                          [appRequiresPermission]="overdraftPermission()"
                        ></ion-input>
                      </ion-item>
                    </div>

                    <!-- Min Overdraft For Interest Calculation -->
                    <div class="field-container">
                      <ion-item fill="outline" [appTooltip]="'HELP.MIN_OVERDRAFT_FOR_INTEREST_CALCULATION_DESC' | appTranslate">
                        <ion-label position="stacked">
                          {{ 'SAVINGS.MIN_OVERDRAFT_FOR_INTEREST_CALCULATION' | appTranslate }}
                        </ion-label>
                        <ion-input
                          type="number"
                          name="minOverdraftForInterestCalculation"
                          data-testid="savings-overdraft-min-calc"
                          [attr.aria-label]="'SAVINGS.MIN_OVERDRAFT_FOR_INTEREST_CALCULATION' | appTranslate"
                          [ngModel]="minOverdraftForInterestCalculation()"
                          (ngModelChange)="onMinOverdraftForInterestCalculationChanged($event)"
                          [disabled]="!canEditOverdraft()"
                          [appRequiresPermission]="overdraftPermission()"
                        ></ion-input>
                      </ion-item>
                    </div>
                  }
                </div>
              </fieldset>
            }

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="accountForm.invalid || isSaving() || isOverdraftInvalid()"
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
        max-width: 900px;
        margin: 0 auto;
      }
      .savings-form {
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
      .form-fieldset {
        border: 1px solid var(--ion-color-light-shade, #e0e0e0);
        border-radius: 8px;
        padding: 16px;
        margin: 8px 0;
      }
      .fieldset-legend {
        font-weight: 600;
        font-size: 1rem;
        padding: 0 8px;
        color: var(--ion-color-dark, #222);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .field-container-checkbox {
        display: flex;
        align-items: center;
        min-height: 56px;
      }
      .checkbox-item {
        --padding-start: 0;
        width: 100%;
      }
      .field-container {
        display: flex;
        flex-direction: column;
      }
      .field-hint {
        display: block;
        padding-inline-start: 4px;
        margin-top: 4px;
        font-size: 0.8125rem;
      }
      .field-error {
        display: block;
        padding-inline-start: 4px;
        margin-top: 4px;
        font-size: 0.8125rem;
      }
      .required-marker {
        color: var(--ion-color-danger, #eb445a);
        margin-inline-start: 2px;
      }
    `,
  ],
})
export class SavingsAccountFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly savingsService = inject(SavingsAccountService);
  private readonly productService = inject(SavingsProductService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly platformDate = inject(PlatformDateService);
  private readonly notifications = inject(NotificationService);
  private readonly mutationOutcome = inject(MutationOutcomeService);
  private readonly authService = inject(AuthService);
  private readonly i18n = inject(I18N);

  private readonly LIST_PATH = '/products/savings-accounts';

  accountId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly account = signal<PostSavingsAccountsRequest>({});
  /**
   * The account's interest rate, bound separately because the generated request model omits it.
   *
   * `null` means "not stated", and is what the form starts at — not `0`. Fineract reads a rate
   * in the request as an **account-level override** of the product's, so a form that always sent
   * `nominalAnnualInterestRate: 0` opened every savings account at 0% however the product was
   * configured. That is issue #761, and the depositor only finds out at interest posting.
   */
  readonly interestRate = signal<number | null>(null);
  readonly submittedOnDate = signal(this.platformDate.today());
  readonly products = signal<GetSavingsProductsResponse[]>([]);

  // Overdraft state
  readonly productAllowsOverdraft = signal(false);
  readonly productOverdraftMax = signal<number | null>(null);

  readonly allowOverdraft = signal(false);
  readonly overdraftLimit = signal<number | null>(null);
  readonly nominalAnnualInterestRateOverdraft = signal<number | null>(null);
  readonly minOverdraftForInterestCalculation = signal<number | null>(null);

  /** In edit mode, updating overdraft fields requires UPDATE_SAVINGSACCOUNT. */
  readonly hasUpdatePermission = computed(() =>
    this.authService.hasPermission('UPDATE_SAVINGSACCOUNT'),
  );
  readonly canEditOverdraft = computed(() => !this.isEditMode() || this.hasUpdatePermission());
  readonly overdraftPermission = computed(() =>
    this.isEditMode() ? 'UPDATE_SAVINGSACCOUNT' : [],
  );

  readonly isOverdraftLimitExceeded = computed(() => {
    if (!this.allowOverdraft()) return false;
    const limit = this.overdraftLimit();
    const max = this.productOverdraftMax();
    return limit !== null && max !== null && max > 0 && limit > max;
  });

  readonly isOverdraftInvalid = computed(() => {
    if (!this.productAllowsOverdraft() || !this.allowOverdraft()) return false;
    const limit = this.overdraftLimit();
    if (limit === null || limit === undefined || Number.isNaN(limit)) return true;
    const max = this.productOverdraftMax();
    if (max !== null && max > 0 && limit > max) return true;
    return false;
  });

  ngOnInit(): void {
    this.seedPlatformDates();
    this.loadProducts();

    // Check for clientId in query params for pre-population
    this.route.queryParams.subscribe((queryParams) => {
      const clientId = queryParams['clientId'];
      if (clientId) {
        this.account().clientId = +clientId;
      }
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.accountId = +id;
        this.isEditMode.set(true);
        this.loadAccountData();
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
    });
  }

  onCreateClient() {
    this.router.navigate(['/clients/create']);
  }

  onCreateProduct() {
    this.router.navigate(['/products/savings/create']);
  }

  private loadProducts(): void {
    this.productService.getSavingsproducts().subscribe({
      next: (data: GetSavingsProductsResponse[]) => {
        this.products.set(data || []);
        // The product may have been chosen before its list arrived — a client-scoped route
        // carries `clientId`, and nothing stops the user picking a product first either.
        this.prefillRateFromProduct(this.account().productId);
        if (!this.isEditMode() && this.account().productId) {
          this.loadProductOverdraftConfig(this.account().productId, true);
        }
      },
      error: () => this.notifications.error('Operation failed. Please try again.'),
    });
  }

  /**
   * Chooses a product, and takes its interest rate and overdraft rules with it.
   */
  onProductChanged(productId: number | undefined): void {
    this.account.update((account) => ({ ...account, productId }));
    this.prefillRateFromProduct(productId);
    this.loadProductOverdraftConfig(productId, true);
  }

  onAllowOverdraftChanged(value: boolean): void {
    this.allowOverdraft.set(Boolean(value));
  }

  onOverdraftLimitChanged(value: unknown): void {
    this.overdraftLimit.set(
      value === '' || value === null || value === undefined ? null : Number(value),
    );
  }

  onNominalAnnualInterestRateOverdraftChanged(value: unknown): void {
    this.nominalAnnualInterestRateOverdraft.set(
      value === '' || value === null || value === undefined ? null : Number(value),
    );
  }

  onMinOverdraftForInterestCalculationChanged(value: unknown): void {
    this.minOverdraftForInterestCalculation.set(
      value === '' || value === null || value === undefined ? null : Number(value),
    );
  }

  private loadProductOverdraftConfig(productId: number | undefined, applyPrefill: boolean): void {
    if (productId === undefined || productId === null) {
      this.productAllowsOverdraft.set(false);
      this.productOverdraftMax.set(null);
      return;
    }

    this.productService.getSavingsproductsProductId(productId).subscribe({
      next: (product) => {
        const allowsOverdraft = Boolean(product.allowOverdraft);
        this.productAllowsOverdraft.set(allowsOverdraft);
        this.productOverdraftMax.set(
          typeof product.overdraftLimit === 'number' && product.overdraftLimit > 0
            ? product.overdraftLimit
            : null,
        );

        if (applyPrefill && allowsOverdraft && !this.isEditMode()) {
          this.allowOverdraft.set(true);
          this.overdraftLimit.set(product.overdraftLimit ?? null);
          this.nominalAnnualInterestRateOverdraft.set(
            product.nominalAnnualInterestRateOverdraft ?? null,
          );
          this.minOverdraftForInterestCalculation.set(
            product.minOverdraftForInterestCalculation ?? null,
          );
        }
      },
      error: () => {
        this.productAllowsOverdraft.set(false);
        this.productOverdraftMax.set(null);
      },
    });
  }

  /** A rate the user types stands, including a deliberate 0%, which is a rate an institution may mean. */
  onInterestRateChanged(value: unknown): void {
    this.interestRate.set(
      value === '' || value === null || value === undefined ? null : Number(value),
    );
  }

  private prefillRateFromProduct(productId: number | undefined): void {
    if (productId === undefined || productId === null) return;
    const product = this.products().find((candidate) => candidate.id === productId);
    if (!product) return;
    this.interestRate.set(product.nominalAnnualInterestRate ?? null);
  }

  private loadAccountData(): void {
    if (!this.accountId) return;
    this.savingsService.getSavingsaccountsAccountId(this.accountId).subscribe({
      next: (data: SavingsAccountData) => {
        const dateArray = data.timeline?.submittedOnDate as unknown as number[];
        if (dateArray) {
          this.submittedOnDate.set(formatArrayDate(dateArray));
        }
        const productId = data.savingsProductId ?? data.productId;
        this.account.set({
          clientId: data.clientId,
          productId,
        });
        // `?? null`, not `|| 0`: an account deliberately opened at 0% must stay at 0% when it
        // is edited, and an account with no override must not acquire one.
        this.interestRate.set(data.nominalAnnualInterestRate ?? null);

        // On edit, prefill overdraft fields from SavingsAccountData
        this.allowOverdraft.set(Boolean(data.allowOverdraft));
        this.overdraftLimit.set(data.overdraftLimit ?? null);
        this.nominalAnnualInterestRateOverdraft.set(
          data.nominalAnnualInterestRateOverdraft ?? null,
        );
        this.minOverdraftForInterestCalculation.set(
          data.minOverdraftForInterestCalculation ?? null,
        );

        if (productId) {
          this.loadProductOverdraftConfig(productId, false);
        }
      },
      error: () => this.notifications.error('Operation failed. Please try again.'),
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);

    this.account().submittedOnDate = formatDateToFineract(this.submittedOnDate());
    this.account().dateFormat = FINERACT_DATE_FORMAT;
    this.account().locale = FINERACT_LOCALE;

    // Cast to SavingsAccountFormPayload to support properties omitted in generated OpenAPI models.
    const rate = this.interestRate();

    const canEditOverdraft = !this.isEditMode() || this.hasUpdatePermission();
    const overdraftPayload: Partial<SavingsAccountFormPayload> =
      this.productAllowsOverdraft() && canEditOverdraft
        ? this.allowOverdraft()
          ? {
              allowOverdraft: true,
              overdraftLimit: this.overdraftLimit() ?? undefined,
              nominalAnnualInterestRateOverdraft:
                this.nominalAnnualInterestRateOverdraft() ?? undefined,
              minOverdraftForInterestCalculation:
                this.minOverdraftForInterestCalculation() ?? undefined,
            }
          : this.isEditMode()
            ? { allowOverdraft: false }
            : {}
        : {};

    const payload: SavingsAccountFormPayload = {
      ...this.account(),
      ...(rate === null ? {} : { nominalAnnualInterestRate: rate }),
      ...overdraftPayload,
    };

    if (this.isEditMode() && this.accountId) {
      this.savingsService
        .putSavingsaccountsAccountId(this.accountId, payload as Record<string, unknown>)
        .subscribe({
          next: (response) => {
            this.isSaving.set(false);
            this.mutationOutcome.complete({
              response,
              successMessage: this.i18n.translate('SAVINGS.UPDATE_SUCCESS'),
              recordRoute: (id) => ['/products/savings-accounts/view', id],
              recordId: this.accountId ?? undefined,
              fallbackRoute: [this.LIST_PATH],
            });
          },
          error: () => this.isSaving.set(false),
        });
    } else {
      this.savingsService.postSavingsaccounts(payload as PostSavingsAccountsRequest).subscribe({
        next: (response) => {
          this.isSaving.set(false);
          this.mutationOutcome.complete({
            response,
            successMessage: this.i18n.translate('SAVINGS.CREATE_SUCCESS'),
            recordRoute: (id) => ['/products/savings-accounts/view', id],
            fallbackRoute: [this.LIST_PATH],
          });
        },
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
