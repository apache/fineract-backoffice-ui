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

import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { skipErrorToast, skipLoading } from '../http/http-context';
import { STORAGE } from '../adapters';
import type { InstitutionFeature, InstitutionType } from './institution-config.service';

/**
 * Adjustments a deployment makes to the navigation tree without editing it.
 *
 * `navigation-config.service.ts` is a single 600-line file every feature adds to, so a
 * downstream that removes an entry there conflicts with every upstream release that touches
 * it. Naming the entry here instead keeps the deployment's decision out of the shared file.
 */
export interface NavOverrides {
  /**
   * `labelKey`s of navigation entries to hide, headers included. `labelKey` is the identifier
   * because it is the only field every entry carries — group headers have no `route`.
   *
   * Hiding is presentational only. The route stays reachable by URL, so this is a way to
   * narrow what a deployment offers, not a way to deny access to it.
   */
  hidden?: string[];
}

/**
 * Runtime configuration for the application.
 *
 * Everything here is deliberately readable from `config.json` rather than compiled in.
 * A deployment that had to change `environment.ts` would carry a patch against a file
 * upstream also edits — a merge conflict on every release, for a value that was never
 * code in the first place.
 */
export interface AppConfig {
  /** The base URL for the Fineract API */
  fineractApiUrl: string;
  /** The tenant to use when the user has not chosen one */
  defaultTenant: string;
  /**
   * Enables role-based access control in the UI. When `false`, the sidebar shows every
   * navigation item and the permission/institution directives render everything, which is
   * the pre-RBAC behaviour existing deployments were built against.
   */
  rbacEnabled: boolean;
  /** Institution type to assume when the user has not selected one. */
  institutionType: InstitutionType;
  /**
   * Exposes the screens that drive Fineract's `/v1/internal/**` endpoints — COB tools, the
   * progressive-loan schedule model, the internal external-event log, and the loan account
   * locks.
   *
   * Off by default, and it should stay off anywhere real. Those endpoints are served only when
   * the backend runs with its `test` Spring profile, which upstream states must not be enabled
   * in production; on a normal deployment every one of them answers 404. Enabling this on a test
   * instance is the supported way to reach them.
   */
  developerToolsEnabled?: boolean;
  /**
   * Absolute API origins this deployment permits, beyond its own.
   *
   * The endpoint override exists so an operator can point the app at their own Fineract. It is
   * not a general redirect: whatever it names receives the user's credentials on the next
   * request. Omit it, and only same-origin endpoints are accepted.
   */
  allowedApiOrigins?: string[];
  /**
   * Which group-lending features each institution type exposes. Omit to use the built-in
   * matrix; supply it to change what a type means for this deployment.
   */
  institutionFeatures?: Record<InstitutionType, InstitutionFeature[]>;
  /** Deployment-specific navigation adjustments. */
  nav?: NavOverrides;
}

/**
 * Values used until `config.json` is read, and for any key it omits.
 *
 * `fineractApiUrl` comes from the build because it is the one value needed before any
 * request can be made — including the request that fetches `config.json`.
 */
const DEFAULT_CONFIG: AppConfig = {
  fineractApiUrl: environment.fineractApiUrl,
  defaultTenant: 'default',
  rbacEnabled: true,
  institutionType: 'universal',
  developerToolsEnabled: false,
};

/**
 * Service responsible for loading and managing runtime configuration.
 *
 * This service allows the application to be configured without a rebuild
 * by fetching a `config.json` file at startup. The user's own API-endpoint
 * choice is persisted in local storage and applied on top.
 */
/**
 * Whether an endpoint may be used.
 *
 * A relative URL is same-origin by construction. An absolute one must match this document's
 * origin or an origin the deployment allow-listed. Anything else is refused: whatever this
 * names receives the user's credentials on the next request, so accepting an arbitrary string
 * turns a stored-XSS or a social-engineered link into credential theft.
 *
 * Takes the allow-list as an argument rather than reading the service's own signal, because it
 * is called while that signal is still being built — including from a field initialiser, where
 * reading it would throw.
 */
