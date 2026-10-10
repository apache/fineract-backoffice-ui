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
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { LoanCOBCatchUpService, OldestCOBProcessedLoanDTO } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
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
  selector: 'app-loan-cob-catchup',
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
        <ion-card-title>{{ 'LOAN_COB_CATCHUP.TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div class="section">
          <ion-button color="primary" (click)="checkStatus()">
            {{ 'LOAN_COB_CATCHUP.CHECK_STATUS' | appTranslate }}
          </ion-button>

          @if (statusChecked()) {
            <p>
              {{ 'LOAN_COB_CATCHUP.IS_RUNNING' | appTranslate }}:
              <strong>{{ isRunning() }}</strong>
            </p>
          }
        </div>

        <hr class="divider" />

        <div class="section">
          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'LOAN_COB_CATCHUP.LOAN_ID' | appTranslate
            }}</ion-label>
            <ion-input
              [attr.aria-label]="'LOAN_COB_CATCHUP.LOAN_ID' | appTranslate"
              type="number"
              [(ngModel)]="loanId"
            ></ion-input>
          </ion-item>

          <ion-button color="primary" [disabled]="!loanId" (click)="getOldestCobDate()">
            {{ 'LOAN_COB_CATCHUP.GET_OLDEST_DATE' | appTranslate }}
          </ion-button>

          @if (oldestDate() !== null) {
            <div>
              <h4>{{ 'LOAN_COB_CATCHUP.OLDEST_DATE' | appTranslate }}</h4>
              <pre>{{ oldestDate() | json }}</pre>
            </div>
          }
        </div>

        <hr class="divider" />

        <div class="section">
          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'LOAN_COB_CATCHUP.LOAN_ID' | appTranslate
            }}</ion-label>
            <ion-input
              [attr.aria-label]="'LOAN_COB_CATCHUP.LOAN_ID' | appTranslate"
              type="number"
              [(ngModel)]="catchupLoanId"
            ></ion-input>
          </ion-item>

          <ion-button color="secondary" [disabled]="!catchupLoanId" (click)="runCatchup()">
            {{ 'LOAN_COB_CATCHUP.RUN_CATCHUP' | appTranslate }}
          </ion-button>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .section {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px 0;
      }
      ion-item {
        width: 100%;
        max-width: 400px;
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
export class LoanCobCatchupComponent {
  private readonly loanCOBCatchUpService = inject(LoanCOBCatchUpService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  readonly isRunning = signal<boolean | null>(null);
  readonly oldestDate = signal<OldestCOBProcessedLoanDTO | null>(null);
  readonly statusChecked = signal(false);
  loanId = 0;
  catchupLoanId = 0;

  checkStatus(): void {
    this.loanCOBCatchUpService.getLoansIsCatchUpRunning().subscribe({
      next: (data) => {
        this.isRunning.set(data?.catchUpRunning ?? false);
        this.statusChecked.set(true);
      },
      error: () => {
        this.statusChecked.set(true);
      },
    });
  }

  getOldestCobDate(): void {
    this.loanCOBCatchUpService.getLoansOldestCobClosed().subscribe({
      next: (data) => {
        this.oldestDate.set(data);
      },
      error: () => {
        this.oldestDate.set(null);
      },
    });
  }

  runCatchup(): void {
    this.loanCOBCatchUpService.postLoansCatchUp().subscribe({
      next: () => {
        this.i18n.translateAsync('LOAN_COB_CATCHUP.SUCCESS').subscribe((msg) => {
          this.notifications.success(msg);
        });
      },
    });
  }
}
