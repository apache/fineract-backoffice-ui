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
 * Adds a family member against a real Fineract.
 *
 * The mocked spec proves what the form shows and sends; only the platform can say whether it
 * agrees. Three questions worth asking it:
 *
 * - does a member added through the form come back, with the relationship and birth date the
 *   operator chose?
 * - is the day the picker now stops at the same day the platform stops at? Asked by taking the
 *   bound off the picker and posting the day after it, so the two are compared rather than both
 *   assumed. No date is hardcoded and no clock is read, which is deliberate: the tenant and the
 *   runner are on different days for part of every day (#758), and a spec that assumed either
 *   one would fail in that window for the wrong reason.
 * - is the relationship marked required because the platform insists, or because the form does?
 *   Both answers are useful, and they differ per field: Fineract's validator demands
 *   `firstName` and `relationshipId`, and accepts a member with no last name. The form asks for
 *   a last name as well, which is its own rule and is marked as such.
 */

import type { APIRequestContext, APIResponse, Response } from '@playwright/test';
import { expect, test } from './fixtures';
import { login } from './utils/fineract-login';
import {
  API_BASE,
  createApiContext,
  ensureCodeValue,
  fineractDate,
  seedClient,
  type SeededClient,
} from './utils/seed-api';
import { selectOption } from './utils/select-option';

/**
 * The response body, or a note in its place.
 *
 * Both saves here navigate to the client page on success, and Chromium discards a response body
 * once the page it belongs to has gone. The body is wanted only to name the platform's complaint
 * when a save is refused, so losing it on the path where nothing went wrong must not fail the
 * test: before this, the eagerly evaluated expect() message raced that navigation and threw
 * `Protocol error (Network.getResponseBody)` instead of asserting the status.
 */
async function savedBody(response: Response): Promise<string> {
  return response.text().catch(() => '<body discarded by the navigation that followed the save>');
}

/** What the platform said, for the message of an assertion about the status it said it with. */
async function rejection(response: APIResponse): Promise<string> {
  return `the platform answered ${response.status()}: ${(await response.text()).slice(0, 300)}`;
}

/** The globalisation codes of a validation answer, which is how the platform names each rule. */
async function validationCodes(response: APIResponse): Promise<(string | undefined)[]> {
  const body = (await response.json()) as {
    errors?: { userMessageGlobalisationCode?: string }[];
  };
  return (body.errors ?? []).map((error) => error.userMessageGlobalisationCode);
}

const DATE_FORMAT = 'dd MMMM yyyy';
const LOCALE = 'en';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Builds the date a calendar day after an ISO date, in local terms so no offset can shift it. */
function dayAfter(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day + 1);
}

interface CodeValue {
  id: number;
  name: string;
}

interface FamilyMember {
  id?: number;
  firstName?: string;
  lastName?: string;
  relationshipId?: number;
  /**
   * Measured: this endpoint answers an ISO string, where the OpenAPI document types it as one
   * and much of the rest of the API sends `[year, month, day]` instead (#653). Typed as both,
   * and read through {@link isoDay}, so the spec keeps checking the day rather than the shape.
   */
  dateOfBirth?: string | number[];
}

