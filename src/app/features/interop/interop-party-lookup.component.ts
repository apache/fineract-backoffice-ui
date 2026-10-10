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
import { TranslatePipe } from '../../core/adapters';
import { NotificationService } from '../../core/services/notification.service';
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
  InterOperationService,
  InteropIdentifierAccountResponseData,
  InteropIdentifierRequestData,
} from '../../api';

type IdType =
  | 'MSISDN'
  | 'EMAIL'
  | 'PERSONAL_ID'
  | 'BUSINESS'
  | 'DEVICE'
  | 'ACCOUNT_ID'
  | 'IBAN'
  | 'ALIAS'
  | 'BBAN';

const ERROR_OCCURRED = 'Error occurred';

@Component({
  selector: 'app-interop-party-lookup',
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
        <ion-card-title>{{ 'INTEROP.PARTY_TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div class="form-row">
          <ion-item fill="outline">
            <ion-label position="stacked">{{ 'INTEROP.ID_TYPE' | appTranslate }}</ion-label>
            <ion-input
              [attr.aria-label]="'INTEROP.ID_TYPE' | appTranslate"
              [(ngModel)]="idType"
              placeholder="e.g. MSISDN"
            ></ion-input>
          </ion-item>

          <ion-item fill="outline">
            <ion-label position="stacked">{{ 'INTEROP.ID_VALUE' | appTranslate }}</ion-label>
            <ion-input
              [attr.aria-label]="'INTEROP.ID_VALUE' | appTranslate"
              [(ngModel)]="idValue"
            ></ion-input>
          </ion-item>

          <ion-item fill="outline">
            <ion-label position="stacked">{{ 'INTEROP.SUB_ID' | appTranslate }}</ion-label>
            <ion-input
              [attr.aria-label]="'INTEROP.SUB_ID' | appTranslate"
              [(ngModel)]="subIdOrType"
            ></ion-input>
          </ion-item>
        </div>

        <div class="button-row">
          <ion-button color="primary" (click)="lookup()" [disabled]="isLoading()">
            {{ 'INTEROP.LOOKUP' | appTranslate }}
          </ion-button>
          <ion-button color="secondary" (click)="register()" [disabled]="isLoading()">
            {{ 'INTEROP.REGISTER' | appTranslate }}
          </ion-button>
          <ion-button color="danger" (click)="deregister()" [disabled]="isLoading()">
            {{ 'INTEROP.DEREGISTER' | appTranslate }}
          </ion-button>
        </div>

        @if (isLoading()) {
          <ion-spinner name="crescent"></ion-spinner>
        }

        @if (result()) {
          <h3>{{ 'INTEROP.RESULT' | appTranslate }}</h3>
          <pre>{{ result() | json }}</pre>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .form-row {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .button-row {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
      }
      pre {
        background: #f5f5f5;
        padding: 12px;
        border-radius: 4px;
        overflow: auto;
      }
    `,
  ],
})
export class InteropPartyLookupComponent {
  private interopService = inject(InterOperationService);
  private notifications = inject(NotificationService);

  readonly result = signal<InteropIdentifierAccountResponseData | null>(null);
  readonly isLoading = signal(false);
  idType = '';
  idValue = '';
  subIdOrType = '';

  lookup(): void {
    if (!this.idType || !this.idValue) return;
    this.isLoading.set(true);
    this.result.set(null);
    const obs$ = this.subIdOrType
      ? this.interopService.getInteroperationPartiesIdTypeIdValueSubIdOrType(
          this.idType as IdType,
          this.idValue,
          this.subIdOrType,
        )
      : this.interopService.getInteroperationPartiesIdTypeIdValue(
          this.idType as IdType,
          this.idValue,
        );
    obs$.subscribe({
      next: (data) => {
        this.result.set(data);
        this.isLoading.set(false);
      },
      error: (err: { message?: string }) => {
        this.notifications.error(err.message || ERROR_OCCURRED);
        this.isLoading.set(false);
      },
    });
  }

  register(): void {
    if (!this.idType || !this.idValue) return;
    this.isLoading.set(true);
    this.result.set(null);
    const body = {};
    const obs$ = this.subIdOrType
      ? this.interopService.postInteroperationPartiesIdTypeIdValueSubIdOrType(
          this.idType as IdType,
          this.idValue,
          this.subIdOrType,
          body as InteropIdentifierRequestData,
        )
      : this.interopService.postInteroperationPartiesIdTypeIdValue(
          this.idType as IdType,
          this.idValue,
          body as InteropIdentifierRequestData,
        );
    obs$.subscribe({
      next: (data) => {
        this.result.set(data);
        this.isLoading.set(false);
      },
      error: (err: { message?: string }) => {
        this.notifications.error(err.message || ERROR_OCCURRED);
        this.isLoading.set(false);
      },
    });
  }

  deregister(): void {
    if (!this.idType || !this.idValue) return;
    this.isLoading.set(true);
    this.result.set(null);
    const body = {};
    const obs$ = this.subIdOrType
      ? this.interopService.deleteInteroperationPartiesIdTypeIdValueSubIdOrType(
          this.idType as IdType,
          this.idValue,
          this.subIdOrType,
          body as InteropIdentifierRequestData,
        )
      : this.interopService.deleteInteroperationPartiesIdTypeIdValue(
          this.idType as IdType,
          this.idValue,
          body as InteropIdentifierRequestData,
        );
    obs$.subscribe({
      next: (data) => {
        this.result.set(data);
        this.isLoading.set(false);
      },
      error: (err: { message?: string }) => {
        this.notifications.error(err.message || ERROR_OCCURRED);
        this.isLoading.set(false);
      },
    });
  }
}
