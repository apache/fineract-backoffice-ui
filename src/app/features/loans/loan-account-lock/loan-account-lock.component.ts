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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LoanAccountLockService, LoanAccountLockResponseDTO } from '../../../api';
import { ConfigService } from '../../../core/services/config.service';
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
  IonSpinner,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-loan-account-lock',
  standalone: true,
  imports: [
    FormsModule,
    JsonPipe,
    TranslateModule,
    IonButton,
    IonSpinner,
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
        <ion-card-title>{{ 'LOAN_ACCOUNT_LOCK.TITLE' | translate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div class="section">
          <ion-item fill="outline">
            <ion-label position="stacked">{{ 'LOAN_ACCOUNT_LOCK.LOAN_ID' | translate }}</ion-label>
            <ion-input
              [attr.aria-label]="'LOAN_ACCOUNT_LOCK.LOAN_ID' | translate"
              type="number"
              [(ngModel)]="loanId"
              required
            ></ion-input>
          </ion-item>

          <ion-button color="primary" [disabled]="isLoading() || !loanId" (click)="checkLock()">
            @if (isLoading()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              {{ 'LOAN_ACCOUNT_LOCK.CHECK_LOCK' | translate }}
            }
          </ion-button>

          @if (lockChecked()) {
            <div class="lock-info">
              <h4>{{ 'LOAN_ACCOUNT_LOCK.LOCK_INFO' | translate }}</h4>
              @if (lockInfo()) {
                <pre>{{ lockInfo() | json }}</pre>
              } @else {
                <p>{{ 'LOAN_ACCOUNT_LOCK.NO_LOCK' | translate }}</p>
              }
            </div>
          }
        </div>

        <!--
          Placing a lock posts to /v1/internal/loans/{id}/place-lock/{owner}, which Fineract
          serves only under its test Spring profile and which answers 404 on a normal deployment.
          The lock *listing* above uses the supported /v1/loans/locked, so only this half is
          gated rather than the whole screen.
        -->
        @if (developerToolsEnabled()) {
          <hr class="divider" />

          <div class="section">
            <h3>{{ 'LOAN_ACCOUNT_LOCK.PLACE_LOCK' | translate }}</h3>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'LOAN_ACCOUNT_LOCK.LOCK_OWNER' | translate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'LOAN_ACCOUNT_LOCK.LOCK_OWNER' | translate"
                type="text"
                [(ngModel)]="lockOwner"
              ></ion-input>
            </ion-item>

            <ion-button
              color="secondary"
              [disabled]="isLoading() || !loanId || !lockOwner"
              (click)="placeLock()"
            >
              {{ 'LOAN_ACCOUNT_LOCK.PLACE_LOCK' | translate }}
            </ion-button>
          </div>
        }
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
      .lock-info pre {
        background: #f5f5f5;
        padding: 12px;
        border-radius: 4px;
        overflow: auto;
      }
    `,
  ],
})
export class LoanAccountLockComponent {
  private readonly loanAccountLockService = inject(LoanAccountLockService);
  private readonly config = inject(ConfigService);

  /** Gates the place-lock half of this screen; see the note in the template. */
  readonly developerToolsEnabled = this.config.developerToolsEnabled;
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly lockInfo = signal<LoanAccountLockResponseDTO | null>(null);
  readonly lockChecked = signal(false);
  readonly isLoading = signal(false);
  loanId = 0;
  lockOwner = '';

  checkLock(): void {
    this.isLoading.set(true);
    this.loanAccountLockService.getLoansLocked().subscribe({
      next: (data) => {
        this.lockInfo.set(data ?? null);
        this.lockChecked.set(true);
        this.isLoading.set(false);
      },
      error: () => {
        this.lockInfo.set(null);
        this.lockChecked.set(true);
        this.isLoading.set(false);
      },
    });
  }

  placeLock(): void {
    this.isLoading.set(true);
    this.loanAccountLockService
      .postInternalLoansLoanIdPlaceLockLockOwner(this.loanId, this.lockOwner)
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.translate.get('LOAN_ACCOUNT_LOCK.SUCCESS').subscribe((msg) => {
            this.notifications.success(msg);
          });
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }
}
