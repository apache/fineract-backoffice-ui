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

import { inject, input, signal, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HOLIDAY_API, OFFICE_API, TranslatePipe } from '../../core/adapters';
import type { Holiday, Office } from '../../core/adapters';
import { NotificationService } from '../../core/services/notification.service';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  ModalController,
} from '@ionic/angular/standalone';
import { DialogService } from '../../core/services/dialog.service';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  DataTableComponent,
  ColumnDef,
  CellTemplateDirective,
  StatusBadgeComponent,
} from '../../shared';

/**
 * Inline Dialog component for activation confirmation.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [TranslatePipe, IonButton],
  template: `
    <h2 class="dialog-title">{{ data().title | appTranslate }}</h2>
    <div class="dialog-content">
      <p>{{ data().message | appTranslate: data().params }}</p>
    </div>
    <div class="dialog-actions">
      <ion-button fill="clear" (click)="dismiss(false)">
        {{ 'COMMON.CANCEL' | appTranslate }}
      </ion-button>
      <ion-button color="primary" (click)="dismiss(true)">
        {{ 'COMMON.CONFIRM' | appTranslate }}
      </ion-button>
    </div>
  `,
})
export class ConfirmDialogComponent {
  private readonly modalController = inject(ModalController);

  readonly data = input.required<{
    title: string;
    message: string;
    params?: Record<string, unknown>;
  }>();

  dismiss(confirmed: boolean): void {
    this.modalController.dismiss(confirmed);
  }
}

/**
 * Component for listing office holidays.
 */
