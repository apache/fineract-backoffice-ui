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

import { createSpyObj, SpyObj } from '../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService, UserSession } from '../../core/services/auth.service';
import { ConfigService } from '../../core/services/config.service';
import { NotificationService } from '../../core/services/notification.service';
import { WritableSignal, signal } from '@angular/core';
import { provideTranslateTesting } from '../../testing/i18n-testing';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authServiceSpy: SpyObj<AuthService>;
  let configServiceSpy: SpyObj<ConfigService>;
  let notificationSpy: SpyObj<NotificationService>;
  let routerSpy: SpyObj<Router>;
  const mockApiUrl = 'https://localhost:8443/fineract-provider/api/v1';

  /** Configures the TestBed with the query parameters the login route was reached with. */
  async function setup(queryParams: Record<string, string> = {}) {
    authServiceSpy = createSpyObj(['login', 'currentTenantId', 'twoFactorPending', 'logout']);
    authServiceSpy.currentTenantId.mockReturnValue('default');
    // No second factor: what every deployment without `fineract.security.2fa.enabled` sees.
    authServiceSpy.twoFactorPending.mockReturnValue(false);

    configServiceSpy = Object.assign(
      createSpyObj<ConfigService>(['setApiUrl', 'isAllowedApiUrl']),
      {
        apiUrl: mockApiUrl,
        // The component reads the allow-list to build the endpoint picker.
        config: signal({ allowedApiOrigins: [] }),
        // Off by default, matching every existing config.json — see ConfigService.oidcLoginEnabled.
        oidcLoginEnabled: signal(false),
      },
    );
    configServiceSpy.setApiUrl.mockReturnValue(true);
    configServiceSpy.isAllowedApiUrl.mockReturnValue(true);

    notificationSpy = createSpyObj(['success', 'error', 'show']);

    routerSpy = createSpyObj(['navigate']);

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, LoginComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ConfigService, useValue: configServiceSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap(queryParams)) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be invalid when empty', () => {
    expect(component['loginForm'].valid).toBe(false);
  });

  it('announces invalid fields only after interaction', () => {
    const username = fixture.nativeElement.querySelector('#username') as HTMLInputElement;
    const password = fixture.nativeElement.querySelector('#password') as HTMLInputElement;

    expect(username.hasAttribute('aria-invalid')).toBe(false);
    expect(password.hasAttribute('aria-invalid')).toBe(false);

    component['loginForm'].controls.username.markAsTouched();
    fixture.detectChanges();

    expect(username.getAttribute('aria-invalid')).toBe('true');
    expect(password.hasAttribute('aria-invalid')).toBe(false);
  });

  it('should call login and navigate on success', () => {
    authServiceSpy.login.mockReturnValue(of({} as UserSession));

    component['loginForm'].setValue({
      serverUrl: mockApiUrl,
      customUrl: '',
      tenantId: 'default',
      username: 'mifos',
      // A form-submission fixture, not a credential.
      password: 'password123',
    });

    component.onSubmit();

    expect(authServiceSpy.login).toHaveBeenCalledWith('mifos', 'password123', 'default');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should set error on login failure', () => {
    authServiceSpy.login.mockReturnValue(
      throwError(() => ({ error: { defaultUserMessage: 'Failed' } })),
    );

    component['loginForm'].setValue({
      serverUrl: mockApiUrl,
      customUrl: '',
      tenantId: 'default',
      username: 'mifos',
      // A form-submission fixture, not a credential.
      password: 'wrongpassword',
    });

    component.onSubmit();

    expect((component as unknown as { error: WritableSignal<string | null> }).error()).toBe(
      'Failed',
    );
    expect((component as unknown as { isLoading: WritableSignal<boolean> }).isLoading()).toBe(
      false,
    );
  });

  describe('sign-in failure message', () => {
    const submitWith = (failure: unknown): string | null => {
      authServiceSpy.login.mockReturnValue(throwError(() => failure));
      component['loginForm'].setValue({
        serverUrl: mockApiUrl,
        customUrl: '',
        tenantId: 'default',
        username: 'mifos',
        // A form-submission fixture, not a credential.
        password: 'wrongpassword',
      });
      component.onSubmit();
      return (component as unknown as { error: WritableSignal<string | null> }).error();
    };

    it('names the credentials for a refused username or password', () => {
      expect(
        submitWith({
          status: 401,
          error: {
            userMessageGlobalisationCode: 'error.msg.not.authenticated',
            defaultUserMessage: 'Unauthenticated. Please login.',
          },
        }),
      ).toBe('login.errors.invalidCredentials');
    });

    it("keeps the platform's own message for an unknown tenant", () => {
      expect(
        submitWith({
          status: 401,
          error: {
            userMessageGlobalisationCode: 'error.msg.invalid.tenant.identifier',
            defaultUserMessage: 'Invalid tenant identifier provided with request.',
          },
        }),
      ).toBe('Invalid tenant identifier provided with request.');
    });

    it('points at the server selection when the sign-in endpoint is not there', () => {
      expect(submitWith({ status: 404, error: null })).toBe('login.errors.endpointNotFound');
    });

    it('says the server could not be reached for a network or CORS failure', () => {
      expect(submitWith({ status: 0, error: null })).toBe('login.errors.serverUnreachable');
    });

    it('falls back to a generic message when there is nothing more specific', () => {
      expect(submitWith({ status: 500, error: null })).toBe('login.errors.failed');
    });
  });

  describe('identity-provider button', () => {
    it('is absent when the deployment has not turned it on', () => {
      expect(fixture.nativeElement.querySelector('[data-testid="login-sso-button"]')).toBeNull();
    });

    it('appears alongside the username/password form, not instead of it, when turned on', async () => {
      TestBed.resetTestingModule();
      await setup();
      (configServiceSpy.oidcLoginEnabled as unknown as WritableSignal<boolean>).set(true);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="login-sso-button"]'),
      ).not.toBeNull();
      // The fallback this flag must never remove — see the config field's own doc comment.
      expect(fixture.nativeElement.querySelector('#username')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('#password')).not.toBeNull();
    });

    it('says the provider round trip is not built yet, rather than doing nothing or pretending to redirect', async () => {
      TestBed.resetTestingModule();
      await setup();
      (configServiceSpy.oidcLoginEnabled as unknown as WritableSignal<boolean>).set(true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector(
        '[data-testid="login-sso-button"]',
      ) as HTMLButtonElement;
      button.click();

      expect(notificationSpy.show).toHaveBeenCalledWith('login.sso.notImplemented');
      expect(routerSpy.navigate).not.toHaveBeenCalled();
      expect(authServiceSpy.login).not.toHaveBeenCalled();
    });
  });

  describe('session expiry notice', () => {
    it('should not show a notice when the user came here on their own', () => {
      expect(fixture.nativeElement.querySelector('.notice')).toBeNull();
    });

    it('should explain the redirect when errorInterceptor sent the user back', async () => {
      TestBed.resetTestingModule();
      await setup({ reason: 'session-expired' });

      // Without this the redirect reads as the app losing the page for no reason.
      const notice = fixture.nativeElement.querySelector('.notice');
      expect(notice).not.toBeNull();
      expect(notice.textContent).toContain('login.sessionExpired');
    });

    it('should explain a redirect caused by inactivity, in its own words', async () => {
      TestBed.resetTestingModule();
      await setup({ reason: 'inactivity' });

      // Asserting the copy, not just that a notice exists: both reasons rendering the same
      // "your session has expired" would pass a presence-only check while telling the user
      // the wrong thing about why they are here.
      const notice = fixture.nativeElement.querySelector('.notice');
      expect(notice).not.toBeNull();
      expect(notice.textContent).toContain('login.signedOutForInactivity');
    });

    it('should stay silent for a reason it does not recognise', async () => {
      TestBed.resetTestingModule();
      await setup({ reason: 'not-a-real-reason' });

      expect(fixture.nativeElement.querySelector('.notice')).toBeNull();
    });
  });
});
