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

import { FormsModule } from '@angular/forms';
import { DefaultService } from '../../api';
import { I18N, TranslatePipe } from '../../core/adapters';
import { NotificationService } from '../../core/services/notification.service';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-two-factor-config',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
  ],
  template: `
    <div class="two-factor-container">
      <ion-card class="two-factor-card">
        <ion-card-header>
          <ion-card-title>{{ 'TWO_FACTOR_CONFIG.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          @if (isLoading()) {
            <div class="spinner-wrapper">
              <ion-spinner name="crescent"></ion-spinner>
            </div>
          }

          @if (!isLoading()) {
            <form (ngSubmit)="onSave()">
              <ion-item fill="outline" class="full-width">
                <ion-label position="stacked">{{
                  'TWO_FACTOR_CONFIG.CONFIG_JSON' | appTranslate
                }}</ion-label>
                <ion-textarea
                  [attr.aria-label]="'TWO_FACTOR_CONFIG.CONFIG_JSON' | appTranslate"
                  name="configJson"
                  [ngModel]="configJson()"
                  (ngModelChange)="configJson.set($event)"
                  rows="14"
                  [disabled]="isSaving()"
                ></ion-textarea>
              </ion-item>
              <div class="actions">
                <ion-button color="primary" type="submit" [disabled]="isSaving()">
                  @if (isSaving()) {
                    <ion-spinner name="crescent"></ion-spinner>
                  }
                  {{ 'TWO_FACTOR_CONFIG.SAVE' | appTranslate }}
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
      .two-factor-container {
        padding: 24px;
        max-width: 720px;
        margin: 0 auto;
      }
      .two-factor-card {
        width: 100%;
      }
      .spinner-wrapper {
        display: flex;
        justify-content: center;
        padding: 32px 0;
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
    `,
  ],
})
export class TwoFactorConfigComponent implements OnInit {
  private defaultService = inject(DefaultService);
  private notifications = inject(NotificationService);
  private i18n = inject(I18N);

  readonly configJson = signal('');
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);

  ngOnInit(): void {
    this.isLoading.set(true);
    this.defaultService.getTwofactorConfigure().subscribe({
      next: (raw: string) => {
        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          this.configJson.set(JSON.stringify(parsed, null, 2));
        } catch {
          this.configJson.set(typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2));
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  onSave(): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.configJson());
    } catch {
      this.i18n.translateAsync('TWO_FACTOR_CONFIG.PARSE_ERROR').subscribe((msg: string) => {
        this.notifications.success(msg);
      });
      return;
    }

    this.isSaving.set(true);
    this.defaultService.putTwofactorConfigure(JSON.stringify(parsed)).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.i18n.translateAsync('TWO_FACTOR_CONFIG.SUCCESS').subscribe((msg: string) => {
          this.notifications.success(msg);
        });
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }
}
