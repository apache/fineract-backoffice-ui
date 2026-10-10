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

import { Injectable, isDevMode } from '@angular/core';
import {
  MissingTranslationHandler,
  MissingTranslationHandlerParams,
  TranslateService,
} from '@ngx-translate/core';

/**
 * Prefix every reported miss carries. `e2e/fixtures.ts` matches on it, so it is a contract
 * between this file and the suite rather than a formatting choice.
 */
export const MISSING_TRANSLATION_PREFIX = '[i18n-miss]';

/**
 * A dotted identifier — `nav.admin`, `SAVINGS.CONFIRM_UNDO`. What a key looks like, and what a
 * phrase does not: a deployment's `"Member Groups"` carries a space, `"Members"` carries no dot.
 *
 * The distinction is not cosmetic here. `DOCS/CUSTOMIZATION.md` documents
 * `"clients": { "labelKey": "Members" }` as the supported way a deployment renames a navigation
 * entry, and it works *because* ngx-translate returns an unresolved key verbatim. Every such
 * override arrives at this handler as a miss, and it is doing exactly what it was built to do.
 *
 * So a phrase reaching here is a deployment exercising a documented feature, and a dotted key
 * reaching here is a defect. Only the second is reported. Phrases in the application's own code
 * are a defect too, but a static one: `check:nav-ids` rejects a `labelKey` that is not a key and
 * `check-translations.mjs` rejects a `ColumnDef.label` that is not one, both before CI gets here.
 */
const KEY_CHARS = /^[A-Za-z][\w.]*$/;

/** Whether `key` is a dotted identifier rather than a phrase. See {@link KEY_CHARS}. */
function isKeyShaped(key: string): boolean {
  // Two linear tests rather than one nested quantifier. `/^[A-Za-z]\w*(?:\.\w+)+$/` says the
  // same thing and cannot actually backtrack — `\w` never matches `.` — but it trips
  // security/detect-unsafe-regex, and a suppression here would be a worse trade than a
  // `includes`.
  return key.includes('.') && KEY_CHARS.test(key);
}

/**
 * Reports a key that resolved to nothing, so the e2e suite can fail on it.
 *
 * ngx-translate renders a key it cannot resolve as the key itself, silently. That is the one
 * failure mode `scripts/check-translations.mjs` cannot see: the script proves a *literal* key
 * exists in `en.json`, which says nothing about a key assembled at runtime
 * (`SAVINGS.CONFIRM_${action}`), a key looked up through the wrong prefix, or a catalogue
 * section that failed to load. Each of those puts `SAVINGS.CONFIRM_UNDO` on the screen where a
 * sentence belongs, and no check in this repository currently notices.
 *
 * The handler's own return value preserves ngx-translate's documented behaviour — the key — so
 * enabling it changes nothing a user sees. Its only effect is the console line, which
 * `failOnMissingTranslations` in the e2e fixture turns into a failed test.
 *
 * Reporting is `isDevMode()`-only. The e2e suite runs against a dev build (see `fixtures.ts`),
 * so the gate keeps its signal, while a production deployment missing a key in its own
 * `branding/i18n/` overlay does not pay for a console write on every render.
 */
@Injectable({ providedIn: 'root' })
export class ReportingMissingTranslationHandler implements MissingTranslationHandler {
  /**
   * Keys already reported. A miss inside a template repeats on every change-detection pass, so
   * without this one broken binding writes thousands of identical lines and the useful ones
   * scroll away.
   */
  private readonly reported = new Set<string>();

  handle(params: MissingTranslationHandlerParams): string {
    if (
      isDevMode() &&
      isKeyShaped(params.key) &&
      this.isCatalogueLoaded(params.translateService) &&
      !this.reported.has(params.key)
    ) {
      this.reported.add(params.key);
      console.warn(`${MISSING_TRANSLATION_PREFIX} ${params.key}`);
    }
    // ngx-translate's own behaviour, restated rather than inherited: a handler returning
    // undefined gets the same result, but saying it here means a future edit cannot change
    // what the user sees by accident.
    return params.key;
  }

  /**
   * Whether the current language has a catalogue to have missed the key *in*.
   *
   * Every key misses during the window between the first render and the catalogue arriving —
   * the state `app.config.ts` describes at length, where the login button reads `login.submit`.
   * Reporting those would bury the real misses under one line per key in the application.
   *
   * The fallback catalogue is deliberately not consulted here: the service already tries the
   * fallback language before calling this handler, so a key present in `en` but absent from
   * `hi` never arrives. Only a key missing from *both* is reported, which is what makes this
   * safe to enable while the non-English catalogues are still partial.
   *
   * Asked of the service the miss came from, not of the store: the store no longer knows which
   * language is current (ngx-translate 18 keeps that per service, so an isolated subtree can
   * have its own), and the service that missed the key is the one whose answer matters.
   */
  private isCatalogueLoaded(translateService: TranslateService): boolean {
    const lang = translateService.getCurrentLang();
    // Typed as always returning an object, but `undefined` until the language has loaded.
    const catalogue = lang ? translateService.getTranslations(lang) : undefined;
    return !!catalogue && Object.keys(catalogue).length > 0;
  }
}
