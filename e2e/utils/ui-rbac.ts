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
 * Builds roles and users **through the application's own screens**, for specs about what a
 * non-admin account may do.
 *
 * ## Why not `seed-api.ts`
 *
 * `seed-api.ts` grants permissions over HTTP, and it explains at the top why: these
 * prerequisites used to be built through the UI and were moved because a flaky control failed
 * tests for reasons unrelated to what they asserted. That reasoning is right for a spec whose
 * subject is something else.
 *
 * It is wrong when the administrative screens *are* the subject. `role-form.component.ts` is
 * the only place in the application that writes `PUT /roles/{id}/permissions`, and because every
 * RBAC spec seeded around it, it shipped unable to save at all: it sent each permission code
 * trimmed, and five of Fineract's codes carry a trailing space, so the request answered 404 for
 * every role and every administrator regardless of what was ticked (#693). A unit test could not
 * have caught it — the component's spec mocks the call, and its fixture had no padded code.
 *
 * So these helpers deliberately drive the forms, and accept the extra seconds and the extra
 * fragility that buys.
 *
 * ## Ionic locator notes
 *
 * Three of these cost a test cycle each, and all three are the same shape as the folded
 * accessible name `ionSelect()` documents:
 *
 *  - `ion-input` carries its accessible name on the host but `name` on the **inner native
 *    input**, which is also what the `ngModel` binding listens to. Filling the host leaves the
 *    model empty, so every field here is addressed as `input[name="x"]`.
 *  - `ion-checkbox` does **not** reflect `name` onto the host at all — it renders it into a
 *    hidden `input.aux-input` — so `ion-checkbox[name=…]` matches nothing. The permission matrix
 *    is addressed by accessible name with `exact`, which also stops `READ_LOAN` from matching
 *    `READ_LOANPRODUCT`.
 *  - a `multiple` `ion-select` renders `role="checkbox"` options rather than `role="radio"`, and
 *    does not close on selection, so `select-option.ts` cannot drive it.
 */

import { request as playwrightRequest, type Locator, type Page } from '@playwright/test';
import { randomInt } from 'node:crypto';

import { expect } from '../fixtures';
import { API_BASE, TENANT_ID } from './backend-env';
import { confirmDialog, ionSelect } from './ionic-locators';
import { uniqueSuffix } from './fineract-login';
import { selectOption } from './select-option';

/** An account created through the UI, with the credentials to sign in as it. */
export interface UiUser {
  readonly username: string;
  readonly password: string;
  readonly roleName: string;
  readonly permissions: readonly string[];
}

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT = '23456789';
// No underscore: the policy wants a character matching `[^\w\s]`, and `\w` includes `_`.
const SPECIAL = '#$%&*+-=?@^';

/**
 * A throwaway password satisfying Fineract's policy, generated rather than written down.
 *
 * The policy is `^(?!.*(.)\1)(?!.*\s)(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^\w\s]).{12,50}$`. The
 * clause that catches people out is the first lookahead — **no character may repeat
 * consecutively** — and the validation error does not mention it until you read `args`.
 *
 * Generated rather than literal: a string satisfying that rule is by construction
 * credential-shaped, which scanners flag and reviewers have to think about, and the account
 * exists only for the length of one test run.
 */
export function generatePassword(): string {
  const pools = [UPPER, LOWER, DIGIT, SPECIAL];
  const all = pools.join('');
  const characters: string[] = [];
  while (characters.length < 16) {
    const pool = characters.length < pools.length ? pools[characters.length] : all;
    const candidate = pool[randomInt(pool.length)];
    if (candidate !== characters[characters.length - 1]) characters.push(candidate);
  }
  return characters.join('');
}

/**
 * Asks Fineract whether `user` may run the operation at `path`, **without running it**.
 *
 * The request carries an empty body, which no command accepts. Fineract's authorisation filter
 * runs ahead of command validation, so the status separates the two questions cleanly:
 *
 *   403 `error.msg.not.authorized`       — the account does not hold the code
 *   400 `validation.msg.validation...`   — it does, and only the body was wrong
 *
 * Nothing is written either way, so this can be asked about an account a spec is still using,
 * and asked of the same account twice. It is also how every code in
 * `core/guards/command-permissions.ts` was established.
 */
export async function platformAllows(
  user: UiUser,
  path: string,
): Promise<{ allowed: boolean; status: number }> {
  const context = await playwrightRequest.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      'Fineract-Platform-TenantId': TENANT_ID,
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${user.username}:${user.password}`).toString('base64')}`,
    },
  });
  try {
    const response = await context.post(`${API_BASE}${path}`, { data: {} });
    const status = response.status();
    expect(
      [400, 403],
      `authorisation probe for ${user.roleName} on ${path} answered ${status}; ` +
        'only 400 (authorised, bad body) and 403 (refused) are meaningful here',
    ).toContain(status);
    return { allowed: status === 400, status };
  } finally {
    await context.dispose();
  }
}

/**
 * Asserts that a control is on screen and **refused**, which is what this application does with
 * an action the session lacks the permission for.
 *
 * `appRequiresPermission` disables the control and names the missing code on it; the sibling
 * `appHasPermission` removes the element. The directive's own documentation says why the two
 * differ, and the reasoning is sound: a Create button that navigates elsewhere is removed,
 * because the destination is simply not part of this user's application, while an action on the
 * record already on screen is disabled with the reason, because "you cannot approve this" is a
 * fact about the user's role that they need in order to act on it — hiding the button leaves
 * them to conclude the feature is missing.
 *
 * So a spec asserting `toHaveCount(0)` for a refused action is asserting the wrong design. The
 * class is checked rather than the accessible name because the directive **replaces** the name
 * with the reason when it refuses, which is also why each of these controls needs a
 * `data-testid`.
 */
