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
  Component,
  Injector,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../core/services/auth.service';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import {
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonSearchbar,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { GuidanceService } from '../core/services/guidance.service';
import { SidebarService } from '../core/services/sidebar.service';
import { BrandingService } from '../core/services/branding.service';
import { ViewportService } from '../core/services/viewport.service';
import { buildBreadcrumbs } from './breadcrumb';

/** The shipped mark, used when the deployment names none of its own. */
const DEFAULT_LOGO = 'favicon.png';
import { ThemeService } from '../core/services/theme.service';
import { SearchAPIService, GetSearchResponse, BusinessDateManagementService } from '../api';
import {
  NavigationConfigService,
  NavSearchResult,
} from '../core/services/navigation-config.service';
import { TooltipDirective } from '../shared/directives/tooltip.directive';

/** Combined header search result — entity records or navigation shortcuts. */
type HeaderSearchResult =
  { kind: 'entity'; entity: GetSearchResponse } | { kind: 'nav'; nav: NavSearchResult };

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
    NgTemplateOutlet,
    RouterModule,
    TranslateModule,
    IonIcon,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    FormsModule,
    TooltipDirective,
    IonPopover,
  ],
  template: `
    <header class="header" role="banner" [class.searching]="mobileSearchOpen()">
      <div class="logo-section">
        <!--
          One control, two meanings. Narrow: opens the drawer, so it needs the dialog wiring
          (aria-expanded, aria-controls) and a hamburger. Wide: narrows the permanent column,
          which is a preference rather than a disclosure, so it carries neither.
        -->
        <button
          class="toggle-btn"
          (click)="sidebarService.toggle()"
          [attr.aria-expanded]="viewport.isMobile() ? sidebarService.isDrawerOpen() : null"
          [attr.aria-controls]="viewport.isMobile() ? 'app-navigation' : null"
          [attr.aria-label]="
            (viewport.isMobile()
              ? sidebarService.isDrawerOpen()
                ? 'nav.closeMenu'
                : 'nav.openMenu'
              : 'nav.toggleSidebar'
            ) | translate
          "
        >
          @if (viewport.isMobile() || sidebarService.isCollapsed()) {
            <ion-icon name="menu-outline"></ion-icon>
          } @else {
            <ion-icon name="chevron-back-outline"></ion-icon>
          }
        </button>
        <!--
          Logo and product name come from the deployment's branding overlay when it sets them,
          and fall back to the shipped mark otherwise. 'alt' follows the name rather than saying
          "Fineract Logo", which is wrong the moment a deployment rebrands.
        -->
        <img
          [src]="logoSrc()"
          [alt]="(brandName() || ('app.title' | translate)) + ' logo'"
          class="logo"
        />
        <span class="app-title">{{ brandName() || ('app.title' | translate) }}</span>
        @if (viewport.isMobile() && !mobileSearchOpen()) {
          <!--
            On a phone the bar answers "where am I", which the product name cannot: the name is
            the same on every screen, and the mark already carries it. Falls back to the product
            name on a route with no title of its own.
          -->
          <h1 class="page-title">
            {{
              pageTitleKey()
                ? (pageTitleKey() | translate)
                : brandName() || ('app.title' | translate)
            }}
          </h1>
        }
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
                (mousedown)="$event.preventDefault()"
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

      @if (viewport.isMobile()) {
        <div class="mobile-actions">
          <button
            class="icon-btn"
            (click)="toggleMobileSearch()"
            [attr.aria-expanded]="mobileSearchOpen()"
            [attr.aria-label]="(mobileSearchOpen() ? 'COMMON.CLOSE' : 'COMMON.SEARCH') | translate"
          >
            <ion-icon [name]="mobileSearchOpen() ? 'close-outline' : 'search-outline'"></ion-icon>
          </button>
          <button
            id="header-overflow"
            class="icon-btn"
            [attr.aria-label]="'nav.moreActions' | translate"
          >
            <ion-icon name="ellipsis-vertical-outline"></ion-icon>
          </button>
        </div>

        <!--
          Everything the wide header shows in a row lives here instead. Same template, so a
          control cannot be added to one layout and forgotten in the other.
        -->
        <ion-popover
          trigger="header-overflow"
          [dismissOnSelect]="true"
          side="bottom"
          alignment="end"
        >
          <ng-template>
            <div class="overflow-menu">
              <ng-container *ngTemplateOutlet="headerActions"></ng-container>
            </div>
          </ng-template>
        </ion-popover>
      }

      <div class="header-actions">
        @if (!viewport.isMobile()) {
          <ng-container *ngTemplateOutlet="headerActions"></ng-container>
        }
      </div>
    </header>

    <ng-template #headerActions>
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

      <button class="tour-btn" (click)="startTour()" [attr.aria-label]="'GUIDE.OPEN' | translate">
        <ion-icon name="compass-outline" aria-hidden="true"></ion-icon>
        {{ 'GUIDE.OPEN_SHORT' | translate }}
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
    </ng-template>
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        /* The containing block for the expanded phone search field, which is positioned against
           the bar. Without it that field resolves against .app-container and lands in the page
           content. It also makes the z-index below apply at all -- z-index is ignored on a
           statically positioned element. */
        position: relative;
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
      /* ---- narrow viewport: an app bar, not a squeezed desktop header ------------------
         The wide header carries eight controls. Crushing them into 412px produced a searchbar
         too narrow to read its own placeholder and a Logout button louder than anything on the
         page — the least frequent action given the most weight.

         The phone bar is: navigation, where you are, search, everything else. Search expands
         over the title when asked for; the rest moves into an overflow menu that reuses the
         same template, so a control cannot be added to one layout and forgotten in the other.

         Breakpoint matches ViewportService.MOBILE_BREAKPOINT_PX; see DOCS/MOBILE.md. */
      @media (max-width: 768px) {
        .header {
          padding: 0 var(--space-1) 0 0;
          gap: var(--space-1);
        }

        .logo-section {
          flex: 1 1 auto;
          min-width: 0;
          gap: var(--space-1);
        }

        /* The wordmark repeats on every screen and the mark already carries it; the screen name
           does not. */
        .app-title {
          display: none;
        }

        .logo {
          width: 28px;
          height: 28px;
        }

        .page-title {
          font-size: 1.05rem;
          font-weight: 600;
          margin: 0;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-color);
        }

        .mobile-actions {
          display: flex;
          align-items: center;
          flex: 0 0 auto;
        }

        /* The hamburger is a touch target like the two on the right; it is styled elsewhere,
           so the floor has to be restated here or it renders at its desktop 40px. */
        .toggle-btn {
          min-width: 44px;
          min-height: 44px;
        }

        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 44px;
          min-height: 44px;
          background: none;
          border: none;
          color: var(--text-color);
          font-size: 22px;
          cursor: pointer;
          border-radius: var(--border-radius);
        }

        .icon-btn:hover {
          background-color: var(--hover-bg);
        }

        /* Search takes the whole bar when open, and is out of the way when not. */
        .search-section {
          display: none;
        }

        .header.searching .search-section {
          display: block;
          position: absolute;
          inset: 0 44px 0 var(--space-2);
          z-index: 2;
          align-self: center;
        }

        .header.searching .logo-section {
          /* The hamburger stays reachable; the mark and title yield to the field. */
          flex: 0 0 auto;
        }

        .header.searching .logo,
        .header.searching .app-title {
          display: none;
        }

        .search-results {
          position: fixed;
          left: 0;
          right: 0;
          top: var(--header-height);
          max-height: 60dvh;
          overflow-y: auto;
        }

        /* Everything else now lives in the overflow popover. */
        .header-actions {
          display: none;
        }
      }

      /* The overflow menu, which is the same #headerActions template stacked instead of in a
         row. Only rendered inside the popover, so these rules are viewport-independent. */
      /* Labels for controls that are icon-only in the wide header. */
      .action-label {
        display: none;
      }
      .overflow-menu .action-label {
        display: inline;
      }

      .overflow-menu {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: var(--space-1);
        padding: var(--space-2);
        min-width: 220px;
      }

      .overflow-menu .system-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: var(--space-2);
        border-bottom: 1px solid var(--border-color);
        margin-bottom: var(--space-1);
      }

      .overflow-menu .user-info {
        display: flex;
        flex-direction: column;
        padding: var(--space-2);
        border-top: 1px solid var(--border-color);
        margin-top: var(--space-1);
      }

      .overflow-menu .theme-toggle-btn,
      .overflow-menu .tour-btn,
      .overflow-menu .logout-btn {
        justify-content: flex-start;
        width: 100%;
        min-height: 44px;
        gap: var(--space-2);
      }

      .overflow-menu #lang-select {
        width: 100%;
        min-height: 44px;
      }
    `,
  ],
})
export class HeaderComponent implements OnInit, OnDestroy {
  protected readonly authService = inject(AuthService);
  protected readonly translate = inject(TranslateService);
  protected readonly guidanceService = inject(GuidanceService);
  protected readonly sidebarService = inject(SidebarService);
  protected readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly searchService = inject(SearchAPIService);
  private readonly navigationConfig = inject(NavigationConfigService);
  private readonly businessDateService = inject(BusinessDateManagementService);
  private readonly branding = inject(BrandingService);
  protected readonly viewport = inject(ViewportService);

