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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonSpinner,
} from '@ionic/angular/standalone';
import { TaxComponentsService, PostTaxesComponentsRequest } from '../../../api';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../../core/utils/date-formatter';

/**
 * Create / edit form for a tax component (name, percentage, start date).
 */
@Component({
  selector: 'app-tax-component-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonSpinner,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('TAX_COMPONENTS.EDIT' | appTranslate)
                : ('TAX_COMPONENTS.CREATE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #tcForm="ngForm" (ngSubmit)="onSubmit()" class="tc-form">
            <ion-item fill="outline" class="form-item">
              <ion-label position="stacked">{{ 'TAX_COMPONENTS.NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'TAX_COMPONENTS.NAME' | appTranslate"
                id="tax-component-name"
                data-testid="tax-component-name"
                name="name"
                [(ngModel)]="component().name"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline" class="form-item">
              <ion-label position="stacked">{{
                'TAX_COMPONENTS.PERCENTAGE' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'TAX_COMPONENTS.PERCENTAGE' | appTranslate"
                id="tax-component-percentage"
                data-testid="tax-component-percentage"
                type="number"
                name="percentage"
                [(ngModel)]="component().percentage"
                required
              ></ion-input>
            </ion-item>

            <div class="form-actions">
              <ion-button
                id="tax-component-cancel-btn"
                data-testid="tax-component-cancel-btn"
                fill="clear"
                color="medium"
                type="button"
                (click)="onCancel()"
                [disabled]="isSaving()"
              >
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                id="tax-component-submit-btn"
                data-testid="tax-component-submit-btn"
                color="primary"
                type="submit"
                [disabled]="tcForm.invalid || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent" slot="start"></ion-spinner>
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
      .tc-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-item {
        margin-bottom: 12px;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 16px;
      }
    `,
  ],
})
export class TaxComponentFormComponent implements OnInit {
  private readonly taxComponentsService = inject(TaxComponentsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/products/tax-components';

  componentId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly component = signal<PostTaxesComponentsRequest>({ name: '', percentage: undefined });
  startDate: Date = new Date();

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.componentId = +id;
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  load(): void {
    if (!this.componentId) return;
    this.taxComponentsService
      .getTaxesComponentTaxComponentId(this.componentId)
      .subscribe((data) => {
        this.component.set({ name: data.name, percentage: data.percentage });
        const arr = data.startDate as unknown as number[];
        if (Array.isArray(arr) && arr.length >= 3) {
          this.startDate = new Date(arr[0], arr[1] - 1, arr[2]);
        }
      });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    // Start date is immutable once set on the server, so only send it on create.
    const payload: PostTaxesComponentsRequest = {
      ...this.component(),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };
    if (!this.isEditMode()) {
      payload.startDate = formatDateToFineract(this.startDate);
    }

    const request$ =
      this.isEditMode() && this.componentId
        ? this.taxComponentsService.putTaxesComponentTaxComponentId(this.componentId, payload)
        : this.taxComponentsService.postTaxesComponent(payload);

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
