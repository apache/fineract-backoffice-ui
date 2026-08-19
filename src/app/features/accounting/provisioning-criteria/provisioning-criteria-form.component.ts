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
import { ProvisioningCriteriaService, PostProvisioningCriteriaRequest } from '../../../api';
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
 * Create / edit form for a provisioning criteria. The full criteria record carries
 * per-category definitions and a loan-product mapping; those arrays are complex and
 * are preserved as-is on edit. This form edits only the criteria name.
 */
/**
 * The criteria as this screen holds it.
 *
 * The provisioning definitions — the percentage, ageing band and pair of GL accounts per category
 * — travel under `definitions`. They were sent as `provisioningcriteria`, which the platform now
 * refuses outright: `The parameter provisioningcriteria is not supported`, so saving an edit
 * answered 400. The generated request type is not used directly because the property is named
 * differently either side of the spec sync, and this has to compile against both.
 *
 * The form does not edit the definitions; it carries them so that changing the name does not
 * discard the provisioning rules attached to the criteria.
 */
interface ProvisioningCriteriaPayload {
  criteriaName?: string;
  loanProducts?: unknown[];
  definitions?: unknown[];
}

@Component({
  selector: 'app-provisioning-criteria-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
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
                ? ('PROVISIONING_CRITERIA.EDIT' | translate)
                : ('PROVISIONING_CRITERIA.CREATE' | translate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #criteriaForm="ngForm" (ngSubmit)="onSubmit()" class="provisioning-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'PROVISIONING_CRITERIA.NAME' | translate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'PROVISIONING_CRITERIA.NAME' | translate"
                name="criteriaName"
                [(ngModel)]="criteria().criteriaName"
                required
              ></ion-input>
            </ion-item>

            <p class="form-note">{{ 'PROVISIONING_CRITERIA.DEFINITIONS_NOTE' | translate }}</p>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="criteriaForm.invalid || isSaving()"
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
        max-width: 600px;
        margin: 0 auto;
      }
      .provisioning-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-note {
        color: rgba(0, 0, 0, 0.6);
        font-size: 0.875rem;
      }
    `,
  ],
})
export class ProvisioningCriteriaFormComponent implements OnInit {
  private readonly criteriaService = inject(ProvisioningCriteriaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/accounting/provisioning-criteria';

  criteriaId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly criteria = signal<ProvisioningCriteriaPayload>({ criteriaName: '' });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.criteriaId = +id;
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  load(): void {
    if (!this.criteriaId) return;
    this.criteriaService.getProvisioningcriteriaCriteriaId(this.criteriaId).subscribe((data) => {
      const raw = data as unknown as Record<string, unknown>;
      this.criteria.set({
        criteriaName: data.criteriaName,
        loanProducts: data.loanProducts as unknown[] | undefined,
        // Read under both names so this works either side of the rename.
        definitions: (raw['definitions'] ?? raw['provisioningcriteria']) as unknown[] | undefined,
      });
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const request$ =
      this.isEditMode() && this.criteriaId
        ? this.criteriaService.putProvisioningcriteriaCriteriaId(
            this.criteriaId,
            this.criteria() as PostProvisioningCriteriaRequest,
          )
        : this.criteriaService.postProvisioningcriteria(
            this.criteria() as PostProvisioningCriteriaRequest,
          );

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
