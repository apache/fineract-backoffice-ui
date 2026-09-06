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
import { TranslateModule } from '@ngx-translate/core';
import {
  LoanInterestPauseService,
  InterestPauseRequestDto,
  InterestPauseResponseDto,
} from '../../../api';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonDatetime,
  IonDatetimeButton,
  IonItem,
  IonLabel,
  IonModal,
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  formatArrayDate,
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  toIsoDate,
} from '../../../core/utils/date-formatter';

/**
 * Parses a route segment that is meant to be a database id. Returns null for
 * anything that cannot be one, which `+value` would otherwise turn into NaN or
 * into a number the API cannot address.
 */
function toRouteId(value: string | null): number | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Create or edit an interest pause period on a loan. Submits a start/end date pair formatted
 * with the Fineract date format and locale. The loan and variation ids come from the route.
 */
@Component({
  selector: 'app-interest-pause-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonButton,
    IonSpinner,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
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
          <ion-card-title>
            {{ (isEditMode() ? 'INTEREST_PAUSES.EDIT' : 'INTEREST_PAUSES.CREATE') | translate }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #pauseForm="ngForm" (ngSubmit)="onSubmit()" class="pause-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'INTEREST_PAUSES.START_DATE' | translate
              }}</ion-label>
              <ion-datetime-button datetime="startDate-picker"></ion-datetime-button>
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="startDate-picker"
                    data-testid="startDate-picker"
                    presentation="date"
                    name="startDate"
                    [ngModel]="startDate()"
                    (ngModelChange)="startDate.set($event)"
                    required
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'INTEREST_PAUSES.END_DATE' | translate }}</ion-label>
              <ion-datetime-button datetime="endDate-picker"></ion-datetime-button>
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="endDate-picker"
                    data-testid="endDate-picker"
                    presentation="date"
                    name="endDate"
                    [ngModel]="endDate()"
                    (ngModelChange)="endDate.set($event)"
                    required
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="pauseForm.invalid || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | translate }}
                } @else {
                  {{ 'COMMON.SAVE' | translate }}
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
      .pause-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class InterestPauseFormComponent implements OnInit {
  private readonly pauseService = inject(LoanInterestPauseService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  loanId: number | null = null;
  variationId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly startDate = signal<string | null>(null);
  readonly endDate = signal<string | null>(null);

  ngOnInit(): void {
    const loanId = this.route.snapshot.paramMap.get('loanId');
    const variationId = this.route.snapshot.paramMap.get('variationId');
    this.loanId = toRouteId(loanId);
    if (variationId === null) {
      return;
    }

    // The route puts no constraint on the segment, so `edit/abc` used to give
    // `+'abc'` -> NaN. NaN is falsy, so `loadPause` and the save branch both
    // skipped it while `isEditMode` stayed true: the screen said Edit, the
    // pickers were empty, and Save created a second pause. Send an id that
    // cannot address a pause back to the list instead.
    this.variationId = toRouteId(variationId);
    if (this.variationId === null) {
      this.onCancel();
      return;
    }

    this.isEditMode.set(true);
    this.loadPause();
  }

  private loadPause(): void {
    if (!this.loanId || !this.variationId) return;

    this.pauseService.getLoansLoanIdInterestPauses(this.loanId).subscribe({
      next: (pauses: InterestPauseResponseDto[]) => {
        const pause = pauses.find(({ id }) => id === this.variationId);
        if (pause) {
          this.startDate.set(this.toFormDate(pause.startDate));
          this.endDate.set(this.toFormDate(pause.endDate));
        }
      },
      // The global error interceptor displays Fineract's response to the user.
      error: () => undefined,
    });
  }

  /**
   * Fineract's OpenAPI model declares these values as ISO strings, while older deployments
   * serialize `LocalDate` as `[year, month, day]`. Accept both so editing also works against
   * installations whose response shape predates the generated model.
   */
  private toFormDate(value: unknown): string | null {
    const date = Array.isArray(value) ? formatArrayDate(value) : toIsoDate(String(value ?? ''));
    return date && date !== '-' ? date : null;
  }

  onSubmit(): void {
    if (!this.loanId) return;
    this.isSaving.set(true);

    const request: InterestPauseRequestDto = {
      startDate: formatDateToFineract(this.startDate()),
      endDate: formatDateToFineract(this.endDate()),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };

    const save$ =
      this.isEditMode() && this.variationId
        ? this.pauseService.putLoansLoanIdInterestPausesVariationId(
            this.loanId,
            this.variationId,
            request,
          )
        : this.pauseService.postLoansLoanIdInterestPauses(this.loanId, request);

    save$.subscribe({
      next: () => this.router.navigate(['/loans', this.loanId, 'interest-pauses']),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate(['/loans', this.loanId, 'interest-pauses']);
  }
}
