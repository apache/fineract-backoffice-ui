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

import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { CollectionSheetComponent } from './collection-sheet.component';
import { provideIonicTesting } from '../../testing/ionic-testing';
import { provideTranslateTesting } from '../../testing/i18n-testing';

/**
 * Driven through the HTTP layer rather than through service spies.
 *
 * Two of the three defects under test are about what reaches the wire — a staff list that is
 * never requested for the right office, and a `staffId` the form collected and then dropped
 * before the request was built. A spy on the generated service would assert on the argument the
 * component passed; this asserts on the request that actually went out, which is the thing that
 * was broken. It also keeps the spec off the generated client, per ADR 0006.
 */
describe('CollectionSheetComponent', () => {
  let component: CollectionSheetComponent;
  let fixture: ComponentFixture<CollectionSheetComponent>;
  let http: HttpTestingController;

  /** Every outstanding request whose URL ends with `suffix`, newest last. */
  function matching(suffix: string): HttpRequest<unknown>[] {
    return http
      .match((r) => r.urlWithParams.includes(suffix))
      .map((handle) => {
        handle.flush(null);
        return handle.request;
      });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollectionSheetComponent],
      providers: [
        provideIonicTesting(),
        provideNoopAnimations(),
        ...provideTranslateTesting(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CollectionSheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // The office list loads on init; answering it keeps it out of the way of later matches.
    for (const handle of http.match((r) => r.url.endsWith('/offices'))) {
      handle.flush([{ id: 1, name: 'Head Office' }]);
    }
    fixture.detectChanges();
  });

  /**
   * The staff field used to be an `<ion-input type="number">`, so the operator had to know a
   * staff member's database id. Fineract scopes staff by office, which is why the list is only
   * fetched once an office is chosen.
   */
  describe('the staff picker', () => {
    it('asks for the chosen office staff', () => {
      component.onOfficeChange(1);

      const requests = http.match((r) => r.url.endsWith('/staff'));
      expect(requests).toHaveLength(1);
      expect(requests[0].request.params.get('officeId')).toBe('1');

      requests[0].flush([{ id: 4, displayName: 'Cashier, E2E' }]);
      expect(component.staff()).toEqual([{ id: 4, displayName: 'Cashier, E2E' }]);
    });

    it('clears a selection made against a different office', () => {
      component.onOfficeChange(1);
      http
        .match((r) => r.url.endsWith('/staff'))[0]
        .flush([{ id: 4, displayName: 'Cashier, E2E' }]);
      component.staffId = 4;

      component.onOfficeChange(2);

      expect(component.staffId).toBeNull();
      // Cleared before the second office's list arrives, so a slow response cannot leave a
      // selection from the previous office standing.
      expect(component.staff()).toEqual([]);
      http.match((r) => r.url.endsWith('/staff'))[0].flush([]);
    });

    it('asks for nothing when the office is cleared', () => {
      component.onOfficeChange(undefined);

      http.expectNone((r) => r.url.endsWith('/staff'));
    });
  });

  /**
   * `staffId` is a component field of its own, and `buildBody()` spread only the request object,
   * so whatever the operator chose was collected and then dropped before the request was built.
   */
  describe('the generate request', () => {
    function generateAndReadBody(): Record<string, unknown> {
      component.generate();
      const requests = matching('/collectionsheet');
      expect(requests).toHaveLength(1);
      return requests[0].body as Record<string, unknown>;
    }

    it('carries the chosen staff member', () => {
      component.request.officeId = 1;
      component.staffId = 4;

      expect(generateAndReadBody()).toMatchObject({ officeId: 1, staffId: 4 });
    });

    it('omits staffId entirely when none was chosen', () => {
      component.request.officeId = 1;

      expect(generateAndReadBody()).not.toHaveProperty('staffId');
    });
  });

  /**
   * `command=generate` answers 200 with an empty body when nothing is due, which arrives as null.
   * The screen used to render the literal text `null` under "Collection Results" and still offer
   * Save, inviting the operator to save nothing.
   */
  describe('an empty sheet', () => {
    function generate(response: Record<string, unknown> | null): void {
      component.request.officeId = 1;
      component.generate();
      http.match((r) => r.url.includes('/collectionsheet'))[0].flush(response);
      fixture.detectChanges();
    }

    it('says so, and offers nothing to save', () => {
      generate(null);

      expect(component.hasSheet()).toBe(false);
      expect(
        fixture.nativeElement.querySelector('[data-testid="collection-sheet-empty"]'),
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="collection-sheet-results"]'),
      ).toBeNull();
    });

    it('treats a body with no fields the same way', () => {
      generate({});

      expect(component.hasSheet()).toBe(false);
    });

    it('shows the sheet when there is one', () => {
      generate({ groups: [{ groupId: 7 }] });

      expect(component.hasSheet()).toBe(true);
      expect(
        fixture.nativeElement.querySelector('[data-testid="collection-sheet-results"]'),
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="collection-sheet-empty"]'),
      ).toBeNull();
    });
  });

  afterEach(() => {
    // Every spec answers the requests it provokes. An unanswered one means the component asked
    // for something the spec did not expect, which is worth failing on.
    http.verify({ ignoreCancelled: true });
  });
});
