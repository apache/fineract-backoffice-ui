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

import { Injectable, computed, signal } from '@angular/core';

/** Where a step's target is looked for. */
export type StepScope =
  /** The routed view only. The default, so a step can never pick up the shell by accident. */
  | 'content'
  /** The header and sidebar, for steps that describe the application frame. */
  | 'shell';

export interface TourStep {
  titleKey: string;
  descriptionKey: string;
  /** Selector for the element the copy is about. Omit for a step that describes the whole screen. */
  targetSelector?: string;
  /** Defaults to `'content'`. See {@link StepScope}. */
  scope?: StepScope;
}

/**
 * Header actions are projected into `<ng-content select="[headerActions]">`, and every page that
 * uses it puts the attribute on an `ion-button`.
 *
 * This was `button[headerActions]`, which matches a *native* button carrying the attribute — and
 * there is none. Ionic renders its own `<button>` inside the host's shadow root, where the
 * attribute does not appear. So the "create" step of four separate tours pointed at nothing.
 *
 * The attribute alone is still not enough: a list can ask `app-data-table` for a create button
 * through `createButtonLabel`/`createPermission` instead of projecting its own, and groups,
 * centres and share accounts all do. Both forms end up inside `.header-actions`, but that div
 * is rendered whether or not it has anything in it, so this matches the two buttons rather than
 * their container — an outline around an empty box is worse than no outline.
 */
const HEADER_ACTIONS_SELECTOR = '[data-testid="data-table-create"], [headerActions]';

/**
 * The tab strip on a record view.
 *
 * Was `.tab-group`, which no template in this application applies to anything — it survives
 * only as a leftover style rule in five record views, from the Material port where the element
 * was `mat-tab-group`. So the tabs step of four separate tours matched nothing whatsoever. All
 * sixteen components with a tab strip render an `ion-segment`, so that is what the step points
 * at.
 */
const TAB_GROUP_SELECTOR = 'ion-segment';
const ACTIONS_AREA_SELECTOR = '.actions-area';
const SEARCH_FILTER_SELECTOR = 'app-search-filter';

/**
 * Which tour a URL gets, most specific first.
 *
 * Anchored patterns rather than `url.includes(...)`: the old chain tested `'/loans'` as a
 * substring, so any path with those characters anywhere in it claimed the loans tour.
 */
const ROUTE_TOURS: readonly { readonly match: RegExp; readonly key: string }[] = [
  { match: /^\/dashboard(\/|$)/, key: 'dashboard' },
  { match: /^\/clients\/view(\/|$)/, key: 'clients-view' },
  { match: /^\/clients(\/|$)/, key: 'clients' },
  { match: /^\/loans\/view(\/|$)/, key: 'loans-view' },
  { match: /^\/loans(\/|$)/, key: 'loans' },
  { match: /^\/groups\/view(\/|$)/, key: 'groups-view' },
  { match: /^\/groups(\/|$)/, key: 'groups' },
  { match: /^\/centers(\/|$)/, key: 'centers' },
  { match: /^\/products\/savings-accounts\/view(\/|$)/, key: 'savings-view' },
  { match: /^\/products\/savings-accounts(\/|$)/, key: 'savings' },
  { match: /^\/products\/shares\/create(\/|$)/, key: 'shares-create' },
  { match: /^\/products\/shares(\/|$)/, key: 'shares' },
  { match: /^\/products(\/|$)/, key: 'products' },
  { match: /^\/accounting(\/|$)/, key: 'accounting' },
  { match: /^\/reporting(\/|$)/, key: 'reporting' },
  { match: /^\/organization(\/|$)/, key: 'organization' },
  { match: /^\/system(\/|$)/, key: 'system' },
];

/** The orientation steps appended when a screen offers nothing else to point at. */
export const SHELL_TOUR_KEY = 'shell';

/** The key {@link GuidanceService.tourKeyFor} reports for a screen whose tour is composed. */
export const COMPOSED_TOUR_KEY = 'screen';

/**
 * What the running screen can tell a tour about itself.
 *
 * Passed in rather than read here so this service never touches the DOM, which is also what
 * lets the composition below be tested without rendering anything.
 */
