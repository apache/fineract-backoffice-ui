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
import { TranslatePipe } from '../../../core/adapters';
import { InlineJobService, InlineJobRequest, InlineJobResponse } from '../../../api';
export { InlineJobService };
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
  IonTextarea,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-inline-job',
  standalone: true,
  imports: [
    FormsModule,
    JsonPipe,
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
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'INLINE_JOB.TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'INLINE_JOB.JOB_NAME' | appTranslate }}</ion-label>
          <ion-input
            [attr.aria-label]="'INLINE_JOB.JOB_NAME' | appTranslate"
            [(ngModel)]="jobName"
            required
          ></ion-input>
        </ion-item>

        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'INLINE_JOB.BODY' | appTranslate }}</ion-label>
          <ion-textarea
            [attr.aria-label]="'INLINE_JOB.BODY' | appTranslate"
            [(ngModel)]="jobBody"
            rows="6"
            placeholder="{}"
          ></ion-textarea>
        </ion-item>

        @if (error()) {
          <p class="error-text">{{ error() }}</p>
        }
      </ion-card-content>
      <div class="card-actions">
        <ion-button color="primary" (click)="runJob()" [disabled]="isRunning() || !jobName.trim()">
          @if (isRunning()) {
            <ion-spinner name="crescent"></ion-spinner>
          } @else {
            {{ 'INLINE_JOB.RUN' | appTranslate }}
          }
        </ion-button>
      </div>
    </ion-card>

    @if (result() !== null) {
      <ion-card class="results-card">
        <ion-card-header>
          <ion-card-title>{{ 'INLINE_JOB.RESULT' | appTranslate }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <pre><code>{{ result() | json }}</code></pre>
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
        background: #f5f5f5;
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
export class InlineJobComponent {
  private inlineJobService = inject(InlineJobService);

  jobName = '';
  jobBody = '';
  readonly result = signal<InlineJobResponse | null>(null);
  readonly isRunning = signal(false);
  readonly error = signal<string | null>(null);

  runJob(): void {
    this.error.set(null);
    this.result.set(null);

    let body: InlineJobRequest | undefined;
    if (this.jobBody.trim()) {
      try {
        body = JSON.parse(this.jobBody) as InlineJobRequest;
      } catch (e) {
        this.error.set((e as Error).message);
        return;
      }
    }

    this.isRunning.set(true);
    this.inlineJobService.postJobsJobNameInline(this.jobName.trim(), body).subscribe({
      next: (response) => {
        this.result.set(response ?? null);
        this.isRunning.set(false);
      },
      error: (err: { message?: string }) => {
        this.error.set(err?.message ?? 'Request failed');
        this.isRunning.set(false);
      },
    });
  }
}
