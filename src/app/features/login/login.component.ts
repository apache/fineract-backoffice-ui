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
import { I18N, TranslatePipe } from '../../core/adapters';
import { AuthService } from '../../core/services/auth.service';
import { ConfigService } from '../../core/services/config.service';
import { BrandingService } from '../../core/services/branding.service';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { LOGOUT_REASON_MESSAGE, toLogoutReason } from '../../core/router/session-reasons';
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
  imports: [ReactiveFormsModule, TranslatePipe, HelpIconComponent, TwoFactorStepComponent],
  template: `
    <div class="login-page">
      <div class="login-card" role="main">
        <div class="lang-selector">
          <select
            #langSelect
            (change)="switchLanguage(langSelect.value)"
            [attr.aria-label]="'app.language.select' | appTranslate"
          >
            <option value="en" [selected]="i18n.currentLang() === 'en'">
              {{ 'app.language.en' | appTranslate }}
            </option>
            <option value="hi" [selected]="i18n.currentLang() === 'hi'">
              {{ 'app.language.hi' | appTranslate }}
            </option>
            <option value="ko" [selected]="i18n.currentLang() === 'ko'">
              {{ 'app.language.ko' | appTranslate }}
            </option>
          </select>
        </div>
        <div class="login-header">
          <img
            [src]="logoSrc()"
            [alt]="(brandName() || ('app.title' | appTranslate)) + ' logo'"
            class="login-logo"
          />
          <h1>{{ brandName() || ('app.title' | appTranslate) }}</h1>
          <p class="subtitle">{{ 'login.welcome' | appTranslate }}</p>
        </div>

        @if (logoutNotice(); as noticeKey) {
          <div class="notice" role="status" data-testid="login-logout-notice">
            {{ noticeKey | appTranslate }}
          </div>
        }

        @if (authService.twoFactorPending()) {
          <app-two-factor-step
            (completed)="onTwoFactorCompleted()"
            (cancelled)="onTwoFactorCancelled()"
          />
        } @else {
          @if (configService.oidcLoginEnabled()) {
            <!-- The round trip to an identity provider is not implemented yet — see issue #370.
                 Username and password stay in place below rather than being replaced, so this
                 button can never be the only way in. -->
            <button
              type="button"
              class="sso-btn"
              data-testid="login-sso-button"
              (click)="onOidcLogin()"
            >
              {{ 'login.sso.button' | appTranslate }}
            </button>
            <div class="sso-divider" role="separator">
              <span>{{ 'login.sso.divider' | appTranslate }}</span>
            </div>
          }
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
            <div class="form-field">
              <label for="serverUrl">
                {{ 'login.serverUrl' | appTranslate }}
                <app-help-icon helpTextKey="login.tooltips.serverUrl"></app-help-icon>
              </label>
              <select id="serverUrl" formControlName="serverUrl">
                <option [value]="configService.apiUrl">
                  {{ 'login.defaultOption' | appTranslate }} ({{ configService.apiUrl }})
                </option>
                <!-- Endpoints this deployment permits, from config.json. Third-party hosts used
                   to be hard-coded here, which offered a teller a one-click path to type real
                   credentials into someone else's server. What is offered is now the operator's
                   decision, and anything typed is checked against the same allow-list. -->
                <option value="/fineract-provider/api/v1">
                  {{ 'login.proxyOption' | appTranslate }}
                </option>
                @for (origin of allowedOrigins(); track origin) {
                  <option [value]="origin">{{ origin }}</option>
                }
                <option value="custom">{{ 'login.customOption' | appTranslate }}</option>
              </select>
            </div>

            @if (loginForm.get('serverUrl')?.value === 'custom') {
              <div class="form-field">
                <label for="customUrl">{{ 'login.customUrl' | appTranslate }}</label>
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
                {{ 'login.tenantId' | appTranslate }}
                <app-help-icon helpTextKey="login.tooltips.tenantId"></app-help-icon>
              </label>
              <input
                id="tenantId"
                type="text"
                formControlName="tenantId"
                [attr.aria-invalid]="showInvalid('tenantId')"
              />
            </div>

            <div class="form-field">
              <label for="username">{{ 'login.username' | appTranslate }}</label>
              <input
                id="username"
                type="text"
                formControlName="username"
                autocomplete="username"
                [attr.aria-invalid]="showInvalid('username')"
              />
            </div>

            <div class="form-field">
              <label for="password">{{ 'login.password' | appTranslate }}</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                autocomplete="current-password"
                [attr.aria-invalid]="showInvalid('password')"
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
                {{ 'login.loggingIn' | appTranslate }}
              } @else {
                {{ 'login.submit' | appTranslate }}
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
        align-items: center;
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
      .sso-btn {
        width: 100%;
        padding: var(--space-3);
        background: var(--card-bg);
        color: var(--text-color);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
      }
      .sso-btn:hover {
        border-color: var(--primary-color);
      }
      .sso-divider {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        color: var(--text-muted);
        font-size: 0.75rem;
        margin: var(--space-4) 0;
      }
      .sso-divider::before,
      .sso-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--border-color);
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
  private readonly notification = inject(NotificationService);

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
  protected readonly i18n = inject(I18N);

  /** Signal indicating if a login request is in progress */
  protected readonly isLoading = signal(false);
  /** Whether entering the application needs a full reload, because the API endpoint changed. */
  private pendingReload = false;
  /** Signal containing the current login error message if any */
  protected readonly error = signal<string | null>(null);

  /**
   * Translation key explaining an involuntary return to this screen, or `null` when the user
   * navigated here themselves. Without it the redirect looks like the app dropping them at the
   * login screen for no reason.
   *
   * Driven by the whole {@link LOGOUT_REASONS} set, not one value: the 401 path and the
   * inactivity timer both send the user here, and for a while only the former was recognised.
   */
  protected readonly logoutNotice = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => {
        const reason = toLogoutReason(params.get('reason'));
        return reason ? LOGOUT_REASON_MESSAGE[reason] : null;
      }),
    ),
    { initialValue: null },
  );

  /** Reactive form group for login credentials and server settings */
  protected readonly loginForm = this.fb.group({
    serverUrl: [this.configService.apiUrl, Validators.required],
    customUrl: [''],
    tenantId: [this.authService.currentTenantId(), Validators.required],
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  /** Announce validation only after the user has interacted with the field. */
  protected showInvalid(name: 'tenantId' | 'username' | 'password'): 'true' | null {
    const control = this.loginForm.controls[name];
    return control.invalid && (control.touched || control.dirty) ? 'true' : null;
  }

  /**
   * Switches the application language at runtime.
   * @param lang - The target language code (e.g., 'en', 'hi', 'ko')
   */
  switchLanguage(lang: string) {
    this.i18n.use(lang);
  }

  /**
   * The identity-provider button is visible (see {@link ConfigService.oidcLoginEnabled}), but
   * the authorization-code round trip behind it — redirect, PKCE, token exchange, refresh — is
   * not built yet; see issue #370. Rather than a silent no-op, or a redirect this application
   * cannot yet complete, clicking it says so plainly and leaves the person at the form below.
   * This is deliberately the opposite of the bug being fixed: the config that turns this button
   * on is real, and so is what happens when it is pressed.
   */
  protected onOidcLogin(): void {
    void this.notification.show(this.i18n.translate('login.sso.notImplemented'));
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
        this.error.set(this.i18n.translate('login.errors.endpointNotAllowed'));
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
            this.error.set(this.loginErrorMessage(err));
          },
        });
    }
  }

  /**
   * A refused password, a server without the sign-in endpoint and a server that cannot be
   * reached need different fixes, so they get different messages. The platform answers a wrong
   * username or password with a 401 whose own text is "Unauthenticated. Please login.", which
   * says nothing useful on the login page; other platform messages, such as the one for an
   * unknown tenant, are specific and are shown as they are.
   */
  private loginErrorMessage(err: {
    status?: number;
    error?: { defaultUserMessage?: string; userMessageGlobalisationCode?: string } | null;
  }): string {
    if (
      err.status === 401 &&
      err.error?.userMessageGlobalisationCode === 'error.msg.not.authenticated'
    ) {
      return this.i18n.translate('login.errors.invalidCredentials');
    }
    if (err.status === 404) {
      return this.i18n.translate('login.errors.endpointNotFound');
    }
    if (err.status === 0) {
      return this.i18n.translate('login.errors.serverUnreachable');
    }
    return err.error?.defaultUserMessage || this.i18n.translate('login.errors.failed');
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