/** The calendar day in a Fineract date, whichever of its two shapes arrived. */
function isoDay(value: FamilyMember['dateOfBirth']): string | undefined {
  if (Array.isArray(value)) {
    const [year, month, day] = value;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return value;
}

let api: APIRequestContext;
let client: SeededClient;
let relationship: CodeValue;
/** The picker's bound, and the member created at it — both read by the later tests. */
let bound: string;
let memberId: number;

test.describe('Family member against Fineract', () => {
  // One seeded client, added to by the first test and read by the rest.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    api = await createApiContext();
    client = await seedClient(api, 'E2EFamily');
    // Measured: a stock Fineract ships the RELATIONSHIP code with no values at all, so the
    // field the form requires cannot be filled until a tenant adds one. Seeded here rather than
    // asserted, because an empty reference list is the tenant's state and not this form's bug.
    relationship = await ensureCodeValue(api, 'RELATIONSHIP', 'Sibling');

    const template = await api.get(`${API_BASE}/clients/${client.clientId}/familymembers/template`);
    expect(template.ok(), `the family member template answered ${template.status()}`).toBe(true);
    const options = ((await template.json()) as { relationshipIdOptions?: CodeValue[] })
      .relationshipIdOptions;
    expect(
      options?.map((option) => option.id),
      'the seeded relationship to reach the form through the template',
    ).toContain(relationship.id);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('a member added through the form is stored, and the client page lists it', async ({
    page,
  }) => {
    await login(page);
    await page.goto(`/clients/${client.clientId}/family-members/create`);

    const picker = page.getByTestId('family-dob-picker');
    // The bound is resolved from the platform after the form renders.
    await expect
      .poll(() => picker.evaluate((element: HTMLElement & { max?: string }) => element.max))
      .toMatch(/^\d{4}-\d{2}-\d{2}$/);
    bound = (await picker.evaluate((element: HTMLElement & { max?: string }) => element.max))!;
    const [, month, day] = bound.split('-').map(Number);

    await page.getByTestId('family-first-name-input').locator('input').fill(client.firstName);
    await page.getByTestId('family-last-name-input').locator('input').fill('Sibling');
    await selectOption(page, 'Relationship', relationship.name);

    // The latest birth date the picker offers, which is the one most likely to be refused if
    // the bound disagreed with the platform by even a day.
    await page.locator('ion-datetime-button[datetime="family-dob-picker"]').click();
    await expect(picker).toBeVisible();
    await picker
      .getByRole('button', { name: new RegExp(`${MONTHS[month - 1]} ${day}`) })
      .first()
      .click();
    await page.keyboard.press('Escape');
    await expect(picker).not.toBeVisible();

    const [saved] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/clients/${client.clientId}/familymembers`) &&
          response.request().method() === 'POST',
      ),
      page.getByTestId('family-submit-btn').click(),
    ]);
    // Read with a fallback: the save is followed by a navigation to the client page, and
    // Chromium discards a response body once the page it belongs to has gone. expect()
    // evaluates its message argument whether or not the assertion fails, so reading the body
    // eagerly raced the navigation the click had just triggered and threw instead of asserting.
    // The status stays readable either way; the body is only a diagnostic for a non-200.
    expect(saved.status(), (await savedBody(saved)).slice(0, 300)).toBe(200);

    await expect(page.locator('ion-toast.success-toast')).toHaveJSProperty(
      'message',
      'Family member added.',
    );
    await expect(page).toHaveURL(`/clients/view/${client.clientId}`);

    const stored = await api.get(`${API_BASE}/clients/${client.clientId}/familymembers`);
    expect(stored.ok(), `reading the members back answered ${stored.status()}`).toBe(true);
    const members = (await stored.json()) as FamilyMember[];
    const added = members.find((member) => member.lastName === 'Sibling');
    expect(added, `a stored member among ${JSON.stringify(members)}`).toBeDefined();
    expect(added!.firstName).toBe(client.firstName);
    expect(added!.relationshipId).toBe(relationship.id);
    expect(isoDay(added!.dateOfBirth)).toBe(bound);
    memberId = added!.id!;

    // Forced: Ionic's segment indicator overlay sits in the hit-test path of its own
    // segment-button, which trips Playwright's actionability check.
    await page.getByRole('tab', { name: /Family Members/i }).click({ force: true });
    await expect(page.getByText(`${client.firstName} Sibling`)).toBeVisible();
  });

  test('an unchanged edit leaves the saved birth date alone', async ({ page }) => {
    // The case the mocked specs could not make: they fixture `dateOfBirth` as
    // `[year, month, day]`, and the form read whatever arrived as exactly that. Against the
    // real platform, which sends '2026-10-31', indexing the string took its characters and an
    // edit that touched nothing saved 2 December 1901 over the operator's birth date.
    await login(page);
    await page.goto(`/clients/${client.clientId}/family-members/edit/${memberId}`);

    const picker = page.getByTestId('family-dob-picker');
    await expect
      .poll(() => picker.evaluate((element: HTMLElement & { value?: string }) => element.value))
      .toBe(`${bound}T00:00:00`);
    await expect(
      page.locator('ion-datetime-button[datetime="family-dob-picker"]'),
    ).not.toContainText('1901');

    const [saved] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/familymembers/${memberId}`) &&
          response.request().method() === 'PUT',
      ),
      page.getByTestId('family-submit-btn').click(),
    ]);
    // Read with a fallback: the save is followed by a navigation to the client page, and
    // Chromium discards a response body once the page it belongs to has gone. expect()
    // evaluates its message argument whether or not the assertion fails, so reading the body
    // eagerly raced the navigation the click had just triggered and threw instead of asserting.
    // The status stays readable either way; the body is only a diagnostic for a non-200.
    expect(saved.status(), (await savedBody(saved)).slice(0, 300)).toBe(200);
    await expect(page).toHaveURL(`/clients/view/${client.clientId}`);

    const after = await api.get(`${API_BASE}/clients/${client.clientId}/familymembers/${memberId}`);
    expect(after.ok(), `re-reading the member answered ${after.status()}`).toBe(true);
    expect(isoDay(((await after.json()) as FamilyMember).dateOfBirth)).toBe(bound);
  });

  test('the platform enforces its own rules, and each one backs a rule the form already had', async ({
    page,
  }) => {
    // Worth measuring rather than assuming, because it decides how much of this the form has to
    // do itself. `ClientFamilyMemberCommandFromApiJsonDeserializer` declares three rules — a
    // mandatory first name, a mandatory relationship, a birth date no later than the business
    // date — and collects every breach of them into a `DataValidatorBuilder`.
    //
    // Until November 2026 it never called `throwExceptionIfValidationWarningsExist`: the
    // collected errors were discarded, every one of these requests was accepted, and the form
    // was the only guard. The platform now throws them, so each of the form's three rules is
    // backed by one of its own. The form keeps them regardless — refusing before sending is what
    // keeps the operator out of the platform's error path — but this is no longer the only thing
    // standing between a bad request and a stored row.
    //
    // Still measured rather than trusted: `apache/fineract:latest` is not pinned, so this is
    // what notices when one of these answers moves again.

    // No first name at all.
    const nameless = await api.post(`${API_BASE}/clients/${client.clientId}/familymembers`, {
      data: {
        lastName: 'Nameless',
        relationshipId: relationship.id,
        dateFormat: DATE_FORMAT,
        locale: LOCALE,
      },
    });
    expect(nameless.status(), await rejection(nameless)).toBe(400);
    expect(await validationCodes(nameless)).toContain(
      'org.apache.fineract.portfolio.client.familymember.firstname.not-blank',
    );

    // No relationship. This was a 403 carrying the database's own sentence about a column named
    // `relationship_cv_id` — true, and no use to an operator. It is now the validator's own
    // answer, naming the parameter the form names.
    const unrelated = await api.post(`${API_BASE}/clients/${client.clientId}/familymembers`, {
      data: { firstName: 'Unrelated', lastName: 'Person', dateFormat: DATE_FORMAT, locale: LOCALE },
    });
    expect(unrelated.status(), await rejection(unrelated)).toBe(400);
    expect(await validationCodes(unrelated)).toContain(
      'org.apache.fineract.portfolio.client.familymember.relationship-id.not-null',
    );

    // A birth date after the platform's own day.
    const unborn = await api.post(`${API_BASE}/clients/${client.clientId}/familymembers`, {
      data: {
        firstName: 'Unborn',
        lastName: 'Tomorrow',
        relationshipId: relationship.id,
        dateOfBirth: fineractDate(dayAfter(bound)),
        dateFormat: DATE_FORMAT,
        locale: LOCALE,
      },
    });
    expect(unborn.status(), await rejection(unborn)).toBe(400);
    expect(await validationCodes(unborn)).toContain(
      'org.apache.fineract.portfolio.client.familymember.date-of-birth.must-be-in-past',
    );

    // A last name, though, is still the form's own rule and is marked as such: the platform
    // stores a member without one.
    const noLastName = await api.post(`${API_BASE}/clients/${client.clientId}/familymembers`, {
      data: {
        firstName: 'OnlyFirst',
        relationshipId: relationship.id,
        dateFormat: DATE_FORMAT,
        locale: LOCALE,
      },
    });
    expect(noLastName.status(), await rejection(noLastName)).toBe(200);

    // And the picker stops on the same day the platform starts refusing, which is why none of
    // the three answers above is one an operator ever has to read.
    await login(page);
    await page.goto(`/clients/${client.clientId}/family-members/create`);
    const picker = page.getByTestId('family-dob-picker');
    await expect
      .poll(() => picker.evaluate((element: HTMLElement & { max?: string }) => element.max))
      .toBe(bound);
  });
});
