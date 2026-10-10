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
import { WorkingDaysService, WorkingDaysData, WorkingDaysUpdateRequest } from '../../api';
import { TranslatePipe } from '../../core/adapters';
import { NotificationService } from '../../core/services/notification.service';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

/**
 * Component for configuring system-wide working days and repayment reschedule rules.
 */
@Component({
  selector: 'app-working-days',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonCheckbox,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'WORKING_DAYS.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #workingDaysForm="ngForm" (ngSubmit)="onSubmit()" class="working-days-form">
            <div class="days-grid">
              @for (day of DAYS; track day.code) {
                <ion-checkbox
                  [name]="day.name"
                  [ngModel]="recurrence()[day.code]"
                  (ngModelChange)="setDay(day.code, $event)"
                  >{{ day.label | appTranslate }}</ion-checkbox
                >
              }
            </div>

            <div class="reschedule-rules mt-4">
              <ion-item fill="outline" class="full-width">
                <ion-label position="stacked">{{
                  'WORKING_DAYS.REPAYMENTS_RESCHEDULING_RULE' | appTranslate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'WORKING_DAYS.REPAYMENTS_RESCHEDULING_RULE' | appTranslate"
                  interface="popover"
                  name="rescheduleStrategy"
                  [ngModel]="rescheduleId()"
                  (ngModelChange)="rescheduleId.set($event)"
                >
                  @for (option of rescheduleOptions(); track option['id']) {
                    <ion-select-option [value]="option['id']">{{
                      option['value']
                    }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-checkbox
                name="extendTerm"
                [ngModel]="extendTerm()"
                (ngModelChange)="extendTerm.set($event)"
              >
                {{ 'WORKING_DAYS.EXTEND_TERM_DAILY_REPAYMENTS' | appTranslate }}
              </ion-checkbox>

              <ion-checkbox
                name="extendTermForRepaymentsOnHolidays"
                [ngModel]="extendTermForRepaymentsOnHolidays()"
                (ngModelChange)="extendTermForRepaymentsOnHolidays.set($event)"
              >
                {{ 'WORKING_DAYS.EXTEND_TERM_HOLIDAY_REPAYMENTS' | appTranslate }}
              </ion-checkbox>
            </div>

            <div class="form-actions">
              <ion-button color="primary" type="submit" [disabled]="isSaving()">
                {{ isSaving() ? ('COMMON.SAVING' | appTranslate) : ('COMMON.SAVE' | appTranslate) }}
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
        max-width: 800px;
        margin: 0 auto;
      }
      .days-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        padding: 16px 0;
      }
      .full-width {
        width: 100%;
      }
      .mt-4 {
        margin-top: 2rem;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 24px;
      }
    `,
  ],
})
export class WorkingDaysComponent implements OnInit {
  private readonly workingDaysService = inject(WorkingDaysService);
  private readonly notifications = inject(NotificationService);

  /** Rendered in order; `code` is the BYDAY token the API uses. */
  protected readonly DAYS = [
    { code: 'MO', name: 'monday', label: 'COMMON.MONDAY' },
    { code: 'TU', name: 'tuesday', label: 'COMMON.TUESDAY' },
    { code: 'WE', name: 'wednesday', label: 'COMMON.WEDNESDAY' },
    { code: 'TH', name: 'thursday', label: 'COMMON.THURSDAY' },
    { code: 'FR', name: 'friday', label: 'COMMON.FRIDAY' },
    { code: 'SA', name: 'saturday', label: 'COMMON.SATURDAY' },
    { code: 'SU', name: 'sunday', label: 'COMMON.SUNDAY' },
  ] as const;

  workingDays: Record<string, unknown> = {};

  readonly recurrence = signal<Record<string, boolean>>(this.noDaysSelected());
  readonly rescheduleOptions = signal<Record<string, unknown>[]>([]);
  readonly rescheduleId = signal<number | undefined>(undefined);
  readonly extendTerm = signal(false);
  readonly extendTermForRepaymentsOnHolidays = signal(false);
  readonly isSaving = signal(false);

  /** Replaces the map rather than mutating it: a signal only notifies on a new reference. */
  setDay(code: string, checked: boolean): void {
    this.recurrence.update((days) => ({ ...days, [code]: checked }));
  }

  private noDaysSelected(): Record<string, boolean> {
    return Object.fromEntries(this.DAYS.map((day) => [day.code, false]));
  }

  ngOnInit(): void {
    this.loadWorkingDays();
  }

  private loadWorkingDays(): void {
    this.workingDaysService.getWorkingdays().subscribe((data: WorkingDaysData) => {
      this.workingDays = data as unknown as Record<string, unknown>;
      const rescheduleType = this.workingDays['repaymentRescheduleType'] as Record<string, unknown>;
      this.rescheduleId.set(rescheduleType?.['id'] as number);
      this.extendTerm.set(!!this.workingDays['extendTermForDailyRepayments']);
      this.extendTermForRepaymentsOnHolidays.set(
        !!this.workingDays['extendTermForRepaymentsOnHolidays'],
      );

      // Parse recurrence string (e.g. "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR"), starting
      // from a cleared map so a day dropped upstream is cleared here too.
      const selected = this.noDaysSelected();
      const byDayMatch = (this.workingDays['recurrence'] as string)?.match(/BYDAY=([^;]+)/);
      byDayMatch?.[1].split(',').forEach((day) => (selected[day] = true));
      this.recurrence.set(selected);

      // Load reschedule options from the API template
      this.workingDaysService.getWorkingdaysTemplate().subscribe({
        next: (templateData) => {
          this.rescheduleOptions.set(
            (templateData.repaymentRescheduleOptions || []) as unknown as Record<string, unknown>[],
          );
        },
        error: () => {
          // Fallback to static defaults if template API is not available
          this.rescheduleOptions.set([
            { id: 1, value: 'Same Day' },
            { id: 2, value: 'Move to Next Working Day' },
            { id: 3, value: 'Move to Previous Working Day' },
          ]);
        },
      });
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);

    const selected = this.recurrence();
    const activeDays = this.DAYS.filter((day) => selected[day.code])
      .map((day) => day.code)
      .join(',');
    const recurrenceStr = `FREQ=WEEKLY;INTERVAL=1;BYDAY=${activeDays}`;

    const request = {
      recurrence: recurrenceStr,
      repaymentRescheduleType: this.rescheduleId(),
      extendTermForDailyRepayments: this.extendTerm(),
      extendTermForRepaymentsOnHolidays: this.extendTermForRepaymentsOnHolidays(),
      locale: 'en',
    } as unknown as WorkingDaysUpdateRequest;

    this.workingDaysService.putWorkingdays(request).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.notifications.success('Working days updated successfully');
        this.loadWorkingDays();
      },
      error: () => {
        this.isSaving.set(false);
        this.notifications.error('Operation failed. Please try again.');
      },
    });
  }
}
