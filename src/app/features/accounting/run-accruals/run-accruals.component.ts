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
import { TranslatePipe } from '../../../core/adapters';
import { PeriodicAccrualAccountingService, PostRunaccrualsRequest } from '../../../api';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonDatetime,
  IonDatetimeButton,
  IonItem,
  IonLabel,
  IonModal,
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';

/**
 * Single action screen that triggers periodic accrual accounting up to a chosen date.
 * Submits the chosen tillDate (formatted to the Fineract date format) to the runaccruals endpoint.
 */
@Component({
  selector: 'app-run-accruals',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonItem,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonLabel,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'RUN_ACCRUALS.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <p class="hint">{{ 'HELP.RUN_ACCRUALS_DESC' | appTranslate }}</p>

          @if (successMessage()) {
            <div class="success-message">{{ successMessage() }}</div>
          }

          <form #accrualForm="ngForm" (ngSubmit)="onSubmit()" class="accrual-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'RUN_ACCRUALS.TILL_DATE' | appTranslate
              }}</ion-label>
              @if (pickersReady()) {
                <ion-datetime-button datetime="tillDate-picker"></ion-datetime-button>
              }
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="tillDate-picker"
                    data-testid="tillDate-picker"
                    presentation="date"
                    name="tillDate"
                    [(ngModel)]="tillDate"
                    required
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>

            <div class="form-actions">
              <ion-button
                color="primary"
                type="submit"
                [disabled]="accrualForm.invalid || isSubmitting()"
              >
                @if (isSubmitting()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'RUN_ACCRUALS.RUNNING' | appTranslate }}
                } @else {
                  {{ 'RUN_ACCRUALS.RUN' | appTranslate }}
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
      .accrual-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .hint {
        color: rgba(0, 0, 0, 0.6);
      }
      .success-message {
        color: #2e7d32;
        margin-bottom: 16px;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class RunAccrualsComponent {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly accrualService = inject(PeriodicAccrualAccountingService);

  tillDate: string | null = null;
  readonly isSubmitting = signal(false);
  readonly successMessage = signal('');

  onSubmit(): void {
    if (!this.tillDate) return;
    this.isSubmitting.set(true);
    this.successMessage.set('');

    const request: PostRunaccrualsRequest = {
      tillDate: formatDateToFineract(this.tillDate),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };

    this.accrualService.postRunaccruals(request).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set('Periodic accruals executed successfully.');
      },
      error: () => this.isSubmitting.set(false),
    });
  }
}
