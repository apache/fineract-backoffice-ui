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
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  LoanOriginatorsService,
  PostLoanOriginatorsRequest,
  GetCodeValuesDataResponse,
} from '../../../api';

/**
 * Create / edit form for a loan originator master-data record.
 * Originator-type, channel-type and status options come from the originator template endpoint.
 */
@Component({
  selector: 'app-loan-originator-form',
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
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{
              isEditMode()
                ? ('LOAN_ORIGINATORS.EDIT' | appTranslate)
                : ('LOAN_ORIGINATORS.CREATE' | appTranslate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #originatorForm="ngForm" (ngSubmit)="onSubmit()" class="originator-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'LOAN_ORIGINATORS.NAME' | appTranslate }}</ion-label>
              <ion-input
                [attr.aria-label]="'LOAN_ORIGINATORS.NAME' | appTranslate"
                name="name"
                [(ngModel)]="originator().name"
                required
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'LOAN_ORIGINATORS.EXTERNAL_ID' | appTranslate
              }}</ion-label>
              <ion-input
                [attr.aria-label]="'LOAN_ORIGINATORS.EXTERNAL_ID' | appTranslate"
                name="externalId"
                [(ngModel)]="originator().externalId"
              ></ion-input>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'LOAN_ORIGINATORS.ORIGINATOR_TYPE' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'LOAN_ORIGINATORS.ORIGINATOR_TYPE' | appTranslate"
                interface="popover"
                name="originatorTypeId"
                [(ngModel)]="originator().originatorTypeId"
              >
                @for (opt of originatorTypeOptions(); track opt.id) {
                  <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'LOAN_ORIGINATORS.CHANNEL_TYPE' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'LOAN_ORIGINATORS.CHANNEL_TYPE' | appTranslate"
                interface="popover"
                name="channelTypeId"
                [(ngModel)]="originator().channelTypeId"
              >
                @for (opt of channelTypeOptions(); track opt.id) {
                  <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'LOAN_ORIGINATORS.STATUS' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'LOAN_ORIGINATORS.STATUS' | appTranslate"
                interface="popover"
                name="status"
                [(ngModel)]="originator().status"
              >
                @for (opt of statusOptions(); track opt) {
                  <ion-select-option [value]="opt">{{ opt }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="originatorForm.invalid || isSaving()"
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
      .originator-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class LoanOriginatorFormComponent implements OnInit {
  private readonly originatorsService = inject(LoanOriginatorsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/products/loan-originators';

  originatorId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly originator = signal<PostLoanOriginatorsRequest>({ name: '' });
  readonly originatorTypeOptions = signal<GetCodeValuesDataResponse[]>([]);
  readonly channelTypeOptions = signal<GetCodeValuesDataResponse[]>([]);
  readonly statusOptions = signal<string[]>([]);

  ngOnInit(): void {
    this.originatorsService.getLoanOriginatorsTemplate().subscribe((tpl) => {
      this.originatorTypeOptions.set(tpl.originatorTypeOptions ?? []);
      this.channelTypeOptions.set(tpl.channelTypeOptions ?? []);
      this.statusOptions.set(tpl.statusOptions ? Array.from(tpl.statusOptions) : []);
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.originatorId = +id;
        this.isEditMode.set(true);
        this.load();
      }
    });
  }

  load(): void {
    if (!this.originatorId) return;
    this.originatorsService.getLoanOriginatorsOriginatorId(this.originatorId).subscribe((data) => {
      this.originator.set({
        name: data.name ?? '',
        externalId: data.externalId,
        originatorTypeId: data.originatorType?.id,
        channelTypeId: data.channelType?.id,
        status: data.status,
      });
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const request$ =
      this.isEditMode() && this.originatorId
        ? this.originatorsService.putLoanOriginatorsOriginatorId(this.originatorId, {
            name: this.originator().name,
            originatorTypeId: this.originator().originatorTypeId,
            channelTypeId: this.originator().channelTypeId,
            status: this.originator().status,
          })
        : this.originatorsService.postLoanOriginators(this.originator());

    request$.subscribe({
      next: () => this.router.navigate([this.LIST_PATH]),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
