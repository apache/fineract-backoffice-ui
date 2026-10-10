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

/**
 * The shared Playwright `test` for this suite. Specs import from here rather than
 * from '@playwright/test' so that every test carries the change-detection check below.
 *
 * Angular's `checkNoChanges` pass runs a second change-detection cycle and compares it
 * against the first; a binding whose value differs between the two changed without ever
 * notifying Angular, and is reported as NG0100. `src/app/app.config.ts` enables that pass
 * exhaustively on an interval in dev builds, which is what the e2e suite runs against.
 *
 * That is precisely the failure mode `scripts/audit-async-state.mjs` counts: a plain field
 * assigned from an HTTP callback holds the right value while the DOM shows the old one.
 * Asserting on rendered output cannot catch it in general — an empty table and a broken
 * table look identical — so the console is the signal.
 *
 * Reports by default; fails only under ENFORCE_CD_ERRORS=1.
 *
 * ## The control-status shape (resolved — see issue #572)
 *
 * One recurring NG0100 shape names `ng-untouched`/`ng-touched`/`ng-pristine`/`ng-dirty`/
 * `ng-valid`/`ng-invalid`/`ng-pending` at `NgControlStatus_HostBindings` or
 * `NgControlStatusGroup_HostBindings`. It is **not** specific to reactive forms as previously
 * guessed here — `NgControlStatus`'s selector (`[formControlName],[ngModel],[formControl]`)
 * attaches to template-driven controls too, which is why `gl-account-form` (`[(ngModel)]`,
 * `FormsModule` only) reports it.
 *
 * It is a sampling artifact of `interval`, not a component defect. `exhaustiveCheckNoChanges-
 * Interval` (`@angular/core`) schedules its sweep with `ngZone.runOutsideAngular(() =>
 * setTimeout(...))`, entirely decoupled from the zone-driven render scheduler apart from a
 * best-effort `scheduler.pendingRenderTaskId || scheduler.runningTick` guard. A control's
 * touched/dirty flag can flip synchronously inside an event handler slightly before the
 * scheduler has registered the pending render task that will reconcile it, and if the interval's
 * timer lands in that window it diffs a live getter against a stale render. The *ordinary*
 * checkNoChanges pass that Angular always pairs with `detectChanges()` inside one tick
 * (`ApplicationRef.tickImpl`, unconditional in dev mode, no `interval` involved) cannot observe
 * this: there is no time gap within a single tick for the value to drift. Only this separate,
 * zone-decoupled sweep can — confirmed by reading both call sites in
 * `node_modules/@angular/core/fesm2022/core.mjs` and `_debug_node-chunk.mjs`, and by failing to
 * reproduce it deterministically even under 40 rapid fill/select cycles against `gl-account-form`
 * (`e2e/_repro-572.spec.ts`, not committed). The original report's bad URL attribution (the
 * fixture printed the test's *final* `page.url()`, not the URL active when each error fired)
 * reinforces this: `_GLAccountFormComponent` and `_FinancialActivityMappingFormComponent` were
 * reported under a `/tellers/…` URL because `teller-cash-management.spec.ts` visits both forms
 * earlier in one long journey and only lands on that URL at the point the fixture flushed.
 *
 * Excluded from `ENFORCE_CD_ERRORS` below accordingly (`CONTROL_STATUS_ARTIFACT`), but still
 * reported — narrowing what counts as a failure, not what gets printed, is what makes enforcing
 * the other shape viable.
 *
 * The value is in the reporting: this is what identified the six empty-dropdown components,
 * all now fixed. Flipping the default also needs the two-way-binding shape from the companion
 * issue fixed (out of scope here); this file only removes the control-status shape as a blocker.
 */

import { test as base, expect } from '@playwright/test';

/**
 * NG0100 is ExpressionChangedAfterItHasBeenCheckedError — the checkNoChanges failure.
 *
 * Deliberately narrow. Broadening this to every Angular runtime error would fold
 * unrelated pre-existing noise into a signal that is meant to mean one thing, and a
 * check that fails for many reasons gets muted rather than fixed. Hydration codes are
 * excluded on purpose: this app has no SSR.
 */
