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
import type { NavItemConfig } from './navigation-config.service';

/**
 * A patch applied to one upstream navigation entry, named by its `id`.
 *
 * Every field is optional; whatever is present replaces the upstream value and the rest is left
 * alone. Deliberately cannot change `id` — that is the handle the patch is addressed by — and
 * cannot grant permissions, because loosening a gate from a config file is not something a
 * presentation layer should be able to do.
 */
export interface NavItemOverride {
  /** Replacement label. A literal string is fine; a missing i18n key renders as the key. */
  labelKey?: string;
  /** Replacement ionicon name. Must be registered in `core/icons.ts` or it renders blank. */
  icon?: string;
  /** Sort key among siblings. See {@link NavItemConfig.order}. */
  order?: number;
  /**
   * `id` of the group to move this entry into, or `null` to lift it to the top level.
   * Naming a group that does not exist is reported as a config defect and ignored.
   */
  parent?: string | null;
}

/**
 * Adjustments a deployment makes to the navigation tree without editing it.
 *
 * `navigation-config.service.ts` is a single file every feature adds to, so a downstream that
 * edits the tree there conflicts with every upstream release that touches it. Naming entries
 * here instead keeps the deployment's decisions out of the shared file entirely.
 *
 * Everything below is keyed on {@link NavItemConfig.id} — never on `labelKey` or `route`, both
 * of which upstream changes freely. See the note on `id` for why that distinction matters.
 */
export interface NavOverrides {
  /**
   * `id`s of navigation entries to hide, group headers included. Hiding a group hides its
   * children with it.
   *
   * Hiding is presentational only. The route stays reachable by URL, so this narrows what a
   * deployment offers; it does not deny access to it. Authorization is enforced server-side by
   * Fineract — see `security.md` §5a.
   */
  hidden?: string[];

  /** Per-entry patches, keyed by `id`. See {@link NavItemOverride}. */
  overrides?: Record<string, NavItemOverride>;

  /**
   * Entries this deployment adds, which upstream has never heard of.
   *
   * Each needs an `id` that no upstream entry uses; a collision is reported and the entry
   * dropped, rather than silently shadowing something built in. Use a vendor prefix
   * (`acme.crm`). Items appear at the top level unless `parent` names an existing group.
   *
   * Added entries pass through exactly the same gates as built-in ones, so
   * `requiredPermissions` works here as it does upstream.
   */
  items?: DeploymentNavItem[];
}

/** A navigation entry contributed by a deployment rather than by upstream. */
export interface DeploymentNavItem extends NavItemConfig {
  /** Required — an entry with no id cannot be addressed, patched or de-duplicated. */
  id: string;
  /** `id` of the group to nest under. Omitted means top level. */
  parent?: string;
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
  /**
   * Whether this deployment ships a `branding/` overlay at all.
   *
   * The overlay is absent on every default install, so probing for it made a fresh deployment
   * report two 404s on every page load — one for `branding/config.json` and one for the
   * language catalogue. A 404 is a network-level event: the application can decline to *report*
   * it, and does, but it cannot stop the browser writing it to the console. The only way for a
   * supported configuration to stop looking like a misconfiguration is not to make the request.
   *
   * The container entrypoint sets this by looking for the directory, so a deployment following
   * `DOCS/CUSTOMIZATION.md` gets it without doing anything. A deployment serving `dist/` from
   * its own web server sets it in `config.json` alongside `fineractApiUrl`.
   *
   * Off by default, which is what an install with no overlay wants.
   */
  brandingOverlayEnabled?: boolean;
  /** Deployment-specific navigation adjustments. */
  nav?: NavOverrides;
  /** Deployment-specific appearance. See {@link BrandingConfig}. */
  branding?: BrandingConfig;
}

/**
 * How this deployment looks: its name, its marks, and its colours.
 *
 * Every asset path here is resolved relative to the application's own origin, and there is
 * deliberately no way to name an external one. The deployed Content-Security-Policy is
 * `img-src 'self' data:`, so an off-origin logo would be blocked at render time — and widening
 * that policy is a security decision, not a branding one. Mount assets into the image beside the
 * overlay that names them.
 */
export interface BrandingConfig {
  /** Product name in the header and the browser title. Plain text; a literal, not an i18n key. */
  appName?: string;
  /** Same-origin path to the header logo, e.g. `branding/logo.svg`. */
  logoUrl?: string;
  /** Same-origin path to a logo for dark mode. Falls back to {@link logoUrl}. */
  logoDarkUrl?: string;
  /** Same-origin path to the favicon. */
  faviconUrl?: string;
  /**
   * Design-token overrides, applied as CSS custom properties.
   *
   * Only the names in `BRANDABLE_TOKENS` are honoured; anything else is reported as a config
   * defect and ignored. That list is a published contract this project owes compatibility on,
   * so it is deliberately the small subset a deployment actually needs rather than every token
   * the stylesheet happens to declare.
   */
  tokens?: {
    /** Applied to `:root`. */
    light?: Record<string, string>;
    /** Applied under `[data-theme='dark']`. Omitted names inherit the light value. */
    dark?: Record<string, string>;
  };
}

