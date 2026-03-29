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

import { Component, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { ConfigService } from '../../core/services/config.service';

/**
 * Component providing the user login interface.
 *
 * Handles authentication credentials, tenant selection, and API endpoint configuration.
 * Adheres to accessibility standards and supports multiple languages.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, MatTooltipModule],
  template: `
    <div class="login-page">
      <div class="login-card" role="main">
        <div class="login-header">
          <img src="favicon.png" [attr.alt]="'app.logoAlt' | translate" class="login-logo" />
          <h1>{{ 'app.title' | translate }}</h1>
          <p class="subtitle">{{ 'login.welcome' | translate }}</p>
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-field">
            <label for="serverUrl" [matTooltip]="'login.tooltips.serverUrl' | translate">
              {{ 'login.serverUrl' | translate }} ℹ️
            </label>
            <select id="serverUrl" formControlName="serverUrl" (change)="onServerChange()">
              <option value="https://demo.mifos.io/fineract-provider/api/v1">
                {{ 'login.serverOptions.sandbox' | translate }}
              </option>
              <option value="https://localhost:8443/fineract-provider/api/v1">
                {{ 'login.serverOptions.local' | translate }}
              </option>
              <option value="custom">{{ 'login.serverOptions.custom' | translate }}</option>
            </select>
          </div>

          @if (loginForm.get('serverUrl')?.value === 'custom') {
            <div class="form-field">
              <label for="customUrl">{{ 'login.customUrl' | translate }}</label>
              <input
                id="customUrl"
                type="text"
                formControlName="customUrl"
                [placeholder]="'login.customUrlPlaceholder' | translate"
              />
            </div>
          }

          <div class="form-field">
            <label for="tenantId" [matTooltip]="'login.tooltips.tenantId' | translate">
              {{ 'login.tenantId' | translate }} ℹ️
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

        <div class="login-footer">
          <p>{{ 'login.footer' | translate: { year: currentYear } }}</p>
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
        min-height: 100vh;
        background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
        padding: 1rem;
      }
      .login-card {
        background: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        width: 100%;
        max-width: 440px;
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
        color: #333;
        margin: 0;
      }
      .subtitle {
        color: #666;
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
        font-weight: 600;
        font-size: 0.8rem;
        color: #444;
        cursor: help;
      }
      input,
      select {
        padding: 0.6rem;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 0.9rem;
        transition: border-color 0.2s;
      }
      input:focus,
      select:focus {
        outline: none;
        border-color: #3498db;
        box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
      }
      .error-message {
        background-color: #ffebee;
        color: #c62828;
        padding: 0.6rem;
        border-radius: 6px;
        font-size: 0.8rem;
        border-left: 4px solid #c62828;
      }
      .submit-btn {
        margin-top: 0.5rem;
        padding: 0.75rem;
        background-color: #3498db;
        color: white;
        border: none;
        border-radius: 6px;
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
        color: #999;
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
  private readonly authService = inject(AuthService);
  private readonly configService = inject(ConfigService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /** Signal indicating if a login request is in progress */
  protected readonly isLoading = signal(false);
  /** Signal containing the current login error message if any */
  protected readonly error = signal<string | null>(null);
  /** Current year for the localized footer */
  protected readonly currentYear = new Date().getFullYear();

  /** Reactive form group for login credentials and server settings */
  protected readonly loginForm = this.fb.group({
    serverUrl: [this.configService.apiUrl, Validators.required],
    customUrl: [''],
    tenantId: [this.authService.currentTenantId(), Validators.required],
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  /**
   * Responds to server URL selection changes.
   * Updates the global ConfigService when a non-custom preset is chosen.
   */
  onServerChange(): void {
    const serverUrl = this.loginForm.get('serverUrl')?.value;
    if (serverUrl !== 'custom') {
      this.configService.setApiUrl(serverUrl!);
    }
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
      if (finalUrl) {
        this.configService.setApiUrl(finalUrl);
      }

      this.authService
        .login(username!, password!, tenantId!)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.router.navigate(['/']);
          },
          error: (err) => {
            this.isLoading.set(false);
            this.error.set(
              err.error?.defaultUserMessage || this.translate.instant('login.errors.default'),
            );
          },
        });
    }
  }
}
