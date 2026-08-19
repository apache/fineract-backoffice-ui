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
} from '@ionic/angular/standalone';
import {
  FixedDepositAccountTransactionsService,
  PostFixedDepositAccountsFixedDepositAccountIdTransactionsRequest,
} from '../../../api';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  toIsoDate,
} from '../../../core/utils/date-formatter';

/**
 * One payment-type option as the transactions template actually returns it.
 *
 * The generated model types `paymentTypeOptions` as `Array<number>`, which the platform does not
 * honour — it answers with objects carrying `id` and `name`. Binding a select to the raw element
 * therefore renders `[object Object]` and posts an object as `paymentTypeId`. This local shape is
 * what the wire really carries; remove it when the upstream document describes the field.
 */
interface PaymentTypeOption {
  id: number;
  name: string;
}

/** The transaction template, whose response the document types only as `string`. */
interface TransactionTemplate {
  paymentTypeOptions?: PaymentTypeOption[];
}

/**
 * The deposit payload.
 *
 * `PostFixedDepositAccountsFixedDepositAccountIdTransactionsRequest` carries `transactionDate`,
 * `transactionAmount`, `note`, `dateFormat` and `locale` but not `paymentTypeId`, which the
 * platform does accept — it echoes it back under `changes` on a successful post. The field is
 * added here rather than dropped, so the teller's choice of payment channel reaches the ledger.
 */
type DepositRequest = PostFixedDepositAccountsFixedDepositAccountIdTransactionsRequest & {
  paymentTypeId?: number;
};

/**
 * Deposit form for a single fixed deposit account. The account id is read from the route.
 *
 * Deposit only, deliberately. A fixed deposit refuses a withdrawal —
 * `POST /fixeddepositaccounts/{id}/transactions?command=withdrawal` answers `503`
 * `error.msg.fixeddepositaccount.account.trasaction.withdraw.notallowed` — so unlike its
 * recurring-deposit twin this form has no command to switch on. Money leaves a fixed deposit
 * through maturity or premature closure, both of which live on the account's own action menu.
 */
@Component({
  selector: 'app-fixed-deposit-transaction-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
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
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ 'FIXED_DEPOSIT_TRANSACTIONS.DEPOSIT' | appTranslate }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #transactionForm="ngForm" (ngSubmit)="onSubmit()" class="fd-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'FIXED_DEPOSIT_TRANSACTIONS.DATE' | appTranslate
              }}</ion-label>
              <ion-datetime-button datetime="transactionDate-picker"></ion-datetime-button>
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="transactionDate-picker"
                    data-testid="transactionDate-picker"
                    presentation="date"
                    name="transactionDate"
                    [(ngModel)]="transactionDate"
                    required
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'FIXED_DEPOSIT_TRANSACTIONS.AMOUNT' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'FIXED_DEPOSIT_TRANSACTIONS.AMOUNT' | appTranslate"
                type="number"
                name="transactionAmount"
                data-testid="fd-transaction-amount"
                [(ngModel)]="transactionAmount"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'FIXED_DEPOSIT_TRANSACTIONS.PAYMENT_TYPE' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'FIXED_DEPOSIT_TRANSACTIONS.PAYMENT_TYPE' | appTranslate"
                interface="popover"
                name="paymentTypeId"
                [(ngModel)]="paymentTypeId"
              >
                @for (option of paymentTypeOptions(); track option.id) {
                  <ion-select-option [value]="option.id">{{ option.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                data-testid="fd-transaction-save"
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
        max-width: 600px;
        margin: 0 auto;
      }
      .fd-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
    `,
  ],
})
export class FixedDepositTransactionFormComponent implements OnInit {
  private readonly transactionsService = inject(FixedDepositAccountTransactionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  accountId!: number;
  readonly isSaving = signal(false);

  transactionDate = toIsoDate(new Date());
  transactionAmount: number | null = null;
  paymentTypeId: number | null = null;
  readonly paymentTypeOptions = signal<PaymentTypeOption[]>([]);

  ngOnInit(): void {
    this.accountId = Number(this.route.snapshot.paramMap.get('accountId'));
    this.transactionsService
      .getFixeddepositaccountsFixedDepositAccountIdTransactionsTemplate(this.accountId)
      .subscribe((template) => {
        // Typed `string` by the document, JSON on the wire — see `TransactionTemplate`.
        const options = (template as unknown as TransactionTemplate).paymentTypeOptions;
        this.paymentTypeOptions.set(options ?? []);
      });
  }

  /**
   * Posts the deposit.
   *
   * The argument order is the trap here. The recurring-deposit twin is
   * `(accountId, request, command)`, but this operation is generated as
   * `(accountId, command, body)` — `command` second, and the body typed `string` because the
   * document describes it as free-form. Mirroring the twin's call would bind the request object
   * to `command` and still compile. The request is built against the typed model and serialised
   * once, which keeps the shape checked and satisfies the generated signature; `HttpClient`
   * forwards a string body verbatim rather than re-encoding it.
   */
  onSubmit(): void {
    this.isSaving.set(true);
    const request: DepositRequest = {
      transactionDate: formatDateToFineract(this.transactionDate),
      transactionAmount: this.transactionAmount ?? undefined,
      paymentTypeId: this.paymentTypeId ?? undefined,
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };

    this.transactionsService
      .postFixeddepositaccountsFixedDepositAccountIdTransactions(
        this.accountId,
        'deposit',
        JSON.stringify(request),
      )
      .subscribe({
        next: () => this.navigateBack(),
        error: () => this.isSaving.set(false),
      });
  }

  onCancel(): void {
    this.navigateBack();
  }

  private navigateBack(): void {
    this.router.navigate(['/products/fixed-deposits/view', this.accountId]);
  }
}
