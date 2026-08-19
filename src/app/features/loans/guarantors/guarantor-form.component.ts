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
import { GuarantorsService, GuarantorsRequest, EnumOptionData } from '../../../api';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatArrayDate,
  formatDateToFineract,
  toIsoDate,
} from '../../../core/utils/date-formatter';
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
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

/**
 * Create / edit form for a loan guarantor. The guarantor-type options come from the
 * guarantor template endpoint; external (person) guarantors capture name/address,
 * while internal guarantors reference an existing client (entityId).
 */
@Component({
  selector: 'app-guarantor-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonButton,
    IonSpinner,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ isEditMode ? ('GUARANTORS.EDIT' | translate) : ('GUARANTORS.CREATE' | translate) }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #guarantorForm="ngForm" (ngSubmit)="onSubmit()" class="guarantor-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'GUARANTORS.TYPE' | translate }}</ion-label>
              <ion-select
                [attr.aria-label]="'GUARANTORS.TYPE' | translate"
                interface="popover"
                name="guarantorTypeId"
                [(ngModel)]="guarantor().guarantorTypeId"
                required
              >
                @for (opt of guarantorTypeOptions(); track opt.id) {
                  <ion-select-option [value]="opt.id">{{ opt.value }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'GUARANTORS.ENTITY_ID' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'GUARANTORS.ENTITY_ID' | translate"
                type="number"
                name="entityId"
                [(ngModel)]="guarantor().entityId"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'GUARANTORS.FIRST_NAME' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'GUARANTORS.FIRST_NAME' | translate"
                name="firstname"
                [(ngModel)]="guarantor().firstname"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'GUARANTORS.LAST_NAME' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'GUARANTORS.LAST_NAME' | translate"
                name="lastname"
                [(ngModel)]="guarantor().lastname"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'GUARANTORS.ADDRESS_LINE1' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'GUARANTORS.ADDRESS_LINE1' | translate"
                name="addressLine1"
                [(ngModel)]="guarantor().addressLine1"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'GUARANTORS.MOBILE_NUMBER' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'GUARANTORS.MOBILE_NUMBER' | translate"
                name="mobileNumber"
                [(ngModel)]="guarantor().mobileNumber"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'GUARANTORS.SAVINGS_ID' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'GUARANTORS.SAVINGS_ID' | translate"
                type="number"
                name="savingsId"
                [(ngModel)]="guarantor().savingsId"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'GUARANTORS.CLIENT_RELATIONSHIP_TYPE_ID' | translate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'GUARANTORS.CLIENT_RELATIONSHIP_TYPE_ID' | translate"
                type="number"
                name="clientRelationshipTypeId"
                [(ngModel)]="guarantor().clientRelationshipTypeId"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'GUARANTORS.AMOUNT' | translate }}</ion-label>
              <ion-input
                [attr.aria-label]="'GUARANTORS.AMOUNT' | translate"
                type="number"
                name="amount"
                [(ngModel)]="guarantor().amount"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'GUARANTORS.DOB' | translate }}</ion-label>
              <ion-datetime-button datetime="dobDate-picker"></ion-datetime-button>
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="dobDate-picker"
                    data-testid="dobDate-picker"
                    presentation="date"
                    name="dobDate"
                    [ngModel]="dobDate()"
                    (ngModelChange)="dobDate.set($event)"
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
                [disabled]="guarantorForm.invalid || isSaving()"
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
      .guarantor-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class GuarantorFormComponent implements OnInit {
  private readonly guarantorsService = inject(GuarantorsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  loanId!: number;
  guarantorId: number | null = null;
  isEditMode = false;
  readonly isSaving = signal(false);

  readonly guarantor = signal<GuarantorsRequest>({});
  readonly guarantorTypeOptions = signal<EnumOptionData[]>([]);
  readonly dobDate = signal<string | null>(null);

  ngOnInit(): void {
    this.loanId = Number(this.route.snapshot.paramMap.get('loanId'));

    this.guarantorsService.getLoansLoanIdGuarantorsTemplate(this.loanId).subscribe((tpl) => {
      this.guarantorTypeOptions.set(tpl.guarantorTypeOptions ?? []);
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.guarantorId = +id;
      this.isEditMode = true;
      this.load();
    }
  }

  load(): void {
    if (!this.guarantorId) return;
    this.guarantorsService
      .getLoansLoanIdGuarantorsGuarantorId(this.loanId, this.guarantorId)
      .subscribe((data) => {
        this.guarantor.set({
          guarantorTypeId: data.guarantorTypeId,
          entityId: data.entityId,
          firstname: data.firstname,
          lastname: data.lastname,
          addressLine1: data.addressLine1,
          mobileNumber: data.mobileNumber,
          savingsId: data.savingsId,
          clientRelationshipTypeId: data.clientRelationshipTypeId,
          amount: data.amount,
        });
        if (data.dob) {
          const dob = data.dob as unknown as number[];
          this.dobDate.set(
            Array.isArray(dob) ? formatArrayDate(dob) : toIsoDate(new Date(data.dob)),
          );
        }
      });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const payload: GuarantorsRequest = {
      ...this.guarantor(),
      locale: FINERACT_LOCALE,
      dateFormat: FINERACT_DATE_FORMAT,
    };
    if (this.dobDate()) {
      payload.dob = formatDateToFineract(this.dobDate());
    }
    const request$ =
      this.isEditMode && this.guarantorId
        ? this.guarantorsService.putLoansLoanIdGuarantorsGuarantorId(
            this.loanId,
            this.guarantorId,
            payload,
          )
        : this.guarantorsService.postLoansLoanIdGuarantors(this.loanId, payload);

    request$.subscribe({
      next: () => this.router.navigate(['/loans', this.loanId, 'guarantors']),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate(['/loans', this.loanId, 'guarantors']);
  }
}
