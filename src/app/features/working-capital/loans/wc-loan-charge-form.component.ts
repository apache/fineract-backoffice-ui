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
  WorkingCapitalLoanChargesService,
  PostLoansLoanIdChargesRequest,
  ChargeData,
} from '../../../api';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatDateToFineract,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';
import { DateFieldComponent } from '../../../ui/date-field/date-field.component';

/** Adds a charge to a single Working Capital loan, from the options offered by its template. */
@Component({
  selector: 'app-wc-loan-charge-form',
  standalone: true,
  imports: [
    DateFieldComponent,
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
          <ion-card-title>{{ 'WC_LOANS.CHARGE.NEW' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #chargeForm="ngForm" (ngSubmit)="onSubmit()" class="wc-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'WC_LOANS.CHARGE.SELECT_CHARGE' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'WC_LOANS.CHARGE.SELECT_CHARGE' | appTranslate"
                interface="popover"
                name="chargeId"
                [(ngModel)]="request.chargeId"
                required
              >
                @for (opt of chargeOptions(); track opt.id) {
                  <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'COMMON.AMOUNT' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'COMMON.AMOUNT' | appTranslate"
                type="number"
                name="amount"
                [(ngModel)]="request.amount"
              ></ion-input>
            </ion-item>

            <app-date-field
              label="WC_LOANS.CHARGE.DUE_DATE"
              pickerId="dueDate-picker"
              [clearable]="true"
              name="dueDate"
              [(ngModel)]="dueDate"
            ></app-date-field>

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
                  {{ 'COMMON.SUBMIT' | appTranslate }}
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
      .wc-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class WcLoanChargeFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly chargesService = inject(WorkingCapitalLoanChargesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  loanId = 0;
  readonly isSaving = signal(false);
  readonly chargeOptions = signal<ChargeData[]>([]);

  dueDate: string | null = null;

  request: PostLoansLoanIdChargesRequest = {
    dateFormat: FINERACT_DATE_FORMAT,
    locale: FINERACT_LOCALE,
  };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.loanId = +id;

    this.chargesService.getWorkingCapitalLoansLoanIdChargesTemplate(this.loanId).subscribe({
      next: (data) => this.chargeOptions.set(data.chargeOptions ?? []),
      error: (err: unknown) => console.error('Failed to load charge options', err),
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);

    if (this.dueDate) {
      this.request.dueDate = formatDateToFineract(this.dueDate);
    }

    this.chargesService.postWorkingCapitalLoansLoanIdCharges(this.loanId, this.request).subscribe({
      next: () => this.onCancel(),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([`/working-capital/loans/view/${this.loanId}`], {
      queryParams: { tab: 'charges' },
    });
  }
}
