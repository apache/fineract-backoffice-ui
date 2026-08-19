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
import { TranslatedTitleStrategy } from './translated-title.strategy';
import { FakeI18nAdapter, provideFakeAdapters } from '../../testing/adapters';

const APP_NAME_KEY = 'app.shortTitle';
const SECTION_KEY = 'nav.groups';
const PAGE_KEY = 'GROUPS.CREATE_GROUP';

@Component({ standalone: true, template: '' })
class RouteStub {}

describe('TranslatedTitleStrategy', () => {
  let i18n: FakeI18nAdapter;

  beforeEach(() => {
    const adapters = provideFakeAdapters();
    i18n = adapters.i18n;
    i18n.catalogue.set(APP_NAME_KEY, 'Fineract');
    i18n.catalogue.set(SECTION_KEY, 'Groups');
    i18n.catalogue.set(PAGE_KEY, 'Create Group');

    TestBed.configureTestingModule({
      providers: [
        ...adapters.providers,
        { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
        provideRouter([
          {
            path: 'groups',
            title: SECTION_KEY,
            children: [
              { path: '', component: RouteStub },
              { path: 'create', title: PAGE_KEY, component: RouteStub },
            ],
          },
          { path: 'untitled', component: RouteStub },
        ]),
      ],
    });
  });

  const cases = [
    {
      description: 'resolves a route title as a translation key and suffixes the app name',
      url: '/groups/create',
      expected: 'Create Group · Fineract',
    },
    {
      description: 'falls back to the nearest ancestor title when a route has none',
      url: '/groups',
      expected: 'Groups · Fineract',
    },
    {
      description: 'uses the application name alone when no route in the chain has a title',
      url: '/untitled',
      expected: 'Fineract',
    },
  ];

  cases.forEach(({ description, url, expected }) => {
    it(description, async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);

      expect(TestBed.inject(Title).getTitle()).toBe(expected);
    });
  });

  it('re-applies the title when the language changes, without navigating', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/groups/create');

    i18n.catalogue.set(APP_NAME_KEY, 'फिनरैक्ट');
    i18n.catalogue.set(PAGE_KEY, 'समूह बनाएं');
    i18n.use('hi');
    harness.detectChanges();

    expect(TestBed.inject(Title).getTitle()).toBe('समूह बनाएं · फिनरैक्ट');
  });
});
