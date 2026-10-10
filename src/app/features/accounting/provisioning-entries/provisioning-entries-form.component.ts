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
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
import { ProvisioningEntriesService, ProvisionEntryRequest } from '../../../api';
import { formatDateToFineract } from '../../../core/utils/date-formatter';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonDatetime,
  IonDatetimeButton,
  IonItem,
  IonLabel,
  IonModal,
  IonSpinner,
} from '@ionic/angular/standalone';
import { createPickersReady } from '../../../shared/utils/pickers-ready';

/**
 * Generates a new provisioning entry for a given date, optionally creating the
 * matching journal entries.
 */
@Component({
  selector: 'app-provisioning-entries-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonCheckbox,
    IonItem,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonLabel,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'PROVISIONING_ENTRIES.CREATE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #entryForm="ngForm" (ngSubmit)="onSubmit()" class="provisioning-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'PROVISIONING_ENTRIES.DATE' | appTranslate
              }}</ion-label>
              @if (pickersReady()) {
                <ion-datetime-button datetime="date-picker"></ion-datetime-button>
              }
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="date-picker"
                    data-testid="date-picker"
                    presentation="date"
                    name="date"
                    [(ngModel)]="date"
                    required
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>

            <ion-checkbox name="createjournalentries" [(ngModel)]="createjournalentries">
              {{ 'PROVISIONING_ENTRIES.CREATE_JOURNAL_ENTRIES' | appTranslate }}
            </ion-checkbox>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="entryForm.invalid || isSaving()"
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
      .provisioning-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class ProvisioningEntriesFormComponent {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly entriesService = inject(ProvisioningEntriesService);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/accounting/provisioning-entries';
  private readonly DATE_FORMAT = 'yyyy-MM-dd';
  private readonly LOCALE = 'en';

  date: string | null = null;
  createjournalentries = false;
  readonly isSaving = signal(false);

  onSubmit(): void {
    if (!this.date) return;
    this.isSaving.set(true);
    const request: ProvisionEntryRequest = {
      date: formatDateToFineract(this.date),
      createjournalentries: this.createjournalentries,
      dateFormat: this.DATE_FORMAT,
      locale: this.LOCALE,
    };

    this.entriesService.postProvisioningentries(request).subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
