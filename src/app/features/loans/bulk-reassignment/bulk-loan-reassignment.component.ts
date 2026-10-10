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
import { TranslatePipe } from '../../../core/adapters';
import { forkJoin } from 'rxjs';

import { BulkLoansService, OfficesService, StaffService } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

interface Office {
  id?: number;
  name?: string;
}

interface StaffMember {
  id?: number;
  displayName?: string;
  officeId?: number;
}

@Component({
  selector: 'app-bulk-loan-reassignment',
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
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'BULK_LOANS.TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div class="form-container">
          <ion-item fill="outline">
            <ion-label position="stacked">{{ 'BULK_LOANS.OFFICE' | appTranslate }}</ion-label>
            <ion-select
              [attr.aria-label]="'BULK_LOANS.OFFICE' | appTranslate"
              interface="popover"
              [ngModel]="selectedOfficeId()"
              (ngModelChange)="selectedOfficeId.set($event); onOfficeChange()"
            >
              @for (office of offices(); track office.id) {
                <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          <ion-item fill="outline">
            <ion-label position="stacked">{{ 'BULK_LOANS.FROM_OFFICER' | appTranslate }}</ion-label>
            <ion-select
              [attr.aria-label]="'BULK_LOANS.FROM_OFFICER' | appTranslate"
              interface="popover"
              [ngModel]="selectedFromOfficerId()"
              (ngModelChange)="selectedFromOfficerId.set($event)"
              [disabled]="!selectedOfficeId()"
            >
              @for (officer of filteredStaff(); track officer.id) {
                <ion-select-option [value]="officer.id">{{
                  officer.displayName
                }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          <ion-item fill="outline">
            <ion-label position="stacked">{{ 'BULK_LOANS.TO_OFFICER' | appTranslate }}</ion-label>
            <ion-select
              [attr.aria-label]="'BULK_LOANS.TO_OFFICER' | appTranslate"
              interface="popover"
              [ngModel]="selectedToOfficerId()"
              (ngModelChange)="selectedToOfficerId.set($event)"
              [disabled]="!selectedFromOfficerId()"
            >
              @for (officer of toOfficerList; track officer.id) {
                <ion-select-option [value]="officer.id">{{
                  officer.displayName
                }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
        </div>
      </ion-card-content>
      <div class="card-actions form-actions">
        @if (isLoading()) {
          <ion-spinner name="crescent"></ion-spinner>
        }
        <ion-button
          color="primary"
          [disabled]="
            !selectedOfficeId() || !selectedFromOfficerId() || !selectedToOfficerId() || isLoading()
          "
          (click)="onReassign()"
        >
          {{ 'BULK_LOANS.REASSIGN' | appTranslate }}
        </ion-button>
      </div>
    </ion-card>
  `,
})
export class BulkLoanReassignmentComponent implements OnInit {
  private bulkLoansService = inject(BulkLoansService);
  private officesService = inject(OfficesService);
  private staffService = inject(StaffService);
  private notifications = inject(NotificationService);

  readonly offices = signal<Office[]>([]);
  allStaff: StaffMember[] = [];
  readonly filteredStaff = signal<StaffMember[]>([]);

  readonly selectedOfficeId = signal<number | null>(null);
  readonly selectedFromOfficerId = signal<number | null>(null);
  readonly selectedToOfficerId = signal<number | null>(null);
  readonly isLoading = signal(false);

  get toOfficerList(): StaffMember[] {
    return this.filteredStaff().filter((officer) => officer.id !== this.selectedFromOfficerId());
  }

  ngOnInit(): void {
    forkJoin({
      offices: this.officesService.getOffices(),
      staff: this.staffService.getStaff(),
    }).subscribe({
      next: ({ offices, staff }) => {
        this.offices.set(offices as Office[]);
        const staffResponse = staff as { staffMembers?: StaffMember[] };
        this.allStaff =
          staffResponse.staffMembers ?? (Array.isArray(staff) ? (staff as StaffMember[]) : []);
        this.filteredStaff.set([...this.allStaff]);
      },
    });
  }

  onOfficeChange(): void {
    this.selectedFromOfficerId.set(null);
    this.selectedToOfficerId.set(null);
    if (this.selectedOfficeId()) {
      const byOffice = this.allStaff.filter((s) => s.officeId === this.selectedOfficeId());
      this.filteredStaff.set(byOffice.length > 0 ? byOffice : [...this.allStaff]);
    } else {
      this.filteredStaff.set([...this.allStaff]);
    }
  }

  onReassign(): void {
    if (!this.selectedFromOfficerId() || !this.selectedToOfficerId()) return;

    this.isLoading.set(true);
    const body = JSON.stringify({
      fromLoanOfficerId: this.selectedFromOfficerId(),
      toLoanOfficerId: this.selectedToOfficerId(),
      locale: 'en',
    });

    this.bulkLoansService.postLoansLoanreassignment(body).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.notifications.success('BULK_LOANS.SUCCESS');
        this.selectedOfficeId.set(null);
        this.selectedFromOfficerId.set(null);
        this.selectedToOfficerId.set(null);
        this.filteredStaff.set([...this.allStaff]);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }
}
