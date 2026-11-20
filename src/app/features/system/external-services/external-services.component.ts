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
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { ExternalServicesService, PutExternalServiceRequest } from '../../../api';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RequiresPermissionDirective } from '../../../shared';
import { LoadErrorComponent } from '../../../shared/components/load-error/load-error.component';
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
} from '@ionic/angular/standalone';

interface ServiceProperty {
  name: string;
  /** A numeric input hands back a number, or null once cleared, rather than text. */
  value: string | number | null;
  /** The value as loaded; only fields that differ from it are sent. */
  original?: string;
  /** A credential: never loaded into the form, and sent only when a new value is typed. */
  secret?: boolean;
  /** For a secret, whether Fineract holds a value for it. */
  isSet?: boolean;
}

/**
 * The SMS (message gateway) properties Fineract accepts (`ExternalServicesConstants.SMSJSONinputParams`).
 * Listed so a gateway that was never configured still shows its fields.
 */
const SMS_PROPERTIES = new Set(['host_name', 'port_number', 'end_point', 'tenant_app_key']);
const SECRET_PROPERTIES = new Set(['tenant_app_key']);
const NUMERIC_PROPERTIES = new Set(['port_number']);

/**
 * External services configuration: pick a service (S3 / SMTP / NOTIFICATION / SMS),
 * load its name/value properties, edit and save them.
 */
