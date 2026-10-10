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
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  WorkingCapitalNearBreachService,
  WorkingCapitalNearBreachRequest,
  WorkingCapitalBreachService,
  StringEnumOptionData,
} from '../../../api';

/**
 * Create / edit form for a working-capital near-breach (early-warning) threshold.
 */
@Component({
  selector: 'app-wc-near-breach-form',
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
                ? ('WC_NEAR_BREACH.EDIT' | appTranslate)
                : ('WC_NEAR_BREACH.CREATE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #nbForm="ngForm" (ngSubmit)="onSubmit()" class="wc-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'WC_NEAR_BREACH.NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'WC_NEAR_BREACH.NAME' | appTranslate"
                name="name"
                [(ngModel)]="item().nearBreachName"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'WC_NEAR_BREACH.THRESHOLD' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'WC_NEAR_BREACH.THRESHOLD' | appTranslate"
                type="number"
                name="threshold"
                [(ngModel)]="item().nearBreachThreshold"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'WC_NEAR_BREACH.FREQUENCY' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'WC_NEAR_BREACH.FREQUENCY' | appTranslate"
                type="number"
                name="frequency"
                [(ngModel)]="item().nearBreachFrequency"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'WC_NEAR_BREACH.FREQUENCY_TYPE' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'WC_NEAR_BREACH.FREQUENCY_TYPE' | appTranslate"
                interface="popover"
                name="frequencyType"
                [(ngModel)]="item().nearBreachFrequencyType"
              >
                @for (opt of frequencyTypeOptions(); track opt.id) {
                  <ion-select-option [value]="opt.code">{{ opt.value }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="nbForm.invalid || isSaving()">
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
      .wc-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class WcNearBreachFormComponent implements OnInit {
  private readonly service = inject(WorkingCapitalNearBreachService);
  private readonly breachService = inject(WorkingCapitalBreachService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/working-capital/near-breach';

  itemId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly item = signal<WorkingCapitalNearBreachRequest>({ nearBreachName: '' });
  readonly frequencyTypeOptions = signal<StringEnumOptionData[]>([]);

  ngOnInit(): void {
    this.breachService.getWorkingCapitalBreachTemplate().subscribe((tpl) => {
      this.frequencyTypeOptions.set(tpl.breachFrequencyTypeOptions ?? []);
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.itemId = +id;
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  load(): void {
    if (!this.itemId) return;
    this.service.getWorkingCapitalNearBreachBreachId(this.itemId).subscribe((data) => {
      this.item.set({
        nearBreachName: data.name,
        nearBreachThreshold: data.threshold,
        nearBreachFrequency: data.frequency,
        nearBreachFrequencyType: data.frequencyType?.code,
      });
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const request$ =
      this.isEditMode() && this.itemId
        ? this.service.putWorkingCapitalNearBreachBreachId(this.itemId, this.item())
        : this.service.postWorkingCapitalNearBreach(this.item());

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
