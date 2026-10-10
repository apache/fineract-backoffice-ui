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
import { PaymentTypeService, PaymentTypeCreateRequest } from '../../../api';
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
  IonSpinner,
} from '@ionic/angular/standalone';

/**
 * Create / edit form for a payment type.
 */
@Component({
  selector: 'app-payment-type-form',
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
    IonCheckbox,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('PAYMENT_TYPES.EDIT' | appTranslate)
                : ('PAYMENT_TYPES.CREATE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #ptForm="ngForm" (ngSubmit)="onSubmit()" class="pt-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'PAYMENT_TYPES.NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'PAYMENT_TYPES.NAME' | appTranslate"
                name="name"
                [(ngModel)]="paymentType().name"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'COMMON.DESCRIPTION' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'COMMON.DESCRIPTION' | appTranslate"
                name="description"
                [(ngModel)]="paymentType().description"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'PAYMENT_TYPES.POSITION' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'PAYMENT_TYPES.POSITION' | appTranslate"
                type="number"
                name="position"
                [(ngModel)]="paymentType().position"
              ></ion-input>
            </ion-item>

            <ion-checkbox name="isCashPayment" [(ngModel)]="paymentType().isCashPayment">
              {{ 'PAYMENT_TYPES.IS_CASH' | appTranslate }}
            </ion-checkbox>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="ptForm.invalid || isSaving()">
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
      .pt-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class PaymentTypeFormComponent implements OnInit {
  private readonly paymentTypeService = inject(PaymentTypeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/organization/payment-types';

  paymentTypeId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly paymentType = signal<PaymentTypeCreateRequest>({
    name: '',
    description: '',
    position: undefined,
    isCashPayment: false,
    isSystemDefined: false,
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.paymentTypeId = +id;
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  load(): void {
    if (!this.paymentTypeId) return;
    this.paymentTypeService.getPaymenttypesPaymentTypeId(this.paymentTypeId).subscribe((data) => {
      this.paymentType.set({
        name: data.name ?? '',
        description: data.description,
        position: data.position,
        isCashPayment: data.isCashPayment,
        isSystemDefined: data.isSystemDefined ?? false,
      });
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const request$ =
      this.isEditMode() && this.paymentTypeId
        ? this.paymentTypeService.putPaymenttypesPaymentTypeId(
            this.paymentTypeId,
            this.paymentType(),
          )
        : this.paymentTypeService.postPaymenttypes(this.paymentType());

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
