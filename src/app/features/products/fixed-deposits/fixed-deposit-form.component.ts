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
import { ClientSearchComponent } from '../../../shared/components/client-search/client-search.component';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
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
  IonNote,
} from '@ionic/angular/standalone';
import {
  FixedDepositAccountService,
  FixedDepositProductService,
  GetFixedDepositAccountsTemplateResponse,
  GetFixedDepositAccountsAccountIdResponse,
  GetFixedDepositAccountsProductOptions,
  PostFixedDepositAccountsRequest,
  PutFixedDepositAccountsAccountIdRequest,
} from '../../../api';
import {
  formatArrayDate,
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  toIsoDate,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';
import { DepositChartSlab, rateForTerm, slabsFromResponse } from '../deposit-chart';

/**
 * Months. The frequency select defaults to it, and so does the rate lookup when a product's
 * template states no unit for its minimum term.
 */
const DEFAULT_PERIOD_FREQUENCY = 2;

/** `depositAccountClosureType.transferToSavings`, as a maturity instruction. */
const TRANSFER_TO_SAVINGS = 200;

/** A savings account of the same client, as the account template lists one. */
export interface LinkableSavingsAccount {
  readonly id?: number;
  readonly accountNo?: string;
  readonly status?: { readonly active?: boolean };
}

/** `maturityInstructionOptions`: what happens to the money when the deposit matures. */
export interface MaturityInstructionOption {
  readonly id?: number;
  readonly code?: string;
  readonly value?: string;
}

/**
 * Component for creating and managing individual fixed deposit accounts.
 *
 * Provides a comprehensive form integration with Fineract's term deposit API.
 * Uses template-driven binding to strictly-typed OpenAPI request models.
 */
@Component({
  selector: 'app-fixed-deposit-form',
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
    IonNote,
    TooltipDirective,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('FIXED_DEPOSITS.EDIT' | appTranslate)
                : ('FIXED_DEPOSITS.CREATE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #accountForm="ngForm" (ngSubmit)="onSubmit()" class="fixed-deposit-form">
            <div class="form-grid">
              <!-- Client Search with Create Option -->
              <div class="field-container-row">
                <app-client-search
                  [label]="'COMMON.CLIENT' | appTranslate"
                  [required]="true"
                  [initialClientId]="getClientId()"
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

              <!-- Product with Create Option -->
              <div class="field-container-row">
                <ion-item
                  fill="outline"
                  [appTooltip]="'HELP.FIXED_DEPOSIT_PRODUCT_DESC' | appTranslate"
                  class="flex-grow"
                >
                  <ion-label position="stacked">{{ 'COMMON.PRODUCT' | appTranslate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'COMMON.PRODUCT' | appTranslate"
                    interface="popover"
                    name="productId"
                    [(ngModel)]="account()['productId']"
                    (ngModelChange)="onProductSelected($event)"
                    required
                    [disabled]="isEditMode()"
                  >
                    @for (product of products(); track product['id']) {
                      <ion-select-option [value]="product['id']">{{
                        product['name']
                      }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
                <ion-button
                  fill="clear"
                  type="button"
                  [attr.aria-label]="'PRODUCTS.CREATE_FIXED_DEPOSIT_PRODUCT' | appTranslate"
                  [appTooltip]="'PRODUCTS.CREATE_FIXED_DEPOSIT_PRODUCT' | appTranslate"
                  (click)="onCreateProduct()"
                  style="margin-top: 4px;"
                  [disabled]="isEditMode()"
                >
                  <ion-icon color="primary" name="add-circle-outline"></ion-icon>
                </ion-button>
              </div>

              <!-- Deposit Amount -->
              <ion-item fill="outline" [appTooltip]="'HELP.DEPOSIT_AMOUNT_DESC' | appTranslate">
                <ion-label position="stacked">{{ 'COMMON.AMOUNT' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.AMOUNT' | appTranslate"
                  type="number"
                  name="depositAmount"
                  [(ngModel)]="account()['depositAmount']"
                  required
                ></ion-input>
              </ion-item>

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

              <!-- Deposit Period -->
              <ion-item fill="outline" [appTooltip]="'HELP.DEPOSIT_PERIOD_DESC' | appTranslate">
                <ion-label position="stacked">{{ 'COMMON.PERIOD' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.PERIOD' | appTranslate"
                  type="number"
                  name="depositPeriod"
                  [(ngModel)]="account()['depositPeriod']"
                  (ngModelChange)="onTermChanged()"
                  required
                ></ion-input>
              </ion-item>

              <!-- Period Frequency -->
              <ion-item fill="outline" [appTooltip]="'HELP.PERIOD_FREQUENCY_DESC' | appTranslate">
                <ion-label position="stacked">{{ 'COMMON.FREQUENCY' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'COMMON.FREQUENCY' | appTranslate"
                  interface="popover"
                  name="depositPeriodFrequencyId"
                  [(ngModel)]="account()['depositPeriodFrequencyId']"
                  (ngModelChange)="onTermChanged()"
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

              <!-- Nominal Annual Interest Rate -->
              <ion-item
                fill="outline"
                [appTooltip]="'HELP.NOMINAL_ANNUAL_INTEREST_RATE_DESC' | appTranslate"
              >
                <ion-label position="stacked">{{
                  'COMMON.INTEREST_RATE' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.INTEREST_RATE' | appTranslate"
                  type="number"
                  name="nominalAnnualInterestRate"
                  [(ngModel)]="account()['nominalAnnualInterestRate']"
                ></ion-input>
                <span slot="end">%</span>
              </ion-item>
            </div>

            <!-- #783. What happens when the deposit matures, and which savings account funds
                 it. Both are offered only once a product is chosen, because the options come
                 from that product's template. -->
            @if (maturityInstructions().length) {
              <div class="form-grid">
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'DEPOSITS.MATURITY_INSTRUCTION' | appTranslate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'DEPOSITS.MATURITY_INSTRUCTION' | appTranslate"
                    interface="popover"
                    data-testid="maturityInstructionId"
                    name="maturityInstructionId"
                    [(ngModel)]="account()['maturityInstructionId']"
                  >
                    @for (option of maturityInstructions(); track option.id) {
                      <ion-select-option [value]="option.id">{{ option.value }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>

                <!-- Mandatory once the instruction is "transfer to savings": the platform
                     answers that the transferToSavingsId parameter is mandatory. -->
                @if (transfersAtMaturity()) {
                  <ion-item fill="outline">
                    <ion-label position="stacked"
                      >{{ 'DEPOSITS.TRANSFER_TO_SAVINGS' | appTranslate }}
                      <span class="required-marker" aria-hidden="true">*</span></ion-label
                    >
                    <ion-select
                      [attr.aria-label]="'DEPOSITS.TRANSFER_TO_SAVINGS' | appTranslate"
                      interface="popover"
                      data-testid="transferToSavingsId"
                      name="transferToSavingsId"
                      [(ngModel)]="account()['transferToSavingsId']"
                      required
                    >
                      @for (savings of savingsAccounts(); track savings.id) {
                        <ion-select-option [value]="savings.id">{{
                          savings.accountNo
                        }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                }

                <!-- The funding account, which is what linkAccountId actually is: activation
                     debits it by the deposit amount. Labelled accordingly. -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'DEPOSITS.FUND_FROM_SAVINGS' | appTranslate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'DEPOSITS.FUND_FROM_SAVINGS' | appTranslate"
                    interface="popover"
                    data-testid="linkAccountId"
                    name="linkAccountId"
                    [(ngModel)]="account()['linkAccountId']"
                  >
                    <ion-select-option [value]="undefined">{{
                      'COMMON.NONE' | appTranslate
                    }}</ion-select-option>
                    @for (savings of savingsAccounts(); track savings.id) {
                      <ion-select-option [value]="savings.id">{{
                        savings.accountNo
                      }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
              </div>

              @if (account()['linkAccountId']) {
                <ion-note color="warning" class="funding-note" data-testid="funding-note">
                  {{ 'DEPOSITS.FUND_FROM_SAVINGS_WARNING' | appTranslate }}
                </ion-note>
              }
            }

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                data-testid="account-submit"
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
            @if (accountForm.invalid) {
              <ion-note
                color="medium"
                class="submit-hint"
                data-testid="account-submit-hint"
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
      .fixed-deposit-form {
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
export class FixedDepositAccountFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  /** Service for term deposit operations */
  private readonly fixedDepositService = inject(FixedDepositAccountService);
  // The deposit amount is on the product, not on the account template — see onProductSelected.
  private readonly productService = inject(FixedDepositProductService);
  /** Router for post-op navigation */
  private readonly router = inject(Router);
  /** Activated route for editing */
  private readonly route = inject(ActivatedRoute);

  /** Path for redirection */
  private readonly LIST_PATH = '/products/fixed-deposits';

  /** Account identifier */
  accountId: number | null = null;
  /** Edit mode flag */
  readonly isEditMode = signal(false);
  /** Save state */
  readonly isSaving = signal(false);

  /** Post request model */
  readonly account = signal<Record<string, unknown>>({
    depositPeriodFrequencyId: DEFAULT_PERIOD_FREQUENCY,
  });
  /** Submitted date for template binding */
  readonly submittedOnDate = signal(toIsoDate(new Date()));
  /** Available products list */
  readonly products = signal<GetFixedDepositAccountsProductOptions[]>([]);

  /**
   * The chosen product's rate slabs, so the rate follows the term the user enters.
   *
   * Held rather than read once because the term is editable: a 6-month and a 24-month deposit
   * under the same product can pay different rates, and the account template's own
   * `nominalAnnualInterestRate` is 0.
   */
  readonly chartSlabs = signal<DepositChartSlab[]>([]);

  /** The client's savings accounts, for the account that funds this deposit (#783). */
  readonly savingsAccounts = signal<LinkableSavingsAccount[]>([]);

  /** What happens at maturity (#783). */
  readonly maturityInstructions = signal<MaturityInstructionOption[]>([]);

  /**
   * Component initialization.
   */
  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const clientId = params['clientId'];
      if (clientId) {
        this.account()['clientId'] = +clientId;
        this.loadProducts(this.account()['clientId'] as number);
      } else {
        this.loadProducts();
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

  getClientId(): number | null {
    return (this.account()['clientId'] as number) || null;
  }

  /**
   * Fetches the list of eligible fixed deposit products for the client.
   */
  private loadProducts(clientId?: number): void {
    this.fixedDepositService.getFixeddepositaccountsTemplate(clientId).subscribe({
      next: (template: GetFixedDepositAccountsTemplateResponse) => {
        if (template && template.productOptions) {
          // Explicitly convert from Set or Array to ensure dropdown rendering
          this.products.set(Array.from(template.productOptions));
        } else {
          this.products.set([]);
        }
      },
      error: (err: unknown) => {
        console.error('Failed to load eligible products', err);
        this.products.set([]);
      },
    });
  }

  onClientSelected(clientId: number): void {
    this.account()['clientId'] = clientId;
    this.loadProducts(clientId);
  }

  /**
   * Fills the form from the chosen product.
   *
   * ## Why this reads what it reads
   *
   * The previous version read `depositAmount`, `depositPeriod`, `depositPeriodFrequency` and
   * `nominalAnnualInterestRate` off the account template. Measured against a running Fineract,
   * the template carries **none of the first three** and sends the fourth as `0` — so
   * `0 || undefined` made even that one disappear, and every field stayed empty. That is issue
   * #766: an officer had to know the product's terms by heart and then discover by trial which
   * field was blocking Save.
   *
   * What the template does carry is `minDepositTerm`, `minDepositTermType` and `accountChart`.
   * The deposit amount is on the product itself, which is why this makes two requests rather
   * than one — `productOptions` on the template lists only `{id, name, withHoldTax}`.
   *
   * The rate comes from the chart rather than being retyped, which is the point of the issue:
   * a rate entered by hand can disagree with the product, the same defect as #761 for savings.
   */
  onProductSelected(productId: number): void {
    if (!productId) return;

    this.fixedDepositService
      .getFixeddepositaccountsTemplate(this.account()['clientId'] as number, undefined, productId)
      .subscribe({
        next: (template: GetFixedDepositAccountsTemplateResponse) => {
          const raw = template as unknown as Record<string, unknown>;
          const slabs = slabsFromResponse(raw['accountChart']);
          this.chartSlabs.set(slabs);

          const termType = (raw['minDepositTermType'] as Record<string, unknown> | undefined)?.[
            'id'
          ] as number | undefined;
          const term = raw['minDepositTerm'] as number | undefined;

          this.patchAccount({
            depositPeriod: term,
            // The template's own unit for the minimum term; months when it offers none, which
            // is the unit the frequency select defaults to.
            depositPeriodFrequencyId: termType ?? DEFAULT_PERIOD_FREQUENCY,
            nominalAnnualInterestRate: rateForTerm(
              slabs,
              term,
              termType ?? DEFAULT_PERIOD_FREQUENCY,
            ),
            maturityInstructionId: raw['maturityInstructionId'],
          });

          this.savingsAccounts.set(
            Array.from((raw['savingsAccounts'] as LinkableSavingsAccount[]) ?? []),
          );
          this.maturityInstructions.set(
            Array.from((raw['maturityInstructionOptions'] as MaturityInstructionOption[]) ?? []),
          );
        },
        error: (err: unknown) => console.error('Failed to load product defaults', err),
      });

    // The deposit amount, which only the product carries.
    this.productService.getFixeddepositproductsProductId(productId).subscribe({
      next: (product) => {
        const raw = product as unknown as Record<string, unknown>;
        this.patchAccount({ depositAmount: raw['depositAmount'] });
      },
      error: (err: unknown) => console.error('Failed to load the product', err),
    });
  }

  /**
   * Writes fields into the account model.
   *
   * Through `update` rather than by mutating `account()` in place: the signal holds an object,
   * and assigning to its properties changes the value without telling anything that reads it.
   * The previous prefill mutated in place, so even a field it did resolve could fail to reach
   * the view.
   *
   * `undefined` values are skipped so a second prefill cannot blank what the user has typed.
   */
  private patchAccount(changes: Record<string, unknown>): void {
    this.account.update((account) => {
      const next = { ...account };
      for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined) next[key] = value;
      }
      return next;
    });
  }

  /**
   * Whether the chosen maturity instruction pays into a savings account.
   *
   * `transferToSavingsId` is mandatory then — measured, the platform answers "The parameter
   * `transferToSavingsId` is mandatory." — so the field appears and is required with it.
   */
  transfersAtMaturity(): boolean {
    return this.account()['maturityInstructionId'] === TRANSFER_TO_SAVINGS;
  }

  /** Recomputes the rate when the user changes the term, so the two cannot disagree. */
  onTermChanged(): void {
    const rate = rateForTerm(
      this.chartSlabs(),
      this.account()['depositPeriod'] as number | undefined,
      this.account()['depositPeriodFrequencyId'] as number | undefined,
    );
    if (rate !== undefined) this.patchAccount({ nominalAnnualInterestRate: rate });
  }

  onCreateClient(): void {
    this.router.navigate(['/clients/create']);
  }

  onCreateProduct(): void {
    this.router.navigate(['/products/fixed/create']);
  }

  /**
   * Loads existing account data for editing.
   */
  private loadAccountData(): void {
    if (!this.accountId) return;
    this.fixedDepositService.getFixeddepositaccountsAccountId(this.accountId).subscribe({
      next: (data: GetFixedDepositAccountsAccountIdResponse) => {
        const dateArray = data.timeline?.submittedOnDate as unknown as number[];
        if (dateArray) {
          this.submittedOnDate.set(formatArrayDate(dateArray));
        }
        this.account.set({
          clientId: data.clientId,
          // A fixed deposit answers `depositProductId`; `savingsProductId` is the savings
          // response's name for it and is the one the generated type declares. Reading only the
          // declared name left the product unselected on every edit.
          productId:
            ((data as unknown as Record<string, unknown>)['depositProductId'] as number) ??
            data.savingsProductId,
          depositAmount: data.depositAmount,
          depositPeriod: data.depositPeriod,
          depositPeriodFrequencyId: data.depositPeriodFrequency?.id,
          nominalAnnualInterestRate: (data as unknown as Record<string, unknown>)[
            'nominalAnnualInterestRate'
          ],
        });
      },
      error: (err: unknown) => console.error('Failed to load account', err),
    });
  }

  /**
   * Handles form submission.
   */
  onSubmit(): void {
    this.isSaving.set(true);

    this.patchAccount({
      submittedOnDate: formatDateToFineract(this.submittedOnDate()),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    });

    if (this.isEditMode() && this.accountId) {
      // Named field by field rather than spread, because an update must not resend the client
      // and product. Every field left out here is a field the update drops, so the maturity
      // instruction and the funding account are named too — see #783.
      const payload: PutFixedDepositAccountsAccountIdRequest & Record<string, unknown> = {
        depositAmount: this.account()['depositAmount'] as number,
        locale: FINERACT_LOCALE,
        dateFormat: FINERACT_DATE_FORMAT,
        depositPeriod: this.account()['depositPeriod'] as number,
        depositPeriodFrequencyId: this.account()['depositPeriodFrequencyId'] as number,
        nominalAnnualInterestRate:
          this.account()['nominalAnnualInterestRate'] != null
            ? (this.account()['nominalAnnualInterestRate'] as number)
            : undefined,
        maturityInstructionId: this.account()['maturityInstructionId'] as number | undefined,
        transferToSavingsId: this.transfersAtMaturity()
          ? (this.account()['transferToSavingsId'] as number | undefined)
          : undefined,
        linkAccountId: this.account()['linkAccountId'] as number | undefined,
        transferInterestToSavings: this.account()['transferInterestToSavings'] as
          boolean | undefined,
      };
      this.fixedDepositService.putFixeddepositaccountsAccountId(this.accountId, payload).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    } else {
      this.fixedDepositService
        .postFixeddepositaccounts(this.account() as PostFixedDepositAccountsRequest)
        .subscribe({
          next: () => this.router.navigate([this.LIST_PATH]),
          error: () => this.isSaving.set(false),
        });
    }
  }

  /**
   * Handles user cancellation.
   */
  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
