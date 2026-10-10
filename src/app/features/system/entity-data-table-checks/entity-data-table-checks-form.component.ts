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
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
import { EntityDataTableService, PostEntityDatatableChecksTemplateRequest } from '../../../api';
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

/**
 * Create form for an entity data-table check. No update endpoint exists, so this form is
 * create-only.
 */
@Component({
  selector: 'app-entity-data-table-checks-form',
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
          <ion-card-title>{{ 'ENTITY_DATA_TABLE_CHECKS.CREATE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #checkForm="ngForm" (ngSubmit)="onSubmit()" class="entity-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'ENTITY_DATA_TABLE_CHECKS.ENTITY' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'ENTITY_DATA_TABLE_CHECKS.ENTITY' | appTranslate"
                interface="popover"
                name="entity"
                [(ngModel)]="check.entity"
                required
              >
                @for (ent of entityOptions(); track ent) {
                  <ion-select-option [value]="ent">{{ ent }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'ENTITY_DATA_TABLE_CHECKS.DATATABLE_NAME' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'ENTITY_DATA_TABLE_CHECKS.DATATABLE_NAME' | appTranslate"
                name="datatableName"
                [(ngModel)]="check.datatableName"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'ENTITY_DATA_TABLE_CHECKS.STATUS' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'ENTITY_DATA_TABLE_CHECKS.STATUS' | appTranslate"
                type="number"
                name="status"
                [(ngModel)]="check.status"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'ENTITY_DATA_TABLE_CHECKS.PRODUCT_ID' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'ENTITY_DATA_TABLE_CHECKS.PRODUCT_ID' | appTranslate"
                type="number"
                name="productId"
                [(ngModel)]="check.productId"
              ></ion-input>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="checkForm.invalid || isSaving()"
              >
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
export class EntityDataTableChecksFormComponent implements OnInit {
  private readonly checksService = inject(EntityDataTableService);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/system/entity-data-table-checks';

  readonly isSaving = signal(false);

  check: PostEntityDatatableChecksTemplateRequest = {
    entity: '',
    datatableName: '',
  };
  readonly entityOptions = signal<string[]>([]);

  ngOnInit(): void {
    this.checksService.getEntityDatatableChecksTemplate().subscribe((tpl) => {
      this.entityOptions.set(tpl.entities ?? []);
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    this.checksService.postEntityDatatableChecks(this.check).subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
