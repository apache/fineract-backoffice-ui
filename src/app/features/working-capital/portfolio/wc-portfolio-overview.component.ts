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

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';

import {
  I18N,
  TranslatePipe,
  WORKING_CAPITAL_LOAN_API,
  summarisePortfolio,
  type WorkingCapitalLoanSnapshot,
} from '../../../core/adapters';
import { LoadErrorComponent } from '../../../shared';
import { CardComponent } from '../../../ui/card/card.component';
import { BarChartComponent } from '../../../shared/components/charts/bar-chart.component';
import {
  DonutChartComponent,
  type ChartData,
} from '../../../shared/components/charts/donut-chart.component';
import { ThemeService } from '../../../core/services/theme.service';
import { SpinnerComponent } from '../../../ui/spinner/spinner.component';

/**
 * Chart steps, selected per theme rather than flipped.
 *
 * The aging bands are an *ordinal* ramp: one hue, light to dark, so "older" reads as "darker"
 * without asking the reader to learn five hues. The statuses are categorical, taking the fixed
 * slot order, and a remainder beyond the slots becomes one deliberately neutral "Other" rather
 * than a generated sixth hue.
 *
 * Both sets were checked with the data-visualisation validator against each surface — ordinal
 * mode for the ramp (monotone lightness, visible step gaps, light end clearing the surface) and
 * categorical mode for the statuses (lightness band, chroma floor, colour-vision separation).
 * The light categorical steps sit below 3:1 on the light surface, which obliges a non-colour
 * reading of the same data: each chart is paired with the table it summarises, and the donut
 * labels every slice.
 *
 * The palette the dashboard's existing donuts use was measured too and does not pass — one of
 * its four steps reads as grey — so it is deliberately not extended here.
 */
const AGING_STEPS_LIGHT = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];
const AGING_STEPS_DARK = ['#cde2fb', '#9ec5f4', '#5598e7', '#2a78d6', '#184f95'];
const STATUS_STEPS_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
const STATUS_STEPS_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
/** Outside the categorical slots on purpose: "Other" is an absence of identity, not one more. */
const OTHER_LIGHT = '#52514e';
const OTHER_DARK = '#c3c2b7';

/**
 * The working-capital book at portfolio level.
 *
 * Every other screen in this module is one loan or one piece of reference data, so nothing told
 * an operator what the book as a whole looks like: how much is outstanding, how much of it is
 * delinquent, and how that delinquency ages. This is the only screen that reads across loans.
 *
 * It states figures the platform states per loan and adds them up — see `summarisePortfolio`,
 * which holds the arithmetic and is tested on its own. In particular it does not claim which
 * loans are "in breach": that is a judgement the module's payload does not make, and the one
 * breach figure it does name (`breachPastDueAmount`) is reported under that name.
 */
