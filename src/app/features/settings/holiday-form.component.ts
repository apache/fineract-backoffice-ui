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
import { HOLIDAY_API, OFFICE_API, RESCHEDULING_TYPE, TranslatePipe } from '../../core/adapters';
import type { Office, ReschedulingOption, ReschedulingType } from '../../core/adapters';
import { NotificationService } from '../../core/services/notification.service';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
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
  IonTextarea,
} from '@ionic/angular/standalone';
import { createPickersReady } from '../../shared/utils/pickers-ready';

@Component({
  selector: 'app-holiday-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonInput,
    IonTextarea,
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
            {{ 'HOLIDAYS.CREATE_HOLIDAY' | appTranslate }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #holidayForm="ngForm" (ngSubmit)="onSubmit()" class="holiday-form">
            <div class="form-grid">
              <ion-item
                fill="outline"
                class="full-width"
                [appTooltip]="'HELP.HOLIDAY_NAME_DESC' | appTranslate"
              >
                <ion-label position="stacked">{{ 'HOLIDAYS.NAME' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'HOLIDAYS.NAME' | appTranslate"
                  name="name"
                  [(ngModel)]="holiday.name"
                  required
                ></ion-input>
              </ion-item>

              <ion-item
                fill="outline"
                class="full-width"
                [appTooltip]="'HELP.APPLICABLE_OFFICES_DESC' | appTranslate"
              >
                <ion-label position="stacked">{{
                  'HOLIDAYS.APPLICABLE_OFFICES' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'HOLIDAYS.APPLICABLE_OFFICES' | appTranslate"
                  interface="popover"
                  name="offices"
                  [(ngModel)]="selectedOfficeIds"
                  multiple
                  required
                >
                  @for (office of offices(); track office.id) {
                    <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item
                fill="outline"
                class="full-width"
                [appTooltip]="'HELP.FROM_DATE_DESC' | appTranslate"
              >
                <ion-label position="stacked">{{ 'HOLIDAYS.FROM_DATE' | appTranslate }}</ion-label>
                @if (pickersReady()) {
                  <ion-datetime-button datetime="fromDate-picker"></ion-datetime-button>
                }
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="fromDate-picker"
                      data-testid="fromDate-picker"
                      presentation="date"
                      name="fromDate"
                      [(ngModel)]="fromDate"
                      required
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>

              <ion-item
                fill="outline"
                class="full-width"
                [appTooltip]="'HELP.TO_DATE_DESC' | appTranslate"
              >
                <ion-label position="stacked">{{ 'HOLIDAYS.TO_DATE' | appTranslate }}</ion-label>
                @if (pickersReady()) {
                  <ion-datetime-button datetime="toDate-picker"></ion-datetime-button>
                }
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="toDate-picker"
                      data-testid="toDate-picker"
                      presentation="date"
                      name="toDate"
                      [(ngModel)]="toDate"
                      required
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>

              <ion-item
                fill="outline"
                class="full-width"
                [appTooltip]="'HELP.RESCHEDULING_TYPE_DESC' | appTranslate"
              >
                <ion-label position="stacked">{{
                  'HOLIDAYS.RESCHEDULING_TYPE' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'HOLIDAYS.RESCHEDULING_TYPE' | appTranslate"
                  interface="popover"
                  name="reschedulingType"
                  [(ngModel)]="reschedulingType"
                  required
                >
                  @for (option of reschedulingTypeOptions(); track option.id) {
                    <ion-select-option [value]="option.id">{{ option.value }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              @if (reschedulingType === 2) {
                <ion-item
                  fill="outline"
                  class="full-width"
                  [appTooltip]="'HELP.REPAYMENTS_RESCHEDULED_TO_DESC' | appTranslate"
                >
                  <ion-label position="stacked">{{
                    'HOLIDAYS.REPAYMENTS_RESCHEDULED_TO' | appTranslate
                  }}</ion-label>
                  @if (pickersReady()) {
                    <ion-datetime-button
                      datetime="repaymentsRescheduledTo-picker"
                    ></ion-datetime-button>
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="repaymentsRescheduledTo-picker"
                        data-testid="repaymentsRescheduledTo-picker"
                        presentation="date"
                        name="repaymentsRescheduledTo"
                        [(ngModel)]="repaymentsRescheduledTo"
                        required
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>
              }
            </div>

            <ion-item
              fill="outline"
              class="full-width"
              [appTooltip]="'HELP.HOLIDAY_DESCRIPTION_DESC' | appTranslate"
            >
              <ion-label position="stacked">{{ 'HOLIDAYS.DESCRIPTION' | appTranslate }}</ion-label>
              <ion-textarea
                [attr.aria-label]="'HOLIDAYS.DESCRIPTION' | appTranslate"
                name="description"
                [(ngModel)]="holiday.description"
                rows="3"
              ></ion-textarea>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="holidayForm.invalid || isSaving() || selectedOfficeIds.length === 0"
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
      .holiday-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class HolidayFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly holidayApi = inject(HOLIDAY_API);
  private readonly officeApi = inject(OFFICE_API);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  private readonly LIST_PATH = '/settings/holidays';

  readonly isSaving = signal(false);
  /**
   * True when editing an existing holiday.
   *
   * The platform only accepts an update while the holiday is still pending activation, which is
   * the same condition the list uses to offer the action, so this screen is never reached for an
   * active one.
   */
  readonly isEditMode = signal(false);
  private holidayId?: number;
  holiday: { name?: string; description?: string } = {};
  fromDate: string | null = null;
  toDate: string | null = null;
  repaymentsRescheduledTo: string | null = null;

  readonly offices = signal<readonly Office[]>([]);
  selectedOfficeIds: number[] = [];

  reschedulingType: ReschedulingType = RESCHEDULING_TYPE.SpecifiedDate;
  readonly reschedulingTypeOptions = signal<readonly ReschedulingOption[]>([]);
  ngOnInit(): void {
    this.loadOffices();
    this.loadReschedulingOptions();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.holidayId = Number(id);
      this.isEditMode.set(true);
      this.loadHoliday();
    }
  }

  private loadHoliday(): void {
    if (!this.holidayId) {
      return;
    }
    this.holidayApi.get(this.holidayId).subscribe({
      next: (holiday) => {
        this.holiday = { name: holiday.name, description: holiday.description };
        // Already `YYYY-MM-DD`, which is what the pickers bind to.
        this.fromDate = holiday.fromDate;
        this.toDate = holiday.toDate;
        this.repaymentsRescheduledTo = holiday.repaymentsRescheduledTo;
        // Fineract sends the rule itself, so it no longer has to be inferred from whether a
        // reschedule date happens to be set — the generated type just did not declare it.
        this.reschedulingType =
          holiday.reschedulingType ??
          (holiday.repaymentsRescheduledTo
            ? RESCHEDULING_TYPE.SpecifiedDate
            : RESCHEDULING_TYPE.NextRepaymentDate);
        if (holiday.officeId !== null) {
          this.selectedOfficeIds = [holiday.officeId];
        }
      },
      error: () => this.notifications.error('Failed to load holiday'),
    });
  }

  private loadOffices(): void {
    this.officeApi.list(true).subscribe({
      next: (data) => {
        this.offices.set(data);
      },
      error: (err) => {
        console.error('Failed to load offices', err);
        this.notifications.error('Failed to load offices');
      },
    });
  }

  private loadReschedulingOptions(): void {
    // Parsing a template that arrives as a JSON string, and falling back to the platform's two
    // fixed options when it cannot be read, are both the adapter's business now.
    this.holidayApi
      .reschedulingOptions()
      .subscribe((options) => this.reschedulingTypeOptions.set(options));
  }

  onSubmit(): void {
    if (!this.fromDate || !this.toDate) {
      return;
    }

    if (this.reschedulingType === 2 && !this.repaymentsRescheduledTo) {
      return;
    }

    this.isSaving.set(true);

    // Converting the dates, pairing them with the format Fineract parses against, and dropping
    // the reschedule date under the rule that does not use one are all the adapter's business.
    // The cast to `PutHolidaysHolidayIdRequest` is gone with them: that type declares only
    // `name` and `description`, while the endpoint accepts everything here.
    const draft = {
      name: this.holiday.name ?? '',
      description: this.holiday.description,
      fromDate: this.fromDate,
      toDate: this.toDate,
      reschedulingType: this.reschedulingType,
      repaymentsRescheduledTo: this.repaymentsRescheduledTo,
      officeIds: this.selectedOfficeIds,
    };

    const request$ =
      this.isEditMode() && this.holidayId
        ? this.holidayApi.update(this.holidayId, draft)
        : this.holidayApi.create(draft);

    request$.subscribe({
      next: () => {
        this.notifications.success(
          this.isEditMode() ? 'Holiday updated successfully' : 'Holiday created successfully',
        );
        this.router.navigate([this.LIST_PATH]);
      },
      error: (err) => {
        this.isSaving.set(false);
        console.error('Failed to save holiday', err);
      },
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
