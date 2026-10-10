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
  IonCheckbox,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  CodeValuesService,
  GetCodeValuesDataResponse,
  PostCodeValuesDataRequest,
  PutCodeValuesDataRequest,
} from '../../../api';

@Component({
  selector: 'app-code-value-form',
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
    IonCheckbox,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('CODE_VALUES.EDIT_TITLE' | appTranslate)
                : ('CODE_VALUES.CREATE_TITLE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #codeValueForm="ngForm" (ngSubmit)="onSubmit()" class="code-value-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'CODE_VALUES.NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'CODE_VALUES.NAME' | appTranslate"
                name="name"
                [(ngModel)]="codeValue().name"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'CODE_VALUES.DESCRIPTION' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'CODE_VALUES.DESCRIPTION' | appTranslate"
                name="description"
                [(ngModel)]="codeValue().description"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'CODE_VALUES.POSITION' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'CODE_VALUES.POSITION' | appTranslate"
                type="number"
                name="position"
                [(ngModel)]="codeValue().position"
              ></ion-input>
            </ion-item>

            <div class="checkbox-field">
              <ion-checkbox name="isActive" [(ngModel)]="codeValue().isActive">
                {{ 'CODE_VALUES.ACTIVE' | appTranslate }}
              </ion-checkbox>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'CODE_VALUES.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="codeValueForm.invalid || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | appTranslate }}
                } @else {
                  {{ 'CODE_VALUES.SAVE' | appTranslate }}
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
      .code-value-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      ion-item {
        width: 100%;
      }
      .checkbox-field {
        padding: 4px 0;
      }
      .form-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
    `,
  ],
})
export class CodeValueFormComponent implements OnInit {
  private readonly codeValuesService = inject(CodeValuesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  codeId = 0;
  codeValueId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly codeValue = signal<PostCodeValuesDataRequest>({
    name: '',
    description: '',
    position: undefined,
    isActive: true,
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const codeIdParam = params.get('codeId');
      const codeValueIdParam = params.get('id');

      if (codeIdParam) {
        this.codeId = +codeIdParam;
      }

      if (codeValueIdParam) {
        this.codeValueId = +codeValueIdParam;
        this.isEditMode.set(true);
        this.loadCodeValueData();
      }
    });
  }

  private get listPath(): string[] {
    return ['/system/codes', String(this.codeId), 'values'];
  }

  loadCodeValueData(): void {
    if (!this.codeValueId) return;
    // Note: API signature is getCodesCodeIdCodevaluesCodeValueId(codeValueId, codeId)
    this.codeValuesService
      .getCodesCodeIdCodevaluesCodeValueId(this.codeValueId, this.codeId)
      .subscribe({
        next: (data: GetCodeValuesDataResponse) => {
          this.codeValue.set({
            name: data.name,
            description: data.description,
            position: data.position,
            isActive: data.active,
          });
        },
        error: (err: unknown) => {
          console.error('Failed to load code value', err);
        },
      });
  }

  onSubmit(): void {
    this.isSaving.set(true);

    if (this.isEditMode() && this.codeValueId) {
      const payload: PutCodeValuesDataRequest = {
        name: this.codeValue().name,
        description: this.codeValue().description,
        position: this.codeValue().position,
        isActive: this.codeValue().isActive,
      };
      this.codeValuesService
        .putCodesCodeIdCodevaluesCodeValueId(this.codeId, this.codeValueId, payload)
        .subscribe({
          next: () => this.router.navigate(this.listPath),
          error: (err: unknown) => {
            console.error('Failed to update code value', err);
            this.isSaving.set(false);
          },
        });
    } else {
      this.codeValuesService.postCodesCodeIdCodevalues(this.codeId, this.codeValue()).subscribe({
        next: () => this.router.navigate(this.listPath),
        error: (err: unknown) => {
          console.error('Failed to create code value', err);
          this.isSaving.set(false);
        },
      });
    }
  }

  onCancel(): void {
    this.router.navigate(this.listPath);
  }
}
