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
import { PRODUCTS_ROUTES } from './products.routes';
import { TranslatedTitleStrategy } from '../../core/router/translated-title.strategy';
import { FakeI18nAdapter, provideFakeAdapters } from '../../testing/adapters';

const APP_NAME_KEY = 'app.shortTitle';
const APP_NAME = 'Fineract';
const SECTION_KEY = 'nav.products';
const SECTION_NAME = 'Products';

/** Stands in for the lazily loaded page components, which this spec does not exercise. */
@Component({ standalone: true, template: '' })
class RouteStub {}

/**
 * A dotted key such as `PRODUCTS.CREATE_LOAN_PRODUCT`, rather than a phrase.
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

describe('PRODUCTS_ROUTES', () => {
  let i18n: FakeI18nAdapter;

  beforeEach(() => {
    // The guards are not under test here, and permissionGuard would reject every
    // navigation without an authenticated user.
    const routes = PRODUCTS_ROUTES.map(({ path, title }) => ({
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
        provideRouter([{ path: 'products', title: SECTION_KEY, children: routes }]),
      ],
    });
  });

  /**
   * The regression this file exists for. A route with no `title` still gets a tab, because
   * Angular's `buildTitle` walks up to the section, so a missing title looks correct on
   * screen and is only wrong in the one place nobody is looking.
   */
  it('gives every route its own title', () => {
    const untitled = PRODUCTS_ROUTES.filter((route) => !route.title).map((route) => route.path);

    expect(untitled).toEqual([]);
  });

  it('titles routes with translation keys rather than phrases', () => {
    const notKeys = PRODUCTS_ROUTES.filter((route) => !isTranslationKey(route.title)).map(
      (route) => route.path,
    );

    expect(notKeys).toEqual([]);
  });

  /**
   * The test this file exists for that `clients` did not need, and the one that encodes what
   * 65 routes taught us. Titling is only worth doing if the tabs come out distinguishable,
   * and the tempting shortcut here is to follow each page's own heading key. Five of these
   * routes are record views whose heading is a `COMMON.DETAILS` or `COMMON.OVERVIEW`, so
   * following the heading would give four different screens the tab "Details" and reproduce
   * the exact problem the issue is about, one level down.
   */
  it('gives no two routes the same title', () => {
    const seen = new Map<string, string[]>();
    for (const route of PRODUCTS_ROUTES) {
      const key = String(route.title);
      seen.set(key, [...(seen.get(key) ?? []), String(route.path)]);
    }

    const collisions = [...seen.entries()].filter(([, paths]) => paths.length > 1);

    expect(collisions).toEqual([]);
  });

  /**
   * The shapes `products` adds beyond `clients`: a `:command` segment whose page heading is
   * chosen at runtime, an account-action route that is entirely command-driven, and the
   * deeper entity-scoped sub-resources. A static `title` cannot branch on a parameter, so
   * each of these takes a generic key naming the screen type.
   */
  const cases = [
    { url: '/products', key: SECTION_KEY, name: SECTION_NAME },
    { url: '/products/loan', key: 'nav.loanProducts', name: 'Loan Products' },
    { url: '/products/loan/view/7', key: 'nav.loanProductDetails', name: 'Loan Product Details' },
    {
      url: '/products/savings-accounts/view/7',
      key: 'SAVINGS.ACCOUNT_DETAILS',
      name: 'Savings Account Details',
    },
    {
      url: '/products/savings-accounts/7/transactions/deposit',
      key: 'SAVINGS.TRANSACTION',
      name: 'Savings Transaction',
    },
    {
      url: '/products/savings/7/action/approve',
      key: 'ACTIONS.ACCOUNT_ACTION',
      name: 'Account Action',
    },
    {
      url: '/products/shares/7/dividends/create',
      key: 'SHARE_DIVIDENDS.CREATE',
      name: 'Declare Dividend',
    },
    {
      url: '/products/interest-rate-charts/7/slabs',
      key: 'INTEREST_RATE_CHARTS.SLABS',
      name: 'Slabs',
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
