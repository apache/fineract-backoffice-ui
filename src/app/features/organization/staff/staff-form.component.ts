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
import { OFFICE_API, STAFF_API, TranslatePipe } from '../../../core/adapters';
import type { Office } from '../../../core/adapters';
import { NotificationService } from '../../../core/services/notification.service';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonDatetime,
  IonDatetimeButton,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { toIsoDate } from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';

@Component({
  selector: 'app-staff-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonCheckbox,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode
                ? ('ORGANIZATION.EDIT_STAFF' | appTranslate)
                : ('ORGANIZATION.CREATE_STAFF' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #staffForm="ngForm" (ngSubmit)="onSubmit()" class="staff-form">
            <div class="form-grid">
              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.OFFICE' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'COMMON.OFFICE' | appTranslate"
                  interface="popover"
                  name="officeId"
                  [(ngModel)]="staff().officeId"
                  required
                  [disabled]="isEditMode"
                >
                  @for (office of offices(); track office.id) {
                    <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'CLIENTS.FIRST_NAME' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'CLIENTS.FIRST_NAME' | appTranslate"
                  name="firstname"
                  [(ngModel)]="staff().firstname"
                  required
                  [disabled]="isEditMode"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'CLIENTS.LAST_NAME' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'CLIENTS.LAST_NAME' | appTranslate"
                  name="lastname"
                  [(ngModel)]="staff().lastname"
                  required
                  [disabled]="isEditMode"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.EXTERNAL_ID' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.EXTERNAL_ID' | appTranslate"
                  name="externalId"
                  [(ngModel)]="staff().externalId"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'CLIENTS.MOBILE_NO' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'CLIENTS.MOBILE_NO' | appTranslate"
                  name="mobileNo"
                  [(ngModel)]="staff().mobileNo"
                  [disabled]="isEditMode"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.EMAIL' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.EMAIL' | appTranslate"
                  type="email"
                  name="emailAddress"
                  [(ngModel)]="staff().emailAddress"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'ACTIONS.ACTIVATION_DATE' | appTranslate
                }}</ion-label>
                @if (pickersReady()) {
                  <ion-datetime-button datetime="joiningDate-picker"></ion-datetime-button>
                }
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="joiningDate-picker"
                      data-testid="joiningDate-picker"
                      presentation="date"
                      name="joiningDate"
                      [ngModel]="joiningDate()"
                      (ngModelChange)="joiningDate.set($event)"
                      [disabled]="isEditMode"
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>
            </div>

            <div class="checkbox-group">
              <ion-checkbox name="isLoanOfficer" [(ngModel)]="staff().isLoanOfficer">
                {{ 'ORGANIZATION.IS_LOAN_OFFICER' | appTranslate }}
              </ion-checkbox>

              <ion-checkbox name="forceStatus" [(ngModel)]="staff().forceStatus">
                {{ 'ORGANIZATION.FORCE_STATUS' | appTranslate }}
              </ion-checkbox>

              @if (!isEditMode) {
                <ion-checkbox name="isActive" [(ngModel)]="staff().isActive">
                  {{ 'COMMON.ACTIVE' | appTranslate }}
                </ion-checkbox>
              }
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="!staffForm.form.valid">
                {{ 'COMMON.SAVE' | appTranslate }}
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
      .staff-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
      .checkbox-group {
        display: flex;
        flex-wrap: wrap;
        gap: 24px;
        margin: 8px 0;
      }
    `,
  ],
})
export class StaffFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly staffApi = inject(STAFF_API);
  private readonly officeApi = inject(OFFICE_API);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationService);

  private readonly staffListPath = '/organization/staff';

  staffId?: number;
  isEditMode = false;
  readonly offices = signal<readonly Office[]>([]);
  readonly joiningDate = signal(toIsoDate(new Date()));

  readonly staff = signal<{
    officeId?: number;
    firstname?: string;
    lastname?: string;
    externalId?: string | null;
    mobileNo?: string | null;
    emailAddress?: string | null;
    isLoanOfficer?: boolean;
    isActive?: boolean;
    forceStatus?: boolean;
  }>({
    officeId: undefined,
    firstname: '',
    lastname: '',
    externalId: '',
    mobileNo: '',
    isLoanOfficer: false,
    isActive: true,
    forceStatus: false,
  });

  ngOnInit(): void {
    this.loadOffices();
    this.staffId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.staffId) {
      this.isEditMode = true;
      this.loadStaffData();
    }
  }

  loadOffices(): void {
    this.officeApi.list().subscribe((data) => this.offices.set(data));
  }

  loadStaffData(): void {
    this.staffApi.get(this.staffId!).subscribe((member) => {
      this.staff.set({
        officeId: member.officeId ?? undefined,
        firstname: member.firstname,
        lastname: member.lastname,
        externalId: member.externalId,
        mobileNo: member.mobileNo,
        isLoanOfficer: member.isLoanOfficer,
        isActive: member.isActive,
        // Not a field Fineract returns — it is a create-time flag — so it starts false rather
        // than being read off the response through a cast, as it used to be.
        forceStatus: false,
        emailAddress: member.emailAddress,
      });
      // Already `YYYY-MM-DD`. This line used to run the value through `formatArrayDate()`,
      // which answers '-' for the string this endpoint actually sends, so the picker showed a
      // dash instead of the joining date.
      if (member.joiningDate) this.joiningDate.set(member.joiningDate);
    });
  }

  onSubmit(): void {
    const done = {
      next: () => void this.router.navigate([this.staffListPath]),
      error: () => this.notifications.error('Operation failed. Please try again.'),
    };

    if (this.isEditMode) {
      this.staffApi
        .update(this.staffId!, {
          externalId: this.staff().externalId,
          isLoanOfficer: this.staff().isLoanOfficer,
        })
        .subscribe(done);
    } else {
      // Two things that used to live here are the adapter's now: converting the joining date
      // to Fineract's own format and pairing it with the format and locale, and dropping the
      // optional text fields the form seeds to '' so its inputs bind. An empty string is a
      // value on the wire, not an omission, and Fineract validates it as one.
      const entered = this.staff();
      this.staffApi
        .create({
          officeId: entered.officeId!,
          firstname: entered.firstname ?? '',
          lastname: entered.lastname ?? '',
          externalId: entered.externalId,
          mobileNo: entered.mobileNo,
          emailAddress: entered.emailAddress,
          isLoanOfficer: entered.isLoanOfficer === true,
          isActive: entered.isActive === true,
          forceStatus: entered.forceStatus,
          joiningDate: this.joiningDate(),
        })
        .subscribe(done);
    }
  }

  onCancel(): void {
    this.router.navigate([this.staffListPath]);
  }
}
