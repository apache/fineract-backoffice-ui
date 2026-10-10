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
import { JsonPipe } from '@angular/common';
import { I18N, TranslatePipe } from '../../../../core/adapters';
import { WorkingCapitalLoanCOBCatchUpService, OldestCOBProcessedLoanDTO } from '../../../../api';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-wc-loan-cob-catchup',
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
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'WC_LOAN_COB_CATCHUP.TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <!-- Check Status Section -->
        <section class="section">
          <ion-button color="primary" (click)="checkStatus()">
            {{ 'WC_LOAN_COB_CATCHUP.CHECK_STATUS' | appTranslate }}
          </ion-button>
          @if (isRunning() !== null) {
            <p class="result-text">
              {{ 'WC_LOAN_COB_CATCHUP.IS_RUNNING' | appTranslate }}: {{ isRunning() | json }}
            </p>
          }
        </section>

        <hr class="divider" />

        <!-- Get Oldest COB Date Section -->
        <section class="section">
          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'WC_LOAN_COB_CATCHUP.LOAN_ID' | appTranslate
            }}</ion-label>
            <ion-input
              [attr.aria-label]="'WC_LOAN_COB_CATCHUP.LOAN_ID' | appTranslate"
              type="number"
              [(ngModel)]="loanId"
            ></ion-input>
          </ion-item>

          <ion-button color="secondary" [disabled]="!loanId" (click)="getOldestDate()">
            {{ 'WC_LOAN_COB_CATCHUP.GET_OLDEST_DATE' | appTranslate }}
          </ion-button>

          @if (oldestDate() !== null) {
            <p class="result-text">
              {{ 'WC_LOAN_COB_CATCHUP.OLDEST_DATE' | appTranslate }}: {{ oldestDate() | json }}
            </p>
          }
        </section>

        <hr class="divider" />

        <!-- Run COB Catch-Up Section -->
        <section class="section">
          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'WC_LOAN_COB_CATCHUP.LOAN_ID' | appTranslate
            }}</ion-label>
            <ion-input
              [attr.aria-label]="'WC_LOAN_COB_CATCHUP.LOAN_ID' | appTranslate"
              type="number"
              [(ngModel)]="catchupLoanId"
            ></ion-input>
          </ion-item>

          <ion-button color="danger" [disabled]="!catchupLoanId" (click)="runCatchup()">
            {{ 'WC_LOAN_COB_CATCHUP.RUN_CATCHUP' | appTranslate }}
          </ion-button>
        </section>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 16px 0;
        max-width: 400px;
      }
      .result-text {
        margin: 4px 0 0;
        font-size: 0.875rem;
        color: rgba(0, 0, 0, 0.6);
        word-break: break-all;
      }
      hr.divider {
        margin: 8px 0;
      }
    `,
  ],
})
export class WcLoanCobCatchupComponent {
  private cobCatchupService = inject(WorkingCapitalLoanCOBCatchUpService);
  private notifications = inject(NotificationService);
  private i18n = inject(I18N);

  readonly isRunning = signal<boolean | null>(null);
  readonly oldestDate = signal<OldestCOBProcessedLoanDTO | null>(null);
  loanId = 0;
  catchupLoanId = 0;

  checkStatus(): void {
    this.cobCatchupService.getWorkingCapitalLoansIsCatchUpRunning().subscribe({
      next: (result) => this.isRunning.set(result?.catchUpRunning ?? false),
      error: () => this.showError(),
    });
  }

  getOldestDate(): void {
    this.cobCatchupService.getWorkingCapitalLoansOldestCobClosed().subscribe({
      next: (result) => this.oldestDate.set(result),
      error: () => this.showError(),
    });
  }

  runCatchup(): void {
    this.cobCatchupService.postWorkingCapitalLoansCatchUp().subscribe({
      next: () => {
        this.notifications.success(this.i18n.translate('WC_LOAN_COB_CATCHUP.SUCCESS'));
      },
      error: () => this.showError(),
    });
  }

  private showError(): void {
    this.notifications.error(this.i18n.translate('WC_LOAN_COB_CATCHUP.ERROR'));
  }
}
