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
import { TranslatePipe } from '../../core/adapters';
import { MeetingsService, MeetingCreateRequest } from '../../api';
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
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatDateToFineract,
  toIsoDate,
} from '../../core/utils/date-formatter';
import { createPickersReady } from '../../shared/utils/pickers-ready';

/**
 * Create / edit form for a group/center meeting. The entity type and entity id come
 * from the route; the calendar to attach the meeting to is taken from the meetings
 * template (the entity's collection meeting calendar) but can be overridden.
 */
@Component({
  selector: 'app-meeting-form',
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
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ isEditMode ? ('MEETINGS.EDIT' | appTranslate) : ('MEETINGS.CREATE' | appTranslate) }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #meetingForm="ngForm" (ngSubmit)="onSubmit()" class="meeting-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'MEETINGS.MEETING_DATE' | appTranslate }}</ion-label>
              @if (pickersReady()) {
                <ion-datetime-button datetime="meetingDate-picker"></ion-datetime-button>
              }
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="meetingDate-picker"
                    data-testid="meetingDate-picker"
                    presentation="date"
                    name="meetingDate"
                    [ngModel]="meetingDate()"
                    (ngModelChange)="meetingDate.set($event)"
                    required
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'MEETINGS.CALENDAR_ID' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'MEETINGS.CALENDAR_ID' | appTranslate"
                type="number"
                name="calendarId"
                [ngModel]="calendarId()"
                (ngModelChange)="calendarId.set($event)"
                required
              ></ion-input>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="meetingForm.invalid || isSaving()"
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
        max-width: 600px;
        margin: 0 auto;
      }
      .meeting-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class MeetingFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly meetingsService = inject(MeetingsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  entityType!: string;
  entityId!: number;
  meetingId: number | null = null;
  isEditMode = false;
  readonly isSaving = signal(false);

  readonly meetingDate = signal<string | null>(null);
  readonly calendarId = signal<number | null>(null);

  ngOnInit(): void {
    this.entityType = this.route.snapshot.paramMap.get('entityType') ?? '';
    this.entityId = Number(this.route.snapshot.paramMap.get('entityId'));

    this.meetingsService
      .getEntityTypeEntityIdMeetingsTemplate(this.entityType, this.entityId)
      .subscribe((tpl) => {
        if (this.calendarId() == null) {
          this.calendarId.set(tpl.calendarData?.id ?? null);
        }
      });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.meetingId = +id;
      this.isEditMode = true;
      this.load();
    }
  }

  load(): void {
    if (!this.meetingId) return;
    this.meetingsService
      .getEntityTypeEntityIdMeetingsMeetingId(this.meetingId, this.entityType, this.entityId)
      .subscribe((data) => {
        this.meetingDate.set(data.meetingDate ? toIsoDate(new Date(data.meetingDate)) : null);
        this.calendarId.set(data.calendarData?.id ?? this.calendarId());
      });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const request: MeetingCreateRequest = {
      calendarId: Number(this.calendarId()),
      meetingDate: formatDateToFineract(this.meetingDate()),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };

    const request$ =
      this.isEditMode && this.meetingId
        ? this.meetingsService.putEntityTypeEntityIdMeetingsMeetingId(
            this.entityType,
            this.entityId,
            this.meetingId,
            request,
          )
        : this.meetingsService.postEntityTypeEntityIdMeetings(
            this.entityType,
            this.entityId,
            request,
          );

    request$.subscribe({
      next: () => this.router.navigate(['/meetings', this.entityType, this.entityId]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate(['/meetings', this.entityType, this.entityId]);
  }
}
