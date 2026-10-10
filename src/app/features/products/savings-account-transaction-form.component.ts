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
import { TranslatePipe } from '../../core/adapters';
import { NotificationService } from '../../core/services/notification.service';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonDatetime,
  IonDatetimeButton,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';
import { formatArrayDate, toIsoDate } from '../../core/utils/date-formatter';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  SavingsAccountTransactionsService,
  PostSavingsAccountTransactionsRequest,
} from '../../api';
import { createPickersReady } from '../../shared/utils/pickers-ready';

@Component({
  selector: 'app-savings-account-transaction-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
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
              command() === 'deposit'
                ? ('SAVINGS.DEPOSIT' | appTranslate)
                : command() === 'withdrawal'
                  ? ('SAVINGS.WITHDRAWAL' | appTranslate)
                  : ('SAVINGS.POST_INTEREST_AS_ON' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #transactionForm="ngForm" (ngSubmit)="onSubmit()" class="transaction-form">
            <div class="form-grid">
              <!-- Transaction Date -->
              <ion-item fill="outline" [appTooltip]="'HELP.TRANSACTION_DATE_DESC' | appTranslate">
                <ion-label position="stacked">{{
                  'COMMON.TRANSACTION_DATE' | appTranslate
                }}</ion-label>
                @if (pickersReady()) {
                  <ion-datetime-button datetime="transactionDate-picker"></ion-datetime-button>
                }
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="transactionDate-picker"
                      data-testid="transactionDate-picker"
                      presentation="date"
                      name="transactionDate"
                      [ngModel]="transactionDate()"
                      (ngModelChange)="transactionDate.set($event)"
                      required
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>

              @if (command() !== 'postInterestAsOn') {
                <!-- Transaction Amount -->
                <ion-item
                  fill="outline"
                  [appTooltip]="'HELP.TRANSACTION_AMOUNT_DESC' | appTranslate"
                >
                  <ion-label position="stacked">{{
                    'COMMON.TRANSACTION_AMOUNT' | appTranslate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'COMMON.TRANSACTION_AMOUNT' | appTranslate"
                    type="number"
                    name="transactionAmount"
                    [(ngModel)]="transaction.transactionAmount"
                    required
                  ></ion-input>
                </ion-item>

                <!--
                  Required, because the platform requires it. A deposit or withdrawal without a
                  payment type is refused outright:

                    POST /savingsaccounts/{id}/transactions?command=deposit     400
                    POST /savingsaccounts/{id}/transactions?command=withdrawal  400
                    validation.msg.savingsaccount.transaction.paymentTypeId.cannot.be.blank

                  Without the attribute the form was valid without it, so Save was enabled and
                  the only way to discover the field was mandatory was to submit and be
                  rejected. Scoped with transactionAmount inside the postInterestAsOn guard, so
                  it does not apply to the one command that posts no payment.
                -->
                <!-- Payment Type -->
                <ion-item fill="outline" [appTooltip]="'HELP.PAYMENT_TYPE_DESC' | appTranslate">
                  <ion-label position="stacked">{{
                    'COMMON.PAYMENT_TYPE' | appTranslate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'COMMON.PAYMENT_TYPE' | appTranslate"
                    interface="popover"
                    name="paymentTypeId"
                    [(ngModel)]="transaction.paymentTypeId"
                    required
                  >
                    @for (type of paymentTypeOptions(); track type['id']) {
                      <ion-select-option [value]="type['id']">{{ type['name'] }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>

                <!-- Note -->
                <ion-item
                  fill="outline"
                  [appTooltip]="'HELP.NOTE_DESC' | appTranslate"
                  class="full-width"
                >
                  <ion-label position="stacked">{{ 'COMMON.NOTE' | appTranslate }}</ion-label>
                  <ion-textarea
                    [attr.aria-label]="'COMMON.NOTE' | appTranslate"
                    name="note"
                    [(ngModel)]="note"
                    rows="3"
                  ></ion-textarea>
                </ion-item>
              }
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="transactionForm.invalid || isSaving()"
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
        max-width: 800px;
        margin: 0 auto;
      }
      .transaction-form {
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
export class SavingsAccountTransactionFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly transactionService = inject(SavingsAccountTransactionsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationService);

  accountId = 0;
  readonly command = signal('');
  readonly isSaving = signal(false);

  transaction: PostSavingsAccountTransactionsRequest = {};
  /** Note bound separately as it might not be in the direct model */
  note = '';
  readonly transactionDate = signal(toIsoDate(new Date()));
  readonly paymentTypeOptions = signal<Record<string, unknown>[]>([]);

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.accountId = +params['accountId'];
      this.command.set(params['command']);
      this.loadTemplate();
    });
  }

  private loadTemplate(): void {
    this.transactionService
      .getSavingsaccountsSavingsIdTransactionsTemplate(this.accountId)
      .subscribe({
        next: (template: string) => {
          // Handle template parsing if necessary (OpenAPI sometimes returns generic string/any)
          const data = typeof template === 'string' ? JSON.parse(template) : template;
          this.paymentTypeOptions.set(data.paymentTypeOptions || []);
          if (data.date) {
            this.transactionDate.set(formatArrayDate(data.date));
          }
        },
        error: () => {
          this.notifications.error('Operation failed. Please try again.');
        },
      });
  }

  onSubmit(): void {
    this.isSaving.set(true);

    const formattedDate = toIsoDate(this.transactionDate());

    this.transaction.transactionDate = formattedDate;
    this.transaction.dateFormat = 'yyyy-MM-dd';
    this.transaction.locale = 'en';

    // `postInterestAsOn` takes only a date (plus the flag naming it) — the amount, payment
    // type, and note above are for deposit/withdrawal and don't apply here.
    const payload: Record<string, unknown> =
      this.command() === 'postInterestAsOn'
        ? {
            transactionDate: formattedDate,
            dateFormat: this.transaction.dateFormat,
            locale: this.transaction.locale,
            isPostInterestAsOn: true,
          }
        : { ...this.transaction, note: this.note };

    this.transactionService
      .postSavingsaccountsSavingsIdTransactions(
        this.accountId,
        payload as PostSavingsAccountTransactionsRequest,
        this.command(),
      )
      .subscribe({
        next: () => this.router.navigate(['/products/savings-accounts']),
        error: () => this.isSaving.set(false),
      });
  }

  onCancel(): void {
    this.router.navigate(['/products/savings-accounts']);
  }
}
