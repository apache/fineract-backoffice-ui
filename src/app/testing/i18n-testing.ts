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

import { EnvironmentProviders, Injector, Provider } from '@angular/core';
import { TranslateService, TranslationObject, provideTranslateService } from '@ngx-translate/core';

/**
 * Provides the translation library itself for specs that render shared components.
 *
 * A component written against the adapter boundary needs only {@link provideFakeAdapters},
 * which binds `I18N` to a fake. That is not enough as soon as the component under test
 * declares a shared one that still uses `| translate` directly — `app-data-table` is the
 * common case — because the pipe injects `TranslateService` from the library rather than the
 * token, and TestBed fails with NG0201 for a dependency the spec never mentions.
 *
 * Configuring the library is composition-root work, the same reason `app.config.ts` is
 * allowed to do it, so it lives here rather than being repeated in every spec. Reach for it
 * only when a spec fails on `_TranslateService`: needing it is a signal that something in the
 * rendered tree has not moved to the adapter yet, and that signal is worth keeping visible.
 *
 * See DOCS/adr/0003-adapter-boundary.md.
 */
export function provideTranslateTesting(): (Provider | EnvironmentProviders)[] {
  return provideTranslateService();
}

/** Loads translations without exposing the vendor service in individual specs. */
export function setTranslateTestingTranslations(
  injector: Injector,
  language: string,
  translations: TranslationObject,
): void {
  const translateService = injector.get(TranslateService);
  translateService.setTranslation(language, translations);
  translateService.use(language);
}
