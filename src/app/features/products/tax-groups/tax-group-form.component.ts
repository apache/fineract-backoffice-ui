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
  IonSelect,
  IonSelectOption,
  IonButton,
  IonSpinner,
} from '@ionic/angular/standalone';
import { TaxGroupService, TaxComponentData, PostTaxesGroupRequest } from '../../../api';
import { FINERACT_DATE_FORMAT, FINERACT_LOCALE } from '../../../core/utils/date-formatter';

/**
 * Create / edit form for a tax group: a name plus a selection of tax components.
 */
@Component({
  selector: 'app-tax-group-form',
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
    IonSelect,
    IonSelectOption,
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
                ? ('TAX_GROUPS.EDIT' | appTranslate)
                : ('TAX_GROUPS.CREATE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #tgForm="ngForm" (ngSubmit)="onSubmit()" class="tg-form">
            <ion-item fill="outline" class="form-item">
              <ion-label position="stacked">{{ 'TAX_GROUPS.NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'TAX_GROUPS.NAME' | appTranslate"
                id="tax-group-name"
                data-testid="tax-group-name"
                name="name"
                [ngModel]="name()"
                (ngModelChange)="name.set($event)"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline" class="form-item">
              <ion-label position="stacked">{{ 'TAX_GROUPS.COMPONENTS' | appTranslate }}</ion-label>
              <ion-select
                [attr.aria-label]="'TAX_GROUPS.COMPONENTS' | appTranslate"
                interface="popover"
                id="tax-group-components"
                data-testid="tax-group-components"
                name="components"
                [ngModel]="selectedComponentIds()"
                (ngModelChange)="selectedComponentIds.set($event)"
                multiple="true"
                required
              >
                @for (c of availableComponents(); track c.id) {
                  <ion-select-option [value]="c.id">{{ c.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <div class="form-actions">
              <ion-button
                id="tax-group-cancel-btn"
                data-testid="tax-group-cancel-btn"
                fill="clear"
                color="medium"
                type="button"
                (click)="onCancel()"
                [disabled]="isSaving()"
              >
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                id="tax-group-submit-btn"
                data-testid="tax-group-submit-btn"
                color="primary"
                type="submit"
                [disabled]="tgForm.invalid || isSaving()"
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
      .tg-form {
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
export class TaxGroupFormComponent implements OnInit {
  private readonly taxGroupService = inject(TaxGroupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/products/tax-groups';

  groupId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly name = signal('');
  readonly selectedComponentIds = signal<number[]>([]);
  readonly availableComponents = signal<TaxComponentData[]>([]);

  ngOnInit(): void {
    this.loadTemplate();
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.groupId = +id;
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  loadTemplate(): void {
    this.taxGroupService.getTaxesGroupTemplate().subscribe((template) => {
      this.availableComponents.set(template.taxComponents || []);
    });
  }

  load(): void {
    if (!this.groupId) return;
    this.taxGroupService.getTaxesGroupTaxGroupId(this.groupId).subscribe((data) => {
      this.name.set(data.name ?? '');
      this.selectedComponentIds.set(
        Array.from(data.taxAssociations ?? [])
          .map((a) => a.taxComponent?.id)
          .filter((id): id is number => id != null),
      );
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    // `taxComponents` is generated as a `Set` which would not JSON-serialize; pass an array and cast.
    const payload = {
      name: this.name(),
      taxComponents: this.selectedComponentIds().map((id) => ({ taxComponentId: id })),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    } as unknown as PostTaxesGroupRequest;

    const request$ =
      this.isEditMode() && this.groupId
        ? this.taxGroupService.putTaxesGroupTaxGroupId(this.groupId, payload)
        : this.taxGroupService.postTaxesGroup(payload);

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
