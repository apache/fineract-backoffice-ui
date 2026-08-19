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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonIcon,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol,
} from '@ionic/angular/standalone';
import { ClientSearchComponent, HelpIconComponent } from '../../../shared';
import {
  ShareAccountService,
  AccountRequest,
  PutAccountsTypeAccountIdRequest,
  GetAccountsTypeAccountIdResponse,
  GetAccountsTypeProductOptions,
  SavingsAccountData,
} from '../../../api';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../../core/utils/date-formatter';
import { DatePipe } from '@angular/common';

interface ShareAccountTemplateResponse {
  productOptions?: Set<GetAccountsTypeProductOptions>;
  clientSavingsAccounts?: SavingsAccountData[];
}

@Component({
  selector: 'app-share-account-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonIcon,
    IonSpinner,
    IonGrid,
    IonRow,
    IonCol,
    DatePipe,
    ClientSearchComponent,
    HelpIconComponent,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('SHARE_ACCOUNTS.EDIT' | translate)
                : ('SHARE_ACCOUNTS.CREATE' | translate)
            }}
            <app-help-icon [helpTextKey]="'HELP.SHARE_ACCOUNTS_DESC'"></app-help-icon>
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          @if (!isEditMode()) {
            <div class="info-banner">
              <ion-icon name="information-circle-outline" class="info-banner-icon"></ion-icon>
              <div class="info-banner-content">
                <strong>{{ 'SHARE_ACCOUNTS.PREREQUISITES_TITLE' | translate }}</strong>
                <ol class="prereq-list">
                  <li>{{ 'SHARE_ACCOUNTS.PREREQ_CLIENT' | translate }}</li>
                  <li>{{ 'SHARE_ACCOUNTS.PREREQ_SAVINGS' | translate }}</li>
                  <li>{{ 'SHARE_ACCOUNTS.PREREQ_PRODUCT' | translate }}</li>
                </ol>
              </div>
            </div>
          }

          <form #shareForm="ngForm" (ngSubmit)="onSubmit()" class="share-account-form">
            <ion-grid>
              <ion-row>
                <!-- Client Search with Create Option -->
                <ion-col size="12" size-md="6">
                  <div class="field-container-row">
                    <app-client-search
                      [label]="'COMMON.CLIENT' | translate"
                      [required]="true"
                      [initialClientId]="account().clientId || null"
                      (clientSelected)="onClientSelected($event)"
                      class="flex-grow"
                    >
                    </app-client-search>
                    <ion-button
                      id="share-account-client-add-btn"
                      data-testid="share-account-client-add-btn"
                      fill="clear"
                      color="primary"
                      type="button"
                      (click)="onCreateClient()"
                      [attr.aria-label]="'SHARE_ACCOUNTS.CREATE_CLIENT' | translate"
                    >
                      <ion-icon name="add-circle-outline" slot="icon-only"></ion-icon>
                    </ion-button>
                  </div>
                </ion-col>

                <!-- Product with Create Option -->
                <ion-col size="12" size-md="6">
                  <div class="field-container-row">
                    <ion-item fill="outline" class="form-item flex-grow">
                      <ion-label position="stacked">{{ 'COMMON.PRODUCT' | translate }}</ion-label>
                      <ion-select
                        [attr.aria-label]="'COMMON.PRODUCT' | translate"
                        interface="popover"
                        id="share-account-product-select"
                        data-testid="share-account-product-select"
                        name="productId"
                        [(ngModel)]="account().productId"
                        (ionChange)="onProductSelected($event.detail.value)"
                        required
                        [disabled]="isEditMode()"
                      >
                        @for (product of products(); track product.id) {
                          <ion-select-option [value]="product.id">{{
                            product.name
                          }}</ion-select-option>
                        }
                      </ion-select>
                    </ion-item>
                    <ion-button
                      id="share-account-product-add-btn"
                      data-testid="share-account-product-add-btn"
                      fill="clear"
                      color="primary"
                      type="button"
                      (click)="onCreateProduct()"
                      [disabled]="isEditMode()"
                      [attr.aria-label]="'SHARE_ACCOUNTS.CREATE_PRODUCT' | translate"
                    >
                      <ion-icon name="add-circle-outline" slot="icon-only"></ion-icon>
                    </ion-button>
                  </div>
                </ion-col>

                <!-- Requested Shares -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'SHARE_ACCOUNTS.REQUESTED_SHARES' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'SHARE_ACCOUNTS.REQUESTED_SHARES' | translate"
                      id="share-account-requested-shares"
                      data-testid="share-account-requested-shares"
                      type="number"
                      name="requestedShares"
                      [(ngModel)]="account().requestedShares"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <!-- Application Date -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'SHARE_ACCOUNTS.APPLICATION_DATE' | translate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'SHARE_ACCOUNTS.APPLICATION_DATE' | translate"
                      id="share-account-application-date"
                      data-testid="share-account-application-date"
                      type="date"
                      name="applicationDate"
                      [ngModel]="applicationDate() | date: 'yyyy-MM-dd'"
                      (ngModelChange)="onApplicationDateChange($event)"
                      required
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <!-- Savings Account ID (Optional but recommended) -->
                <ion-col size="12">
                  <ion-item fill="outline" class="form-item">
                    <ion-label position="stacked">{{
                      'SHARE_ACCOUNTS.SAVINGS_ACCOUNT_ID' | translate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'SHARE_ACCOUNTS.SAVINGS_ACCOUNT_ID' | translate"
                      interface="popover"
                      id="share-account-savings-select"
                      data-testid="share-account-savings-select"
                      name="savingsAccountId"
                      [(ngModel)]="account().savingsAccountId"
                      [disabled]="!account().clientId"
                    >
                      <ion-select-option [value]="null">-- None --</ion-select-option>
                      @for (sa of savingsAccounts(); track sa.id) {
                        <ion-select-option [value]="sa.id">
                          {{ sa.accountNo }} - {{ sa.savingsProductName }}
                        </ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>
              </ion-row>
            </ion-grid>

            <div class="form-actions">
              <ion-button
                id="share-account-cancel-btn"
                data-testid="share-account-cancel-btn"
                fill="clear"
                color="medium"
                type="button"
                (click)="onCancel()"
                [disabled]="isSaving()"
              >
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button
                id="share-account-submit-btn"
                data-testid="share-account-submit-btn"
                color="primary"
                type="submit"
                [disabled]="shareForm.invalid || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent" slot="start"></ion-spinner>
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
      .share-account-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
      .select-search-container {
        padding: 8px 16px;
        position: sticky;
        top: 0;
        background: white;
        z-index: 1;
        border-bottom: 1px solid #ccc;
      }
      .select-search-input {
        width: 100%;
        padding: 8px;
        box-sizing: border-box;
        border: 1px solid #ccc;
        border-radius: 4px;
        outline: none;
      }
      .field-container-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .flex-grow {
        flex-grow: 1;
      }
      .info-banner {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
        margin-bottom: 20px;
        border-radius: 8px;
        background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
        border-left: 4px solid #1976d2;
      }
      .info-banner-icon {
        color: #1976d2;
        margin-top: 2px;
      }
      .info-banner-content {
        font-size: 13px;
        color: #37474f;
        line-height: 1.6;
      }
      .info-banner-content strong {
        font-size: 14px;
        color: #1a237e;
      }
      .prereq-list {
        margin: 6px 0 0 0;
        padding-left: 20px;
      }
      .prereq-list li {
        margin-bottom: 2px;
      }
    `,
  ],
})
export class ShareAccountFormComponent implements OnInit {
  private readonly shareService = inject(ShareAccountService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly LIST_PATH = '/products/shares';

  accountId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly account = signal<AccountRequest>({});
  readonly applicationDate = signal<Date>(new Date());
  readonly products = signal<GetAccountsTypeProductOptions[]>([]);
  readonly savingsAccounts = signal<SavingsAccountData[]>([]);
  filteredSavingsAccounts: SavingsAccountData[] = [];
  savingsSearchVal = '';

  onApplicationDateChange(val: string): void {
    this.applicationDate.set(val ? new Date(val) : new Date());
  }

  ngOnInit(): void {
    // Check for clientId in query params for pre-population
    this.route.queryParams.subscribe((queryParams) => {
      const clientId = queryParams['clientId'];
      if (clientId && !this.isEditMode()) {
        const idNum = +clientId;
        this.account().clientId = idNum;
        this.loadProducts(idNum);
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

  onClientSelected(clientId: number): void {
    this.account().clientId = clientId;
    this.account().productId = undefined;
    this.account().savingsAccountId = undefined;
    this.products.set([]);
    this.savingsAccounts.set([]);
    this.filteredSavingsAccounts = [];
    this.loadProducts(clientId);
  }

  onProductSelected(productId: number): void {
    this.account().productId = productId;
    this.account().savingsAccountId = undefined;
    if (this.account().clientId) {
      this.loadProducts(this.account().clientId, productId);
    }
  }

  onSavingsSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.savingsSearchVal = input.value.toLowerCase();
    this.filteredSavingsAccounts = this.savingsAccounts().filter(
      (sa) =>
        sa.accountNo?.toLowerCase().includes(this.savingsSearchVal) ||
        sa.savingsProductName?.toLowerCase().includes(this.savingsSearchVal),
    );
  }

  getSelectedSavingsAccountLabel(): string {
    const selectedId = this.account().savingsAccountId;
    if (!selectedId) return '';
    const sa = this.savingsAccounts().find((a) => a.id === selectedId);
    return sa ? `${sa.accountNo} - ${sa.savingsProductName}` : '';
  }

  onCreateClient() {
    this.router.navigate(['/clients/create']);
  }

  onCreateProduct() {
    this.router.navigate(['/products/share/create']);
  }

  private loadProducts(clientId?: number, productId?: number): void {
    if (!clientId) {
      this.products.set([]);
      this.savingsAccounts.set([]);
      this.filteredSavingsAccounts = [];
      return;
    }
    this.shareService.getAccountsTypeTemplate('share', clientId, productId).subscribe({
      next: (template: ShareAccountTemplateResponse) => {
        if (template.productOptions) {
          this.products.set(Array.from(template.productOptions));
        }
        this.savingsAccounts.set(Array.from(template.clientSavingsAccounts || []));
        this.filteredSavingsAccounts = this.savingsAccounts();
      },
      error: (err: unknown) => console.error('Failed to load products', err),
    });
  }

  private loadAccountData(): void {
    if (!this.accountId) return;
    this.shareService.getAccountsTypeAccountId(this.accountId, 'share').subscribe({
      next: (data: GetAccountsTypeAccountIdResponse) => {
        const dateArray = data.timeline?.submittedOnDate as unknown as number[];
        if (dateArray) {
          this.applicationDate.set(new Date(dateArray[0], dateArray[1] - 1, dateArray[2]));
        }
        this.account.set({
          clientId: data.clientId,
          productId: data.productId,
          requestedShares: data.summary?.totalApprovedShares,
          savingsAccountId: data.savingsAccountId,
        });
        if (data.clientId) {
          this.loadProducts(data.clientId, data.productId);
        }
      },
      error: (err: unknown) => console.error('Failed to load account', err),
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);

    const formattedDate = formatDateToFineract(this.applicationDate());

    this.account().applicationDate = formattedDate;
    this.account().dateFormat = FINERACT_DATE_FORMAT;
    this.account().locale = FINERACT_LOCALE;
    this.account().submittedDate = formattedDate; // Often required by Fineract

    if (this.isEditMode() && this.accountId) {
      const payload: PutAccountsTypeAccountIdRequest & { savingsAccountId?: number } = {
        applicationDate: formattedDate,
        requestedShares: this.account().requestedShares,
        dateFormat: FINERACT_DATE_FORMAT,
        locale: FINERACT_LOCALE,
        savingsAccountId: this.account().savingsAccountId,
      };

      this.shareService.putAccountsTypeAccountId('share', this.accountId, payload).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    } else {
      this.shareService.postAccountsType('share', this.account()).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
