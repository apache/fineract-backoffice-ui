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

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../core/services/auth.service';
import { Router } from '@angular/router';

/**
 * Top-level application header component.
 *
 * Contains the branding logo, application title, current user information,
 * language selector, and the global logout action.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <header class="header" role="banner">
      <div class="logo-section">
        <img src="favicon.png" [attr.alt]="'app.logoAlt' | translate" class="logo" />
        <span class="app-title">{{ 'app.title' | translate }}</span>
      </div>

      <div class="header-actions">
        <div class="user-info">
          <span class="username">{{ authService.username() }}</span>
          <span class="office">{{ authService.officeName() }}</span>
        </div>

        <select
          id="lang-select"
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

        <button class="logout-btn" (click)="logout()" [attr.aria-label]="'app.logout' | translate">
          {{ 'app.logout' | translate }}
        </button>
      </div>
    </header>
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 1.5rem;
        height: 64px;
        background-color: #fff;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        z-index: 1000;
      }
      .logo-section {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .logo {
        height: 32px;
        width: 32px;
      }
      .app-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #333;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 1.5rem;
      }
      .user-info {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        line-height: 1.2;
      }
      .username {
        font-weight: 600;
        font-size: 0.9rem;
      }
      .office {
        font-size: 0.75rem;
        color: #666;
      }
      select {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        border: 1px solid #ddd;
      }
      .logout-btn {
        padding: 0.5rem 1rem;
        background-color: #f44336;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
      }
      .logout-btn:hover {
        background-color: #d32f2f;
      }
    `,
  ],
})
export class HeaderComponent {
  protected readonly authService = inject(AuthService);
  protected readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  /**
   * Switches the application language at runtime.
   * @param lang - The target language code (e.g., 'en', 'hi', 'ko')
   */
  switchLanguage(lang: string) {
    this.translate.use(lang);
  }

  /**
   * Triggers the global logout process and redirects to the login screen.
   */
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
