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
  InterestRateChartService,
  InterestRateChartCreateRequest,
  InterestRateChartUpdateRequest,
} from '../../../api';
import {
  formatDateToFineract,
  formatArrayDate,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  toIsoDate,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';

/**
 * Create / edit form for an interest rate chart's core fields. On create the chart's
 * effective from-date is captured; updates are limited to name and description (the
 * Fineract update endpoint only accepts those fields).
 */
@Component({
  selector: 'app-interest-rate-chart-form',
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
          <ion-card-title>
            {{
              isEditMode()
                ? ('INTEREST_RATE_CHARTS.EDIT' | appTranslate)
                : ('INTEREST_RATE_CHARTS.CREATE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #chartForm="ngForm" (ngSubmit)="onSubmit()" class="chart-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'INTEREST_RATE_CHARTS.NAME' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'INTEREST_RATE_CHARTS.NAME' | appTranslate"
                name="name"
                [ngModel]="name()"
                (ngModelChange)="name.set($event)"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'INTEREST_RATE_CHARTS.DESCRIPTION' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'INTEREST_RATE_CHARTS.DESCRIPTION' | appTranslate"
                name="description"
                [ngModel]="description()"
                (ngModelChange)="description.set($event)"
              ></ion-input>
            </ion-item>

            @if (!isEditMode()) {
              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'INTEREST_RATE_CHARTS.FROM_DATE' | appTranslate
                }}</ion-label>
                @if (pickersReady()) {
                  <ion-datetime-button datetime="fromDate-picker"></ion-datetime-button>
                }
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="fromDate-picker"
                      data-testid="fromDate-picker"
                      presentation="date"
                      name="fromDate"
                      [ngModel]="fromDate()"
                      (ngModelChange)="fromDate.set($event)"
                      required
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>
            }

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="chartForm.invalid || isSaving()"
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
      .chart-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class InterestRateChartFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly chartService = inject(InterestRateChartService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/products/interest-rate-charts';

  chartId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly name = signal('');
  readonly description = signal('');
  readonly fromDate = signal(toIsoDate(new Date()));

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.chartId = +id;
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  load(): void {
    if (!this.chartId) return;
    this.chartService.getInterestratechartsChartId(this.chartId).subscribe((raw) => {
      const data = raw as unknown as Record<string, unknown>;
      this.name.set((data['name'] as string | undefined) ?? '');
      this.description.set((data['description'] as string | undefined) ?? '');
      this.fromDate.set(
        data['fromDate']
          ? toIsoDate(new Date(formatArrayDate(data['fromDate'] as string)))
          : toIsoDate(new Date()),
      );
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    if (this.isEditMode() && this.chartId) {
      const payload: InterestRateChartUpdateRequest = {
        name: this.name(),
        description: this.description(),
      };
      this.chartService.putInterestratechartsChartId(this.chartId, payload).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    } else {
      const payload: InterestRateChartCreateRequest = {
        name: this.name(),
        description: this.description(),
        fromDate: formatDateToFineract(this.fromDate()),
        dateFormat: FINERACT_DATE_FORMAT,
        locale: FINERACT_LOCALE,
      };
      this.chartService.postInterestratecharts(payload).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
