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
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { BusinessStepConfigurationService, BusinessStep } from '../../../api';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

/**
 * Business step configuration: pick a job, load its configured steps, reorder them
 * and save the new order via the business-step configuration endpoint.
 */
@Component({
  selector: 'app-business-steps',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonIcon,
    IonButton,
    IonSpinner,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonList,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'BUSINESS_STEPS.TITLE' | translate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <ion-item fill="outline">
            <ion-label position="stacked">{{ 'BUSINESS_STEPS.JOB' | translate }}</ion-label>
            <ion-select
              [attr.aria-label]="'BUSINESS_STEPS.JOB' | translate"
              interface="popover"
              [(ngModel)]="selectedJob"
              (ionChange)="loadSteps()"
            >
              @for (job of jobNames(); track job) {
                <ion-select-option [value]="job">{{ job }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          @if (steps().length) {
            <ion-list>
              @for (step of steps(); track step.stepName; let i = $index) {
                <ion-item>
                  <span>{{ step.stepName }}</span>
                  <span matListItemMeta>
                    <ion-button
                      fill="clear"
                      type="button"
                      [disabled]="i === 0"
                      (click)="moveUp(i)"
                      [attr.aria-label]="'COMMON.MOVE_UP' | translate"
                    >
                      <ion-icon name="arrow-up-outline"></ion-icon>
                    </ion-button>
                    <ion-button
                      fill="clear"
                      type="button"
                      [disabled]="i === steps().length - 1"
                      (click)="moveDown(i)"
                      [attr.aria-label]="'COMMON.MOVE_DOWN' | translate"
                    >
                      <ion-icon name="arrow-down-outline"></ion-icon>
                    </ion-button>
                  </span>
                </ion-item>
              }
            </ion-list>
          } @else if (selectedJob) {
            <p>{{ 'BUSINESS_STEPS.NO_STEPS' | translate }}</p>
          }

          <div class="form-actions">
            <ion-button
              color="primary"
              type="button"
              [disabled]="!steps().length || isSaving()"
              (click)="onSave()"
            >
              @if (isSaving()) {
                <ion-spinner name="crescent"></ion-spinner>
                {{ 'COMMON.SAVING' | translate }}
              } @else {
                {{ 'COMMON.SAVE' | translate }}
              }
            </ion-button>
          </div>
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
    `,
  ],
})
export class BusinessStepsComponent implements OnInit {
  private readonly service = inject(BusinessStepConfigurationService);

  readonly jobNames = signal<string[]>([]);
  selectedJob = '';
  readonly steps = signal<BusinessStep[]>([]);
  readonly isSaving = signal(false);

  ngOnInit(): void {
    this.service.getJobsNames().subscribe((data) => {
      this.jobNames.set(data.businessJobs ?? []);
    });
  }

  loadSteps(): void {
    if (!this.selectedJob) return;
    this.service.getJobsJobNameSteps(this.selectedJob).subscribe((data) => {
      this.steps.set(
        [...(data.businessSteps ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      );
    });
  }

  moveUp(index: number): void {
    if (index <= 0) return;
    [this.steps()[index - 1], this.steps()[index]] = [this.steps()[index], this.steps()[index - 1]];
  }

  moveDown(index: number): void {
    if (index >= this.steps().length - 1) return;
    [this.steps()[index + 1], this.steps()[index]] = [this.steps()[index], this.steps()[index + 1]];
  }

  onSave(): void {
    if (!this.selectedJob) return;
    this.isSaving.set(true);
    const businessSteps: BusinessStep[] = this.steps().map((step, i) => ({
      stepName: step.stepName,
      order: i + 1,
    }));
    this.service.putJobsJobNameSteps(this.selectedJob, { businessSteps }).subscribe({
      next: () => this.isSaving.set(false),
      error: () => this.isSaving.set(false),
    });
  }
}
