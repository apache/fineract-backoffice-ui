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
import { CdkTableModule } from '@angular/cdk/table';
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
import {
  SpmSurveysService,
  SurveyData,
  SPMAPILookUpTableService,
  LookupTableData,
} from '../../../api';

/**
 * Create / edit form for an SPM survey. Captures the core survey metadata
 * (key, name, country code, description); questions/components are managed elsewhere.
 */
@Component({
  selector: 'app-spm-surveys-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    CdkTableModule,
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
                ? ('SPM_SURVEYS.EDIT' | appTranslate)
                : ('SPM_SURVEYS.CREATE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #surveyForm="ngForm" (ngSubmit)="onSubmit()" class="spm-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'SPM_SURVEYS.KEY' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'SPM_SURVEYS.KEY' | appTranslate"
                name="key"
                [(ngModel)]="survey().key"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'SPM_SURVEYS.NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'SPM_SURVEYS.NAME' | appTranslate"
                name="name"
                [(ngModel)]="survey().name"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'SPM_SURVEYS.COUNTRY_CODE' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'SPM_SURVEYS.COUNTRY_CODE' | appTranslate"
                name="countryCode"
                [(ngModel)]="survey().countryCode"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'SPM_SURVEYS.DESCRIPTION' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'SPM_SURVEYS.DESCRIPTION' | appTranslate"
                name="description"
                [(ngModel)]="survey().description"
              ></ion-input>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="surveyForm.invalid || isSaving()"
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

          @if (isEditMode() && surveyId()) {
            <hr class="divider" />
            <h3>{{ 'SPM.LOOKUP_TABLES' | appTranslate }}</h3>
            @if (lookupTables().length === 0) {
              <p class="empty-state">{{ 'COMMON.NO_DATA' | appTranslate }}</p>
            } @else {
              <table cdk-table [dataSource]="lookupTables()" class="full-width-table">
                <ng-container cdkColumnDef="key">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'SPM.LOOKUP_KEY' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.key }}</td>
                </ng-container>
                <ng-container cdkColumnDef="description">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'COMMON.DESCRIPTION' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.description }}</td>
                </ng-container>
                <tr cdk-header-row *cdkHeaderRowDef="lookupTableColumns"></tr>
                <tr cdk-row *cdkRowDef="let row; columns: lookupTableColumns"></tr>
              </table>
            }
          }
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
      .spm-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class SpmSurveysFormComponent implements OnInit {
  private readonly surveysService = inject(SpmSurveysService);
  private readonly lookupTableService = inject(SPMAPILookUpTableService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/spm/surveys';

  readonly surveyId = signal<number | null>(null);
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly survey = signal<SurveyData>({ key: '', name: '' });

  readonly lookupTables = signal<LookupTableData[]>([]);
  lookupTableColumns = ['key', 'description'];

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.surveyId.set(+id);
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  load(): void {
    // Read once into a local: a signal call cannot be narrowed, so `if (this.surveyId())` no
    // longer tells the compiler the later calls are non-null.
    const surveyId = this.surveyId();
    if (!surveyId) return;
    this.surveysService.getSurveysId(surveyId).subscribe((data) => {
      this.survey.set({
        key: data.key,
        name: data.name,
        countryCode: data.countryCode,
        description: data.description,
      });
    });
    this.lookupTableService.getSurveysSurveyIdLookuptables(surveyId).subscribe({
      next: (data) => this.lookupTables.set(data ?? []),
      error: () => {
        /* ignored */
      },
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const surveyId = this.surveyId();
    const request$ =
      this.isEditMode() && surveyId
        ? this.surveysService.putSurveysId(surveyId, this.survey())
        : this.surveysService.postSurveys(this.survey());

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
