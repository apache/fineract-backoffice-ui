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
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { LoanReschedulingService } from '../../../api';
import { TranslatePipe } from '../../../core/adapters';
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
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-loan-schedule-modify',
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
    IonSelectOption,
    IonSelect,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'LOAN_SCHEDULE_MODIFY.TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div class="form-grid">
          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'LOAN_SCHEDULE_MODIFY.LOAN_ID' | appTranslate
            }}</ion-label>
            <ion-input
              [attr.aria-label]="'LOAN_SCHEDULE_MODIFY.LOAN_ID' | appTranslate"
              type="number"
              [(ngModel)]="loanId"
              required
            ></ion-input>
          </ion-item>

          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'LOAN_SCHEDULE_MODIFY.COMMAND' | appTranslate
            }}</ion-label>
            <ion-select
              [attr.aria-label]="'LOAN_SCHEDULE_MODIFY.COMMAND' | appTranslate"
              interface="popover"
              [(ngModel)]="command"
              required
            >
              @for (cmd of commands; track cmd.value) {
                <ion-select-option [value]="cmd.value">{{
                  cmd.label | appTranslate
                }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
        </div>

        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'LOAN_SCHEDULE_MODIFY.BODY' | appTranslate }}</ion-label>
          <ion-textarea
            [attr.aria-label]="'LOAN_SCHEDULE_MODIFY.BODY' | appTranslate"
            [(ngModel)]="bodyText"
            rows="6"
            [placeholder]="'LOAN_SCHEDULE_MODIFY.BODY_PLACEHOLDER' | appTranslate"
          ></ion-textarea>
        </ion-item>

        <div class="form-actions">
          <ion-button
            color="primary"
            [disabled]="!loanId || !command || isLoading()"
            (click)="submit()"
          >
            @if (isLoading()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              {{ 'LOAN_SCHEDULE_MODIFY.SUBMIT' | appTranslate }}
            }
          </ion-button>
        </div>

        @if (response() !== null) {
          <ion-card class="response-card">
            <ion-card-header>
              <ion-card-title>{{ 'LOAN_SCHEDULE_MODIFY.RESPONSE' | appTranslate }}</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <pre>{{ response() | json }}</pre>
            </ion-card-content>
          </ion-card>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .form-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
      }
      .form-grid mat-form-field {
        flex: 1 1 200px;
      }
      .full-width {
        width: 100%;
        margin-top: 8px;
      }
      .form-actions {
        margin: 8px 0 16px;
      }
      ion-spinner {
        display: inline-block;
      }
      .response-card {
        margin-top: 16px;
      }
      pre {
        background: #f5f5f5;
        padding: 12px;
        border-radius: 4px;
        overflow: auto;
        font-size: 0.8rem;
      }
    `,
  ],
})
export class LoanScheduleModifyComponent {
  private readonly loanReschedulingService = inject(LoanReschedulingService);
  private readonly notifications = inject(NotificationService);

  loanId = 0;
  command = '';
  bodyText = '';
  readonly isLoading = signal(false);

  readonly response = signal<unknown>(null);

  commands = [
    {
      value: 'calculateRepaymentSchedule',
      label: 'LOAN_SCHEDULE_MODIFY.CALCULATE_REPAYMENT_SCHEDULE',
    },
    {
      value: 'forceRecalculateRepaymentSchedule',
      label: 'LOAN_SCHEDULE_MODIFY.FORCE_RECALCULATE_REPAYMENT_SCHEDULE',
    },
  ];

  submit(): void {
    if (!this.loanId || !this.command) return;

    let body: object = {};
    if (this.bodyText.trim()) {
      try {
        body = JSON.parse(this.bodyText);
      } catch {
        this.notifications.error('Invalid JSON body');
        return;
      }
    }

    this.isLoading.set(true);
    this.response.set(null);

    this.loanReschedulingService
      .postLoansLoanIdSchedule(this.loanId, body, this.command)
      .subscribe({
        next: (data) => {
          this.response.set(data);
          this.isLoading.set(false);
        },
        error: (err: { error?: unknown }) => {
          this.response.set(err?.error ?? { error: 'Request failed' });
          this.isLoading.set(false);
        },
      });
  }
}
