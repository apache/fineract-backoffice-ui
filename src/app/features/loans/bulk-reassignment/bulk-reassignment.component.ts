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
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
import { BulkLoansService } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonDatetime,
  IonDatetimeButton,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../../core/utils/date-formatter';

/**
 * Minimal option shape shared by office and loan-officer dropdowns returned by the
 * loan-reassignment template endpoint.
 */
interface ReassignmentOption {
  id?: number;
  name?: string;
  displayName?: string;
}

/**
 * Template payload for bulk loan reassignment. The generated `getLoansLoanreassignmentTemplate`
 * is typed as `string` (raw OpenAPI), but the endpoint actually returns office and loan-officer
 * option lists, so the response is read through this loose shape.
 */
interface ReassignmentTemplate {
  officeOptions?: ReassignmentOption[];
  loanOfficerOptions?: ReassignmentOption[];
}

/**
 * Bulk Loan Reassignment — single action screen that moves every loan currently
 * assigned to one loan officer over to another within an office, on a given date.
 */
@Component({
  selector: 'app-bulk-reassignment',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
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
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'BULK_REASSIGNMENT.TITLE' | appTranslate }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #reassignForm="ngForm" (ngSubmit)="onSubmit()" class="reassign-form">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'BULK_REASSIGNMENT.OFFICE' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'BULK_REASSIGNMENT.OFFICE' | appTranslate"
                interface="popover"
                name="officeId"
                [(ngModel)]="officeId"
                (ionChange)="onOfficeChange()"
                required
              >
                @for (opt of officeOptions(); track opt.id) {
                  <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'BULK_REASSIGNMENT.FROM_OFFICER' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'BULK_REASSIGNMENT.FROM_OFFICER' | appTranslate"
                interface="popover"
                name="fromLoanOfficerId"
                [(ngModel)]="fromLoanOfficerId"
                required
              >
                @for (opt of loanOfficerOptions(); track opt.id) {
                  <ion-select-option [value]="opt.id">{{ opt.displayName }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'BULK_REASSIGNMENT.TO_OFFICER' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'BULK_REASSIGNMENT.TO_OFFICER' | appTranslate"
                interface="popover"
                name="toLoanOfficerId"
                [(ngModel)]="toLoanOfficerId"
                required
              >
                @for (opt of loanOfficerOptions(); track opt.id) {
                  <ion-select-option [value]="opt.id">{{ opt.displayName }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'BULK_REASSIGNMENT.ASSIGNMENT_DATE' | appTranslate
              }}</ion-label>
              <ion-datetime-button datetime="assignmentDate-picker"></ion-datetime-button>
              <ion-modal [keepContentsMounted]="true">
                <ng-template>
                  <ion-datetime
                    id="assignmentDate-picker"
                    data-testid="assignmentDate-picker"
                    presentation="date"
                    name="assignmentDate"
                    [(ngModel)]="assignmentDate"
                    required
                  ></ion-datetime>
                </ng-template>
              </ion-modal>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | appTranslate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="reassignForm.invalid || isSaving()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | appTranslate }}
                } @else {
                  {{ 'BULK_REASSIGNMENT.REASSIGN' | appTranslate }}
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
      .reassign-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    `,
  ],
})
export class BulkReassignmentComponent implements OnInit {
  private readonly bulkLoansService = inject(BulkLoansService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  private readonly LIST_PATH = '/loans';

  readonly isSaving = signal(false);

  officeId: number | null = null;
  fromLoanOfficerId: number | null = null;
  toLoanOfficerId: number | null = null;
  assignmentDate: string | null = null;

  readonly officeOptions = signal<ReassignmentOption[]>([]);
  readonly loanOfficerOptions = signal<ReassignmentOption[]>([]);

  ngOnInit(): void {
    this.loadTemplate();
  }

  loadTemplate(officeId?: number): void {
    this.bulkLoansService.getLoansLoanreassignmentTemplate(officeId).subscribe((tpl) => {
      const template = tpl as unknown as ReassignmentTemplate;
      this.officeOptions.set(template.officeOptions ?? []);
      this.loanOfficerOptions.set(template.loanOfficerOptions ?? []);
    });
  }

  onOfficeChange(): void {
    this.fromLoanOfficerId = null;
    this.toLoanOfficerId = null;
    this.loadTemplate(this.officeId ?? undefined);
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const body = JSON.stringify({
      officeId: this.officeId,
      fromLoanOfficerId: this.fromLoanOfficerId,
      toLoanOfficerId: this.toLoanOfficerId,
      assignmentDate: formatDateToFineract(this.assignmentDate),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    });

    this.bulkLoansService.postLoansLoanreassignment(body).subscribe({
      next: () => {
        this.notifications.success('Loans reassigned successfully');
        this.router.navigate([this.LIST_PATH]);
      },
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}
