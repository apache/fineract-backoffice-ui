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

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

import { OVERLAY, STAFF_API, TranslatePipe } from '../../core/adapters';
import type { Staff } from '../../core/adapters';

export interface SavingsOfficerResult {
  toSavingsOfficerId: number;
}

/**
 * Picks the officer a savings account is assigned to.
 *
 * Only active staff are offered: assigning an account to someone who has left is a silent way to
 * lose it from a portfolio, since nothing else in the system flags an inactive assignee.
 */
@Component({
  selector: 'app-savings-officer-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, IonItem, IonLabel, IonSelect, IonSelectOption, IonButton],
  template: `
    <div class="dialog">
      <h2 class="dialog-title">{{ 'SAVINGS.ASSIGN_OFFICER' | appTranslate }}</h2>
      <div class="dialog-content">
        <p>{{ 'SAVINGS.CONFIRM_ASSIGN_OFFICER' | appTranslate }}</p>

        <ion-item fill="outline">
          <ion-label position="stacked">{{ 'SAVINGS.OFFICER' | appTranslate }}</ion-label>
          <ion-select
            [attr.aria-label]="'SAVINGS.OFFICER' | appTranslate"
            interface="popover"
            data-testid="savings-officer-select"
            name="toSavingsOfficerId"
            [(ngModel)]="officerId"
          >
            @for (member of staff(); track member.id) {
              <ion-select-option [value]="member.id">{{ member.displayName }}</ion-select-option>
            }
          </ion-select>
        </ion-item>

        @if (!staff().length) {
          <p class="field-note" data-testid="savings-officer-none">
            {{ 'SAVINGS.NO_OFFICERS' | appTranslate }}
          </p>
        }
      </div>
      <div class="dialog-actions">
        <ion-button fill="clear" color="medium" (click)="dismiss()">
          {{ 'COMMON.CANCEL' | appTranslate }}
        </ion-button>
        <ion-button
          color="primary"
          data-testid="savings-officer-confirm"
          [disabled]="officerId === null"
          (click)="confirm()"
        >
          {{ 'COMMON.CONFIRM' | appTranslate }}
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
        min-width: 320px;
      }
      .dialog-title {
        margin: 0 0 12px;
        font-size: 1.25rem;
      }
      .field-note {
        margin: 8px 0 0;
        font-size: 12px;
        color: var(--text-muted, #6b7280);
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
export class SavingsOfficerDialogComponent {
  private readonly overlay = inject(OVERLAY);
  private readonly staffApi = inject(STAFF_API);

  readonly staff = signal<readonly Staff[]>([]);
  officerId: number | null = null;

  constructor() {
    this.staffApi.list({ loanOfficersOnly: true, status: 'active' }).subscribe({
      next: (members) => this.staff.set(members),
      error: () => this.staff.set([]),
    });
  }

  confirm(): void {
    if (this.officerId === null) return;
    void this.overlay.dismissModal<SavingsOfficerResult>({ toSavingsOfficerId: this.officerId });
  }

  dismiss(): void {
    void this.overlay.dismissModal();
  }
}
