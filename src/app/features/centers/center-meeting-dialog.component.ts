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

import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
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
} from '@ionic/angular/standalone';

import { BASE_PATH } from '../../api';
import { OVERLAY, TranslatePipe } from '../../core/adapters';
import { CenterMeeting } from './center-detail.model';
import { toIsoDate } from '../../core/utils/date-formatter';

export interface CenterMeetingDialogData {
  centerId: number;
  /** The meeting being changed, when there is one. Absent means a new meeting. */
  meeting?: CenterMeeting;
}

export interface CenterMeetingResult {
  title: string;
  startDate: string;
  frequency: number;
  interval: number;
  typeId: number;
  /** Only meaningful, and only sent, for a weekly meeting. */
  repeatsOnDay?: number;
}

/** `frequencyOptions` id for WEEKLY, the one frequency that needs a day of the week. */
const WEEKLY_FREQUENCY = 2;

interface CodeOption {
  id?: number;
  value?: string;
}

/**
 * Schedules, or reschedules, the meeting a center's groups attend.
 *
 * The options come from `GET /centers/{id}/calendars/template`, whose frequency list is under
 * `frequencyOptions` — not the `calendarFrequencyTypeOptions` its code names suggest.
 *
 * A meeting cannot start before the center was activated: the platform answers
 * `validation.msg.calendar.cannot.be.before.centers.activation.date`, so the action is offered
 * only on an active center.
 *
 * A **weekly** meeting additionally requires `repeatsOnDay` — a weekly schedule with no day is
 * refused with `validation.msg.calendar.repeatsOnDay.cannot.be.blank`. Weekly is the ordinary
 * cadence for centre-based lending, so the day selector appears with it rather than being an
 * advanced option, and is withheld for the other frequencies, which reject it as unsupported.
 */
