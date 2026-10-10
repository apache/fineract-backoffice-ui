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
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  LoanChargesService,
  PostLoansLoanIdChargesRequest,
  GetLoanChargeTemplateChargeOptions,
} from '../../../api';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';

/**
 * Create form for a loan charge. The available charge options come from the loan charges
 * template endpoint; the core captured fields are the chargeId, amount, and due date.
 */
@Component({
  selector: 'app-loan-charge-form',
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
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'LOAN_CHARGES.ADD_TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #chargeForm="ngForm" (ngSubmit)="onSubmit()" class="charge-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'LOAN_CHARGES.CHARGE' | appTranslate }}</ion-label>
              <ion-select
                [attr.aria-label]="'LOAN_CHARGES.CHARGE' | appTranslate"
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
              <ion-label position="stacked">{{ 'LOAN_CHARGES.AMOUNT' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'LOAN_CHARGES.AMOUNT' | appTranslate"
                type="number"
                name="amount"
                [(ngModel)]="charge.amount"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'LOAN_CHARGES.DUE_DATE' | appTranslate }}</ion-label>
              @if (pickersReady()) {
                <ion-datetime-button datetime="dueDate-picker"></ion-datetime-button>
              }
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="dueDate-picker"
                    data-testid="dueDate-picker"
                    presentation="date"
                    name="dueDate"
                    [(ngModel)]="dueDate"
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'LOAN_CHARGES.CANCEL' | appTranslate }}
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
                  {{ 'LOAN_CHARGES.SAVE' | appTranslate }}
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
export class LoanChargeFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly loanChargesService = inject(LoanChargesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  loanId!: number;
  readonly isSaving = signal(false);

  charge: PostLoansLoanIdChargesRequest = {};
  dueDate: string | null = null;
  readonly chargeOptions = signal<GetLoanChargeTemplateChargeOptions[]>([]);

  ngOnInit(): void {
    this.loanId = Number(this.route.snapshot.paramMap.get('loanId'));

    this.loanChargesService.getLoansLoanIdChargesTemplate(this.loanId).subscribe((tpl) => {
      this.chargeOptions.set(tpl.chargeOptions ? Array.from(tpl.chargeOptions) : []);
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const request: PostLoansLoanIdChargesRequest = {
      chargeId: this.charge.chargeId,
      amount: this.charge.amount,
      dueDate: this.dueDate ? formatDateToFineract(this.dueDate) : undefined,
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };

    this.loanChargesService.postLoansLoanIdCharges(this.loanId, request).subscribe({
      next: () => this.router.navigate(['/loans', this.loanId, 'charges']),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate(['/loans', this.loanId, 'charges']);
  }
}
