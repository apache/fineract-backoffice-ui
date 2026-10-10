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

import { inject, input, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18N, TranslatePipe } from '../../../core/adapters';
import {
  IonButton,
  IonCheckbox,
  IonDatetime,
  IonDatetimeButton,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  ModalController,
} from '@ionic/angular/standalone';
import { DataTablesService, ResultsetColumnHeaderData } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
import { toIsoDate } from '../../../core/utils/date-formatter';

export interface DatatableEntryDialogData {
  datatableName: string;
  apptableId: number;
  columns: ResultsetColumnHeaderData[];
}

const AUDIT_COLUMN_NAMES = new Set(['created_at', 'updated_at']);

@Component({
  selector: 'app-datatable-entry-dialog',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonCheckbox,
    IonButton,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <div class="dialog">
      <h2 class="dialog-title">{{ 'SYSTEM.ADD_ENTRY' | appTranslate }}</h2>

      <form #entryForm="ngForm" class="entry-form">
        @for (col of dataColumns; track col.columnName) {
          @if (isDropdownColumn(col)) {
            <ion-item fill="outline">
              <ion-label position="stacked">{{ col.columnName }}</ion-label>
              <ion-select
                [attr.aria-label]="col.columnName"
                interface="popover"
                [attr.data-testid]="'datatable-field-' + col.columnName"
                [name]="col.columnName!"
                [(ngModel)]="values[col.columnName!]"
                [required]="!!col.mandatory"
              >
                @for (option of col.columnValues; track $any(option).id) {
                  <ion-select-option [value]="$any(option).id">
                    {{ $any(option).value }}
                  </ion-select-option>
                }
              </ion-select>
            </ion-item>
          } @else if (isBooleanColumn(col)) {
            <ion-item>
              <ion-checkbox
                [attr.data-testid]="'datatable-field-' + col.columnName"
                [name]="col.columnName!"
                [(ngModel)]="values[col.columnName!]"
              >
                {{ col.columnName }}
              </ion-checkbox>
            </ion-item>
          } @else if (isDateColumn(col)) {
            <ion-item fill="outline">
              <ion-label position="stacked">{{ col.columnName }}</ion-label>
              <ion-datetime-button [datetime]="'datatable-date-' + col.columnName">
              </ion-datetime-button>
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    [id]="'datatable-date-' + col.columnName"
                    [attr.data-testid]="'datatable-field-' + col.columnName"
                    presentation="date"
                    [value]="$any(values[col.columnName!])"
                    (ionChange)="onDateChange(col, $event)"
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>
          } @else if (isNumericColumn(col)) {
            <ion-item fill="outline">
              <ion-label position="stacked">{{ col.columnName }}</ion-label>
              <ion-input
                [attr.aria-label]="col.columnName"
                type="number"
                [attr.data-testid]="'datatable-field-' + col.columnName"
                [name]="col.columnName!"
                [(ngModel)]="values[col.columnName!]"
                [required]="!!col.mandatory"
              ></ion-input>
            </ion-item>
          } @else {
            <ion-item fill="outline">
              <ion-label position="stacked">{{ col.columnName }}</ion-label>
              @if (col.columnDisplayType === 'TEXT') {
                <ion-textarea
                  [attr.data-testid]="'datatable-field-' + col.columnName"
                  [name]="col.columnName!"
                  [(ngModel)]="values[col.columnName!]"
                  [required]="!!col.mandatory"
                  rows="3"
                ></ion-textarea>
              } @else {
                <ion-input
                  [maxlength]="col.columnLength ?? null"
                  [attr.data-testid]="'datatable-field-' + col.columnName"
                  [name]="col.columnName!"
                  [(ngModel)]="values[col.columnName!]"
                  [required]="!!col.mandatory"
                ></ion-input>
              }
            </ion-item>
          }
        }
      </form>

      <div class="dialog-actions">
        <ion-button
          data-testid="datatable-entry-cancel"
          fill="clear"
          color="medium"
          [disabled]="isSaving()"
          (click)="onCancel()"
        >
          {{ 'COMMON.CANCEL' | appTranslate }}
        </ion-button>
        <ion-button
          data-testid="datatable-entry-submit"
          color="primary"
          [disabled]="entryForm.invalid || isSaving()"
          (click)="onSubmit()"
        >
          {{ isSaving() ? ('COMMON.SAVING' | appTranslate) : ('COMMON.SAVE' | appTranslate) }}
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
        margin: 0 0 12px;
        font-size: 1.25rem;
      }
      .entry-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding-top: 8px;
        min-width: 400px;
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
export class DatatableEntryDialogComponent {
  private readonly datatablesService = inject(DataTablesService);
  private readonly modalController = inject(ModalController);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  readonly data = input.required<DatatableEntryDialogData>();

  values: Record<string, unknown> = {};
  readonly isSaving = signal(false);

  get dataColumns(): ResultsetColumnHeaderData[] {
    return this.data().columns.filter(
      (col) => !col.isColumnPrimaryKey && !AUDIT_COLUMN_NAMES.has(col.columnName ?? ''),
    );
  }

  isDropdownColumn(col: ResultsetColumnHeaderData): boolean {
    return !!col.columnValues && col.columnValues.length > 0;
  }

  isBooleanColumn(col: ResultsetColumnHeaderData): boolean {
    return col.columnDisplayType === 'BOOLEAN';
  }

  isDateColumn(col: ResultsetColumnHeaderData): boolean {
    return col.columnDisplayType === 'DATE' || col.columnDisplayType === 'DATETIME';
  }

  isNumericColumn(col: ResultsetColumnHeaderData): boolean {
    return col.columnDisplayType === 'INTEGER' || col.columnDisplayType === 'DECIMAL';
  }

  onDateChange(col: ResultsetColumnHeaderData, event: Event): void {
    const detail = (event as CustomEvent<{ value?: string }>).detail;
    const value = detail?.value ?? (event.target as HTMLInputElement)?.value;
    if (value) this.values[col.columnName!] = toIsoDate(value);
  }

  onSubmit(): void {
    this.isSaving.set(true);

    const body: Record<string, unknown> = { ...this.values };
    const columns = this.dataColumns;
    const hasDateColumn = columns.some((col) => this.isDateColumn(col));
    for (const col of columns) {
      const value = body[col.columnName!];
      if (this.isDateColumn(col) && value) {
        body[col.columnName!] = toIsoDate(value as Date | string);
      }
    }
    if (hasDateColumn) {
      body['dateFormat'] = 'yyyy-MM-dd';
    }
    body['locale'] = 'en';

    this.datatablesService
      .postDatatablesDatatableApptableId(
        this.data().datatableName,
        this.data().apptableId,
        JSON.stringify(body),
      )
      .subscribe({
        next: () => this.modalController.dismiss(true),
        error: () => {
          this.isSaving.set(false);
          this.notifications.error(this.i18n.translate('COMMON.ERROR'));
        },
      });
  }

  onCancel(): void {
    this.modalController.dismiss();
  }
}
