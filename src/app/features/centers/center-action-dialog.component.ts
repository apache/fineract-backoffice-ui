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

import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonDatetime,
  IonDatetimeButton,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

import { CentersService } from '../../api';
import { OVERLAY, TranslatePipe } from '../../core/adapters';
import { toIsoDate } from '../../core/utils/date-formatter';

export interface CenterActionDialogData {
  command: 'activate' | 'close';
}

export interface CenterActionResult {
  date: string;
  closureReasonId?: number;
}

/**
 * Collects the date, and for a closure the reason, that `activate` and `close` require.
 *
 * Closure reasons come from `GET /centers/template?command=close` rather than from the plain
 * template, which carries only office and staff options. They are code values of
 * `CenterClosureReason`, and that code ships with no values: an institution that has not populated
 * it cannot close a center at all, because the platform rejects the request for a missing
 * `closureReasonId`. An empty list is therefore explained on screen rather than left as a select
 * that appears broken.
 */
@Component({
  selector: 'app-center-action-dialog',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <h2 class="dialog-title">
      {{ (data().command === 'activate' ? 'CENTERS.ACTIVATE' : 'CENTERS.CLOSE') | appTranslate }}
    </h2>
    <div class="dialog-content">
      <ion-item fill="outline" class="full-width">
        <ion-label position="stacked">
          {{
            (data().command === 'activate' ? 'CENTERS.ACTIVATION_DATE' : 'CENTERS.CLOSURE_DATE')
              | appTranslate
          }}
        </ion-label>
        <ion-datetime-button
          data-testid="center-action-date-button"
          datetime="center-action-date"
        ></ion-datetime-button>
        <ion-modal [keepContentsMounted]="true">
          <ng-template>
            <ion-datetime
              id="center-action-date"
              data-testid="center-action-date"
              presentation="date"
              [value]="date"
              (ionChange)="onDateChange($event)"
            ></ion-datetime>
          </ng-template>
        </ion-modal>
      </ion-item>

      @if (data().command === 'close') {
        <ion-item fill="outline" class="full-width">
          <ion-label position="stacked">{{ 'CENTERS.CLOSURE_REASON' | appTranslate }}</ion-label>
          <ion-select
            [attr.aria-label]="'CENTERS.CLOSURE_REASON' | appTranslate"
            interface="popover"
            data-testid="center-closure-reason"
            name="closureReasonId"
            [(ngModel)]="closureReasonId"
          >
            @for (reason of closureReasons(); track reason.id) {
              <ion-select-option [value]="reason.id">{{ reason.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>

        @if (!closureReasons().length) {
          <p class="field-note" data-testid="center-closure-reason-none">
            {{ 'CENTERS.NO_CLOSURE_REASONS' | appTranslate }}
          </p>
        }
      }
    </div>
    <div class="dialog-actions">
      <ion-button fill="clear" color="medium" (click)="onCancel()">
        {{ 'COMMON.CANCEL' | appTranslate }}
      </ion-button>
      <ion-button
        color="primary"
        data-testid="center-action-confirm"
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
        min-width: 340px;
      }
      .full-width {
        width: 100%;
      }
      .field-note {
        margin: 8px 0 0;
        font-size: 12px;
        color: var(--text-muted, #6b7280);
      }
    `,
  ],
})
export class CenterActionDialogComponent implements OnInit {
  private readonly overlay = inject(OVERLAY);
  private readonly centersService = inject(CentersService);

  readonly data = input.required<CenterActionDialogData>();

  readonly closureReasons = signal<{ id?: number; name?: string }[]>([]);
  date = toIsoDate(new Date());
  closureReasonId?: number;

  ngOnInit(): void {
    if (this.data().command === 'close') {
      this.loadClosureReasons();
    }
  }

  onDateChange(event: Event): void {
    const value = (event as CustomEvent<{ value?: string }>).detail?.value;
    if (value) this.date = value;
  }

  canConfirm(): boolean {
    if (this.data().command === 'close' && !this.closureReasonId) return false;
    return Boolean(this.date);
  }

  onCancel(): void {
    void this.overlay.dismissModal();
  }

  onConfirm(): void {
    if (!this.canConfirm()) return;
    void this.overlay.dismissModal<CenterActionResult>({
      date: this.date,
      closureReasonId: this.closureReasonId,
    });
  }

  private loadClosureReasons(): void {
    // Signature: command, officeId, staffInSelectedOfficeOnly.
    this.centersService.getCentersTemplate('close').subscribe({
      next: (template) => {
        const reasons = (
          template as unknown as { closureReasons?: { id?: number; name?: string }[] }
        ).closureReasons;
        this.closureReasons.set(reasons ?? []);
      },
      error: () => this.closureReasons.set([]),
    });
  }
}