@Component({
  selector: 'app-external-services',
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
    IonSelectOption,
    IonSelect,
    LoadErrorComponent,
    RequiresPermissionDirective,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'EXTERNAL_SERVICES.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'EXTERNAL_SERVICES.SERVICE' | appTranslate
            }}</ion-label>
            <ion-select
              [attr.aria-label]="'EXTERNAL_SERVICES.SERVICE' | appTranslate"
              interface="popover"
              [(ngModel)]="selectedService"
              (ionChange)="load()"
            >
              @for (name of serviceNames; track name) {
                <ion-select-option [value]="name">{{ name }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          @if (selectedService === 'SMS') {
            <p class="service-help" data-testid="sms-help">
              {{ 'EXTERNAL_SERVICES.SMS_HELP' | appTranslate }}
            </p>
          }

          @if (loadError() === 'forbidden') {
            <app-load-error
              testId="external-services-load-error"
              icon="lock-closed-outline"
              [message]="'EXTERNAL_SERVICES.NO_ACCESS' | appTranslate"
            ></app-load-error>
          } @else if (loadError() === 'failed') {
            <app-load-error
              testId="external-services-load-error"
              [message]="'EXTERNAL_SERVICES.LOAD_FAILED' | appTranslate"
              [actionLabel]="'COMMON.RETRY' | appTranslate"
              (action)="load()"
            ></app-load-error>
          }

          @for (prop of properties(); track prop.name) {
            <ion-item fill="outline">
              <ion-label position="stacked">{{ prop.name }}</ion-label>
              @if (prop.secret) {
                <ion-input
                  type="password"
                  autocomplete="new-password"
                  [attr.aria-label]="prop.name"
                  [attr.data-testid]="'secret-' + prop.name"
                  [name]="prop.name"
                  [placeholder]="
                    (prop.isSet
                      ? 'EXTERNAL_SERVICES.SECRET_SET'
                      : 'EXTERNAL_SERVICES.SECRET_NOT_SET'
                    ) | appTranslate
                  "
                  [(ngModel)]="prop.value"
                ></ion-input>
              } @else {
                <ion-input
                  [type]="isNumeric(prop.name) ? 'number' : 'text'"
                  [attr.aria-label]="prop.name"
                  [name]="prop.name"
                  [(ngModel)]="prop.value"
                ></ion-input>
              }
            </ion-item>
          }

          <div class="form-actions">
            <ion-button
              color="primary"
              type="button"
              data-testid="external-services-save"
              appRequiresPermission="UPDATE_EXTERNALSERVICES"
              [disabled]="!canUpdate() || !properties().length || isSaving()"
              (click)="onSave()"
            >
              @if (isSaving()) {
                <ion-spinner name="crescent"></ion-spinner>
                {{ 'COMMON.SAVING' | appTranslate }}
              } @else {
                {{ 'COMMON.SAVE' | appTranslate }}
              }
            </ion-button>
          </div>
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
      .service-help {
        margin: 8px 0;
        color: var(--ion-color-medium);
      }
    `,
  ],
})
export class ExternalServicesComponent implements OnInit {
  private readonly service = inject(ExternalServicesService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);
  private readonly auth = inject(AuthService);
  private loadRequest = 0;

  readonly serviceNames = ['S3', 'SMTP', 'NOTIFICATION', 'SMS'];
  selectedService = '';
  readonly properties = signal<ServiceProperty[]>([]);
  readonly isSaving = signal(false);
  readonly loadError = signal<'forbidden' | 'failed' | null>(null);

  ngOnInit(): void {
    this.selectedService = this.serviceNames[0];
    this.load();
  }

  /**
   * Read in the template as well as through appRequiresPermission: the directive sets the Ionic
   * `disabled` property once, and the `[disabled]` binding below overwrites it when data arrives.
   */
  canUpdate(): boolean {
    return this.auth.hasPermission('UPDATE_EXTERNALSERVICES');
  }

  isNumeric(name: string): boolean {
    return NUMERIC_PROPERTIES.has(name);
  }

  /** `keepForm` refreshes in place, as after a save, instead of clearing the fields first. */
  load(keepForm = false): void {
    if (!this.selectedService) return;
    const serviceName = this.selectedService;
    const request = ++this.loadRequest;
    if (!keepForm) this.properties.set([]);
    this.loadError.set(null);
    this.service.getExternalserviceServicename(serviceName).subscribe({
      next: (data) => {
        if (request !== this.loadRequest) return;
        const list = (data as unknown as ServiceProperty[]) ?? [];
        this.properties.set(toFormProperties(serviceName, list));
      },
      error: (error: unknown) => {
        if (request !== this.loadRequest) return;
        // A failed refresh after a save must not leave stale values behind to be saved again.
        this.properties.set([]);
        this.loadError.set(
          error instanceof HttpErrorResponse && error.status === 403 ? 'forbidden' : 'failed',
        );
      },
    });
  }

  onSave(): void {
    if (!this.selectedService || !this.canUpdate() || this.isSaving()) return;
    const request: Record<string, string> = {};
    for (const prop of this.properties()) {
      // Only what was edited is sent. Fineract updates just the keys it receives, so an untouched
      // field keeps its stored value, and an empty secret keeps the stored credential.
      const value = prop.value === null ? '' : String(prop.value);
      const changed = prop.secret ? value !== '' : value !== prop.original;
      if (changed) request[prop.name] = value;
    }
    if (!Object.keys(request).length) {
      void this.notifications.show(this.i18n.translate('EXTERNAL_SERVICES.NO_CHANGES'));
      return;
    }
    this.isSaving.set(true);
    this.service
      .putExternalserviceServicename(
        this.selectedService,
        request as unknown as PutExternalServiceRequest,
      )
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          void this.notifications.success(this.i18n.translate('EXTERNAL_SERVICES.SAVED'));
          this.load(true);
        },
        // The error interceptor reports the failure, with any app key value left out.
        error: () => this.isSaving.set(false),
      });
  }
}

/**
 * Maps Fineract's name/value list onto form fields. Secrets keep only whether a value is
 * stored, so the credential never reaches the form; SMS lists all four fields even when unset.
 */
function toFormProperties(serviceName: string, list: ServiceProperty[]): ServiceProperty[] {
  const loaded = list.map((p) => ({
    name: p.name ?? '',
    value: p.value === null || p.value === undefined ? '' : String(p.value),
  }));
  const names =
    serviceName === 'SMS'
      ? [...SMS_PROPERTIES, ...loaded.map((p) => p.name).filter((n) => !SMS_PROPERTIES.has(n))]
      : loaded.map((p) => p.name);
  return names.map((name) => {
    const value = loaded.find((p) => p.name === name)?.value ?? '';
    return SECRET_PROPERTIES.has(name)
      ? { name, value: '', secret: true, isSet: value !== '' }
      : { name, value, original: value };
  });
}
