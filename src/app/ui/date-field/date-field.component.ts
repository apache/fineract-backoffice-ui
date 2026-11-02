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

import { Component, forwardRef, input, signal } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { IonDatetime, IonItem, IonModal, IonNote } from '@ionic/angular/standalone';

import { TranslatePipe } from '../../core/adapters';
import { ButtonComponent } from '../button/button.component';
import { DeferredDatetimeButtonComponent } from '../deferred-datetime-button/deferred-datetime-button.component';

let nextId = 0;

/**
 * One date field: the `ion-datetime-button` + `ion-modal` + `ion-datetime` triad, once.
 *
 * 59 components write this block by hand, and it is the most error-prone of them — #287 names
 * it separately for that reason. Three hazards live in it:
 *
 * - the button resolves its picker by id in `componentWillLoad`, so it must not mount before
 *   the picker exists (#544, #548). Handled by composing `app-deferred-datetime-button`, which
 *   already solves it per instance rather than per page.
 * - an unset picker renders *today's date* on its button, which reads as a value the user never
 *   chose. Three forms hand-roll a `date-target` placeholder to fix it; here it is the default
 *   whenever there is no value.
 * - nothing associates the visible label with the control. Unlike a text field there is no
 *   `label` property to slot into — the focusable element is a button whose accessible name
 *   would be the date it shows — so the label is referenced by `aria-labelledby`.
 *
 * ## Why this one owns its value
 *
 * `app-form-field` deliberately projects its control, because 574 `[(ngModel)]` bindings would
 * otherwise change shape. A date triad cannot be projected: it is three elements that have to
 * know each other's ids. So this is a `ControlValueAccessor` instead — `name` and
 * `[(ngModel)]` work on it exactly as they did on the `ion-datetime` inside, and template-driven
 * validity, `required` and touched state keep working.
 */
@Component({
  selector: 'app-date-field',
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonComponent,
    DeferredDatetimeButtonComponent,
    IonDatetime,
    IonItem,
    IonModal,
    IonNote,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateFieldComponent),
      multi: true,
    },
  ],
  template: `
    <div class="field">
      <ion-item fill="outline" [attr.aria-describedby]="null">
        <span class="field-label" [id]="labelId">
          <span>{{ label() | appTranslate }}</span>
          @if (required()) {
            <span class="required-marker" aria-hidden="true">*</span>
          }
        </span>

        <app-deferred-datetime-button
          [datetimeId]="pickerId()"
          [disabled]="disabled()"
          [ariaLabelledby]="labelId"
          [placeholder]="value() ? '' : (notSetLabel() | appTranslate)"
        ></app-deferred-datetime-button>

        <ion-modal [keepContentsMounted]="true">
          <ng-template>
            <ion-datetime
              [id]="pickerId()"
              [attr.data-testid]="testId() || pickerId()"
              presentation="date"
              [value]="value()"
              [disabled]="disabled()"
              [max]="max() || undefined"
              [min]="min() || undefined"
              (ionChange)="onPicked($event)"
            ></ion-datetime>
          </ng-template>
        </ion-modal>

        @if (clearable() && value()) {
          <app-button
            type="button"
            intent="neutral"
            emphasis="quiet"
            size="small"
            [attr.data-testid]="'clear-' + pickerId()"
            [disabled]="disabled()"
            (click)="onClear()"
            >{{ clearLabel() | appTranslate }}</app-button
          >
        }
      </ion-item>
      @if (showError()) {
        <ion-note
          color="danger"
          class="field-error"
          role="alert"
          [attr.data-testid]="errorTestId()"
          >{{ errorKey() | appTranslate }}</ion-note
        >
      }
    </div>
  `,
  styles: [
    `
      .field {
        display: block;
      }
      .field-label {
        display: block;
        font-size: 0.75rem;
        color: var(--ion-color-medium-shade, #808289);
        margin-bottom: 4px;
      }
      .required-marker {
        color: var(--ion-color-danger, #eb445a);
        margin-inline-start: 2px;
      }
      .field-error {
        display: block;
        padding-inline-start: 4px;
        font-size: 0.8125rem;
      }
    `,
  ],
})
export class DateFieldComponent implements ControlValueAccessor {
  /** Translation key for the label. */
  readonly label = input.required<string>();
  readonly required = input(false);
  /**
   * Id for this instance's `ion-datetime`. Must be unique on the page, because the button
   * resolves its picker through `getElementById`.
   */
  readonly pickerId = input.required<string>();
  /** `data-testid` for the picker; defaults to the picker id, as the hand-written blocks used. */
  readonly testId = input('');
  /** Shown on the button while there is no value, instead of today's date. */
  readonly notSetLabel = input('COMMON.NOT_SET');
  /** Offers a clear action once a value is set. */
  readonly clearable = input(false);
  readonly clearLabel = input('COMMON.CLEAR');
  readonly max = input('');
  readonly min = input('');
  readonly showError = input<boolean | null>(false);
  readonly errorKey = input('COMMON.REQUIRED');
  readonly errorTestId = input<string | null>(null);

  /** Stable per instance, so the label can be referenced by id. */
  protected readonly labelId = `app-date-field-label-${nextId++}`;

  protected readonly value = signal<string | null>(null);
  protected readonly disabled = signal(false);

  private onChangeFn: (value: string | null) => void = () => undefined;
  private onTouchedFn: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onPicked(event: CustomEvent): void {
    if (this.disabled()) return;
    const picked = (event.detail as { value?: string | string[] | null }).value;
    // `ion-datetime` can answer an array for multi-date presentations; this one is a single day.
    const next = Array.isArray(picked) ? (picked[0] ?? null) : (picked ?? null);
    this.value.set(next);
    this.onChangeFn(next);
    this.onTouchedFn();
  }

  protected onClear(): void {
    if (this.disabled()) return;
    this.value.set(null);
    this.onChangeFn(null);
    this.onTouchedFn();
  }
}
