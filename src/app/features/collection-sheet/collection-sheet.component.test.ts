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

  /**
   * The half of #670 that outlived the table: the sheet showed what was due and the Save button
   * posted the generate filters, so nothing anyone collected was ever recorded.
   */
  describe('the save request', () => {
    /**
     * A group with one loan and two savings accounts. The second savings account is a
     * 'Current Deposit', which is the `ELSE` branch of the platform's own CASE expression and so
     * names neither FIXED_DEPOSIT nor CURRENT_DEPOSIT — it cannot be posted.
     */
    const SHEET = {
      dueDate: '2026-11-08',
      groups: [
        {
          groupId: 7,
          groupName: 'Mahila Mandal A',
          clients: [
            {
              clientId: 21,
              clientName: 'Asha Kumar',
              loans: [{ loanId: 101, accountId: '000000101', totalDue: 950 }],
              savings: [
                {
                  savingsId: 55,
                  accountId: '000000055',
                  dueAmount: 50,
                  depositAccountType: 'Saving Deposit',
                },
                {
                  savingsId: 56,
                  accountId: '000000056',
                  dueAmount: 60,
                  depositAccountType: 'Current Deposit',
                },
              ],
            },
          ],
        },
      ],
    };

    function generateSheet(): void {
      component.request.officeId = 1;
      component.staffId = 4;
      component.generate();
      http.match((r) => r.url.includes('/collectionsheet'))[0].flush(SHEET);
      fixture.detectChanges();
    }

    /** Types into the real input, so the template binding is under test and not just the handler. */
    function collect(testId: string, value: string): void {
      const input: HTMLElement = fixture.nativeElement.querySelector(
        `[data-testid="${CSS.escape(testId)}"]`,
      );
      expect(input).not.toBeNull();
      input.dispatchEvent(new CustomEvent('ionInput', { detail: { value } }));
      fixture.detectChanges();
    }

    function save(): Record<string, unknown> {
      component.save();
      const requests = matching('/collectionsheet');
      expect(requests).toHaveLength(1);
      return requests[0].body as Record<string, unknown>;
    }

    it('seeds each box with what is due, which is what is usually paid', () => {
      generateSheet();

      expect(component.loanCollected()).toEqual({ 101: 950 });
      // 56 is seeded at zero: it cannot be posted, and an amount in a total no save will carry
      // is worse than an empty box.
      expect(component.savingsCollected()).toEqual({ 55: 50, 56: 0 });
      expect(component.collectedTotal()).toBe(1000);
    });

    it('posts what was collected rather than what was due', () => {
      generateSheet();
      collect('collect-loan-101', '400');

      expect(save()['bulkRepaymentTransactions']).toEqual([
        { loanId: 101, transactionAmount: 400 },
      ]);
    });

    /**
     * `command=save` routes to Fineract's `saveIndividualCollectionSheet`, whose validator calls
     * `checkForUnsupportedParameters` against a set holding neither `officeId` nor `staffId`.
     * The screen sent both, so every save was refused before it reached a loan.
     */
    it('carries neither filter, because the platform refuses them on a save', () => {
      generateSheet();

      const body = save();
      expect(body).not.toHaveProperty('officeId');
      expect(body).not.toHaveProperty('staffId');
      expect(body).toMatchObject({ transactionDate: expect.any(String), locale: 'en' });
    });

    it('leaves out an account nobody paid', () => {
      generateSheet();
      collect('collect-loan-101', '0');
      collect('collect-savings-55', '0');

      const body = save();
      expect(body['bulkRepaymentTransactions']).toEqual([]);
      expect(body['bulkSavingsDueTransactions']).toEqual([]);
    });

    /**
     * The sheet names the kind of account in words ('Saving Deposit'); the save posts it as a
     * `DepositAccountType` id (100). A deposit sent without one is accepted and then silently
     * does nothing — `updateBulkMandatorySavingsDuePayments` swallows the exception.
     */
    it('posts a savings deposit against the account type the platform means by its label', () => {
      generateSheet();

      expect(save()['bulkSavingsDueTransactions']).toEqual([
        { savingsId: 55, transactionAmount: 50, depositAccountType: 100 },
      ]);
    });

    it('offers no box for an account whose type the sheet does not identify', () => {
      generateSheet();

      expect(fixture.nativeElement.querySelector('[data-testid="collect-savings-56"]')).toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="collect-savings-blocked-56"]'),
      ).not.toBeNull();
    });

    it('clears what was entered when the operator goes back to the filters', () => {
      generateSheet();
      collect('collect-loan-101', '400');

      component.back();

      expect(component.loanCollected()).toEqual({});
      expect(component.collectedTotal()).toBe(0);
    });
  });

  afterEach(() => {
    // Every spec answers the requests it provokes. An unanswered one means the component asked
    // for something the spec did not expect, which is worth failing on.
    http.verify({ ignoreCancelled: true });
  });
});
