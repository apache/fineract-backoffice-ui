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

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IonButton, IonInput, IonItem, IonLabel, IonSpinner, ModalController } from '@ionic/angular/standalone';
import { LoanProductsService, PostLoanProductsRequest } from '../../api';
import { LOAN_SCHEDULE_TYPE } from './loan-schedule-type';
import { NotificationService } from '../../core/services/notification.service';

const OPERATION_FAILED_MESSAGE = 'Operation failed. Please try again.';

@Component({
  selector: 'app-loan-product-quick-create-dialog',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonSpinner,
  ],
  template: `
    <h2 class="dialog-title">
      {{ 'PRODUCTS.CREATE_LOAN_PRODUCT' | translate }}
    </h2>
    <div class="dialog-content">
      <form #productForm="ngForm" (ngSubmit)="onSubmit()" class="quick-create-form">
        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'COMMON.NAME' | translate }}</ion-label>
          <ion-input
            [attr.aria-label]="'COMMON.NAME' | translate"
            id="quick-product-name"
            data-testid="quick-product-name"
            name="name"
            [(ngModel)]="name"
            required
            placeholder="{{ 'COMMON.NAME' | translate }}"
          ></ion-input>
        </ion-item>

        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'PRODUCTS.SHORT_NAME' | translate }}</ion-label>
          <ion-input
            [attr.aria-label]="'PRODUCTS.SHORT_NAME' | translate"
            id="quick-product-short-name"
            data-testid="quick-product-short-name"
            name="shortName"
            [(ngModel)]="shortName"
            required
            maxlength="4"
            placeholder="{{ 'PRODUCTS.SHORT_NAME' | translate }}"
          ></ion-input>
        </ion-item>

        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'PRODUCTS.PRINCIPAL' | translate }}</ion-label>
          <ion-input
            [attr.aria-label]="'PRODUCTS.PRINCIPAL' | translate"
            id="quick-product-principal"
            data-testid="quick-product-principal"
            type="number"
            name="principal"
            [(ngModel)]="principal"
            required
          ></ion-input>
        </ion-item>

        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'PRODUCTS.INTEREST_RATE' | translate }}</ion-label>
          <ion-input
            [attr.aria-label]="'PRODUCTS.INTEREST_RATE' | translate"
            id="quick-product-interest-rate"
            data-testid="quick-product-interest-rate"
            type="number"
            name="interestRatePerPeriod"
            [(ngModel)]="interestRatePerPeriod"
            required
          ></ion-input>
        </ion-item>

        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'LOANS.REPAYMENTS_COUNT' | translate }}</ion-label>
          <ion-input
            [attr.aria-label]="'LOANS.REPAYMENTS_COUNT' | translate"
            id="quick-product-repayments-count"
            data-testid="quick-product-repayments-count"
            type="number"
            name="numberOfRepayments"
            [(ngModel)]="numberOfRepayments"
            required
          ></ion-input>
        </ion-item>

        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'LOANS.REPAYMENT_EVERY' | translate }}</ion-label>
          <ion-input
            [attr.aria-label]="'LOANS.REPAYMENT_EVERY' | translate"
            id="quick-product-repayment-every"
            data-testid="quick-product-repayment-every"
            type="number"
            name="repaymentEvery"
            [(ngModel)]="repaymentEvery"
            required
          ></ion-input>
        </ion-item>
      </form>
    </div>
    <div class="dialog-actions">
      <ion-button fill="clear" (click)="onCancel()" [disabled]="isSaving()">
        {{ 'COMMON.CANCEL' | translate }}
      </ion-button>
      <ion-button
        color="primary"
        [disabled]="productForm.invalid || isSaving()"
        (click)="onSubmit()"
      >
        @if (isSaving()) {
          <ion-spinner name="crescent" slot="start"></ion-spinner>
          {{ 'COMMON.SAVING' | translate }}
        } @else {
          {{ 'COMMON.SAVE' | translate }}
        }
      </ion-button>
    </div>
  `,
  styles: [
    `
      .quick-create-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding-top: 8px;
        min-width: 360px;
      }
      .full-width {
        width: 100%;
      }
      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 16px;
      }
    `,
  ],
})
export class LoanProductQuickCreateDialogComponent {
  private readonly productService = inject(LoanProductsService);
  private readonly modalController = inject(ModalController);
  private readonly notifications = inject(NotificationService);

  name = '';
  shortName = '';
  principal: number | null = null;
  interestRatePerPeriod: number | null = null;
  numberOfRepayments: number | null = null;
  repaymentEvery: number | null = null;

  readonly isSaving = signal(false);

  onSubmit(): void {
    if (
      !this.name ||
      !this.shortName ||
      this.principal === null ||
      this.interestRatePerPeriod === null ||
      this.numberOfRepayments === null ||
      this.repaymentEvery === null
    ) {
      return;
    }

    this.isSaving.set(true);

    const request: PostLoanProductsRequest = {
      name: this.name,
      shortName: this.shortName,
      principal: this.principal,
      interestRatePerPeriod: this.interestRatePerPeriod,
      numberOfRepayments: this.numberOfRepayments,
      repaymentEvery: this.repaymentEvery,

      // Fixed defaults copied from loan-product-form.component.ts's product signal
      currencyCode: 'USD',
      digitsAfterDecimal: 2,
      inMultiplesOf: 0,
      repaymentFrequencyType: 2,
      interestRateFrequencyType: 3,
      amortizationType: 1,
      interestType: 0,
      interestCalculationPeriodType: 1,
      loanScheduleType: LOAN_SCHEDULE_TYPE.CUMULATIVE,
      transactionProcessingStrategyCode: 'mifos-standard-strategy',
      accountingRule: 1,
      daysInYearType: 1,
      daysInMonthType: 1,
      isInterestRecalculationEnabled: false,
      locale: 'en',
    };

    this.productService.postLoanproducts(request).subscribe({
      next: (response) => {
        this.modalController.dismiss({ id: response.resourceId, ...response });
      },
      error: () => {
        this.notifications.error(OPERATION_FAILED_MESSAGE);
        this.isSaving.set(false);
      },
    });
  }

  onCancel(): void {
    this.modalController.dismiss();
  }
}
