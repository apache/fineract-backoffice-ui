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
import { FINERACT_LOCALE } from '../../../core/utils/date-formatter';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';
import {
  LoanCollateralService,
  LoansLoanIdCollateralsRequest,
  LoansLoandIdCollateralsCollateralIdRequest,
  CollateralData,
  CodeValueData,
  GetLoansLoanIdCollateralsResponse,
  LoansService,
} from '../../../api';
import { LoanSummary } from '../loan-summary.model';

/**
 * Component for adding or editing loan collateral.
 */
@Component({
  selector: 'app-collateral-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardSubtitle,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    TooltipDirective,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('LOANS.EDIT_COLLATERAL' | appTranslate)
                : ('LOANS.ADD_COLLATERAL' | appTranslate)
            }}
          </ion-card-title>
          @if (loanSummary(); as summary) {
            <ion-card-subtitle>
              {{ 'LOANS.ACCOUNT_NO' | appTranslate }}: {{ summary.accountNo }} &middot;
              {{ 'COMMON.CLIENT' | appTranslate }}: {{ summary.clientName }} &middot;
              {{ 'LOANS.PRODUCT_NAME' | appTranslate }}: {{ summary.loanProductName }}
            </ion-card-subtitle>
          }
        </ion-card-header>

        <ion-card-content>
          <form #collateralForm="ngForm" (ngSubmit)="onSubmit()" class="collateral-form">
            <div class="form-grid">
              <!-- Collateral Type -->
              <ion-item fill="outline" [appTooltip]="'HELP.COLLATERAL_TYPE_DESC' | appTranslate">
                <ion-label position="stacked">{{ 'COMMON.TYPE' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'COMMON.TYPE' | appTranslate"
                  interface="popover"
                  name="collateralTypeId"
                  [ngModel]="selectedCollateralTypeId()"
                  (ngModelChange)="selectedCollateralTypeId.set($event)"
                  required
                  [disabled]="isEditMode()"
                >
                  @for (type of collateralTypes(); track type.id) {
                    <ion-select-option [value]="type.id">{{ type.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <!-- Value -->
              <ion-item fill="outline" [appTooltip]="'HELP.COLLATERAL_VALUE_DESC' | appTranslate">
                <ion-label position="stacked">{{ 'COMMON.VALUE' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.VALUE' | appTranslate"
                  type="number"
                  name="value"
                  [ngModel]="collateralValue()"
                  (ngModelChange)="collateralValue.set($event)"
                  required
                ></ion-input>
              </ion-item>

              <!-- Description -->
              <ion-item
                fill="outline"
                class="full-width"
                [appTooltip]="'HELP.COLLATERAL_DESC' | appTranslate"
              >
                <ion-label position="stacked">{{ 'COMMON.DESCRIPTION' | appTranslate }}</ion-label>
                <ion-textarea
                  [attr.aria-label]="'COMMON.DESCRIPTION' | appTranslate"
                  name="description"
                  [ngModel]="collateralDescription()"
                  (ngModelChange)="collateralDescription.set($event)"
                  rows="3"
                ></ion-textarea>
              </ion-item>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="collateralForm.invalid || isSaving()"
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
        max-width: 800px;
        margin: 0 auto;
      }
      .collateral-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
    `,
  ],
})
export class CollateralFormComponent implements OnInit {
  private readonly collateralService = inject(LoanCollateralService);
  private readonly loansService = inject(LoansService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  loanId: number | null = null;
  collateralId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly collateralTypes = signal<CodeValueData[]>([]);
  readonly loanSummary = signal<LoanSummary | null>(null);

  // Binding variables
  readonly selectedCollateralTypeId = signal<number | null>(null);
  readonly collateralValue = signal(0);
  readonly collateralDescription = signal('');

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const loanIdParam = params.get('loanId');
      const collateralIdParam = params.get('id');

      if (loanIdParam) {
        this.loanId = +loanIdParam;
        this.loadTemplate();
        this.loadLoanSummary();

        if (collateralIdParam) {
          this.collateralId = +collateralIdParam;
          this.isEditMode.set(true);
          this.loadCollateral();
        }
      }
    });
  }

  private loadLoanSummary(): void {
    if (!this.loanId) return;
    this.loansService.getLoansLoanId(this.loanId).subscribe({
      next: (data) => {
        this.loanSummary.set({
          accountNo: data.accountNo,
          clientName: data.clientName,
          loanProductName: data.loanProductName,
        });
      },
      error: () => {
        // Non-critical context display; the form still works without it.
      },
    });
  }

  private loadTemplate(): void {
    if (!this.loanId) return;
    this.collateralService.getLoansLoanIdCollateralsTemplate(this.loanId).subscribe({
      next: (template: CollateralData) => {
        this.collateralTypes.set(template.allowedCollateralTypes || []);
      },
      error: (err) => console.error('Failed to load collateral template', err),
    });
  }

  private loadCollateral(): void {
    if (!this.loanId || !this.collateralId) return;
    this.collateralService
      .getLoansLoanIdCollateralsCollateralId(this.loanId, this.collateralId)
      .subscribe({
        next: (data: GetLoansLoanIdCollateralsResponse) => {
          this.selectedCollateralTypeId.set(data.type?.id || null);
          this.collateralValue.set(data.value || 0);
          this.collateralDescription.set(data.description || '');
        },
        error: (err) => console.error('Failed to load collateral details', err),
      });
  }

  onSubmit(): void {
    if (!this.loanId) return;
    this.isSaving.set(true);

    const requestPayload = {
      collateralTypeId: this.selectedCollateralTypeId(),
      value: this.collateralValue(),
      description: this.collateralDescription(),
      locale: FINERACT_LOCALE,
    };

    if (this.isEditMode() && this.collateralId) {
      this.collateralService
        .putLoansLoanIdCollateralsCollateralId(
          this.loanId,
          this.collateralId,
          requestPayload as LoansLoandIdCollateralsCollateralIdRequest,
        )
        .subscribe({
          next: () => this.router.navigate(['/loans', this.loanId, 'collateral']),
          error: () => this.isSaving.set(false),
        });
    } else {
      this.collateralService
        .postLoansLoanIdCollaterals(this.loanId, requestPayload as LoansLoanIdCollateralsRequest)
        .subscribe({
          next: () => this.router.navigate(['/loans', this.loanId, 'collateral']),
          error: () => this.isSaving.set(false),
        });
    }
  }

  onCancel(): void {
    if (this.loanId) {
      this.router.navigate(['/loans', this.loanId, 'collateral']);
    }
  }
}
