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
import { TranslatePipe } from '../../core/adapters';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonTextarea,
  IonButton,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
  IonNote,
} from '@ionic/angular/standalone';
import {
  AccountTransfersService,
  OfficesService,
  ClientService,
  AccountTransferRequest,
  GetOfficesResponse,
  GetClientsPageItemsResponse,
} from '../../api';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../core/utils/date-formatter';
import { createPickersReady } from '../../shared/utils/pickers-ready';

export interface MiniAccount {
  id: number;
  accountNo: string;
  productName: string;
}

@Component({
  selector: 'app-account-transfer-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonInput,
    IonTextarea,
    IonButton,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonNote,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'ACTIONS.ACCOUNT_TRANSFER' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #transferForm="ngForm" (ngSubmit)="onSubmit()" class="transfer-form">
            <ion-grid class="ion-no-padding">
              <ion-row>
                <!-- From Account Section -->
                <ion-col size="12" size-md="6">
                  <div class="section">
                    <h3>{{ 'CLIENTS.TRANSFER_FROM' | appTranslate }}</h3>
                    <ion-item fill="outline">
                      <ion-label position="stacked"
                        >{{ 'COMMON.OFFICE' | appTranslate
                        }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                      >
                      <ion-select
                        [attr.aria-label]="'COMMON.OFFICE' | appTranslate"
                        interface="popover"
                        name="fromOfficeId"
                        #fromOfficeIdModel="ngModel"
                        [(ngModel)]="request.fromOfficeId"
                        (ionChange)="onOfficeChange('from')"
                        (ionBlur)="fromOfficeIdModel.control.markAsTouched()"
                        required
                        id="transfer-from-office-select"
                        data-testid="transfer-from-office-select"
                        [attr.aria-invalid]="fromOfficeIdModel.invalid && fromOfficeIdModel.touched"
                        [attr.aria-describedby]="
                          fromOfficeIdModel.invalid && fromOfficeIdModel.touched
                            ? 'transfer-from-office-error'
                            : null
                        "
                      >
                        @for (office of offices(); track office.id) {
                          <ion-select-option [value]="office.id">{{
                            office.name
                          }}</ion-select-option>
                        }
                      </ion-select>
                    </ion-item>
                    @if (fromOfficeIdModel.invalid && fromOfficeIdModel.touched) {
                      <ion-note
                        color="danger"
                        class="field-error"
                        id="transfer-from-office-error"
                        role="alert"
                        data-testid="transfer-from-office-error"
                        >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                      >
                    }

                    <ion-item fill="outline">
                      <ion-label position="stacked"
                        >{{ 'COMMON.CLIENT' | appTranslate
                        }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                      >
                      <ion-select
                        [attr.aria-label]="'COMMON.CLIENT' | appTranslate"
                        interface="popover"
                        name="fromClientId"
                        #fromClientIdModel="ngModel"
                        [(ngModel)]="request.fromClientId"
                        (ionChange)="onClientChange('from')"
                        (ionBlur)="fromClientIdModel.control.markAsTouched()"
                        required
                        id="transfer-from-client-select"
                        data-testid="transfer-from-client-select"
                        [attr.aria-invalid]="fromClientIdModel.invalid && fromClientIdModel.touched"
                        [attr.aria-describedby]="
                          fromClientIdModel.invalid && fromClientIdModel.touched
                            ? 'transfer-from-client-error'
                            : null
                        "
                      >
                        @for (client of fromClients(); track client.id) {
                          <ion-select-option [value]="client.id">{{
                            client.displayName
                          }}</ion-select-option>
                        }
                      </ion-select>
                    </ion-item>
                    @if (fromClientIdModel.invalid && fromClientIdModel.touched) {
                      <ion-note
                        color="danger"
                        class="field-error"
                        id="transfer-from-client-error"
                        role="alert"
                        data-testid="transfer-from-client-error"
                        >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                      >
                    }

                    <ion-item fill="outline">
                      <ion-label position="stacked"
                        >{{ 'CLIENTS.ACCOUNT_TYPE' | appTranslate
                        }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                      >
                      <ion-select
                        [attr.aria-label]="'CLIENTS.ACCOUNT_TYPE' | appTranslate"
                        interface="popover"
                        name="fromAccountType"
                        #fromAccountTypeModel="ngModel"
                        [(ngModel)]="request.fromAccountType"
                        (ionChange)="onAccountTypeChange('from')"
                        (ionBlur)="fromAccountTypeModel.control.markAsTouched()"
                        required
                        id="transfer-from-account-type-select"
                        data-testid="transfer-from-account-type-select"
                        [attr.aria-invalid]="
                          fromAccountTypeModel.invalid && fromAccountTypeModel.touched
                        "
                        [attr.aria-describedby]="
                          fromAccountTypeModel.invalid && fromAccountTypeModel.touched
                            ? 'transfer-from-account-type-error'
                            : null
                        "
                      >
                        <ion-select-option [value]="'2'">{{
                          'nav.savingsAccounts' | appTranslate
                        }}</ion-select-option>
                        <ion-select-option [value]="'1'">{{
                          'nav.loanAccounts' | appTranslate
                        }}</ion-select-option>
                      </ion-select>
                    </ion-item>
                    @if (fromAccountTypeModel.invalid && fromAccountTypeModel.touched) {
                      <ion-note
                        color="danger"
                        class="field-error"
                        id="transfer-from-account-type-error"
                        role="alert"
                        data-testid="transfer-from-account-type-error"
                        >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                      >
                    }

                    <ion-item fill="outline">
                      <ion-label position="stacked"
                        >{{ 'CLIENTS.ACCOUNT_NO' | appTranslate
                        }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                      >
                      <ion-select
                        [attr.aria-label]="'CLIENTS.ACCOUNT_NO' | appTranslate"
                        interface="popover"
                        name="fromAccountId"
                        #fromAccountIdModel="ngModel"
                        [(ngModel)]="request.fromAccountId"
                        (ionBlur)="fromAccountIdModel.control.markAsTouched()"
                        required
                        id="transfer-from-account-select"
                        data-testid="transfer-from-account-select"
                        [attr.aria-invalid]="
                          fromAccountIdModel.invalid && fromAccountIdModel.touched
                        "
                        [attr.aria-describedby]="
                          fromAccountIdModel.invalid && fromAccountIdModel.touched
                            ? 'transfer-from-account-error'
                            : null
                        "
                      >
                        @for (account of fromAccounts(); track account.id) {
                          <ion-select-option [value]="account.id"
                            >{{ account.accountNo }} ({{ account.productName }})</ion-select-option
                          >
                        }
                      </ion-select>
                    </ion-item>
                    @if (fromAccountIdModel.invalid && fromAccountIdModel.touched) {
                      <ion-note
                        color="danger"
                        class="field-error"
                        id="transfer-from-account-error"
                        role="alert"
                        data-testid="transfer-from-account-error"
                        >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                      >
                    }
                  </div>
                </ion-col>

                <!-- To Account Section -->
                <ion-col size="12" size-md="6">
                  <div class="section">
                    <h3>{{ 'CLIENTS.TRANSFER_TO' | appTranslate }}</h3>
                    <ion-item fill="outline">
                      <ion-label position="stacked"
                        >{{ 'COMMON.OFFICE' | appTranslate
                        }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                      >
                      <ion-select
                        [attr.aria-label]="'COMMON.OFFICE' | appTranslate"
                        interface="popover"
                        name="toOfficeId"
                        #toOfficeIdModel="ngModel"
                        [(ngModel)]="request.toOfficeId"
                        (ionChange)="onOfficeChange('to')"
                        (ionBlur)="toOfficeIdModel.control.markAsTouched()"
                        required
                        id="transfer-to-office-select"
                        data-testid="transfer-to-office-select"
                        [attr.aria-invalid]="toOfficeIdModel.invalid && toOfficeIdModel.touched"
                        [attr.aria-describedby]="
                          toOfficeIdModel.invalid && toOfficeIdModel.touched
                            ? 'transfer-to-office-error'
                            : null
                        "
                      >
                        @for (office of offices(); track office.id) {
                          <ion-select-option [value]="office.id">{{
                            office.name
                          }}</ion-select-option>
                        }
                      </ion-select>
                    </ion-item>
                    @if (toOfficeIdModel.invalid && toOfficeIdModel.touched) {
                      <ion-note
                        color="danger"
                        class="field-error"
                        id="transfer-to-office-error"
                        role="alert"
                        data-testid="transfer-to-office-error"
                        >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                      >
                    }

                    <ion-item fill="outline">
                      <ion-label position="stacked"
                        >{{ 'COMMON.CLIENT' | appTranslate
                        }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                      >
                      <ion-select
                        [attr.aria-label]="'COMMON.CLIENT' | appTranslate"
                        interface="popover"
                        name="toClientId"
                        #toClientIdModel="ngModel"
                        [(ngModel)]="request.toClientId"
                        (ionChange)="onClientChange('to')"
                        (ionBlur)="toClientIdModel.control.markAsTouched()"
                        required
                        id="transfer-to-client-select"
                        data-testid="transfer-to-client-select"
                        [attr.aria-invalid]="toClientIdModel.invalid && toClientIdModel.touched"
                        [attr.aria-describedby]="
                          toClientIdModel.invalid && toClientIdModel.touched
                            ? 'transfer-to-client-error'
                            : null
                        "
                      >
                        @for (client of toClients(); track client.id) {
                          <ion-select-option [value]="client.id">{{
                            client.displayName
                          }}</ion-select-option>
                        }
                      </ion-select>
                    </ion-item>
                    @if (toClientIdModel.invalid && toClientIdModel.touched) {
                      <ion-note
                        color="danger"
                        class="field-error"
                        id="transfer-to-client-error"
                        role="alert"
                        data-testid="transfer-to-client-error"
                        >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                      >
                    }

                    <ion-item fill="outline">
                      <ion-label position="stacked"
                        >{{ 'CLIENTS.ACCOUNT_TYPE' | appTranslate
                        }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                      >
                      <ion-select
                        [attr.aria-label]="'CLIENTS.ACCOUNT_TYPE' | appTranslate"
                        interface="popover"
                        name="toAccountType"
                        #toAccountTypeModel="ngModel"
                        [(ngModel)]="request.toAccountType"
                        (ionChange)="onAccountTypeChange('to')"
                        (ionBlur)="toAccountTypeModel.control.markAsTouched()"
                        required
                        id="transfer-to-account-type-select"
                        data-testid="transfer-to-account-type-select"
                        [attr.aria-invalid]="
                          toAccountTypeModel.invalid && toAccountTypeModel.touched
                        "
                        [attr.aria-describedby]="
                          toAccountTypeModel.invalid && toAccountTypeModel.touched
                            ? 'transfer-to-account-type-error'
                            : null
                        "
                      >
                        <ion-select-option [value]="'2'">{{
                          'nav.savingsAccounts' | appTranslate
                        }}</ion-select-option>
                        <ion-select-option [value]="'1'">{{
                          'nav.loanAccounts' | appTranslate
                        }}</ion-select-option>
                      </ion-select>
                    </ion-item>
                    @if (toAccountTypeModel.invalid && toAccountTypeModel.touched) {
                      <ion-note
                        color="danger"
                        class="field-error"
                        id="transfer-to-account-type-error"
                        role="alert"
                        data-testid="transfer-to-account-type-error"
                        >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                      >
                    }

                    <ion-item fill="outline">
                      <ion-label position="stacked"
                        >{{ 'CLIENTS.ACCOUNT_NO' | appTranslate
                        }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                      >
                      <ion-select
                        [attr.aria-label]="'CLIENTS.ACCOUNT_NO' | appTranslate"
                        interface="popover"
                        name="toAccountId"
                        #toAccountIdModel="ngModel"
                        [(ngModel)]="request.toAccountId"
                        (ionBlur)="toAccountIdModel.control.markAsTouched()"
                        required
                        id="transfer-to-account-select"
                        data-testid="transfer-to-account-select"
                        [attr.aria-invalid]="toAccountIdModel.invalid && toAccountIdModel.touched"
                        [attr.aria-describedby]="
                          toAccountIdModel.invalid && toAccountIdModel.touched
                            ? 'transfer-to-account-error'
                            : null
                        "
                      >
                        @for (account of toAccounts(); track account.id) {
                          <ion-select-option [value]="account.id"
                            >{{ account.accountNo }} ({{ account.productName }})</ion-select-option
                          >
                        }
                      </ion-select>
                    </ion-item>
                    @if (toAccountIdModel.invalid && toAccountIdModel.touched) {
                      <ion-note
                        color="danger"
                        class="field-error"
                        id="transfer-to-account-error"
                        role="alert"
                        data-testid="transfer-to-account-error"
                        >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                      >
                    }
                  </div>
                </ion-col>
              </ion-row>
            </ion-grid>

            <div class="transfer-details">
              <div class="field">
                <ion-item fill="outline">
                  <ion-label position="stacked"
                    >{{ 'CLIENTS.TRANSFER_AMOUNT' | appTranslate
                    }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                  >
                  <ion-input
                    [attr.aria-label]="'CLIENTS.TRANSFER_AMOUNT' | appTranslate"
                    type="number"
                    name="transferAmount"
                    #transferAmountModel="ngModel"
                    [(ngModel)]="request.transferAmount"
                    (ionBlur)="transferAmountModel.control.markAsTouched()"
                    required
                    id="transfer-amount-input"
                    data-testid="transfer-amount-input"
                    [attr.aria-invalid]="transferAmountModel.invalid && transferAmountModel.touched"
                    [attr.aria-describedby]="
                      transferAmountModel.invalid && transferAmountModel.touched
                        ? 'transfer-amount-error'
                        : null
                    "
                  ></ion-input>
                </ion-item>
                @if (transferAmountModel.invalid && transferAmountModel.touched) {
                  <ion-note
                    color="danger"
                    class="field-error"
                    id="transfer-amount-error"
                    role="alert"
                    data-testid="transfer-amount-error"
                    >{{ 'COMMON.REQUIRED' | appTranslate }}</ion-note
                  >
                }
              </div>

              <div class="field">
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'CLIENTS.TRANSFER_DATE' | appTranslate
                  }}</ion-label>
                  @if (pickersReady()) {
                    <ion-datetime-button datetime="transfer-date-picker"></ion-datetime-button>
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="transfer-date-picker"
                        data-testid="transfer-date-picker"
                        presentation="date"
                        (ionChange)="onTransferDateChange($event)"
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>
              </div>

              <ion-item fill="outline" class="full-width">
                <ion-label position="stacked">{{ 'COMMON.DESCRIPTION' | appTranslate }}</ion-label>
                <ion-textarea
                  [attr.aria-label]="'COMMON.DESCRIPTION' | appTranslate"
                  name="transferDescription"
                  [(ngModel)]="request.transferDescription"
                  rows="2"
                  id="transfer-description-input"
                  data-testid="transfer-description-input"
                ></ion-textarea>
              </ion-item>
            </div>

            <div class="form-actions">
              <ion-button
                fill="clear"
                color="medium"
                type="button"
                (click)="onCancel()"
                id="transfer-cancel-btn"
                data-testid="transfer-cancel-btn"
              >
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="!transferForm.form.valid"
                id="transfer-submit-btn"
                data-testid="transfer-submit-btn"
              >
                {{ 'COMMON.CONFIRM' | appTranslate }}
              </ion-button>
            </div>
            @if (!transferForm.form.valid) {
              <ion-note
                color="medium"
                class="submit-hint"
                data-testid="transfer-submit-hint"
                aria-live="polite"
                >{{ 'COMMON.COMPLETE_REQUIRED_FIELDS' | appTranslate }}</ion-note
              >
            }
          </form>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 24px;
        max-width: 1000px;
        margin: 0 auto;
      }
      .transfer-form {
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding-top: 16px;
      }
      .transfer-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
      }
      .section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .section h3 {
        margin: 0 0 8px 0;
        color: var(--primary-text);
        border-bottom: 1px solid #eee;
        padding-bottom: 4px;
      }
      .transfer-details {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        border-top: 1px dashed #ccc;
        padding-top: 24px;
      }
      /* One grid cell per field, amount/date included, so an error message rendered
         underneath a field never shifts its neighbour into the next cell. */
      .field {
        display: flex;
        flex-direction: column;
      }
      .required-marker {
        color: var(--ion-color-danger, #eb445a);
        margin-inline-start: 2px;
      }
      .field-error {
        display: block;
        padding-inline-start: 4px;
        margin-top: -4px;
        font-size: 0.8125rem;
      }
      .submit-hint {
        display: block;
        text-align: end;
        font-size: 0.8125rem;
      }
    `,
  ],
})
export class AccountTransferFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly transfersService = inject(AccountTransfersService);
  private readonly officesService = inject(OfficesService);
  private readonly clientService = inject(ClientService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly offices = signal<GetOfficesResponse[]>([]);
  readonly fromClients = signal<GetClientsPageItemsResponse[]>([]);
  readonly toClients = signal<GetClientsPageItemsResponse[]>([]);
  readonly fromAccounts = signal<MiniAccount[]>([]);
  readonly toAccounts = signal<MiniAccount[]>([]);

  transferDate = new Date();
  request: AccountTransferRequest = {
    fromOfficeId: undefined,
    fromClientId: undefined,
    fromAccountType: '2',
    fromAccountId: undefined,
    toOfficeId: undefined,
    toClientId: undefined,
    toAccountType: '2',
    toAccountId: undefined,
    transferAmount: '',
    transferDescription: '',
  };

  ngOnInit(): void {
    this.loadOffices();
    const queryParams = this.route.snapshot.queryParams;
    if (queryParams['fromOfficeId'])
      this.request.fromOfficeId = queryParams['fromOfficeId']?.toString();
    if (queryParams['fromClientId']) {
      this.request.fromClientId = queryParams['fromClientId']?.toString();
      this.onClientChange('from');
    }
    if (queryParams['fromAccountId'])
      this.request.fromAccountId = queryParams['fromAccountId']?.toString();
    if (queryParams['fromAccountType'])
      this.request.fromAccountType = queryParams['fromAccountType']?.toString();
  }

  loadOffices(): void {
    this.officesService.getOffices().subscribe((data) => {
      this.offices.set(data);
      if (!this.request.fromOfficeId && data.length > 0) {
        this.request.fromOfficeId = data[0].id?.toString();
        this.onOfficeChange('from');
      }
      if (!this.request.toOfficeId && data.length > 0) {
        this.request.toOfficeId = data[0].id?.toString();
        this.onOfficeChange('to');
      }
    });
  }

  onOfficeChange(type: 'from' | 'to'): void {
    const officeIdStr = type === 'from' ? this.request.fromOfficeId : this.request.toOfficeId;
    const officeId = officeIdStr ? Number(officeIdStr) : undefined;
    this.clientService
      .getClients(
        officeId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )
      .subscribe((data) => {
        if (type === 'from') {
          this.fromClients.set(Array.from(data.pageItems || []));
        } else {
          this.toClients.set(Array.from(data.pageItems || []));
        }
      });
  }

  onClientChange(type: 'from' | 'to'): void {
    this.onAccountTypeChange(type);
  }

  onAccountTypeChange(type: 'from' | 'to'): void {
    const clientId =
      type === 'from' ? Number(this.request.fromClientId) : Number(this.request.toClientId);
    const accountType = type === 'from' ? this.request.fromAccountType : this.request.toAccountType;

    if (!clientId) return;

    this.clientService.getClientsClientIdAccounts(clientId).subscribe((data) => {
      if (accountType === '2') {
        const savings = Array.from(data.savingsAccounts || []) as unknown as MiniAccount[];
        if (type === 'from') this.fromAccounts.set(savings);
        else this.toAccounts.set(savings);
      } else {
        const loans = Array.from(data.loanAccounts || []) as unknown as MiniAccount[];
        if (type === 'from') this.fromAccounts.set(loans);
        else this.toAccounts.set(loans);
      }
    });
  }

  onTransferDateChange(event: CustomEvent): void {
    if (event.detail.value) {
      this.transferDate = new Date(event.detail.value as string);
    }
  }

  onSubmit(): void {
    const payload: AccountTransferRequest = {
      fromOfficeId: this.request.fromOfficeId ? String(this.request.fromOfficeId) : undefined,
      fromClientId: this.request.fromClientId ? String(this.request.fromClientId) : undefined,
      fromAccountType: this.request.fromAccountType
        ? String(this.request.fromAccountType)
        : undefined,
      fromAccountId: this.request.fromAccountId ? String(this.request.fromAccountId) : undefined,
      toOfficeId: this.request.toOfficeId ? String(this.request.toOfficeId) : undefined,
      toClientId: this.request.toClientId ? String(this.request.toClientId) : undefined,
      toAccountType: this.request.toAccountType ? String(this.request.toAccountType) : undefined,
      toAccountId: this.request.toAccountId ? String(this.request.toAccountId) : undefined,
      transferAmount: this.request.transferAmount ? String(this.request.transferAmount) : undefined,
      transferDescription: this.request.transferDescription,
      transferDate: formatDateToFineract(this.transferDate),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };

    this.transfersService.postAccounttransfers(payload).subscribe({
      next: () => {
        this.router.navigate(['/clients/view', this.request.fromClientId]);
      },
      error: (err) => console.error('Transfer failed', err),
    });
  }

  onCancel(): void {
    if (this.request.fromClientId) {
      this.router.navigate(['/clients/view', this.request.fromClientId]);
    } else {
      this.router.navigate(['/clients']);
    }
  }
}