export interface ScreenContext {
  /**
   * The route's own `title` key — `nav.loanProducts`, `PRODUCTS.CREATE_LOAN_PRODUCT` and so on.
   *
   * Preferred over a label repeated in the tour table, which would then have to be kept in step
   * with the route by hand. Optional because it has to be: 197 of the 305 route entries declare
   * a title, so a screen without one falls back to `GUIDE.SCREEN_TITLE`. Giving that route a
   * title is the better fix, and #355 covers it.
   */
  titleKey?: string;
  /** Whether a selector resolves *inside the routed view*. */
  has: (selector: string) => boolean;
}

/**
 * The structural steps a screen gets when it has no hand-written tour, in the order they read.
 *
 * Each is offered only if the control is actually on screen, so a composed tour describes the
 * screen in front of the user and nothing else. That is the whole point: a screen without its
 * own copy used to be given the *dashboard* tour, which was wrong about everything including
 * where the user was.
 */
const COMPOSED_STEPS: readonly TourStep[] = [
  {
    titleKey: 'GUIDE.SCREEN_SEARCH_TITLE',
    descriptionKey: 'GUIDE.SCREEN_SEARCH_DESC',
    targetSelector: SEARCH_FILTER_SELECTOR,
  },
  {
    titleKey: 'GUIDE.SCREEN_FILTER_TITLE',
    descriptionKey: 'GUIDE.SCREEN_FILTER_DESC',
    targetSelector: '.filter-row',
  },
  {
    titleKey: 'GUIDE.SCREEN_TABS_TITLE',
    descriptionKey: 'GUIDE.SCREEN_TABS_DESC',
    targetSelector: TAB_GROUP_SELECTOR,
  },
  {
    titleKey: 'GUIDE.SCREEN_ACTIONS_TITLE',
    descriptionKey: 'GUIDE.SCREEN_ACTIONS_DESC',
    targetSelector: ACTIONS_AREA_SELECTOR,
  },
  {
    titleKey: 'GUIDE.SCREEN_CREATE_TITLE',
    descriptionKey: 'GUIDE.SCREEN_CREATE_DESC',
    targetSelector: HEADER_ACTIONS_SELECTOR,
  },
  {
    titleKey: 'GUIDE.SCREEN_TABLE_TITLE',
    descriptionKey: 'GUIDE.SCREEN_TABLE_DESC',
    targetSelector: '.paginator',
  },
  {
    titleKey: 'GUIDE.SCREEN_FORM_TITLE',
    descriptionKey: 'GUIDE.SCREEN_FORM_DESC',
    targetSelector: 'form',
  },
];

@Injectable({
  providedIn: 'root',
})
export class GuidanceService {
  readonly isPlaying = signal<boolean>(false);
  readonly currentStepIndex = signal<number>(0);
  readonly activeSteps = signal<TourStep[]>([]);
  /** Which tour is running. Exposed so a test can assert the route resolved to the right one. */
  readonly activeTourKey = signal<string | null>(null);

  readonly currentStep = computed(() => {
    const steps = this.activeSteps();
    const idx = this.currentStepIndex();
    return steps.length > 0 && idx >= 0 && idx < steps.length ? steps[idx] : null;
  });

  readonly isLastStep = computed(() => this.currentStepIndex() === this.activeSteps().length - 1);

