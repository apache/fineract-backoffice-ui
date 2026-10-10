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
import { CodesService, PostCodesRequest, PutCodesRequest, GetCodesResponse } from '../../../api';
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

@Component({
  selector: 'app-code-form',
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
                ? ('CODES.EDIT_TITLE' | appTranslate)
                : ('CODES.CREATE_TITLE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #codeForm="ngForm" (ngSubmit)="onSubmit()" class="code-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'CODES.NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'CODES.NAME' | appTranslate"
                name="name"
                [(ngModel)]="code().name"
                required
              ></ion-input>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'CODES.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="codeForm.invalid || isSaving()">
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | appTranslate }}
                } @else {
                  {{ 'CODES.SAVE' | appTranslate }}
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
      .code-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      ion-item {
        width: 100%;
      }
      .form-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
    `,
  ],
})
export class CodeFormComponent implements OnInit {
  private readonly codesService = inject(CodesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/system/codes';

  codeId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly code = signal<PostCodesRequest>({ name: '' });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.codeId = +id;
        this.isEditMode.set(true);
        this.loadCodeData();
      }
    });
  }

  loadCodeData(): void {
    if (!this.codeId) return;
    this.codesService.getCodesCodeId(this.codeId).subscribe({
      next: (data: GetCodesResponse) => {
        this.code.set({ name: data.name });
      },
      error: (err: unknown) => {
        console.error('Failed to load code', err);
      },
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);

    if (this.isEditMode() && this.codeId) {
      const payload: PutCodesRequest = { name: this.code().name };
      this.codesService.putCodesCodeId(this.codeId, payload).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: (err: unknown) => {
          console.error('Failed to update code', err);
          this.isSaving.set(false);
        },
      });
    } else {
      this.codesService.postCodes(this.code()).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: (err: unknown) => {
          console.error('Failed to create code', err);
          this.isSaving.set(false);
        },
      });
    }
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
