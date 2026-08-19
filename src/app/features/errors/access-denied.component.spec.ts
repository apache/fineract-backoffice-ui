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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { AccessDeniedComponent } from './access-denied.component';
import { renderComponent } from '../../testing/render';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { provideFakeAdapters } from '../../testing/adapters';

describe('AccessDeniedComponent', () => {
  const REQUIRED_TESTID = '[data-testid="access-denied-required"]';

  let fixture: ComponentFixture<AccessDeniedComponent>;
  let host: HTMLElement;

  /** Renders the page as the guard would have left it, with the given `required` query param. */
  async function render(required?: string): Promise<void> {
    // Each case configures its own query params, so the module from the previous one has to go.
    TestBed.resetTestingModule();
    fixture = await renderComponent(AccessDeniedComponent, {
      providers: [
        provideRouter([]),
        ...provideIonicTesting(),
        ...provideFakeAdapters().providers,
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap(required ? { required } : {})),
          },
        },
      ],
    });
    host = fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await render();
  });

  it('states what happened in a single top-level heading', () => {
    const headings = host.querySelectorAll('h1');
    expect(headings).toHaveSize(1);
    expect(headings[0].textContent?.trim()).toBeTruthy();
  });

  it('takes focus on the heading, because the user did not ask for this navigation', () => {
    // A guard redirect changes the page without the user acting. Leaving focus wherever the
    // previous screen left it gives a screen-reader user no reason for the change.
    expect(document.activeElement).toBe(host.querySelector('h1'));
  });

  it('announces itself without interrupting', () => {
    const region = host.querySelector('[aria-live]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.getAttribute('role')).toBe('alert');
  });

  it('offers a way out that does not depend on any permission', () => {
    const back = host.querySelector('[data-testid="access-denied-dashboard"]');
    expect(back).not.toBeNull();
    expect(back?.getAttribute('ng-reflect-router-link') ?? back?.outerHTML).toContain('/dashboard');
  });

  it('renders translated copy rather than raw keys', () => {
    // The fake i18n adapter echoes the key back, so a missed `| appTranslate` would show up as
    // the literal key. Every visible string must have gone through the pipe.
    const text = host.textContent ?? '';
    expect(text).toContain('ACCESS_DENIED.TITLE');
    expect(text).toContain('ACCESS_DENIED.MESSAGE');
    expect(text).toContain('ACCESS_DENIED.HINT');
    expect(text).toContain('ACCESS_DENIED.BACK_TO_DASHBOARD');
  });

  it('hides the decorative icon from assistive technology', () => {
    expect(host.querySelector('ion-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  describe('the permissions the screen wanted', () => {
    it('names them when the guard passed them on', async () => {
      await render('READ_JOURNALENTRY,CREATE_JOURNALENTRY');
      const required = host.querySelector(REQUIRED_TESTID);
      expect(required?.textContent).toContain('READ_JOURNALENTRY');
      expect(required?.textContent).toContain('CREATE_JOURNALENTRY');
    });

    it('also says what they mean, for a reader who does not speak in codes', async () => {
      await render('READ_JOURNALENTRY,CREATE_JOURNALENTRY');
      expect(host.querySelector(REQUIRED_TESTID)?.textContent).toContain(
        'View and create journal entries',
      );
    });

    it('says nothing at all when there are none to name', () => {
      // Reached directly rather than by refusal: inventing a requirement would be worse than
      // leaving the sentence out.
      expect(host.querySelector(REQUIRED_TESTID)).toBeNull();
    });

    it('ignores empty entries rather than rendering a stray separator', async () => {
      await render('READ_CLIENT,,');
      const required = host.querySelector(REQUIRED_TESTID);
      expect(required?.textContent).toContain('READ_CLIENT');
      expect(required?.textContent).not.toContain(', ,');
    });
  });
});
