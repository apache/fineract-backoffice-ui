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
import { I18N, TranslatePipe } from '../../../core/adapters';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonSpinner,
} from '@ionic/angular/standalone';
import { ProductMixService, LoanProductData } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';

/**
 * Manages the product mix for a single loan product. The mix defines which other loan
 * products are restricted when this product is in use. The loan product id is read from
 * the route snapshot; a saved mix is updated, otherwise a new one is created, and
 * clearing the selection deletes the mix entirely.
 */
@Component({
  selector: 'app-product-mix',
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
    IonSelect,
    IonSelectOption,
    IonButton,
    IonSpinner,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'PRODUCT_MIX.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #mixForm="ngForm" (ngSubmit)="onSubmit()" class="mix-form">
            <ion-item fill="outline" class="form-item">
              <ion-label position="stacked">{{
                'PRODUCT_MIX.RESTRICTED_PRODUCTS' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'PRODUCT_MIX.RESTRICTED_PRODUCTS' | appTranslate"
                interface="popover"
                id="product-mix-restricted-products"
                data-testid="product-mix-restricted-products"
                name="restrictedProducts"
                [ngModel]="restrictedProducts()"
                (ngModelChange)="restrictedProducts.set($event)"
                multiple="true"
              >
                @for (opt of productOptions(); track opt.id) {
                  <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <div class="form-actions">
              <ion-button
                id="product-mix-clear-btn"
                data-testid="product-mix-clear-btn"
                fill="clear"
                color="danger"
                type="button"
                (click)="onDelete()"
                [disabled]="!hasMix() || isSaving()"
              >
                {{ 'PRODUCT_MIX.CLEAR' | appTranslate }}
              </ion-button>
              <ion-button
                id="product-mix-cancel-btn"
                data-testid="product-mix-cancel-btn"
                fill="clear"
                color="medium"
                type="button"
                (click)="onCancel()"
                [disabled]="isSaving()"
              >
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                id="product-mix-submit-btn"
                data-testid="product-mix-submit-btn"
                color="primary"
                type="submit"
                [disabled]="isSaving()"
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
      .mix-form {
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
export class ProductMixComponent implements OnInit {
  private readonly productMixService = inject(ProductMixService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  private readonly LIST_PATH = '/products/loan';

  productId!: number;
  readonly hasMix = signal(false);
  readonly isSaving = signal(false);

  readonly restrictedProducts = signal<number[]>([]);
  readonly productOptions = signal<LoanProductData[]>([]);

  ngOnInit(): void {
    this.productId = Number(this.route.snapshot.paramMap.get('productId'));
    this.load();
  }

  load(): void {
    this.productMixService.getLoanproductsProductIdProductmix(this.productId).subscribe({
      next: (data) => {
        this.productOptions.set(data.productOptions ?? []);
        const restricted = data.restrictedProducts ?? [];
        this.restrictedProducts.set(
          restricted.map((p) => p.id).filter((id): id is number => id !== undefined),
        );
        this.hasMix.set(restricted.length > 0);
      },
      error: (err) => console.error('Failed to load product mix', err),
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const request = { productId: this.productId, restrictedProducts: this.restrictedProducts() };
    const request$ = this.hasMix()
      ? this.productMixService.putLoanproductsProductIdProductmix(this.productId, request)
      : this.productMixService.postLoanproductsProductIdProductmix(this.productId, request);

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  async onDelete(): Promise<void> {
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('PRODUCT_MIX.CLEAR'),
      message: this.i18n.translate('PRODUCT_MIX.CONFIRM_CLEAR', {
        count: this.restrictedProducts().length,
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.isSaving.set(true);
    this.productMixService.deleteLoanproductsProductIdProductmix(this.productId).subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