  /**
   * Whether the phone header has swapped its title row for the search field.
   *
   * A permanently-visible searchbar at 412px is a box too narrow to read the placeholder in, let
   * alone a result — it took a third of the bar and could not be used. It becomes an icon that
   * expands, which is the room search actually needs.
   */
  private readonly _mobileSearchOpen = signal(false);
  readonly mobileSearchOpen = this._mobileSearchOpen.asReadonly();

  /**
   * The current screen's name, as a translation key, from the same route `title` the breadcrumb
   * and the tab title already use. Reused rather than re-derived: a second walk over the route
   * tree would drift from the first the day someone retitles a route.
   *
   * A key rather than a resolved string, and a `toSignal` in a field initialiser rather than a
   * signal written from `ngOnInit` — both deliberate. Writing a signal the template reads while
   * change detection is running is the NG0100 pattern, and this suite runs against a build with
   * `checkNoChanges({ exhaustive: true })`. Leaving it as a key also means the template's
   * `| translate` pipe handles a language change, so there is no second subscription for that.
   *
   * Mirrors BreadcrumbComponent, which solves the same problem the same way.
   */
  protected readonly pageTitleKey = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => buildBreadcrumbs(this.router.routerState.snapshot.root).at(-1)?.labelKey ?? ''),
    ),
    {
      initialValue: buildBreadcrumbs(this.router.routerState.snapshot.root).at(-1)?.labelKey ?? '',
    },
  );
  private readonly themeIsDark = this.themeService.isDarkMode;

  /**
   * The deployment's product name, or `null` when it sets none, so the template can fall back
   * through the `translate` pipe. See the note on the same member in `LoginComponent`.
   */
  protected readonly brandName = computed(() => this.branding.appName());

  /** The deployment's mark for the active theme, or the shipped favicon. */
  protected readonly logoSrc = computed(() => {
    const configured = this.themeIsDark() ? this.branding.logoDarkUrl() : this.branding.logoUrl();
    return this.branding.resolveLogo(configured) ?? DEFAULT_LOGO;
  });

  searchQuery = '';
  readonly searchResults = signal<HeaderSearchResult[]>([]);
  protected readonly showResults = signal(false);
  private searchSubject = new Subject<string>();

  readonly businessDate = signal<string>('-');
  readonly renderTime = signal<string>('-');
  private renderTimeInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadSystemInfo();
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query || query.length < 2) return of([]);
          const navResults = this.navigationConfig
            .searchRoutes(query, 8)
            .map((nav): HeaderSearchResult => ({ kind: 'nav', nav }));
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
    // Held so ngOnDestroy can stop it — the header is destroyed on sign-out and
    // rebuilt on the next sign-in; an uncleared interval would keep ticking (and
    // writing to a signal no one reads) once per session.
    this.renderTimeInterval = setInterval(updateTime, 60_000);
  }

  ngOnDestroy(): void {
    if (this.renderTimeInterval !== null) {
      clearInterval(this.renderTimeInterval);
      this.renderTimeInterval = null;
    }
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
   *
   * The beat is a fallback for blurs from elsewhere (e.g. Escape, clicking outside), not the
   * mechanism a result click relies on: `(mousedown)="$event.preventDefault()"` on each result
   * item stops the searchbar from blurring at all when a result is the click's target, so this
   * timeout never has to race the click under load. It used to be that race — on a slow
   * render, the 150ms could elapse before the click event landed, collapsing the list out from
   * under the click and silently swallowing the navigation.
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
    switch (entity.entityType) {
      case 'CLIENT': {
        this.router.navigate(['/clients/view', entity.entityId]);

        break;
      }
      case 'LOAN': {
        this.router.navigate(['/loans/view', entity.entityId]);

        break;
      }
      case 'SAVINGSACCOUNT': {
        // Savings accounts are routed under products; there is no top-level /savings,
        // so the old target fell through to the wildcard and showed Not Found.
        this.router.navigate(['/products/savings-accounts/view', entity.entityId]);

        break;
      }
      // No default
    }
  }

  resultTrackBy(result: HeaderSearchResult): string {
    return result.kind === 'nav'
      ? `nav:${result.nav.route}`
      : `entity:${result.entity.entityType}:${result.entity.entityId}`;
  }

  resultTestId(result: HeaderSearchResult): string {
    // Slugged rather than raw: a route is full of slashes, and a testid containing them
    // is awkward to select on from a spec.
    return result.kind === 'nav'
      ? `search-result-nav-${result.nav.route.replaceAll('/', '-').replace(/^-/, '')}`
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
  /**
   * Opens the tour for the screen the user is on.
   *
   * The route's own `title` key and a DOM probe are passed in, so a screen with no hand-written
   * copy still gets a tour named after itself and describing the controls it actually has. The
   * probe is scoped to `main`: the shell is not part of the screen, and a loose selector must
   * not be able to reach it.
   */
  startTour() {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;

    this.guidanceService.startTour(this.router.url, {
      titleKey: route.title,
      has: (selector) => !!document.querySelector('main')?.querySelector(selector),
    });
  }

  /**
   * Triggers the global logout process and redirects to the login screen.
   */
  protected toggleMobileSearch(): void {
    const opening = !this._mobileSearchOpen();
    this._mobileSearchOpen.set(opening);
    if (!opening) {
      this.searchQuery = '';
      this.searchResults.set([]);
      this.showResults.set(false);
      return;
    }
    // The field is only in the DOM once the row has swapped, so focus waits for the render.
    afterNextRender(() => document.querySelector<HTMLElement>('#global-search input')?.focus(), {
      injector: this.injector,
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