const CHANGE_DETECTION_ERROR_CODES = ['NG0100'];

/**
 * `NgControlStatus`/`NgControlStatusGroup`'s host-binding class names (`@angular/forms`,
 * `forms.mjs`). An NG0100 naming one of these is the interval-sampling artifact described in
 * the comment block above, not an application defect — see there for how that was established.
 * Reserved Angular-forms names, so matching on the exact propName cannot collide with an
 * application template binding.
 */
const CONTROL_STATUS_PROPS = [
  'ng-untouched',
  'ng-touched',
  'ng-pristine',
  'ng-dirty',
  'ng-valid',
  'ng-invalid',
  'ng-pending',
];
const CONTROL_STATUS_ARTIFACT = new RegExp(
  `Previous value for '(${CONTROL_STATUS_PROPS.join('|')})'`,
);

const ENFORCE = process.env.ENFORCE_CD_ERRORS === '1';

/**
 * The prefix `ReportingMissingTranslationHandler` writes, restated rather than imported.
 *
 * `tsconfig.e2e.json` compiles `e2e/` alone; importing the constant from `src/` would pull the
 * application's Angular sources into the Playwright program to carry one string. The same
 * argument keeps `NG0100` above a literal. A change to either side breaks this, loudly — the
 * gate stops reporting — so the handler names this file in its own comment.
 */
const MISSING_TRANSLATION_PREFIX = '[i18n-miss]';

/**
 * Unlike the change-detection check above, this one enforces by default. That check reports
 * rather than fails because it inherited a backlog; this one has none to inherit — an
 * unresolved key is a defect on the branch that introduced it. `ALLOW_I18N_MISSES=1` downgrades
 * it to a warning for a local run against a half-translated feature.
 */
const ALLOW_MISSES = process.env.ALLOW_I18N_MISSES === '1';

/**
 * Pulls the component out of "Expression location: _LoginComponent component".
 *
 * Angular does not always include one — the message shape differs between a binding it can
 * attribute and a view it cannot — so unattributed errors group under a single bucket rather
 * than being silently dropped.
 */
function componentOf(message: string): string {
  return /Expression location: (\w+) component/.exec(message)?.[1] ?? '<unattributed>';
}

/** An NG0100 as observed, tagged with the URL active at the moment it fired. */
type ChangeDetectionError = { text: string; url: string };

type ChangeDetectionFixtures = {
  /** Change-detection errors seen on the page during this test. */
  changeDetectionErrors: ChangeDetectionError[];
  /** Auto-fixture: records the errors above, then asserts none were seen. */
  failOnChangeDetectionErrors: void;
  /** Translation keys that resolved to nothing while this test ran. */
  missingTranslations: string[];
  /** Auto-fixture: records the keys above, then asserts none were seen. */
  failOnMissingTranslations: void;
};

