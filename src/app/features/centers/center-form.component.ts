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
import { TranslatePipe } from '../../core/adapters';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import { toIsoDate } from '../../core/utils/date-formatter';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  CentersService,
  OfficesService,
  PostCentersRequest,
  PostCentersCenterIdRequest,
  PutCentersCenterIdRequest,
  GetOfficesResponse,
} from '../../api';
import { createPickersReady } from '../../shared/utils/pickers-ready';

/**
 * Component for creating and editing community centers.
 *
 * Centers are administrative groupings of groups in Fineract.
 * This component handles the lifecycle of center entities, ensuring
 * mandatory fields like activationDate are correctly handled for new entities.
 */
@Component({
  selector: 'app-center-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
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
    IonCheckbox,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonIcon,
    TooltipDirective,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('CENTERS.EDIT_CENTER' | appTranslate)
                : ('CENTERS.CREATE_CENTER' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #centerForm="ngForm" (ngSubmit)="onSubmit()" class="center-form">
            <div class="form-grid">
              <!-- Name -->
              <ion-item fill="outline" [appTooltip]="'HELP.CENTER_NAME_DESC' | appTranslate">
                <ion-label position="stacked">{{ 'CENTERS.NAME' | appTranslate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'CENTERS.NAME' | appTranslate"
                  name="name"
                  [(ngModel)]="center().name"
                  required
                ></ion-input>
              </ion-item>

              <!-- Office -->
              <ion-item fill="outline" [appTooltip]="'HELP.OFFICE_DESC' | appTranslate">
                <ion-label position="stacked">{{ 'COMMON.OFFICE' | appTranslate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'COMMON.OFFICE' | appTranslate"
                  interface="popover"
                  name="officeId"
                  [(ngModel)]="center().officeId"
                  required
                  [disabled]="isEditMode()"
                >
                  @for (office of offices(); track office.id) {
                    <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <!-- Activation Date -->
              @if (!isEditMode()) {
                <ion-item fill="outline" [appTooltip]="'HELP.ACTIVATION_DATE_DESC' | appTranslate">
                  <ion-label position="stacked">{{
                    'COMMON.ACTIVATION_DATE' | appTranslate
                  }}</ion-label>
                  @if (pickersReady()) {
                    <ion-datetime-button datetime="activationDate-picker"></ion-datetime-button>
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="activationDate-picker"
                        data-testid="activationDate-picker"
                        presentation="date"
                        name="activationDate"
                        [(ngModel)]="activationDate"
                        required
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>
              }

              <!-- Active -->
              <div class="checkbox-container">
                <ion-checkbox name="active" [(ngModel)]="center().active" [disabled]="isEditMode()">
                  {{ 'COMMON.ACTIVE' | appTranslate }}
                </ion-checkbox>
                <ion-icon
                  [appTooltip]="'HELP.ACTIVE_DESC' | appTranslate"
                  class="help-icon"
                  name="help-circle-outline"
                ></ion-icon>
              </div>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              @if (isEditMode() && !originalActive()) {
                <ion-button
                  color="secondary"
                  type="button"
                  (click)="onActivate()"
                  [disabled]="isSaving() || !activationDate"
                >
                  @if (isSaving()) {
                    <ion-spinner name="crescent"></ion-spinner>
                    {{ 'COMMON.SAVING' | appTranslate }}
                  } @else {
                    Activate Center
                  }
                </ion-button>
              }
              <ion-button
                color="primary"
                type="submit"
                [disabled]="centerForm.invalid || isSaving()"
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
        max-width: 900px;
        margin: 0 auto;
      }
      .center-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
      .checkbox-container {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 60px;
      }
      .help-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--text-muted);
        cursor: help;
      }
    `,
  ],
})
export class CenterFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly centersService = inject(CentersService);
  private readonly officesService = inject(OfficesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly DATE_FORMAT = 'yyyy-MM-dd';
  private readonly LIST_PATH = '/centers';

  centerId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);
  readonly originalActive = signal(false);

  readonly center = signal<PostCentersRequest>({
    active: true,
  });

  activationDate = toIsoDate(new Date());
  readonly offices = signal<GetOfficesResponse[]>([]);

  ngOnInit(): void {
    this.loadOffices();
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.centerId = +id;
        this.isEditMode.set(true);
        this.loadCenterData();
      }
    });
  }

  private loadOffices(): void {
    this.officesService.getOffices(true).subscribe((offices) => {
      this.offices.set(offices);
    });
  }

  private loadCenterData(): void {
    if (!this.centerId) return;
    this.centersService.getCentersCenterId(this.centerId).subscribe((data) => {
      this.originalActive.set(!!(data as Record<string, unknown>)['active']);
      this.center.set({
        name: data.name,
        officeId: data.officeId,
        active: this.originalActive(),
      });
    });
  }

  onActivate(): void {
    if (!this.centerId || !this.activationDate) return;
    this.isSaving.set(true);

    const formattedDate = toIsoDate(this.activationDate);

    const payload = {
      activationDate: formattedDate,
      dateFormat: this.DATE_FORMAT,
      locale: 'en',
    };

    this.centersService
      .postCentersCenterId(this.centerId, payload as PostCentersCenterIdRequest, 'activate')
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.originalActive.set(true);
          this.center().active = true;
        },
        error: () => this.isSaving.set(false),
      });
  }

  onSubmit(): void {
    this.isSaving.set(true);

    if (this.isEditMode() && this.centerId) {
      const payload: PutCentersCenterIdRequest = {
        name: this.center().name,
      };
      this.centersService.putCentersCenterId(this.centerId, payload).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    } else {
      const formattedDate = toIsoDate(this.activationDate);

      // Assert as Record to include mandatory undocumented fields for activation
      const payload: Record<string, unknown> = {
        ...this.center(),
        activationDate: formattedDate,
        dateFormat: this.DATE_FORMAT,
        locale: 'en',
      };

      this.centersService.postCenters(payload as PostCentersRequest).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
