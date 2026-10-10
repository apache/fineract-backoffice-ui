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
import { TranslatePipe } from '../../../core/adapters';
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
  IonInput,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonButton,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
} from '@ionic/angular/standalone';
import { ClientFamilyMemberService, ClientFamilyMemberRequest, CodeValueData } from '../../../api';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../../core/utils/date-formatter';
import { createPickersReady } from '../../../shared/utils/pickers-ready';

@Component({
  selector: 'app-client-family-member-form',
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
    IonInput,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonButton,
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
                ? ('CLIENTS.EDIT_FAMILY_MEMBER' | appTranslate)
                : ('CLIENTS.ADD_FAMILY_MEMBER' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #familyForm="ngForm" (ngSubmit)="onSubmit()" class="family-form">
            <ion-grid class="ion-no-padding">
              <ion-row>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'CLIENTS.FIRST_NAME' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'CLIENTS.FIRST_NAME' | appTranslate"
                      type="text"
                      name="firstName"
                      [(ngModel)]="member().firstName"
                      required
                      id="family-first-name-input"
                      data-testid="family-first-name-input"
                    ></ion-input>
                  </ion-item>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'CLIENTS.MIDDLE_NAME' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'CLIENTS.MIDDLE_NAME' | appTranslate"
                      type="text"
                      name="middleName"
                      [(ngModel)]="member().middleName"
                      id="family-middle-name-input"
                      data-testid="family-middle-name-input"
                    ></ion-input>
                  </ion-item>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'CLIENTS.LAST_NAME' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'CLIENTS.LAST_NAME' | appTranslate"
                      type="text"
                      name="lastName"
                      [(ngModel)]="member().lastName"
                      required
                      id="family-last-name-input"
                      data-testid="family-last-name-input"
                    ></ion-input>
                  </ion-item>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'CLIENTS.RELATIONSHIP' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'CLIENTS.RELATIONSHIP' | appTranslate"
                      interface="popover"
                      name="relationshipId"
                      [(ngModel)]="member().relationshipId"
                      required
                      id="family-relationship-select"
                      data-testid="family-relationship-select"
                    >
                      @for (opt of relationshipOptions(); track opt.id) {
                        <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{ 'CLIENTS.GENDER' | appTranslate }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'CLIENTS.GENDER' | appTranslate"
                      interface="popover"
                      name="genderId"
                      [(ngModel)]="member().genderId"
                      id="family-gender-select"
                      data-testid="family-gender-select"
                    >
                      @for (opt of genderOptions(); track opt.id) {
                        <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'CLIENTS.MARITAL_STATUS' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'CLIENTS.MARITAL_STATUS' | appTranslate"
                      interface="popover"
                      name="maritalStatusId"
                      [(ngModel)]="member().maritalStatusId"
                      id="family-marital-status-select"
                      data-testid="family-marital-status-select"
                    >
                      @for (opt of maritalStatusOptions(); track opt.id) {
                        <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'CLIENTS.PROFESSION' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'CLIENTS.PROFESSION' | appTranslate"
                      interface="popover"
                      name="professionId"
                      [(ngModel)]="member().professionId"
                      id="family-profession-select"
                      data-testid="family-profession-select"
                    >
                      @for (opt of professionOptions(); track opt.id) {
                        <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'CLIENTS.QUALIFICATION' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'CLIENTS.QUALIFICATION' | appTranslate"
                      type="text"
                      name="qualification"
                      [(ngModel)]="member().qualification"
                      id="family-qualification-input"
                      data-testid="family-qualification-input"
                    ></ion-input>
                  </ion-item>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'CLIENTS.MOBILE_NO' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'CLIENTS.MOBILE_NO' | appTranslate"
                      type="text"
                      name="mobileNumber"
                      [(ngModel)]="member().mobileNumber"
                      id="family-mobile-input"
                      data-testid="family-mobile-input"
                    ></ion-input>
                  </ion-item>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'CLIENTS.DATE_OF_BIRTH' | appTranslate
                    }}</ion-label>
                    @if (pickersReady()) {
                      <ion-datetime-button datetime="family-dob-picker"></ion-datetime-button>
                    }
                    <ion-modal [keepContentsMounted]="true">
                      <ng-template>
                        <ion-datetime
                          id="family-dob-picker"
                          data-testid="family-dob-picker"
                          presentation="date"
                          (ionChange)="onDobChange($event)"
                        ></ion-datetime>
                      </ng-template>
                    </ion-modal>
                  </ion-item>
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{ 'CLIENTS.AGE' | appTranslate }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'CLIENTS.AGE' | appTranslate"
                      type="number"
                      name="age"
                      [(ngModel)]="member().age"
                      id="family-age-input"
                      data-testid="family-age-input"
                    ></ion-input>
                  </ion-item>
                </ion-col>
                <ion-col size="12">
                  <ion-item>
                    <ion-label>{{ 'CLIENTS.IS_DEPENDENT' | appTranslate }}</ion-label>
                    <ion-toggle
                      name="isDependent"
                      [(ngModel)]="member().isDependent"
                      id="family-dependent-toggle"
                      data-testid="family-dependent-toggle"
                      slot="end"
                    ></ion-toggle>
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
                id="family-cancel-btn"
                data-testid="family-cancel-btn"
              >
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="!familyForm.form.valid"
                id="family-submit-btn"
                data-testid="family-submit-btn"
              >
                {{ 'COMMON.SAVE' | appTranslate }}
              </ion-button>
            </div>
          </form>
        </ion-card-content>
      </ion-card>
    </div>
  `,
})
export class ClientFamilyMemberFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly familyService = inject(ClientFamilyMemberService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly clientViewPath = '/clients/view';

  clientId!: number;
  memberId?: number;
  isEditMode = false;

  readonly relationshipOptions = signal<CodeValueData[]>([]);
  readonly genderOptions = signal<CodeValueData[]>([]);
  readonly maritalStatusOptions = signal<CodeValueData[]>([]);
  readonly professionOptions = signal<CodeValueData[]>([]);

  dateOfBirth?: Date;

  onDobChange(event: CustomEvent): void {
    if (event.detail.value) {
      this.dateOfBirth = new Date(event.detail.value as string);
    }
  }

  readonly member = signal<ClientFamilyMemberRequest>({
    firstName: '',
    middleName: '',
    lastName: '',
    relationshipId: undefined,
    genderId: undefined,
    maritalStatusId: undefined,
    professionId: undefined,
    qualification: '',
    mobileNumber: '',
    age: undefined,
    isDependent: false,
  });

  ngOnInit(): void {
    this.clientId = Number(this.route.snapshot.paramMap.get('clientId'));
    this.memberId = Number(this.route.snapshot.paramMap.get('id'));

    this.loadTemplate();

    if (this.memberId) {
      this.isEditMode = true;
      this.loadMemberData();
    }
  }

  loadTemplate(): void {
    this.familyService.getClientsClientIdFamilymembersTemplate(this.clientId).subscribe((data) => {
      this.relationshipOptions.set(data.relationshipIdOptions || []);
      this.genderOptions.set(data.genderIdOptions || []);
      this.maritalStatusOptions.set(data.maritalStatusIdOptions || []);
      this.professionOptions.set(data.professionIdOptions || []);
    });
  }

  loadMemberData(): void {
    this.familyService
      .getClientsClientIdFamilymembersFamilyMemberId(this.memberId!, this.clientId)
      .subscribe((data) => {
        this.member.set({
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          relationshipId: data.relationshipId,
          genderId: data.genderId,
          maritalStatusId: data.maritalStatusId,
          professionId: data.professionId,
          qualification: data.qualification,
          mobileNumber: data.mobileNumber,
          age: data.age,
          isDependent: data.isDependent,
        });
        if (data.dateOfBirth) {
          const dob = data.dateOfBirth as unknown as number[];
          this.dateOfBirth = new Date(dob[0], dob[1] - 1, dob[2]);
        }
      });
  }

  onSubmit(): void {
    const payload: ClientFamilyMemberRequest = {
      ...this.member(),
      dateOfBirth: this.dateOfBirth ? formatDateToFineract(this.dateOfBirth) : undefined,
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };

    if (this.isEditMode) {
      this.familyService
        .putClientsClientIdFamilymembersFamilyMemberId(this.memberId!, this.clientId, payload)
        .subscribe({
          next: () => this.router.navigate([this.clientViewPath, this.clientId]),
          error: (err) => console.error('Failed to update family member', err),
        });
    } else {
      this.familyService.postClientsClientIdFamilymembers(this.clientId, payload).subscribe({
        next: () => this.router.navigate([this.clientViewPath, this.clientId]),
        error: (err) => console.error('Failed to add family member', err),
      });
    }
  }

  onCancel(): void {
    this.router.navigate([this.clientViewPath, this.clientId]);
  }
}
