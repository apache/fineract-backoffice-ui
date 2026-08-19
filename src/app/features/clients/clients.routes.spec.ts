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
import { TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { CLIENTS_ROUTES } from './clients.routes';
import { TranslatedTitleStrategy } from '../../core/router/translated-title.strategy';
import { FakeI18nAdapter, provideFakeAdapters } from '../../testing/adapters';

const APP_NAME_KEY = 'app.shortTitle';
const APP_NAME = 'Fineract';
const SECTION_KEY = 'nav.clients';
const SECTION_NAME = 'Clients';

/** Stands in for the lazily loaded page components, which this spec does not exercise. */
@Component({ standalone: true, template: '' })
class RouteStub {}

/**
 * A dotted key such as `CLIENTS.ADD_NOTE`, rather than a phrase.
 *
 * Checked segment by segment rather than with one pattern: a single regex for this shape
 * needs a quantifier inside a quantifier, which `security/detect-unsafe-regex` flags, and
 * a suppression would cost more to read than the loop does.
 */
function isTranslationKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const segments = value.split('.');
  return (
    segments.length > 1 && /^[A-Za-z]/.test(value) && segments.every((part) => /^\w+$/.test(part))
  );
}

describe('CLIENTS_ROUTES', () => {
  let i18n: FakeI18nAdapter;

  beforeEach(() => {
    // The guards are not under test here, and permissionGuard would reject every
    // navigation without an authenticated user.
    const routes = CLIENTS_ROUTES.map(({ path, title }) => ({
      path,
      title,
      component: RouteStub,
    }));

    const adapters = provideFakeAdapters();
    i18n = adapters.i18n;
    i18n.catalogue.set(APP_NAME_KEY, APP_NAME);
    i18n.catalogue.set(SECTION_KEY, SECTION_NAME);

    TestBed.configureTestingModule({
      providers: [
        ...adapters.providers,
        { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
        provideRouter([{ path: 'clients', title: SECTION_KEY, children: routes }]),
      ],
    });
  });

  /**
   * The regression this file exists for. A route with no `title` still gets a tab, because
   * Angular's `buildTitle` walks up to the section, so a missing title looks correct on
   * screen and is only wrong in the one place nobody is looking. Every page under `clients`
   * would silently read "Clients".
   */
  it('gives every route its own title', () => {
    const untitled = CLIENTS_ROUTES.filter((route) => !route.title).map((route) => route.path);

    expect(untitled).toEqual([]);
  });

  it('titles routes with translation keys rather than phrases', () => {
    const notKeys = CLIENTS_ROUTES.filter((route) => !isTranslationKey(route.title)).map(
      (route) => route.path,
    );

    expect(notKeys).toEqual([]);
  });

  /**
   * The shapes the convention has to answer, and the reason `clients` was the file to settle
   * it on: an empty path, a record-scoped page, and a two-level nested sub-resource. The last
   * is the one that inherits from the section rather than its own parent if a title is missed.
   */
  const cases = [
    { url: '/clients', key: SECTION_KEY, name: SECTION_NAME },
    { url: '/clients/view/7', key: 'CLIENTS.DETAILS', name: 'Client Details' },
    { url: '/clients/create', key: 'CLIENTS.CREATE_CLIENT', name: 'Create Client' },
    {
      url: '/clients/7/identifiers/edit/3',
      key: 'CLIENTS.EDIT_IDENTIFIER',
      name: 'Edit Identifier',
    },
    {
      url: '/clients/7/collaterals/create',
      key: 'CLIENT_COLLATERAL.CREATE',
      name: 'Add Collateral',
    },
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
