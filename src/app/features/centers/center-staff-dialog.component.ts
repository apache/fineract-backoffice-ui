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
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

import { CentersService } from '../../api';
import { OVERLAY, TranslatePipe } from '../../core/adapters';

export interface CenterStaffDialogData {
  /** The center's office. Fineract only accepts staff who belong to it. */
  officeId?: number;
  /** Currently assigned staff, pre-selected so reassignment starts from the truth. */
  staffId?: number;
}

export interface CenterStaffResult {
  staffId: number;
}

/**
 * Picks the member of staff a center is assigned to.
 *
 * Options come from `GET /centers/template?officeId=…&staffInSelectedOfficeOnly=true`. Scoping to
 * the office matters because the platform rejects staff from another office and names the staff id
 * rather than the office in the refusal, which reads like the feature is broken.
 */
@Component({
  selector: 'app-center-staff-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, IonItem, IonLabel, IonSelect, IonSelectOption, IonButton],
  template: `
    <h2 class="dialog-title">{{ 'CENTERS.ASSIGN_STAFF' | appTranslate }}</h2>
    <div class="dialog-content">
      <ion-item fill="outline" class="full-width">
        <ion-label position="stacked">{{ 'COMMON.STAFF' | appTranslate }}</ion-label>
        <ion-select
          [attr.aria-label]="'COMMON.STAFF' | appTranslate"
          interface="popover"
          data-testid="center-staff-select"
          name="staffId"
          [(ngModel)]="staffId"
        >
          @for (member of staff(); track member.id) {
            <ion-select-option [value]="member.id">{{ member.displayName }}</ion-select-option>
          }
        </ion-select>
      </ion-item>

      @if (!staff().length) {
        <p class="field-note" data-testid="center-staff-none">
          {{ 'CENTERS.NO_STAFF_IN_OFFICE' | appTranslate }}
        </p>
      }
    </div>
    <div class="dialog-actions">
      <ion-button fill="clear" color="medium" (click)="onCancel()">
        {{ 'COMMON.CANCEL' | appTranslate }}
      </ion-button>
      <ion-button
        color="primary"
        data-testid="center-staff-confirm"
        [disabled]="staffId === undefined"
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
export class CenterStaffDialogComponent implements OnInit {
  private readonly overlay = inject(OVERLAY);
  private readonly centersService = inject(CentersService);

  readonly data = input.required<CenterStaffDialogData>();

  readonly staff = signal<{ id?: number; displayName?: string }[]>([]);
  staffId?: number;

  ngOnInit(): void {
    this.staffId = this.data().staffId;

    // Signature: command, officeId, staffInSelectedOfficeOnly.
    this.centersService.getCentersTemplate(undefined, this.data().officeId, true).subscribe({
      next: (template) => {
        const options = (
          template as unknown as { staffOptions?: { id?: number; displayName?: string }[] }
        ).staffOptions;
        this.staff.set(options ? Array.from(options) : []);
      },
      error: () => this.staff.set([]),
    });
  }

  onCancel(): void {
    void this.overlay.dismissModal();
  }

  onConfirm(): void {
    if (this.staffId === undefined) return;
    void this.overlay.dismissModal<CenterStaffResult>({ staffId: this.staffId });
  }
}
