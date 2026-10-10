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
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { LOAN_API } from '../../core/adapters';
import type { Loan, LoanPage } from '../../core/adapters';
import { LoansListComponent } from './loans-list.component';
import { provideFakeAdapters } from '../../testing/adapters';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { createSpyObj, SpyObj } from '../../testing/mocks';

/**
 * A loan as the adapter maps one, with only the status varying between cases.
 *
 * `value` is set to a non-English string on purpose in one test — see
 * "offers the action the flags describe, not the one the English text spells".
 */
function loan(status: Partial<Loan['status']>): Loan {
  return {
    id: 53,
    accountNo: '000000053',
    clientName: 'E2E Client',
    clientId: 1,
    loanProductName: 'E2E Product',
    status: {
      id: null,
      code: '',
      value: '',
      pendingApproval: false,
      waitingForDisbursal: false,
      active: false,
      closedObligationsMet: false,
      closedWrittenOff: false,
      closedRescheduled: false,
      closed: false,
      overpaid: false,
      ...status,
    },
  };
}

describe('LoansListComponent', () => {
  let component: LoansListComponent;
  let fixture: ComponentFixture<LoansListComponent>;
  let loanApi: SpyObj<{ list: (query?: unknown) => unknown }>;

  /**
   * Creates the component with `list()` already answering `loans`.
   *
   * The component subscribes in its constructor — `startWith({})` runs the query once with no
   * user input — so the answer has to be in place before `createComponent`, not after it.
   */
  function renderWith(...loans: Loan[]): void {
    const page: LoanPage = { items: loans, totalFilteredRecords: loans.length };
    loanApi.list.mockReturnValue(of(page));
    fixture = TestBed.createComponent(LoansListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Literal selectors, not interpolated: `unicorn/require-css-escape` forbids the latter. */
  const SELECTOR = {
    approve: '[data-testid="loan-list-approve-action"]',
    disburse: '[data-testid="loan-list-disburse-action"]',
  } as const;

  function actionCount(action: keyof typeof SELECTOR): number {
    return fixture.nativeElement.querySelectorAll(SELECTOR[action]).length;
  }

  beforeEach(async () => {
    loanApi = createSpyObj(['list']);

    await TestBed.configureTestingModule({
      imports: [LoansListComponent],
      providers: [
        provideNoopAnimations(),
        ...provideFakeAdapters().providers,
        // app-data-table renders this component's cell templates and still uses ngx-translate's
        // own `| translate` internally, so the library itself has to be configured.
        provideTranslateTesting(),
        { provide: LOAN_API, useValue: loanApi },
        { provide: Router, useValue: createSpyObj(['navigate']) },
        { provide: ActivatedRoute, useValue: {} },
      ],
    }).compileComponents();
  });

  describe('the per-row actions', () => {
    it('offers Approve on a loan awaiting approval, and no Disburse', () => {
      renderWith(loan({ pendingApproval: true, value: 'Submitted and pending approval' }));

      expect(actionCount('approve')).toBe(1);
      expect(actionCount('disburse')).toBe(0);
    });

    it('offers Disburse on an approved loan, and no Approve', () => {
      renderWith(loan({ waitingForDisbursal: true, value: 'Approved' }));

      expect(actionCount('disburse')).toBe(1);
      expect(actionCount('approve')).toBe(0);
    });

    it('offers neither on an active loan', () => {
      renderWith(loan({ active: true, value: 'Active' }));

      expect(actionCount('approve')).toBe(0);
      expect(actionCount('disburse')).toBe(0);
    });

    /**
     * The regression this file exists for.
     *
     * The gates used to read `loan.status?.value === 'Approved'` — a comparison against
     * Fineract's localisable display text, used as control flow. On a platform serving any
     * other locale the text does not match, so neither Approve nor Disburse was offered and
     * nothing said why. Nothing caught it either: these buttons sit in an
     * `<ng-template appCellTemplate>` whose `let-loan` context is `any`, so `strictTemplates`
     * never checked the field — which the generated model does not even declare.
     *
     * The flags are the same question asked in a way a locale cannot break.
     */
    it('offers the action the flags describe, not the one the English text spells', () => {
      renderWith(loan({ waitingForDisbursal: true, value: 'Approuvé' }));

      expect(actionCount('disburse')).toBe(1);
    });

    it('offers nothing when the status did not arrive at all', () => {
      // Every flag false. A loan whose status is unknown gets no action, rather than an action
      // that can only fail.
      renderWith(loan({}));

      expect(actionCount('approve')).toBe(0);
      expect(actionCount('disburse')).toBe(0);
    });
  });

  describe('the query it sends', () => {
    it('passes the search box to accountNo, which is what Fineract matches on', () => {
      renderWith(loan({ active: true }));

      component.onSearch('000000053');

      expect(loanApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ accountNo: '000000053' }),
      );
    });

    it('omits the status filter for "All", because Fineract rejects an empty status', () => {
      // `status=` and `status=All` both answer 400, so the "All" sentinel must not be forwarded.
      renderWith(loan({ active: true }));
      component.activeFilters.status = '';

      component.onFilterChange();

      expect(loanApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined }));
    });

    it('forwards a chosen status', () => {
      renderWith(loan({ active: true }));
      component.activeFilters.status = '300';

      component.onFilterChange();

      expect(loanApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: '300' }));
    });

    it('reports the total the server gave, which the paginator needs', () => {
      renderWith(loan({ active: true }), { ...loan({ active: true }), id: 54 });

      expect(component.totalRecords()).toBe(2);
      expect(component.loans()).toHaveLength(2);
    });
  });
});
