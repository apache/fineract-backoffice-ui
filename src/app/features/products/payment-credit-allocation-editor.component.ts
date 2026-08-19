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

import { computed, input, model, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonList,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonIcon,
} from '@ionic/angular/standalone';
import { EnumOptionData, AdvancedPaymentData, CreditAllocationData } from '../../api';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';

@Component({
  selector: 'app-payment-credit-allocation-editor',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonList,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonIcon,
    TooltipDirective,
  ],
  template: `
    <ion-card class="allocation-card">
      <ion-card-header>
        <ion-card-title [appTooltip]="'HELP.PAYMENT_ALLOCATION_DESC' | translate">
          {{ 'PRODUCTS.PAYMENT_ALLOCATION' | translate }}
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        @for (rule of paymentAllocation(); track rule.transactionType; let ruleIndex = $index) {
          <div class="allocation-block">
            <div class="allocation-block-header">
              <strong>{{
                transactionTypeLabel(rule.transactionType, transactionTypeOptions())
              }}</strong>
              <ion-button
                fill="clear"
                type="button"
                color="danger"
                [attr.aria-label]="'COMMON.DELETE' | translate"
                (click)="removePaymentTransactionType(ruleIndex)"
              >
                <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
              </ion-button>
            </div>

            <ion-item fill="outline" class="future-installment-field form-item">
              <ion-label position="stacked">{{
                'PRODUCTS.FUTURE_INSTALLMENT_ALLOCATION_RULE' | translate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'PRODUCTS.FUTURE_INSTALLMENT_ALLOCATION_RULE' | translate"
                interface="popover"
                [(ngModel)]="rule.futureInstallmentAllocationRule"
                [name]="'futureInstallmentRule' + ruleIndex"
                (ngModelChange)="emitPaymentAllocation()"
              >
                @for (option of futureInstallmentOptions(); track option.code) {
                  <ion-select-option [value]="option.code">{{ option.value }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-list class="allocation-order-list">
              @for (
                order of rule.paymentAllocationOrder;
                track order.paymentAllocationRule;
                let orderIndex = $index
              ) {
                <ion-item class="allocation-item">
                  <span class="order-index">{{ orderIndex + 1 }}.</span>
                  <span class="order-label">{{
                    allocationRuleLabel(order.paymentAllocationRule, allocationRuleOptions())
                  }}</span>
                  <ion-button
                    fill="clear"
                    type="button"
                    [disabled]="orderIndex === 0"
                    (click)="moveOrderEntry(rule.paymentAllocationOrder!, orderIndex, -1)"
                    [attr.aria-label]="'COMMON.MOVE_UP' | translate"
                  >
                    <ion-icon name="arrow-up-outline" slot="icon-only"></ion-icon>
                  </ion-button>
                  <ion-button
                    fill="clear"
                    type="button"
                    [disabled]="orderIndex === rule.paymentAllocationOrder!.length - 1"
                    (click)="moveOrderEntry(rule.paymentAllocationOrder!, orderIndex, 1)"
                    [attr.aria-label]="'COMMON.MOVE_DOWN' | translate"
                  >
                    <ion-icon name="arrow-down-outline" slot="icon-only"></ion-icon>
                  </ion-button>
                </ion-item>
              }
            </ion-list>
          </div>
        }

        @if (availablePaymentTransactionTypes().length) {
          <div class="add-transaction-type-row">
            <ion-item fill="outline" class="form-item flex-1">
              <ion-label position="stacked">{{
                'PRODUCTS.ADD_TRANSACTION_TYPE' | translate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'PRODUCTS.ADD_TRANSACTION_TYPE' | translate"
                interface="popover"
                name="newPaymentTransactionType"
                [(ngModel)]="newPaymentTransactionType"
              >
                @for (option of availablePaymentTransactionTypes(); track option.code) {
                  <ion-select-option [value]="option.code">{{ option.value }}</ion-select-option>
                }
              </ion-select>
            </ion-item>
            <ion-button
              fill="outline"
              type="button"
              [disabled]="!newPaymentTransactionType"
              (click)="addPaymentTransactionType()"
            >
              <ion-icon name="add-outline" slot="start"></ion-icon>
              {{ 'COMMON.ADD' | translate }}
            </ion-button>
          </div>
        }
      </ion-card-content>
    </ion-card>

    <ion-card class="allocation-card">
      <ion-card-header>
        <ion-card-title [appTooltip]="'HELP.CREDIT_ALLOCATION_DESC' | translate">
          {{ 'PRODUCTS.CREDIT_ALLOCATION' | translate }}
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        @for (rule of creditAllocation(); track rule.transactionType; let ruleIndex = $index) {
          <div class="allocation-block">
            <div class="allocation-block-header">
              <strong>{{
                transactionTypeLabel(rule.transactionType, creditTransactionTypeOptions())
              }}</strong>
              <ion-button
                fill="clear"
                type="button"
                color="danger"
                [attr.aria-label]="'COMMON.DELETE' | translate"
                (click)="removeCreditTransactionType(ruleIndex)"
              >
                <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
              </ion-button>
            </div>

            <ion-list class="allocation-order-list">
              @for (
                order of rule.creditAllocationOrder;
                track order.creditAllocationRule;
                let orderIndex = $index
              ) {
                <ion-item class="allocation-item">
                  <span class="order-index">{{ orderIndex + 1 }}.</span>
                  <span class="order-label">{{
                    allocationRuleLabel(order.creditAllocationRule, creditAllocationRuleOptions())
                  }}</span>
                  <ion-button
                    fill="clear"
                    type="button"
                    [disabled]="orderIndex === 0"
                    (click)="moveOrderEntry(rule.creditAllocationOrder!, orderIndex, -1)"
                    [attr.aria-label]="'COMMON.MOVE_UP' | translate"
                  >
                    <ion-icon name="arrow-up-outline" slot="icon-only"></ion-icon>
                  </ion-button>
                  <ion-button
                    fill="clear"
                    type="button"
                    [disabled]="orderIndex === rule.creditAllocationOrder!.length - 1"
                    (click)="moveOrderEntry(rule.creditAllocationOrder!, orderIndex, 1)"
                    [attr.aria-label]="'COMMON.MOVE_DOWN' | translate"
                  >
                    <ion-icon name="arrow-down-outline" slot="icon-only"></ion-icon>
                  </ion-button>
                </ion-item>
              }
            </ion-list>
          </div>
        }

        @if (availableCreditTransactionTypes().length) {
          <div class="add-transaction-type-row">
            <ion-item fill="outline" class="form-item flex-1">
              <ion-label position="stacked">{{
                'PRODUCTS.ADD_TRANSACTION_TYPE' | translate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'PRODUCTS.ADD_TRANSACTION_TYPE' | translate"
                interface="popover"
                name="newCreditTransactionType"
                [(ngModel)]="newCreditTransactionType"
              >
                @for (option of availableCreditTransactionTypes(); track option.code) {
                  <ion-select-option [value]="option.code">{{ option.value }}</ion-select-option>
                }
              </ion-select>
            </ion-item>
            <ion-button
              fill="outline"
              type="button"
              [disabled]="!newCreditTransactionType"
              (click)="addCreditTransactionType()"
            >
              <ion-icon name="add-outline" slot="start"></ion-icon>
              {{ 'COMMON.ADD' | translate }}
            </ion-button>
          </div>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .allocation-card {
        margin-bottom: 16px;
      }
      .allocation-block {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
      }
      .allocation-block-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .future-installment-field {
        width: 100%;
        max-width: 320px;
      }
      .allocation-order-list mat-list-item {
        display: flex;
        align-items: center;
      }
      .order-index {
        width: 24px;
        color: #777;
      }
      .order-label {
        flex: 1;
      }
      .add-transaction-type-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
    `,
  ],
})
export class PaymentCreditAllocationEditorComponent {
  readonly transactionTypeOptions = input<EnumOptionData[]>([]);
  readonly allocationRuleOptions = input<EnumOptionData[]>([]);
  readonly futureInstallmentOptions = input<EnumOptionData[]>([]);
  readonly creditTransactionTypeOptions = input<EnumOptionData[]>([]);
  readonly creditAllocationRuleOptions = input<EnumOptionData[]>([]);

