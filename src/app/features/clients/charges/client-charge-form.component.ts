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
import { ClientChargesService, PostClientsClientIdChargesRequest, ChargeData } from '../../../api';
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
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../../core/utils/date-formatter';

/**
 * Create form for a client charge. The selectable charge definitions come from the
 * client charges template endpoint (`chargeOptions`); core fields are the charge id,
 * amount and due date.
 */
@Component({
  selector: 'app-client-charge-form',
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
          <ion-card-title>{{ 'CLIENT_CHARGES.CREATE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #chargeForm="ngForm" (ngSubmit)="onSubmit()" class="charge-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'CLIENT_CHARGES.CHARGE' | appTranslate }}</ion-label>
              <ion-select
                [attr.aria-label]="'CLIENT_CHARGES.CHARGE' | appTranslate"
                interface="popover"
                name="chargeId"
                [(ngModel)]="charge.chargeId"
                required
              >
                @for (opt of chargeOptions(); track opt.id) {
                  <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'CLIENT_CHARGES.AMOUNT' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'CLIENT_CHARGES.AMOUNT' | appTranslate"
                type="number"
                name="amount"
                [(ngModel)]="charge.amount"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'CLIENT_CHARGES.DUE_DATE' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'CLIENT_CHARGES.DUE_DATE' | appTranslate"
                type="date"
                name="dueDate"
                [(ngModel)]="dueDate"
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
        max-width: 600px;
        margin: 0 auto;
      }
      .charge-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class ClientChargeFormComponent implements OnInit {
  private readonly clientChargesService = inject(ClientChargesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  clientId!: number;
  readonly isSaving = signal(false);

  charge: PostClientsClientIdChargesRequest = {};
  dueDate: string | null = null;
  readonly chargeOptions = signal<ChargeData[]>([]);

  ngOnInit(): void {
    this.clientId = Number(this.route.snapshot.paramMap.get('clientId'));

    this.clientChargesService.getClientsClientIdChargesTemplate(this.clientId).subscribe((tpl) => {
      const template = tpl as unknown as { chargeOptions?: ChargeData[] };
      this.chargeOptions.set(template.chargeOptions ?? []);
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const request: PostClientsClientIdChargesRequest = {
      chargeId: this.charge.chargeId,
      amount: this.charge.amount,
      dueDate: formatDateToFineract(this.dueDate),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };

    this.clientChargesService.postClientsClientIdCharges(this.clientId, request).subscribe({
      next: () => this.router.navigate(['/clients', this.clientId, 'charges']),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate(['/clients', this.clientId, 'charges']);
  }
}
