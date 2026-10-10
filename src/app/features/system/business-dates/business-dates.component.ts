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
import { TranslatePipe } from '../../../core/adapters';
import { NotificationService } from '../../../core/services/notification.service';
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
  BusinessDateManagementService,
  BusinessDateResponse,
  BusinessDateUpdateRequest,
} from '../../../api';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  toIsoDate,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';

@Component({
  selector: 'app-business-dates',
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
    <div class="page-header">
      <h2>{{ 'BUSINESS_DATES.TITLE' | appTranslate }}</h2>
    </div>

    @if (isLoading()) {
      <div class="loading-spinner">
        <ion-spinner name="crescent"></ion-spinner>
      </div>
    }

    @if (!isLoading()) {
      <div class="form-grid">
        <!-- Business Date Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{
              'BUSINESS_DATES.BUSINESS_DATE_LABEL' | appTranslate
            }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            @if (businessDateEntry()?.description; as description) {
              <p>{{ description }}</p>
            }
            <p>
              <strong>{{ 'BUSINESS_DATES.CURRENT_DATE' | appTranslate }}:</strong>
              {{ businessDateEntry()?.date }}
            </p>
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{
                'BUSINESS_DATES.NEW_DATE' | appTranslate
              }}</ion-label>
              @if (pickersReady()) {
                <ion-datetime-button datetime="businessDate-picker"></ion-datetime-button>
              }
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="businessDate-picker"
                    data-testid="businessDate-picker"
                    presentation="date"
                    name="businessDate"
                    [ngModel]="businessDate()"
                    (ngModelChange)="businessDate.set($event)"
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>
          </ion-card-content>
          <div class="card-actions">
            <ion-button
              color="primary"
              (click)="updateDate('BUSINESS_DATE')"
              [disabled]="!businessDate()"
            >
              {{ 'BUSINESS_DATES.UPDATE' | appTranslate }}
            </ion-button>
          </div>
        </ion-card>

        <!-- COB Date Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ 'BUSINESS_DATES.COB_DATE_LABEL' | appTranslate }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            @if (cobDateEntry()?.description; as description) {
              <p>{{ description }}</p>
            }
            <p>
              <strong>{{ 'BUSINESS_DATES.CURRENT_DATE' | appTranslate }}:</strong>
              {{ cobDateEntry()?.date }}
            </p>
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">{{
                'BUSINESS_DATES.NEW_DATE' | appTranslate
              }}</ion-label>
              @if (pickersReady()) {
                <ion-datetime-button datetime="cobDate-picker"></ion-datetime-button>
              }
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="cobDate-picker"
                    data-testid="cobDate-picker"
                    presentation="date"
                    name="cobDate"
                    [ngModel]="cobDate()"
                    (ngModelChange)="cobDate.set($event)"
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>
          </ion-card-content>
          <div class="card-actions">
            <ion-button color="primary" (click)="updateDate('COB_DATE')" [disabled]="!cobDate()">
              {{ 'BUSINESS_DATES.UPDATE' | appTranslate }}
            </ion-button>
          </div>
        </ion-card>
      </div>
    }
  `,
  styles: [
    `
      .page-header {
        margin-bottom: 24px;
      }
      .loading-spinner {
        display: flex;
        justify-content: center;
        padding: 48px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 24px;
      }
      .full-width {
        width: 100%;
      }
      mat-card-content {
        padding-top: 16px;
      }
      mat-card-actions {
        padding: 8px 16px 16px;
      }
      @media (max-width: 768px) {
        .form-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class BusinessDatesComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private businessDateService = inject(BusinessDateManagementService);
  private notifications = inject(NotificationService);

  readonly isLoading = signal(false);

  readonly businessDateEntry = signal<BusinessDateResponse | null>(null);
  readonly cobDateEntry = signal<BusinessDateResponse | null>(null);

  readonly businessDate = signal<string | null>(null);
  readonly cobDate = signal<string | null>(null);

  ngOnInit(): void {
    this.loadBusinessDates();
  }

  private loadBusinessDates(): void {
    this.isLoading.set(true);
    this.businessDateService.getBusinessdate().subscribe({
      next: (dates: BusinessDateResponse[]) => {
        this.businessDateEntry.set(dates.find((d) => d.type === 'BUSINESS_DATE') ?? null);
        this.cobDateEntry.set(dates.find((d) => d.type === 'COB_DATE') ?? null);

        // Read once into a local so the `?.date` guard actually narrows — a second signal call
        // is a separate expression to the compiler and carries none of the first one's checks.
        const businessDate = this.businessDateEntry()?.date;
        if (businessDate) {
          this.businessDate.set(toIsoDate(new Date(businessDate)));
        }
        const cobDate = this.cobDateEntry()?.date;
        if (cobDate) {
          this.cobDate.set(toIsoDate(new Date(cobDate)));
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.notifications.error('Failed to load business dates');
      },
    });
  }

  updateDate(type: string): void {
    const dateValue = type === 'BUSINESS_DATE' ? this.businessDate() : this.cobDate();
    if (!dateValue) return;

    const body: BusinessDateUpdateRequest = {
      type: type as BusinessDateUpdateRequest.TypeEnum,
      date: formatDateToFineract(dateValue),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };

    this.businessDateService.postBusinessdate(body).subscribe({
      next: () => {
        this.notifications.success('BUSINESS_DATES.UPDATE_SUCCESS');
        this.loadBusinessDates();
      },
      error: () => {
        this.notifications.error('Failed to update business date');
      },
    });
  }
}
