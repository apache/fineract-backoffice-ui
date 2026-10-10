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
import { FundsService, FundRequest } from '../../../api';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
} from '@ionic/angular/standalone';

/**
 * Create / edit form for an organization fund. A fund has just a name and an
 * optional external id (Fineract does not expose a delete endpoint for funds).
 */
@Component({
  selector: 'app-fund-form',
  standalone: true,
  imports: [
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
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('FUNDS.EDIT_FUND' | appTranslate)
                : ('FUNDS.CREATE_FUND' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #fundForm="ngForm" (ngSubmit)="onSubmit()" class="fund-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'FUNDS.NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'FUNDS.NAME' | appTranslate"
                name="name"
                [(ngModel)]="fund().name"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'FUNDS.EXTERNAL_ID' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'FUNDS.EXTERNAL_ID' | appTranslate"
                name="externalId"
                [(ngModel)]="fund().externalId"
              ></ion-input>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="fundForm.invalid || isSaving()">
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
        max-width: 600px;
        margin: 0 auto;
      }
      .fund-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class FundFormComponent implements OnInit {
  private readonly fundsService = inject(FundsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/organization/funds';

  fundId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly fund = signal<FundRequest>({ name: '', externalId: '' });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.fundId = +id;
        this.isEditMode.set(true);
        this.loadFund();
      }
    });
  }

  loadFund(): void {
    if (!this.fundId) return;
    this.fundsService.getFundsFundId(this.fundId).subscribe((data) => {
      this.fund.set({ name: data.name, externalId: data.externalId });
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const request$ =
      this.isEditMode() && this.fundId
        ? this.fundsService.putFundsFundId(this.fundId, this.fund())
        : this.fundsService.postFunds(this.fund());

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
