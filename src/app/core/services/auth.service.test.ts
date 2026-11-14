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

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FakeStorageAdapter, provideFakeAdapters } from '../../testing/adapters';
import { vi } from 'vitest';
import { provideTestConfig } from '../../testing/config';
import { OidcService } from './oidc.service';
import { AuthService, UserSession, sessionFromUserDetails } from './auth.service';
import { ConfigService } from './config.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let storage: FakeStorageAdapter;
  let adapterProviders: ReturnType<typeof provideFakeAdapters>['providers'];

  const mockSession: UserSession = {
    username: 'mifos',
    userId: 1,
    base64EncodedAuthenticationKey: 'bWlmb3M6cGFzc3dvcmQ=',
    authenticated: true,
    officeId: 1,
    officeName: 'Head Office',
    permissions: ['ALL_FUNCTIONS'],
  };

  beforeEach(() => {
    const fakes = provideFakeAdapters();
    storage = fakes.storage;
    adapterProviders = fakes.providers;
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        ConfigService,
        provideHttpClient(),
        provideHttpClientTesting(),
        ...adapterProviders,
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should login successfully and set state', () => {
    service.login('mifos', 'password', 'default').subscribe((session) => {
      expect(session).toEqual(mockSession);
      expect(service.isAuthenticated()).toBe(true);
      expect(service.username()).toBe('mifos');
    });

    const req = httpMock.expectOne((request) => request.url.includes('/authentication'));
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Fineract-Platform-TenantId')).toBe('default');
    req.flush(mockSession);
  });

  it('should logout and clear state', () => {
    // Access private setSession for testing
    (service as unknown as { setSession: (s: UserSession) => void }).setSession(mockSession);
    expect(service.isAuthenticated()).toBe(true);

    service.logout();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(storage.readRaw('session')).toBeNull();
  });

  describe('identity-provider sign-in', () => {
    /** A verbatim shape of Fineract's `AuthenticatedOauthUserData` for a non-administrator. */
    const userDetails = {
      username: 'teller1',
      userId: 7,
      accessToken: 'AT',
      authenticated: true,
      officeId: 2,
      officeName: 'Agence Douala',
      staffId: 9,
      staffDisplayName: 'Teller, One',
      roles: [{ id: 3, name: 'back-office-operator', description: 'ACT-11', disabled: false }],
      permissions: ['READ_CLIENT', 'READ_SAVINGSACCOUNT ', 'READ_CLIENT'],
      shouldRenewPassword: false,
      isTwoFactorAuthenticationRequired: false,
    };

    it('maps the userdetails answer to the session the Basic login produces', () => {
      expect(sessionFromUserDetails(userDetails)).toEqual({
        username: 'teller1',
        userId: 7,
        officeId: 2,
        officeName: 'Agence Douala',
        staffId: 9,
        staffDisplayName: 'Teller, One',
        authenticated: true,
        base64EncodedAuthenticationKey: '',
        permissions: ['READ_CLIENT', 'READ_SAVINGSACCOUNT ', 'READ_CLIENT'],
        roles: userDetails.roles,
        authType: 'oidc',
      });
    });

    it('refuses an answer that names no user', () => {
      expect(() => sessionFromUserDetails({})).toThrow();
      expect(() => sessionFromUserDetails(null)).toThrow();
    });

    it('asks Fineract with the Bearer token and opens a complete session, permissions normalised', () => {
      const oidc = TestBed.inject(OidcService);
      vi.spyOn(oidc, 'getAccessToken').mockReturnValue('AT');
      service.completeOidcLogin().subscribe();

      const req = httpMock.expectOne((r) => r.url.endsWith('/userdetails'));
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer AT');
      expect(req.request.headers.get('Fineract-Platform-TenantId')).toBe('default');
      req.flush(userDetails);

      expect(service.isAuthenticated()).toBe(true);
      expect(service.isOidcSession()).toBe(true);
      expect(service.twoFactorPending()).toBe(false);
      expect(service.username()).toBe('teller1');
      expect(service.officeName()).toBe('Agence Douala');
      expect(service.getAuthToken()).toBeNull();
      expect(service.currentUser()?.permissions).toEqual(['READ_CLIENT', 'READ_SAVINGSACCOUNT']);
      expect(service.hasPermission('READ_CLIENT')).toBe(true);
      expect(service.hasPermission('CREATE_CLIENT')).toBe(false);
    });

    it('drops the tokens when Fineract refuses them, leaving nobody half signed in', () => {
      const oidc = TestBed.inject(OidcService);
      const clear = vi.spyOn(oidc, 'clear');
      let failed = false;
      service.completeOidcLogin().subscribe({ error: () => (failed = true) });

      httpMock
        .expectOne((r) => r.url.endsWith('/userdetails'))
        .flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(failed).toBe(true);
      expect(clear).toHaveBeenCalled();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('ends the session at the provider on logout', () => {
      const oidc = TestBed.inject(OidcService);
      const end = vi.spyOn(oidc, 'endSession').mockResolvedValue();
      (service as unknown as { setSession: (s: UserSession) => void }).setSession(
        sessionFromUserDetails(userDetails),
      );

      service.logout();

      expect(end).toHaveBeenCalledTimes(1);
      expect(service.isAuthenticated()).toBe(false);
    });

    it('does not contact the provider when a password session logs out', () => {
      const oidc = TestBed.inject(OidcService);
      const end = vi.spyOn(oidc, 'endSession').mockResolvedValue();
      (service as unknown as { setSession: (s: UserSession) => void }).setSession(mockSession);

      service.logout();

      expect(end).not.toHaveBeenCalled();
    });

    it('does not restore an identity-provider session that has no tokens (a new tab)', () => {
      storage.write('session', sessionFromUserDetails(userDetails));
      const fresh = TestBed.runInInjectionContext(() => new AuthService());
      expect(fresh.isAuthenticated()).toBe(false);
      expect(fresh.currentUser()).toBeNull();
    });
  });

  describe('hasPermission', () => {
    it('should return false if user is not authenticated', () => {
      expect(service.hasPermission('CREATE_CLIENT')).toBe(false);
    });

    it('should return true for any permission if user is superuser', () => {
      (service as unknown as { setSession: (s: UserSession) => void }).setSession({
        ...mockSession,
        permissions: ['ALL_FUNCTIONS'],
      });
      expect(service.hasPermission('CREATE_CLIENT')).toBe(true);
      expect(service.hasPermission('DELETE_LOAN')).toBe(true);
    });

    it('should correctly evaluate single and multiple permissions', () => {
      (service as unknown as { setSession: (s: UserSession) => void }).setSession({
        ...mockSession,
        permissions: ['READ_CLIENT', 'CREATE_CLIENT'],
      });
      expect(service.hasPermission('READ_CLIENT')).toBe(true);
      expect(service.hasPermission('DELETE_LOAN')).toBe(false);

      // Check any matching permission (matchAll = false)
      expect(service.hasPermission(['READ_CLIENT', 'DELETE_LOAN'])).toBe(true);

      // Check all matching permissions (matchAll = true)
      expect(service.hasPermission(['READ_CLIENT', 'CREATE_CLIENT'], true)).toBe(true);
      expect(service.hasPermission(['READ_CLIENT', 'DELETE_LOAN'], true)).toBe(false);
    });

    describe('ALL_FUNCTIONS_READ shortcut', () => {
      beforeEach(() => {
        (service as unknown as { setSession: (s: UserSession) => void }).setSession({
          ...mockSession,
          permissions: ['ALL_FUNCTIONS_READ'],
        });
      });

      it('grants any single READ_* permission', () => {
        expect(service.hasPermission('READ_CLIENT')).toBe(true);
        expect(service.hasPermission('READ_LOAN')).toBe(true);
      });

      it('denies a single non-READ_* permission', () => {
        expect(service.hasPermission('CREATE_CLIENT')).toBe(false);
        expect(service.hasPermission('DELETE_LOAN')).toBe(false);
        expect(service.hasPermission('APPROVE_LOAN')).toBe(false);
      });

      it('grants an array made up entirely of READ_* permissions', () => {
        expect(service.hasPermission(['READ_CLIENT', 'READ_LOAN'])).toBe(true);
        expect(service.hasPermission(['READ_CLIENT', 'READ_LOAN'], true)).toBe(true);
      });

      it('does not grant a mixed array via the shortcut, falling back to real permissions', () => {
        expect(service.hasPermission(['READ_CLIENT', 'CREATE_CLIENT'])).toBe(false);
        expect(service.hasPermission(['READ_CLIENT', 'CREATE_CLIENT'], true)).toBe(false);
      });
    });

    it('ALL_FUNCTIONS still bypasses non-READ permissions (unlike ALL_FUNCTIONS_READ)', () => {
      (service as unknown as { setSession: (s: UserSession) => void }).setSession({
        ...mockSession,
        permissions: ['ALL_FUNCTIONS'],
      });
      expect(service.hasPermission(['READ_CLIENT', 'CREATE_CLIENT'], true)).toBe(true);
    });
  });

  describe('two-factor authentication', () => {
    const TFA_TOKEN = 'tfa-token-123';
    const INVALIDATE = '/twofactor/invalidate';
    const twoFactorSession: UserSession = {
      ...mockSession,
      isTwoFactorAuthenticationRequired: true,
    };

    function signIn(session: UserSession): void {
      service.login('mifos', 'password', 'default').subscribe();
      httpMock.expectOne((r) => r.url.includes('/authentication')).flush(session);
    }

    it('does not admit the user while a second factor is outstanding', () => {
      // `authenticated: true` only means the password was right. Fineract refuses everything
      // else until the one-time token is validated, so letting the user in here lands them on a
      // dashboard where every request 403s.
      signIn(twoFactorSession);

      expect(service.currentUser()).not.toBeNull();
      expect(service.twoFactorPending()).toBe(true);
      expect(service.isAuthenticated()).toBe(false);
      expect(service.getTfaToken()).toBeNull();
    });

    it('admits the user once the second factor is recorded', () => {
      signIn(twoFactorSession);
      service.completeTwoFactorAuthentication(TFA_TOKEN);

      expect(service.isAuthenticated()).toBe(true);
      expect(service.twoFactorPending()).toBe(false);
      expect(service.getTfaToken()).toBe(TFA_TOKEN);
    });

    it('leaves a deployment without a second factor exactly as it was', () => {
      // The flag is absent entirely when the platform runs without 2FA, which is the case that
      // must not change.
      signIn(mockSession);

      expect(service.isAuthenticated()).toBe(true);
      expect(service.twoFactorPending()).toBe(false);
      expect(service.getTfaToken()).toBeNull();
    });

    it('survives a reload mid-flow without admitting the user', () => {
      signIn(twoFactorSession);

      // A fresh service over the same session storage, as a refresh would produce.
      const reloaded = TestBed.runInInjectionContext(() => new AuthService());
      expect(reloaded.currentUser()).not.toBeNull();
      expect(reloaded.isAuthenticated()).toBe(false);
      expect(reloaded.twoFactorPending()).toBe(true);
    });

    it('restores a completed session across a reload', () => {
      signIn(twoFactorSession);
      service.completeTwoFactorAuthentication(TFA_TOKEN);

      const reloaded = TestBed.runInInjectionContext(() => new AuthService());
      expect(reloaded.isAuthenticated()).toBe(true);
      expect(reloaded.twoFactorPending()).toBe(false);
      expect(reloaded.getTfaToken()).toBe(TFA_TOKEN);
    });

    it('ends the second factor at the platform on sign-out', () => {
      signIn(twoFactorSession);
      service.completeTwoFactorAuthentication(TFA_TOKEN);

      service.logout();

      // Forgetting it locally would leave it valid for its full life — 24 hours by default.
      const invalidate = httpMock.expectOne((r) => r.url.includes(INVALIDATE));
      expect(invalidate.request.method).toBe('POST');
      expect(invalidate.request.body).toEqual({ token: TFA_TOKEN });
      invalidate.flush({});

      expect(service.isAuthenticated()).toBe(false);
      expect(service.getTfaToken()).toBeNull();
    });

    it('signs the user out even when invalidation fails', () => {
      signIn(twoFactorSession);
      service.completeTwoFactorAuthentication(TFA_TOKEN);

      service.logout();
      httpMock
        .expectOne((r) => r.url.includes(INVALIDATE))
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(service.isAuthenticated()).toBe(false);
      expect(service.currentUser()).toBeNull();
    });

    it('does not call invalidate when there was no second factor', () => {
      signIn(mockSession);
      service.logout();
      httpMock.expectNone((r) => r.url.includes(INVALIDATE));
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('permission normalization (trailing-space backend duplicates)', () => {
    it('trims a trailing-space permission on setSession so a clean check matches', () => {
      (service as unknown as { setSession: (s: UserSession) => void }).setSession({
        ...mockSession,
        permissions: ['READ_STANDINGINSTRUCTION '],
      });
      expect(service.hasPermission('READ_STANDINGINSTRUCTION')).toBe(true);
    });

    it('dedupes a clean/trailing-space duplicate pair into a single entry on setSession', () => {
      (service as unknown as { setSession: (s: UserSession) => void }).setSession({
        ...mockSession,
        permissions: ['READ_CLIENT ', 'READ_CLIENT'],
      });
      expect(service.currentUser()?.permissions).toEqual(['READ_CLIENT']);
      expect(service.hasPermission('READ_CLIENT')).toBe(true);
    });

    it('normalizes a dirty session read back from storage on init', () => {
      storage.write('session', {
        ...mockSession,
        permissions: ['CREATE_STANDINGINSTRUCTION', 'CREATE_STANDINGINSTRUCTION ', 'READ_X '],
      });

      // Reset and reconfigure so AuthService is constructed fresh, reading the
      // dirty session entry above via getStoredSession() during signal init.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AuthService,
          ConfigService,
          provideHttpClient(),
          provideHttpClientTesting(),
          ...adapterProviders,
        ],
      });
      const freshService = TestBed.inject(AuthService);

      expect(freshService.currentUser()?.permissions).toEqual([
        'CREATE_STANDINGINSTRUCTION',
        'READ_X',
      ]);
      expect(freshService.hasPermission('READ_X')).toBe(true);
    });
  });
});

/**
 * The real OidcService end to end through AuthService.logout(): only the browser's redirect and the
 * provider's HTTP answers are replaced. A mocked `endSession` once hid that the ID token was wiped
 * before it was read, so the end-session URL carried no `id_token_hint`.
 */
describe('AuthService.logout with an identity-provider session', () => {
  const ISSUER = 'https://sso.example/realms/bank';

  class RecordingOidcService extends OidcService {
    readonly navigations: string[] = [];
    protected override navigate(url: string): void {
      this.navigations.push(url);
    }
    protected override origin(): string {
      return 'https://ui.example';
    }
  }

  let storage: FakeStorageAdapter;
  let oidc: RecordingOidcService;
  let auth: AuthService;

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          issuer: ISSUER,
          authorization_endpoint: `${ISSUER}/auth`,
          token_endpoint: `${ISSUER}/token`,
          end_session_endpoint: `${ISSUER}/logout`,
        }),
      ),
    );
    const fakes = provideFakeAdapters();
    storage = fakes.storage;
    TestBed.configureTestingModule({
      providers: [
        ...fakes.providers,
        provideTestConfig({
          oidcLoginEnabled: true,
          oidc: { issuer: ISSUER, clientId: 'backoffice-ui' },
        }),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OidcService, useClass: RecordingOidcService },
      ],
    });
    oidc = TestBed.inject(OidcService) as RecordingOidcService;
    storage.write('oidcTokens', {
      accessToken: 'AT',
      idToken: 'THE-ID-TOKEN',
      refreshToken: 'RT',
      expiresAt: Date.now() + 300_000,
    });
    storage.write('session', {
      username: 'teller1',
      userId: 7,
      base64EncodedAuthenticationKey: '',
      authenticated: true,
      officeId: 1,
      officeName: 'Head Office',
      permissions: ['READ_CLIENT'],
      authType: 'oidc',
    });
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sends id_token_hint and post_logout_redirect_uri to the end-session endpoint', async () => {
    expect(auth.isAuthenticated()).toBe(true);

    auth.logout();
    await vi.waitFor(() => expect(oidc.navigations).toHaveLength(1));

    const url = new URL(oidc.navigations[0]);
    expect(url.origin + url.pathname).toBe(`${ISSUER}/logout`);
    expect(url.searchParams.get('id_token_hint')).toBe('THE-ID-TOKEN');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe('https://ui.example/login');
    expect(url.searchParams.get('client_id')).toBe('backoffice-ui');
    expect(auth.isAuthenticated()).toBe(false);
    expect(oidc.hasSession()).toBe(false);
  });
});
