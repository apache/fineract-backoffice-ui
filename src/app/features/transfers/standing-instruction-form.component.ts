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
} from '@ionic/angular/standalone';
import {
  StandingInstructionsService,
  OfficesService,
  ClientService,
  StandingInstructionCreationRequest,
  GetOfficesResponse,
  GetClientsPageItemsResponse,
  GetStandingInstructionsStandingInstructionIdResponse,
} from '../../api';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatArrayDate,
  toIsoDate,
} from '../../core/utils/date-formatter';

export interface MiniAccount {
  id: number;
  accountNo: string;
  productName: string;
}

@Component({
  selector: 'app-standing-instruction-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonButton,
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
          <ion-card-title>
            {{
              isEditMode
                ? ('CLIENTS.EDIT_STANDING_INSTRUCTION' | translate)
                : ('CLIENTS.CREATE_STANDING_INSTRUCTION' | translate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #instructionForm="ngForm" (ngSubmit)="onSubmit()" class="instruction-form">
            <div class="form-grid">
              <!-- Header Info -->
              <ion-item fill="outline" class="full-width">
                <ion-label position="stacked">{{ 'COMMON.NAME' | translate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.NAME' | translate"
                  name="name"
                  [(ngModel)]="request.name"
                  required
                ></ion-input>
              </ion-item>

              <!-- From Account Section -->
              <div class="section-group">
                <h3>{{ 'CLIENTS.TRANSFER_FROM' | translate }}</h3>
                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'COMMON.OFFICE' | translate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'COMMON.OFFICE' | translate"
                    interface="popover"
                    name="fromOfficeId"
                    [(ngModel)]="request.fromOfficeId"
                    (ionChange)="onOfficeChange('from')"
                    required
                  >
                    @for (office of offices(); track office.id) {
                      <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'COMMON.CLIENT' | translate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'COMMON.CLIENT' | translate"
                    interface="popover"
                    name="fromClientId"
                    [(ngModel)]="request.fromClientId"
                    (ionChange)="onClientChange('from')"
                    required
                  >
                    @for (client of fromClients(); track client.id) {
                      <ion-select-option [value]="client.id">{{
                        client.displayName
                      }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'CLIENTS.ACCOUNT_TYPE' | translate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'CLIENTS.ACCOUNT_TYPE' | translate"
                    interface="popover"
                    name="fromAccountType"
                    [(ngModel)]="request.fromAccountType"
                    (ionChange)="onAccountTypeChange('from')"
                    required
                  >
                    <ion-select-option [value]="'2'">{{
                      'nav.savingsAccounts' | translate
                    }}</ion-select-option>
                    <ion-select-option [value]="'1'">{{
                      'nav.loanAccounts' | translate
                    }}</ion-select-option>
                  </ion-select>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'CLIENTS.ACCOUNT_NO' | translate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'CLIENTS.ACCOUNT_NO' | translate"
                    interface="popover"
                    name="fromAccountId"
                    [(ngModel)]="request.fromAccountId"
                    required
                  >
                    @for (account of fromAccounts(); track account.id) {
                      <ion-select-option [value]="account.id"
                        >{{ account.accountNo }} ({{ account.productName }})</ion-select-option
                      >
                    }
                  </ion-select>
                </ion-item>
              </div>

              <!-- To Account Section -->
              <div class="section-group">
                <h3>{{ 'CLIENTS.TRANSFER_TO' | translate }}</h3>
                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'COMMON.OFFICE' | translate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'COMMON.OFFICE' | translate"
                    interface="popover"
                    name="toOfficeId"
                    [(ngModel)]="request.toOfficeId"
                    (ionChange)="onOfficeChange('to')"
                    required
                  >
                    @for (office of offices(); track office.id) {
                      <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'COMMON.CLIENT' | translate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'COMMON.CLIENT' | translate"
                    interface="popover"
                    name="toClientId"
                    [(ngModel)]="request.toClientId"
                    (ionChange)="onClientChange('to')"
                    required
                  >
                    @for (client of toClients(); track client.id) {
                      <ion-select-option [value]="client.id">{{
                        client.displayName
                      }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'CLIENTS.ACCOUNT_TYPE' | translate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'CLIENTS.ACCOUNT_TYPE' | translate"
                    interface="popover"
                    name="toAccountType"
                    [(ngModel)]="request.toAccountType"
                    (ionChange)="onAccountTypeChange('to')"
                    required
                  >
                    <ion-select-option [value]="'2'">{{
                      'nav.savingsAccounts' | translate
                    }}</ion-select-option>
                    <ion-select-option [value]="'1'">{{
                      'nav.loanAccounts' | translate
                    }}</ion-select-option>
                  </ion-select>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'CLIENTS.ACCOUNT_NO' | translate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'CLIENTS.ACCOUNT_NO' | translate"
                    interface="popover"
                    name="toAccountId"
                    [(ngModel)]="request.toAccountId"
                    required
                  >
                    @for (account of toAccounts(); track account.id) {
                      <ion-select-option [value]="account.id"
                        >{{ account.accountNo }} ({{ account.productName }})</ion-select-option
                      >
                    }
                  </ion-select>
                </ion-item>
              </div>

              <!-- Transfer Details -->
              <div class="section-group full-width details-row">
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'CLIENTS.TRANSFER_TYPE' | translate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'CLIENTS.TRANSFER_TYPE' | translate"
                    interface="popover"
                    name="transferType"
                    [(ngModel)]="request.transferType"
                    required
                  >
                    <ion-select-option [value]="'1'">Account Transfer</ion-select-option>
                    <ion-select-option [value]="'2'">Loan Repayment</ion-select-option>
                  </ion-select>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'COMMON.AMOUNT' | translate }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'COMMON.AMOUNT' | translate"
                    type="number"
                    name="amount"
                    [(ngModel)]="request.amount"
                    required
                  ></ion-input>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'CLIENTS.INSTRUCTION_TYPE' | translate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'CLIENTS.INSTRUCTION_TYPE' | translate"
                    interface="popover"
                    name="instructionType"
                    [(ngModel)]="request.instructionType"
                    required
                  >
                    <ion-select-option [value]="'1'">Fixed</ion-select-option>
                    <ion-select-option [value]="'2'">Dues</ion-select-option>
                  </ion-select>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'COMMON.PRIORITY' | translate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'COMMON.PRIORITY' | translate"
                    interface="popover"
                    name="priority"
                    [(ngModel)]="request.priority"
                    required
                  >
                    <ion-select-option [value]="'1'">High</ion-select-option>
                    <ion-select-option [value]="'2'">Medium</ion-select-option>
                    <ion-select-option [value]="'3'">Low</ion-select-option>
                  </ion-select>
                </ion-item>
              </div>

              <!-- Recurrence -->
              <div class="section-group full-width recurrence-row">
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'CLIENTS.RECURRENCE_TYPE' | translate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'CLIENTS.RECURRENCE_TYPE' | translate"
                    interface="popover"
                    name="recurrenceType"
                    [(ngModel)]="request.recurrenceType"
                    required
                  >
                    <ion-select-option [value]="'1'">Periodic</ion-select-option>
                  </ion-select>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'CLIENTS.RECURRENCE_FREQUENCY' | translate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'CLIENTS.RECURRENCE_FREQUENCY' | translate"
                    interface="popover"
                    name="recurrenceFrequency"
                    [(ngModel)]="request.recurrenceFrequency"
                    required
                  >
                    <ion-select-option [value]="'1'">Days</ion-select-option>
                    <ion-select-option [value]="'2'">Weeks</ion-select-option>
                    <ion-select-option [value]="'3'">Months</ion-select-option>
                    <ion-select-option [value]="'4'">Years</ion-select-option>
                  </ion-select>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'CLIENTS.RECURRENCE_INTERVAL' | translate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'CLIENTS.RECURRENCE_INTERVAL' | translate"
                    type="number"
                    name="recurrenceInterval"
                    [(ngModel)]="request.recurrenceInterval"
                    required
                  ></ion-input>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'CLIENTS.VALID_FROM' | translate }}</ion-label>
                  <ion-datetime-button datetime="validFrom-picker"></ion-datetime-button>
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="validFrom-picker"
                        data-testid="validFrom-picker"
                        presentation="date"
                        name="validFrom"
                        [(ngModel)]="validFrom"
                        required
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'CLIENTS.VALID_TILL' | translate }}</ion-label>
                  <ion-datetime-button datetime="validTill-picker"></ion-datetime-button>
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="validTill-picker"
                        data-testid="validTill-picker"
                        presentation="date"
                        name="validTill"
                        [(ngModel)]="validTill"
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>
              </div>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()">
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="!instructionForm.form.valid">
                {{ 'COMMON.SAVE' | translate }}
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
        max-width: 1200px;
        margin: 0 auto;
      }
      .instruction-form {
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding-top: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
      }
      .section-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .section-group h3 {
        margin: 0 0 8px 0;
        color: var(--primary-color);
        border-bottom: 1px solid #eee;
        padding-bottom: 4px;
      }
      .details-row,
      .recurrence-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        border-top: 1px dashed #ccc;
        padding-top: 24px;
      }
      .recurrence-row {
        grid-template-columns: repeat(5, 1fr);
      }
    `,
  ],
})
export class StandingInstructionFormComponent implements OnInit {
  private readonly instructionsService = inject(StandingInstructionsService);
  private readonly officesService = inject(OfficesService);
  private readonly clientService = inject(ClientService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly instructionsPath = '/transfers/standing-instructions';

  isEditMode = false;
  instructionId?: number;
  readonly offices = signal<GetOfficesResponse[]>([]);
  readonly fromClients = signal<GetClientsPageItemsResponse[]>([]);
  readonly toClients = signal<GetClientsPageItemsResponse[]>([]);
  readonly fromAccounts = signal<MiniAccount[]>([]);
  readonly toAccounts = signal<MiniAccount[]>([]);

  validFrom = toIsoDate(new Date());
  validTill?: Date;

  request: StandingInstructionCreationRequest = {
    name: '',
    fromOfficeId: undefined,
    fromClientId: undefined,
    fromAccountType: '2',
    fromAccountId: undefined,
    toOfficeId: undefined,
    toClientId: undefined,
    toAccountType: '2',
    toAccountId: undefined,
    transferType: '1',
    amount: '',
    instructionType: '1',
    priority: '2',
    recurrenceType: '1',
    recurrenceFrequency: '3',
    recurrenceInterval: '1',
    status: '1',
  };

  ngOnInit(): void {
    this.loadOffices();
    this.instructionId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.instructionId) {
      this.isEditMode = true;
      this.loadInstructionData();
    }
  }

  loadOffices(): void {
    this.officesService.getOffices().subscribe((data) => {
      this.offices.set(data);
      if (!this.isEditMode && data.length > 0) {
        this.request.fromOfficeId = data[0].id?.toString();
        this.request.toOfficeId = data[0].id?.toString();
        this.onOfficeChange('from');
        this.onOfficeChange('to');
      }
    });
  }

  loadInstructionData(): void {
    this.instructionsService
      .getStandinginstructionsStandingInstructionId(this.instructionId!)
      .subscribe((data: GetStandingInstructionsStandingInstructionIdResponse) => {
        this.populateRequest(data);
        this.populateDates(data);
        this.onOfficeChange('from');
        this.onOfficeChange('to');
      });
  }

  private populateRequest(data: GetStandingInstructionsStandingInstructionIdResponse): void {
    this.request = {
      name: data.name,
      fromOfficeId: data.fromOffice?.id?.toString(),
      fromClientId: data.fromClient?.id?.toString(),
      fromAccountType: data.fromAccountType?.id?.toString(),
      fromAccountId: data.fromAccount?.id?.toString(),
      toOfficeId: data.toOffice?.id?.toString(),
      toClientId: data.toClient?.id?.toString(),
      toAccountType: data.toAccountType?.id?.toString(),
      toAccountId: data.toAccount?.id?.toString(),
      transferType: data.transferType?.id?.toString(),
      amount: data.amount?.toString(),
      instructionType: data.instructionType?.id?.toString(),
      priority: data.priority?.id?.toString(),
      recurrenceType: data.recurrenceType?.id?.toString(),
      recurrenceFrequency: data.recurrenceFrequency?.id?.toString(),
      recurrenceInterval: data.recurrenceInterval?.toString(),
      status: data.status?.id?.toString(),
    };
  }

  private populateDates(data: GetStandingInstructionsStandingInstructionIdResponse): void {
    if (data.validFrom) {
      this.validFrom = formatArrayDate(data.validFrom);
    }
    const rawData = data as unknown as Record<string, unknown>;
    if (rawData['validTill']) {
      const vt = rawData['validTill'] as unknown as number[];
      this.validTill = new Date(vt[0], vt[1] - 1, vt[2]);
    }
  }

  onOfficeChange(type: 'from' | 'to'): void {
    const officeIdStr = type === 'from' ? this.request.fromOfficeId : this.request.toOfficeId;
    const officeId = officeIdStr ? Number(officeIdStr) : undefined;
    if (!officeId) return;
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

  onSubmit(): void {
    const payload = this.buildPayload();

    if (this.isEditMode) {
      this.updateInstruction(payload);
    } else {
      this.createInstruction(payload);
    }
  }

  private buildPayload(): StandingInstructionCreationRequest {
    const payload = this.mapBasicFields();
    return {
      ...payload,
      validFrom: formatDateToFineract(this.validFrom),
      validTill: this.validTill ? formatDateToFineract(this.validTill) : undefined,
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
      monthDayFormat: 'dd MMMM',
    };
  }

  private mapBasicFields(): Partial<StandingInstructionCreationRequest> {
    return {
      ...this.mapAccountFields(),
      ...this.mapRuleFields(),
    };
  }

  private mapAccountFields(): Partial<StandingInstructionCreationRequest> {
    return {
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
    };
  }

  private mapRuleFields(): Partial<StandingInstructionCreationRequest> {
    return {
      name: this.request.name,
      transferType: this.request.transferType ? String(this.request.transferType) : undefined,
      amount: this.request.amount ? String(this.request.amount) : undefined,
      instructionType: this.request.instructionType
        ? String(this.request.instructionType)
        : undefined,
      priority: this.request.priority ? String(this.request.priority) : undefined,
      recurrenceType: this.request.recurrenceType ? String(this.request.recurrenceType) : undefined,
      recurrenceFrequency: this.request.recurrenceFrequency
        ? String(this.request.recurrenceFrequency)
        : undefined,
      recurrenceInterval: this.request.recurrenceInterval
        ? String(this.request.recurrenceInterval)
        : undefined,
      status: this.request.status ? String(this.request.status) : undefined,
    };
  }

  private updateInstruction(payload: StandingInstructionCreationRequest): void {
    this.instructionsService
      .putStandinginstructionsStandingInstructionId(this.instructionId!, undefined, payload)
      .subscribe({
        next: () => this.router.navigate([this.instructionsPath]),
        error: (err) => console.error('Update failed', err),
      });
  }

  private createInstruction(payload: StandingInstructionCreationRequest): void {
    this.instructionsService.postStandinginstructions(payload).subscribe({
      next: () => this.router.navigate([this.instructionsPath]),
      error: (err) => console.error('Creation failed', err),
    });
  }

  onCancel(): void {
    this.router.navigate([this.instructionsPath]);
  }
}
