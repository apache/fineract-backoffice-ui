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
import { HooksService, HookCreateRequest, HookTemplateData } from '../../../api';
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
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

/**
 * Create / edit form for a Fineract hook. The hook "name" is the template type and is
 * selected from the template endpoint; display name and active flag are editable.
 */
@Component({
  selector: 'app-hooks-form',
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
    IonCheckbox,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ isEditMode() ? ('HOOKS.EDIT' | appTranslate) : ('HOOKS.CREATE' | appTranslate) }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #hookForm="ngForm" (ngSubmit)="onSubmit()" class="entity-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'HOOKS.NAME' | appTranslate }}</ion-label>
              <ion-select
                [attr.aria-label]="'HOOKS.NAME' | appTranslate"
                interface="popover"
                name="name"
                [(ngModel)]="hook().name"
                required
                [disabled]="isEditMode()"
              >
                @for (tpl of templateOptions(); track tpl.id) {
                  <ion-select-option [value]="tpl.name">{{ tpl.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'HOOKS.DISPLAY_NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'HOOKS.DISPLAY_NAME' | appTranslate"
                name="displayName"
                [(ngModel)]="hook().displayName"
                required
              ></ion-input>
            </ion-item>

            <ion-checkbox name="isActive" [(ngModel)]="hook().isActive">
              {{ 'HOOKS.IS_ACTIVE' | appTranslate }}
            </ion-checkbox>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="hookForm.invalid || isSaving()">
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
      .entity-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class HooksFormComponent implements OnInit {
  private readonly hooksService = inject(HooksService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/system/hooks';

  hookId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly hook = signal<HookCreateRequest>({ name: '', displayName: '', isActive: true });
  readonly templateOptions = signal<HookTemplateData[]>([]);

  ngOnInit(): void {
    this.hooksService.getHooksTemplate().subscribe((tpl) => {
      this.templateOptions.set(tpl.templates ?? []);
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.hookId = +id;
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  load(): void {
    if (!this.hookId) return;
    this.hooksService.getHooksHookId(this.hookId).subscribe((data) => {
      this.hook.set({
        name: data.name,
        displayName: data.displayName,
        isActive: data.isActive,
        templateId: data.templateId,
      });
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const request$ =
      this.isEditMode() && this.hookId
        ? this.hooksService.putHooksHookId(this.hookId, this.hook())
        : this.hooksService.postHooks(this.hook());

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
