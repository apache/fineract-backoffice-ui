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

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SYSTEM_ROUTES } from './system.routes';
import { TranslatedTitleStrategy } from '../../core/router/translated-title.strategy';
import { FakeI18nAdapter, provideFakeAdapters } from '../../testing/adapters';

const APP_NAME_KEY = 'app.shortTitle';
const APP_NAME = 'Fineract';
const SECTION_KEY = 'nav.system';
const SECTION_NAME = 'System';

/** Stands in for the lazily loaded page components, which this spec does not exercise. */
@Component({ standalone: true, template: '' })
class RouteStub {}

/**
 * A dotted key such as `CODES.CREATE_TITLE`, rather than a phrase.
 *
 * Checked segment by segment rather than with one pattern: a single regex for this shape
 * needs a quantifier inside a quantifier, which `security/detect-unsafe-regex` flags.
 */
function isTranslationKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const segments = value.split('.');
  return (
    segments.length > 1 && /^[A-Za-z]/.test(value) && segments.every((part) => /^\w+$/.test(part))
  );
}

describe('SYSTEM_ROUTES', () => {
  let i18n: FakeI18nAdapter;

  beforeEach(() => {
    // The guards are not under test here, and permissionGuard would reject every
    // navigation without an authenticated user.
    const routes = SYSTEM_ROUTES.map((route) =>
      route.redirectTo
        ? route
        : {
            path: route.path,
            title: route.title,
            component: RouteStub,
          },
    );

    const adapters = provideFakeAdapters();
    i18n = adapters.i18n;
    i18n.catalogue.set(APP_NAME_KEY, APP_NAME);
    i18n.catalogue.set(SECTION_KEY, SECTION_NAME);

    TestBed.configureTestingModule({
      providers: [
        ...adapters.providers,
        { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
        provideRouter([{ path: 'system', title: SECTION_KEY, children: routes }]),
      ],
    });
  });

  /**
   * The regression this file exists for. A route with no `title` still gets a tab, because
   * Angular's `buildTitle` walks up to the section, so a missing title looks correct on
   * screen and is only wrong in the one place nobody is looking. This section is the worst
   * place for that: 49 administrative screens that all read "System".
   */
  it('gives every route its own title', () => {
    const untitled = SYSTEM_ROUTES.filter((route) => !route.redirectTo && !route.title).map(
      (route) => route.path,
    );

    expect(untitled).toEqual([]);
  });

  it('titles routes with translation keys rather than phrases', () => {
    const notKeys = SYSTEM_ROUTES.filter(
      (route) => !route.redirectTo && !isTranslationKey(route.title),
    ).map((route) => route.path);

    expect(notKeys).toEqual([]);
  });

  it('gives no two routes the same title', () => {
    const seen = new Map<string, string[]>();
    for (const route of SYSTEM_ROUTES.filter((route) => !route.redirectTo)) {
      const key = String(route.title);
      seen.set(key, [...(seen.get(key) ?? []), String(route.path)]);
    }

    const collisions = [...seen.entries()].filter(([, paths]) => paths.length > 1);

    expect(collisions).toEqual([]);
  });

  it('redirects the feature root to data-tables', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/system');

    expect(TestBed.inject(Router).url).toBe('/system/data-tables');
  });

  /**
   * The shapes this file contributes. `codes/:codeId/values` is the one that needed a
   * judgement: its heading is the code's own name, bound at runtime, so the route takes the
   * generic `CODE_VALUES.TITLE` in the same way a record view does. The rest are ordinary
   * configuration screens, which is why this file needed no new translation keys at all.
   */
  const cases = [
    { url: '/system/codes', key: 'CODES.TITLE', name: 'Codes' },
    { url: '/system/codes/7/values', key: 'CODE_VALUES.TITLE', name: 'Code Values' },
    {
      url: '/system/codes/7/values/edit/3',
      key: 'CODE_VALUES.EDIT_TITLE',
      name: 'Edit Code Value',
    },
    {
      url: '/system/scheduler-jobs/7/history',
      key: 'SCHEDULER_JOBS.RUN_HISTORY',
      name: 'Run History',
    },
    {
      url: '/system/data-tables/edit/m_client',
      key: 'SYSTEM.EDIT_DATA_TABLE',
      name: 'Edit Data Table',
    },
    { url: '/system/permissions', key: 'PERMISSIONS.TITLE', name: 'Maker-Checker Permissions' },
  ];

  cases.forEach(({ url, key, name }) => {
    it(`titles ${url} from its own route rather than the section`, async () => {
      i18n.catalogue.set(key, name);
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl(url);

      expect(TestBed.inject(Title).getTitle()).toBe(`${name} · ${APP_NAME}`);
    });
  });
});
