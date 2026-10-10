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
  ClientCollateralManagementService,
  ClientCollateralCreateRequest,
  LoanCollateralTemplateData,
} from '../../../api';
import { FINERACT_LOCALE } from '../../../core/utils/date-formatter';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

/**
 * Create / edit form for a client collateral. The selectable collateral product
 * options come from the collateral template endpoint; core fields are the collateral
 * (product) id and quantity. Editing only updates the quantity.
 */
@Component({
  selector: 'app-client-collateral-form',
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
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode
                ? ('CLIENT_COLLATERAL.EDIT' | appTranslate)
                : ('CLIENT_COLLATERAL.CREATE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #collateralForm="ngForm" (ngSubmit)="onSubmit()" class="collateral-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'CLIENT_COLLATERAL.PRODUCT' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'CLIENT_COLLATERAL.PRODUCT' | appTranslate"
                interface="popover"
                name="collateralId"
                [(ngModel)]="collateral().collateralId"
                [disabled]="isEditMode"
                required
              >
                @for (opt of collateralProductOptions(); track opt.collateralId) {
                  <ion-select-option [value]="opt.collateralId">{{ opt.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'CLIENT_COLLATERAL.QUANTITY' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'CLIENT_COLLATERAL.QUANTITY' | appTranslate"
                type="number"
                name="quantity"
                [(ngModel)]="collateral().quantity"
                required
              ></ion-input>
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
export class ClientCollateralFormComponent implements OnInit {
  private readonly collateralService = inject(ClientCollateralManagementService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  clientId!: number;
  collateralId: number | null = null;
  isEditMode = false;
  readonly isSaving = signal(false);

  readonly collateral = signal<ClientCollateralCreateRequest>({});
  readonly collateralProductOptions = signal<LoanCollateralTemplateData[]>([]);

  ngOnInit(): void {
    this.clientId = Number(this.route.snapshot.paramMap.get('clientId'));

    this.collateralService.getClientsClientIdCollateralsTemplate(this.clientId).subscribe((tpl) => {
      this.collateralProductOptions.set(tpl ?? []);
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.collateralId = +id;
      this.isEditMode = true;
      this.load();
    }
  }

  load(): void {
    if (!this.collateralId) return;
    this.collateralService
      .getClientsClientIdCollateralsClientCollateralId(this.clientId, this.collateralId)
      .subscribe((data) => {
        this.collateral.set({
          collateralId: data.id,
          quantity: data.quantity,
        });
      });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const request$ =
      this.isEditMode && this.collateralId
        ? this.collateralService.putClientsClientIdCollateralsCollateralId(
            this.clientId,
            this.collateralId,
            { quantity: this.collateral().quantity, locale: FINERACT_LOCALE },
          )
        : this.collateralService.postClientsClientIdCollaterals(this.clientId, {
            collateralId: this.collateral().collateralId,
            quantity: this.collateral().quantity,
            locale: FINERACT_LOCALE,
          });

    request$.subscribe({
      next: () => this.router.navigate(['/clients', this.clientId, 'collaterals']),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate(['/clients', this.clientId, 'collaterals']);
  }
}