@Component({
  selector: 'app-wc-portfolio-overview',
  standalone: true,
  imports: [
    RouterModule,
    DecimalPipe,
    TranslatePipe,
    LoadErrorComponent,
    SpinnerComponent,
    BarChartComponent,
    DonutChartComponent,
    CardComponent,
  ],
  template: `
    <div class="overview-container">
      <h1 class="page-title">{{ 'WC_PORTFOLIO.TITLE' | appTranslate }}</h1>

      @if (loadError()) {
        <app-load-error
          testId="wc-portfolio-load-error"
          [message]="'WC_PORTFOLIO.LOAD_FAILED' | appTranslate"
          [actionLabel]="'COMMON.RETRY' | appTranslate"
          (action)="load()"
        ></app-load-error>
      } @else if (isLoading()) {
        <app-spinner data-testid="wc-portfolio-loading" />
      } @else if (summary().loans === 0) {
        <app-card>
          <p data-testid="wc-portfolio-empty">{{ 'WC_PORTFOLIO.EMPTY' | appTranslate }}</p>
        </app-card>
      } @else {
        <div class="tiles">
          <section class="tile" data-testid="wc-tile-loans">
            <h2 class="tile-label">{{ 'WC_PORTFOLIO.LOANS' | appTranslate }}</h2>
            <div class="tile-body">
              <span class="figure">{{ summary().loans | number }}</span>
            </div>
          </section>

          <section class="tile" data-testid="wc-tile-outstanding">
            <h2 class="tile-label">{{ 'WC_PORTFOLIO.OUTSTANDING' | appTranslate }}</h2>
            <div class="tile-body">
              <span class="figure">{{ summary().outstanding | number: '1.2-2' }}</span>
              <span class="currency">{{ currencyLabel() }}</span>
            </div>
          </section>

          <section class="tile" data-testid="wc-tile-delinquent">
            <h2 class="tile-label">{{ 'WC_PORTFOLIO.DELINQUENT' | appTranslate }}</h2>
            <div class="tile-body">
              <span class="figure">{{ summary().delinquentAmount | number: '1.2-2' }}</span>
              <span class="detail">{{
                'WC_PORTFOLIO.ACROSS_LOANS' | appTranslate: { count: summary().delinquentLoans }
              }}</span>
            </div>
          </section>

          <section class="tile" data-testid="wc-tile-breach-past-due">
            <h2 class="tile-label">{{ 'WC_PORTFOLIO.BREACH_PAST_DUE' | appTranslate }}</h2>
            <div class="tile-body">
              <span class="figure">{{ summary().breachPastDueAmount | number: '1.2-2' }}</span>
              <span class="detail">{{
                'WC_PORTFOLIO.ACROSS_LOANS' | appTranslate: { count: summary().breachPastDueLoans }
              }}</span>
            </div>
          </section>

          <section class="tile" data-testid="wc-tile-flagged">
            <h2 class="tile-label">{{ 'WC_PORTFOLIO.FLAGGED' | appTranslate }}</h2>
            <div class="tile-body">
              <span class="figure">{{ summary().chargedOffLoans | number }}</span>
              <span class="detail">{{
                'WC_PORTFOLIO.CHARGED_OFF_AND_FRAUD' | appTranslate: { fraud: summary().fraudLoans }
              }}</span>
            </div>
          </section>
        </div>

        <app-card heading="WC_PORTFOLIO.AGING_TITLE">
          <app-bar-chart [data]="agingChart()" data-testid="wc-aging-chart"></app-bar-chart>
          <table class="overview-table" data-testid="wc-portfolio-aging">
            <caption class="sr-only">
              {{
                'WC_PORTFOLIO.AGING_TITLE' | appTranslate
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">{{ 'WC_PORTFOLIO.AGING_BAND' | appTranslate }}</th>
                <th scope="col" class="numeric">{{ 'WC_PORTFOLIO.LOANS' | appTranslate }}</th>
                <th scope="col" class="numeric">
                  {{ 'WC_PORTFOLIO.OUTSTANDING' | appTranslate }}
                </th>
                <th scope="col" class="numeric">
                  {{ 'WC_PORTFOLIO.DELINQUENT' | appTranslate }}
                </th>
              </tr>
            </thead>
            <tbody>
              @for (row of summary().aging; track row.key) {
                <tr [attr.data-testid]="'wc-aging-' + row.key">
                  <th scope="row">{{ row.labelKey | appTranslate }}</th>
                  <td class="numeric">{{ row.loans | number }}</td>
                  <td class="numeric">{{ row.outstanding | number: '1.2-2' }}</td>
                  <td class="numeric">{{ row.delinquentAmount | number: '1.2-2' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </app-card>

        <app-card heading="WC_PORTFOLIO.BY_STATUS">
          <app-donut-chart [data]="statusChart()" data-testid="wc-status-chart"></app-donut-chart>
          <table class="overview-table" data-testid="wc-portfolio-status">
            <caption class="sr-only">
              {{
                'WC_PORTFOLIO.BY_STATUS' | appTranslate
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">{{ 'WC_LOANS.STATUS' | appTranslate }}</th>
                <th scope="col" class="numeric">{{ 'WC_PORTFOLIO.LOANS' | appTranslate }}</th>
                <th scope="col" class="numeric">
                  {{ 'WC_PORTFOLIO.OUTSTANDING' | appTranslate }}
                </th>
              </tr>
            </thead>
            <tbody>
              @for (row of summary().byStatus; track row.status) {
                <tr>
                  <th scope="row">
                    {{ row.status || ('WC_PORTFOLIO.STATUS_UNKNOWN' | appTranslate) }}
                  </th>
                  <td class="numeric">{{ row.loans | number }}</td>
                  <td class="numeric">{{ row.outstanding | number: '1.2-2' }}</td>
                </tr>
              }
            </tbody>
          </table>
          <a class="all-loans" routerLink="/working-capital/loans" data-testid="wc-all-loans">
            {{ 'WC_PORTFOLIO.VIEW_ALL_LOANS' | appTranslate }}
          </a>
        </app-card>
      }
    </div>
  `,
  styles: [
    `
      .overview-container {
        padding: 24px;
        max-width: 1100px;
        margin: 0 auto;
      }
      .page-title {
        font-size: 1.4rem;
        margin: 0 0 16px;
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }
      .tile {
        background: var(--ion-card-background, #fff);
        border: 1px solid var(--ion-color-light-shade, #d7d8da);
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
      }
      .tile-label,
      .figure {
        display: block;
        font-size: 1.5rem;
        font-weight: 600;
      }
      .currency,
      .detail {
        display: block;
        font-size: 0.8125rem;
        color: var(--ion-color-medium, #92949c);
      }
      .overview-table {
        width: 100%;
        border-collapse: collapse;
      }
      .overview-table th,
      .overview-table td {
        text-align: start;
        padding: 8px 12px;
        border-bottom: 1px solid var(--ion-color-light-shade, #d7d8da);
      }
      .overview-table .numeric {
        text-align: end;
        font-variant-numeric: tabular-nums;
      }
      .all-loans {
        display: inline-block;
        margin-top: 12px;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
    `,
  ],
})
export class WcPortfolioOverviewComponent implements OnInit {
  private readonly portfolio = inject(WORKING_CAPITAL_LOAN_API);
  private readonly theme = inject(ThemeService);
  private readonly i18n = inject(I18N);

