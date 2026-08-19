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

import { Component, computed, input } from '@angular/core';

import { ChartData } from './donut-chart.component';

/**
 * A horizontal bar chart over the same {@link ChartData} the donut chart takes.
 *
 * Fineract declares exactly two chart sub-types, `Bar` and `Pie`; the donut chart already served
 * `Pie`, so this is the other half rather than a second charting approach. Bars are laid out as
 * elements rather than as an SVG path so that the category label, which is a report value and can
 * be arbitrarily long, wraps and stays readable at a narrow width.
 */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [],
  template: `
    <div class="chart-container" role="img" [attr.aria-label]="summary()">
      @for (bar of bars(); track bar.label) {
        <div class="bar-row">
          <span class="label" [title]="bar.label">{{ bar.label }}</span>
          <span class="track">
            <span class="fill" [style.width.%]="bar.width" [style.background-color]="bar.color">
            </span>
          </span>
          <span class="value">{{ bar.value }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .chart-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
      }
      .bar-row {
        display: grid;
        grid-template-columns: minmax(80px, 1fr) 3fr auto;
        align-items: center;
        gap: 12px;
        font-size: 12px;
      }
      .label {
        color: var(--text-muted, #666);
        overflow-wrap: anywhere;
      }
      .track {
        background: var(--track-bg, rgba(128, 128, 128, 0.15));
        border-radius: 4px;
        height: 14px;
        overflow: hidden;
      }
      .fill {
        display: block;
        height: 100%;
        border-radius: 4px;
        transition: width 0.2s;
      }
      .value {
        font-weight: 600;
        color: var(--text-color, #333);
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      @media (max-width: 600px) {
        .bar-row {
          grid-template-columns: 1fr 2fr auto;
        }
      }
    `,
  ],
})
export class BarChartComponent {
  readonly data = input<ChartData[], ChartData[] | null | undefined>([], {
    transform: (value) => value ?? [],
  });

  /**
   * Bars are scaled against the largest value rather than against the total, which is what makes
   * a bar chart readable when one category dominates. Negative values are possible in a report
   * (a variance column, say) so the scale is taken from the largest magnitude.
   */
  readonly bars = computed(() => {
    const data = this.data();
    const peak = Math.max(...data.map((item) => Math.abs(item.value)), 0);

    return data.map((item) => ({
      ...item,
      width: peak === 0 ? 0 : (Math.abs(item.value) / peak) * 100,
    }));
  });

  /** A chart is opaque to a screen reader, so the series is also stated in words. */
  readonly summary = computed(() =>
    this.data()
      .map((item) => `${item.label}: ${item.value}`)
      .join(', '),
  );
}
