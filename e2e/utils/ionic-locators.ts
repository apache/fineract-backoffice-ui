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
 * Locators for Ionic overlays, whose accessibility shape is not what the markup
 * suggests. Both of these cost real debugging time, so they live here once
 * rather than being re-derived per spec.
 */

import { expect, Locator, Page } from '@playwright/test';

/**
 * Selects a tab in an ion-segment tab strip.
 *
 * Entity views have more tabs than fit (loan-view has 11), so the strip scrolls.
 * Ionic scrolls the checked button into view itself, which competes with
 * Playwright's own scroll-then-click and can leave a plain `.click()` retrying
 * until it times out. Scroll first, then force past the stability check — and
 * assert aria-selected afterwards, so a click that silently failed to register
 * still fails the test rather than passing quietly.
 */
export async function selectTab(page: Page, name: string | RegExp): Promise<void> {
  const tab = page.getByRole('tab', { name });
  await tab.scrollIntoViewIfNeeded();
  await tab.click({ force: true });
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

/**
 * An entry in a popover menu.
 *
 * Menus are an ion-popover of `ion-item button` rows. Despite the `button`
 * attribute those expose role="listitem" — not "button", and not "menuitem" —
 * so match on the element and its text rather than a role. Scoping to the
 * popover also stops the page's own controls matching the same name.
 */
export function menuItem(page: Page, name: string | RegExp): Locator {
  return page.locator('ion-popover').locator('ion-item').filter({ hasText: name });
}

/**
 * The confirm modal rendered by DialogService.confirm().
 *
 * Scoped by its component rather than by `ion-modal` alone: any date-picker
 * field on the page keeps a second, hidden ion-modal mounted
 * ([keepContentsMounted]), so a bare `ion-modal` locator resolves to two
 * elements and trips strict mode.
 *
 * Note the modal's content sits behind a shadow boundary that a chained
 * getByRole() does not reach — assert on text or on plain element locators.
 */
export function confirmDialog(page: Page): Locator {
  return page.locator('ion-modal').filter({ has: page.locator('app-confirm-dialog') });
}

/** A modal hosting a specific component, e.g. 'app-transaction-detail-dialog'. */
export function modalFor(page: Page, componentSelector: string): Locator {
  return page.locator('ion-modal').filter({ has: page.locator(componentSelector) });
}

/**
 * An ion-select, addressed by the label shown above it.
 *
 * `getByRole('combobox', { name })` does not work and never will: ion-select
 * renders as a `button` with `aria-haspopup="dialog"`, and Ionic folds the
 * control's aria-label together with the current value, so the accessible name
 * reads "Office, Head Office" rather than "Office".
 *
 * Returns the ion-select host element rather than the shadow button, so
 * `toHaveText()`, `toBeDisabled()` and `.click()` all behave as expected.
 */
export function ionSelect(page: Page, label: string): Locator {
  return page
    .locator('ion-item')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('ion-select');
}

/**
 * Whether an ion-select is disabled.
 *
 * `expect(ionSelect(...)).toBeDisabled()` does not work and looks like a product bug when it
 * fails: the disabled state lives on the button inside the component's shadow root, so the host
 * element reads as "enabled" while the control is both visibly and functionally disabled. The
 * host does carry the state as a property, which is what this reads.
 */
export async function isIonSelectDisabled(page: Page, label: string): Promise<boolean> {
  return ionSelect(page, label).evaluate(
    (element: HTMLElement & { disabled?: boolean }) => element.disabled === true,
  );
}

/**
 * The value currently selected in an ion-select, or null when nothing is.
 *
 * Do not assert a selection with `toContainText()`: the options are light-DOM `<ion-select-option>`
 * children, so the host's text is every option label concatenated — " Product A  Product B  All " —
 * and a `not.toContainText()` on a still-listed option can never pass. The selection lives in the
 * host's `value` property.
 */
export async function ionSelectValue(page: Page, label: string): Promise<unknown> {
  return ionSelect(page, label).evaluate(
    (element: HTMLElement & { value?: unknown }) => element.value ?? null,
  );
}
