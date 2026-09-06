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

import { Injector, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateLoader, type TranslationObject } from '@ngx-translate/core';
import { Observable, forkJoin, map, of, catchError } from 'rxjs';
import { skipErrorToast, skipLoading } from '../../http/http-context';
import { ConfigService } from '../../services/config.service';

const SHIPPED_PREFIX = 'assets/i18n/';

/** Where a deployment puts its own strings. Gitignored upstream; absent on most deployments. */
const OVERLAY_PREFIX = 'branding/i18n/';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Recursively merges `patch` over `base`, so an overlay may restate one key in one section. */
function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const existing = out[key];
    out[key] = isPlainObject(value) && isPlainObject(existing) ? deepMerge(existing, value) : value;
  }
  return out;
}

/**
 * Loads the shipped catalogue and layers a deployment's own strings over it.
 *
 * "Call them Members, not Clients" arrives as a branding request and is answered as a translation
 * one. The catalogues in `assets/i18n/` belong to upstream, and a deployment editing them
 * conflicts on every release that touches a key; this reads a parallel file the deployment owns.
 *
 * The merge happens *in the loader*, deliberately, rather than by calling `setTranslation` after
 * the fact. ngx-translate publishes a language's catalogue as a whole when its loader completes,
 * so a merge applied from outside races that publication and is silently overwritten when it
 * loses — which it did. Returning one already-merged catalogue removes the race rather than
 * timing around it, and means no component has to re-render to pick the overlay up.
 *
 * The overlay is only *requested* when the deployment says it ships one — the container
 * entrypoint sets `brandingOverlayEnabled` by looking for the directory. Probing regardless put
 * a 404 in the console of every default install, and a 404 is a network-level event this side
 * can decline to report but cannot suppress. A missing overlay still resolves to `{}`, so a
 * deployment that sets the flag and then ships an incomplete `branding/i18n/` is unaffected.
 *
 * Lives inside the adapter boundary because it is a ngx-translate implementation detail: the
 * `TranslateLoader` contract is the library's, and ADR-0003 keeps that surface here rather than
 * letting it spread into `core/services`.
 */
export class DeploymentTranslateLoader extends TranslateLoader {
  private readonly http = inject(HttpClient);
  /**
   * `ConfigService` is resolved on use, not on construction, because injecting it as a field
   * closes a cycle: `ConfigService` needs `HttpClient`, whose `errorInterceptor` needs `I18N`,
   * which needs this loader — Angular reports the loop as NG0200 during bootstrap and the app
   * renders nothing at all. Reading it inside `getTranslation` breaks the loop, and costs
   * nothing: the first call happens after the initializer has already built the service.
   */
  private readonly injector = inject(Injector);

  override getTranslation(lang: string): Observable<TranslationObject> {
    const shipped = this.http.get<TranslationObject>(`${SHIPPED_PREFIX}${lang}.json`, {
      context: skipLoading(skipErrorToast()),
    });

    // `loadConfig()` runs in the app initializer, which resolves before the first `use(lang)`,
    // so the flag is settled by the time this is read.
    const overlay = this.injector.get(ConfigService).brandingOverlayEnabled()
      ? this.http
          .get<TranslationObject>(`${OVERLAY_PREFIX}${lang}.json`, {
            context: skipLoading(skipErrorToast()),
          })
          // A deployment that sets the flag may still not translate every language.
          .pipe(catchError(() => of({} as TranslationObject)))
      : of({} as TranslationObject);

    return forkJoin([shipped, overlay]).pipe(
      map(
        ([base, patch]) =>
          deepMerge(
            base as Record<string, unknown>,
            patch as Record<string, unknown>,
          ) as TranslationObject,
      ),
    );
  }
}