export const test = base.extend<ChangeDetectionFixtures>({
  changeDetectionErrors: async ({}, use) => {
    await use([]);
  },

  failOnChangeDetectionErrors: [
    async ({ page, changeDetectionErrors }, use) => {
      const record = (text: string) => {
        if (CHANGE_DETECTION_ERROR_CODES.some((code) => text.includes(code))) {
          // Tagged with page.url() as it fires, not read once when the fixture flushes below —
          // a multi-page journey test would otherwise blame every error on wherever it ended up.
          // See the comment block at the top of this file; this is the issue #572 fix.
          changeDetectionErrors.push({ text, url: page.url() });
        }
      };

      // Angular routes these through provideBrowserGlobalErrorListeners(), so they
      // arrive as console errors rather than as uncaught exceptions. 'pageerror' is
      // listened to as well because an interval-driven checkNoChanges throw has no
      // application frame to be caught in.
      page.on('console', (message) => {
        if (message.type() === 'error') {
          record(message.text());
        }
      });
      page.on('pageerror', (error) => record(error.message));

      await use();

      if (changeDetectionErrors.length === 0) {
        return;
      }

      // Repeats of one broken binding are the norm once the interval check is running, so work
      // from distinct (url, text) pairs rather than several hundred copies.
      const seen = new Set<string>();
      const distinct = changeDetectionErrors.filter((error) => {
        const key = `${error.url}\n${error.text}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const describe = (errors: ChangeDetectionError[]) =>
        errors.map((error) => `  - [${error.url}] ${error.text}`).join('\n');

      // The control-status shape is a verified sampling artifact (see top-of-file comment), not
      // a defect — reported for visibility but never part of what ENFORCE_CD_ERRORS checks.
      const artifacts = distinct.filter((error) => CONTROL_STATUS_ARTIFACT.test(error.text));
      const enforceable = distinct.filter((error) => !CONTROL_STATUS_ARTIFACT.test(error.text));

      if (artifacts.length > 0) {
        console.warn(
          `[change-detection] known interval-sampling artifact (issue #572), not enforced:\n` +
            describe(artifacts),
        );
      }

      if (enforceable.length === 0) {
        return;
      }

      const components = [...new Set(enforceable.map((error) => componentOf(error.text)))];

      if (!ENFORCE) {
        console.warn(
          `[change-detection] ${components.join(', ')}\n${describe(enforceable)}\n` +
            'A field assigned from a subscribe callback is the usual cause; ' +
            'scripts/audit-async-state.mjs lists them, scripts/codemod-signals.mjs converts them.',
        );
        return;
      }

      expect(
        components,
        `${components.join(', ')} changed state without notifying Angular.\n${describe(enforceable)}`,
      ).toEqual([]);
    },
    { auto: true },
  ],

  missingTranslations: async ({}, use) => {
    await use([]);
  },

  failOnMissingTranslations: [
    async ({ page, missingTranslations }, use) => {
      // The handler writes a warning, not an error, so this listens for the type the
      // change-detection fixture above deliberately ignores.
      page.on('console', (message) => {
        const text = message.text();
        if (message.type() === 'warning' && text.includes(MISSING_TRANSLATION_PREFIX)) {
          missingTranslations.push(text.slice(text.indexOf(MISSING_TRANSLATION_PREFIX)).trim());
        }
      });

      await use();

      if (missingTranslations.length === 0) {
        return;
      }

      // The handler already reports each key once per page load, but a test that reloads sees
      // the same key again from the new document.
      const keys = [...new Set(missingTranslations)].map((line) =>
        line.replace(`${MISSING_TRANSLATION_PREFIX} `, ''),
      );
      const summary = keys.map((key) => `  - ${key}`).join('\n');

      if (ALLOW_MISSES) {
        console.warn(`[i18n] unresolved keys on ${page.url()}\n${summary}`);
        return;
      }

      expect(
        keys,
        `${keys.length} translation key(s) rendered as their own name on ${page.url()}.\n` +
          `${summary}\n` +
          'A key assembled at runtime is the usual cause — check that every branch of it ' +
          'exists in src/assets/i18n/en.json. npm run i18n:check covers the literal ones.',
      ).toEqual([]);
    },
    { auto: true },
  ],
});

/**
 * A per-test budget that survives being filmed.
 *
 * Under `DEMO_RECORD=1` every Playwright action carries a deliberate pause (`slowMo`), so a flow
 * that fits comfortably at test speed takes several times longer. A test's own `test.setTimeout`
 * overrides both the project and the root config, so the scaling has to happen at the call site —
 * otherwise a recording is cut off mid-flow and the clip ends on a frozen screen.
 *
 * `full-demo.spec.ts` has done this by hand since it was the only paced spec; this is the same
 * idea, available to all of them.
 */
export function recordingTimeout(base: number): number {
  return process.env.DEMO_RECORD === '1' ? base * 5 : base;
}

export { expect } from '@playwright/test';
export type { Page, Locator, Route } from '@playwright/test';
