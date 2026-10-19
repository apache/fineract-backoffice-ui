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
import { vi } from 'vitest';
import { FakeStorageAdapter, provideFakeAdapters } from '../../testing/adapters';
import { provideTestConfig } from '../../testing/config';
import { OidcError, OidcService, pkceChallenge, REFRESH_SKEW_MS } from './oidc.service';

const ISSUER = 'https://sso.example/realms/bank';
const DISCOVERY = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
  token_endpoint: `${ISSUER}/protocol/openid-connect/token`,
  end_session_endpoint: `${ISSUER}/protocol/openid-connect/logout`,
};

const DEFAULT_OIDC = { issuer: ISSUER, clientId: 'backoffice-ui' };

/** A service whose redirects are recorded instead of followed. */
class TestOidcService extends OidcService {
  readonly navigations: string[] = [];
  protected override navigate(url: string): void {
    this.navigations.push(url);
  }
  protected override origin(): string {
    return 'https://ui.example';
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function idToken(claims: Record<string, unknown>): string {
  const enc = (o: unknown) =>
    btoa(JSON.stringify(o)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const now = Math.floor(Date.now() / 1000);
  return `${enc({ alg: 'RS256' })}.${enc({ iat: now, exp: now + 300, ...claims })}.sig`;
}

describe('OidcService', () => {
  let service: TestOidcService;
  let storage: FakeStorageAdapter;
  let fetchMock: ReturnType<typeof vi.fn>;

  function setup(oidc: Record<string, unknown> = DEFAULT_OIDC) {
    const fakes = provideFakeAdapters();
    storage = fakes.storage;
    TestBed.configureTestingModule({
      providers: [
        ...fakes.providers,
        provideTestConfig({ oidcLoginEnabled: true, oidc: oidc as never }),
        { provide: OidcService, useClass: TestOidcService },
      ],
    });
    service = TestBed.inject(OidcService) as TestOidcService;
  }

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/.well-known/openid-configuration')) return json(DISCOVERY);
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** Starts a sign-in and returns the parameters of the authorization request. */
  async function start(): Promise<URLSearchParams> {
    await service.startLogin();
    return new URL(service.navigations[0]).searchParams;
  }

  function tokenEndpoint(handler: () => Response | Promise<Response>) {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/.well-known/openid-configuration') ? json(DISCOVERY) : handler(),
    );
  }

  describe('startLogin', () => {
    it('redirects with the code flow, PKCE S256, state and nonce, and default scopes', async () => {
      setup();
      const q = await start();

      expect(service.navigations[0].startsWith(DISCOVERY.authorization_endpoint + '?')).toBe(true);
      expect(q.get('response_type')).toBe('code');
      expect(q.get('client_id')).toBe('backoffice-ui');
      expect(q.get('redirect_uri')).toBe('https://ui.example/auth/callback');
      expect(q.get('scope')).toBe('openid profile');
      expect(q.get('code_challenge_method')).toBe('S256');
      expect(q.get('state')).toBeTruthy();
      expect(q.get('nonce')).toBeTruthy();
      const flow = storage.read<{ verifier: string }>('oidcFlow', null as never);
      expect(q.get('code_challenge')).toBe(await pkceChallenge(flow.verifier));
    });

    it('never asks for offline_access, even when the config lists it', async () => {
      setup({ issuer: ISSUER, clientId: 'c', scopes: 'openid profile offline_access' });
      expect((await start()).get('scope')).toBe('openid profile');
    });

    it('computes the RFC 7636 appendix B challenge', async () => {
      expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
        'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      );
    });

    it('is refused when OIDC is not configured', async () => {
      setup({});
      await expect(service.startLogin()).rejects.toBeInstanceOf(OidcError);
    });

    it('refuses a discovery document that points at another origin', async () => {
      setup();
      fetchMock.mockImplementation(async () =>
        json({ ...DISCOVERY, token_endpoint: 'https://evil.example/token' }),
      );
      await expect(service.startLogin()).rejects.toMatchObject({ code: 'discovery' });
    });

    it('refuses a discovery document whose issuer differs from the configured one', async () => {
      setup();
      fetchMock.mockImplementation(async () => json({ ...DISCOVERY, issuer: 'https://other' }));
      await expect(service.startLogin()).rejects.toMatchObject({ code: 'discovery' });
    });
  });

  describe('completeLogin', () => {
    async function begin() {
      const q = await start();
      return { state: q.get('state')!, nonce: q.get('nonce')! };
    }

    it('exchanges the code with the PKCE verifier and stores the tokens', async () => {
      setup();
      const { state, nonce } = await begin();
      const verifier = storage.read<{ verifier: string }>('oidcFlow', null as never).verifier;
      tokenEndpoint(() =>
        json({
          access_token: 'AT',
          refresh_token: 'RT',
          id_token: idToken({ iss: ISSUER, aud: 'backoffice-ui', nonce }),
          expires_in: 300,
          refresh_expires_in: 1800,
        }),
      );

      await service.completeLogin(new URLSearchParams({ code: 'abc', state }));

      const call = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/token'))!;
      const sent = new URLSearchParams(call[1].body as string);
      expect(sent.get('grant_type')).toBe('authorization_code');
      expect(sent.get('code')).toBe('abc');
      expect(sent.get('code_verifier')).toBe(verifier);
      expect(sent.get('client_id')).toBe('backoffice-ui');
      expect(call[1].credentials).toBe('omit');
      expect(service.hasSession()).toBe(true);
      expect(service.getAccessToken()).toBe('AT');
      expect(storage.readRaw('oidcFlow')).toBeNull();
    });

    it('rejects a mismatched state without calling the token endpoint', async () => {
      setup();
      await begin();
      await expect(
        service.completeLogin(new URLSearchParams({ code: 'abc', state: 'forged' })),
      ).rejects.toMatchObject({ code: 'invalid_state' });
      expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/token'))).toBe(false);
      expect(service.hasSession()).toBe(false);
    });

    it('allows one attempt per flow: a replayed redirect fails', async () => {
      setup();
      const { state, nonce } = await begin();
      tokenEndpoint(() =>
        json({
          access_token: 'AT',
          id_token: idToken({ iss: ISSUER, aud: 'backoffice-ui', nonce }),
          expires_in: 300,
        }),
      );
      const params = new URLSearchParams({ code: 'abc', state });
      await service.completeLogin(params);
      await expect(service.completeLogin(params)).rejects.toMatchObject({ code: 'invalid_state' });
    });

    it('reports an error returned by the provider', async () => {
      setup();
      const { state } = await begin();
      await expect(
        service.completeLogin(new URLSearchParams({ error: 'access_denied', state })),
      ).rejects.toMatchObject({ code: 'access_denied' });
    });

    it('rejects an ID token with the wrong nonce', async () => {
      setup();
      const { state } = await begin();
      tokenEndpoint(() =>
        json({
          access_token: 'AT',
          id_token: idToken({ iss: ISSUER, aud: 'backoffice-ui', nonce: 'other' }),
          expires_in: 300,
        }),
      );
      await expect(
        service.completeLogin(new URLSearchParams({ code: 'abc', state })),
      ).rejects.toMatchObject({ code: 'invalid_id_token' });
      expect(service.hasSession()).toBe(false);
    });

    describe('ID token checks', () => {
      const good = { iss: ISSUER, aud: 'backoffice-ui' };

      async function exchange(claims: Record<string, unknown> | null) {
        setup();
        const { state, nonce } = await begin();
        tokenEndpoint(() =>
          json({
            access_token: 'AT',
            ...(claims ? { id_token: idToken({ nonce, ...claims }) } : {}),
            expires_in: 300,
          }),
        );
        return service.completeLogin(new URLSearchParams({ code: 'abc', state }));
      }

      it('requires an ID token: logout needs it as id_token_hint', async () => {
        await expect(exchange(null)).rejects.toMatchObject({ code: 'invalid_id_token' });
        expect(service.hasSession()).toBe(false);
      });

      it('accepts a valid one', async () => {
        await exchange(good);
        expect(service.getIdToken()).toBeTruthy();
      });

      it.each([
        ['nonce', { ...good, nonce: 'other' }],
        ['issuer', { ...good, iss: 'https://other.example/realms/x' }],
        ['audience', { ...good, aud: 'another-client' }],
        ['audience given as a list without the client', { ...good, aud: ['a', 'b'] }],
        ['authorized party', { ...good, azp: 'another-client' }],
        ['expiry', { ...good, exp: Math.floor(Date.now() / 1000) - 600 }],
        ['missing expiry', { ...good, exp: undefined }],
        ['issue time in the future', { ...good, iat: Math.floor(Date.now() / 1000) + 600 }],
      ])('rejects a wrong %s', async (_name, claims) => {
        await expect(exchange(claims)).rejects.toMatchObject({ code: 'invalid_id_token' });
        expect(service.hasSession()).toBe(false);
      });

      it('accepts an audience list containing the client, a matching azp, and a small clock skew', async () => {
        const now = Math.floor(Date.now() / 1000);
        await exchange({
          ...good,
          aud: ['backoffice-ui', 'account'],
          azp: 'backoffice-ui',
          exp: now - 30,
          iat: now + 30,
        });
        expect(service.hasSession()).toBe(true);
      });

      it('stores nothing when the sign-out happens while discovery is still being fetched', async () => {
        setup();
        const { state } = await begin();
        let release!: () => void;
        const gate = new Promise<void>((r) => (release = r));
        // a new service instance has no cached discovery
        fetchMock.mockImplementation(async (url: string) => {
          if (url.endsWith('/.well-known/openid-configuration')) {
            await gate;
            return json(DISCOVERY);
          }
          return json({ access_token: 'AT', id_token: idToken({ ...good }), expires_in: 300 });
        });
        const fresh = TestBed.runInInjectionContext(() => new TestOidcService());
        const pending = fresh.completeLogin(new URLSearchParams({ code: 'abc', state }));
        fresh.clear();
        release();
        await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
        expect(fresh.hasSession()).toBe(false);
        expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/token'))).toBe(false);
      });

      it('drops the result of a code exchange that finishes after a sign-out', async () => {
        setup();
        const { state, nonce } = await begin();
        let release!: () => void;
        const gate = new Promise<void>((r) => (release = r));
        fetchMock.mockImplementation(async (url: string) => {
          if (url.endsWith('/.well-known/openid-configuration')) return json(DISCOVERY);
          await gate;
          return json({
            access_token: 'AT',
            id_token: idToken({ ...good, nonce }),
            expires_in: 300,
          });
        });
        const pending = service.completeLogin(new URLSearchParams({ code: 'abc', state }));
        await vi.waitFor(() =>
          expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/token'))).toBe(true),
        );
        service.clear();
        release();
        await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
        expect(service.hasSession()).toBe(false);
      });
    });

    it('rejects a refused code exchange', async () => {
      setup();
      const { state } = await begin();
      tokenEndpoint(() => json({ error: 'invalid_grant' }, 400));
      await expect(
        service.completeLogin(new URLSearchParams({ code: 'abc', state })),
      ).rejects.toMatchObject({ code: 'invalid_grant' });
    });
  });

  describe('refresh', () => {
    function signedIn(expiresInMs: number, extra: Record<string, unknown> = {}) {
      storage.write('oidcTokens', {
        accessToken: 'old',
        refreshToken: 'RT',
        idToken: 'IDT',
        expiresAt: Date.now() + expiresInMs,
        ...extra,
      });
    }

    it('does nothing while the token has more than the skew left', async () => {
      setup();
      signedIn(REFRESH_SKEW_MS + 30_000);
      await service.ensureFresh();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refreshes inside the skew window, keeps the ID token, and shares one call', async () => {
      setup();
      signedIn(REFRESH_SKEW_MS - 1000);
      tokenEndpoint(() => json({ access_token: 'new', refresh_token: 'RT2', expires_in: 300 }));

      await Promise.all([service.ensureFresh(), service.ensureFresh()]);

      const calls = fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/token'));
      expect(calls).toHaveLength(1);
      expect(new URLSearchParams(calls[0][1].body as string).get('grant_type')).toBe(
        'refresh_token',
      );
      expect(service.getAccessToken()).toBe('new');
      expect(
        storage.read<{ refreshToken: string; idToken: string }>('oidcTokens', null as never),
      ).toMatchObject({ refreshToken: 'RT2', idToken: 'IDT' });
    });

    it('drops the result of a refresh that finishes after a sign-out', async () => {
      setup();
      signedIn(1000);
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      tokenEndpoint(async () => {
        await gate;
        return json({ access_token: 'late', refresh_token: 'RT2', expires_in: 300 });
      });
      const refreshing = service.ensureFresh();
      await vi.waitFor(() =>
        expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/token'))).toBe(true),
      );

      service.clear(); // the user signs out
      release();
      await refreshing;

      expect(service.hasSession()).toBe(false);
      expect(service.getAccessToken()).toBeNull();
    });

    it('stores nothing when the sign-out happens while discovery is still being fetched', async () => {
      setup();
      signedIn(1000);
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      // first (uncached) discovery fetch is pending; the token endpoint would answer with fresh tokens
      fetchMock.mockImplementation(async (url: string) => {
        if (url.endsWith('/.well-known/openid-configuration')) {
          await gate;
          return json(DISCOVERY);
        }
        return json({ access_token: 'late', refresh_token: 'RT2', expires_in: 300 });
      });
      const refreshing = service.ensureFresh();
      service.clear(); // the user signs out while discovery is pending
      release();
      await refreshing;

      expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/token'))).toBe(false);
      expect(service.hasSession()).toBe(false);
    });

    it('does not end the session a second time when a refresh fails after a sign-out', async () => {
      setup();
      signedIn(1000);
      const ended = vi.fn();
      service.sessionEnded.subscribe(ended);
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      tokenEndpoint(async () => {
        await gate;
        return json({ error: 'invalid_grant' }, 400);
      });
      const refreshing = service.ensureFresh();
      await vi.waitFor(() =>
        expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/token'))).toBe(true),
      );
      service.clear();
      release();
      await refreshing;
      expect(ended).not.toHaveBeenCalled();
    });

    it('ends the session when the provider refuses the refresh token', async () => {
      setup();
      signedIn(1000);
      const ended = vi.fn();
      service.sessionEnded.subscribe(ended);
      tokenEndpoint(() => json({ error: 'invalid_grant' }, 400));

      await expect(service.ensureFresh()).rejects.toMatchObject({ code: 'invalid_grant' });

      expect(ended).toHaveBeenCalledTimes(1);
      expect(service.hasSession()).toBe(false);
    });

    it('keeps the session when the provider cannot be reached', async () => {
      setup();
      signedIn(1000);
      const ended = vi.fn();
      service.sessionEnded.subscribe(ended);
      tokenEndpoint(() => {
        throw new TypeError('network down');
      });

      await expect(service.ensureFresh()).rejects.toThrow('network down');

      expect(ended).not.toHaveBeenCalled();
      expect(service.hasSession()).toBe(true);
    });

    it('ends the session when the refresh token itself has expired', async () => {
      setup();
      signedIn(1000, { refreshExpiresAt: Date.now() - 1 });
      const ended = vi.fn();
      service.sessionEnded.subscribe(ended);
      await service.ensureFresh();
      expect(ended).toHaveBeenCalledTimes(1);
      expect(service.hasSession()).toBe(false);
    });

    it('refreshes on its own before the token expires', async () => {
      vi.useFakeTimers();
      setup();
      tokenEndpoint(() => json({ access_token: 'new', refresh_token: 'RT', expires_in: 300 }));
      signedIn(REFRESH_SKEW_MS + 5000);
      // A reloaded tab: a new service finds the stored tokens and schedules the refresh.
      const reloaded = TestBed.runInInjectionContext(() => new TestOidcService());
      await vi.advanceTimersByTimeAsync(6000);
      expect(reloaded.getAccessToken()).toBe('new');
    });
  });

  describe('endSession', () => {
    it('drops the tokens and redirects to the end-session endpoint with the ID token hint', async () => {
      setup();
      storage.write('oidcTokens', {
        accessToken: 'AT',
        idToken: 'IDT',
        expiresAt: Date.now() + 1e6,
      });

      await service.endSession();

      expect(service.hasSession()).toBe(false);
      const url = new URL(service.navigations[0]);
      expect(url.origin + url.pathname).toBe(DISCOVERY.end_session_endpoint);
      expect(url.searchParams.get('id_token_hint')).toBe('IDT');
      expect(url.searchParams.get('client_id')).toBe('backoffice-ui');
      expect(url.searchParams.get('post_logout_redirect_uri')).toBe('https://ui.example/login');
    });

    it('sends the ID token the caller read before clearing, not the (now empty) storage', async () => {
      setup();
      await service.endSession('IDT-FROM-CALLER');
      const url = new URL(service.navigations[0]);
      expect(url.searchParams.get('id_token_hint')).toBe('IDT-FROM-CALLER');
      expect(url.searchParams.get('post_logout_redirect_uri')).toBe('https://ui.example/login');
    });

    it('still signs out locally when the provider cannot be reached', async () => {
      setup();
      storage.write('oidcTokens', { accessToken: 'AT', expiresAt: Date.now() + 1e6 });
      fetchMock.mockRejectedValue(new TypeError('network down'));

      await service.endSession();

      expect(service.hasSession()).toBe(false);
      expect(service.navigations).toEqual([]);
    });
  });
});