  readonly loans = signal<WorkingCapitalLoanSnapshot[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal(false);

  readonly summary = computed(() => summarisePortfolio(this.loans()));

  /** Blank on a mixed-currency book, where a single code would mislabel the totals. */
  readonly currencyLabel = computed(() => this.summary().currencyCode ?? '');

  /**
   * Loan counts per aging band.
   *
   * Counts rather than amounts, because the table beside it already carries outstanding and
   * delinquent money: charting one of those here would put two scales in one picture, and what
   * a reader wants from the shape is how many loans are drifting, not a second total.
   */
  readonly agingChart = computed<ChartData[]>(() => {
    const steps = this.theme.isDarkMode() ? AGING_STEPS_DARK : AGING_STEPS_LIGHT;
    return this.summary().aging.map((row, index) => ({
      label: this.translate(row.labelKey),
      value: row.loans,
      color: steps[index] ?? steps.at(-1)!,
    }));
  });

  /**
   * Loan counts per status, never more slices than there are categorical slots.
   *
   * A sixth status is not a sixth hue: the remainder folds into one deliberately neutral
   * "Other". `byStatus` is ordered by loan count, so the slots go to the largest statuses and a
   * status keeps its colour as long as it keeps its rank — the limit of what a fixed-order
   * palette can promise against a book that changes.
   */
  readonly statusChart = computed<ChartData[]>(() => {
    const dark = this.theme.isDarkMode();
    const steps = dark ? STATUS_STEPS_DARK : STATUS_STEPS_LIGHT;
    const rows = this.summary().byStatus;
    const named = rows.slice(0, steps.length).map((row, index) => ({
      label: row.status || this.translate('WC_PORTFOLIO.STATUS_UNKNOWN'),
      value: row.loans,
      color: steps[index]!,
    }));
    const rest = rows.slice(steps.length);
    if (rest.length === 0) {
      return named;
    }
    return [
      ...named,
      {
        label: this.translate('WC_PORTFOLIO.OTHER'),
        value: rest.reduce((total, row) => total + row.loans, 0),
        color: dark ? OTHER_DARK : OTHER_LIGHT,
      },
    ];
  });

  /**
   * Translates inside a computed, reading the current language first so the charts re-label when
   * it changes. The chart components take plain label strings, and these two mix status names
   * the platform supplies with keys of our own, so the pipe's key-only path cannot carry both.
   */
  private translate(key: string): string {
    this.i18n.currentLang();
    return this.i18n.translate(key);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(false);
    this.portfolio.listLoans().subscribe({
      next: (loans) => {
        this.loans.set(loans);
        this.isLoading.set(false);
      },
      error: () => {
        // An empty overview and a failed one look identical once the spinner stops, and this
        // screen's whole job is to be trusted as a total.
        this.loans.set([]);
        this.loadError.set(true);
        this.isLoading.set(false);
      },
    });
  }
}