  // `model()` rather than `input()`, because this component writes its own allocation lists when
  // a transaction type is added or removed. It also supplies the `…Change` outputs the parent
  // already binds, so `loan-product-form` needs no change.
  readonly paymentAllocation = model<AdvancedPaymentData[]>([]);
  readonly creditAllocation = model<CreditAllocationData[]>([]);

  // Plain fields, not signals: both are `[(ngModel)]` targets, and a signal cannot be one.
  newPaymentTransactionType: string | null = null;
  newCreditTransactionType: string | null = null;

  transactionTypeLabel(code: string | undefined, options: EnumOptionData[]): string {
    return options.find((option) => option.code === code)?.value ?? code ?? '';
  }

  allocationRuleLabel(code: string | undefined, options: EnumOptionData[]): string {
    return options.find((option) => option.code === code)?.value ?? code ?? '';
  }

  readonly availablePaymentTransactionTypes = computed<EnumOptionData[]>(() => {
    const used = new Set(this.paymentAllocation().map((rule) => rule.transactionType));
    return this.transactionTypeOptions().filter((option) => !used.has(option.code));
  });

  readonly availableCreditTransactionTypes = computed<EnumOptionData[]>(() => {
    const used = new Set(this.creditAllocation().map((rule) => rule.transactionType));
    return this.creditTransactionTypeOptions().filter((option) => !used.has(option.code));
  });

