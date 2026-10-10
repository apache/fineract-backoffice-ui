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
import { Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { ProgressiveLoanService, ProgressiveLoanInterestScheduleModel } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
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
  selector: 'app-progressive-loan-model',
  standalone: true,
  imports: [
    FormsModule,
    JsonPipe,
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
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'PROGRESSIVE_LOAN.TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div class="row-actions">
          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'PROGRESSIVE_LOAN.LOAN_ID' | appTranslate
            }}</ion-label>
            <ion-input
              [attr.aria-label]="'PROGRESSIVE_LOAN.LOAN_ID' | appTranslate"
              type="number"
              [(ngModel)]="loanId"
            ></ion-input>
          </ion-item>
          <ion-button color="primary" (click)="loadModel()" [disabled]="isLoading()">
            {{ 'PROGRESSIVE_LOAN.LOAD' | appTranslate }}
          </ion-button>
          <ion-button color="secondary" (click)="createModel()" [disabled]="isLoading()">
            {{ 'PROGRESSIVE_LOAN.CREATE' | appTranslate }}
          </ion-button>
          <ion-button color="danger" (click)="deleteModel()" [disabled]="isLoading()">
            {{ 'PROGRESSIVE_LOAN.DELETE' | appTranslate }}
          </ion-button>
        </div>

        @if (isLoading()) {
          <ion-spinner name="crescent"></ion-spinner>
        }

        @if (model() !== null) {
          <div class="model-container">
            <h4>{{ 'PROGRESSIVE_LOAN.MODEL' | appTranslate }}</h4>
            <pre>{{ model() | json }}</pre>
          </div>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .row-actions {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .model-container pre {
        background: #f5f5f5;
        padding: 16px;
        border-radius: 4px;
        overflow: auto;
        max-height: 400px;
      }
    `,
  ],
})
export class ProgressiveLoanModelComponent {
  private progressiveLoanService = inject(ProgressiveLoanService);
  private notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  loanId = 0;
  readonly model = signal<ProgressiveLoanInterestScheduleModel | null>(null);
  readonly isLoading = signal(false);

  loadModel(): void {
    this.isLoading.set(true);
    this.progressiveLoanService.getInternalLoanProgressiveLoanIdModel(this.loanId).subscribe({
      next: (data) => {
        this.model.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.showError();
      },
    });
  }

  createModel(): void {
    this.isLoading.set(true);
    this.progressiveLoanService.postInternalLoanProgressiveLoanIdModel(this.loanId).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.showSuccess();
      },
      error: () => {
        this.isLoading.set(false);
        this.showError();
      },
    });
  }

  deleteModel(): void {
    this.isLoading.set(true);
    this.progressiveLoanService.deleteInternalLoanProgressiveLoanIdModel(this.loanId).subscribe({
      next: () => {
        this.model.set(null);
        this.isLoading.set(false);
        this.showSuccess();
      },
      error: () => {
        this.isLoading.set(false);
        this.showError();
      },
    });
  }

  private showSuccess(): void {
    this.notifications.success(this.i18n.translate('PROGRESSIVE_LOAN.SUCCESS'));
  }

  private showError(): void {
    this.notifications.error(this.i18n.translate('PROGRESSIVE_LOAN.ERROR'));
  }
}
