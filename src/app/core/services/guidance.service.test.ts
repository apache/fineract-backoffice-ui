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

import { TestBed } from '@angular/core/testing';
import { COMPOSED_TOUR_KEY, GuidanceService, SHELL_TOUR_KEY } from './guidance.service';
import en from '../../../assets/i18n/en.json';

describe('GuidanceService', () => {
  let service: GuidanceService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [GuidanceService] });
    service = TestBed.inject(GuidanceService);
  });

  /**
   * The defect this replaced: every unmatched route fell through to the *dashboard* tour, so
   * pressing Guide on Accounting or Reports opened a tour whose first line welcomed you to a
   * dashboard you were not looking at. A fallback can only describe what is true everywhere.
   */
  describe('choosing a tour for a route', () => {
    it.each([
      ['/dashboard', 'dashboard'],
      ['/clients', 'clients'],
      ['/clients/view/42', 'clients-view'],
      ['/loans', 'loans'],
      ['/loans/view/7', 'loans-view'],
      ['/groups/view/3', 'groups-view'],
      ['/products/savings-accounts', 'savings'],
      ['/products/savings-accounts/view/9', 'savings-view'],
      ['/products/shares', 'shares'],
      ['/products/shares/create', 'shares-create'],
      ['/accounting/chart-of-accounts', 'accounting'],
    ])('sends %s to the %s tour', (url, expected) => {
      expect(service.tourKeyFor(url)).toBe(expected);
    });

    it("composes a tour for a screen with no hand-written one, rather than reusing another screen's", () => {
      // This is the defect: the fallback used to be the *dashboard* tour, so every one of
      // these opened with "welcome to your dashboard" over a screen that was not one.
      for (const url of ['/tellers', '/security/audit-trails', '/settings', '/profile']) {
        expect(service.tourKeyFor(url)).toBe(COMPOSED_TOUR_KEY);
      }
    });

    it('matches on path segments, not on substrings', () => {
      // `url.includes('/loans')` gave the loans tour to anything with those characters in it,
      // wherever they fell. These belong to the section they are actually under.
      expect(service.tourKeyFor('/organization/loan-provisioning')).toBe('organization');
      expect(service.tourKeyFor('/products/loan')).toBe('products');
      expect(service.tourKeyFor('/system/loan-products-datatable')).toBe('system');
    });

    it('ignores query and fragment', () => {
      expect(service.tourKeyFor('/clients?office=1')).toBe('clients');
      expect(service.tourKeyFor('/clients/view/42#accounts')).toBe('clients-view');
    });
  });

  describe('playing a tour', () => {
    it('starts on the first step and reports which tour is running', () => {
      service.startTour('/clients');

      expect(service.isPlaying()).toBe(true);
      expect(service.activeTourKey()).toBe('clients');
      expect(service.currentStepIndex()).toBe(0);
      expect(service.currentStep()?.titleKey).toBe('GUIDE.CLIENTS_TITLE');
      expect(service.isLastStep()).toBe(false);
    });

    it('walks forward and back without running off either end', () => {
      service.startTour('/clients');
      const total = service.activeSteps().length;

      service.previousStep();
      expect(service.currentStepIndex()).toBe(0);

      service
        .activeSteps()
        .slice(1)
        .forEach(() => service.nextStep());
      expect(service.currentStepIndex()).toBe(total - 1);
      expect(service.isLastStep()).toBe(true);
    });

    it('ends on the last step, which is what Finish does', () => {
      service.startTour('/loans');
      service.activeSteps().forEach(() => service.nextStep());

      expect(service.isPlaying()).toBe(false);
      expect(service.activeSteps()).toEqual([]);
      expect(service.activeTourKey()).toBeNull();
      expect(service.currentStep()).toBeNull();
    });
  });

  /**
   * Three selectors in this table pointed at nothing at all: `button[headerActions]` (the
   * attribute sits on an `ion-button`, and Ionic's own native button is in a shadow root that
   * never carries it) and two `mat-select[...]` in an application with no Angular Material.
   * A step whose target cannot resolve shows its copy and highlights nothing, silently.
   */
  /**
   * Every screen gets a tour of its own. Where there is no hand-written copy the tour is built
   * from the screen's own route title plus the controls that are actually on it, so it can
   * never describe something that is not there.
   */
  describe('composing a tour for a screen', () => {
    const screen = (titleKey: string, present: string[]) => ({
      titleKey,
      has: (selector: string) => present.includes(selector),
    });

    it('names the screen with its own route title', () => {
      const steps = service.composeTour(screen('nav.tellers', []));

      expect(steps[0].titleKey).toBe('nav.tellers');
      expect(steps[0].targetSelector).toBeUndefined();
    });

    it('offers a step only for a control the screen actually has', () => {
      const steps = service.composeTour(screen('nav.tellers', ['app-search-filter', '.paginator']));
      const targets = steps.map((s) => s.targetSelector);

      expect(targets).toContain('app-search-filter');
      expect(targets).toContain('.paginator');
      expect(targets).not.toContain('.tab-group');
      expect(targets).not.toContain('[headerActions]');
    });

    it('reads in a fixed order, whatever order the probe answers in', () => {
      const all = [
        'app-search-filter',
        '.filter-row',
        '.tab-group',
        '.actions-area',
        '[headerActions]',
        '.paginator',
        'form',
      ];
      // Built by hand: `toReversed()` is not in the test tsconfig's lib, and `reverse()` is
      // refused by the lint rules for mutating its receiver.
      const backwards: string[] = [];
      for (const selector of all) backwards.unshift(selector);

      const forward = service.composeTour(screen('nav.x', all)).map((s) => s.targetSelector);
      const reversed = service.composeTour(screen('nav.x', backwards)).map((s) => s.targetSelector);

      expect(backwards[0]).toBe(all.at(-1));
      expect(forward).toEqual(reversed);
    });

    it('falls back to orientation when the screen has nothing to point at', () => {
      const steps = service.composeTour(screen('nav.reportViewer', []));

      expect(steps.length).toBeGreaterThan(1);
      expect(steps.slice(1).every((s) => s.scope === 'shell')).toBe(true);
      expect(service.tourKeyFor('/dashboard')).not.toBe(SHELL_TOUR_KEY);
    });

    it('starts the composed tour when a route has no hand-written one', () => {
      service.startTour('/tellers', screen('nav.tellers', ['.paginator']));

      expect(service.isPlaying()).toBe(true);
      expect(service.activeTourKey()).toBe(COMPOSED_TOUR_KEY);
      expect(service.currentStep()?.titleKey).toBe('nav.tellers');
    });

    it('gives a prose-only tour on a bare screen the orientation steps', () => {
      // `/accounting`, `/organization` and `/system` render an empty `main`, so there is
      // nothing on the screen to point at and nothing else honest to say.
      service.startTour('/accounting', screen('nav.accounting', []));

      expect(service.activeSteps().length).toBeGreaterThan(1);
      expect(
        service
          .activeSteps()
          .slice(1)
          .every((s) => s.scope === 'shell'),
      ).toBe(true);
    });

    it('gives a prose-only tour the structure of the screen it is on', () => {
      // Products, Accounting, Reports, Organization and System have copy worth keeping and
      // nothing to point at. On their own they are one card and a full stop.
      service.startTour('/accounting', screen('nav.accounting', ['.paginator', 'form']));
      const targets = service.activeSteps().map((s) => s.targetSelector);

      expect(service.activeTourKey()).toBe('accounting');
      expect(service.activeSteps()[0].titleKey).toBe('GUIDE.ACCOUNTING_TITLE');
      expect(targets).toContain('.paginator');
      expect(targets).toContain('form');
    });

    it('leaves a tour that already points at something alone', () => {
      // Its author chose what to show and in what order; appending to it would reorder nothing
      // but would still change a deliberate sequence.
      service.startTour('/dashboard', screen('nav.dashboard', ['.paginator', 'form']));

      expect(service.activeSteps().map((s) => s.targetSelector)).toEqual([
        undefined,
        '.status-list',
      ]);
    });

    it('prefers hand-written copy where a screen has it', () => {
      service.startTour('/dashboard', screen('nav.dashboard', ['.paginator']));

      expect(service.activeTourKey()).toBe('dashboard');
      expect(service.currentStep()?.titleKey).toBe('GUIDE.DASHBOARD_WELCOME_TITLE');
    });
  });

  describe('every step target', () => {
    const allSteps = () =>
      [
        '/dashboard',
        '/clients',
        '/clients/view/1',
        '/loans',
        '/loans/view/1',
        '/groups',
        '/groups/view/1',
        '/centers',
        '/products',
        '/products/savings-accounts',
        '/products/savings-accounts/view/1',
        '/products/shares',
        '/products/shares/create',
        '/accounting',
        '/reporting',
        '/organization',
        '/system',
        '/nothing-in-particular',
      ].flatMap((url) => {
        service.startTour(url);
        const steps = service.activeSteps();
        service.endTour();
        return steps;
      });

    it('names no framework this application does not use', () => {
      const targets = allSteps()
        .map((s) => s.targetSelector)
        .filter((s): s is string => !!s);

      expect(targets.length).toBeGreaterThan(0);
      expect(targets.filter((t) => t.startsWith('mat-'))).toEqual([]);
      // The attribute is projected onto an `ion-button`, so a native-element selector is wrong.
      expect(targets.filter((t) => t === 'button[headerActions]')).toEqual([]);
    });

    it('is a selector the browser will accept', () => {
      for (const step of allSteps()) {
        if (!step.targetSelector) continue;
        expect(() => document.querySelector(step.targetSelector as string)).not.toThrow();
      }
    });

    it('carries copy keys for both halves', () => {
      for (const step of allSteps()) {
        expect(step.titleKey).toMatch(/^GUIDE\./);
        expect(step.descriptionKey).toMatch(/^GUIDE\./);
      }
    });

    /**
     * `check-translations` only sees keys written as `'KEY' | translate` or
     * `translate.instant('KEY')`. These are bare string literals in a table, so nothing else
     * would notice one going missing — and a missing key renders as the key itself, on screen,
     * to the user.
     */
    it('names a key that exists in the English catalogue', () => {
      const guide = (en as unknown as { GUIDE: Record<string, string> }).GUIDE;
      const composed = service.composeTour({
        titleKey: 'nav.dashboard',
        has: () => true,
      });

      for (const step of [...allSteps(), ...composed.slice(1)]) {
        for (const key of [step.titleKey, step.descriptionKey]) {
          expect(guide[key.replace('GUIDE.', '')], `missing ${key}`).toBeDefined();
        }
      }
    });
  });
});