  private readonly tours: Record<string, TourStep[]> = {
    /**
     * What every screen has in common.
     *
     * This is the fallback, and it exists because the fallback used to be the *dashboard* tour:
     * pressing Guide on Accounting, Reports, Organization or any of the other several hundred
     * routes opened a tour whose first line welcomed you to a dashboard you were not looking at.
     * Describing the frame is true everywhere, which is the only thing a fallback can be.
     */
    [SHELL_TOUR_KEY]: [
      {
        titleKey: 'GUIDE.SHELL_TITLE',
        descriptionKey: 'GUIDE.SHELL_DESC',
      },
      {
        titleKey: 'GUIDE.SHELL_NAV_TITLE',
        descriptionKey: 'GUIDE.SHELL_NAV_DESC',
        // The toggle, not `#app-navigation`: on a narrow viewport the sidebar is a closed
        // drawer, and highlighting something with no box on screen highlights nothing.
        targetSelector: '.toggle-btn',
        scope: 'shell',
      },
      {
        titleKey: 'GUIDE.SHELL_SEARCH_TITLE',
        descriptionKey: 'GUIDE.SHELL_SEARCH_DESC',
        targetSelector: '#global-search',
        scope: 'shell',
      },
      {
        titleKey: 'GUIDE.SHELL_BUSINESS_DATE_TITLE',
        descriptionKey: 'GUIDE.SHELL_BUSINESS_DATE_DESC',
        // Both controls move into the header's overflow menu on a narrow viewport, where
        // neither is in the DOM until it is opened. A grouped selector resolves to whichever
        // exists, so the step points at where the control actually is at this width.
        targetSelector: '.system-info, #header-overflow',
        scope: 'shell',
      },
      {
        titleKey: 'GUIDE.SHELL_GUIDE_TITLE',
        descriptionKey: 'GUIDE.SHELL_GUIDE_DESC',
        targetSelector: '.tour-btn, #header-overflow',
        scope: 'shell',
      },
    ],
    dashboard: [
      {
        titleKey: 'GUIDE.DASHBOARD_WELCOME_TITLE',
        descriptionKey: 'GUIDE.DASHBOARD_WELCOME_DESC',
      },
      {
        titleKey: 'GUIDE.DASHBOARD_ENV_TITLE',
        descriptionKey: 'GUIDE.DASHBOARD_ENV_DESC',
        // Was a bare `ul`, which `document.querySelector` resolved to the sidebar's own
        // `.nav-list` because it sits earlier in the DOM. Scoping every step to the routed
        // view is what makes that class of mistake impossible rather than merely fixed.
        targetSelector: '.status-list',
      },
    ],
    clients: [
      {
        titleKey: 'GUIDE.CLIENTS_TITLE',
        descriptionKey: 'GUIDE.CLIENTS_DESC',
      },
      {
        titleKey: 'GUIDE.CLIENTS_SEARCH_TITLE',
        descriptionKey: 'GUIDE.CLIENTS_SEARCH_DESC',
        targetSelector: SEARCH_FILTER_SELECTOR,
      },
      {
        titleKey: 'GUIDE.CLIENTS_CREATE_TITLE',
        descriptionKey: 'GUIDE.CLIENTS_CREATE_DESC',
        targetSelector: HEADER_ACTIONS_SELECTOR,
      },
    ],
    'clients-view': [
      {
        titleKey: 'GUIDE.CLIENTS_VIEW_TITLE',
        descriptionKey: 'GUIDE.CLIENTS_VIEW_DESC',
      },
      {
        titleKey: 'GUIDE.CLIENTS_VIEW_TABS_TITLE',
        descriptionKey: 'GUIDE.CLIENTS_VIEW_TABS_DESC',
        targetSelector: TAB_GROUP_SELECTOR,
      },
      {
        titleKey: 'GUIDE.CLIENTS_VIEW_ACTIONS_TITLE',
        descriptionKey: 'GUIDE.CLIENTS_VIEW_ACTIONS_DESC',
        targetSelector: ACTIONS_AREA_SELECTOR,
      },
    ],
    loans: [
      {
        titleKey: 'GUIDE.LOANS_TITLE',
        descriptionKey: 'GUIDE.LOANS_DESC',
      },
      {
        titleKey: 'GUIDE.LOANS_FILTER_TITLE',
        descriptionKey: 'GUIDE.LOANS_FILTER_DESC',
        targetSelector: '.filter-row',
      },
    ],
    'loans-view': [
      {
        titleKey: 'GUIDE.LOANS_VIEW_TITLE',
        descriptionKey: 'GUIDE.LOANS_VIEW_DESC',
      },
      {
        titleKey: 'GUIDE.LOANS_VIEW_TABS_TITLE',
        descriptionKey: 'GUIDE.LOANS_VIEW_TABS_DESC',
        targetSelector: TAB_GROUP_SELECTOR,
      },
      {
        titleKey: 'GUIDE.LOANS_VIEW_ACTIONS_TITLE',
        descriptionKey: 'GUIDE.LOANS_VIEW_ACTIONS_DESC',
        targetSelector: ACTIONS_AREA_SELECTOR,
      },
    ],
    groups: [
      {
        titleKey: 'GUIDE.GROUPS_TITLE',
        descriptionKey: 'GUIDE.GROUPS_DESC',
      },
      {
        titleKey: 'GUIDE.GROUPS_CREATE_TITLE',
        descriptionKey: 'GUIDE.GROUPS_CREATE_DESC',
        targetSelector: HEADER_ACTIONS_SELECTOR,
      },
    ],
    'groups-view': [
      {
        titleKey: 'GUIDE.GROUPS_VIEW_TITLE',
        descriptionKey: 'GUIDE.GROUPS_VIEW_DESC',
      },
      {
        titleKey: 'GUIDE.GROUPS_VIEW_TABS_TITLE',
        descriptionKey: 'GUIDE.GROUPS_VIEW_TABS_DESC',
        targetSelector: TAB_GROUP_SELECTOR,
      },
    ],
    centers: [
      {
        titleKey: 'GUIDE.CENTERS_TITLE',
        descriptionKey: 'GUIDE.CENTERS_DESC',
      },
      {
        titleKey: 'GUIDE.CENTERS_CREATE_TITLE',
        descriptionKey: 'GUIDE.CENTERS_CREATE_DESC',
        targetSelector: HEADER_ACTIONS_SELECTOR,
      },
    ],
    savings: [
      {
        titleKey: 'GUIDE.SAVINGS_TITLE',
        descriptionKey: 'GUIDE.SAVINGS_DESC',
      },
      {
        titleKey: 'GUIDE.SAVINGS_SEARCH_TITLE',
        descriptionKey: 'GUIDE.SAVINGS_SEARCH_DESC',
        targetSelector: SEARCH_FILTER_SELECTOR,
      },
      {
        titleKey: 'GUIDE.SAVINGS_CREATE_TITLE',
        descriptionKey: 'GUIDE.SAVINGS_CREATE_DESC',
        targetSelector: HEADER_ACTIONS_SELECTOR,
      },
    ],
    'savings-view': [
      {
        titleKey: 'GUIDE.SAVINGS_VIEW_TITLE',
        descriptionKey: 'GUIDE.SAVINGS_VIEW_DESC',
      },
      {
        titleKey: 'GUIDE.SAVINGS_VIEW_TABS_TITLE',
        descriptionKey: 'GUIDE.SAVINGS_VIEW_TABS_DESC',
        targetSelector: TAB_GROUP_SELECTOR,
      },
      {
        titleKey: 'GUIDE.SAVINGS_VIEW_ACTIONS_TITLE',
        descriptionKey: 'GUIDE.SAVINGS_VIEW_ACTIONS_DESC',
        targetSelector: ACTIONS_AREA_SELECTOR,
      },
    ],
    shares: [
      {
        titleKey: 'GUIDE.SHARES_TITLE',
        descriptionKey: 'GUIDE.SHARES_DESC',
      },
      {
        titleKey: 'GUIDE.SHARES_CREATE_TITLE',
        descriptionKey: 'GUIDE.SHARES_CREATE_DESC',
        targetSelector: HEADER_ACTIONS_SELECTOR,
      },
    ],
    'shares-create': [
      {
        titleKey: 'GUIDE.SHARES_CREATE_FORM_TITLE',
        descriptionKey: 'GUIDE.SHARES_CREATE_FORM_DESC',
      },
      {
        titleKey: 'GUIDE.SHARES_PREREQ_TITLE',
        descriptionKey: 'GUIDE.SHARES_PREREQ_DESC',
        targetSelector: '.info-banner',
      },
      {
        titleKey: 'GUIDE.SHARES_CLIENT_TITLE',
        descriptionKey: 'GUIDE.SHARES_CLIENT_DESC',
        targetSelector: 'app-client-search',
      },
      {
        titleKey: 'GUIDE.SHARES_PRODUCT_TITLE',
        descriptionKey: 'GUIDE.SHARES_PRODUCT_DESC',
        // `mat-select` in a codebase with no Angular Material in it. The form uses
        // `ion-select`, so this and the step below pointed at nothing.
        targetSelector: 'ion-select[name="productId"]',
      },
      {
        titleKey: 'GUIDE.SHARES_SAVINGS_TITLE',
        descriptionKey: 'GUIDE.SHARES_SAVINGS_DESC',
        targetSelector: 'ion-select[name="savingsAccountId"]',
      },
    ],
    products: [
      {
        titleKey: 'GUIDE.PRODUCTS_TITLE',
        descriptionKey: 'GUIDE.PRODUCTS_DESC',
      },
    ],
    accounting: [
      {
        titleKey: 'GUIDE.ACCOUNTING_TITLE',
        descriptionKey: 'GUIDE.ACCOUNTING_DESC',
      },
    ],
    reporting: [
      {
        titleKey: 'GUIDE.REPORTING_TITLE',
        descriptionKey: 'GUIDE.REPORTING_DESC',
      },
    ],
    organization: [
      {
        titleKey: 'GUIDE.ORGANIZATION_TITLE',
        descriptionKey: 'GUIDE.ORGANIZATION_DESC',
      },
    ],
    system: [
      {
        titleKey: 'GUIDE.SYSTEM_TITLE',
        descriptionKey: 'GUIDE.SYSTEM_DESC',
      },
    ],
  };

