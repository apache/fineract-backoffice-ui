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
import { TranslateModule } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TenantOIDCConfigurationService } from '../../../api';
import { I18N } from '../../../core/adapters';
import { DialogService } from '../../../core/services/dialog.service';
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
} from '@ionic/angular/standalone';

/**
 * The tenant OIDC configuration, named as Fineract names it.
 *
 * The generated client types this endpoint's body as a bare `string` — the spec carries no schema
 * — so nothing checks these names at compile time and the previous set (`issuer`,
 * `authorizationEndpoint`, `tokenEndpoint`, `jwksUrl`) did not match the platform at all. The
 * effect was silent: loading an existing configuration left every field blank, because none of the
 * keys the API returned were ones this form read.
 *
 * Verified against `GET /v1/tenants/{tenantId}/oidc-config` on a running instance, which answers:
 *
 * ```json
 * { "tenantId": "default", "providerType": "KEYCLOAK", "issuerUri": "…", "clientId": "…",
 *   "jwksUri": "…", "usernameClaim": "preferred_username", "scopes": "openid,profile,email",
 *   "enabled": true }
 * ```
 *
 * There is no authorization or token endpoint: those come from the provider's discovery document
 * at `{issuerUri}/.well-known/openid-configuration`, which is why the platform does not store them.
 */
interface OidcConfig {
  providerType?: string;
  issuerUri?: string;
  clientId?: string;
  /** Never returned by `GET` — a write-only field. See {@link OidcConfigComponent.onSave}. */
  clientSecret?: string;
  jwksUri?: string;
  usernameClaim?: string;
  scopes?: string;
  postLogoutRedirectUri?: string;
  enabled?: boolean;
}

/**
 * The provider dialects the platform understands, from
 * `fineract-doc/.../security/oidc-federation.adoc`. The value selects how Fineract formats the
 * RP-initiated logout URL, so a wrong one fails only at sign-out — which is why this is a list
 * and not a free-text field.
 */
const PROVIDER_TYPES = ['KEYCLOAK', 'GOOGLE', 'AZURE_AD', 'OKTA', 'AUTH0', 'GENERIC'] as const;

/** What the platform defaults these to, mirrored so a new configuration starts somewhere sane. */
const DEFAULTS: OidcConfig = {
  providerType: 'KEYCLOAK',
  usernameClaim: 'preferred_username',
  scopes: 'openid,profile,email',
  enabled: true,
};

/**
 * Tenant OIDC configuration editor.
 *
 * The endpoints exchange a raw JSON string body — the spec carries no schema for it — so the
 * config is parsed on load and stringified on save, and no field name here is checked by the
 * compiler. {@link OidcConfig} is the transcript of what the platform actually returns.
 *
 * Configuring OIDC does not disable password authentication — both chains run, and a Bearer token
 * routes to one while Basic credentials fall through to the other. See DOCS/OIDC.md.
 *
 * The tenant id is a simple input (defaults to 'default').
 */
@Component({
  selector: 'app-oidc-config',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelect,
    IonSelectOption,
  ],
  template: `
    <div class="oidc-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'OIDC_CONFIG.TITLE' | translate }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <form class="oidc-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'OIDC_CONFIG.TENANT_ID' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'OIDC_CONFIG.TENANT_ID' | translate"
                name="tenantId"
                [(ngModel)]="tenantId"
              ></ion-input>
            </ion-item>
            <div class="load-action">
              <ion-button fill="clear" type="button" (click)="load()">
                {{ 'OIDC_CONFIG.LOAD' | translate }}
              </ion-button>
            </div>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'OIDC_CONFIG.PROVIDER_TYPE' | translate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'OIDC_CONFIG.PROVIDER_TYPE' | translate"
                name="providerType"
                interface="popover"
                [(ngModel)]="config().providerType"
              >
                @for (type of providerTypes; track type) {
                  <ion-select-option [value]="type">{{ type }}</ion-select-option>
                }
              </ion-select>
            </ion-item>
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'OIDC_CONFIG.ISSUER' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'OIDC_CONFIG.ISSUER' | translate"
                name="issuerUri"
                [(ngModel)]="config().issuerUri"
              ></ion-input>
            </ion-item>
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'OIDC_CONFIG.CLIENT_ID' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'OIDC_CONFIG.CLIENT_ID' | translate"
                name="clientId"
                [(ngModel)]="config().clientId"
              ></ion-input>
            </ion-item>
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'OIDC_CONFIG.CLIENT_SECRET' | translate
              }}</ion-label>
              <ion-input
                type="password"
                [attr.aria-label]="'OIDC_CONFIG.CLIENT_SECRET' | translate"
                name="clientSecret"
                [placeholder]="exists ? ('OIDC_CONFIG.SECRET_UNCHANGED' | translate) : ''"
                [(ngModel)]="config().clientSecret"
              ></ion-input>
            </ion-item>
            <p class="field-hint">{{ 'OIDC_CONFIG.SECRET_HINT' | translate }}</p>
            <!--
              No authorization or token endpoint: the platform does not store them, because a
              provider publishes both in its discovery document at
              {issuerUri}/.well-known/openid-configuration. Fields for them were previously
              offered here and silently discarded.
            -->
            <p class="field-hint">{{ 'OIDC_CONFIG.JWKS_HINT' | translate }}</p>
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'OIDC_CONFIG.JWKS_URI' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'OIDC_CONFIG.JWKS_URI' | translate"
                name="jwksUri"
                [(ngModel)]="config().jwksUri"
              ></ion-input>
            </ion-item>
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'OIDC_CONFIG.USERNAME_CLAIM' | translate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'OIDC_CONFIG.USERNAME_CLAIM' | translate"
                name="usernameClaim"
                [(ngModel)]="config().usernameClaim"
              ></ion-input>
            </ion-item>
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'OIDC_CONFIG.SCOPES' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'OIDC_CONFIG.SCOPES' | translate"
                name="scopes"
                [(ngModel)]="config().scopes"
              ></ion-input>
            </ion-item>
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'OIDC_CONFIG.POST_LOGOUT_URI' | translate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'OIDC_CONFIG.POST_LOGOUT_URI' | translate"
                name="postLogoutRedirectUri"
                [(ngModel)]="config().postLogoutRedirectUri"
              ></ion-input>
            </ion-item>

            <div class="actions">
              <ion-button fill="clear" type="button" color="danger" (click)="onDelete()">
                {{ 'COMMON.DELETE' | translate }}
              </ion-button>
              <ion-button color="primary" type="button" [disabled]="isSaving()" (click)="onSave()">
                {{ 'COMMON.SAVE' | translate }}
              </ion-button>
            </div>
          </form>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .oidc-container {
        padding: 24px;
        max-width: 600px;
        margin: 0 auto;
      }
      .oidc-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 16px;
      }
    `,
  ],
})
export class OidcConfigComponent implements OnInit {
  private readonly oidcService = inject(TenantOIDCConfigurationService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);
  private readonly dialogs = inject(DialogService);

