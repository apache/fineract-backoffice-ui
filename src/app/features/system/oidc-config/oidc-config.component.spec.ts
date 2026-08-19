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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { OidcConfigComponent } from './oidc-config.component';
import { TenantOIDCConfigurationService } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
import { DialogService } from '../../../core/services/dialog.service';
import { provideFakeAdapters } from '../../../testing/adapters';

/**
 * Recorded verbatim from `GET /v1/tenants/default/oidc-config` on a running Fineract.
 *
 * The endpoint's body is untyped in the spec — the generated client declares it as `string` —
 * so nothing checks these names at compile time. This constant is the only thing standing
 * between the component and the field names it used to invent, and it must stay a transcript
 * rather than become whatever the component happens to read.
 *
 * Note what is absent: no `clientSecret` (write-only), and no authorization or token endpoint
 * (a provider publishes both in its discovery document, so the platform does not store them).
 */
const PLATFORM_RESPONSE = {
  tenantId: 'default',
  providerType: 'KEYCLOAK',
  issuerUri: 'https://idp.example.invalid/realms/fineract',
  clientId: 'fineract-backoffice',
  jwksUri: 'https://idp.example.invalid/realms/fineract/protocol/openid-connect/certs',
  usernameClaim: 'preferred_username',
  scopes: 'openid,profile,email',
  enabled: true,
};