/**
 * Values used until `config.json` is read, and for any key it omits.
 *
 * `fineractApiUrl` comes from the build because it is the one value needed before any
 * request can be made — including the request that fetches `config.json`.
 */
/** Upstream's shipped defaults, and what `deploy/entrypoint.sh` renders from the environment. */
const CONFIG_URL = 'config.json';

/**
 * The deployment's own layer, and the only file in this chain a downstream owns.
 *
 * A second file because `config.json` already has two writers: this repository tracks it, and
 * `deploy/entrypoint.sh` rewrites it whole at container start. Anything a deployment put there
 * was therefore a merge conflict on the next release or discarded on the next restart — which
 * is what happened to `nav`, `allowedApiOrigins` and `institutionFeatures`, none of which the
 * entrypoint's heredoc emits.
 *
 * Gitignored, never written by upstream, and expected to be absent.
 */
const DEPLOYMENT_OVERLAY_URL = 'branding/config.json';

/** Plain objects are merged key-by-key; everything else, arrays included, is replaced. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively merges `patch` over `base`.
 *
 * Arrays are replaced rather than concatenated. A deployment writing `nav.hidden` means "hide
 * exactly these", and a concatenating merge would make it impossible to *un*-hide anything an
 * upstream default had hidden — the layer below would always win by addition.
 */
function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch)) {
    return (patch === undefined ? base : patch) as T;
  }
  if (!isPlainObject(base)) {
    return patch as T;
  }
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    out[key] = isPlainObject(value) ? deepMerge(out[key], value) : value;
  }
  return out as T;
}

const DEFAULT_CONFIG: AppConfig = {
  fineractApiUrl: environment.fineractApiUrl,
  defaultTenant: 'default',
  rbacEnabled: true,
  institutionType: 'universal',
  developerToolsEnabled: false,
  brandingOverlayEnabled: false,
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

  /**
   * Whether this deployment ships a `branding/` overlay. See
   * {@link AppConfig.brandingOverlayEnabled}.
   *
   * Read by the translation loader as well as by {@link loadConfig}: both probe the same
   * directory, and both are silent on a default install because of this flag.
   */
  readonly brandingOverlayEnabled = computed(() => this._config().brandingOverlayEnabled === true);

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
    const base = await this.fetchLayer(CONFIG_URL, { required: true });
    // Only asked for when the deployment says it has one. Probing unconditionally meant a 404
    // in the console of every default install, which no amount of handling on this side can
    // suppress — see {@link AppConfig.brandingOverlayEnabled}. The flag has to come from the
    // layer below, since a file cannot announce its own absence.
    const overlay =
      (base.brandingOverlayEnabled ?? DEFAULT_CONFIG.brandingOverlayEnabled)
        ? await this.fetchLayer(DEPLOYMENT_OVERLAY_URL, { required: false })
        : {};

    // Merged, not assigned: a config.json listing only the keys a deployment cares about must not
    // blank out the rest, and an overlay naming one key must not discard the layer beneath it.
    const merged = deepMerge(deepMerge(DEFAULT_CONFIG, base), overlay) as AppConfig;

    // The allow-list comes from the config just merged, not from the signal: this runs before the
    // set lands, so reading it back would apply the previous deployment's rules.
    this._config.set({
      ...merged,
      ...this.getStoredOverride(merged.allowedApiOrigins ?? []),
    });
  }

  /**
   * Reads one configuration layer.
   *
   * @returns the parsed layer, or `{}` when it is absent or unreadable — a missing layer means
   * "this deployment said nothing here", which is exactly what an empty object merges as.
   */
  private async fetchLayer(
    url: string,
    { required }: { required: boolean },
  ): Promise<Partial<AppConfig>> {
    try {
      return (
        (await firstValueFrom(
          this.http.get<Partial<AppConfig>>(`${url}?cb=${Date.now()}`, {
            // This runs before the app renders: there is no progress bar to drive yet, and no
            // route on which to show a toast. The catch below is the reporting.
            context: skipLoading(skipErrorToast()),
          }),
        )) ?? {}
      );
    } catch (error) {
      if (required) {
        console.error(`❌ Could not load ${url}, using defaults.`, error);
      }
      return {};
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
