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

import { Component, inject, signal, OnInit } from '@angular/core';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../core/services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { IonIcon, IonItem, IonLabel, IonList, IonSearchbar } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, map, catchError } from 'rxjs';
import { GuidanceService } from '../core/services/guidance.service';
import { SidebarService } from '../core/services/sidebar.service';
import { ThemeService } from '../core/services/theme.service';
import { SearchAPIService, GetSearchResponse, BusinessDateManagementService } from '../api';
import {
  NavigationConfigService,
  NavSearchResult,
} from '../core/services/navigation-config.service';
import { TooltipDirective } from '../shared/directives/tooltip.directive';

/** Combined header search result — entity records or navigation shortcuts. */
type HeaderSearchResult =
  | { kind: 'entity'; entity: GetSearchResponse }
  | { kind: 'nav'; nav: NavSearchResult };

/**
 * Top-level application header component.
 *
 * Contains the branding logo, application title, current user information,
 * language selector, and the global logout action.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterModule,
    TranslateModule,
    IonIcon,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    FormsModule,
    TooltipDirective,
  ],
  template: `
    <header class="header" role="banner">
      <div class="logo-section">
        <button
          class="toggle-btn"
          (click)="sidebarService.toggle()"
          [attr.aria-label]="'Toggle Sidebar'"
        >
          @if (sidebarService.isCollapsed()) {
            <ion-icon name="menu-outline"></ion-icon>
          } @else {
            <ion-icon name="chevron-back-outline"></ion-icon>
          }
        </button>
        <img src="favicon.png" alt="Fineract Logo" class="logo" />
        <span class="app-title">{{ 'app.title' | translate }}</span>
      </div>

      <div class="search-section">
        <ion-searchbar
          class="global-search-field"
          id="global-search"
          data-testid="global-search"
          [placeholder]="'COMMON.SEARCH' | translate"
          [value]="searchQuery"
          (ionInput)="onSearchInput($event)"
          (ionBlur)="onSearchBlur()"
        ></ion-searchbar>

        <!-- Ionic has no autocomplete, so results render as a dropdown under the searchbar. -->
        @if (showResults() && searchResults().length > 0) {
          <ion-list class="search-results" role="listbox" data-testid="global-search-results">
            @for (result of searchResults(); track resultTrackBy(result)) {
              <ion-item
                button
                role="option"
                [attr.data-testid]="resultTestId(result)"
                (click)="onResultSelected(result)"
              >
                <ion-label>
                  <div class="search-result-item">
                    @if (result.kind === 'nav') {
                      <span class="result-type">{{ 'SEARCH.PAGE_TYPE' | translate }}</span>
                      <span class="result-name">{{ result.nav.label }}</span>
                      @if (result.nav.groupLabel) {
                        <span class="result-acc">{{ result.nav.groupLabel }}</span>
                      }
                    } @else {
                      <span class="result-type">{{ result.entity.entityType }}</span>
                      <span class="result-name">{{ result.entity.entityName }}</span>
                      @if (result.entity.entityAccountNo) {
                        <span class="result-acc">#{{ result.entity.entityAccountNo }}</span>
                      }
                    }
                  </div>
                </ion-label>
              </ion-item>
            }
          </ion-list>
        }
      </div>

      <div class="header-actions">
        <div class="system-info">
          <div class="info-group">
            <span class="label">{{ 'COMMON.BUSINESS_DATE' | translate }}:</span>
            <span class="value">{{ businessDate() }}</span>
          </div>
          <div class="info-group">
            <span class="label">{{ 'COMMON.RENDER_TIME' | translate }}:</span>
            <span class="value">{{ renderTime() }}</span>
          </div>
        </div>

        <button
          class="theme-toggle-btn"
          (click)="themeService.toggleDarkMode()"
          [appTooltip]="'COMMON.TOGGLE_THEME' | translate"
          [attr.aria-label]="'COMMON.TOGGLE_THEME' | translate"
        >
          @if (themeService.isDarkMode()) {
            <ion-icon name="sunny-outline"></ion-icon>
          } @else {
            <ion-icon name="moon-outline"></ion-icon>
          }
        </button>

        <button class="tour-btn" (click)="startTour()" [attr.aria-label]="'Help Tour'">
          <ion-icon name="compass-outline"></ion-icon>
          Guide
        </button>

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
        background-color: var(--card-bg);
        color: var(--text-color);
        box-shadow: var(--shadow-sm);
        z-index: 1000;
        transition:
          background-color 0.2s,
          color 0.2s;
      }
      .logo-section {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .search-section {
        flex: 1;
        max-width: 500px;
        margin: 0 2rem;
        position: relative;
      }
      .global-search-field {
        width: 100%;
        padding: 0;
        --box-shadow: none;
        --border-radius: 8px;
      }
      .search-results {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 1200;
        max-height: 320px;
        overflow-y: auto;
        border-radius: 8px;
        box-shadow: var(--shadow-md);
        padding: 0;
      }
      .search-result-item {
        display: flex;
        gap: 12px;
        align-items: center;
        font-size: 14px;
      }
      .result-type {
        background: var(--surface-sunken);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        text-transform: uppercase;
        color: var(--text-muted);
        font-weight: 600;
      }
      .result-acc {
        color: var(--text-muted);
        font-size: 12px;
      }
      .system-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 11px;
        margin-right: 1rem;
        padding: 4px 8px;
        background: var(--hover-bg);
        border-radius: 4px;
      }
      .info-group {
        display: flex;
        gap: 6px;
        white-space: nowrap;
      }
      .system-info .label {
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
      }
      .system-info .value {
        color: var(--primary-color);
        font-family: 'Roboto Mono', monospace;
      }
      .toggle-btn {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        border-radius: 4px;
        transition:
          background-color 0.2s,
          color 0.2s;
      }
      .toggle-btn:hover {
        background-color: var(--hover-bg);
        color: var(--text-color);
      }
      /* Native select, kept for its keyboard behaviour, styled to sit with the Ionic
         controls around it rather than reading as browser default chrome. */
      #lang-select {
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        background: var(--card-bg);
        color: var(--text-color);
        font-family: inherit;
        font-size: 0.85rem;
        cursor: pointer;
        transition:
          border-color 0.2s,
          box-shadow 0.2s;
      }
      #lang-select:hover {
        border-color: var(--primary-color);
      }
      #lang-select:focus-visible {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: var(--focus-ring);
      }
      .toggle-btn ion-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }
      .logo {
        height: 32px;
        width: 32px;
      }
      .app-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--primary-color);
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
        color: var(--text-color);
      }
      .office {
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      select {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        border: 1px solid var(--border-color);
      }
      .logout-btn {
        padding: 0.5rem 1rem;
        background-color: var(--error-color);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        transition: filter 0.2s;
      }
      .logout-btn:hover {
        filter: brightness(0.9);
      }
      .theme-toggle-btn {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        border-radius: 50%;
        transition: background-color 0.2s;
      }
      .theme-toggle-btn:hover {
        background-color: var(--hover-bg);
      }
      .tour-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0.5rem 0.75rem;
        background-color: var(--primary-dark);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        transition: filter 0.2s;
      }
      .tour-btn:hover {
        filter: brightness(0.9);
      }
      .tour-btn ion-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    `,
  ],
})
export class HeaderComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly translate = inject(TranslateService);
  protected readonly guidanceService = inject(GuidanceService);
  protected readonly sidebarService = inject(SidebarService);
  protected readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly searchService = inject(SearchAPIService);
  private readonly navigationConfig = inject(NavigationConfigService);
  private readonly businessDateService = inject(BusinessDateManagementService);

  searchQuery = '';
  readonly searchResults = signal<HeaderSearchResult[]>([]);
  protected readonly showResults = signal(false);
  private searchSubject = new Subject<string>();

  readonly businessDate = signal<string>('-');
  readonly renderTime = signal<string>('-');

  ngOnInit(): void {
    this.loadSystemInfo();
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query || query.length < 2) return of([]);
          const navResults = this.navigationConfig.searchRoutes(query, 8).map(
            (nav): HeaderSearchResult => ({ kind: 'nav', nav }),
          );
          return this.searchService.getSearch(query, 'clients,loans,savings').pipe(
            map((entities) => [
              ...navResults,
              ...entities.map((entity): HeaderSearchResult => ({ kind: 'entity', entity })),
            ]),
            catchError(() => of(navResults)),
          );
        }),
      )
      .subscribe((results) => {
        this.searchResults.set(results);
      });
  }

  private loadSystemInfo() {
    this.businessDateService.getBusinessdate().subscribe({
      next: (dates) => {
        const bd = dates.find((d) => d.type === 'BUSINESS_DATE');
        if (bd && bd.date) {
          const d = bd.date as unknown as number[];
          this.businessDate.set(new Date(d[0], d[1] - 1, d[2]).toLocaleDateString());
        }
      },
    });

    const updateTime = () => {
      this.renderTime.set(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      );
    };
    updateTime();
    setInterval(updateTime, 60000);
  }

  onSearchInput(event: Event) {
    const detail = (event as CustomEvent<{ value?: string }>).detail;
    this.searchQuery = detail?.value ?? (event.target as HTMLInputElement)?.value ?? '';
    this.showResults.set(true);
    this.searchSubject.next(this.searchQuery);
  }

  /**
   * Hides the results after a beat — hiding immediately on blur would unmount the list
   * before the click that caused the blur lands on a result.
   */
  onSearchBlur() {
    setTimeout(() => this.showResults.set(false), 150);
  }

  onResultSelected(result: HeaderSearchResult) {
    this.searchQuery = '';
    this.showResults.set(false);

    if (result.kind === 'nav') {
      this.router.navigateByUrl(result.nav.route);
      return;
    }

    const entity = result.entity;
    if (entity.entityType === 'CLIENT') {
      this.router.navigate(['/clients/view', entity.entityId]);
    } else if (entity.entityType === 'LOAN') {
      this.router.navigate(['/loans/view', entity.entityId]);
    } else if (entity.entityType === 'SAVINGSACCOUNT') {
      this.router.navigate(['/savings/view', entity.entityId]);
    }
  }

  resultTrackBy(result: HeaderSearchResult): string {
    return result.kind === 'nav'
      ? `nav:${result.nav.route}`
      : `entity:${result.entity.entityType}:${result.entity.entityId}`;
  }

  resultTestId(result: HeaderSearchResult): string {
    return result.kind === 'nav'
      ? `search-result-nav-${result.nav.route}`
      : `search-result-${result.entity.entityId}`;
  }

  /**
   * Switches the application language at runtime.
   * @param lang - The target language code (e.g., 'en', 'hi', 'ko')
   */
  switchLanguage(lang: string) {
    this.translate.use(lang);
  }

  /**
   * Triggers the tour on the current active route.
   */
  startTour() {
    this.guidanceService.startTour(this.router.url);
  }

  /**
   * Triggers the global logout process and redirects to the login screen.
   */
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
