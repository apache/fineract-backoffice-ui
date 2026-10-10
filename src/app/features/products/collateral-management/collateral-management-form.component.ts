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

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
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
import {
  CollateralManagementService,
  CollateralProductCreateRequest,
  CurrencyData,
} from '../../../api';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../../ui/searchable-select/searchable-select.component';

/**
 * Create / edit form for a collateral product master-data record.
 * Currency options come from the collateral-management template endpoint.
 */
@Component({
  selector: 'app-collateral-management-form',
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
    SearchableSelectComponent,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('COLLATERAL_MANAGEMENT.EDIT' | appTranslate)
                : ('COLLATERAL_MANAGEMENT.CREATE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #collateralForm="ngForm" (ngSubmit)="onSubmit()" class="collateral-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'COLLATERAL_MANAGEMENT.NAME' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'COLLATERAL_MANAGEMENT.NAME' | appTranslate"
                name="name"
                [(ngModel)]="collateral().name"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'COLLATERAL_MANAGEMENT.QUALITY' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'COLLATERAL_MANAGEMENT.QUALITY' | appTranslate"
                name="quality"
                [(ngModel)]="collateral().quality"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'COLLATERAL_MANAGEMENT.UNIT_TYPE' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'COLLATERAL_MANAGEMENT.UNIT_TYPE' | appTranslate"
                name="unitType"
                [(ngModel)]="collateral().unitType"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'COLLATERAL_MANAGEMENT.BASE_PRICE' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'COLLATERAL_MANAGEMENT.BASE_PRICE' | appTranslate"
                type="number"
                name="basePrice"
                [(ngModel)]="collateral().basePrice"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'COLLATERAL_MANAGEMENT.PCT_TO_BASE' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'COLLATERAL_MANAGEMENT.PCT_TO_BASE' | appTranslate"
                type="number"
                name="pctToBase"
                [(ngModel)]="collateral().pctToBase"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'COLLATERAL_MANAGEMENT.CURRENCY' | appTranslate
              }}</ion-label>
              <app-searchable-select
                [ariaLabel]="'COLLATERAL_MANAGEMENT.CURRENCY' | appTranslate"
                [placeholder]="'COLLATERAL_MANAGEMENT.CURRENCY' | appTranslate"
                name="currency"
                testId="collateral-currency-select"
                [options]="currencySelectOptions()"
                [(ngModel)]="collateral().currency"
                required
              />
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="collateralForm.invalid || isSaving()"
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
      .collateral-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class CollateralManagementFormComponent implements OnInit {
  private readonly collateralService = inject(CollateralManagementService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/products/collateral-management';

  collateralId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly collateral = signal<CollateralProductCreateRequest>({
    name: '',
    quality: '',
    unitType: '',
    basePrice: 0,
    pctToBase: 0,
    currency: '',
    locale: 'en',
  });
  readonly currencyOptions = signal<CurrencyData[]>([]);
  readonly currencySelectOptions = computed<SearchableSelectOption[]>(() =>
    this.currencyOptions().map((opt) => ({
      value: opt.code ?? '',
      label: `${opt.name} (${opt.code})`,
    })),
  );

  ngOnInit(): void {
    this.collateralService.getCollateralManagementTemplate().subscribe((currencies) => {
      this.currencyOptions.set(currencies ?? []);
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.collateralId = +id;
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  load(): void {
    if (!this.collateralId) return;
    this.collateralService
      .getCollateralManagementCollateralId(this.collateralId)
      .subscribe((data) => {
        this.collateral.set({
          name: data.name ?? '',
          quality: data.quality ?? '',
          unitType: data.unitType ?? '',
          basePrice: data.basePrice ?? 0,
          pctToBase: data.pctToBase ?? 0,
          currency: data.currency ?? '',
          locale: 'en',
        });
      });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const request$ =
      this.isEditMode() && this.collateralId
        ? this.collateralService.putCollateralManagementCollateralId(
            this.collateralId,
            this.collateral(),
          )
        : this.collateralService.postCollateralManagement(this.collateral());

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