@Component({
  selector: 'app-center-meeting-dialog',
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
    <h2 class="dialog-title">
      {{ (data().meeting ? 'CENTERS.EDIT_MEETING' : 'CENTERS.ATTACH_MEETING') | appTranslate }}
    </h2>
    <div class="dialog-content">
      <ion-item fill="outline" class="full-width">
        <ion-label position="stacked">{{ 'CENTERS.MEETING_TITLE' | appTranslate }}</ion-label>
        <ion-input
          data-testid="center-meeting-title"
          name="title"
          [attr.aria-label]="'CENTERS.MEETING_TITLE' | appTranslate"
          [(ngModel)]="title"
        ></ion-input>
      </ion-item>

      <ion-item fill="outline" class="full-width">
        <ion-label position="stacked">{{ 'CENTERS.MEETING_START' | appTranslate }}</ion-label>
        <ion-datetime-button
          data-testid="center-meeting-date-button"
          datetime="center-meeting-date"
        ></ion-datetime-button>
        <ion-modal [keepContentsMounted]="true">
          <ng-template>
            <ion-datetime
              id="center-meeting-date"
              data-testid="center-meeting-date"
              presentation="date"
              [value]="startDate"
              (ionChange)="onDateChange($event)"
            ></ion-datetime>
          </ng-template>
        </ion-modal>
      </ion-item>

      <ion-item fill="outline" class="full-width">
        <ion-label position="stacked">{{ 'CENTERS.MEETING_FREQUENCY' | appTranslate }}</ion-label>
        <ion-select
          [attr.aria-label]="'CENTERS.MEETING_FREQUENCY' | appTranslate"
          interface="popover"
          data-testid="center-meeting-frequency"
          name="frequency"
          [(ngModel)]="frequency"
        >
          @for (option of frequencyOptions(); track option.id) {
            <ion-select-option [value]="option.id">{{ option.value }}</ion-select-option>
          }
        </ion-select>
      </ion-item>

      @if (isWeekly()) {
        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'CENTERS.MEETING_DAY' | appTranslate }}</ion-label>
          <ion-select
            [attr.aria-label]="'CENTERS.MEETING_DAY' | appTranslate"
            interface="popover"
            data-testid="center-meeting-day"
            name="repeatsOnDay"
            [(ngModel)]="repeatsOnDay"
          >
            @for (option of dayOptions(); track option.id) {
              <ion-select-option [value]="option.id">{{ option.value }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
      }

      <ion-item fill="outline" class="full-width">
        <ion-label position="stacked">{{ 'CENTERS.MEETING_INTERVAL' | appTranslate }}</ion-label>
        <ion-input
          data-testid="center-meeting-interval"
          type="number"
          min="1"
          name="interval"
          [attr.aria-label]="'CENTERS.MEETING_INTERVAL' | appTranslate"
          [(ngModel)]="interval"
        ></ion-input>
      </ion-item>

      <ion-item fill="outline" class="full-width">
        <ion-label position="stacked">{{ 'CENTERS.MEETING_TYPE' | appTranslate }}</ion-label>
        <ion-select
          [attr.aria-label]="'CENTERS.MEETING_TYPE' | appTranslate"
          interface="popover"
          data-testid="center-meeting-type"
          name="typeId"
          [(ngModel)]="typeId"
        >
          @for (option of typeOptions(); track option.id) {
            <ion-select-option [value]="option.id">{{ option.value }}</ion-select-option>
          }
        </ion-select>
      </ion-item>
    </div>
    <div class="dialog-actions">
      <ion-button fill="clear" color="medium" (click)="onCancel()">
        {{ 'COMMON.CANCEL' | appTranslate }}
      </ion-button>
      <ion-button
        color="primary"
        data-testid="center-meeting-confirm"
        [disabled]="!canConfirm()"
        (click)="onConfirm()"
      >
        {{ 'COMMON.CONFIRM' | appTranslate }}
      </ion-button>
    </div>
  `,
  styles: [
    `
      .dialog-content {
        min-width: 360px;
      }
      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class CenterMeetingDialogComponent implements OnInit {
  private readonly overlay = inject(OVERLAY);
  private readonly httpClient = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH);

  readonly data = input.required<CenterMeetingDialogData>();

  readonly frequencyOptions = signal<CodeOption[]>([]);
  readonly typeOptions = signal<CodeOption[]>([]);
  readonly dayOptions = signal<CodeOption[]>([]);

  title = '';
  startDate = toIsoDate(new Date());
  frequency = 2;
  interval = 1;
  typeId = 1;
  repeatsOnDay = 1;

  ngOnInit(): void {
    const meeting = this.data().meeting;
    if (meeting) {
      this.title = meeting.title ?? '';
      // The calendar read returns `startDate` as `yyyy-MM-dd`, not as the `[y, m, d]` array the
      // rest of the platform uses, so it needs no conversion to seed the picker.
      if (meeting.startDate) this.startDate = meeting.startDate;
      if (meeting.frequency?.id) this.frequency = meeting.frequency.id;
      if (meeting.type?.id) this.typeId = meeting.type.id;
      // `interval` comes back as -1 for a non-repeating frequency; that is not a usable default.
      if (meeting.interval && meeting.interval > 0) this.interval = meeting.interval;
    }

    this.httpClient
      .get<Record<string, CodeOption[]>>(
        `${this.basePath}/v1/centers/${this.data().centerId}/calendars/template`,
      )
      .subscribe({
        next: (template) => {
          this.frequencyOptions.set(template['frequencyOptions'] ?? []);
          this.typeOptions.set(template['calendarTypeOptions'] ?? []);
          this.dayOptions.set(template['repeatsOnDayOptions'] ?? []);
        },
        error: () => {
          this.frequencyOptions.set([]);
          this.typeOptions.set([]);
          this.dayOptions.set([]);
        },
      });
  }

  isWeekly(): boolean {
    return Number(this.frequency) === WEEKLY_FREQUENCY;
  }

  onDateChange(event: Event): void {
    const value = (event as CustomEvent<{ value?: string }>).detail?.value;
    if (value) this.startDate = value;
  }

  canConfirm(): boolean {
    return Boolean(this.title.trim()) && Boolean(this.startDate) && this.interval > 0;
  }

  onCancel(): void {
    void this.overlay.dismissModal();
  }

  onConfirm(): void {
    if (!this.canConfirm()) return;
    void this.overlay.dismissModal<CenterMeetingResult>({
      title: this.title.trim(),
      startDate: this.startDate,
      frequency: this.frequency,
      interval: this.interval,
      typeId: this.typeId,
      // Withheld unless weekly: the other frequencies reject it.
      repeatsOnDay: this.isWeekly() ? this.repeatsOnDay : undefined,
    });
  }
}