@Component({
  selector: 'app-holidays-list',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    IonIcon,
    IonButton,
    IonItem,
    IonLabel,
    IonSelectOption,
    IonSelect,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      title="nav.holidays"
      helpTextKey="HELP.HOLIDAYS_DESC"
      createButtonLabel="SETTINGS.CREATE_HOLIDAY"
      createPermission="CREATE_HOLIDAY"
      [columns]="columns"
      [data]="holidays()"
      [totalRecords]="holidays().length"
      [showSearch]="true"
      [localLogic]="true"
      [isLoading]="isLoading()"
      (create)="onCreateHoliday()"
    >
      <div filters class="office-filter-container">
        <ion-item fill="outline" class="office-filter-field">
          <ion-label position="stacked">{{
            'HOLIDAYS.APPLICABLE_OFFICES' | appTranslate
          }}</ion-label>
          <ion-select
            [attr.aria-label]="'HOLIDAYS.APPLICABLE_OFFICES' | appTranslate"
            interface="popover"
            [value]="selectedOfficeId()"
            (ionChange)="onOfficeChange($event.detail.value)"
          >
            @for (office of offices(); track office.id) {
              <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
      </div>

      <ng-template appCellTemplate="fromDate" let-holiday>
        {{ holiday.fromDate ?? '-' }}
      </ng-template>

      <ng-template appCellTemplate="toDate" let-holiday>
        {{ holiday.toDate ?? '-' }}
      </ng-template>

      <ng-template appCellTemplate="status" let-holiday>
        <app-status-badge [status]="holiday.status"></app-status-badge>
      </ng-template>

      <!--
        Edit and delete are offered only while the holiday is pending activation, which is the
        only state the platform accepts either command in. Before this the list had neither, so a
        holiday entered with the wrong dates was permanent — and holidays move repayment dates.
      -->
      <ng-template appCellTemplate="actions" let-holiday>
        @if (holiday.status.isPending) {
          <ion-button
            fill="clear"
            color="primary"
            [attr.aria-label]="'HOLIDAYS.ACTIVATE' | appTranslate"
            [appTooltip]="'HOLIDAYS.ACTIVATE' | appTranslate"
            (click)="onActivateHoliday(holiday)"
          >
            <ion-icon name="checkmark-circle-outline"></ion-icon>
          </ion-button>
          <ion-button
            fill="clear"
            color="primary"
            data-testid="holiday-edit"
            [attr.aria-label]="'COMMON.EDIT' | appTranslate"
            [appTooltip]="'COMMON.EDIT' | appTranslate"
            (click)="onEditHoliday(holiday)"
          >
            <ion-icon name="create-outline"></ion-icon>
          </ion-button>
          <ion-button
            fill="clear"
            color="danger"
            data-testid="holiday-delete"
            [attr.aria-label]="'COMMON.DELETE' | appTranslate"
            [appTooltip]="'COMMON.DELETE' | appTranslate"
            (click)="onDeleteHoliday(holiday)"
          >
            <ion-icon name="trash-outline"></ion-icon>
          </ion-button>
        }
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .office-filter-container {
        display: flex;
        align-items: center;
        margin-left: 16px;
      }
      .office-filter-field {
        min-width: 250px;
        margin-top: 8px;
      }
    `,
  ],
})
export class HolidaysListComponent implements OnInit {
  private readonly holidayApi = inject(HOLIDAY_API);
  private readonly officeApi = inject(OFFICE_API);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly notifications = inject(NotificationService);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'COMMON.NAME', sortable: true },
    { key: 'fromDate', label: 'COMMON.FROM_DATE', sortable: true },
    { key: 'toDate', label: 'COMMON.TO_DATE', sortable: true },
    { key: 'status', label: 'COMMON.STATUS', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly holidays = signal<Holiday[]>([]);
  readonly offices = signal<readonly Office[]>([]);
  readonly selectedOfficeId = signal(1);
  readonly isLoading = signal(false);

  ngOnInit(): void {
    this.loadOffices();
  }

  private loadOffices(): void {
    this.isLoading.set(true);
    this.officeApi.list(true).subscribe({
      next: (data) => {
        this.offices.set(data);
        const [first] = this.offices();
        if (first !== undefined) {
          // `id` is non-optional on the model, so no `!` is needed to read the fallback.
          const hasHeadOffice = this.offices().some((o) => o.id === 1);
          this.selectedOfficeId.set(hasHeadOffice ? 1 : first.id);
        }
        this.loadHolidays();
      },
      error: (err) => {
        console.error('Failed to load offices', err);
        this.loadHolidays();
      },
    });
  }

  private loadHolidays(): void {
    this.isLoading.set(true);
    this.holidayApi.list(this.selectedOfficeId()).subscribe({
      next: (data) => {
        this.holidays.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Failed to load holidays', err);
      },
    });
  }

  onOfficeChange(officeId: number): void {
    this.selectedOfficeId.set(officeId);
    this.loadHolidays();
  }

  onCreateHoliday(): void {
    this.router.navigate(['/settings/holidays/create']);
  }

  onActivateHoliday(holiday: Holiday): Promise<void> {
    return this.dialogService
      .open(ConfirmDialogComponent, {
        data: {
          title: 'HOLIDAYS.ACTIVATE_TITLE',
          message: 'HOLIDAYS.ACTIVATE_CONFIRM',
          params: { name: holiday.name },
        },
      })
      .then((result) => {
        if (result) {
          this.isLoading.set(true);
          this.holidayApi.activate(holiday.id).subscribe({
            next: () => {
              this.notifications.success('Holiday activated successfully');
              this.loadHolidays();
            },
            error: (err) => {
              this.isLoading.set(false);
              console.error('Failed to activate holiday', err);
              this.notifications.error('Failed to activate holiday');
            },
          });
        }
      });
  }

  onEditHoliday(holiday: Holiday): void {
    void this.router.navigate(['/settings/holidays/edit', holiday.id]);
  }

  onDeleteHoliday(holiday: Holiday): Promise<void> {
    return this.dialogService
      .open(ConfirmDialogComponent, {
        data: {
          title: 'HOLIDAYS.DELETE_TITLE',
          message: 'HOLIDAYS.DELETE_CONFIRM',
          params: { name: holiday.name },
        },
      })
      .then((result) => {
        if (!result) {
          return;
        }
        this.isLoading.set(true);
        this.holidayApi.remove(holiday.id).subscribe({
          next: () => {
            this.notifications.success('Holiday deleted successfully');
            this.loadHolidays();
          },
          error: (err) => {
            this.isLoading.set(false);
            console.error('Failed to delete holiday', err);
            this.notifications.error('Failed to delete holiday');
          },
        });
      });
  }
}
