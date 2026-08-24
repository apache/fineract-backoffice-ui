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
import { TranslateModule } from '@ngx-translate/core';
import { FloatingRatesService } from '../../../api';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
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

/** A single editable rate period row in the form. */
interface RatePeriodRow {
  fromDate: Date;
  interestRate: number | null;
  isDifferentialToBaseLendingRate: boolean;
}

interface FloatingRateFormValue {
  name: string;
  isBaseLendingRate: boolean;
  isActive: boolean;
}

type RatePeriodWithInterestRate = RatePeriodRow & { interestRate: number };
type FloatingRateCreatePayload = Parameters<FloatingRatesService['postFloatingrates']>[0];
type FloatingRateUpdatePayload = Parameters<
  FloatingRatesService['putFloatingratesFloatingRateId']
>[1];

/**
 * Create / edit form for a floating interest rate, including its dynamic list of rate periods.
 */
@Component({
  selector: 'app-floating-rate-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonIcon,
    IonButton,
    IonSpinner,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonCheckbox,
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
                ? ('FLOATING_RATES.EDIT' | translate)
                : ('FLOATING_RATES.CREATE' | translate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #frForm="ngForm" (ngSubmit)="onSubmit()" class="fr-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'FLOATING_RATES.NAME' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'FLOATING_RATES.NAME' | translate"
                name="name"
                [(ngModel)]="rate().name"
                required
              ></ion-input>
            </ion-item>

            <div class="checkboxes">
              <ion-checkbox name="isBaseLendingRate" [(ngModel)]="rate().isBaseLendingRate">
                {{ 'FLOATING_RATES.IS_BASE_LENDING_RATE' | translate }}
              </ion-checkbox>
              <ion-checkbox name="isActive" [(ngModel)]="rate().isActive">
                {{ 'COMMON.ACTIVE' | translate }}
              </ion-checkbox>
            </div>

            <div class="periods">
              <div class="periods-header">
                <h3>{{ 'FLOATING_RATES.RATE_PERIODS' | translate }}</h3>
                <ion-button fill="outline" type="button" (click)="addPeriod()">
                  <ion-icon name="add-outline"></ion-icon>
                  {{ 'FLOATING_RATES.ADD_PERIOD' | translate }}
                </ion-button>
              </div>

              @for (period of periods(); track $index) {
                <div class="period-row">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'FLOATING_RATES.FROM_DATE' | translate
                    }}</ion-label>
                    <ion-datetime-button datetime="periodfromDate-picker"></ion-datetime-button>
                    <ion-modal [keepContentsMounted]="true">
                      <ng-template>
                        <ion-datetime
                          id="periodfromDate-picker"
                          data-testid="periodfromDate-picker"
                          presentation="date"
                          name="periodfromDate"
                          [(ngModel)]="period.fromDate"
                          required
                        ></ion-datetime>
                      </ng-template>
                    </ion-modal>
                  </ion-item>

                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'FLOATING_RATES.INTEREST_RATE' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'FLOATING_RATES.INTEREST_RATE' | translate"
                      type="number"
                      [name]="'interestRate' + $index"
                      [(ngModel)]="period.interestRate"
                      required
                    ></ion-input>
                  </ion-item>

                  <ion-checkbox
                    [name]="'isDifferential' + $index"
                    [(ngModel)]="period.isDifferentialToBaseLendingRate"
                  >
                    {{ 'FLOATING_RATES.IS_DIFFERENTIAL' | translate }}
                  </ion-checkbox>

                  <ion-button
                    fill="clear"
                    color="danger"
                    type="button"
                    [attr.aria-label]="'COMMON.DELETE' | translate"
                    (click)="removePeriod($index)"
                  >
                    <ion-icon name="trash-outline"></ion-icon>
                  </ion-button>
                </div>
              }
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="frForm.invalid || isSaving()">
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | translate }}
                } @else {
                  {{ 'COMMON.SAVE' | translate }}
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
        max-width: 900px;
        margin: 0 auto;
      }
      .fr-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .checkboxes {
        display: flex;
        gap: 24px;
      }
      .periods-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .period-row {
        display: grid;
        grid-template-columns: 1fr 1fr auto auto;
        align-items: center;
        gap: 12px;
      }
    `,
  ],
})
export class FloatingRateFormComponent implements OnInit {
  private readonly floatingRatesService = inject(FloatingRatesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/products/floating-rates';

  rateId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly rate = signal<FloatingRateFormValue>({
    name: '',
    isBaseLendingRate: false,
    isActive: true,
  });
  readonly periods = signal<RatePeriodRow[]>([]);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.rateId = +id;
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  load(): void {
    if (!this.rateId) return;
    this.floatingRatesService.getFloatingratesFloatingRateId(this.rateId).subscribe((data) => {
      this.rate.set({
        name: data.name ?? '',
        isBaseLendingRate: data.isBaseLendingRate ?? false,
        isActive: data.isActive ?? true,
      });
      this.periods.set(
        (data.ratePeriods || []).map((p) => {
          const arr = p.fromDate as unknown as number[];
          return {
            fromDate:
              Array.isArray(arr) && arr.length >= 3
                ? new Date(arr[0], arr[1] - 1, arr[2])
                : new Date(),
            interestRate: p.interestRate ?? null,
            isDifferentialToBaseLendingRate: !!p.isDifferentialToBaseLendingRate,
          };
        }),
      );
    });
  }

  addPeriod(): void {
    this.periods().push({
      fromDate: new Date(),
      interestRate: null,
      isDifferentialToBaseLendingRate: false,
    });
  }

  removePeriod(index: number): void {
    this.periods().splice(index, 1);
  }

  onSubmit(): void {
    this.isSaving.set(true);

    const periods = this.periods();
    const periodsWithRates = periods.filter(
      (period): period is RatePeriodWithInterestRate => period.interestRate !== null,
    );
    if (periodsWithRates.length !== periods.length) {
      this.isSaving.set(false);
      return;
    }

    const commonPayload = {
      name: this.rate().name,
      isBaseLendingRate: this.rate().isBaseLendingRate,
      isActive: this.rate().isActive,
      ratePeriods: periodsWithRates.map((p) => ({
        fromDate: formatDateToFineract(p.fromDate),
        interestRate: p.interestRate,
        isDifferentialToBaseLendingRate: p.isDifferentialToBaseLendingRate,
        dateFormat: FINERACT_DATE_FORMAT,
        locale: FINERACT_LOCALE,
      })),
    };

    const request$ =
      this.isEditMode() && this.rateId
        ? this.floatingRatesService.putFloatingratesFloatingRateId(
            this.rateId,
            commonPayload satisfies FloatingRateUpdatePayload,
          )
        : this.floatingRatesService.postFloatingrates(
            commonPayload satisfies FloatingRateCreatePayload,
          );

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