  /** The tour key a URL resolves to, without starting anything. */
  tourKeyFor(routeUrl: string): string {
    const path = routeUrl.split(/[?#]/, 1)[0];
    return ROUTE_TOURS.find((entry) => entry.match.test(path))?.key ?? COMPOSED_TOUR_KEY;
  }

  /**
   * Opens the tour for `routeUrl`.
   *
   * A screen with hand-written copy gets it. Everything else gets a tour composed from what
   * that screen actually has on it — named by its own route title, and carrying a step per
   * control that is present. So every screen has a dedicated tour, and none of them describes
   * something that is not there.
   */
  startTour(routeUrl: string, screen?: ScreenContext): void {
    const key = this.tourKeyFor(routeUrl);
    const written = this.tours[key];
    const steps = written ? this.withStructure(written, screen) : this.composeTour(screen);
    if (steps.length === 0) return;

    this.activeTourKey.set(key);
    this.activeSteps.set(steps);
    this.currentStepIndex.set(0);
    this.isPlaying.set(true);
  }

  /**
   * Appends the detected structural steps to a tour that is only prose.
   *
   * The section landing pages — Products, Accounting, Reports, Organization, System — have
   * copy worth keeping but nothing to point at, so on their own they are a one-card tour that
   * says a paragraph and stops. A tour that already points at something is left alone: its
   * author chose what to show and in what order.
   */
  private withStructure(written: TourStep[], screen?: ScreenContext): TourStep[] {
    if (written.some((step) => step.targetSelector)) return written;
    const structural = this.structuralSteps(screen);
    return [...written, ...(structural.length > 0 ? structural : this.orientationSteps())];
  }

  /** The steps for the controls this screen actually has, in reading order. */
  private structuralSteps(screen?: ScreenContext): TourStep[] {
    return screen ? COMPOSED_STEPS.filter((step) => screen.has(step.targetSelector as string)) : [];
  }

  /** The tour a screen with no hand-written copy gets. See {@link startTour}. */
  composeTour(screen?: ScreenContext): TourStep[] {
    const intro: TourStep = {
      titleKey: screen?.titleKey ?? 'GUIDE.SCREEN_TITLE',
      descriptionKey: 'GUIDE.SCREEN_DESC',
    };

    const structural = this.structuralSteps(screen);

    return [intro, ...(structural.length > 0 ? structural : this.orientationSteps())];
  }

  /**
   * How to get somewhere else, for a screen with nothing of its own to point at.
   *
   * Not a consolation prize: `/accounting`, `/organization` and `/system` currently render an
   * empty `main` — they are parent routes with a title and no landing component — so this is
   * the only thing a tour there can honestly say.
   */
  private orientationSteps(): TourStep[] {
    return this.tours[SHELL_TOUR_KEY].slice(1);
  }

  nextStep(): void {
    if (this.currentStepIndex() < this.activeSteps().length - 1) {
      this.currentStepIndex.update((i) => i + 1);
    } else {
      this.endTour();
    }
  }

  previousStep(): void {
    if (this.currentStepIndex() > 0) {
      this.currentStepIndex.update((i) => i - 1);
    }
  }

  endTour(): void {
    this.isPlaying.set(false);
    this.activeSteps.set([]);
    this.activeTourKey.set(null);
    this.currentStepIndex.set(0);
  }
}
