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
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '../../core/services/notification.service';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/angular/standalone';
import {
  InterOperationService,
  InteropTransferRequestData,
  InteropTransferResponseData,
} from '../../api';

const ERROR_OCCURRED = 'Error occurred';

/**
 * The tabs on this screen, named.
 *
 * They were positional strings — '0', '7' — which say nothing at the point of use and shift
 * meaning whenever a tab is inserted in the middle. The values are still strings because
 * `ion-segment` compares them as such.
 */
export const INTEROP_TAB = {
  load: 'load',
  create: 'create',
  result: 'result',
} as const;

export type InteropTab = (typeof INTEROP_TAB)[keyof typeof INTEROP_TAB];

@Component({
  selector: 'app-interop-transfers',
  standalone: true,
  imports: [
    FormsModule,
    JsonPipe,
    TranslateModule,
    IonButton,
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
    IonSegment,
    IonSegmentButton,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'INTEROP.TRANSFER_TITLE' | translate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-segment [value]="activeTab()" (ionChange)="activeTab.set($any($event).detail.value)">
          <ion-segment-button [value]="TAB.load">
            <ion-label>{{ 'INTEROP.LOAD_TRANSFER' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.create">
            <ion-label>{{ 'INTEROP.CREATE_TRANSFER' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.result">
            <ion-label>Disburse / Repay</ion-label>
          </ion-segment-button>
        </ion-segment>

        @if (activeTab() === TAB.load) {
          <div class="tab-content">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'INTEROP.TRANSACTION_CODE' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'INTEROP.TRANSACTION_CODE' | translate"
                [(ngModel)]="transactionCode"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'INTEROP.TRANSFER_CODE' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'INTEROP.TRANSFER_CODE' | translate"
                [(ngModel)]="transferCode"
              ></ion-input>
            </ion-item>

            <ion-button
              color="primary"
              (click)="loadTransfer()"
              [disabled]="!transactionCode || !transferCode"
            >
              {{ 'INTEROP.LOAD_TRANSFER' | translate }}
            </ion-button>

            @if (result()) {
              <pre>{{ result() | json }}</pre>
            }
          </div>
        }
        @if (activeTab() === TAB.create) {
          <div class="tab-content">
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{ 'INTEROP.TRANSFER_BODY' | translate }}</ion-label>
              <ion-textarea
                [attr.aria-label]="'INTEROP.TRANSFER_BODY' | translate"
                rows="10"
                [(ngModel)]="transferBodyJson"
              ></ion-textarea>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'INTEROP.ACTION' | translate }}</ion-label>
              <ion-select
                [attr.aria-label]="'INTEROP.ACTION' | translate"
                interface="popover"
                [(ngModel)]="transferAction"
              >
                <ion-select-option value="prepare">prepare</ion-select-option>
                <ion-select-option value="create">create</ion-select-option>
              </ion-select>
            </ion-item>

            <ion-button color="secondary" (click)="createTransfer()">
              {{ 'INTEROP.CREATE_TRANSFER' | translate }}
            </ion-button>

            @if (result()) {
              <pre>{{ result() | json }}</pre>
            }
          </div>
        }
        @if (activeTab() === TAB.result) {
          <div class="tab-content">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'INTEROP.ACCOUNT_ID' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'INTEROP.ACCOUNT_ID' | translate"
                [(ngModel)]="disburseAccountId"
              ></ion-input>
            </ion-item>

            <div class="button-row">
              <ion-button color="primary" (click)="disburse()" [disabled]="!disburseAccountId">
                {{ 'INTEROP.DISBURSE' | translate }}
              </ion-button>
              <ion-button
                color="secondary"
                (click)="loanRepayment()"
                [disabled]="!disburseAccountId"
              >
                {{ 'INTEROP.LOAN_REPAYMENT' | translate }}
              </ion-button>
            </div>

            @if (result()) {
              <pre>{{ result() | json }}</pre>
            }
          </div>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .tab-content {
        padding: 16px 0;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      ion-item {
        width: 300px;
      }
      .full-width {
        width: 100%;
      }
      .button-row {
        display: flex;
        gap: 12px;
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
export class InteropTransfersComponent {
  /** Selected tab; mat-tab-group tracked this internally, ion-segment does not. */
  /** Exposed so the template names its tabs instead of numbering them. */
  protected readonly TAB = INTEROP_TAB;

  readonly activeTab = signal<InteropTab>(INTEROP_TAB.load);
  private interopService = inject(InterOperationService);
  private notifications = inject(NotificationService);

  readonly result = signal<InteropTransferResponseData | string | null>(null);

  transactionCode = '';
  transferCode = '';

  transferBodyJson = '{}';
  transferAction = 'create';

  disburseAccountId = '';

  loadTransfer(): void {
    this.result.set(null);
    this.interopService
      .getInteroperationTransactionsTransactionCodeTransfersTransferCode(
        this.transactionCode,
        this.transferCode,
      )
      .subscribe({
        next: (data) => this.result.set(data),
        error: (err: { message?: string }) =>
          this.notifications.error(err.message || ERROR_OCCURRED),
      });
  }

  createTransfer(): void {
    this.result.set(null);
    let body: InteropTransferRequestData;
    try {
      body = JSON.parse(this.transferBodyJson) as InteropTransferRequestData;
    } catch {
      this.notifications.error('Invalid JSON');
      return;
    }
    this.interopService.postInteroperationTransfers(body, this.transferAction).subscribe({
      next: (data) => this.result.set(data),
      error: (err: { message?: string }) => this.notifications.error(err.message || ERROR_OCCURRED),
    });
  }

  disburse(): void {
    this.result.set(null);
    this.interopService
      .postInteroperationTransactionsAccountIdDisburse(this.disburseAccountId)
      .subscribe({
        next: (data) => this.result.set(data),
        error: (err: { message?: string }) =>
          this.notifications.error(err.message || ERROR_OCCURRED),
      });
  }

  loanRepayment(): void {
    this.result.set(null);
    this.interopService
      .postInteroperationTransactionsAccountIdLoanrepayment(this.disburseAccountId)
      .subscribe({
        next: (data) => this.result.set(data),
        error: (err: { message?: string }) =>
          this.notifications.error(err.message || ERROR_OCCURRED),
      });
  }
}
