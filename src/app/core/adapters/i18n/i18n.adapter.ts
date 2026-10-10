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

import { InjectionToken, Signal, inject } from '@angular/core';
import { NgxTranslateI18nAdapter } from './ngx-translate-i18n.adapter';
import { Observable } from 'rxjs';

/** Interpolation values substituted into a translated string. */
export type TranslateParams = Record<string, unknown>;

/**
 * The translation capability the application depends on, stated in its own terms.
 *
 * This exists because 235 files imported `@ngx-translate/core` directly. That is not a
 * criticism of ngx-translate — it is that a library reaching into a quarter of the codebase
 * cannot be evaluated, upgraded across a breaking major, or swapped for Angular's own
 * `$localize` without touching every one of those files. The surface below is what the
 * application actually uses, measured rather than guessed, so an alternative implementation
 * has a finite contract to satisfy.
 *
 * The reactive members are signals rather than observables because that is how the rest of
 * this codebase models state (see `ConfigService`), and because a signal is the thing a
 * template can read without a subscription to unwind.
 */
export interface I18nAdapter {
  /** The language in force, as a signal so templates re-render when it changes. */
  readonly currentLang: Signal<string>;

  /** Languages registered via {@link registerLangs}, in registration order. */
  readonly availableLangs: Signal<readonly string[]>;

  /**
   * Resolves a key against the active language, synchronously.
   *
   * Returns the key itself when no translation exists — never an empty string, because a
   * blank label in a banking UI is indistinguishable from a field with no value, whereas a
   * visible `LOANS.APPROVE` is self-diagnosing.
   */
  translate(key: string, params?: TranslateParams): string;

  /**
   * Resolves a key once the active language's catalogue has loaded.
   *
   * Needed at startup, where {@link translate} would run before the HTTP-loaded catalogue
   * has arrived and return the key.
   */
  translateAsync(key: string, params?: TranslateParams): Observable<string>;

  /** Switches the active language, completing once its catalogue is loaded. */
  use(lang: string): Observable<void>;

  /** Declares the languages this deployment offers. */
  registerLangs(langs: readonly string[]): void;

  /** Sets the language consulted when a key is missing from the active one. */
  setFallbackLang(lang: string): void;

  /**
   * The browser's preferred language, or `undefined` when it is not one of the registered
   * languages. Callers pick their own default rather than receiving a guess.
   */
  detectBrowserLang(): string | undefined;

  /** Installs a catalogue directly, bypassing the loader. Used by tests and by e2e fixtures. */
  setTranslation(lang: string, translations: Record<string, unknown>, merge?: boolean): void;
}

/**
 * Injection token for the active {@link I18nAdapter}.
 *
 * A token rather than an abstract class so the implementation carries no inheritance
 * relationship to the contract, and so tests can provide a plain object literal.
 *
 * Bound to the ngx-translate implementation by default, so a TestBed that already imports
 * `provideTranslateService()` needs nothing further — the same zero-configuration behaviour
 * specs had before this boundary existed. Overriding in `app.config.ts` or a TestBed wins.
 */
export const I18N = new InjectionToken<I18nAdapter>('I18nAdapter', {
  providedIn: 'root',
  factory: () => inject(NgxTranslateI18nAdapter),
});
