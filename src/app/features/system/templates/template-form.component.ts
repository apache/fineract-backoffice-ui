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

import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonTextarea,
} from '@ionic/angular/standalone';
import {
  TemplatesService,
  TemplateData,
  TemplateCreateRequest,
  TemplateUpdateRequest,
} from '../../../api';

@Component({
  selector: 'app-template-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    IonButton,
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
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          {{ (isEditMode ? 'TEMPLATES.EDIT_TITLE' : 'TEMPLATES.CREATE_TITLE') | appTranslate }}
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <ion-item fill="outline" class="full-width">
            <ion-label position="stacked">{{ 'TEMPLATES.NAME' | appTranslate }}</ion-label>
            <ion-input
              [attr.aria-label]="'TEMPLATES.NAME' | appTranslate"
              formControlName="name"
            ></ion-input>
          </ion-item>

          <ion-item fill="outline" class="full-width">
            <ion-label position="stacked">{{ 'TEMPLATES.ENTITY' | appTranslate }}</ion-label>
            <ion-select
              [attr.aria-label]="'TEMPLATES.ENTITY' | appTranslate"
              interface="popover"
              formControlName="entity"
            >
              @for (opt of entityOptions; track opt.id) {
                <ion-select-option [value]="opt.id">{{
                  opt.label | appTranslate
                }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          <ion-item fill="outline" class="full-width">
            <ion-label position="stacked">{{ 'TEMPLATES.TYPE' | appTranslate }}</ion-label>
            <ion-select
              [attr.aria-label]="'TEMPLATES.TYPE' | appTranslate"
              interface="popover"
              formControlName="type"
            >
              @for (opt of typeOptions; track opt.id) {
                <ion-select-option [value]="opt.id">{{
                  opt.label | appTranslate
                }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          <ion-item fill="outline" class="full-width">
            <ion-label position="stacked">{{ 'TEMPLATES.TEXT' | appTranslate }}</ion-label>
            <ion-textarea
              [attr.aria-label]="'TEMPLATES.TEXT' | appTranslate"
              formControlName="text"
              rows="10"
            ></ion-textarea>
          </ion-item>

          <div class="form-actions">
            <ion-button color="primary" type="submit" [disabled]="form.invalid">
              {{ 'TEMPLATES.SAVE' | appTranslate }}
            </ion-button>
            <ion-button fill="clear" type="button" (click)="onCancel()">
              {{ 'TEMPLATES.CANCEL' | appTranslate }}
            </ion-button>
          </div>
        </form>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
        display: block;
        margin-bottom: 16px;
      }
      .form-actions {
        display: flex;
        gap: 8px;
      }
    `,
  ],
})
export class TemplateFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly templatesService = inject(TemplatesService);

  private readonly TEMPLATES_PATH = '/system/templates';

  form!: FormGroup;
  isEditMode = false;
  templateId?: number;

  entityOptions = [
    { id: 0, label: 'TEMPLATES.ENTITY_CLIENT' },
    { id: 1, label: 'TEMPLATES.ENTITY_LOAN' },
  ];

  typeOptions = [
    { id: 0, label: 'TEMPLATES.TYPE_DOCUMENT' },
    { id: 2, label: 'TEMPLATES.TYPE_SMS' },
  ];

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      entity: [null],
      type: [null],
      text: [''],
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.templateId = +id;
      this.templatesService
        .getTemplatesTemplateId(this.templateId)
        .subscribe((data: TemplateData) => {
          this.form.patchValue({
            name: data.name ?? '',
            entity: data.entity ?? null,
            type: data.type ?? null,
            text: data.text ?? '',
          });
        });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const payload: TemplateCreateRequest | TemplateUpdateRequest = {
      name: this.form.value.name,
      entity: this.form.value.entity,
      type: this.form.value.type,
      text: this.form.value.text,
    };

    if (this.isEditMode && this.templateId != null) {
      this.templatesService
        .putTemplatesTemplateId(this.templateId, payload as TemplateUpdateRequest)
        .subscribe(() => this.router.navigate([this.TEMPLATES_PATH]));
    } else {
      this.templatesService
        .postTemplates(payload as TemplateCreateRequest)
        .subscribe(() => this.router.navigate([this.TEMPLATES_PATH]));
    }
  }

  onCancel(): void {
    this.router.navigate([this.TEMPLATES_PATH]);
  }
}
