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
import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { TranslatePipe } from '../../core/adapters';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonInput,
  IonItem,
  IonLabel,
} from '@ionic/angular/standalone';
import {
  InterOperationService,
  InteropAccountData,
  InteropIdentifiersResponseData,
  InteropKycResponseData,
  InteropTransactionsData,
} from '../../api';

@Component({
  selector: 'app-interop-account-view',
  standalone: true,
  imports: [
    FormsModule,
    JsonPipe,
    TranslatePipe,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonCheckbox,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'INTEROP.ACCOUNT_TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-item fill="outline">
          <ion-label position="stacked">{{ 'INTEROP.ACCOUNT_ID' | appTranslate }}</ion-label>
          <ion-input
            [attr.aria-label]="'INTEROP.ACCOUNT_ID' | appTranslate"
            [(ngModel)]="accountId"
          ></ion-input>
        </ion-item>

        <div class="button-row">
          <ion-button color="primary" (click)="loadAccount()" [disabled]="!accountId">
            {{ 'INTEROP.LOAD_ACCOUNT' | appTranslate }}
          </ion-button>
          <ion-button color="primary" (click)="loadIdentifiers()" [disabled]="!accountId">
            {{ 'INTEROP.LOAD_IDENTIFIERS' | appTranslate }}
          </ion-button>
          <ion-button color="primary" (click)="loadKyc()" [disabled]="!accountId">
            {{ 'INTEROP.LOAD_KYC' | appTranslate }}
          </ion-button>
          <ion-button color="primary" (click)="loadTransactions()" [disabled]="!accountId">
            {{ 'INTEROP.LOAD_TRANSACTIONS' | appTranslate }}
          </ion-button>
        </div>

        <div class="filter-row">
          <ion-checkbox [(ngModel)]="debitFilter">{{
            'INTEROP.DEBIT' | appTranslate
          }}</ion-checkbox>
          <ion-checkbox [(ngModel)]="creditFilter">{{
            'INTEROP.CREDIT' | appTranslate
          }}</ion-checkbox>
        </div>

        @if (accountData()) {
          <h3>Account</h3>
          <pre>{{ accountData() | json }}</pre>
        }

        @if (identifiers()) {
          <h3>Identifiers</h3>
          <pre>{{ identifiers() | json }}</pre>
        }

        @if (kyc()) {
          <h3>KYC</h3>
          <pre>{{ kyc() | json }}</pre>
        }

        @if (transactions()) {
          <h3>Transactions</h3>
          <pre>{{ transactions() | json }}</pre>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      ion-item {
        width: 300px;
        display: block;
        margin-bottom: 16px;
      }
      .button-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .filter-row {
        display: flex;
        gap: 24px;
        margin-bottom: 16px;
      }
      pre {
        background: #f5f5f5;
        padding: 12px;
        border-radius: 4px;
        overflow: auto;
      }
    `,
  ],
})
export class InteropAccountViewComponent {
  private interopService = inject(InterOperationService);

  accountId = '';
  debitFilter = true;
  creditFilter = true;

  readonly accountData = signal<InteropAccountData | null>(null);
  readonly identifiers = signal<InteropIdentifiersResponseData | null>(null);
  readonly kyc = signal<InteropKycResponseData | null>(null);
  readonly transactions = signal<InteropTransactionsData | null>(null);

  loadAccount(): void {
    this.interopService.getInteroperationAccountsAccountId(this.accountId).subscribe({
      next: (data) => this.accountData.set(data),
    });
  }

  loadIdentifiers(): void {
    this.interopService.getInteroperationAccountsAccountIdIdentifiers(this.accountId).subscribe({
      next: (data) => this.identifiers.set(data),
    });
  }

  loadKyc(): void {
    this.interopService.getInteroperationAccountsAccountIdKyc(this.accountId).subscribe({
      next: (data) => this.kyc.set(data),
    });
  }

  loadTransactions(): void {
    this.interopService
      .getInteroperationAccountsAccountIdTransactions(
        this.accountId,
        this.debitFilter,
        this.creditFilter,
      )
      .subscribe({
        next: (data) => this.transactions.set(data),
      });
  }
}
