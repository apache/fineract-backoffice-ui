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
import { AdhocQueryApiService, AdHocRequest, EnumOptionData } from '../../../api';
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
  IonTextarea,
} from '@ionic/angular/standalone';

/**
 * Create / edit form for an ad-hoc SQL query definition.
 */
@Component({
  selector: 'app-adhoc-query-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
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
    IonCheckbox,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('ADHOC_QUERY.EDIT' | appTranslate)
                : ('ADHOC_QUERY.CREATE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #adhocForm="ngForm" (ngSubmit)="onSubmit()" class="entity-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'ADHOC_QUERY.NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'ADHOC_QUERY.NAME' | appTranslate"
                name="name"
                [(ngModel)]="query().name"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'ADHOC_QUERY.QUERY' | appTranslate }}</ion-label>
              <ion-textarea
                [attr.aria-label]="'ADHOC_QUERY.QUERY' | appTranslate"
                name="query"
                [(ngModel)]="query().query"
                required
              ></ion-textarea>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'ADHOC_QUERY.TABLE_NAME' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'ADHOC_QUERY.TABLE_NAME' | appTranslate"
                name="tableName"
                [(ngModel)]="query().tableName"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'ADHOC_QUERY.REPORT_RUN_FREQUENCY' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'ADHOC_QUERY.REPORT_RUN_FREQUENCY' | appTranslate"
                interface="popover"
                name="reportRunFrequency"
                [(ngModel)]="query().reportRunFrequency"
              >
                @for (opt of frequencyOptions(); track opt.id) {
                  <ion-select-option [value]="opt.id">{{ opt.value }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-checkbox name="isActive" [(ngModel)]="query().isActive">
              {{ 'ADHOC_QUERY.IS_ACTIVE' | appTranslate }}
            </ion-checkbox>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="adhocForm.invalid || isSaving()"
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
export class AdhocQueryFormComponent implements OnInit {
  private readonly adhocService = inject(AdhocQueryApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/system/adhoc-query';

  queryId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly query = signal<AdHocRequest>({ name: '', query: '', tableName: '', isActive: true });
  readonly frequencyOptions = signal<EnumOptionData[]>([]);

  ngOnInit(): void {
    this.adhocService.getAdhocqueryTemplate().subscribe((tpl) => {
      this.frequencyOptions.set(tpl.reportRunFrequencies ?? []);
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.queryId = +id;
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  load(): void {
    if (!this.queryId) return;
    this.adhocService.getAdhocqueryAdHocId(this.queryId).subscribe((data) => {
      this.query.set({
        name: data.name,
        query: data.query,
        tableName: data.tableName,
        reportRunFrequency: data.reportRunFrequency,
        isActive: data.isActive,
      });
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const request$ =
      this.isEditMode() && this.queryId
        ? this.adhocService.putAdhocqueryAdHocId(this.queryId, this.query())
        : this.adhocService.postAdhocquery(this.query());

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
