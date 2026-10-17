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

import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe } from '../../core/adapters';
import { ButtonComponent } from '../../ui/button/button.component';
import { DepositChartSlab, emptySlab, slabsAreComplete } from './deposit-chart';

/** A chart period type, as `chartTemplate.periodTypes` offers one. */
export interface ChartPeriodTypeOption {
  readonly id?: number;
  readonly code?: string;
  readonly value?: string;
}

/**
 * The interest rate chart of a fixed or recurring deposit product, made visible and editable.
 *
 * ## Why this exists
 *
 * A term deposit product *is* its rate chart. Before this, neither product form showed one:
 * both sent a hard-coded single slab at 5% for 1–60 months from the browser's today, which the
 * user never saw. An administrator configuring a 7% two-year product got a 5% five-year one, and
 * every account opened under it inherited that rate. Issue #765.
 *
 * ## Native controls, not Ionic
 *
 * ADR 0005 puts `@ionic/angular/standalone` out of bounds for new files and `src/app/ui` has no
 * input or select primitive yet (#287, #684). The third option is the one `_common.scss`
 * documents under `.form-field`: native controls, styled once, as `login.component.ts` has always
 * used. That is what this does, which is also why it can be shared by both product forms instead
 * of being duplicated inline in each — they are the two files where Ionic markup would have been
 * allowed, and duplicating a rate editor across them would have been the worse trade.
 *
 * ## Validity is reported, not registered
 *
 * `NgModel` resolves its `ControlContainer` through the host injector, so controls inside this
 * component's own template cannot join the parent `ngForm` even though they sit inside the form
 * element — Angular says so with NG01354. Rather than wire them in with `viewProviders`, each
 * control is declared `standalone`, which is the framework's other suggestion and the honest one
 * here: the component reports {@link complete} and the parent disables its own submit on it, so
 * the parent keeps one source of truth for "can this be saved" and the console stays quiet.
 */
@Component({
  selector: 'app-deposit-chart-editor',
  standalone: true,
  imports: [FormsModule, TranslatePipe, ButtonComponent],
  template: `
    <section class="chart-editor">
      <header class="chart-editor__header">
        <h3>
          {{ 'PRODUCTS.INTEREST_RATE_CHART' | appTranslate }}
          <span class="required-marker" aria-hidden="true">*</span>
        </h3>
        <p class="chart-editor__hint">{{ 'PRODUCTS.CHART_HINT' | appTranslate }}</p>
      </header>

      @if (slabs().length === 0) {
        <p class="chart-editor__empty" data-testid="chart-empty">
          {{ 'PRODUCTS.CHART_EMPTY' | appTranslate }}
        </p>
      }

      @for (slab of slabs(); track $index) {
        <div class="chart-editor__row" [attr.data-testid]="'chart-slab-' + $index">
          <div class="form-field">
            <label [attr.for]="'slab-period-type-' + $index">
              {{ 'PRODUCTS.PERIOD_TYPE' | appTranslate }}
            </label>
            <select
              [attr.id]="'slab-period-type-' + $index"
              [attr.data-testid]="'slab-period-type-' + $index"
              [ngModel]="slab.periodType"
              (ngModelChange)="patch($index, { periodType: +$event })"
              [name]="'slabPeriodType' + $index"
              [ngModelOptions]="{ standalone: true }"
            >
              @for (option of periodTypes(); track option.id) {
                <option [value]="option.id">{{ option.value }}</option>
              }
            </select>
          </div>

          <div class="form-field">
            <label [attr.for]="'slab-from-' + $index">
              {{ 'PRODUCTS.FROM_PERIOD' | appTranslate }}
              <span class="required-marker" aria-hidden="true">*</span>
            </label>
            <input
              type="number"
              min="0"
              [attr.id]="'slab-from-' + $index"
              [attr.data-testid]="'slab-from-' + $index"
              [ngModel]="slab.fromPeriod"
              (ngModelChange)="patch($index, { fromPeriod: numberOrUndefined($event) })"
              [name]="'slabFrom' + $index"
              [ngModelOptions]="{ standalone: true }"
              required
            />
          </div>

          <div class="form-field">
            <label [attr.for]="'slab-to-' + $index">
              {{ 'PRODUCTS.TO_PERIOD' | appTranslate }}
            </label>
            <input
              type="number"
              min="0"
              [attr.id]="'slab-to-' + $index"
              [attr.data-testid]="'slab-to-' + $index"
              [ngModel]="slab.toPeriod"
              (ngModelChange)="patch($index, { toPeriod: numberOrUndefined($event) })"
              [name]="'slabTo' + $index"
              [ngModelOptions]="{ standalone: true }"
            />
          </div>

          <div class="form-field">
            <label [attr.for]="'slab-rate-' + $index">
              {{ 'PRODUCTS.ANNUAL_INTEREST_RATE' | appTranslate }}
              <span class="required-marker" aria-hidden="true">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              [attr.id]="'slab-rate-' + $index"
              [attr.data-testid]="'slab-rate-' + $index"
              [ngModel]="slab.annualInterestRate"
              (ngModelChange)="patch($index, { annualInterestRate: numberOrUndefined($event) })"
              [name]="'slabRate' + $index"
              [ngModelOptions]="{ standalone: true }"
              required
            />
          </div>

          <app-button
            type="button"
            intent="danger"
            emphasis="quiet"
            icon="trash-outline"
            [attr.data-testid]="'slab-remove-' + $index"
            [label]="'COMMON.DELETE' | appTranslate"
            (click)="remove($index)"
          />
        </div>
      }

      <app-button
        type="button"
        emphasis="quiet"
        icon="add-outline"
        data-testid="slab-add"
        [label]="'PRODUCTS.ADD_SLAB' | appTranslate"
        (click)="add()"
      />
    </section>
  `,
  styles: [
    `
      .chart-editor {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
      }
      .chart-editor__header h3 {
        margin: 0;
        font-size: 1rem;
      }
      .chart-editor__hint,
      .chart-editor__empty {
        margin: 4px 0 0;
        font-size: 0.8rem;
        color: var(--text-muted);
      }
      .chart-editor__row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr));
        gap: 12px;
        align-items: end;
      }
      .required-marker {
        color: var(--ion-color-danger, #c0392b);
        margin-left: 2px;
      }
    `,
  ],
})
export class DepositChartEditorComponent {
  /** From `chartTemplate.periodTypes` on the product template: days, weeks, months, years. */
  readonly periodTypes = input<readonly ChartPeriodTypeOption[]>([]);

  readonly slabs = model<DepositChartSlab[]>([]);

  /** Whether the chart can be sent. The parent disables its submit on this — see the class note. */
  readonly complete = computed(() => slabsAreComplete(this.slabs()));

  add(): void {
    this.slabs.update((slabs) => [...slabs, emptySlab()]);
  }

  remove(index: number): void {
    this.slabs.update((slabs) => slabs.filter((_, position) => position !== index));
  }

  patch(index: number, change: Partial<DepositChartSlab>): void {
    this.slabs.update((slabs) =>
      slabs.map((slab, position) => (position === index ? { ...slab, ...change } : slab)),
    );
  }

  /**
   * An empty number field reads as `undefined`, not 0.
   *
   * Zero is a rate an institution might actually mean, so it cannot double as "not filled in" —
   * `chartForRequest` drops a slab with no rate and the submit stays disabled until one is given.
   */
  numberOrUndefined(value: unknown): number | undefined {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
}
