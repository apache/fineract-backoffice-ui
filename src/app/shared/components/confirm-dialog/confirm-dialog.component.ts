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

import { computed, inject, input, signal, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  ModalController,
} from '@ionic/angular/standalone';

export interface ConfirmDialogData {
  title: string;
  message: string;
  details?: { label: string; value: string }[];
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  /**
   * Values to collect before confirming. Empty or absent, this is a plain confirmation.
   *
   * Here rather than in a dialog of its own because every alternative was worse. The operations
   * that need this — pay a charge, waive one, adjust one, on a loan, a savings account or a
   * client — each need an amount or a date and nothing more, and they are issued from list
   * screens that have no form on them. A component per operation would be six near-identical
   * dialogs; a form in each list screen would be three. Neither can be written at all under
   * ADR 0005 and ADR 0006: a new file may not import `@ionic/angular/standalone`, there is no
   * form primitive in `src/app/ui` yet (issues #287 and #684), and `eslint-suppressions.json`
   * may only shrink. This file already imports Ionic, so the fields go where the buttons are.
   */
  fields?: readonly DialogField[];
}

/** One value a dialog collects. */
export interface DialogField {
  /** The key this field's value is returned under. */
  readonly name: string;
  /** Already translated: the dialog does not know the caller's keys. */
  readonly label: string;
  readonly type: 'number' | 'text' | 'date' | 'select';
  readonly value?: string | number;
  /** Defaults to required. A field the platform demands is the normal case here. */
  readonly optional?: boolean;
  /** For `select` only: what there is to choose from. Labels are already translated. */
  readonly options?: readonly DialogFieldOption[];
}

/** One choice in a `select` field. */
export interface DialogFieldOption {
  readonly id: string | number;
  readonly name: string;
}

/** What a dialog with fields resolves to: the values, by field name. */
export type DialogValues = Record<string, string | number>;

/**
 * Confirmation modal. Prefer opening it through `DialogService.confirm()` rather than
 * instantiating it directly.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
  ],
  template: `
    <div class="dialog">
      <h2 class="dialog-title">
        @if (data().destructive) {
          <ion-icon name="warning-outline" color="danger"></ion-icon>
        }
        {{ data().title }}
      </h2>

      <div class="dialog-content">
        <p>{{ data().message }}</p>
        @if (data().details?.length) {
          <table class="details-table">
            @for (item of data().details; track item.label) {
              <tr>
                <td class="label">{{ item.label }}</td>
                <td class="value">{{ item.value }}</td>
              </tr>
            }
          </table>
        }

        @if (fields().length) {
          <div class="dialog-fields">
            @for (field of fields(); track field.name) {
              <ion-item fill="outline">
                <ion-label position="stacked">{{ field.label }}</ion-label>
                @if (field.type === 'select') {
                  <ion-select
                    [attr.data-testid]="'dialog-field-' + field.name"
                    [attr.aria-label]="field.label"
                    interface="popover"
                    [name]="field.name"
                    [required]="!field.optional"
                    [ngModel]="values()[field.name]"
                    (ngModelChange)="setValue(field.name, $event)"
                  >
                    @for (option of field.options ?? []; track option.id) {
                      <ion-select-option [value]="option.id">{{ option.name }}</ion-select-option>
                    }
                  </ion-select>
                } @else {
                  <ion-input
                    [attr.data-testid]="'dialog-field-' + field.name"
                    [attr.aria-label]="field.label"
                    [type]="field.type"
                    [name]="field.name"
                    [required]="!field.optional"
                    [ngModel]="values()[field.name]"
                    (ngModelChange)="setValue(field.name, $event)"
                  ></ion-input>
                }
              </ion-item>
            }
          </div>
        }
      </div>

      <div class="dialog-actions">
        <ion-button
          data-testid="confirm-dialog-cancel"
          fill="clear"
          color="medium"
          (click)="dismiss(false)"
        >
          {{ data().cancelText || ('COMMON.CANCEL' | appTranslate) }}
        </ion-button>
        <ion-button
          data-testid="confirm-dialog-confirm"
          [color]="data().destructive ? 'danger' : 'primary'"
          [disabled]="!isComplete()"
          (click)="dismiss(true)"
        >
          {{ data().confirmText || ('COMMON.CONFIRM' | appTranslate) }}
        </ion-button>
      </div>
    </div>
  `,
  styles: [
    `
      .dialog {
        padding: 20px 24px 12px;
        background: var(--card-bg);
        color: var(--text-color);
      }
      .dialog-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 12px;
        font-size: 1.25rem;
      }
      .dialog-content {
        min-width: 300px;
      }
      .details-table {
        margin-top: 12px;
        border-collapse: collapse;
        width: 100%;
      }
      .details-table td {
        padding: 4px 8px;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
      }
      .details-table .label {
        color: var(--text-muted, #7f8c8d);
        font-weight: 500;
      }
      .details-table .value {
        text-align: right;
        font-weight: 600;
      }
      .dialog-fields {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;
      }
      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  private readonly modalController = inject(ModalController);

  readonly data = input.required<ConfirmDialogData>();

  readonly fields = computed<readonly DialogField[]>(() => this.data().fields ?? []);

  /** The values as edited, seeded from each field's own default. */
  readonly values = signal<DialogValues>({});

  private seeded = false;

  constructor() {
    // Seeded once, on the first render that has the input. Re-seeding on every read would
    // discard what the user typed.
    queueMicrotask(() => {
      if (this.seeded) return;
      this.seeded = true;
      this.values.set(
        Object.fromEntries(this.fields().map((field) => [field.name, field.value ?? ''])),
      );
    });
  }

  /**
   * Whether every required field has something in it.
   *
   * Checked here rather than left to the platform, because the alternative is a server
   * round-trip that answers `validation.msg....cannot.be.blank` as a toast — which is what
   * issue #753 is about for user creation.
   */
  readonly isComplete = computed(() =>
    this.fields().every(
      (field) => field.optional === true || `${this.values()[field.name] ?? ''}`.trim() !== '',
    ),
  );

  setValue(name: string, value: string | number): void {
    this.values.update((current) => ({ ...current, [name]: value }));
  }

  /**
   * Dismisses with the collected values, or with the boolean when there are none.
   *
   * The two shapes are what let `DialogService.confirm` keep checking `=== true` while
   * `DialogService.prompt` reads a record: a cancelled prompt resolves `false`, which is not a
   * record, so the caller gets `undefined` and cannot mistake it for an empty answer.
   */
  dismiss(confirmed: boolean): void {
    this.modalController.dismiss(confirmed && this.fields().length ? this.values() : confirmed);
  }
}
