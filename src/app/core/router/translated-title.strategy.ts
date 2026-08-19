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

import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18N } from '../adapters';

/** Separates the page name from the application name, as in `Groups · Fineract`. */
const SEPARATOR = ' · ';

/** Key holding the short application name used as the suffix. */
const APP_NAME_KEY = 'app.shortTitle';

/**
 * Sets the document title from each route's `title`, treated as a translation key.
 *
 * Angular's default strategy writes `route.title` to the document verbatim, which would
 * make the tab the only user-visible string in the app that cannot be translated. Routes
 * here therefore carry a key (`'nav.groups'`) rather than a phrase, and this strategy
 * resolves it through the I18N adapter.
 *
 * A route without a `title` inherits the nearest ancestor that has one, which is Angular's
 * own `buildTitle` behaviour: titling a section in `app.routes.ts` gives every page beneath
 * it a reasonable tab immediately, and a feature can then refine its own routes without
 * touching anything else.
 *
 * The title is re-applied when the language changes. Titles are otherwise written only on
 * navigation, so without this the tab would keep the previous language until the user
 * navigated again.
 */
@Injectable()
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18N);

  /** The key from the current route, retained so a language change can re-resolve it. */
  private currentKey?: string;

  constructor() {
    super();
    effect(() => {
      // Read the signal so this re-runs on every language change.
      this.i18n.currentLang();
      this.apply();
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.currentKey = this.buildTitle(snapshot);
    this.apply();
  }

  private apply(): void {
    const appName = this.i18n.translate(APP_NAME_KEY);
    this.title.setTitle(
      this.currentKey ? `${this.i18n.translate(this.currentKey)}${SEPARATOR}${appName}` : appName,
    );
  }
}
