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
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { DefaultService, CommandWrapper, SmsCampaignData } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
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
  IonTextarea,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-sms-campaign-form',
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,
    TranslatePipe,
    IonButton,
    IonInput,
    IonTextarea,
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
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          {{ (isEditMode ? 'SMS_CAMPAIGNS.EDIT' : 'SMS_CAMPAIGNS.CREATE') | appTranslate }}
        </ion-card-title>
      </ion-card-header>

      <ion-card-content>
        <form #campaignForm="ngForm" (ngSubmit)="onSubmit(campaignForm)">
          <ion-item fill="outline" class="full-width">
            <ion-label position="stacked">{{ 'SMS_CAMPAIGNS.NAME' | appTranslate }}</ion-label>
            <ion-input
              [attr.aria-label]="'SMS_CAMPAIGNS.NAME' | appTranslate"
              name="campaignName"
              [(ngModel)]="model.campaignName"
              required
            ></ion-input>
          </ion-item>

          <ion-item fill="outline" class="full-width">
            <ion-label position="stacked">{{
              'SMS_CAMPAIGNS.CAMPAIGN_TYPE' | appTranslate
            }}</ion-label>
            <ion-select
              [attr.aria-label]="'SMS_CAMPAIGNS.CAMPAIGN_TYPE' | appTranslate"
              interface="popover"
              name="campaignType"
              [(ngModel)]="model.campaignType"
            >
              @for (opt of campaignTypeOptions(); track opt.id) {
                <ion-select-option [value]="opt.id">{{ opt.value }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          <ion-item fill="outline" class="full-width">
            <ion-label position="stacked">{{
              'SMS_CAMPAIGNS.TRIGGER_TYPE' | appTranslate
            }}</ion-label>
            <ion-select
              [attr.aria-label]="'SMS_CAMPAIGNS.TRIGGER_TYPE' | appTranslate"
              interface="popover"
              name="triggerType"
              [(ngModel)]="model.triggerType"
            >
              @for (opt of triggerTypeOptions(); track opt.id) {
                <ion-select-option [value]="opt.id">{{ opt.value }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          <ion-item fill="outline" class="full-width">
            <ion-label position="stacked">{{ 'SMS_CAMPAIGNS.RUN_DAY' | appTranslate }}</ion-label>
            <ion-input
              [attr.aria-label]="'SMS_CAMPAIGNS.RUN_DAY' | appTranslate"
              type="number"
              name="runOnDayOfMonth"
              [(ngModel)]="model.runOnDayOfMonth"
              min="1"
              max="31"
            ></ion-input>
          </ion-item>

          <ion-item fill="outline" class="full-width">
            <ion-label position="stacked">{{ 'SMS_CAMPAIGNS.MESSAGE' | appTranslate }}</ion-label>
            <ion-textarea
              [attr.aria-label]="'SMS_CAMPAIGNS.MESSAGE' | appTranslate"
              name="message"
              [(ngModel)]="model.message"
              required
              rows="4"
            ></ion-textarea>
          </ion-item>

          <ion-item fill="outline" class="full-width">
            <ion-label position="stacked">{{
              'SMS_CAMPAIGNS.PARAMETERIZED_MESSAGE' | appTranslate
            }}</ion-label>
            <ion-input
              [attr.aria-label]="'SMS_CAMPAIGNS.PARAMETERIZED_MESSAGE' | appTranslate"
              name="parameterizedMessage"
              [(ngModel)]="model.parameterizedMessage"
            ></ion-input>
          </ion-item>

          <div class="form-actions">
            <ion-button color="primary" type="submit" [disabled]="campaignForm.invalid">
              {{ 'SMS_CAMPAIGNS.SAVE' | appTranslate }}
            </ion-button>
            <ion-button fill="clear" type="button" (click)="cancel()">Cancel</ion-button>
          </div>
        </form>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
        margin-bottom: 16px;
      }
      .form-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }
      mat-card-content {
        padding-top: 16px;
      }
    `,
  ],
})
export class SmsCampaignFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(DefaultService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  isEditMode = false;
  campaignId: number | null = null;

  readonly campaignTypeOptions = signal<{ id: number; value: string }[]>([]);
  readonly triggerTypeOptions = signal<{ id: number; value: string }[]>([]);
  model: {
    campaignName: string;
    campaignType: number | null;
    triggerType: number | null;
    runOnDayOfMonth: number | null;
    message: string;
    parameterizedMessage: string;
  } = {
    campaignName: '',
    campaignType: null,
    triggerType: null,
    runOnDayOfMonth: null,
    message: '',
    parameterizedMessage: '',
  };

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode = true;
      this.campaignId = Number(idParam);
    }

    this.api.getSmscampaignsTemplate().subscribe({
      next: (template: SmsCampaignData) => {
        this.campaignTypeOptions.set(
          (template?.campaignTypeOptions ?? []).map((opt) => ({
            id: opt.id ?? 0,
            value: opt.value ?? '',
          })),
        );
        this.triggerTypeOptions.set(
          (template?.triggerTypeOptions ?? []).map((opt) => ({
            id: opt.id ?? 0,
            value: opt.value ?? '',
          })),
        );

        if (this.isEditMode && this.campaignId !== null) {
          this.loadCampaign(this.campaignId);
        }
      },
      error: () => {
        if (this.isEditMode && this.campaignId !== null) {
          this.loadCampaign(this.campaignId);
        }
      },
    });
  }

  private loadCampaign(id: number): void {
    this.api.getSmscampaignsResourceId(id).subscribe({
      next: (campaign: SmsCampaignData) => {
        const campaignData = campaign as Record<string, unknown>;
        this.model.campaignName = campaign?.campaignName ?? '';
        this.model.campaignType = campaign?.campaignType?.id ?? null;
        this.model.triggerType = campaign?.triggerType?.id ?? null;
        this.model.runOnDayOfMonth = (campaignData['runOnDayOfMonth'] as number) ?? null;
        this.model.message = (campaignData['message'] as string) ?? '';
        this.model.parameterizedMessage = (campaignData['parameterizedMessage'] as string) ?? '';
      },
    });
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      return;
    }

    const payload = {
      campaignName: this.model.campaignName,
      campaignType: this.model.campaignType,
      triggerType: this.model.triggerType,
      runOnDayOfMonth: this.model.runOnDayOfMonth,
      message: this.model.message,
      parameterizedMessage: this.model.parameterizedMessage,
    };

    if (this.isEditMode && this.campaignId !== null) {
      this.api.putSmscampaignsCampaignId(this.campaignId, payload as CommandWrapper).subscribe({
        next: () => this.onSuccess(),
        error: () => this.onError(),
      });
    } else {
      this.api.postSmscampaigns(payload as CommandWrapper).subscribe({
        next: () => this.onSuccess(),
        error: () => this.onError(),
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/campaigns/sms']);
  }

  private onSuccess(): void {
    const key = this.isEditMode ? 'SMS_CAMPAIGNS.EDIT' : 'SMS_CAMPAIGNS.CREATE';
    this.i18n.translateAsync(key).subscribe((msg: string) => {
      this.notifications.success(msg);
    });
    this.router.navigate(['/campaigns/sms']);
  }

  private onError(): void {
    this.notifications.error('An error occurred. Please try again.');
  }
}
