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
import { TranslatePipe } from '../../core/adapters';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonBadge,
  IonIcon,
} from '@ionic/angular/standalone';
import { LoanProductsService, GetLoanProductsProductIdResponse } from '../../api';
import { LOAN_SCHEDULE_TYPE } from './loan-schedule-type';

@Component({
  selector: 'app-loan-product-view',
  standalone: true,
  imports: [
    TranslatePipe,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonBadge,
    IonIcon,
  ],
  template: `
    @if (product()) {
      <div class="view-container">
        <ion-card class="header-card">
          <ion-card-content class="header-content">
            <div>
              <h2>{{ product()!.name }}</h2>
              <span class="short-name">{{ product()!.shortName }}</span>
            </div>
            <div class="actions-area">
              <ion-button color="primary" (click)="onEdit()">
                <ion-icon name="create-outline" slot="start"></ion-icon>
                {{ 'COMMON.EDIT' | appTranslate }}
              </ion-button>
              <ion-button fill="clear" color="medium" (click)="onBack()">
                <ion-icon name="arrow-back-outline" slot="start"></ion-icon>
                {{ 'COMMON.BACK' | appTranslate }}
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ 'COMMON.DETAILS' | appTranslate }}</ion-card-title>
          </ion-card-header>
          <ion-card-content class="details-list">
            <div class="detail-item">
              <span class="label">{{ 'PRODUCTS.CURRENCY' | appTranslate }}</span>
              <span class="value">{{ product()!.currency?.code }}</span>
            </div>
            <div class="detail-item">
              <span class="label">{{ 'PRODUCTS.PRINCIPAL' | appTranslate }}</span>
              <span class="value">{{ product()!.principal }}</span>
            </div>
            <div class="detail-item">
              <span class="label">{{ 'PRODUCTS.INTEREST_RATE' | appTranslate }}</span>
              <span class="value"
                >{{ product()!.interestRatePerPeriod }}
                {{ product()!.interestRateFrequencyType?.description }}</span
              >
            </div>
            <div class="detail-item">
              <span class="label">{{ 'LOANS.REPAYMENTS_COUNT' | appTranslate }}</span>
              <span class="value">{{ product()!.numberOfRepayments }}</span>
            </div>
            <div class="detail-item">
              <span class="label">{{ 'LOANS.REPAYMENT_EVERY' | appTranslate }}</span>
              <span class="value"
                >{{ product()!.repaymentEvery }}
                {{ product()!.repaymentFrequencyType?.description }}</span
              >
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ 'PRODUCTS.LOAN_SCHEDULE_TYPE' | appTranslate }}</ion-card-title>
          </ion-card-header>
          <ion-card-content class="details-list">
            <div class="detail-item">
              <span class="label">{{ 'PRODUCTS.LOAN_SCHEDULE_TYPE' | appTranslate }}</span>
              <span class="value">
                <ion-badge [color]="isProgressive() ? 'tertiary' : 'primary'">
                  {{ product()!.loanScheduleType?.value }}
                </ion-badge>
              </span>
            </div>
            <div class="detail-item">
              <span class="label">{{
                'PRODUCTS.TRANSACTION_PROCESSING_STRATEGY' | appTranslate
              }}</span>
              <span class="value">{{ product()!.transactionProcessingStrategyName }}</span>
            </div>
            @if (isProgressive()) {
              <div class="detail-item">
                <span class="label">{{
                  'PRODUCTS.LOAN_SCHEDULE_PROCESSING_TYPE' | appTranslate
                }}</span>
                <span class="value">{{ product()!.loanScheduleProcessingType?.value }}</span>
              </div>
            }
          </ion-card-content>
        </ion-card>

        @if (isProgressive() && product()!.paymentAllocation?.length) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ 'PRODUCTS.PAYMENT_ALLOCATION' | appTranslate }}</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              @for (rule of product()!.paymentAllocation; track rule.transactionType) {
                <div class="allocation-rule">
                  <strong>{{ rule.transactionType }}</strong>
                  <span class="future-rule"
                    >({{ 'PRODUCTS.FUTURE_INSTALLMENT_ALLOCATION_RULE' | appTranslate }}:
                    {{ rule.futureInstallmentAllocationRule }})</span
                  >
                  <ol class="order-list">
                    @for (order of rule.paymentAllocationOrder; track order.paymentAllocationRule) {
                      <li>{{ order.paymentAllocationRule }}</li>
                    }
                  </ol>
                </div>
              }
            </ion-card-content>
          </ion-card>
        }

        @if (isProgressive() && product()!.creditAllocation?.length) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ 'PRODUCTS.CREDIT_ALLOCATION' | appTranslate }}</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              @for (rule of product()!.creditAllocation; track rule.transactionType) {
                <div class="allocation-rule">
                  <strong>{{ rule.transactionType }}</strong>
                  <ol class="order-list">
                    @for (order of rule.creditAllocationOrder; track order.creditAllocationRule) {
                      <li>{{ order.creditAllocationRule }}</li>
                    }
                  </ol>
                </div>
              }
            </ion-card-content>
          </ion-card>
        }
      </div>
    }
  `,
  styles: [
    `
      .view-container {
        padding: 24px;
        max-width: 900px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .short-name {
        color: #777;
      }
      .actions-area {
        display: flex;
        gap: 12px;
      }
      .details-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .detail-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #eee;
        padding-bottom: 8px;
      }
      .label {
        color: #777;
      }
      .value {
        font-weight: 600;
      }
      .allocation-rule {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
      }
      .future-rule {
        color: #777;
        margin-left: 8px;
        font-weight: normal;
      }
      .order-list {
        margin: 8px 0 0;
        padding-left: 20px;
      }
    `,
  ],
})
export class LoanProductViewComponent implements OnInit {
  private readonly productService = inject(LoanProductsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  productId = 0;
  readonly product = signal<GetLoanProductsProductIdResponse | null>(null);

  ngOnInit(): void {
    this.productId = Number(this.route.snapshot.paramMap.get('id'));
    this.productService.getLoanproductsProductId(this.productId).subscribe((data) => {
      this.product.set(data);
    });
  }

  isProgressive(): boolean {
    return this.product()?.loanScheduleType?.code === LOAN_SCHEDULE_TYPE.PROGRESSIVE;
  }

  onEdit(): void {
    this.router.navigate(['/products/loan/edit', this.productId]);
  }

  onBack(): void {
    this.router.navigate(['/products/loan']);
  }
}
