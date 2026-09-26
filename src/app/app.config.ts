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

import {
  importProvidersFrom,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideCheckNoChangesConfig,
  provideZoneChangeDetection,
  provideAppInitializer,
  ApplicationConfig,
  ErrorHandler,
  inject,
} from '@angular/core';
import { TitleStrategy, provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MissingTranslationHandler, TranslateLoader, TranslateModule } from '@ngx-translate/core';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { correlationIdInterceptor } from './core/interceptors/correlation-id.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { retryInterceptor } from './core/interceptors/retry.interceptor';
import { GlobalErrorHandler } from './core/errors/global-error-handler';
import { ConfigService } from './core/services/config.service';
import { BrandingService } from './core/services/branding.service';
import { DeploymentTranslateLoader } from './core/adapters/i18n/deployment-translate.loader';
import { ReportingMissingTranslationHandler } from './core/adapters/i18n/missing-translation.handler';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { BASE_PATH } from './api/variables';
import { TranslatedTitleStrategy } from './core/router/translated-title.strategy';

/**
 * Loads configuration before the application bootstraps.
 *
 * Branding is applied in the same step, immediately after the config resolves and before the
 * first render, so the application never paints in the shipped colours and then repaints in the
 * deployment's.
 */
export async function initializeApp(): Promise<void> {
  // Both resolved before the first `await`. An injection context does not survive one, so
  // `inject()` after the config has loaded throws NG0203 — at startup, in production, where the
  // failure is a blank page.
  const config = inject(ConfigService);
  const branding = inject(BrandingService);

  await config.loadConfig();
  branding.apply();
}

export const appConfig: ApplicationConfig = {
  providers: [
    // `useSetInputAPI` makes Ionic deliver `componentProps` through `ComponentRef.setInput`
    // instead of `Object.assign`. Without it, assigning to a signal input would overwrite the
    // `InputSignal` itself with the raw value, and the dialog's template would then call a
    // plain object — so every modal component would be stuck on `@Input()` forever. It is safe
    // here because `DialogService.open` only ever passes `data`, and every dialog declares it.
    provideIonicAngular({ mode: 'md', useSetInputAPI: true }),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Surfaces the failure mode behind the empty API-fed dropdowns: a plain field assigned
    // from an HTTP callback changes the rendered value without ever marking the view dirty.
    // `checkNoChanges` compares a second pass against the first and reports the difference as
    // NG0100, so the bug becomes a console error instead of a blank control. `exhaustive` also
    // walks views that were *not* marked for check — the ordinary check skips those, which is
    // exactly where OnPush components will hide once they land.
    //
    // Dev only. `checkNoChanges` is compiled out of production builds, but `interval` would
    // still schedule a timer, so there is no reason to provide it there.
    ...(isDevMode() ? [provideCheckNoChangesConfig({ interval: 500, exhaustive: true })] : []),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideRouter(routes),
    // Routes carry a translation key in `title`; this resolves it. See the strategy's own docs.
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    // Order is the chain order, outermost first. `retryInterceptor` is last, and so closest
    // to the backend, deliberately: `loadingInterceptor` outside it counts one logical request
    // instead of flickering the progress bar per attempt, `errorInterceptor` toasts only once
    // the retries are spent, and every attempt reuses the same correlation ID.
    provideHttpClient(
      withInterceptors([
        correlationIdInterceptor,
        authInterceptor,
        errorInterceptor,
        loadingInterceptor,
        retryInterceptor,
      ]),
    ),
    // No `provideAnimationsAsync()`. It is deprecated as of Angular 20.2 in favour of the
    // `animate.enter` / `animate.leave` template APIs, and nothing here needed it: the app
    // declares no `@angular/animations` triggers, and Ionic drives its own transitions through
    // the Web Animations API rather than Angular's.
    provideAppInitializer(initializeApp),
    {
      provide: BASE_PATH,
      useFactory: (configService: ConfigService) => {
        const url = configService.apiUrl;
        console.log('Initializing API BASE_PATH:', url);
        return url.endsWith('/v1') ? url.slice(0, Math.max(0, url.length - 3)) : url;
      },
      deps: [ConfigService],
    },
    // No language options here, deliberately. `defaultLanguage` was deprecated in
    // ngx-translate 17 and, without `useDefaultLang: true`, did nothing but print a warning
    // on every startup — the language has always been set by `AppComponent`, which calls
    // `addLangs`, `setFallbackLang('en')` and `use(...)`.
    //
    // Passing `fallbackLang: 'en'` here instead is NOT equivalent, and must not be
    // reintroduced as a way of clearing that warning. It makes `TranslateService`'s
    // constructor load the `en` catalogue immediately, and that constructor runs from
    // `errorInterceptor`'s `inject(I18N)` — that is, while the interceptor chain is being
    // built for the application's first request. The catalogue fetch re-enters the
    // half-built chain and never resolves, so every key renders as its own name and the
    // login button reads `login.submit`. Caught by e2e/all-functions-read-shortcut.spec.ts.
    // The one option passed here. `missingTranslationHandler` does not touch language
    // selection or catalogue loading — it only observes a lookup that already failed — so it
    // is exempt from the argument above. See the handler for why an unresolved key needs to
    // be loud somewhere.
    importProvidersFrom(
      TranslateModule.forRoot({
        missingTranslationHandler: {
          provide: MissingTranslationHandler,
          useExisting: ReportingMissingTranslationHandler,
        },
      }),
    ),
    // Replaces provideTranslateHttpLoader so the shipped catalogue and a deployment's own
    // string overrides arrive as one already-merged object. See DeploymentTranslateLoader for
    // why the merge cannot be applied after the fact.
    { provide: TranslateLoader, useClass: DeploymentTranslateLoader },
    // The adapter tokens (`OVERLAY`, `I18N`) resolve to their default implementations
    // without a provider here — see `core/adapters/`. A deployment swapping the component
    // library or the i18n library overrides them at this point in the list.
    // See DOCS/adr/0003-adapter-boundary.md.
  ],
};