function isOriginAllowed(url: string, allowedOrigins: readonly string[]): boolean {
  const candidate = (url ?? '').trim();
  if (!candidate) return false;
  if (!/^https?:\/\//i.test(candidate)) return true;

  let target: URL;
  try {
    target = new URL(candidate);
  } catch {
    return false;
  }

  if (target.origin === window.location.origin) return true;

  return allowedOrigins.some((allowed) => {
    try {
      return new URL(allowed).origin === target.origin;
    } catch {
      return false;
    }
  });
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(STORAGE);

  private readonly _config = signal<AppConfig>({
    ...DEFAULT_CONFIG,
    ...this.getStoredOverride(DEFAULT_CONFIG.allowedApiOrigins ?? []),
  });

  /** Readonly access to the current application configuration signal */
  readonly config = this._config.asReadonly();

  /** Whether permission and institution gating applies. See {@link AppConfig.rbacEnabled}. */
  readonly rbacEnabled = computed(() => this._config().rbacEnabled);

  /**
   * Whether the `/v1/internal/**` screens are exposed. See {@link AppConfig.developerToolsEnabled}.
   *
   * Deliberately defaults to `false` when the key is absent, so an existing `config.json` that
   * predates this flag keeps the tools hidden rather than inheriting them.
   */
  readonly developerToolsEnabled = computed(() => this._config().developerToolsEnabled === true);

  /** Navigation entries this deployment hides, as a set of `labelKey`s. */
  readonly hiddenNavKeys = computed(() => new Set(this._config().nav?.hidden));

  /**
   * Loads configuration from the public `config.json` at runtime.
   *
   * The file is always read, even when the user has stored an API-endpoint override. The
   * override is a choice about one field; letting it freeze the whole object would mean a
   * deployment turning RBAC off never reached anyone who had ever changed their endpoint.
   */
  async loadConfig(): Promise<void> {
    try {
      const loaded = await firstValueFrom(
        this.http.get<Partial<AppConfig>>(`config.json?cb=${Date.now()}`, {
          // This runs before the app renders: there is no progress bar to drive yet, and no
          // route on which to show a toast. The catch below is the reporting.
          context: skipLoading(skipErrorToast()),
        }),
      );
      // Merged, not assigned: a config.json listing only the keys a deployment cares about
      // must not blank out the rest.
      // The allow-list comes from the config just loaded, not from the signal: this runs before
      // the merge lands, so reading it back would apply the previous deployment's rules.
      const allowedOrigins = loaded.allowedApiOrigins ?? DEFAULT_CONFIG.allowedApiOrigins ?? [];
      this._config.set({
        ...DEFAULT_CONFIG,
        ...loaded,
        ...this.getStoredOverride(allowedOrigins),
      });
    } catch (error) {
      console.error('❌ Could not load config.json, using environment defaults.', error);
    }
  }

  /**
   * Whether an endpoint may be used.
   *
   * A relative URL is same-origin by construction. An absolute one must match this document's
   * origin or an origin the deployment allow-listed in `config.json`. Anything else is refused:
   * the credentials the user is about to type would go wherever this points, so accepting an
   * arbitrary string here turns a stored-XSS or a social-engineered link into credential theft.
   */
  isAllowedApiUrl(url: string): boolean {
    return isOriginAllowed(url, this.config().allowedApiOrigins ?? []);
  }

  /**
   * Updates the runtime API URL and persists it to local storage.
   *
   * @param url - The new API base URL
   * @returns `true` when the endpoint was accepted; `false` when it is not allow-listed.
   */
  setApiUrl(url: string): boolean {
    if (!this.isAllowedApiUrl(url)) {
      console.error('Refused an API endpoint that is not allow-listed for this deployment:', url);
      return false;
    }
    this._config.update((config) => ({ ...config, fineractApiUrl: url }));
    this.storage.write('runtimeConfig', { fineractApiUrl: url });
    return true;
  }

  /**
   * Returns the current API base URL.
   */
  get apiUrl(): string {
    return this.config().fineractApiUrl;
  }

  /**
   * The user's stored API-endpoint choice, if any.
   *
   * Only `fineractApiUrl` is read. Earlier versions wrote the entire config object under
   * this key, so the stored value may carry other fields; they are deployment configuration
   * and belong to `config.json`, not to whatever was current when the user last switched
   * endpoints.
   */
  private getStoredOverride(allowedOrigins: readonly string[]): Partial<AppConfig> {
    // `read` already absorbs an unparseable value, so there is no catch here: a corrupted
    // override reads as no override, and the deployment's own `config.json` decides.
    const { fineractApiUrl } = this.storage.read<Partial<AppConfig>>('runtimeConfig', {});
    // Local storage is writable by anything running as the page, so a stored override is not
    // more trusted than a fresh one — it clears the same bar or it is ignored.
    if (!fineractApiUrl || !isOriginAllowed(fineractApiUrl, allowedOrigins)) return {};
    return { fineractApiUrl };
  }
}
