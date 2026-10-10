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
import { RateService, RateRequest } from '../../../api';
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
 * Create / edit form for an interest rate (name + percentage + active flag).
 */
@Component({
  selector: 'app-rate-form',
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
    IonSelectOption,
    IonSelect,
    IonCheckbox,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ isEditMode() ? ('RATES.EDIT' | appTranslate) : ('RATES.CREATE' | appTranslate) }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #rateForm="ngForm" (ngSubmit)="onSubmit()" class="rate-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'RATES.NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'RATES.NAME' | appTranslate"
                name="name"
                [(ngModel)]="rate().name"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'RATES.PERCENTAGE' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'RATES.PERCENTAGE' | appTranslate"
                type="number"
                name="percentage"
                [(ngModel)]="rate().percentage"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'RATES.PRODUCT_APPLY' | appTranslate }}</ion-label>
              <ion-select
                [attr.aria-label]="'RATES.PRODUCT_APPLY' | appTranslate"
                interface="popover"
                name="productApply"
                [(ngModel)]="rate().productApply"
              >
                <ion-select-option [value]="1">{{
                  'RATES.PRODUCT_APPLY_LOAN' | appTranslate
                }}</ion-select-option>
                <ion-select-option [value]="2">{{
                  'RATES.PRODUCT_APPLY_SAVINGS' | appTranslate
                }}</ion-select-option>
              </ion-select>
            </ion-item>

            <ion-checkbox name="active" [(ngModel)]="rate().active">
              {{ 'COMMON.ACTIVE' | appTranslate }}
            </ion-checkbox>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="rateForm.invalid || isSaving()">
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
      .rate-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class RateFormComponent implements OnInit {
  private readonly rateService = inject(RateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/products/rates';

  rateId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly rate = signal<RateRequest>({ name: '', active: true });

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
    this.rateService.getRatesRateId(this.rateId).subscribe((data) => {
      this.rate.set({
        name: data.name,
        percentage: data.percentage,
        active: data.active,
        productApply: data.productApply?.id,
      });
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const request$ =
      this.isEditMode() && this.rateId
        ? this.rateService.putRatesRateId(this.rateId, this.rate())
        : this.rateService.postRates(this.rate());

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
