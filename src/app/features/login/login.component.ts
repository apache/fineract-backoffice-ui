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

import { Component, computed, inject, signal, DestroyRef } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { ConfigService } from '../../core/services/config.service';
import { BrandingService } from '../../core/services/branding.service';
import { ThemeService } from '../../core/services/theme.service';
import { SESSION_EXPIRED_REASON } from '../../core/interceptors/error.interceptor';
import { TwoFactorStepComponent } from './two-factor/two-factor-step.component';
import { HelpIconComponent } from '../../shared/components/help-icon/help-icon.component';

/**
 * Component providing the user login interface.
 *
 * Handles authentication credentials, tenant selection, and API endpoint configuration.
 * Adheres to accessibility standards and supports multiple languages.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, HelpIconComponent, TwoFactorStepComponent],
  template: `
    <div class="login-page">
      <div class="login-card" role="main">
        <div class="lang-selector">
          <select
            #langSelect
            (change)="switchLanguage(langSelect.value)"
            [attr.aria-label]="'app.language.select' | translate"
          >
            <option value="en" [selected]="translate.getCurrentLang() === 'en'">
              {{ 'app.language.en' | translate }}
            </option>
            <option value="hi" [selected]="translate.getCurrentLang() === 'hi'">
              {{ 'app.language.hi' | translate }}
            </option>
            <option value="ko" [selected]="translate.getCurrentLang() === 'ko'">
              {{ 'app.language.ko' | translate }}
            </option>
          </select>
        </div>
        <div class="login-header">
          <img
            [src]="logoSrc()"
            [alt]="(brandName() || ('app.title' | translate)) + ' logo'"
            class="login-logo"
          />
          <h1>{{ brandName() || ('app.title' | translate) }}</h1>
          <p class="subtitle">{{ 'login.welcome' | translate }}</p>
        </div>

        @if (sessionExpired()) {
          <div class="notice" role="status">
            {{ 'login.sessionExpired' | translate }}
          </div>
        }

        @if (authService.twoFactorPending()) {
          <app-two-factor-step
            (completed)="onTwoFactorCompleted()"
            (cancelled)="onTwoFactorCancelled()"
          />
        } @else {
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
            <div class="form-field">
              <label for="serverUrl">
                {{ 'login.serverUrl' | translate }}
                <app-help-icon helpTextKey="login.tooltips.serverUrl"></app-help-icon>
              </label>
              <select id="serverUrl" formControlName="serverUrl">
                <option [value]="configService.apiUrl">
                  {{ 'login.defaultOption' | translate }} ({{ configService.apiUrl }})
                </option>
                <!-- Endpoints this deployment permits, from config.json. Third-party hosts used
                   to be hard-coded here, which offered a teller a one-click path to type real
                   credentials into someone else's server. What is offered is now the operator's
                   decision, and anything typed is checked against the same allow-list. -->
                <option value="/fineract-provider/api/v1">
                  {{ 'login.proxyOption' | translate }}
                </option>
                @for (origin of allowedOrigins(); track origin) {
                  <option [value]="origin">{{ origin }}</option>
                }
                <option value="custom">{{ 'login.customOption' | translate }}</option>
              </select>
            </div>

            @if (loginForm.get('serverUrl')?.value === 'custom') {
              <div class="form-field">
                <label for="customUrl">{{ 'login.customUrl' | translate }}</label>
                <input
                  id="customUrl"
                  type="text"
                  formControlName="customUrl"
                  placeholder="https://..."
                />
              </div>
            }

            <div class="form-field">
              <label for="tenantId">
                {{ 'login.tenantId' | translate }}
                <app-help-icon helpTextKey="login.tooltips.tenantId"></app-help-icon>
              </label>
              <input
                id="tenantId"
                type="text"
                formControlName="tenantId"
                [attr.aria-invalid]="loginForm.get('tenantId')?.invalid"
              />
            </div>

            <div class="form-field">
              <label for="username">{{ 'login.username' | translate }}</label>
              <input
                id="username"
                type="text"
                formControlName="username"
                autocomplete="username"
                [attr.aria-invalid]="loginForm.get('username')?.invalid"
              />
            </div>

            <div class="form-field">
              <label for="password">{{ 'login.password' | translate }}</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                autocomplete="current-password"
                [attr.aria-invalid]="loginForm.get('password')?.invalid"
              />
            </div>

            @if (error()) {
              <div class="error-message" role="alert">
                {{ error() }}
              </div>
            }

            <button type="submit" class="submit-btn" [disabled]="loginForm.invalid || isLoading()">
              @if (isLoading()) {
                <span class="spinner"></span>
                {{ 'login.loggingIn' | translate }}
              } @else {
                {{ 'login.submit' | translate }}
              }
            </button>
          </form>
        }

        <div class="login-footer">
          <p>&copy; 2026 Apache Fineract</p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .login-page {
        display: flex;
        justify-content: center;
        align-items: safe center;
        /* dvh: on a phone, 100vh is measured against the retracted URL bar, so the card
           ends up centred against a viewport taller than the screen. */
        box-sizing: border-box;
        height: 100svh;
        min-height: 100svh;
        height: 100dvh;
        min-height: 100dvh;
        overflow-y: auto;
        background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
        padding: 1rem;
      }
      .login-card {
        position: relative;
        background: var(--card-bg);
        color: var(--text-color);
        padding: var(--space-6);
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-md);
        width: 100%;
        max-width: 440px;
      }
      .lang-selector {
        display: flex;
        justify-content: flex-end;
        margin-bottom: var(--space-4);
      }
      .lang-selector select {
        padding: var(--space-1) var(--space-2);
        font-size: 0.8rem;
      }
      .login-header {
        text-align: center;
        margin-bottom: 1.5rem;
      }
      .login-logo {
        height: 48px;
        margin-bottom: 0.5rem;
      }
      h1 {
        font-size: 1.25rem;
        color: var(--text-color);
        margin: 0;
      }
      .subtitle {
        color: var(--text-muted);
        font-size: 0.85rem;
        margin-top: 0.25rem;
      }
      .login-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .form-field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      label {
        display: flex;
        align-items: center;
        font-weight: 500;
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      input,
      select {
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        background: var(--card-bg);
        color: var(--text-color);
        font-family: inherit;
        font-size: 0.9rem;
        transition:
          border-color 0.2s,
          box-shadow 0.2s;
      }
      input:focus,
      select:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: var(--focus-ring);
      }
      /* Text stays at --text-color rather than --warning-color: the amber reads as low
         contrast at this size, and the tint plus the rule already carry the severity. */
      .notice {
        background-color: color-mix(in srgb, var(--warning-color) 12%, transparent);
        color: var(--text-color);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--border-radius);
        font-size: 0.8rem;
        border-left: 4px solid var(--warning-color);
        margin-bottom: var(--space-4);
      }
      .error-message {
        background-color: color-mix(in srgb, var(--error-color) 12%, transparent);
        color: var(--error-color);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--border-radius);
        font-size: 0.8rem;
        border-left: 4px solid var(--error-color);
      }
      .submit-btn {
        margin-top: var(--space-2);
        padding: var(--space-3);
        background-color: var(--primary-color);
        color: #fff;
        border: none;
        border-radius: var(--border-radius);
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.5rem;
      }
      .submit-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
      .login-footer {
        margin-top: 1.5rem;
        text-align: center;
        color: var(--text-muted);
        font-size: 0.7rem;
      }
      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 1s ease-in-out infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly authService = inject(AuthService);
  protected readonly configService = inject(ConfigService);
  private readonly branding = inject(BrandingService);
  private readonly themeService = inject(ThemeService);

  /**
   * The deployment's product name, or `null` when it sets none.
   *
   * The sign-in screen is the first thing anyone sees, so leaving it on the Fineract wordmark
   * while the rest of the application carries the institution's makes the branding look broken
   * rather than absent.
   *
   * Null rather than a resolved fallback, so the template can fall back through the `translate`
   * pipe. `translate.instant` inside a computed would not do: it is not reactive, and this screen
   * can render before the catalogue has loaded — which would pin the heading to the raw key.
   */
  protected readonly brandName = computed(() => this.branding.appName());
  protected readonly logoSrc = computed(() => {
    const configured = this.themeService.isDarkMode()
      ? this.branding.logoDarkUrl()
      : this.branding.logoUrl();
    return this.branding.resolveLogo(configured) ?? 'favicon.png';
  });

  /** Absolute endpoints this deployment permits, offered alongside the default and the proxy. */
  protected readonly allowedOrigins = computed(
    () => this.configService.config().allowedApiOrigins ?? [],
  );
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly translate = inject(TranslateService);

  /** Signal indicating if a login request is in progress */
  protected readonly isLoading = signal(false);
  /** Whether entering the application needs a full reload, because the API endpoint changed. */
  private pendingReload = false;
  /** Signal containing the current login error message if any */
  protected readonly error = signal<string | null>(null);

  /**
   * True when `errorInterceptor` sent the user back here after a 401, rather than the user
   * navigating to sign in. Without this the redirect looks like the app dropping them at the
   * login screen for no reason.
   */
  protected readonly sessionExpired = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('reason') === SESSION_EXPIRED_REASON)),
    { initialValue: false },
  );

  /** Reactive form group for login credentials and server settings */
  protected readonly loginForm = this.fb.group({
    serverUrl: [this.configService.apiUrl, Validators.required],
    customUrl: [''],
    tenantId: [this.authService.currentTenantId(), Validators.required],
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  /**
   * Switches the application language at runtime.
   * @param lang - The target language code (e.g., 'en', 'hi', 'ko')
   */
  switchLanguage(lang: string) {
    this.translate.use(lang);
  }

  /**
   * Handles the login form submission.
   * Updates configuration if needed and attempts authentication via AuthService.
   */
  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading.set(true);
      this.error.set(null);

      const { username, password, tenantId, serverUrl, customUrl } = this.loginForm.value;
      const finalUrl = serverUrl === 'custom' ? customUrl : serverUrl;

      // CRITICAL: Check previous URL before updating it
      const previousUrl = this.configService.apiUrl;

      // Refuse before authenticating, not after: the point of the allow-list is that the
      // password below never reaches a host the deployment did not sanction.
      if (finalUrl && !this.configService.setApiUrl(finalUrl)) {
        this.error.set(this.translate.instant('login.errors.endpointNotAllowed'));
        this.isLoading.set(false);
        return;
      }

      this.authService
        .login(username!, password!, tenantId!)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            // Remembered for the two-factor path, which finishes after this callback returns.
            this.pendingReload = !!finalUrl && finalUrl !== previousUrl;

            // The password was accepted, but where the platform runs a second factor that is
            // only the first half: `twoFactorPending` is set and the template swaps the form
            // for the second step. Navigating now would land on a dashboard that 403s.
            if (this.authService.twoFactorPending()) {
              this.isLoading.set(false);
              return;
            }

            this.enterApplication();
          },
          error: (err) => {
            this.isLoading.set(false);
            this.error.set(
              err.error?.defaultUserMessage || 'Login failed. Check credentials/server.',
            );
          },
        });
    }
  }

  /** The second factor succeeded; the session is complete and the user can be let in. */
  protected onTwoFactorCompleted(): void {
    this.enterApplication();
  }

  /** The user backed out of the second step. `TwoFactorStepComponent` has already signed them out. */
  protected onTwoFactorCancelled(): void {
    this.pendingReload = false;
    this.error.set(null);
    this.loginForm.patchValue({ password: '' });
  }

  /**
   * Leaves the login page, reloading when the API endpoint changed under us.
   *
   * A changed endpoint means the whole application should re-bootstrap against it; a router
   * navigation would keep services that had already read the old one.
   */
  private enterApplication(): void {
    if (this.pendingReload) {
      window.location.href = document.baseURI || '/';
      return;
    }
    this.router.navigate(['/']);
  }
}
