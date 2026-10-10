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
import { I18N, TranslatePipe } from '../../../../core/adapters';
import { WorkingCapitalLoanAccountLockService } from '../../../../api';
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
  IonSpinner,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-wc-loan-account-lock',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSpinner,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'WC_LOAN_ACCOUNT_LOCK.TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div class="form-fields">
          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'WC_LOAN_ACCOUNT_LOCK.LOAN_ID' | appTranslate
            }}</ion-label>
            <ion-input
              [attr.aria-label]="'WC_LOAN_ACCOUNT_LOCK.LOAN_ID' | appTranslate"
              type="number"
              [(ngModel)]="loanId"
              required
            ></ion-input>
          </ion-item>

          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'WC_LOAN_ACCOUNT_LOCK.LOCK_OWNER' | appTranslate
            }}</ion-label>
            <ion-input
              [attr.aria-label]="'WC_LOAN_ACCOUNT_LOCK.LOCK_OWNER' | appTranslate"
              type="text"
              [(ngModel)]="lockOwner"
            ></ion-input>
          </ion-item>
        </div>

        <div class="actions">
          <ion-button color="primary" [disabled]="!loanId || isLoading()" (click)="placeLock()">
            @if (isLoading()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              {{ 'WC_LOAN_ACCOUNT_LOCK.PLACE_LOCK' | appTranslate }}
            }
          </ion-button>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .form-fields {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
        max-width: 400px;
      }
      .actions {
        margin-top: 8px;
      }
      ion-spinner {
        display: inline-block;
      }
    `,
  ],
})
export class WcLoanAccountLockComponent {
  private accountLockService = inject(WorkingCapitalLoanAccountLockService);
  private notifications = inject(NotificationService);
  private i18n = inject(I18N);

  loanId = 0;
  lockOwner = '';
  readonly isLoading = signal(false);

  placeLock(): void {
    this.isLoading.set(true);
    this.accountLockService
      .postInternalWorkingCapitalLoansLoanIdPlaceLockLockOwner(this.loanId, this.lockOwner)
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.notifications.success(this.i18n.translate('WC_LOAN_ACCOUNT_LOCK.SUCCESS'));
        },
      });
  }
}
