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
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../core/adapters';
import { DefaultService } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
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
} from '@ionic/angular/standalone';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  toIsoDate,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';

@Component({
  selector: 'app-office-transaction-form',
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,
    TranslatePipe,
    IonButton,
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
          <ion-card-title>{{ 'OFFICE_TRANSACTIONS.CREATE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #txForm="ngForm" (ngSubmit)="onSubmit()" class="tx-form">
            <div class="form-grid">
              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'OFFICE_TRANSACTIONS.FROM_OFFICE' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'OFFICE_TRANSACTIONS.FROM_OFFICE' | appTranslate"
                  interface="popover"
                  name="fromOfficeId"
                  [(ngModel)]="fromOfficeId"
                  required
                >
                  @for (opt of fromOfficeOptions(); track opt.id) {
                    <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'OFFICE_TRANSACTIONS.TO_OFFICE' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'OFFICE_TRANSACTIONS.TO_OFFICE' | appTranslate"
                  interface="popover"
                  name="toOfficeId"
                  [(ngModel)]="toOfficeId"
                  required
                >
                  @for (opt of toOfficeOptions(); track opt.id) {
                    <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'OFFICE_TRANSACTIONS.AMOUNT' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'OFFICE_TRANSACTIONS.AMOUNT' | appTranslate"
                  type="number"
                  name="amount"
                  [(ngModel)]="amount"
                  required
                  min="0"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'OFFICE_TRANSACTIONS.DATE' | appTranslate
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
                      [(ngModel)]="transactionDate"
                      required
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>

              <ion-item fill="outline" class="full-span">
                <ion-label position="stacked">{{
                  'OFFICE_TRANSACTIONS.DESC' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'OFFICE_TRANSACTIONS.DESC' | appTranslate"
                  name="description"
                  [(ngModel)]="description"
                ></ion-input>
              </ion-item>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" routerLink="/organization/office-transactions">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="txForm.invalid || isSaving()">
                {{ isSaving() ? ('COMMON.SAVING' | appTranslate) : ('COMMON.SAVE' | appTranslate) }}
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
        max-width: 900px;
        margin: 0 auto;
      }
      .tx-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
      .full-span {
        grid-column: 1 / -1;
      }
      .form-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
    `,
  ],
})
export class OfficeTransactionFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly api = inject(DefaultService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  readonly fromOfficeOptions = signal<{ id: number; name: string }[]>([]);
  readonly toOfficeOptions = signal<{ id: number; name: string }[]>([]);
  fromOfficeId: number | null = null;
  toOfficeId: number | null = null;
  amount: number | null = null;
  transactionDate = toIsoDate(new Date());
  description = '';
  readonly isSaving = signal(false);

  ngOnInit(): void {
    this.api.getOfficetransactionsTemplate().subscribe({
      next: (raw: string) => {
        try {
          const template = JSON.parse(raw);
          this.fromOfficeOptions.set(template.fromOfficeOptions || template.officesToOptions || []);
          this.toOfficeOptions.set(template.toOfficeOptions || template.officesToOptions || []);
        } catch {
          this.fromOfficeOptions.set([]);
          this.toOfficeOptions.set([]);
        }
      },
      error: (err: unknown) => {
        console.error('Failed to load office transaction template', err);
      },
    });
  }

  onSubmit(): void {
    if (!this.fromOfficeId || !this.toOfficeId || !this.amount || !this.transactionDate) {
      return;
    }
    this.isSaving.set(true);

    const body = {
      fromOfficeId: this.fromOfficeId,
      toOfficeId: this.toOfficeId,
      transactionAmount: this.amount,
      transactionDate: formatDateToFineract(this.transactionDate),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
      description: this.description,
    };

    this.api.postOfficetransactions(JSON.stringify(body)).subscribe({
      next: () => {
        this.notifications.success('Office transaction created');
        this.router.navigate(['/organization/office-transactions']);
      },
      error: (err: unknown) => {
        console.error('Failed to create office transaction', err);
        this.notifications.error('Failed to create transaction');
        this.isSaving.set(false);
      },
    });
  }
}
