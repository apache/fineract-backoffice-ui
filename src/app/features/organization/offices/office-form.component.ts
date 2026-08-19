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
import { formatArrayDate, toIsoDate } from '../../../core/utils/date-formatter';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import {
  OfficesService,
  PostOfficesRequest,
  PutOfficesOfficeIdRequest,
  GetOfficesResponse,
} from '../../../api';

@Component({
  selector: 'app-office-form',
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
    TooltipDirective,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('OFFICES.EDIT_OFFICE' | translate)
                : ('OFFICES.CREATE_OFFICE' | translate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #officeForm="ngForm" (ngSubmit)="onSubmit()" class="office-form">
            <div class="form-grid">
              <ion-item fill="outline" [appTooltip]="'HELP.OFFICE_NAME_DESC' | translate">
                <ion-label position="stacked">{{ 'OFFICES.NAME' | translate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'OFFICES.NAME' | translate"
                  name="name"
                  [(ngModel)]="office().name"
                  required
                ></ion-input>
              </ion-item>

              <ion-item fill="outline" [appTooltip]="'HELP.PARENT_OFFICE_DESC' | translate">
                <ion-label position="stacked">{{ 'OFFICES.PARENT' | translate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'OFFICES.PARENT' | translate"
                  interface="popover"
                  name="parentId"
                  [(ngModel)]="office().parentId"
                  required
                  [disabled]="isEditMode()"
                >
                  @for (o of offices(); track o.id) {
                    <ion-select-option [value]="o.id">{{ o.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline" [appTooltip]="'HELP.EXTERNAL_ID_DESC' | translate">
                <ion-label position="stacked">{{ 'OFFICES.EXTERNAL_ID' | translate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'OFFICES.EXTERNAL_ID' | translate"
                  name="externalId"
                  [(ngModel)]="office().externalId"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline" [appTooltip]="'HELP.OPENING_DATE_DESC' | translate">
                <ion-label position="stacked">{{ 'OFFICES.OPENING_DATE' | translate }}</ion-label>
                <ion-datetime-button datetime="openingDate-picker"></ion-datetime-button>
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="openingDate-picker"
                      data-testid="openingDate-picker"
                      presentation="date"
                      name="openingDate"
                      [ngModel]="openingDate()"
                      (ngModelChange)="openingDate.set($event)"
                      required
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="officeForm.invalid || isSaving()"
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
        max-width: 900px;
        margin: 0 auto;
      }
      .office-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
    `,
  ],
})
export class OfficeFormComponent implements OnInit {
  private readonly officesService = inject(OfficesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/organization/offices';

  officeId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly office = signal<PostOfficesRequest>({});
  readonly openingDate = signal(toIsoDate(new Date()));
  readonly offices = signal<GetOfficesResponse[]>([]);

  ngOnInit() {
    this.loadOffices();
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.officeId = +id;
        this.isEditMode.set(true);
        this.loadOfficeData();
      }
    });
  }

  loadOffices() {
    this.officesService.getOffices(true).subscribe((offices) => {
      this.offices.set(offices);
    });
  }

  loadOfficeData() {
    if (!this.officeId) return;
    this.officesService.getOfficesOfficeId(this.officeId).subscribe((data) => {
      if (data.openingDate) {
        this.openingDate.set(formatArrayDate(data.openingDate));
      }
      this.office.set({
        name: data.name,
        externalId: data.externalId,
        parentId: (data as Record<string, unknown>)['parentId'] as number,
      });
    });
  }

  onSubmit() {
    this.isSaving.set(true);
    const formattedDate = toIsoDate(this.openingDate());

    if (this.isEditMode() && this.officeId) {
      const payload: PutOfficesOfficeIdRequest = {
        name: this.office().name,
        externalId: this.office().externalId,
        openingDate: formattedDate,
        dateFormat: 'yyyy-MM-dd',
        locale: 'en',
      };
      this.officesService.putOfficesOfficeId(this.officeId, payload).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    } else {
      this.office().openingDate = formattedDate;
      this.office().dateFormat = 'yyyy-MM-dd';
      this.office().locale = 'en';
      this.officesService.postOffices(this.office()).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel() {
    this.router.navigate([this.LIST_PATH]);
  }
}
