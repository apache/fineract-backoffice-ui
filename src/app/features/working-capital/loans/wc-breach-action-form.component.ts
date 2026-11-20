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
  IonCheckbox,
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
  WorkingCapitalLoanBreachActionsService,
  PostWorkingCapitalLoansBreachActionRequest,
  WorkingCapitalLoanBreachActionData,
} from '../../../api';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatDateToFineract,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';
import { DateFieldComponent } from '../../../ui/date-field/date-field.component';

const ACTIONS = WorkingCapitalLoanBreachActionData.ActionEnum;
const FREQUENCY_TYPES = WorkingCapitalLoanBreachActionData.FrequencyTypeEnum;
const MINIMUM_PAYMENT_TYPES = WorkingCapitalLoanBreachActionData.MinimumPaymentTypeEnum;

/**
 * Submits a covenant-breach action (pause, resume, reschedule, reset, undo_reset, disable,
 * enable) for a single Working Capital loan. Field visibility follows the action-specific
 * constraints documented on `PostWorkingCapitalLoansBreachActionRequest` — mirrors the
 * per-command `@if` branching in `WcLoanActionFormComponent`.
 */
@Component({
  selector: 'app-wc-breach-action-form',
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
    IonCheckbox,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'WC_LOANS.BREACH_ACTION.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #actionForm="ngForm" (ngSubmit)="onSubmit()" class="wc-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'WC_LOANS.BREACH_ACTION.ACTION' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'WC_LOANS.BREACH_ACTION.ACTION' | appTranslate"
                interface="popover"
                name="action"
                [(ngModel)]="action"
                required
              >
                @for (opt of actionOptions; track opt) {
                  <ion-select-option [value]="opt">{{ opt }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            @if (
              action === ACTIONS.Pause ||
              action === ACTIONS.Resume ||
              action === ACTIONS.Disable ||
              action === ACTIONS.Enable
            ) {
              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'WC_LOANS.BREACH_ACTION.START_DATE' | appTranslate
                }}</ion-label>
                @if (pickersReady()) {
                  <ion-datetime-button datetime="startDate-picker"></ion-datetime-button>
                }
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="startDate-picker"
                      data-testid="startDate-picker"
                      presentation="date"
                      name="startDate"
                      [(ngModel)]="startDate"
                      required
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>
            }

            @if (action === ACTIONS.Pause) {
              <app-date-field
                label="WC_LOANS.BREACH_ACTION.END_DATE"
                [required]="true"
                pickerId="endDate-picker"
                name="endDate"
                [(ngModel)]="endDate"
              ></app-date-field>
            }

            @if (action === ACTIONS.Reschedule) {
              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'WC_LOANS.BREACH_ACTION.FREQUENCY' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'WC_LOANS.BREACH_ACTION.FREQUENCY' | appTranslate"
                  type="number"
                  name="frequency"
                  [(ngModel)]="request.frequency"
                ></ion-input>
              </ion-item>
              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'WC_LOANS.BREACH_ACTION.FREQUENCY_TYPE' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'WC_LOANS.BREACH_ACTION.FREQUENCY_TYPE' | appTranslate"
                  interface="popover"
                  name="frequencyType"
                  [(ngModel)]="request.frequencyType"
                >
                  @for (opt of frequencyTypeOptions; track opt) {
                    <ion-select-option [value]="opt">{{ opt }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>
              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'WC_LOANS.BREACH_ACTION.MINIMUM_PAYMENT' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'WC_LOANS.BREACH_ACTION.MINIMUM_PAYMENT' | appTranslate"
                  type="number"
                  name="minimumPayment"
                  [(ngModel)]="request.minimumPayment"
                ></ion-input>
              </ion-item>
              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'WC_LOANS.BREACH_ACTION.MINIMUM_PAYMENT_TYPE' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'WC_LOANS.BREACH_ACTION.MINIMUM_PAYMENT_TYPE' | appTranslate"
                  interface="popover"
                  name="minimumPaymentType"
                  [(ngModel)]="request.minimumPaymentType"
                >
                  @for (opt of minimumPaymentTypeOptions; track opt) {
                    <ion-select-option [value]="opt">{{ opt }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>
            }

            @if (action === ACTIONS.Reset) {
              <ion-item fill="outline">
                <ion-checkbox name="restartPeriodFromResetDate" [(ngModel)]="restartFromReset">
                  {{ 'WC_LOANS.BREACH_ACTION.RESTART_PERIOD' | appTranslate }}
                </ion-checkbox>
              </ion-item>
            }

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="actionForm.invalid || isSaving()"
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
export class WcBreachActionFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly breachActionsService = inject(WorkingCapitalLoanBreachActionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly ACTIONS = ACTIONS;
  readonly actionOptions = Object.values(ACTIONS);
  readonly frequencyTypeOptions = Object.values(FREQUENCY_TYPES);
  readonly minimumPaymentTypeOptions = Object.values(MINIMUM_PAYMENT_TYPES);

  loanId = 0;
  readonly isSaving = signal(false);

  action: WorkingCapitalLoanBreachActionData.ActionEnum | undefined;
  startDate: string | null = null;
  endDate: string | null = null;
  restartFromReset = false;

  request: PostWorkingCapitalLoansBreachActionRequest = {
    dateFormat: FINERACT_DATE_FORMAT,
    locale: FINERACT_LOCALE,
  };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.loanId = +id;
  }

  onSubmit(): void {
    this.isSaving.set(true);

    const request: PostWorkingCapitalLoansBreachActionRequest = {
      ...this.request,
      action: this.action,
    };
    if (this.startDate) {
      request.startDate = formatDateToFineract(this.startDate);
    }
    if (this.endDate) {
      request.endDate = formatDateToFineract(this.endDate);
    }
    if (this.action === ACTIONS.Reset) {
      request.restartPeriodFromResetDate = this.restartFromReset;
    }

    this.breachActionsService
      .postWorkingCapitalLoansLoanIdBreachActions(this.loanId, request)
      .subscribe({
        next: () => this.onCancel(),
        error: () => this.isSaving.set(false),
      });
  }

  onCancel(): void {
    this.router.navigate([`/working-capital/loans/view/${this.loanId}`], {
      queryParams: { tab: 'breachActions' },
    });
  }
}
