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
import { I18N, TranslatePipe } from '../../../core/adapters';
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
  IonModal,
  IonNote,
} from '@ionic/angular/standalone';
import { ClientFamilyMemberService, ClientFamilyMemberRequest, CodeValueData } from '../../../api';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../../core/utils/date-formatter';
import { ButtonComponent } from '../../../ui/button/button.component';
import { MutationOutcomeService } from '../../../core/services/mutation-outcome.service';
import { PlatformDateService } from '../../../core/services/platform-date.service';
import { DeferredDatetimeButtonComponent } from '../../../ui/deferred-datetime-button/deferred-datetime-button.component';
import { toIsoFineractDate } from '../../../core/adapters/api/fineract-date';

/**
 * A calendar day as a local `Date`, from the ISO date Fineract's payloads reduce to.
 *
 * Measured against a real Fineract: `GET /clients/{id}/familymembers/{memberId}` answers
 * `"dateOfBirth": "2026-10-31"`, a string, where this form previously indexed the value as
 * `[year, month, day]`. Indexing the string read its characters instead — `'2'`, `'0'`, `'2'` —
 * and `new Date('2', -1, '2')` resolves to 2 December 1901, which an unchanged edit then saved
 * over the member's real birth date. Narrowed through `toIsoFineractDate` first, so either
 * shape the platform might send arrives here as one.
 *
 * Local midnight, matching the timestamp handed to the picker, so the day the operator sees and
 * the day that is saved are the same one in every zone.
 */
function fromIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

