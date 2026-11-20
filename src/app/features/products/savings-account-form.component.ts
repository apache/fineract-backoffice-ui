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
import { PlatformDateService } from '../../core/services/platform-date.service';
import { FormsModule } from '@angular/forms';
import { I18N, TranslatePipe } from '../../core/adapters';
import { ClientSearchComponent } from '../../shared/components/client-search/client-search.component';
import { MutationOutcomeService } from '../../core/services/mutation-outcome.service';
import { NotificationService } from '../../core/services/notification.service';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
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
    IonSelectOption,
    IonSelect,
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

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="accountForm.invalid || isSaving()"
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
      },
      error: () => this.notifications.error('Operation failed. Please try again.'),
    });
  }

  /**
   * Chooses a product, and takes its interest rate with it.
   *
   * The rate comes out of the product list this form has already loaded: `GET /savingsproducts`
   * carries each product's `nominalAnnualInterestRate` — measured, a product configured at 3.75%
   * reports 3.75 there — so no extra request is needed. (The *deposit* product lists are the
   * opposite case, reporting `0` for every product because a term deposit's rate lives in its
   * chart; see `DepositProductSummary`.)
   */
  onProductChanged(productId: number | undefined): void {
    this.account.update((account) => ({ ...account, productId }));
    this.prefillRateFromProduct(productId);
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
        this.account.set({
          clientId: data.clientId,
          productId: data.savingsProductId,
        });
        // `?? null`, not `|| 0`: an account deliberately opened at 0% must stay at 0% when it
        // is edited, and an account with no override must not acquire one.
        this.interestRate.set(data.nominalAnnualInterestRate ?? null);
      },
      error: () => this.notifications.error('Operation failed. Please try again.'),
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);

    this.account().submittedOnDate = formatDateToFineract(this.submittedOnDate());
    this.account().dateFormat = FINERACT_DATE_FORMAT;
    this.account().locale = FINERACT_LOCALE;

    // Cast to Record to add missing properties to the payload.
    //
    // The rate is sent only when there is one. Fineract treats it as an account-level override,
    // so omitting it is how the account is opened at the product's own rate — and sending `0`
    // because the form had no value is how every account came to earn nothing (#761).
    const rate = this.interestRate();
    const payload: Record<string, unknown> = {
      ...this.account(),
      ...(rate === null ? {} : { nominalAnnualInterestRate: rate }),
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