  tenantId = 'default';
  exists = false;
  readonly isSaving = signal(false);
  readonly config = signal<OidcConfig>({});
  protected readonly providerTypes = PROVIDER_TYPES;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.oidcService.getTenantsTenantIdOidcConfig(this.tenantId).subscribe({
      next: (body: string) => {
        const parsed = this.parse(body);
        this.exists = parsed !== null;
        this.config.set(parsed ?? { ...DEFAULTS });
      },
      error: (error: unknown) => {
        // A tenant with no configuration answers 404, which is an answer and not a failure:
        // it means "create one", and the form should open on the defaults rather than shout.
        this.exists = false;
        this.config.set({ ...DEFAULTS });
        if ((error as HttpErrorResponse)?.status !== 404) {
          this.notifications.error(this.i18n.translate('OIDC_CONFIG.LOAD_FAILED'));
        }
      },
    });
  }

  /** The endpoint's body is typed as a bare string, so it arrives parsed or not depending on the caller. */
  private parse(body: string | OidcConfig | null): OidcConfig | null {
    if (!body) return null;
    if (typeof body !== 'string') return body;
    try {
      return JSON.parse(body) as OidcConfig;
    } catch {
      this.notifications.error(this.i18n.translate('OIDC_CONFIG.LOAD_FAILED'));
      return null;
    }
  }

  onSave(): void {
    this.isSaving.set(true);

    // `clientSecret` is write-only: `GET` never returns it, so an untouched field means "leave it
    // alone" rather than "set it to empty". Sending the blank would erase a working secret.
    const { clientSecret, ...rest } = this.config();
    const payload: OidcConfig = clientSecret ? { ...rest, clientSecret } : rest;

    const request$ = this.exists
      ? this.oidcService.putTenantsTenantIdOidcConfig(this.tenantId, JSON.stringify(payload))
      : this.oidcService.postTenantsTenantIdOidcConfig(this.tenantId, JSON.stringify(payload));

    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.notifications.success(this.i18n.translate('OIDC_CONFIG.SAVED'));
        this.load();
      },
      error: () => {
        // The interceptor renders the platform's own message; this only has to release the form.
        this.isSaving.set(false);
      },
    });
  }

  async onDelete(): Promise<void> {
    // `window.confirm` previously; the shared dialog is the one the rest of the application
    // uses, and it marks a destructive action as such.
    const confirmed = await this.dialogs.confirm({
      title: this.i18n.translate('OIDC_CONFIG.DELETE_TITLE'),
      message: this.i18n.translate('OIDC_CONFIG.DELETE_MESSAGE'),
      confirmText: this.i18n.translate('COMMON.DELETE'),
      cancelText: this.i18n.translate('COMMON.CANCEL'),
      destructive: true,
    });
    if (!confirmed) return;

    this.oidcService.deleteTenantsTenantIdOidcConfig(this.tenantId).subscribe({
      next: () => {
        this.exists = false;
        this.config.set({ ...DEFAULTS });
        this.notifications.success(this.i18n.translate('OIDC_CONFIG.DELETED'));
      },
      error: () => {
        /* the interceptor reports it */
      },
    });
  }
}
