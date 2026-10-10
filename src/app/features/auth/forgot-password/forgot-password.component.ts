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
import { I18N, TranslatePipe } from '../../../core/adapters';
import { PasswordManagementService, ForgotPasswordRequest } from '../../../api';
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
  selector: 'app-forgot-password',
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
  ],
  template: `
    <div class="forgot-password-container">
      <ion-card class="forgot-password-card">
        <ion-card-header>
          <ion-card-title>{{ 'FORGOT_PASSWORD.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          @if (sent()) {
            <div class="success-message">
              {{ 'FORGOT_PASSWORD.SUCCESS_MSG' | appTranslate }}
            </div>
          } @else {
            <form #forgotForm="ngForm" (ngSubmit)="onSubmit()">
              <ion-item fill="outline" class="full-width">
                <ion-label position="stacked">{{
                  'FORGOT_PASSWORD.EMAIL' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'FORGOT_PASSWORD.EMAIL' | appTranslate"
                  type="email"
                  name="email"
                  [(ngModel)]="email"
                  required
                  email
                  [disabled]="isSending()"
                ></ion-input>
              </ion-item>

              <div class="actions">
                <ion-button
                  color="primary"
                  type="submit"
                  [disabled]="forgotForm.invalid || isSending()"
                >
                  @if (isSending()) {
                    <ion-spinner name="crescent"></ion-spinner>
                  }
                  {{ 'FORGOT_PASSWORD.SEND' | appTranslate }}
                </ion-button>
              </div>
            </form>
          }
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .forgot-password-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 60vh;
        padding: 16px;
      }
      .forgot-password-card {
        width: 100%;
        max-width: 400px;
      }
      .full-width {
        width: 100%;
        margin-top: 16px;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
      }
      .inline-spinner {
        display: inline-block;
        margin-right: 8px;
      }
      .success-message {
        padding: 16px 0;
        color: #388e3c;
        font-size: 1rem;
      }
    `,
  ],
})
export class ForgotPasswordComponent {
  private passwordManagementService = inject(PasswordManagementService);
  private notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  email = '';
  readonly isSending = signal(false);
  readonly sent = signal(false);

  onSubmit(): void {
    if (!this.email) {
      return;
    }
    this.isSending.set(true);
    this.passwordManagementService
      .postPasswordForgot({ email: this.email } as ForgotPasswordRequest)
      .subscribe({
        next: () => {
          this.isSending.set(false);
          this.sent.set(true);
        },
        error: () => {
          this.isSending.set(false);
          this.i18n.translateAsync('FORGOT_PASSWORD.ERROR').subscribe((msg: string) => {
            this.notifications.success(msg);
          });
        },
      });
  }
}
