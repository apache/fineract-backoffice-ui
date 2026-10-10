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
import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
import { SurveyService, PostSurveySurveyNameApptableIdRequest } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
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
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';

interface SurveyResponse {
  id?: number;
  entryId?: number;
  score?: number;
  date?: string;
}

@Component({
  selector: 'app-survey-responses',
  standalone: true,
  imports: [
    FormsModule,
    CdkTableModule,
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
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'SURVEY_RESPONSES.TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <!-- Step 1: Select survey + client -->
        <div class="filter-row">
          <ion-item fill="outline">
            <ion-label position="stacked">{{ 'SURVEY_RESPONSES.SURVEY' | appTranslate }}</ion-label>
            <ion-select
              [attr.aria-label]="'SURVEY_RESPONSES.SURVEY' | appTranslate"
              interface="popover"
              [(ngModel)]="selectedSurveyName"
            >
              @for (s of surveys(); track s.name) {
                <ion-select-option [value]="s.name">{{ s.name }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'SURVEY_RESPONSES.CLIENT_ID' | appTranslate
            }}</ion-label>
            <ion-input
              [attr.aria-label]="'SURVEY_RESPONSES.CLIENT_ID' | appTranslate"
              type="number"
              [(ngModel)]="clientId"
            ></ion-input>
          </ion-item>

          <ion-button color="primary" (click)="loadResponses()" [disabled]="loading()">
            {{ 'SURVEY_RESPONSES.LOAD' | appTranslate }}
          </ion-button>
        </div>

        @if (loading()) {
          <ion-spinner name="crescent"></ion-spinner>
        }

        <!-- Step 2: Responses table -->
        @if (responses().length > 0) {
          <h3>{{ 'SURVEY_RESPONSES.RESPONSES' | appTranslate }}</h3>
          <cdk-table [dataSource]="responses()" class="full-width">
            <ng-container cdkColumnDef="id">
              <cdk-header-cell *cdkHeaderCellDef>ID</cdk-header-cell>
              <cdk-cell *cdkCellDef="let row">{{ row.id ?? row.entryId }}</cdk-cell>
            </ng-container>

            <ng-container cdkColumnDef="score">
              <cdk-header-cell *cdkHeaderCellDef>Score</cdk-header-cell>
              <cdk-cell *cdkCellDef="let row">{{ row.score }}</cdk-cell>
            </ng-container>

            <ng-container cdkColumnDef="date">
              <cdk-header-cell *cdkHeaderCellDef>Date</cdk-header-cell>
              <cdk-cell *cdkCellDef="let row">{{ row.date }}</cdk-cell>
            </ng-container>

            <ng-container cdkColumnDef="actions">
              <cdk-header-cell *cdkHeaderCellDef>Actions</cdk-header-cell>
              <cdk-cell *cdkCellDef="let row">
                <ion-button
                  fill="clear"
                  color="danger"
                  (click)="deleteResponse(row.id ?? row.entryId)"
                  [title]="'SURVEY_RESPONSES.DELETE' | appTranslate"
                >
                  &#x1F5D1;
                </ion-button>
              </cdk-cell>
            </ng-container>

            <cdk-header-row *cdkHeaderRowDef="displayedColumns"></cdk-header-row>
            <cdk-row *cdkRowDef="let row; columns: displayedColumns"></cdk-row>
          </cdk-table>
        }

        <hr class="divider" />

        <!-- Step 3: Submit new response -->
        <h3>{{ 'SURVEY_RESPONSES.SUBMIT_RESPONSE' | appTranslate }}</h3>
        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{
            'SURVEY_RESPONSES.RESPONSE_BODY' | appTranslate
          }}</ion-label>
          <ion-textarea
            [attr.aria-label]="'SURVEY_RESPONSES.RESPONSE_BODY' | appTranslate"
            rows="6"
            [ngModel]="responseBody()"
            (ngModelChange)="responseBody.set($event)"
          ></ion-textarea>
        </ion-item>
        <ion-button color="secondary" (click)="submitResponse()" [disabled]="submitting()">
          {{ 'SURVEY_RESPONSES.SUBMIT' | appTranslate }}
        </ion-button>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .filter-row {
        display: flex;
        gap: 16px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .full-width {
        width: 100%;
      }
      .section-divider {
        margin: 24px 0;
      }
      ion-spinner {
        margin: 16px auto;
      }
    `,
  ],
})
export class SurveyResponsesComponent implements OnInit {
  private surveyService = inject(SurveyService);
  private notifications = inject(NotificationService);

  readonly surveys = signal<{ name: string; enabled?: boolean }[]>([]);
  readonly responses = signal<SurveyResponse[]>([]);
  selectedSurveyName = '';
  clientId = 0;
  readonly responseBody = signal('');
  readonly loading = signal(false);
  readonly submitting = signal(false);

  displayedColumns = ['id', 'score', 'date', 'actions'];

  ngOnInit(): void {
    this.surveyService.getSurvey().subscribe({
      next: (list) => {
        const mapped = (list ?? []).map((s) => ({
          name: ((s as Record<string, unknown>)?.[`name`] as string) ?? '',
          enabled: s.enabled,
        }));
        this.surveys.set(mapped);
      },
      error: () => this.surveys.set([]),
    });
  }

  loadResponses(): void {
    if (!this.selectedSurveyName || !this.clientId) return;
    this.loading.set(true);
    this.surveyService
      .getSurveySurveyNameClientId(this.selectedSurveyName, this.clientId)
      .subscribe({
        next: (raw) => {
          try {
            const parsed = JSON.parse(raw as string);
            this.responses.set(Array.isArray(parsed) ? parsed : [parsed]);
          } catch {
            this.responses.set([]);
          }
          this.loading.set(false);
        },
        error: () => {
          this.responses.set([]);
          this.loading.set(false);
        },
      });
  }

  deleteResponse(fulfilledId: number): void {
    this.surveyService
      .deleteSurveySurveyNameClientIdFulfilledId(
        this.selectedSurveyName,
        this.clientId,
        fulfilledId,
      )
      .subscribe({
        next: () => {
          this.notifications.success('SURVEY_RESPONSES.SUCCESS');
          this.loadResponses();
        },
      });
  }

  submitResponse(): void {
    if (!this.selectedSurveyName || !this.clientId || !this.responseBody()) return;
    let body: PostSurveySurveyNameApptableIdRequest;
    try {
      body = JSON.parse(this.responseBody());
    } catch {
      this.notifications.error('Invalid JSON');
      return;
    }
    this.submitting.set(true);
    this.surveyService
      .postSurveySurveyNameApptableId(this.selectedSurveyName, this.clientId, body)
      .subscribe({
        next: () => {
          this.notifications.success('SURVEY_RESPONSES.SUCCESS');
          this.responseBody.set('');
          this.submitting.set(false);
          this.loadResponses();
        },
        error: () => {
          this.submitting.set(false);
        },
      });
  }
}
