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

import { Page, expect } from '@playwright/test';

import { ionSelect } from './ionic-locators';

/**
 * Opens an ion-select and picks an option by name, retrying the open if the option list
 * hasn't rendered yet (async template loads) or a stray overlay from a prior interaction
 * is still on screen.
 *
 * Synchronises on `ion-alert`/`ion-popover` rather than Material's `.cdk-overlay-backdrop`:
 * ion-select presents its options in one of those, and they mount and unmount on their own
 * animation timing.
 */
export async function selectOption(
  page: Page,
  comboboxName: string,
  optionName: string,
): Promise<void> {
  // Scoped by its label rather than by role: ion-select renders as a button, and its
  // accessible name folds in the current value ("Office, Head Office"). See ionSelect().
  const combobox = ionSelect(page, comboboxName);
  const overlay = page.locator('ion-alert, ion-popover, ion-action-sheet');
  // Ionic renders select options as radios inside the overlay, not as role="option".
  const option = overlay.getByRole('radio', { name: optionName, exact: true });

  await combobox.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);
    await combobox.click();
    try {
      await expect(option).toBeVisible({ timeout: 8000 });
      break;
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  // A long list overflows the popover by thousands of pixels -- measured at 9,223px for the last
  // of 184 options -- and Playwright's own scroll cannot reach it, so the click would retry
  // "outside of the viewport" until its budget ran out. Scrolling has to be repeated rather than
  // done once: the popover's entrance animation, or a re-render of the options, puts the list
  // back to the top, which is why a single scroll held locally and not on CI.
  await expect
    .poll(
      () =>
        option.evaluate((element) => {
          element.scrollIntoView({ block: 'center' });
          const box = element.getBoundingClientRect();
          return box.top >= 0 && box.bottom <= window.innerHeight;
        }),
      { timeout: 10_000 },
    )
    .toBe(true);
  await option.click({ timeout: 15_000 });
  // The alert interface needs an explicit confirmation; the popover selects on click.
  const confirm = overlay.getByRole('button', { name: /^(ok|done)$/i });
  if (await confirm.count()) await confirm.first().click();
  await expect(overlay).toHaveCount(0);
}
