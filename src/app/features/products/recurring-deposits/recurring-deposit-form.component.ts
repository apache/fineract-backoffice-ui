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
import { ClientSearchComponent } from '../../../shared/components/client-search/client-search.component';
import { NotificationService } from '../../../core/services/notification.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
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
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  RecurringDepositAccountService,
  GetRecurringDepositAccountsTemplateResponse,
  GetRecurringDepositAccountsAccountIdResponse,
  GetRecurringProductOptions,
  PostRecurringDepositAccountsRequest,
} from '../../../api';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  toIsoDate,
} from '../../../core/utils/date-formatter';

/**
 * Component for creating and managing individual recurring deposit accounts.
 *
 * Provides a comprehensive form integration with Fineract's term deposit API.
 * Uses template-driven binding to strictly-typed OpenAPI request models.
 */
@Component({
  selector: 'app-recurring-deposit-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    ClientSearchComponent,
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
    IonSelectOption,
    IonSelect,
    IonCheckbox,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    TooltipDirective,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('RECURRING_DEPOSITS.EDIT' | translate)
                : ('RECURRING_DEPOSITS.CREATE' | translate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #accountForm="ngForm" (ngSubmit)="onSubmit()" class="recurring-deposit-form">
            <div class="form-grid">
              <!-- Client Search with Create Option -->
              <div class="field-container-row">
                <app-client-search
                  [label]="'COMMON.CLIENT' | translate"
                  [required]="true"
                  [initialClientId]="getClientId()"
                  (clientSelected)="onClientSelected($event)"
                  class="flex-grow"
                >
                </app-client-search>
                <ion-button
                  fill="clear"
                  type="button"
                  [attr.aria-label]="'CLIENTS.CREATE_CLIENT' | translate"
                  [appTooltip]="'CLIENTS.CREATE_CLIENT' | translate"
                  (click)="onCreateClient()"
                  style="margin-top: 4px;"
                >
                  <ion-icon color="primary" name="add-circle-outline"></ion-icon>
                </ion-button>
              </div>

              <!-- Product with Create Option -->
              <div class="field-container-row">
                <ion-item
                  fill="outline"
                  [appTooltip]="'HELP.RECURRING_DEPOSIT_PRODUCT_DESC' | translate"
                  class="flex-grow"
                >
                  <ion-label position="stacked">{{ 'COMMON.PRODUCT' | translate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'COMMON.PRODUCT' | translate"
                    interface="popover"
                    name="productId"
                    [(ngModel)]="account()['productId']"
                    required
                    [disabled]="isEditMode()"
                  >
                    @for (product of products(); track product['id']) {
                      <ion-select-option [value]="product['id']">{{
                        product['name']
                      }}</ion-select-option>
                    }
                    <hr class="divider" />
                    <ion-select-option (click)="onCreateProduct()">
                      <ion-icon
                        color="primary"
                        style="margin-right: 8px;"
                        name="add-circle-outline"
                      ></ion-icon>
                      <span>{{ 'PRODUCTS.CREATE_NEW_PRODUCT' | translate }}</span>
                    </ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-button
                  fill="clear"
                  type="button"
                  [attr.aria-label]="'PRODUCTS.CREATE_RECURRING_DEPOSIT_PRODUCT' | translate"
                  [appTooltip]="'PRODUCTS.CREATE_RECURRING_DEPOSIT_PRODUCT' | translate"
                  (click)="onCreateProduct()"
                  style="margin-top: 4px;"
                  [disabled]="isEditMode()"
                >
                  <ion-icon color="primary" name="add-circle-outline"></ion-icon>
                </ion-button>
              </div>

              <!-- Mandatory Deposit Amount -->
              <ion-item
                fill="outline"
                [appTooltip]="'HELP.RECURRING_DEPOSIT_AMOUNT_DESC' | translate"
              >
                <ion-label position="stacked">{{ 'COMMON.AMOUNT' | translate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.AMOUNT' | translate"
                  type="number"
                  name="mandatoryRecommendedDepositAmount"
                  [(ngModel)]="account()['mandatoryRecommendedDepositAmount']"
                  required
                ></ion-input>
              </ion-item>

              <!-- Submitted On -->
              <ion-item fill="outline" [appTooltip]="'HELP.SUBMITTED_ON_DESC' | translate">
                <ion-label position="stacked">{{ 'COMMON.SUBMITTED_ON' | translate }}</ion-label>
                <ion-datetime-button datetime="submittedOnDate-picker"></ion-datetime-button>
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="submittedOnDate-picker"
                      data-testid="submittedOnDate-picker"
                      presentation="date"
                      name="submittedOnDate"
                      [ngModel]="submittedOnDate()"
                      (ngModelChange)="submittedOnDate.set($event)"
                      required
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>

              <!-- Deposit Period -->
              <ion-item fill="outline" [appTooltip]="'HELP.DEPOSIT_PERIOD_DESC' | translate">
                <ion-label position="stacked">{{ 'COMMON.PERIOD' | translate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.PERIOD' | translate"
                  type="number"
                  name="depositPeriod"
                  [(ngModel)]="account()['depositPeriod']"
                  required
                ></ion-input>
              </ion-item>

              <!-- Period Frequency -->
              <ion-item fill="outline" [appTooltip]="'HELP.PERIOD_FREQUENCY_DESC' | translate">
                <ion-label position="stacked">{{ 'COMMON.FREQUENCY' | translate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'COMMON.FREQUENCY' | translate"
                  interface="popover"
                  name="depositPeriodFrequencyId"
                  [(ngModel)]="account()['depositPeriodFrequencyId']"
                  required
                >
                  <ion-select-option [value]="0">{{ 'COMMON.DAYS' | translate }}</ion-select-option>
                  <ion-select-option [value]="1">{{
                    'COMMON.WEEKS' | translate
                  }}</ion-select-option>
                  <ion-select-option [value]="2">{{
                    'COMMON.MONTHS' | translate
                  }}</ion-select-option>
                  <ion-select-option [value]="3">{{
                    'COMMON.YEARS' | translate
                  }}</ion-select-option>
                </ion-select>
              </ion-item>

              @if (!isEditMode()) {
                <!-- Is Calendar Inherited -->
                <div class="checkbox-container">
                  <ion-checkbox name="isCalendarInherited" [(ngModel)]="isCalendarInherited">
                    {{ 'RECURRING_DEPOSITS.INHERIT_CALENDAR' | translate }}
                  </ion-checkbox>
                  <ion-icon
                    [appTooltip]="'HELP.INHERIT_CALENDAR_DESC' | translate"
                    class="help-icon"
                    name="help-circle-outline"
                  ></ion-icon>
                </div>

                <!-- Recurring Frequency (only if NOT inherited) -->
                @if (!isCalendarInherited) {
                  <ion-item
                    fill="outline"
                    [appTooltip]="'HELP.RECURRING_FREQUENCY_DESC' | translate"
                  >
                    <ion-label position="stacked">{{
                      'RECURRING_DEPOSITS.RECURRING_FREQUENCY' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'RECURRING_DEPOSITS.RECURRING_FREQUENCY' | translate"
                      type="number"
                      name="recurringFrequency"
                      [(ngModel)]="account()['recurringFrequency']"
                      [required]="!isCalendarInherited"
                    ></ion-input>
                  </ion-item>

                  <ion-item fill="outline" [appTooltip]="'HELP.FREQUENCY_TYPE_DESC' | translate">
                    <ion-label position="stacked">{{
                      'RECURRING_DEPOSITS.FREQUENCY_TYPE' | translate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'RECURRING_DEPOSITS.FREQUENCY_TYPE' | translate"
                      interface="popover"
                      name="recurringFrequencyType"
                      [(ngModel)]="account()['recurringFrequencyType']"
                      [required]="!isCalendarInherited"
                    >
                      <ion-select-option [value]="0">{{
                        'COMMON.DAYS' | translate
                      }}</ion-select-option>
                      <ion-select-option [value]="1">{{
                        'COMMON.WEEKS' | translate
                      }}</ion-select-option>
                      <ion-select-option [value]="2">{{
                        'COMMON.MONTHS' | translate
                      }}</ion-select-option>
                      <ion-select-option [value]="3">{{
                        'COMMON.YEARS' | translate
                      }}</ion-select-option>
                    </ion-select>
                  </ion-item>
                }
              }
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="accountForm.invalid || isSaving()"
              >
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
      .recurring-deposit-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
      .checkbox-container {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 60px;
      }
      .help-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #7f8c8d;
        cursor: help;
      }
      .field-container-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .flex-grow {
        flex-grow: 1;
      }
    `,
  ],
})
export class RecurringDepositAccountFormComponent implements OnInit {
  /** Service for term deposit operations */
  private readonly rdService = inject(RecurringDepositAccountService);
  /** Router for post-op navigation */
  private readonly router = inject(Router);
  /** Activated route for editing */
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationService);

  /** Base path for redirection */
  private readonly LIST_PATH = '/products/recurring-deposits';

  /** Account identifier */
  accountId: number | null = null;
  /** Edit mode flag */
  readonly isEditMode = signal(false);
  /** Save state */
  readonly isSaving = signal(false);

  /** Post request model */
  readonly account = signal<Record<string, unknown>>({
    depositPeriodFrequencyId: 2, // Default to Months
    recurringFrequency: 1, // Default to 1
    recurringFrequencyType: 2, // Default to Months
  });
  isCalendarInherited = false;
  /** Submitted date for template binding */
  readonly submittedOnDate = signal(toIsoDate(new Date()));
  /** Available products list */
  readonly products = signal<GetRecurringProductOptions[]>([]);

  /**
   * Component initialization.
   */
  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const clientId = params['clientId'];
      if (clientId) {
        this.account()['clientId'] = +clientId;
        this.loadProducts(this.account()['clientId'] as number);
      } else {
        this.loadProducts();
      }
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.accountId = +id;
        this.isEditMode.set(true);
        this.loadAccountData();
      }
    });
  }

  getClientId(): number | null {
    return (this.account()['clientId'] as number) || null;
  }

  /**
   * Navigates to client registration page.
   */
  onCreateClient() {
    this.router.navigate(['/clients/create']);
  }

  /**
   * Fetches the list of eligible recurring deposit products for the client.
   */
  private loadProducts(clientId?: number): void {
    this.rdService.getRecurringdepositaccountsTemplate(clientId).subscribe({
      next: (template: GetRecurringDepositAccountsTemplateResponse) => {
        if (template && template.productOptions) {
          this.products.set(Array.from(template.productOptions));
        } else {
          this.products.set([]);
        }
      },
      error: () => {
        this.notifications.error('Operation failed. Please try again.');
        this.products.set([]);
      },
    });
  }

  onClientSelected(clientId: number): void {
    this.account()['clientId'] = clientId;
    this.loadProducts(clientId);
  }

  onCreateProduct(): void {
    this.router.navigate(['/products/recurring/create']);
  }

  /**
   * Loads existing account data for editing.
   */
  private loadAccountData(): void {
    if (!this.accountId) return;
    this.rdService.getRecurringdepositaccountsAccountId(this.accountId).subscribe({
      next: (data: GetRecurringDepositAccountsAccountIdResponse) => {
        const dateArray = data.timeline?.submittedOnDate as unknown as number[];
        if (dateArray) {
          this.submittedOnDate.set(
            toIsoDate(new Date(dateArray[0], dateArray[1] - 1, dateArray[2])),
          );
        }
        this.account.set({
          clientId: data.clientId,
          productId: data.savingsProductId,
          mandatoryRecommendedDepositAmount: data.recurringDepositAmount,
          depositPeriod: data.depositPeriod,
          depositPeriodFrequencyId: data.depositPeriodFrequency?.id,
        });
      },
      error: () => this.notifications.error('Operation failed. Please try again.'),
    });
  }

  /**
   * Handles form submission.
   */
  onSubmit(): void {
    this.isSaving.set(true);

    this.account()['submittedOnDate'] = formatDateToFineract(this.submittedOnDate());
    this.account()['dateFormat'] = FINERACT_DATE_FORMAT;
    this.account()['locale'] = FINERACT_LOCALE;

    if (this.isEditMode() && this.accountId) {
      const payload: Record<string, unknown> = {
        depositAmount: this.account()['mandatoryRecommendedDepositAmount'],
        depositPeriod: this.account()['depositPeriod'],
        depositPeriodFrequencyId: this.account()['depositPeriodFrequencyId'],
        locale: FINERACT_LOCALE,
        dateFormat: FINERACT_DATE_FORMAT,
      };

      this.rdService.putRecurringdepositaccountsAccountId(this.accountId, payload).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    } else {
      const payload: Record<string, unknown> = {
        ...this.account(),
        isCalendarInherited: this.isCalendarInherited,
      };

      if (this.isCalendarInherited) {
        delete payload['recurringFrequency'];
        delete payload['recurringFrequencyType'];
      } else {
        if (payload['recurringFrequency'] != null) {
          payload['recurringFrequency'] = Number(payload['recurringFrequency']);
        }
        if (payload['recurringFrequencyType'] != null) {
          payload['recurringFrequencyType'] = Number(payload['recurringFrequencyType']);
        }
      }

      this.rdService
        .postRecurringdepositaccounts(payload as PostRecurringDepositAccountsRequest)
        .subscribe({
          next: () => this.router.navigate([this.LIST_PATH]),
          error: () => this.isSaving.set(false),
        });
    }
  }

  /**
   * Handles user cancellation.
   */
  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
