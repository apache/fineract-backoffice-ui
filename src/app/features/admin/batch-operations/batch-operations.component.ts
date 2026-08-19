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
import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { BatchAPIService, BatchRequest, BatchResponse } from '../../../api';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonItem,
  IonLabel,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-batch-operations',
  standalone: true,
  imports: [
    FormsModule,
    JsonPipe,
    TranslateModule,
    IonButton,
    IonSpinner,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonCheckbox,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'BATCH_OPERATIONS.TITLE' | translate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'BATCH_OPERATIONS.INPUT' | translate }}</ion-label>
          <ion-textarea
            [attr.aria-label]="'BATCH_OPERATIONS.INPUT' | translate"
            [(ngModel)]="batchInput"
            rows="10"
            placeholder="[]"
          ></ion-textarea>
        </ion-item>

        <ion-checkbox [(ngModel)]="enclosingTransaction">
          {{ 'BATCH_OPERATIONS.ENCLOSE' | translate }}
        </ion-checkbox>

        @if (error()) {
          <p class="error-text">{{ 'BATCH_OPERATIONS.PARSE_ERROR' | translate }}: {{ error() }}</p>
        }
      </ion-card-content>
      <div class="card-actions">
        <ion-button color="primary" (click)="submit()" [disabled]="isSubmitting()">
          @if (isSubmitting()) {
            <ion-spinner name="crescent"></ion-spinner>
          } @else {
            {{ 'BATCH_OPERATIONS.SUBMIT' | translate }}
          }
        </ion-button>
      </div>
    </ion-card>

    @if (results().length > 0) {
      <ion-card class="results-card">
        <ion-card-header>
          <ion-card-title>{{ 'BATCH_OPERATIONS.RESULTS' | translate }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <pre><code>{{ results() | json }}</code></pre>
        </ion-card-content>
      </ion-card>
    }
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
      .error-text {
        color: red;
        margin-top: 8px;
      }
      .results-card {
        margin-top: 16px;
      }
      pre {
        background: var(--surface-sunken);
        color: var(--text-color);
        padding: 16px;
        border-radius: 4px;
        overflow: auto;
      }
      ion-spinner {
        display: inline-block;
      }
    `,
  ],
})
export class BatchOperationsComponent {
  private batchApiService = inject(BatchAPIService);

  batchInput = '';
  enclosingTransaction = false;
  readonly results = signal<BatchResponse[]>([]);
  readonly error = signal<string | null>(null);
  readonly isSubmitting = signal(false);

  submit(): void {
    this.error.set(null);
    this.results.set([]);

    let parsed: BatchRequest[];
    try {
      parsed = JSON.parse(this.batchInput);
      if (!Array.isArray(parsed)) {
        throw new TypeError('Input must be a JSON array');
      }
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Invalid JSON');
      return;
    }

    this.isSubmitting.set(true);
    this.batchApiService.postBatches(parsed, this.enclosingTransaction).subscribe({
      next: (response: BatchResponse[]) => {
        this.results.set(Array.isArray(response) ? response : [response]);
        this.isSubmitting.set(false);
      },
      error: (err: unknown) => {
        this.error.set(
          ((err as Record<string, unknown>)?.[`message`] as string) ?? 'Request failed',
        );
        this.isSubmitting.set(false);
      },
    });
  }
}
