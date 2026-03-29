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
  private readonly sessionKey = 'fineract_session';
  private readonly tenantKey = 'fineract_tenant';

  /** Signal containing the current user session or null if not authenticated */
  readonly currentUser = signal<UserSession | null>(this.getStoredSession());

  /** Signal indicating whether a user is currently authenticated */
  readonly isAuthenticated = signal<boolean>(!!this.currentUser());

  /** Signal containing the currently active Tenant ID */
  readonly currentTenantId = signal<string>(this.getStoredTenantId());

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
        { headers },
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
    sessionStorage.removeItem(this.sessionKey);
    localStorage.removeItem(this.tenantKey);
    this.currentUser.set(null);
    this.currentTenantId.set(this.getDefaultTenantId());
    this.isAuthenticated.set(false);
  }

  /**
   * Updates the current active tenant and persists it to local storage.
   * @param tenantId - The new tenant ID
   */
  setTenantId(tenantId: string): void {
    localStorage.setItem(this.tenantKey, tenantId);
    this.currentTenantId.set(tenantId);
  }

  /**
   * Persists the user session to session storage and updates the reactive signals.
   * @param session - The user session to store
   */
  private setSession(session: UserSession): void {
    sessionStorage.setItem(this.sessionKey, JSON.stringify(session));
    this.currentUser.set(session);
    this.isAuthenticated.set(true);
  }

  /**
   * Retrieves the stored session from session storage if available.
   * @returns The stored UserSession or null
   */
  private getStoredSession(): UserSession | null {
    const stored = sessionStorage.getItem(this.sessionKey);
    return stored ? (JSON.parse(stored) as UserSession) : null;
  }

  /**
   * Retrieves the stored tenant from local storage or falls back to the configured default.
   * @returns The active tenant identifier
   */
  private getStoredTenantId(): string {
    return localStorage.getItem(this.tenantKey) || this.getDefaultTenantId();
  }

  /**
   * Resolves the default tenant from runtime configuration.
   * @returns The configured default tenant identifier
   */
  private getDefaultTenantId(): string {
    return this.configService.config().defaultTenant || 'default';
  }

  /**
   * Gets the authentication token for use in HTTP Interceptors.
   * @returns The base64 authentication key or null
   */
  getAuthToken(): string | null {
    return this.currentUser()?.base64EncodedAuthenticationKey || null;
  }
}
