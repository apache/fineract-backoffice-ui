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
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  WORKING_CAPITAL_LOAN_API,
  type WorkingCapitalLoanSnapshot,
  type WorkingCapitalLoanApi,
} from '../../../core/adapters';
import { provideFakeAdapters } from '../../../testing/adapters';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { ThemeService } from '../../../core/services/theme.service';
import { WcPortfolioOverviewComponent } from './wc-portfolio-overview.component';

function loan(overrides: Partial<WorkingCapitalLoanSnapshot> = {}): WorkingCapitalLoanSnapshot {
  return {
    id: 1,
    accountNo: '000000001',
    clientId: 7,
    clientName: 'Synthetic Client',
    status: 'Active',
    currencyCode: 'USD',
    principal: 1000,
    outstanding: 800,
    delinquentAmount: 0,
    delinquentDays: 0,
    breachPastDueAmount: 0,
    chargedOff: false,
    fraud: false,
    ...overrides,
  };
}

describe('WcPortfolioOverviewComponent', () => {
  let fixture: ComponentFixture<WcPortfolioOverviewComponent>;
  let component: WcPortfolioOverviewComponent;
  let listLoans: ReturnType<typeof vi.fn>;

  async function setup(api: Partial<WorkingCapitalLoanApi> = {}): Promise<void> {
    listLoans = vi.fn().mockReturnValue(of([loan()]));
    await TestBed.configureTestingModule({
      imports: [WcPortfolioOverviewComponent],
      providers: [
        ...provideFakeAdapters().providers,
        ...provideTranslateTesting(),
        provideIonicTesting(),
        // `routerLink` on the loans link needs the router's own providers, not a Router stub.
        provideRouter([]),
        { provide: WORKING_CAPITAL_LOAN_API, useValue: { listLoans, ...api } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WcPortfolioOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const query = (selector: string) => fixture.nativeElement.querySelector(selector);
  const text = (selector: string) => query(selector)?.textContent?.replaceAll(/\s+/g, ' ').trim();

  it('states the portfolio totals the platform reports per loan', async () => {
    await setup({
      listLoans: vi
        .fn()
        .mockReturnValue(
          of([
            loan({ outstanding: 800, delinquentAmount: 100, delinquentDays: 10 }),
            loan({ id: 2, outstanding: 250 }),
          ]),
        ),
    });

    expect(text('[data-testid="wc-tile-loans"]')).toContain('2');
    expect(text('[data-testid="wc-tile-outstanding"]')).toContain('1,050.00');
    expect(text('[data-testid="wc-tile-outstanding"]')).toContain('USD');
    expect(text('[data-testid="wc-tile-delinquent"]')).toContain('100.00');
    expect(query('[data-testid="wc-portfolio-aging"]')).not.toBeNull();
    expect(query('[data-testid="wc-portfolio-status"]')).not.toBeNull();
  });

  it('bands the book by days delinquent', async () => {
    await setup({
      listLoans: vi
        .fn()
        .mockReturnValue(
          of([
            loan({ outstanding: 100 }),
            loan({ id: 2, outstanding: 200, delinquentDays: 45, delinquentAmount: 20 }),
          ]),
        ),
    });

    expect(text('[data-testid="wc-aging-current"]')).toContain('100.00');
    expect(text('[data-testid="wc-aging-d31to60"]')).toContain('200.00');
    expect(text('[data-testid="wc-aging-d90plus"]')).toContain('0.00');
  });

  it('labels nothing with a currency when the book spans more than one', async () => {
    await setup({
      listLoans: vi
        .fn()
        .mockReturnValue(of([loan({ currencyCode: 'USD' }), loan({ id: 2, currencyCode: 'EUR' })])),
    });

    // A total that mixes currencies means nothing; stamping it "USD" would be a false label.
    expect(text('[data-testid="wc-tile-outstanding"]')).not.toContain('USD');
    expect(component.currencyLabel()).toBe('');
  });

  it('says the book is empty rather than showing zeroes as if they were totals', async () => {
    await setup({ listLoans: vi.fn().mockReturnValue(of([])) });

    expect(query('[data-testid="wc-portfolio-empty"]')).not.toBeNull();
    expect(query('[data-testid="wc-tile-outstanding"]')).toBeNull();
  });

  it('shows an error state with a retry when the read fails', async () => {
    const failing = vi.fn().mockReturnValue(throwError(() => new Error('network')));
    await setup({ listLoans: failing });

    // Totals are the screen's whole claim, so a failed read must not render as a zeroed book.
    expect(query('[data-testid="wc-portfolio-load-error"]')).not.toBeNull();
    expect(query('[data-testid="wc-portfolio-empty"]')).toBeNull();
    expect(component.loadError()).toBe(true);

    failing.mockReturnValue(of([loan()]));
    component.load();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loadError()).toBe(false);
    expect(query('[data-testid="wc-portfolio-load-error"]')).toBeNull();
    expect(text('[data-testid="wc-tile-loans"]')).toContain('1');
  });

  describe('charts', () => {
    it('charts loan counts per aging band, in band order and one hue', async () => {
      await setup({
        listLoans: vi
          .fn()
          .mockReturnValue(
            of([
              loan({ delinquentDays: 0 }),
              loan({ id: 2, delinquentDays: 0 }),
              loan({ id: 3, delinquentDays: 45 }),
            ]),
          ),
      });

      const bars = component.agingChart();
      expect(bars).toHaveLength(5);
      expect(bars.map((bar) => bar.value)).toEqual([2, 0, 1, 0, 0]);
      // Counts, not money: the table beside it carries the amounts, and two scales in one
      // picture is the mistake this avoids.
      expect(bars[0].value).toBe(2);
      // One hue, light to dark, so the band order is readable without learning five colours.
      expect(new Set(bars.map((bar) => bar.color)).size).toBe(5);
      expect(bars[0].color).toBe('#86b6ef');
      expect(bars.at(-1)!.color).toBe('#104281');
    });

    it('gives each status a fixed slot and folds the rest into one neutral Other', async () => {
      await setup({
        listLoans: vi
          .fn()
          .mockReturnValue(
            of([
              loan({ status: 'Active' }),
              loan({ id: 2, status: 'Approved' }),
              loan({ id: 3, status: 'Closed' }),
              loan({ id: 4, status: 'Overpaid' }),
              loan({ id: 5, status: 'Written off' }),
              loan({ id: 6, status: 'Rejected' }),
              loan({ id: 7, status: 'Withdrawn' }),
            ]),
          ),
      });

      const slices = component.statusChart();
      // Five categorical slots plus the remainder: a sixth status is never a sixth hue.
      expect(slices).toHaveLength(6);
      expect(slices.at(-1)!.label).toBe('WC_PORTFOLIO.OTHER');
      expect(slices.at(-1)!.value).toBe(2);
      expect(slices.at(-1)!.color).toBe('#52514e');
      expect(slices.slice(0, 5).map((slice) => slice.color)).toEqual([
        '#2a78d6',
        '#eb6834',
        '#1baf7a',
        '#eda100',
        '#e87ba4',
      ]);
      // Every slice is identified in the data, so the reading never depends on colour alone.
      expect(slices.every((slice) => slice.label.length > 0)).toBe(true);
    });

    it('names a status the platform did not send', async () => {
      await setup({ listLoans: vi.fn().mockReturnValue(of([loan({ status: null })])) });

      expect(component.statusChart()[0].label).toBe('WC_PORTFOLIO.STATUS_UNKNOWN');
    });

    it('selects dark-mode steps rather than flipping the light ones', async () => {
      await setup();
      TestBed.inject(ThemeService).isDarkMode.set(true);

      // Each mode's steps were validated against its own surface; the dark ramp is not the
      // light one inverted.
      expect(component.agingChart()[0].color).toBe('#cde2fb');
      expect(component.statusChart()[0].color).toBe('#3987e5');
    });

    it('renders both charts beside the tables that carry the same figures', async () => {
      await setup();

      expect(query('[data-testid="wc-aging-chart"]')).not.toBeNull();
      expect(query('[data-testid="wc-status-chart"]')).not.toBeNull();
      // The light categorical steps sit under 3:1, so the table is the obligatory relief.
      expect(query('[data-testid="wc-portfolio-aging"]')).not.toBeNull();
      expect(query('[data-testid="wc-portfolio-status"]')).not.toBeNull();
    });
  });

  it('links through to the loans list', async () => {
    await setup();

    expect(query('[data-testid="wc-all-loans"]').getAttribute('href')).toBe(
      '/working-capital/loans',
    );
  });
});
