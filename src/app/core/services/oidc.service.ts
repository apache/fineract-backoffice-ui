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

import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { STORAGE } from '../adapters';
import { ConfigService, OidcConfig } from './config.service';

/** The endpoints of the provider that this application uses, read from its discovery document. */
interface DiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
}

/** The tokens of the signed-in user, kept for the life of the tab. */
export interface OidcTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  /** Epoch milliseconds at which the access token stops being valid. */
  expiresAt: number;
  /** Epoch milliseconds at which the refresh token stops being valid, when the provider says. */
  refreshExpiresAt?: number;
}

/** A sign-in in progress: what must be remembered across the redirect to the provider. */
interface OidcFlow {
  state: string;
  nonce: string;
  verifier: string;
}

/** Refresh this long before the access token expires. */
export const REFRESH_SKEW_MS = 60_000;

/** Tolerated difference between the provider's clock and this browser's, for `exp` and `iat`, in seconds. */
const CLOCK_SKEW_S = 60;

const DEFAULT_SCOPES = 'openid profile';
const DEFAULT_REDIRECT_PATH = '/auth/callback';
const DEFAULT_POST_LOGOUT_PATH = '/login';

/** Why a sign-in could not be completed. The message is for the log, never for the user. */
export class OidcError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'OidcError';
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCodePoint(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function randomString(byteLength = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** The S256 code challenge for a verifier (RFC 7636 section 4.2). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

/** The claims of a JWT. Not verified: only ever applied to an ID token the token endpoint returned. */
function jwtClaims(jwt: string): Record<string, unknown> {
  try {
    const payload = jwt.split('.', 2)[1].replaceAll('-', '+').replaceAll('_', '/');
    const bytes = Uint8Array.from(
      atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')),
      (c) => c.codePointAt(0) ?? 0,
    );
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * OpenID Connect sign-in for a public client: authorization-code flow with PKCE (S256), token
 * refresh, and RP-initiated logout.
 *
 * Written in-house rather than taken from a library, and kept small (see `DOCS/OIDC.md`): it
 * needs no dependency and no iframe or session-check timers, and it talks to the provider with
 * `fetch` so that none of this application's HTTP interceptors (which add tenant headers that a
 * provider's CORS policy refuses) sees the traffic. It does not verify an ID token's signature:
 * the token is received straight from the token endpoint named by the provider's discovery
 * document, which OpenID Connect Core section 3.1.3.7 accepts. Fineract validates the access
 * token on every call.
 *
 * Tokens live in tab-scoped storage and are cleared by `clearScope('session')` on sign-out.
 */
@Injectable({ providedIn: 'root' })
export class OidcService {
  private readonly configService = inject(ConfigService);
  private readonly storage = inject(STORAGE);

  /** Emits when the provider refused a refresh: the session is over and the user must sign in again. */
  readonly sessionEnded = new Subject<void>();

  private discovery: Promise<DiscoveryDocument> | null = null;
  private discoveryFor: string | null = null;
  private refreshing: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped by every {@link clear}; a request that started in an earlier generation is dropped. */
  private generation = 0;

  constructor() {
    if (this.hasSession()) this.scheduleRefresh();
  }

  /** The configured provider, or `null` when OIDC sign-in is not configured. */
  get config(): OidcConfig | null {
    return this.configService.oidcConfig();
  }

  /** Whether this tab holds OIDC tokens. */
  hasSession(): boolean {
    return !!this.tokens()?.accessToken;
  }

  /** The current access token, or `null`. Use {@link ensureFresh} first when it must not be about to expire. */
  getAccessToken(): string | null {
    return this.tokens()?.accessToken ?? null;
  }

  /** Redirects the browser to the provider's sign-in page. */
  async startLogin(): Promise<void> {
    const cfg = this.requireConfig();
    const doc = await this.discover();
    const flow: OidcFlow = {
      state: randomString(),
      nonce: randomString(),
      verifier: randomString(48),
    };
    this.storage.write('oidcFlow', flow);
    const query = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: this.scopes(),
      state: flow.state,
      nonce: flow.nonce,
      code_challenge: await pkceChallenge(flow.verifier),
      code_challenge_method: 'S256',
    });
    this.navigate(`${doc.authorization_endpoint}?${query.toString()}`);
  }

  /**
   * Finishes a sign-in: checks `state`, exchanges the code (with the PKCE verifier) for tokens,
   * checks the ID token's `nonce`, issuer and audience, and stores the tokens.
   *
   * @param params - the query parameters of the redirect back to this application
   */
  async completeLogin(params: URLSearchParams): Promise<void> {
    const cfg = this.requireConfig();
    const flow = this.storage.read<OidcFlow | null>('oidcFlow', null);
    // One attempt per flow: a replayed redirect finds nothing to check against.
    this.storage.remove('oidcFlow');
    const providerError = params.get('error');
    if (providerError) throw new OidcError(`provider returned ${providerError}`, providerError);
    const code = params.get('code');
    if (!flow || !code || params.get('state') !== flow.state) {
      throw new OidcError('missing or mismatched state', 'invalid_state');
    }
    // Read before the first await: a sign-out during discovery must count.
    const generation = this.generation;
    const doc = await this.discover();
    if (generation !== this.generation)
      throw new OidcError('signed out during sign-in', 'cancelled');
    const body = await this.tokenRequest(doc, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri(),
      client_id: cfg.clientId,
      code_verifier: flow.verifier,
    });
    this.validateIdToken(body.id_token, flow.nonce, doc.issuer, cfg.clientId);
    // A sign-out while the code was being exchanged wins: do not open a session after it.
    if (generation !== this.generation)
      throw new OidcError('signed out during sign-in', 'cancelled');
    this.store(body, undefined);
  }

  /**
   * Checks the ID token of a code exchange (OpenID Connect Core 3.1.3.7). It is required: it is what
   * `endSession` later sends as `id_token_hint`, without which the provider asks for confirmation
   * instead of ending the session.
   *
   * The signature is deliberately not verified: the token arrives in the back-channel response of
   * the token endpoint named by the provider's discovery document, over TLS (rule 6 of 3.1.3.7),
   * and this application takes nothing from it but these claims. Fineract validates the access
   * token, signature included, on every call.
   */
  private validateIdToken(
    idToken: string | undefined,
    nonce: string,
    issuer: string,
    clientId: string,
  ): void {
    if (!idToken) throw new OidcError('the token response has no ID token', 'invalid_id_token');
    const claims = jwtClaims(idToken);
    const aud = ([] as unknown[]).concat(claims['aud']);
    const now = Date.now() / 1000;
    const exp = Number(claims['exp']);
    const iat = Number(claims['iat']);
    const failed = (
      [
        ['nonce', claims['nonce'] === nonce],
        ['issuer', claims['iss'] === issuer],
        ['audience', aud.includes(clientId)],
        ['authorized party', claims['azp'] === undefined || claims['azp'] === clientId],
        ['expiry', Number.isFinite(exp) && exp + CLOCK_SKEW_S >= now],
        ['issue time', !Number.isFinite(iat) || iat - CLOCK_SKEW_S <= now],
      ] as const
    ).find(([, ok]) => !ok);
    const problem = failed?.[0];
    if (problem) throw new OidcError(`ID token ${problem} check failed`, 'invalid_id_token');
  }

  /** The ID token of the signed-in user, or `null`. Read it before clearing the session: sign-out needs it. */
  getIdToken(): string | null {
    return this.tokens()?.idToken ?? null;
  }

  /**
   * Makes sure the access token is valid for at least {@link REFRESH_SKEW_MS}, refreshing it if
   * not. Concurrent callers share one refresh. A refusal by the provider ends the session; a
   * network failure leaves it as it is and rejects, so the request still goes out and Fineract
   * decides.
   */
  ensureFresh(): Promise<void> {
    const t = this.tokens();
    if (!t || t.expiresAt - Date.now() > REFRESH_SKEW_MS) return Promise.resolve();
    this.refreshing ??= this.refresh().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  /**
   * Signs out at the provider (OpenID Connect RP-Initiated Logout 1.0) and comes back to the
   * login page. The local tokens are dropped first, so the application is signed out even if the
   * provider cannot be reached.
   *
   * @param idTokenHint - the user's ID token, read by the caller before the session was cleared.
   *   Always sent as `id_token_hint` together with `post_logout_redirect_uri`: without the hint
   *   Keycloak shows a confirmation page, and a user who closes it leaves the SSO session alive.
   *   Defaults to the stored token, for a caller that has not cleared anything yet.
   */
  async endSession(idTokenHint?: string | null): Promise<void> {
    const cfg = this.config;
    const idToken = idTokenHint ?? this.getIdToken();
    this.clear();
    if (!cfg) return;
    try {
      const doc = await this.discover();
      if (!doc.end_session_endpoint) return;
      const query = new URLSearchParams({
        client_id: cfg.clientId,
        post_logout_redirect_uri: this.origin() + (cfg.postLogoutPath ?? DEFAULT_POST_LOGOUT_PATH),
      });
      if (idToken) query.set('id_token_hint', idToken);
      this.navigate(`${doc.end_session_endpoint}?${query.toString()}`);
    } catch {
      // The provider is unreachable: the local sign-out above already happened.
    }
  }

  /** Drops the tokens and any pending timer, without telling the provider. */
  clear(): void {
    // Anything in flight (a refresh, a code exchange) started before this and must not store its result.
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.storage.remove('oidcTokens');
    this.storage.remove('oidcFlow');
  }

  /** Seam for tests: the only place that leaves the application. */
  protected navigate(url: string): void {
    window.location.assign(url);
  }

  protected origin(): string {
    return window.location.origin;
  }

  private redirectUri(): string {
    return this.origin() + (this.requireConfig().redirectPath ?? DEFAULT_REDIRECT_PATH);
  }

  /** The requested scopes. `offline_access` is dropped: it would make the refresh token outlive sign-out. */
  private scopes(): string {
    const asked = (this.requireConfig().scopes ?? DEFAULT_SCOPES).split(/\s+/).filter(Boolean);
    return asked.filter((s) => s !== 'offline_access').join(' ');
  }

  private requireConfig(): OidcConfig {
    const cfg = this.config;
    if (!cfg) throw new OidcError('OIDC sign-in is not configured', 'not_configured');
    return cfg;
  }

  private tokens(): OidcTokens | null {
    return this.storage.read<OidcTokens | null>('oidcTokens', null);
  }

  private async refresh(): Promise<void> {
    // Read before the first await: a sign-out during discovery must count.
    const generation = this.generation;
    const t = this.tokens();
    const cfg = this.config;
    if (!t || !cfg) return;
    if (!t.refreshToken || (t.refreshExpiresAt && t.refreshExpiresAt <= Date.now())) {
      this.endLocally();
      return;
    }
    const doc = await this.discover();
    if (generation !== this.generation) return;
    try {
      const body = await this.tokenRequest(doc, {
        grant_type: 'refresh_token',
        refresh_token: t.refreshToken,
        client_id: cfg.clientId,
      });
      // Signed out while the refresh was in flight: drop the answer, or it would restore the session.
      if (generation !== this.generation) return;
      this.store(body, t);
    } catch (e) {
      if (generation !== this.generation) return;
      // invalid_grant and friends: the provider session is gone. A network error is not.
      if (e instanceof OidcError) this.endLocally();
      throw e;
    }
  }

  private endLocally(): void {
    this.clear();
    this.sessionEnded.next();
  }

  private store(body: TokenResponse, previous: OidcTokens | undefined): void {
    const now = Date.now();
    const tokens: OidcTokens = {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? previous?.refreshToken,
      idToken: body.id_token ?? previous?.idToken,
      expiresAt: now + (body.expires_in ?? 60) * 1000,
      refreshExpiresAt: body.refresh_expires_in
        ? now + body.refresh_expires_in * 1000
        : previous?.refreshExpiresAt,
    };
    this.storage.write('oidcTokens', tokens);
    this.scheduleRefresh();
  }

  private scheduleRefresh(delayOverride?: number): void {
    if (this.timer) clearTimeout(this.timer);
    const t = this.tokens();
    if (!t) return;
    const delay = delayOverride ?? Math.max(t.expiresAt - Date.now() - REFRESH_SKEW_MS, 1000);
    this.timer = setTimeout(() => {
      // A refresh that failed on the network is tried again shortly, while the token is still good.
      this.ensureFresh().catch(() => {
        if (this.hasSession()) this.scheduleRefresh(10_000);
      });
    }, delay);
  }

  private async tokenRequest(
    doc: DiscoveryDocument,
    form: Record<string, string>,
  ): Promise<TokenResponse> {
    const response = await fetch(doc.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(form).toString(),
      credentials: 'omit',
    });
    const json = (await response.json().catch(() => ({}))) as Partial<TokenResponse> & {
      error?: string;
    };
    if (!response.ok || !json.access_token) {
      throw new OidcError(
        `token endpoint answered ${response.status}`,
        json.error ?? 'token_error',
      );
    }
    return json as TokenResponse;
  }

  /** Reads the provider's discovery document once per issuer, and refuses endpoints on another origin. */
  private discover(): Promise<DiscoveryDocument> {
    const issuer = this.requireConfig().issuer.replace(/\/+$/, '');
    if (!this.discovery || this.discoveryFor !== issuer) {
      this.discoveryFor = issuer;
      this.discovery = this.loadDiscovery(issuer).catch((e: unknown) => {
        this.discovery = null;
        throw e;
      });
    }
    return this.discovery;
  }

  private async loadDiscovery(issuer: string): Promise<DiscoveryDocument> {
    const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
      credentials: 'omit',
    });
    if (!response.ok) throw new OidcError(`discovery answered ${response.status}`, 'discovery');
    const doc = (await response.json()) as DiscoveryDocument;
    const origin = new URL(issuer).origin;
    const sameOrigin = (u?: string): boolean => {
      try {
        return !u || new URL(u).origin === origin;
      } catch {
        return false;
      }
    };
    if (
      doc.issuer !== issuer ||
      !doc.authorization_endpoint ||
      !doc.token_endpoint ||
      ![doc.authorization_endpoint, doc.token_endpoint, doc.end_session_endpoint].every(sameOrigin)
    ) {
      throw new OidcError('discovery document does not match the configured issuer', 'discovery');
    }
    return doc;
  }
}