@Component({
  selector: 'app-client-family-member-form',
  standalone: true,
  imports: [
    FormsModule,
    ButtonComponent,
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
    DeferredDatetimeButtonComponent,
    IonModal,
    IonNote,
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
                    <ion-label position="stacked"
                      >{{ 'CLIENTS.FIRST_NAME' | appTranslate
                      }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                    >
                    <ion-input
                      [attr.aria-label]="'CLIENTS.FIRST_NAME' | appTranslate"
                      type="text"
                      name="firstName"
                      #firstName="ngModel"
                      [(ngModel)]="member().firstName"
                      required
                      (ionBlur)="firstName.control.markAsTouched()"
                      [attr.aria-invalid]="firstName.invalid && firstName.touched"
                      [attr.aria-describedby]="
                        firstName.invalid && firstName.touched ? 'family-first-name-error' : null
                      "
                      id="family-first-name-input"
                      data-testid="family-first-name-input"
                    ></ion-input>
                  </ion-item>
                  @if (firstName.invalid && firstName.touched) {
                    <ion-note
                      color="danger"
                      class="field-error"
                      id="family-first-name-error"
                      role="alert"
                      data-testid="family-first-name-error"
                    >
                      {{ 'COMMON.REQUIRED' | appTranslate }}
                    </ion-note>
                  }
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
                    <ion-label position="stacked"
                      >{{ 'CLIENTS.LAST_NAME' | appTranslate
                      }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                    >
                    <ion-input
                      [attr.aria-label]="'CLIENTS.LAST_NAME' | appTranslate"
                      type="text"
                      name="lastName"
                      #lastName="ngModel"
                      [(ngModel)]="member().lastName"
                      required
                      (ionBlur)="lastName.control.markAsTouched()"
                      [attr.aria-invalid]="lastName.invalid && lastName.touched"
                      [attr.aria-describedby]="
                        lastName.invalid && lastName.touched ? 'family-last-name-error' : null
                      "
                      id="family-last-name-input"
                      data-testid="family-last-name-input"
                    ></ion-input>
                  </ion-item>
                  @if (lastName.invalid && lastName.touched) {
                    <ion-note
                      color="danger"
                      class="field-error"
                      id="family-last-name-error"
                      role="alert"
                      data-testid="family-last-name-error"
                    >
                      {{ 'COMMON.REQUIRED' | appTranslate }}
                    </ion-note>
                  }
                </ion-col>
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline">
                    <ion-label position="stacked"
                      >{{ 'CLIENTS.RELATIONSHIP' | appTranslate
                      }}<span class="required-marker" aria-hidden="true">*</span></ion-label
                    >
                    <ion-select
                      [attr.aria-label]="'CLIENTS.RELATIONSHIP' | appTranslate"
                      interface="popover"
                      name="relationshipId"
                      #relationshipId="ngModel"
                      [(ngModel)]="member().relationshipId"
                      required
                      (ionBlur)="relationshipId.control.markAsTouched()"
                      [attr.aria-invalid]="relationshipId.invalid && relationshipId.touched"
                      [attr.aria-describedby]="
                        relationshipId.invalid && relationshipId.touched
                          ? 'family-relationship-error'
                          : null
                      "
                      id="family-relationship-select"
                      data-testid="family-relationship-select"
                    >
                      @for (opt of relationshipOptions(); track opt.id) {
                        <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                  @if (relationshipId.invalid && relationshipId.touched) {
                    <ion-note
                      color="danger"
                      class="field-error"
                      id="family-relationship-error"
                      role="alert"
                      data-testid="family-relationship-error"
                    >
                      {{ 'COMMON.REQUIRED' | appTranslate }}
                    </ion-note>
                  }
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
                    <!-- See maxDateOfBirth. -->
                    @if (maxDateOfBirth(); as max) {
                      <app-deferred-datetime-button
                        datetimeId="family-dob-picker"
                        [placeholder]="
                          pickerDateOfBirth()
                            ? ''
                            : ('CLIENTS.DATE_OF_BIRTH_NOT_SET' | appTranslate)
                        "
                      ></app-deferred-datetime-button>
                      <ion-modal [keepContentsMounted]="true">
                        <ng-template>
                          <ion-datetime
                            id="family-dob-picker"
                            data-testid="family-dob-picker"
                            presentation="date"
                            [value]="pickerDateOfBirth()"
                            [max]="max"
                            (ionChange)="onDobChange($event)"
                          ></ion-datetime>
                        </ng-template>
                      </ion-modal>
                    }
                    @if (!isEditMode && pickerDateOfBirth()) {
                      <app-button
                        type="button"
                        intent="neutral"
                        emphasis="quiet"
                        size="small"
                        id="clear-family-date-of-birth"
                        data-testid="clear-family-date-of-birth"
                        (click)="clearCreateDateOfBirth()"
                      >
                        {{ 'CLIENTS.CLEAR_DATE_OF_BIRTH' | appTranslate }}
                      </app-button>
                    }
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
              @if (!familyForm.form.valid) {
                <ion-note
                  color="medium"
                  class="submit-hint"
                  data-testid="family-submit-hint"
                  aria-live="polite"
                >
                  {{ 'COMMON.COMPLETE_REQUIRED_FIELDS' | appTranslate }}
                </ion-note>
              }
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
                [disabled]="!familyForm.form.valid || isSaving()"
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
  styles: [
    `
      .required-marker {
        color: var(--ion-color-danger, #eb445a);
        margin-inline-start: 2px;
      }
      .field-error {
        display: block;
        padding-inline-start: 4px;
        margin-top: -4px;
        font-size: 0.8125rem;
      }
      .submit-hint {
        display: block;
        align-self: center;
        text-align: end;
        font-size: 0.8125rem;
      }
    `,
  ],
})
export class ClientFamilyMemberFormComponent implements OnInit {
  private readonly familyService = inject(ClientFamilyMemberService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly platformDate = inject(PlatformDateService);
  private readonly mutationOutcome = inject(MutationOutcomeService);
  private readonly i18n = inject(I18N);

  private readonly clientViewPath = '/clients/view';

  clientId!: number;
  memberId?: number;
  isEditMode = false;

  readonly relationshipOptions = signal<CodeValueData[]>([]);
  readonly genderOptions = signal<CodeValueData[]>([]);
  readonly maritalStatusOptions = signal<CodeValueData[]>([]);
  readonly professionOptions = signal<CodeValueData[]>([]);

  dateOfBirth?: Date;
  readonly pickerDateOfBirth = signal<string | null>(null);
  /**
   * The platform's today, once it is known; the picker is not rendered before then.
   *
   * `ion-datetime` settles the month it opens on in `componentWillLoad`, by clamping the
   * browser's today to `max`, and `maxChanged` never revisits it. A picker created before this
   * resolved would open on the browser's month, and where that is later than the platform's
   * every day on screen would be disabled and the days the operator may pick would be in an
   * earlier month.
   */
  readonly maxDateOfBirth = signal<string | undefined>(undefined);
  readonly isSaving = signal(false);

  clearCreateDateOfBirth(): void {
    this.dateOfBirth = undefined;
    this.pickerDateOfBirth.set(null);
  }

  onDobChange(event: CustomEvent): void {
    if (event.detail.value) {
      this.dateOfBirth = new Date(event.detail.value as string);
      this.pickerDateOfBirth.set(event.detail.value as string);
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
    this.boundDateOfBirth();

    if (this.memberId) {
      this.isEditMode = true;
      this.loadMemberData();
    }
  }

  /**
   * Bounds the picker at the platform's today, which is the day Fineract measures a birth date
   * against: `validateForCreate` refuses a `dateOfBirth` later than
   * `DateUtils.getBusinessLocalDate()` — the business date where that feature governs, and the
   * tenant's own today where it does not. Unbounded, the picker offered every day of the
   * current month and beyond, so a birth date in the future was one click away and the only
   * thing that said no was the platform.
   *
   * Through `PlatformDateService.resolveToday()` rather than the browser's clock, because for a
   * tenant east of the operator those are different days for part of every day (#758), and the
   * browser's is the one opinion the platform does not share.
   */
  private boundDateOfBirth(): void {
    this.platformDate.resolveToday().subscribe((today) => this.maxDateOfBirth.set(today));
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
        const loadedDate = toIsoFineractDate(data.dateOfBirth);
        // Keep the local timestamp form expected by the existing Date-based change handler.
        this.pickerDateOfBirth.set(loadedDate ? `${loadedDate}T00:00:00` : null);
        this.dateOfBirth = loadedDate ? fromIsoDate(loadedDate) : undefined;
      });
  }

  onSubmit(): void {
    const payload: ClientFamilyMemberRequest = {
      ...this.member(),
      dateOfBirth: this.dateOfBirth ? formatDateToFineract(this.dateOfBirth) : undefined,
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };

    this.isSaving.set(true);

    const saved = this.isEditMode
      ? this.familyService.putClientsClientIdFamilymembersFamilyMemberId(
          this.memberId!,
          this.clientId,
          payload,
        )
      : this.familyService.postClientsClientIdFamilymembers(this.clientId, payload);

    saved.subscribe({
      next: (response) => {
        this.isSaving.set(false);
        this.mutationOutcome.complete({
          response,
          successMessage: this.i18n.translate(
            this.isEditMode ? 'CLIENTS.FAMILY_MEMBER_UPDATED' : 'CLIENTS.FAMILY_MEMBER_ADDED',
          ),
          // A family member has no page of its own, so the record the operator was working on
          // is the client it belongs to. Passed explicitly: the `resourceId` these two commands
          // return is the member's, and routing to `/clients/view/<memberId>` would open
          // somebody else's client.
          recordId: this.clientId,
          recordRoute: () => [this.clientViewPath, this.clientId],
        });
      },
      // Reported by `errorInterceptor`, which turns the platform's refusal into a toast that
      // names the field. A `console.error` here would only add a line the operator cannot see.
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.clientViewPath, this.clientId]);
  }
}