  addPaymentTransactionType(): void {
    if (!this.newPaymentTransactionType) return;
    this.paymentAllocation.set([
      ...this.paymentAllocation(),
      {
        transactionType: this.newPaymentTransactionType,
        futureInstallmentAllocationRule:
          this.futureInstallmentOptions()[0]?.code ?? 'NEXT_INSTALLMENT',
        paymentAllocationOrder: this.allocationRuleOptions().map((option, index) => ({
          order: index + 1,
          paymentAllocationRule: option.code,
        })),
      },
    ]);
    this.newPaymentTransactionType = null;
  }

  removePaymentTransactionType(index: number): void {
    this.paymentAllocation.set(this.paymentAllocation().filter((_, i) => i !== index));
  }

  addCreditTransactionType(): void {
    if (!this.newCreditTransactionType) return;
    this.creditAllocation.set([
      ...this.creditAllocation(),
      {
        transactionType: this.newCreditTransactionType,
        creditAllocationOrder: this.creditAllocationRuleOptions().map((option, index) => ({
          order: index + 1,
          creditAllocationRule: option.code,
        })),
      },
    ]);
    this.newCreditTransactionType = null;
  }

  removeCreditTransactionType(index: number): void {
    this.creditAllocation.set(this.creditAllocation().filter((_, i) => i !== index));
  }

  moveOrderEntry<T extends { order?: number }>(entries: T[], index: number, delta: number): void {
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= entries.length) return;
    [entries[index], entries[targetIndex]] = [entries[targetIndex], entries[index]];
    entries.forEach((entry, i) => (entry.order = i + 1));
    this.emitPaymentAllocation();
    this.emitCreditAllocation();
  }

  /**
   * Republishes the list under a new identity.
   *
   * Reordering and the future-installment select both mutate an object *inside* the list, so the
   * model signal's own reference is unchanged and neither the parent nor this view would hear
   * about it. Copying the array is what turns an in-place edit back into a notification.
   */
  emitPaymentAllocation(): void {
    this.paymentAllocation.set([...this.paymentAllocation()]);
  }

  emitCreditAllocation(): void {
    this.creditAllocation.set([...this.creditAllocation()]);
  }
}
