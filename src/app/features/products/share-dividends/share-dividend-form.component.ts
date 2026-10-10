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
import { SelfDividendService } from '../../../api';
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
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';

/**
 * Create form for a share product dividend. The share product id is read from the route
 * snapshot; the core captured fields are the dividend amount and the dividend period start
 * and end dates. The dividend endpoint is untyped, so the request body is serialised to a
 * JSON string.
 */
@Component({
  selector: 'app-share-dividend-form',
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
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'SHARE_DIVIDENDS.CREATE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #dividendForm="ngForm" (ngSubmit)="onSubmit()" class="dividend-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'SHARE_DIVIDENDS.AMOUNT' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'SHARE_DIVIDENDS.AMOUNT' | appTranslate"
                type="number"
                name="dividendAmount"
                [(ngModel)]="dividendAmount"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'SHARE_DIVIDENDS.PERIOD_START_DATE' | appTranslate
              }}</ion-label>
              @if (pickersReady()) {
                <ion-datetime-button
                  datetime="dividendPeriodStartDate-picker"
                ></ion-datetime-button>
              }
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="dividendPeriodStartDate-picker"
                    data-testid="dividendPeriodStartDate-picker"
                    presentation="date"
                    name="dividendPeriodStartDate"
                    [(ngModel)]="dividendPeriodStartDate"
                    required
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'SHARE_DIVIDENDS.PERIOD_END_DATE' | appTranslate
              }}</ion-label>
              @if (pickersReady()) {
                <ion-datetime-button datetime="dividendPeriodEndDate-picker"></ion-datetime-button>
              }
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="dividendPeriodEndDate-picker"
                    data-testid="dividendPeriodEndDate-picker"
                    presentation="date"
                    name="dividendPeriodEndDate"
                    [(ngModel)]="dividendPeriodEndDate"
                    required
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="dividendForm.invalid || isSaving()"
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
      .dividend-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class ShareDividendFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly selfDividendService = inject(SelfDividendService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  productId!: number;
  readonly isSaving = signal(false);

  dividendAmount: number | null = null;
  dividendPeriodStartDate: string | null = null;
  dividendPeriodEndDate: string | null = null;

  ngOnInit(): void {
    this.productId = Number(this.route.snapshot.paramMap.get('productId'));
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const body = JSON.stringify({
      dividendAmount: this.dividendAmount ?? undefined,
      dividendPeriodStartDate: this.dividendPeriodStartDate
        ? formatDateToFineract(this.dividendPeriodStartDate)
        : undefined,
      dividendPeriodEndDate: this.dividendPeriodEndDate
        ? formatDateToFineract(this.dividendPeriodEndDate)
        : undefined,
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    });

    this.selfDividendService.postShareproductProductIdDividend(this.productId, body).subscribe({
      next: () => this.router.navigate(['/products/shares', this.productId, 'dividends']),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate(['/products/shares', this.productId, 'dividends']);
  }
}
