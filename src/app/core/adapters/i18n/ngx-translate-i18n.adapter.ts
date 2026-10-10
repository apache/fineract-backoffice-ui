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

import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { Observable, map } from 'rxjs';
// Type-only, and deliberately so: `i18n.adapter.ts` names this class as the token's default
// binding, and a value import back would close a runtime cycle. `import type` is erased, so
// the cycle exists only in the type graph, where it is harmless.
import type { I18nAdapter, TranslateParams } from './i18n.adapter';

/**
 * {@link I18nAdapter} backed by `@ngx-translate/core` v18.
 *
 * This is the only file in the application permitted to import `@ngx-translate/core`
 * (`eslint.config.js` enforces it). Everything ngx-translate-shaped is confined here: its
 * `Translation` union return type is narrowed to `string`, its event observables are turned
 * into signals, and its "returns the key on miss" behaviour is made explicit rather than
 * incidental.
 */
@Injectable({ providedIn: 'root' })
export class NgxTranslateI18nAdapter implements I18nAdapter {
  // Named for the library, not for the capability, so that `translate()` below can be the
  // contract's method without colliding with the dependency it delegates to.
  private readonly ngxTranslate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _currentLang = signal(this.ngxTranslate.getCurrentLang() ?? '');
  private readonly _availableLangs = signal<readonly string[]>(this.ngxTranslate.getLangs());

  readonly currentLang = this._currentLang.asReadonly();
  readonly availableLangs = this._availableLangs.asReadonly();

  constructor() {
    // ngx-translate mutates its own state on `use()` and on catalogue load; mirroring it
    // through this subscription means the signal stays correct even when something outside
    // this adapter changes the language during bootstrap, before any adapter method has run.
    this.ngxTranslate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this._currentLang.set(event.lang));
  }

  translate(key: string, params?: TranslateParams): string {
    return this.ngxTranslate.instant(key, params) as string;
  }

  translateAsync(key: string, params?: TranslateParams): Observable<string> {
    return this.ngxTranslate.get(key, params).pipe(map((value) => value as string));
  }

  use(lang: string): Observable<void> {
    return this.ngxTranslate.use(lang).pipe(map(() => undefined));
  }

  registerLangs(langs: readonly string[]): void {
    this.ngxTranslate.addLangs([...langs]);
    this._availableLangs.set(this.ngxTranslate.getLangs());
  }

  setFallbackLang(lang: string): void {
    // The returned observable loads the fallback catalogue. It is subscribed rather than
    // returned because the contract makes fallback a fire-and-forget configuration step —
    // no caller has anything useful to do while it loads.
    this.ngxTranslate.setFallbackLang(lang).subscribe();
  }

  detectBrowserLang(): string | undefined {
    const detected = this.ngxTranslate.getBrowserLang();
    // ngx-translate happily reports a language nothing has been registered for. Reporting
    // `de` to a deployment that ships `en`/`hi`/`ko` would have the caller switch to a
    // catalogue that 404s, so an unregistered language is reported as no answer at all.
    return detected && this._availableLangs().includes(detected) ? detected : undefined;
  }

  setTranslation(lang: string, translations: Record<string, unknown>, merge = false): void {
    // ngx-translate's `TranslationObject` is a recursive union of strings and nested objects.
    // The contract takes a plain record instead, because callers are handing over parsed JSON
    // and should not have to import a library type to describe it. Reconciling the two is
    // precisely the work this adapter exists to do; a malformed catalogue surfaces as a
    // missing key at the call site, which is how a missing key surfaces anyway.
    this.ngxTranslate.setTranslation(lang, translations as never, merge);
  }
}
