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

import { Injectable, signal, inject, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { ConfigService } from './config.service';
import { STORAGE } from '../adapters';
import { skipErrorToast } from '../http/http-context';

/**
 * Interface representing a user role within Fineract.
 */
export interface UserRole {
  id: number;
  name: string;
  description: string;
}

/**
 * Interface representing the session details of an authenticated user.
 */
export interface UserSession {
  /** The username of the logged-in user */
  username: string;
  /** The base64 encoded authentication key used for Basic Auth */
  base64EncodedAuthenticationKey: string;
  /** Whether the user is authenticated */
  authenticated: boolean;
  /** The ID of the office the user belongs to */
  officeId: number;
  /** The name of the office the user belongs to */
  officeName: string;
  /** The unique user ID */
  userId: number;
  /** List of granular permissions assigned to the user */
  permissions: string[];
  /** Optional list of roles assigned to the user */
  roles?: UserRole[];
  /**
   * Whether Fineract wants a second factor before it will serve anything.
   *
   * Present only when the platform runs with `fineract.security.2fa.enabled`. When it is true,
   * `authenticated` is *also* true — the password was accepted — but every subsequent request is
   * refused until a one-time token has been validated. Treating `authenticated` as the end of the
   * flow is what leaves a user on a dashboard where nothing loads.
   */
  isTwoFactorAuthenticationRequired?: boolean;
  /**
   * The validated second-factor token, added by this application rather than returned by
   * `/authentication`. Travels on every later request as `Fineract-Platform-TFA-Token`.
   */
  tfaToken?: string;
}

/**
 * Service responsible for managing user authentication and session state.
 *
 * Handles login, logout, and provides reactive access to the current user
 * and authentication status via Angular Signals.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);
  private readonly storage = inject(STORAGE);

  /** Signal containing the current user session or null if not authenticated */
  readonly currentUser = signal<UserSession | null>(this.getStoredSession());

  /**
   * Whether the user may be let into the application.
   *
   * Deliberately not "did the password work". With two-factor authentication enabled the password
   * working is only the first half: until the one-time token is validated Fineract refuses every
   * request, so admitting the user here would drop them on a dashboard of 403s.
   */
  readonly isAuthenticated = signal<boolean>(this.isSessionComplete(this.currentUser()));

  /**
   * Whether a second factor is outstanding for the session in progress.
   *
   * The password has been accepted and the `/v1/twofactor` endpoints will answer, but nothing
   * else will. The login screen shows its second step while this holds.
   */
  readonly twoFactorPending = signal<boolean>(
    !!this.currentUser() && !this.isSessionComplete(this.currentUser()),
  );

  /**
   * Signal containing the currently active Tenant ID.
   *
   * Falls back to the deployment's configured tenant rather than the literal `'default'`.
   * `AppConfig.defaultTenant` existed but nothing read it, so an institution whose Fineract
   * tenant is not named `default` had every user type it into the login form.
   */
  readonly currentTenantId = signal<string>(
    this.storage.readRaw('tenant') || this.configService.config().defaultTenant,
  );

  /** Computed signal for the current username */
  readonly username = computed(() => this.currentUser()?.username || '');

  /** Computed signal for the current user's office name */
  readonly officeName = computed(() => this.currentUser()?.officeName || '');

  /**
   * Attempts to authenticate a user with Fineract using Basic Auth.
   *
   * @param username - The user's login name
   * @param password - The user's password
   * @param tenantId - The Fineract tenant identifier
   * @returns An Observable of the resulting UserSession
   */
  login(username: string, password: string, tenantId: string): Observable<UserSession> {
    const headers = new HttpHeaders({
      'Fineract-Platform-TenantId': tenantId,
      'X-Mifos-Platform-TenantId': tenantId,
    });

    return this.http
      .post<UserSession>(
        `${this.configService.apiUrl}/authentication`,
        { username, password },
        // The login form renders the rejection inline, next to the fields that caused it.
        // A toast as well would report the same failure twice.
        { headers, context: skipErrorToast() },
      )
      .pipe(
        tap((session) => {
          this.setTenantId(tenantId);
          this.setSession(session);
        }),
      );
  }

  /**
   * Logs out the current user and clears the session state.
   */
  logout(): void {
    // Every tab-scoped key, not just the session object. The endpoint override in
    // `fineract_runtime_config` is deliberately left alone: it is device-scoped operator
    // intent (see `ConfigService`), and clearing it would silently move the next sign-in
    // back to the default server.
    // Ends the second factor at the platform rather than only forgetting it here; the token
    // otherwise stays valid for its full life (24 hours by default) after the user signs out.
    // Fire-and-forget: a failure here must not keep someone signed in.
    const tfaToken = this.currentUser()?.tfaToken;
    if (tfaToken) {
      this.http
        .post(
          `${this.configService.apiUrl}/twofactor/invalidate`,
          { token: tfaToken },
          { context: skipErrorToast() },
        )
        .subscribe({ error: () => undefined });
    }

    this.storage.clearScope('session');
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.twoFactorPending.set(false);
  }

  /**
   * Updates the current active tenant and persists it to local storage.
   * @param tenantId - The new tenant ID
   */
  setTenantId(tenantId: string): void {
    this.storage.writeRaw('tenant', tenantId);
    this.currentTenantId.set(tenantId);
  }

  /**
   * Persists the user session to session storage and updates the reactive signals.
   * @param session - The user session to store
   */
  private setSession(session: UserSession): void {
    const normalized: UserSession = {
      ...session,
      // `?? []` for the same reason `getStoredSession` has it: a response without the field is
      // a user with no permissions, not a crash. Without it a truncated or malformed session
      // throws inside `login()` and the user cannot sign in at all.
      permissions: this.normalizePermissions(session.permissions ?? []),
    };
    this.storage.write('session', normalized);
    this.currentUser.set(normalized);

    const complete = this.isSessionComplete(normalized);
    this.isAuthenticated.set(complete);
    this.twoFactorPending.set(!complete);
  }

  /**
   * Whether this session can actually be used, as opposed to merely having a correct password.
   *
   * A session needs a second factor when Fineract asked for one and none has been validated yet.
   * Everything else — including every deployment with two-factor authentication switched off,
   * where the flag is absent entirely — is complete on arrival.
   */
  private isSessionComplete(session: UserSession | null): boolean {
    if (!session) return false;
    return !session.isTwoFactorAuthenticationRequired || !!session.tfaToken;
  }

  /**
   * Records the validated second-factor token and lets the user in.
   *
   * @param tfaToken - the token `POST /v1/twofactor/validate` returned
   */
  completeTwoFactorAuthentication(tfaToken: string): void {
    const session = this.currentUser();
    if (!session) return;
    const completed: UserSession = { ...session, tfaToken };
    this.storage.write('session', completed);
    this.currentUser.set(completed);
    this.isAuthenticated.set(true);
    this.twoFactorPending.set(false);
  }

  /**
   * The second-factor token for the interceptor to attach, or null when there is none.
   *
   * Null covers both a deployment without two-factor authentication and the window during login
   * where the password has been accepted but the token has not yet been validated — in which the
   * `/v1/twofactor` endpoints are reachable on the Basic credential alone.
   */
  getTfaToken(): string | null {
    return this.currentUser()?.tfaToken ?? null;
  }

  /**
   * Retrieves the stored session from session storage if available.
   * @returns The stored UserSession or null
   */
  private getStoredSession(): UserSession | null {
    const session = this.storage.read<UserSession | null>('session', null);
    if (!session) {
      return null;
    }
    return { ...session, permissions: this.normalizePermissions(session.permissions ?? []) };
  }

  /**
   * Trims whitespace from each permission code and removes duplicates that
   * only differ by leading/trailing whitespace. Fineract's permission seed
   * data has known trailing-space entries (e.g. "CREATE_X" and "CREATE_X ")
   * which would otherwise break exact-match permission checks.
   * @param permissions - Raw permission codes as returned by the backend
   */
  private normalizePermissions(permissions: string[]): string[] {
    return Array.from(new Set(permissions.map((p) => p.trim())));
  }

  /**
   * Gets the authentication token for use in HTTP Interceptors.
   * @returns The base64 authentication key or null
   */
  getAuthToken(): string | null {
    return this.currentUser()?.base64EncodedAuthenticationKey || null;
  }

  /**
   * Checks if the authenticated user has a specific permission or any/all of a list of permissions.
   *
   * @param permission - A single permission string or an array of permissions
   * @param matchAll - If true, the user must have all permissions in the array. Default is false.
   * @returns boolean indicating if the user has the required permission(s)
   */
  hasPermission(permission: string | string[], matchAll = false): boolean {
    const user = this.currentUser();
    if (!user || !user.permissions) {
      return false;
    }

    // Special superuser permission "ALL_FUNCTIONS" bypasses every check.
    if (user.permissions.includes('ALL_FUNCTIONS')) {
      return true;
    }

    const required = Array.isArray(permission) ? permission : [permission];

    // Read-only superuser shortcut: grants any request made up entirely of
    // READ_* permissions, but never write/approve actions. A mixed request
    // (e.g. a READ_* permission combined with a non-READ_* one) falls through
    // to the normal permission-list check below.
    if (
      user.permissions.includes('ALL_FUNCTIONS_READ') &&
      required.every((p) => p.startsWith('READ_'))
    ) {
      return true;
    }

    if (matchAll) {
      return required.every((p) => user.permissions.includes(p));
    }
    return required.some((p) => user.permissions.includes(p));
  }
}
