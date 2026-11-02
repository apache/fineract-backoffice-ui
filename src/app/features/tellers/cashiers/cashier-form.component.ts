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
import { STAFF_API, Staff, TELLER_API, TranslatePipe } from '../../../core/adapters';
import { toIsoDate } from '../../../core/utils/date-formatter';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonToggle,
  IonButton,
  IonSpinner,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
} from '@ionic/angular/standalone';
import { createPickersReady } from '../../../shared/utils/pickers-ready';

/** What the allocation form edits. Dates are kept as `Date`s until submit, as the pickers produce them. */
interface CashierForm {
  staffId?: number;
  isFullDay: boolean;
  description?: string;
}

@Component({
  selector: 'app-cashier-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonToggle,
    IonButton,
    IonSpinner,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    TooltipDirective,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{
            (isEdit() ? 'TELLERS.EDIT_CASHIER' : 'TELLERS.ALLOCATE_CASHIER') | appTranslate
          }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #cashierForm="ngForm" (ngSubmit)="onSubmit()" class="cashier-form">
            <ion-grid class="ion-no-padding">
              <ion-row>
                <!-- Staff Selection -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" [appTooltip]="'HELP.CASHIER_STAFF_DESC' | appTranslate">
                    <ion-label position="stacked">{{ 'TELLERS.STAFF' | appTranslate }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'TELLERS.STAFF' | appTranslate"
                      interface="popover"
                      name="staffId"
                      [(ngModel)]="cashier.staffId"
                      required
                      id="cashier-staff-select"
                      data-testid="cashier-staff-select"
                    >
                      @for (member of staff(); track member.id) {
                        <ion-select-option [value]="member.id">{{
                          member.displayName
                        }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>

                <!-- Start Date -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'TELLERS.START_DATE' | appTranslate
                    }}</ion-label>
                    @if (pickersReady()) {
                      <ion-datetime-button
                        datetime="cashier-start-date-picker"
                      ></ion-datetime-button>
                    }
                    <ion-modal [keepContentsMounted]="true">
                      <ng-template>
                        <ion-datetime
                          id="cashier-start-date-picker"
                          data-testid="cashier-start-date-picker"
                          presentation="date"
                          [value]="startDate()"
                          (ionChange)="onStartDateChange($event)"
                        ></ion-datetime>
                      </ng-template>
                    </ion-modal>
                  </ion-item>
                </ion-col>

                <!-- End Date -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'TELLERS.END_DATE' | appTranslate
                    }}</ion-label>
                    @if (pickersReady()) {
                      <ion-datetime-button datetime="cashier-end-date-picker"></ion-datetime-button>
                    }
                    <ion-modal [keepContentsMounted]="true">
                      <ng-template>
                        <ion-datetime
                          id="cashier-end-date-picker"
                          data-testid="cashier-end-date-picker"
                          presentation="date"
                          [value]="endDate()"
                          (ionChange)="onEndDateChange($event)"
                        ></ion-datetime>
                      </ng-template>
                    </ion-modal>
                  </ion-item>
                </ion-col>

                <!-- Full Time Toggle -->
                <ion-col size="12" size-md="6">
                  <ion-item>
                    <ion-label>{{ 'TELLERS.IS_FULL_TIME' | appTranslate }}</ion-label>
                    <ion-toggle
                      name="isFullDay"
                      [(ngModel)]="cashier.isFullDay"
                      id="cashier-full-day-toggle"
                      data-testid="cashier-full-day-toggle"
                      slot="end"
                    ></ion-toggle>
                  </ion-item>
                </ion-col>

                <!-- Description -->
                <ion-col size="12">
                  <ion-item fill="outline" class="full-width">
                    <ion-label position="stacked">{{ 'COMMON.NOTE' | appTranslate }}</ion-label>
                    <ion-textarea
                      [attr.aria-label]="'COMMON.NOTE' | appTranslate"
                      name="description"
                      [(ngModel)]="cashier.description"
                      rows="2"
                      id="cashier-description-textarea"
                      data-testid="cashier-description-textarea"
                    ></ion-textarea>
                  </ion-item>
                </ion-col>
              </ion-row>
            </ion-grid>

            <div class="form-actions">
              <ion-button
                fill="clear"
                color="medium"
                type="button"
                (click)="onCancel()"
                [disabled]="isSaving()"
                id="cashier-cancel-btn"
                data-testid="cashier-cancel-btn"
              >
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="cashierForm.invalid || isSaving()"
                id="cashier-submit-btn"
                data-testid="cashier-submit-btn"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent" slot="start"></ion-spinner>
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
})
export class CashierFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly tellerApi = inject(TELLER_API);
  private readonly staffApi = inject(STAFF_API);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  tellerId = 0;
  cashierId = 0;
  /** True on `cashiers/:cashierId/edit`, which modifies the allocation instead of creating one. */
  readonly isEdit = signal(false);
  readonly isSaving = signal(false);

  cashier: CashierForm = {
    isFullDay: true,
  };

  /**
   * ISO-8601 `YYYY-MM-DD`, not `Date`.
   *
   * The pickers now bind `[value]`, which they did not before — without it a loaded allocation's
   * dates had nowhere to land and the edit form would have shown today for both. `ion-datetime`
   * reads and emits this format, and so does the adapter, so holding the string means no
   * conversion in either direction and no timezone to get wrong on the way through.
   */
  readonly startDate = signal(toIsoDate(new Date()));
  readonly endDate = signal(toIsoDate(new Date()));
  readonly staff = signal<Staff[]>([]);

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.tellerId = +params['tellerId'];
      const cashierId = params['cashierId'];
      if (cashierId) {
        this.cashierId = +cashierId;
        this.isEdit.set(true);
        this.loadCashier();
      }
    });
    this.loadStaff();
  }

  onStartDateChange(event: CustomEvent): void {
    if (event.detail.value) {
      this.startDate.set(toIsoDate(new Date(event.detail.value as string)));
    }
  }

  onEndDateChange(event: CustomEvent): void {
    if (event.detail.value) {
      this.endDate.set(toIsoDate(new Date(event.detail.value as string)));
    }
  }

  /**
   * Prefills from the allocation being edited.
   *
   * A date Fineract did not send is left at the form's default rather than blanked: the platform
   * requires both ends of the period, so an empty picker would only buy a refusal.
   */
  private loadCashier(): void {
    this.tellerApi.getCashier(this.tellerId, this.cashierId).subscribe({
      next: (cashier) => {
        this.cashier = {
          staffId: cashier.staffId ?? undefined,
          isFullDay: cashier.isFullDay,
          description: cashier.description ?? undefined,
        };
        if (cashier.startDate) {
          this.startDate.set(cashier.startDate);
        }
        if (cashier.endDate) {
          this.endDate.set(cashier.endDate);
        }
      },
      error: (err: unknown) => {
        console.error('Failed to load the cashier allocation', err);
      },
    });
  }

  private loadStaff(): void {
    this.staffApi.list().subscribe({
      next: (data) => {
        this.staff.set(data);
      },
      error: (err: unknown) => {
        console.error('Failed to load staff', err);
      },
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);

    const payload = {
      // The form cannot submit without a staff member: the field is `required`, and the button
      // is disabled while the form is invalid.
      staffId: this.cashier.staffId!,
      isFullDay: this.cashier.isFullDay,
      description: this.cashier.description,
      startDate: this.startDate(),
      endDate: this.endDate(),
    };

    const saved = this.isEdit()
      ? this.tellerApi.updateCashier(this.tellerId, this.cashierId, payload)
      : this.tellerApi.createCashier(this.tellerId, payload);

    saved.subscribe({
      next: () => this.router.navigate(['/tellers', this.tellerId, 'cashiers']),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate(['/tellers', this.tellerId, 'cashiers']);
  }
}