describe('OidcConfigComponent', () => {
  const TENANT = 'default';
  let component: OidcConfigComponent;
  let fixture: ComponentFixture<OidcConfigComponent>;
  let serviceSpy: jasmine.SpyObj<TenantOIDCConfigurationService>;
  let notificationsSpy: jasmine.SpyObj<NotificationService>;
  let dialogsSpy: jasmine.SpyObj<DialogService>;

  type Api = TenantOIDCConfigurationService;
  const asGet = (v: unknown) => v as ReturnType<Api['getTenantsTenantIdOidcConfig']>;
  const asWrite = (v: unknown) => v as ReturnType<Api['putTenantsTenantIdOidcConfig']>;

  async function render(
    getResponse: unknown = of(JSON.stringify(PLATFORM_RESPONSE)),
  ): Promise<void> {
    TestBed.resetTestingModule();
    serviceSpy = jasmine.createSpyObj('TenantOIDCConfigurationService', [
      'getTenantsTenantIdOidcConfig',
      'postTenantsTenantIdOidcConfig',
      'putTenantsTenantIdOidcConfig',
      'deleteTenantsTenantIdOidcConfig',
    ]);
    serviceSpy.getTenantsTenantIdOidcConfig.and.returnValue(asGet(getResponse));
    serviceSpy.putTenantsTenantIdOidcConfig.and.returnValue(asWrite(of('')));
    serviceSpy.postTenantsTenantIdOidcConfig.and.returnValue(asWrite(of('')));
    serviceSpy.deleteTenantsTenantIdOidcConfig.and.returnValue(asWrite(of('')));

    notificationsSpy = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    dialogsSpy = jasmine.createSpyObj('DialogService', ['confirm']);
    dialogsSpy.confirm.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [OidcConfigComponent, TranslateModule.forRoot()],
      providers: [
        { provide: TenantOIDCConfigurationService, useValue: serviceSpy },
        { provide: NotificationService, useValue: notificationsSpy },
        { provide: DialogService, useValue: dialogsSpy },
        ...provideFakeAdapters().providers,
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OidcConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await render();
  });

  describe('loading', () => {
    it('reads the fields the platform actually returns', () => {
      // The previous field set (`issuer`, `authorizationEndpoint`, `tokenEndpoint`, `jwksUrl`)
      // matched none of these, so a configured tenant opened this screen to a blank form.
      expect(serviceSpy.getTenantsTenantIdOidcConfig).toHaveBeenCalledWith(TENANT);
      expect(component.exists).toBeTrue();
      expect(component.config().issuerUri).toBe(PLATFORM_RESPONSE.issuerUri);
      expect(component.config().providerType).toBe('KEYCLOAK');
      expect(component.config().clientId).toBe('fineract-backoffice');
      expect(component.config().jwksUri).toBe(PLATFORM_RESPONSE.jwksUri);
      expect(component.config().usernameClaim).toBe('preferred_username');
      expect(component.config().scopes).toBe('openid,profile,email');
    });

    it('treats a 404 as "no configuration yet" rather than as a failure', async () => {
      await render(throwError(() => new HttpErrorResponse({ status: 404 })));

      expect(component.exists).toBeFalse();
      expect(notificationsSpy.error).not.toHaveBeenCalled();
      // Opens on the platform's own defaults, so a new configuration starts somewhere valid.
      expect(component.config().providerType).toBe('KEYCLOAK');
      expect(component.config().usernameClaim).toBe('preferred_username');
      expect(component.config().enabled).toBeTrue();
    });

    it('reports a real load failure instead of only logging it', async () => {
      await render(throwError(() => new HttpErrorResponse({ status: 500 })));
      expect(notificationsSpy.error).toHaveBeenCalled();
    });

    it('accepts a body that arrives already parsed', async () => {
      await render(of(PLATFORM_RESPONSE));
      expect(component.config().issuerUri).toBe(PLATFORM_RESPONSE.issuerUri);
    });
  });

  describe('saving', () => {
    it('updates an existing configuration', () => {
      component.config.set({ issuerUri: 'https://new.invalid', providerType: 'KEYCLOAK' });
      component.onSave();

      const [tenant, body] = serviceSpy.putTenantsTenantIdOidcConfig.calls.mostRecent().args;
      expect(tenant).toBe(TENANT);
      expect(JSON.parse(body as string)).toEqual({
        issuerUri: 'https://new.invalid',
        providerType: 'KEYCLOAK',
      });
    });

    it('creates one when the tenant has none', async () => {
      await render(throwError(() => new HttpErrorResponse({ status: 404 })));
      component.onSave();
      expect(serviceSpy.postTenantsTenantIdOidcConfig).toHaveBeenCalled();
      expect(serviceSpy.putTenantsTenantIdOidcConfig).not.toHaveBeenCalled();
    });

    it('omits an untouched client secret rather than blanking the stored one', () => {
      // `GET` never returns the secret, so an empty field means "leave it alone". Sending the
      // blank would erase a working secret on every unrelated edit.
      component.config.set({ issuerUri: 'https://x.invalid', clientSecret: '' });
      component.onSave();

      const [, body] = serviceSpy.putTenantsTenantIdOidcConfig.calls.mostRecent().args;
      expect(JSON.parse(body as string).clientSecret).toBeUndefined();
    });

    it('sends the client secret when the user actually entered one', () => {
      component.config.set({ issuerUri: 'https://x.invalid', clientSecret: 'a-new-secret' });
      component.onSave();

      const [, body] = serviceSpy.putTenantsTenantIdOidcConfig.calls.mostRecent().args;
      expect(JSON.parse(body as string).clientSecret).toBe('a-new-secret');
    });

    it('confirms the save, so a silent no-op is distinguishable from success', () => {
      component.onSave();
      expect(notificationsSpy.success).toHaveBeenCalled();
    });

    it('stops the spinner when the platform refuses the save', () => {
      // Whatever the platform's reason, the form must not stay stuck saving.
      serviceSpy.putTenantsTenantIdOidcConfig.and.returnValue(
        asWrite(throwError(() => new HttpErrorResponse({ status: 500 }))),
      );
      component.onSave();
      expect(component.isSaving()).toBeFalse();
    });
  });

  describe('deleting', () => {
    it('asks first, through the shared dialog rather than window.confirm', async () => {
      await component.onDelete();
      expect(dialogsSpy.confirm).toHaveBeenCalled();
      expect(dialogsSpy.confirm.calls.mostRecent().args[0].destructive).toBeTrue();
      expect(serviceSpy.deleteTenantsTenantIdOidcConfig).toHaveBeenCalledWith(TENANT);
    });

    it('does nothing when the user declines', async () => {
      dialogsSpy.confirm.and.resolveTo(false);
      await component.onDelete();
      expect(serviceSpy.deleteTenantsTenantIdOidcConfig).not.toHaveBeenCalled();
    });
  });
});
