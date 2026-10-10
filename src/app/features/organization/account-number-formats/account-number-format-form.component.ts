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
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  AccountNumberFormatService,
  EnumOptionData,
  GetAccountNumberFormatsIdResponse,
  GetAccountNumberFormatsResponseTemplate,
  PostAccountNumberFormatsRequest,
  PutAccountNumberFormatsRequest,
} from '../../../api';

@Component({
  selector: 'app-account-number-format-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
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
          <ion-card-title>
            {{
              isEditMode()
                ? ('ACCOUNT_NUMBER_FORMATS.EDIT_TITLE' | appTranslate)
                : ('ACCOUNT_NUMBER_FORMATS.CREATE_TITLE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #formatForm="ngForm" (ngSubmit)="onSubmit()" class="format-form">
            <div class="form-grid">
              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'ACCOUNT_NUMBER_FORMATS.ACCOUNT_TYPE' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'ACCOUNT_NUMBER_FORMATS.ACCOUNT_TYPE' | appTranslate"
                  interface="popover"
                  name="accountType"
                  [(ngModel)]="format.accountType"
                  (ngModelChange)="onAccountTypeChange($event)"
                  required
                  [disabled]="isEditMode()"
                >
                  @for (option of accountTypeOptions(); track option.id) {
                    <ion-select-option [value]="option.id">{{ option.value }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'ACCOUNT_NUMBER_FORMATS.PREFIX_TYPE' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'ACCOUNT_NUMBER_FORMATS.PREFIX_TYPE' | appTranslate"
                  interface="popover"
                  name="prefixType"
                  [(ngModel)]="format.prefixType"
                  [disabled]="prefixTypeOptions().length === 0"
                >
                  @for (option of prefixTypeOptions(); track option.id) {
                    <ion-select-option [value]="option.id">{{ option.value }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'ACCOUNT_NUMBER_FORMATS.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="formatForm.invalid || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | appTranslate }}
                } @else {
                  {{ 'ACCOUNT_NUMBER_FORMATS.SAVE' | appTranslate }}
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
      .format-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
      .form-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
    `,
  ],
})
export class AccountNumberFormatFormComponent implements OnInit {
  private readonly accountNumberFormatService = inject(AccountNumberFormatService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/organization/account-number-formats';

  readonly isEditMode = signal(false);
  formatId?: number;
  readonly isSaving = signal(false);

  readonly accountTypeOptions = signal<EnumOptionData[]>([]);
  readonly prefixTypeOptions = signal<EnumOptionData[]>([]);
  allPrefixTypeOptions: Record<string, EnumOptionData[]> = {};

  format: { accountType: number | undefined; prefixType: number | undefined } = {
    accountType: undefined,
    prefixType: undefined,
  };

  private selectedAccountTypeCode = '';

  ngOnInit(): void {
    this.accountNumberFormatService.getAccountnumberformatsTemplate().subscribe({
      next: (template: GetAccountNumberFormatsResponseTemplate) => {
        this.accountTypeOptions.set(template.accountTypeOptions ?? []);
        this.allPrefixTypeOptions = template.prefixTypeOptions ?? {};
      },
      error: (err: unknown) => {
        console.error('Failed to load account number format template', err);
      },
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.formatId = +id;
        this.isEditMode.set(true);
        this.loadExistingFormat(this.formatId);
      }
    });
  }

  private loadExistingFormat(id: number): void {
    this.accountNumberFormatService.getAccountnumberformatsAccountNumberFormatId(id).subscribe({
      next: (data: GetAccountNumberFormatsIdResponse) => {
        this.format.accountType = data.accountType?.id;
        this.format.prefixType = data.prefixType?.id;
        this.selectedAccountTypeCode = data.accountType?.code ?? '';
        this.prefixTypeOptions.set(this.allPrefixTypeOptions[this.selectedAccountTypeCode] ?? []);
      },
      error: (err: unknown) => {
        console.error('Failed to load account number format', err);
      },
    });
  }

  onAccountTypeChange(selectedId: number | undefined): void {
    if (selectedId == null) {
      this.prefixTypeOptions.set([]);
      this.selectedAccountTypeCode = '';
      this.format.prefixType = undefined;
      return;
    }
    const matched = this.accountTypeOptions().find((o) => o.id === selectedId);
    this.selectedAccountTypeCode = matched?.code ?? '';
    this.prefixTypeOptions.set(this.allPrefixTypeOptions[this.selectedAccountTypeCode] ?? []);
    this.format.prefixType = undefined;
  }

  onSubmit(): void {
    this.isSaving.set(true);
    if (this.isEditMode() && this.formatId != null) {
      const payload: PutAccountNumberFormatsRequest = {
        prefixType: this.format.prefixType,
      };
      this.accountNumberFormatService
        .putAccountnumberformatsAccountNumberFormatId(this.formatId, payload)
        .subscribe({
          next: () => this.router.navigate([this.LIST_PATH]),
          error: () => this.isSaving.set(false),
        });
    } else {
      const payload: PostAccountNumberFormatsRequest = {
        accountType: this.format.accountType,
        prefixType: this.format.prefixType,
      };
      this.accountNumberFormatService.postAccountnumberformats(payload).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
