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
 * Reports by default; fails only under ENFORCE_CD_ERRORS=1. The interval check samples at
 * arbitrary moments, so it also catches states that are briefly inconsistent and then settle —
 * reactive form validity is the one still outstanding, where `[attr.aria-invalid]` reads a
 * control whose status changed without a change-detection pass. Those surface on the sign-in
 * every test performs in beforeEach and land on whichever test happened to be running, so
 * enforcing today costs between zero and seventeen unrelated failures depending on timing.
 *
 * The value is in the reporting: this is what identified the six empty-dropdown components,
 * all now fixed. Flip the default once the remaining sources are gone.
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

const ENFORCE = process.env.ENFORCE_CD_ERRORS === '1';

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

type ChangeDetectionFixtures = {
  /** Change-detection errors seen on the page during this test. */
  changeDetectionErrors: string[];
  /** Auto-fixture: records the errors above, then asserts none were seen. */
  failOnChangeDetectionErrors: void;
};

export const test = base.extend<ChangeDetectionFixtures>({
  changeDetectionErrors: async ({}, use) => {
    await use([]);
  },

  failOnChangeDetectionErrors: [
    async ({ page, changeDetectionErrors }, use) => {
      const record = (text: string) => {
        if (CHANGE_DETECTION_ERROR_CODES.some((code) => text.includes(code))) {
          changeDetectionErrors.push(text);
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

      // Repeats of one broken binding are the norm once the interval check is running,
      // so work from distinct messages rather than several hundred copies.
      const distinct = [...new Set(changeDetectionErrors)];
      const components = [...new Set(distinct.map(componentOf))];
      const summary = distinct.map((message) => `  - ${message}`).join('\n');

      if (!ENFORCE) {
        console.warn(
          `[change-detection] ${components.join(', ')} on ${page.url()}\n${summary}\n` +
            'A field assigned from a subscribe callback is the usual cause; ' +
            'scripts/audit-async-state.mjs lists them, scripts/codemod-signals.mjs converts them.',
        );
        return;
      }

      expect(
        components,
        `${components.join(', ')} changed state without notifying Angular (${page.url()}).\n` +
          summary,
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
