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
  ChargesService,
  ChargeRequest,
  CurrencyService,
  CurrencyConfigurationData,
  CurrencyData,
  ChargeData,
  GetChargesResponse,
} from '../../../api';
import { HelpIconComponent } from '../../../shared';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

/**
 * Component for creating and editing global charges and penalties.
 */
@Component({
  selector: 'app-charge-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    HelpIconComponent,
    IonButton,
    IonSpinner,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonCheckbox,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ isEditMode() ? ('CHARGES.EDIT' | appTranslate) : ('CHARGES.CREATE' | appTranslate) }}
            <app-help-icon [helpTextKey]="'HELP.CHARGES_DESC'"></app-help-icon>
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #chargeForm="ngForm" (ngSubmit)="onSubmit()" class="charge-form">
            <div class="form-grid">
              <!-- Name -->
              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.NAME' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.NAME' | appTranslate"
                  name="name"
                  [(ngModel)]="charge().name"
                  required
                ></ion-input>
              </ion-item>

              <!-- Charge Applies To -->
              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'CHARGES.APPLIES_TO' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'CHARGES.APPLIES_TO' | appTranslate"
                  interface="popover"
                  name="chargeAppliesTo"
                  [(ngModel)]="charge().chargeAppliesTo"
                  required
                  [disabled]="isEditMode()"
                >
                  <ion-select-option [value]="1">Client</ion-select-option>
                  <ion-select-option [value]="2">Loan</ion-select-option>
                  <ion-select-option [value]="3">Savings</ion-select-option>
                  <ion-select-option [value]="4">Shares</ion-select-option>
                </ion-select>
              </ion-item>

              <!-- Currency -->
              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.CURRENCY' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'COMMON.CURRENCY' | appTranslate"
                  interface="popover"
                  name="currencyCode"
                  [(ngModel)]="charge().currencyCode"
                  required
                >
                  @for (currency of currencies(); track currency.code) {
                    <ion-select-option [value]="currency.code">{{
                      currency.name
                    }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <!-- Charge Time Type -->
              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'CHARGES.TIME_TYPE' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'CHARGES.TIME_TYPE' | appTranslate"
                  interface="popover"
                  name="chargeTimeType"
                  [(ngModel)]="charge().chargeTimeType"
                  required
                >
                  @for (option of timeTypeOptions(); track option['id']) {
                    <ion-select-option [value]="option['id']">{{
                      option['value']
                    }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <!-- Charge Calculation Type -->
              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'CHARGES.CALCULATION_TYPE' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'CHARGES.CALCULATION_TYPE' | appTranslate"
                  interface="popover"
                  name="chargeCalculationType"
                  [(ngModel)]="charge().chargeCalculationType"
                  required
                >
                  @for (option of calculationTypeOptions(); track option['id']) {
                    <ion-select-option [value]="option['id']">{{
                      option['value']
                    }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <!-- Amount -->
              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.AMOUNT' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.AMOUNT' | appTranslate"
                  type="number"
                  name="amount"
                  [(ngModel)]="charge().amount"
                  required
                ></ion-input>
              </ion-item>

              <!-- Active -->
              <div class="checkbox-container">
                <ion-checkbox name="active" [(ngModel)]="charge().active">
                  {{ 'COMMON.ACTIVE' | appTranslate }}
                </ion-checkbox>
              </div>

              <!-- Penalty -->
              <div class="checkbox-container">
                <ion-checkbox name="penalty" [(ngModel)]="charge().penalty">
                  {{ 'COMMON.PENALTY' | appTranslate }}
                </ion-checkbox>
              </div>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="chargeForm.invalid || isSaving()"
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
        max-width: 900px;
        margin: 0 auto;
      }
      .charge-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
      .checkbox-container {
        display: flex;
        align-items: center;
        height: 60px;
      }
    `,
  ],
})
export class ChargeFormComponent implements OnInit {
  private readonly chargesService = inject(ChargesService);
  private readonly currencyService = inject(CurrencyService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly LIST_PATH = '/accounting/charges';

  chargeId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly charge = signal<ChargeRequest>({
    active: true,
    penalty: false,
    chargeAppliesTo: 1, // Default to Client
  });

  readonly currencies = signal<CurrencyData[]>([]);
  readonly timeTypeOptions = signal<Record<string, unknown>[]>([]);
  readonly calculationTypeOptions = signal<Record<string, unknown>[]>([]);

  ngOnInit(): void {
    this.loadMetadata();
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.chargeId = +id;
        this.isEditMode.set(true);
        this.loadChargeData();
      }
    });
  }

  private loadMetadata(): void {
    this.currencyService.getCurrencies().subscribe((data: CurrencyConfigurationData) => {
      this.currencies.set(Array.from(data.selectedCurrencyOptions || []));
    });

    this.chargesService.getChargesTemplate().subscribe((data: ChargeData) => {
      const record = data as unknown as Record<string, unknown>;
      this.timeTypeOptions.set(
        (record['chargeTimeTypeOptions'] as Record<string, unknown>[]) || [],
      );
      this.calculationTypeOptions.set(
        (record['chargeCalculationTypeOptions'] as Record<string, unknown>[]) || [],
      );
    });
  }

  private loadChargeData(): void {
    if (!this.chargeId) return;
    this.chargesService.getChargesChargeId(this.chargeId).subscribe((data: GetChargesResponse) => {
      const record = data as unknown as Record<string, unknown>;
      this.charge.set({
        name: record['name'] as string,
        amount: record['amount'] as number,
        currencyCode: (record['currency'] as Record<string, unknown>)?.['code'] as string,
        chargeAppliesTo: (record['chargeAppliesTo'] as Record<string, unknown>)?.['id'] as number,
        chargeTimeType: (record['chargeTimeType'] as Record<string, unknown>)?.['id'] as number,
        chargeCalculationType: (record['chargeCalculationType'] as Record<string, unknown>)?.[
          'id'
        ] as number,
        active: record['active'] as boolean,
        penalty: record['penalty'] as boolean,
      });
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    this.charge().locale = 'en';

    if (this.isEditMode() && this.chargeId) {
      this.chargesService.putChargesChargeId(this.chargeId, this.charge()).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    } else {
      this.chargesService.postCharges(this.charge()).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
