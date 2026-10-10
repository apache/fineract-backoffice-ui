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

import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OFFICE_API, TranslatePipe } from '../../../core/adapters';
import type { Office } from '../../../core/adapters';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonDatetime,
  IonDatetimeButton,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import { toIsoDate } from '../../../core/utils/date-formatter';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { createPickersReady } from '../../../shared/utils/pickers-ready';

@Component({
  selector: 'app-office-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    TooltipDirective,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('OFFICES.EDIT_OFFICE' | appTranslate)
                : ('OFFICES.CREATE_OFFICE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #officeForm="ngForm" (ngSubmit)="onSubmit()" class="office-form">
            <div class="form-grid">
              <ion-item fill="outline" [appTooltip]="'HELP.OFFICE_NAME_DESC' | appTranslate">
                <ion-label position="stacked">{{ 'OFFICES.NAME' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'OFFICES.NAME' | appTranslate"
                  name="name"
                  [(ngModel)]="office().name"
                  required
                ></ion-input>
              </ion-item>

              <ion-item fill="outline" [appTooltip]="'HELP.PARENT_OFFICE_DESC' | appTranslate">
                <ion-label position="stacked">{{ 'OFFICES.PARENT' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'OFFICES.PARENT' | appTranslate"
                  interface="popover"
                  name="parentId"
                  [(ngModel)]="office().parentId"
                  required
                  [disabled]="isEditMode()"
                >
                  @for (o of offices(); track o.id) {
                    <ion-select-option [value]="o.id">{{ o.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline" [appTooltip]="'HELP.EXTERNAL_ID_DESC' | appTranslate">
                <ion-label position="stacked">{{ 'OFFICES.EXTERNAL_ID' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'OFFICES.EXTERNAL_ID' | appTranslate"
                  name="externalId"
                  [(ngModel)]="office().externalId"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline" [appTooltip]="'HELP.OPENING_DATE_DESC' | appTranslate">
                <ion-label position="stacked">{{
                  'OFFICES.OPENING_DATE' | appTranslate
                }}</ion-label>
                @if (pickersReady()) {
                  <ion-datetime-button datetime="openingDate-picker"></ion-datetime-button>
                }
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="openingDate-picker"
                      data-testid="openingDate-picker"
                      presentation="date"
                      name="openingDate"
                      [ngModel]="openingDate()"
                      (ngModelChange)="openingDate.set($event)"
                      required
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="officeForm.invalid || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | appTranslate }}
                } @else {
                  {{ 'COMMON.SAVE' | appTranslate }}
                }
              </ion-button>
            </div>
          </form>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 24px;
        max-width: 900px;
        margin: 0 auto;
      }
      .office-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
    `,
  ],
})
export class OfficeFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly officeApi = inject(OFFICE_API);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/organization/offices';

  officeId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly office = signal<{ name?: string; externalId?: string | null; parentId?: number | null }>(
    {},
  );
  readonly openingDate = signal(toIsoDate(new Date()));
  readonly offices = signal<readonly Office[]>([]);

  ngOnInit() {
    this.loadOffices();
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.officeId = +id;
        this.isEditMode.set(true);
        this.loadOfficeData();
      }
    });
  }

  loadOffices() {
    this.officeApi.list(true).subscribe((offices) => {
      this.offices.set(offices);
    });
  }

  loadOfficeData() {
    if (!this.officeId) return;
    this.officeApi.get(this.officeId).subscribe((office) => {
      // Already `YYYY-MM-DD`, which is what the picker binds to. `parentId` needs no cast: the
      // model declares it, where the generated response type does not.
      if (office.openingDate) this.openingDate.set(office.openingDate);
      this.office.set({
        name: office.name,
        externalId: office.externalId,
        parentId: office.parentId,
      });
    });
  }

  onSubmit() {
    this.isSaving.set(true);
    const formattedDate = toIsoDate(this.openingDate());

    // The date format and locale Fineract parses `openingDate` against are the adapter's
    // business now. The create path used to mutate the signal's value in place to attach them.
    // Subscribed per branch rather than through one shared observable: `create` answers the new
    // office's id and `update` answers nothing, and a union of two differently-typed Observables
    // has no single callable `subscribe`.
    const done = {
      next: () => void this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    };

    if (this.isEditMode() && this.officeId) {
      this.officeApi
        .update(this.officeId, {
          name: this.office().name ?? '',
          externalId: this.office().externalId,
          openingDate: formattedDate,
        })
        .subscribe(done);
    } else {
      this.officeApi
        .create({
          name: this.office().name ?? '',
          externalId: this.office().externalId,
          openingDate: formattedDate,
          parentId: this.office().parentId,
        })
        .subscribe(done);
    }
  }

  onCancel() {
    this.router.navigate([this.LIST_PATH]);
  }
}