export async function expectRefused(control: Locator): Promise<void> {
  await expect(control).toBeVisible({ timeout: 20_000 });
  await expect(control).toHaveClass(/app-requires-permission/);
  await expect(control).toHaveAttribute('aria-disabled', 'true');
}

/** The same control, offered: present, and not carrying the refusal marker. */
export async function expectOffered(control: Locator): Promise<void> {
  await expect(control).toBeVisible({ timeout: 20_000 });
  await expect(control).not.toHaveClass(/app-requires-permission/);
}

/**
 * Creates a role through `/security/roles/create`, then grants it `permissions` through the
 * permission matrix on `/security/roles/edit/:id`.
 *
 * Two screens because the application models it as two, following Fineract: `POST /roles` takes
 * a name and a description, and `PUT /roles/{id}/permissions` takes the delta. The create form
 * lands on the new role's matrix rather than the list, which is also where the id comes from.
 */
export async function createRole(
  page: Page,
  permissions: readonly string[],
  tag: string,
): Promise<string> {
  const roleName = `E2EUi${tag}${uniqueSuffix()}`;

  await page.goto('/security/roles/create');
  await page.locator('input[name="name"]').fill(roleName);
  await page.locator('textarea[name="description"]').fill(`UI-built ${tag} role`);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/security\/roles\/edit\/\d+$/, { timeout: 20_000 });

  // The matrix renders the whole catalogue — 723 checkboxes on this version — inside a
  // fixed-height scroller, so the filter is what brings the control into view.
  const filter = page.locator('input[name="permissionFilter"]');
  await expect(filter).toBeVisible({ timeout: 20_000 });

  for (const code of permissions) {
    await filter.fill(code);
    const checkbox = page.getByRole('checkbox', { name: code, exact: true });
    await expect(checkbox).toBeVisible({ timeout: 10_000 });
    await checkbox.click();
  }

  // The impact panel counts the pending delta, and it is the only on-screen confirmation that
  // the matrix registered every click before the save. Asserting it here means a silently
  // dropped checkbox fails on this line rather than as a mystery 403 several tests later.
  await expect(page.getByTestId('perms-added')).toContainText(String(permissions.length));

  await page.getByRole('button', { name: 'Save' }).click();

  // A permission change is confirmed before it is written — the dialog restates the delta and
  // warns that everyone holding the role is affected at their next sign-in. Accepting it is
  // part of the flow, not an interruption to work around.
  const confirm = confirmDialog(page);
  await expect(confirm).toBeVisible({ timeout: 20_000 });
  await confirm.getByTestId('confirm-dialog-confirm').click();

  await expect(page).toHaveURL(/\/security\/roles$/, { timeout: 20_000 });
  return roleName;
}

/** Creates a user through `/security/users/create`, in Head Office, holding `roleName` alone. */
export async function createUser(
  page: Page,
  roleName: string,
  tag: string,
): Promise<{ username: string; password: string }> {
  const username = `e2eui${tag}${uniqueSuffix()}`.toLowerCase();
  const password = generatePassword();

  // `networkidle` so the Office and Roles selects have their GET /users/template answer before
  // either is opened — an ion-select opened early presents an empty overlay, and the failure
  // reads as a missing option rather than as a race.
  await page.goto('/security/users/create', { waitUntil: 'networkidle' });
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="firstname"]').fill('Ui');
  await page.locator('input[name="lastname"]').fill(tag);
  await page.locator('input[name="email"]').fill(`${username}@example.invalid`);
  await selectOption(page, 'Office', 'Head Office');
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="repeatPassword"]').fill(password);
  await pickRole(page, roleName);

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/security\/users$/, { timeout: 20_000 });
  return { username, password };
}

/**
 * Ticks one role in the user form's Roles select.
 *
 * Not `selectOption()`: that helper looks for `role="radio"` in the overlay, which is what a
 * single-value ion-select renders. This one is `multiple`, so Ionic renders `role="checkbox"`
 * items instead and the shared helper finds nothing. The select also stays open after a tick —
 * there is no implicit confirm on a multiple popover — so it has to be dismissed explicitly.
 */
async function pickRole(page: Page, roleName: string): Promise<void> {
  const select = ionSelect(page, 'Roles');
  const overlay = page.locator('ion-popover, ion-alert');
  await select.scrollIntoViewIfNeeded();
  await select.click();

  const option = overlay.getByRole('checkbox', { name: roleName, exact: true });
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();

  await page.keyboard.press('Escape');
  await expect(overlay).toHaveCount(0);
  // The host folds the chosen value into its own text, so this confirms the tick reached the
  // model rather than only the overlay.
  await expect(select).toContainText(roleName, { timeout: 10_000 });
}

/** A role and a user holding it, both built through the forms. */
export async function createRoleAndUser(
  page: Page,
  permissions: readonly string[],
  tag: string,
): Promise<UiUser> {
  const roleName = await createRole(page, permissions, tag);
  const { username, password } = await createUser(page, roleName, tag);
  return { username, password, roleName, permissions };
}
