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
import { ClientSearchComponent } from '../../shared/components/client-search/client-search.component';
import { NotificationService } from '../../core/services/notification.service';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
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
  SavingsAccountService,
  SavingsProductService,
  PostSavingsAccountsRequest,
  GetSavingsProductsResponse,
  SavingsAccountData,
} from '../../api';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  toIsoDate,
} from '../../core/utils/date-formatter';

@Component({
  selector: 'app-savings-account-form',
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
                ? ('SAVINGS.EDIT_ACCOUNT' | translate)
                : ('SAVINGS.CREATE_ACCOUNT' | translate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #accountForm="ngForm" (ngSubmit)="onSubmit()" class="savings-form">
            <div class="form-grid">
              <!-- Client Search with Create Option -->
              <div class="field-container-row">
                <app-client-search
                  [label]="'COMMON.CLIENT_ID' | translate"
                  [required]="true"
                  [initialClientId]="account().clientId || null"
                  (clientSelected)="account().clientId = $event"
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

              <!-- Product Selection with Create Option -->
              <div class="field-container-row">
                <ion-item
                  fill="outline"
                  [appTooltip]="'HELP.SAVINGS_PRODUCT_DESC' | translate"
                  class="flex-grow"
                >
                  <ion-label position="stacked">{{ 'COMMON.PRODUCT' | translate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'COMMON.PRODUCT' | translate"
                    interface="popover"
                    name="productId"
                    [(ngModel)]="account().productId"
                    required
                    [disabled]="isEditMode()"
                  >
                    @for (product of products(); track product.id) {
                      <ion-select-option [value]="product.id">{{ product.name }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
                <ion-button
                  fill="clear"
                  type="button"
                  [attr.aria-label]="'PRODUCTS.CREATE_SAVINGS_PRODUCT' | translate"
                  [appTooltip]="'PRODUCTS.CREATE_SAVINGS_PRODUCT' | translate"
                  (click)="onCreateProduct()"
                  style="margin-top: 4px;"
                  [disabled]="isEditMode()"
                >
                  <ion-icon color="primary" name="add-circle-outline"></ion-icon>
                </ion-button>
              </div>

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

              <!-- Nominal Annual Interest Rate -->
              <ion-item fill="outline" [appTooltip]="'HELP.INTEREST_RATE_DESC' | translate">
                <ion-label position="stacked">{{ 'COMMON.INTEREST_RATE' | translate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.INTEREST_RATE' | translate"
                  type="number"
                  name="nominalAnnualInterestRate"
                  [ngModel]="interestRate()"
                  (ngModelChange)="interestRate.set($event)"
                ></ion-input>
              </ion-item>
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
      .savings-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
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
export class SavingsAccountFormComponent implements OnInit {
  private readonly savingsService = inject(SavingsAccountService);
  private readonly productService = inject(SavingsProductService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationService);

  private readonly LIST_PATH = '/products/savings-accounts';

  accountId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly account = signal<PostSavingsAccountsRequest>({});
  /** Interest rate bound separately as it's missing from model */
  readonly interestRate = signal(0);
  readonly submittedOnDate = signal(toIsoDate(new Date()));
  readonly products = signal<GetSavingsProductsResponse[]>([]);

  ngOnInit(): void {
    this.loadProducts();

    // Check for clientId in query params for pre-population
    this.route.queryParams.subscribe((queryParams) => {
      const clientId = queryParams['clientId'];
      if (clientId) {
        this.account().clientId = +clientId;
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

  onCreateClient() {
    this.router.navigate(['/clients/create']);
  }

  onCreateProduct() {
    this.router.navigate(['/products/savings/create']);
  }

  private loadProducts(): void {
    this.productService.getSavingsproducts().subscribe({
      next: (data: GetSavingsProductsResponse[]) => {
        this.products.set(data || []);
      },
      error: () => this.notifications.error('Operation failed. Please try again.'),
    });
  }

  private loadAccountData(): void {
    if (!this.accountId) return;
    this.savingsService.getSavingsaccountsAccountId(this.accountId).subscribe({
      next: (data: SavingsAccountData) => {
        const dateArray = data.timeline?.submittedOnDate as unknown as number[];
        if (dateArray) {
          this.submittedOnDate.set(
            toIsoDate(new Date(dateArray[0], dateArray[1] - 1, dateArray[2])),
          );
        }
        this.account.set({
          clientId: data.clientId,
          productId: data.savingsProductId,
        });
        this.interestRate.set(data.nominalAnnualInterestRate || 0);
      },
      error: () => this.notifications.error('Operation failed. Please try again.'),
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);

    this.account().submittedOnDate = formatDateToFineract(this.submittedOnDate());
    this.account().dateFormat = FINERACT_DATE_FORMAT;
    this.account().locale = FINERACT_LOCALE;

    // Cast to Record to add missing properties to the payload
    const payload: Record<string, unknown> = {
      ...this.account(),
      nominalAnnualInterestRate: this.interestRate(),
    };

    if (this.isEditMode() && this.accountId) {
      this.savingsService
        .putSavingsaccountsAccountId(this.accountId, payload as Record<string, unknown>)
        .subscribe({
          next: () => this.router.navigate([this.LIST_PATH]),
          error: () => this.isSaving.set(false),
        });
    } else {
      this.savingsService.postSavingsaccounts(payload as PostSavingsAccountsRequest).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
