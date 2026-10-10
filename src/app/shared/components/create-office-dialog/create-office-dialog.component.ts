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

import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonDatetime,
  IonDatetimeButton,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  ModalController,
} from '@ionic/angular/standalone';
import { OFFICE_API, TranslatePipe } from '../../../core/adapters';
import type { Office } from '../../../core/adapters';
import { toIsoDate } from '../../../core/utils/date-formatter';

/**
 * Dialog for inline creation of a branch office.
 */
@Component({
  selector: 'app-create-office-dialog',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <div class="dialog">
      <h2 class="dialog-title">{{ 'OFFICES.CREATE_OFFICE' | appTranslate }}</h2>

      <form #officeForm="ngForm" class="office-form">
        <ion-item fill="outline">
          <ion-label position="stacked">{{ 'OFFICES.NAME' | appTranslate }}</ion-label>
          <ion-input
            [attr.aria-label]="'OFFICES.NAME' | appTranslate"
            id="office-name"
            data-testid="office-name"
            name="name"
            [(ngModel)]="office.name"
            required
          ></ion-input>
        </ion-item>

        <ion-item fill="outline">
          <ion-label position="stacked">{{ 'OFFICES.PARENT' | appTranslate }}</ion-label>
          <ion-select
            [attr.aria-label]="'OFFICES.PARENT' | appTranslate"
            interface="popover"
            id="office-parent"
            data-testid="office-parent"
            name="parentId"
            [(ngModel)]="office.parentId"
            required
          >
            @for (o of offices(); track o.id) {
              <ion-select-option [value]="o.id">{{ o.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>

        <ion-item fill="outline">
          <ion-label position="stacked">{{ 'OFFICES.OPENING_DATE' | appTranslate }}</ion-label>
          <ion-datetime-button datetime="office-opening-date"></ion-datetime-button>
          <ion-modal [keepContentsMounted]="true">
            <ng-template>
              <ion-datetime
                id="office-opening-date"
                data-testid="office-opening-date"
                presentation="date"
                [value]="openingDate"
                (ionChange)="onOpeningDateChange($event)"
              ></ion-datetime>
            </ng-template>
          </ion-modal>
        </ion-item>
      </form>

      <div class="dialog-actions">
        <ion-button data-testid="office-cancel" fill="clear" color="medium" (click)="onCancel()">
          {{ 'COMMON.CANCEL' | appTranslate }}
        </ion-button>
        <ion-button
          data-testid="office-submit"
          color="primary"
          [disabled]="officeForm.invalid || isSaving()"
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
      .office-form {
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
export class CreateOfficeDialogComponent implements OnInit {
  private readonly officeApi = inject(OFFICE_API);
  private readonly modalController = inject(ModalController);

  /** Head office by default, which is the only parent a first branch can have. */
  office: { name?: string; externalId?: string; parentId: number } = { parentId: 1 };
  openingDate = toIsoDate(new Date());
  readonly offices = signal<readonly Office[]>([]);
  readonly isSaving = signal(false);

  ngOnInit() {
    this.officeApi.list(true).subscribe((offices) => {
      this.offices.set(offices);
    });
  }

  onOpeningDateChange(event: Event): void {
    const detail = (event as CustomEvent<{ value?: string }>).detail;
    const value = detail?.value ?? (event.target as HTMLInputElement)?.value;
    // ion-datetime yields a full ISO timestamp; the API wants the date part only.
    if (value) this.openingDate = value.split('T', 1)[0];
  }

  onSubmit() {
    this.isSaving.set(true);

    // The date format and locale Fineract parses the opening date against are the adapter's
    // business now, not this dialog's.
    this.officeApi
      .create({
        name: this.office.name ?? '',
        externalId: this.office.externalId,
        openingDate: this.openingDate,
        parentId: this.office.parentId,
      })
      .subscribe({
        next: (officeId) => this.modalController.dismiss(officeId),
        error: () => this.isSaving.set(false),
      });
  }

  onCancel() {
    this.modalController.dismiss();
  }
}
