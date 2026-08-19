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
import { ClientSearchComponent } from '../../shared/components/client-search/client-search.component';
import {
  LoansService,
  PostLoansRequest,
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
} from '@ionic/angular/standalone';
import {
  formatArrayDate,
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  toIsoDate,
} from '../../core/utils/date-formatter';

const OPERATION_FAILED_MESSAGE = 'Operation failed. Please try again.';

@Component({
  selector: 'app-loan-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
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
            {{ isEditMode() ? ('LOANS.EDIT_LOAN' | translate) : ('LOANS.CREATE_LOAN' | translate) }}
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
                    [label]="'COMMON.CLIENT_ID' | translate"
                    [required]="true"
                    [initialClientId]="loan().clientId || null"
                    (clientSelected)="loan().clientId = $event"
                    class="flex-grow"
                  >
                  </app-client-search>
                  <ion-button
                    fill="clear"
                    type="button"
                    [attr.aria-label]="'CLIENTS.CREATE_CLIENT' | translate"
                    [appTooltip]="'CLIENTS.CREATE_CLIENT' | translate"
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
                    [appTooltip]="'HELP.LOAN_PRODUCT_DESC' | translate"
                    class="flex-grow"
                  >
                    <ion-label position="stacked">{{ 'LOANS.PRODUCT' | translate }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'LOANS.PRODUCT' | translate"
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
                    [attr.aria-label]="'PRODUCTS.CREATE_LOAN_PRODUCT' | translate"
                    [appTooltip]="'PRODUCTS.CREATE_LOAN_PRODUCT' | translate"
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
                      <ion-chip [appTooltip]="'HELP.LOAN_SCHEDULE_TYPE_DESC' | translate">
                        {{ 'PRODUCTS.LOAN_SCHEDULE_TYPE' | translate }}: {{ scheduleType }}
                      </ion-chip>
                    </div>
                  </div>
                }

                <!-- Principal -->
                <ion-item fill="outline" [appTooltip]="'HELP.PRINCIPAL_DESC' | translate">
                  <ion-label position="stacked">{{ 'LOANS.PRINCIPAL' | translate }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.PRINCIPAL' | translate"
                    type="number"
                    name="principal"
                    [(ngModel)]="loan().principal"
                    required
                  ></ion-input>
                </ion-item>

                <!-- External ID -->
                <ion-item fill="outline" [appTooltip]="'HELP.EXTERNAL_ID_DESC' | translate">
                  <ion-label position="stacked">{{ 'COMMON.EXTERNAL_ID' | translate }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'COMMON.EXTERNAL_ID' | translate"
                    name="externalId"
                    [(ngModel)]="loan().externalId"
                  ></ion-input>
                </ion-item>

                <!-- Submitted On -->
                <ion-item fill="outline" [appTooltip]="'HELP.SUBMITTED_ON_DESC' | translate">
                  <ion-label position="stacked">{{ 'COMMON.SUBMITTED_ON' | translate }}</ion-label>
                  <ion-datetime-button datetime="submittedOnDate-picker"></ion-datetime-button>
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
                  [appTooltip]="'HELP.EXPECTED_DISBURSEMENT_DESC' | translate"
                >
                  <ion-label position="stacked">{{
                    'LOANS.EXPECTED_DISBURSEMENT' | translate
                  }}</ion-label>
                  <ion-datetime-button
                    datetime="expectedDisbursementDate-picker"
                  ></ion-datetime-button>
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
                <ion-item fill="outline" [appTooltip]="'HELP.TERM_FREQUENCY_DESC' | translate">
                  <ion-label position="stacked">{{ 'LOANS.TERM_FREQUENCY' | translate }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.TERM_FREQUENCY' | translate"
                    type="number"
                    name="loanTermFrequency"
                    [(ngModel)]="loan().loanTermFrequency"
                    required
                  ></ion-input>
                </ion-item>

                <!-- Term Type -->
                <ion-item fill="outline" [appTooltip]="'HELP.TERM_TYPE_DESC' | translate">
                  <ion-label position="stacked">{{ 'LOANS.TERM_TYPE' | translate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'LOANS.TERM_TYPE' | translate"
                    interface="popover"
                    name="loanTermFrequencyType"
                    [(ngModel)]="loan().loanTermFrequencyType"
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

                <!-- Number of Repayments -->
                <ion-item fill="outline" [appTooltip]="'HELP.REPAYMENTS_COUNT_DESC' | translate">
                  <ion-label position="stacked">{{
                    'LOANS.REPAYMENTS_COUNT' | translate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.REPAYMENTS_COUNT' | translate"
                    type="number"
                    name="numberOfRepayments"
                    [(ngModel)]="loan().numberOfRepayments"
                    required
                  ></ion-input>
                </ion-item>

                <!-- Repayment Every -->
                <ion-item fill="outline" [appTooltip]="'HELP.REPAYMENT_EVERY_DESC' | translate">
                  <ion-label position="stacked">{{
                    'LOANS.REPAYMENT_EVERY' | translate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.REPAYMENT_EVERY' | translate"
                    type="number"
                    name="repaymentEvery"
                    [(ngModel)]="loan().repaymentEvery"
                    required
                  ></ion-input>
                </ion-item>

                <!-- Repayment Frequency Type -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'COMMON.FREQUENCY' | translate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'COMMON.FREQUENCY' | translate"
                    interface="popover"
                    name="repaymentFrequencyType"
                    [(ngModel)]="loan().repaymentFrequencyType"
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
                  </ion-select>
                </ion-item>

                <!-- Interest Rate Per Period -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'COMMON.INTEREST_RATE' | translate }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'COMMON.INTEREST_RATE' | translate"
                    type="number"
                    name="interestRatePerPeriod"
                    [(ngModel)]="loan().interestRatePerPeriod"
                    required
                  ></ion-input>
                </ion-item>

                <!-- Interest Type -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'PRODUCTS.INTEREST_TYPE' | translate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'PRODUCTS.INTEREST_TYPE' | translate"
                    interface="popover"
                    name="interestType"
                    [(ngModel)]="loan().interestType"
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

                <!-- Amortization Type -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'PRODUCTS.AMORTIZATION_TYPE' | translate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'PRODUCTS.AMORTIZATION_TYPE' | translate"
                    interface="popover"
                    name="amortizationType"
                    [(ngModel)]="loan().amortizationType"
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

                <!-- Interest Calculation Period Type -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'PRODUCTS.INTEREST_CALCULATION_PERIOD_TYPE' | translate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'PRODUCTS.INTEREST_CALCULATION_PERIOD_TYPE' | translate"
                    interface="popover"
                    name="interestCalculationPeriodType"
                    [(ngModel)]="loan().interestCalculationPeriodType"
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

                <!-- Grace on Principal Payment -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'LOANS.GRACE_ON_PRINCIPAL_PAYMENT' | translate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.GRACE_ON_PRINCIPAL_PAYMENT' | translate"
                    type="number"
                    name="graceOnPrincipalPayment"
                    [(ngModel)]="loan().graceOnPrincipalPayment"
                  ></ion-input>
                </ion-item>

                <!-- Grace on Interest Payment -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'LOANS.GRACE_ON_INTEREST_PAYMENT' | translate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.GRACE_ON_INTEREST_PAYMENT' | translate"
                    type="number"
                    name="graceOnInterestPayment"
                    [(ngModel)]="loan().graceOnInterestPayment"
                  ></ion-input>
                </ion-item>

                <!-- Grace on Interest Charged -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'LOANS.GRACE_ON_INTEREST_CHARGED' | translate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.GRACE_ON_INTEREST_CHARGED' | translate"
                    type="number"
                    name="graceOnInterestCharged"
                    [(ngModel)]="loan().graceOnInterestCharged"
                  ></ion-input>
                </ion-item>

                <!-- In Arrears Tolerance -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'LOANS.IN_ARREARS_TOLERANCE' | translate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'LOANS.IN_ARREARS_TOLERANCE' | translate"
                    type="number"
                    name="inArrearsTolerance"
                    [(ngModel)]="loan().inArrearsTolerance"
                  ></ion-input>
                </ion-item>

                <!-- Repayments Starting From Date -->
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'LOANS.REPAYMENTS_STARTING_FROM_DATE' | translate
                  }}</ion-label>
                  <ion-datetime-button
                    datetime="repaymentsStartingFromDate-picker"
                  ></ion-datetime-button>
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="repaymentsStartingFromDate-picker"
                        data-testid="repaymentsStartingFromDate-picker"
                        presentation="date"
                        name="repaymentsStartingFromDate"
                        [(ngModel)]="repaymentsStartingFromDate"
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>

                @if (isProgressive()) {
                  <ion-checkbox
                    name="interestRecognitionOnDisbursementDate"
                    [(ngModel)]="loan().interestRecognitionOnDisbursementDate"
                  >
                    {{ 'LOANS.INTEREST_RECOGNITION_ON_DISBURSEMENT_DATE' | translate }}
                  </ion-checkbox>
                }

                @if (isProgressive() && selectedProductDetails()?.multiDisburseLoan) {
                  <ion-checkbox
                    name="allowFullTermForTranche"
                    [(ngModel)]="loan().allowFullTermForTranche"
                  >
                    {{ 'LOANS.ALLOW_FULL_TERM_FOR_TRANCHE' | translate }}
                  </ion-checkbox>
                }
              </div>

              <div class="form-actions">
                <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                  {{ 'COMMON.CANCEL' | translate }}
                </ion-button>
                <ion-button
                  color="primary"
                  type="submit"
                  [disabled]="loanForm.invalid || isSaving()"
                >
                  @if (isSaving()) {
                    <ion-spinner name="crescent"></ion-spinner>
                    {{ 'COMMON.SAVING' | translate }}
                  } @else {
                    {{ 'COMMON.SAVE' | translate }}
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
        grid-template-columns: repeat(2, 1fr);
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
export class LoanFormComponent implements OnInit {
  private readonly loansService = inject(LoansService);
  private readonly productService = inject(LoanProductsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationService);

  private readonly LIST_PATH = '/loans';

  loanId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly loan = signal<PostLoansRequest>({
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
  readonly submittedOnDate = signal(toIsoDate(new Date()));
  readonly expectedDisbursementDate = signal(toIsoDate(new Date()));
  repaymentsStartingFromDate: string | null = null;
  readonly products = signal<GetLoanProductsResponse[]>([]);
  readonly selectedProductDetails = signal<GetLoanProductsProductIdResponse | null>(null);

  ngOnInit() {
    this.loadProducts();

    this.route.queryParams.subscribe((queryParams) => {
      const clientId = queryParams['clientId'];
      if (clientId) {
        this.loan().clientId = +clientId;
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
      next: (data: GetLoanProductsProductIdResponse) => this.selectedProductDetails.set(data),
      error: () => this.notifications.error(OPERATION_FAILED_MESSAGE),
    });
  }

  isProgressive(): boolean {
    return this.selectedProductDetails()?.loanScheduleType?.code === LOAN_SCHEDULE_TYPE.PROGRESSIVE;
  }

  private loadLoanData() {
    if (!this.loanId) return;
    this.loansService.getLoansLoanId(this.loanId).subscribe({
      next: (data: GetLoansLoanIdResponse) => {
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
        });
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

  onSubmit() {
    this.isSaving.set(true);

    this.loan().submittedOnDate = formatDateToFineract(this.submittedOnDate());
    this.loan().expectedDisbursementDate = formatDateToFineract(this.expectedDisbursementDate());
    if (this.repaymentsStartingFromDate) {
      this.loan().repaymentsStartingFromDate = formatDateToFineract(
        this.repaymentsStartingFromDate,
      );
    }
    this.loan().dateFormat = FINERACT_DATE_FORMAT;
    this.loan().locale = FINERACT_LOCALE;

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
          next: () => this.router.navigate([this.LIST_PATH]),
          error: () => this.isSaving.set(false),
        });
    } else {
      this.loansService.postLoans(this.loan()).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel() {
    this.router.navigate([this.LIST_PATH]);
  }
}
