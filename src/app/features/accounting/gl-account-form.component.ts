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
  GeneralLedgerAccountService,
  PostGLAccountsRequest,
  PutGLAccountsRequest,
} from '../../api';
import { HelpIconComponent } from '../../shared';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-gl-account-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    HelpIconComponent,
    IonButton,
    IonSpinner,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonCheckbox,
    IonIcon,
    TooltipDirective,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('ACCOUNTING.EDIT_GL_ACCOUNT' | appTranslate)
                : ('ACCOUNTING.CREATE_GL_ACCOUNT' | appTranslate)
            }}
            <app-help-icon [helpTextKey]="'HELP.CHART_OF_ACCOUNTS_DESC'"></app-help-icon>
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #accountForm="ngForm" (ngSubmit)="onSubmit()" class="account-form">
            <div class="form-grid">
              <ion-item fill="outline" [appTooltip]="'HELP.ACCOUNT_NAME_DESC' | appTranslate">
                <ion-label position="stacked">{{ 'COMMON.NAME' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.NAME' | appTranslate"
                  name="name"
                  [(ngModel)]="account().name"
                  required
                ></ion-input>
              </ion-item>

              <ion-item fill="outline" [appTooltip]="'HELP.GL_CODE_DESC' | appTranslate">
                <ion-label position="stacked">{{ 'ACCOUNTING.GL_CODE' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'ACCOUNTING.GL_CODE' | appTranslate"
                  name="glCode"
                  [(ngModel)]="account().glCode"
                  required
                ></ion-input>
              </ion-item>

              <ion-item fill="outline" [appTooltip]="'HELP.ACCOUNT_TYPE_DESC' | appTranslate">
                <ion-label position="stacked">{{
                  'ACCOUNTING.ACCOUNT_TYPE' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'ACCOUNTING.ACCOUNT_TYPE' | appTranslate"
                  interface="popover"
                  name="type"
                  [(ngModel)]="account().type"
                  required
                >
                  <ion-select-option [value]="1">{{
                    'ACCOUNTING.ASSET' | appTranslate
                  }}</ion-select-option>
                  <ion-select-option [value]="2">{{
                    'ACCOUNTING.LIABILITY' | appTranslate
                  }}</ion-select-option>
                  <ion-select-option [value]="3">{{
                    'ACCOUNTING.EQUITY' | appTranslate
                  }}</ion-select-option>
                  <ion-select-option [value]="4">{{
                    'ACCOUNTING.INCOME' | appTranslate
                  }}</ion-select-option>
                  <ion-select-option [value]="5">{{
                    'ACCOUNTING.EXPENSE' | appTranslate
                  }}</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item fill="outline" [appTooltip]="'HELP.ACCOUNT_USAGE_DESC' | appTranslate">
                <ion-label position="stacked">{{
                  'ACCOUNTING.ACCOUNT_USAGE' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'ACCOUNTING.ACCOUNT_USAGE' | appTranslate"
                  interface="popover"
                  name="usage"
                  [(ngModel)]="account().usage"
                  required
                >
                  <ion-select-option [value]="1">{{
                    'ACCOUNTING.DETAIL' | appTranslate
                  }}</ion-select-option>
                  <ion-select-option [value]="2">{{
                    'ACCOUNTING.HEADER' | appTranslate
                  }}</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item
                fill="outline"
                [appTooltip]="'HELP.DESCRIPTION_DESC' | appTranslate"
                class="full-width"
              >
                <ion-label position="stacked">{{
                  'PRODUCTS.DESCRIPTION' | appTranslate
                }}</ion-label>
                <ion-textarea
                  [attr.aria-label]="'PRODUCTS.DESCRIPTION' | appTranslate"
                  name="description"
                  [(ngModel)]="account().description"
                  rows="3"
                ></ion-textarea>
              </ion-item>

              <div class="checkbox-container">
                <ion-checkbox
                  name="manualEntriesAllowed"
                  [(ngModel)]="account().manualEntriesAllowed"
                >
                  {{ 'ACCOUNTING.ALLOW_MANUAL_ENTRIES' | appTranslate }}
                </ion-checkbox>
                <ion-icon
                  [appTooltip]="'HELP.ALLOW_MANUAL_ENTRIES_DESC' | appTranslate"
                  class="help-icon"
                  name="help-circle-outline"
                ></ion-icon>
              </div>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="accountForm.invalid || isSaving()"
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
        max-width: 900px;
        margin: 0 auto;
      }
      .account-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
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
        color: var(--text-muted);
        cursor: help;
      }
    `,
  ],
})
export class GLAccountFormComponent implements OnInit {
  private readonly accountService = inject(GeneralLedgerAccountService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/accounting/chart-of-accounts';

  accountId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly account = signal<PostGLAccountsRequest>({
    manualEntriesAllowed: true,
  });

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.accountId = +id;
        this.isEditMode.set(true);
        this.loadAccountData();
      }
    });
  }

  loadAccountData() {
    if (!this.accountId) return;
    this.accountService.getGlaccountsGlAccountId(this.accountId).subscribe((data) => {
      this.account.set({
        name: data.name,
        glCode: data.glCode,
        type: data.type?.id,
        usage: data.usage?.id,
        description: data.description,
        manualEntriesAllowed: data.manualEntriesAllowed,
      });
    });
  }

  onSubmit() {
    this.isSaving.set(true);
    if (this.isEditMode() && this.accountId) {
      this.accountService
        .putGlaccountsGlAccountId(this.accountId, this.account() as PutGLAccountsRequest)
        .subscribe({
          next: () => this.router.navigate([this.LIST_PATH]),
          error: () => this.isSaving.set(false),
        });
    } else {
      this.accountService.postGlaccounts(this.account()).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel() {
    this.router.navigate([this.LIST_PATH]);
  }
}
