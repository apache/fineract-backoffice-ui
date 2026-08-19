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
import { TranslateModule } from '@ngx-translate/core';
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
import {
  HolidaysService,
  OfficesService,
  GetHolidaysResponse,
  GetOfficesResponse,
} from '../../api';

/**
 * Inline Dialog component for activation confirmation.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [TranslateModule, IonButton],
  template: `
    <h2 class="dialog-title">{{ data().title | translate }}</h2>
    <div class="dialog-content">
      <p>{{ data().message | translate: data().params }}</p>
    </div>
    <div class="dialog-actions">
      <ion-button fill="clear" (click)="dismiss(false)">
        {{ 'COMMON.CANCEL' | translate }}
      </ion-button>
      <ion-button color="primary" (click)="dismiss(true)">
        {{ 'COMMON.CONFIRM' | translate }}
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
    TranslateModule,
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
          <ion-label position="stacked">{{ 'HOLIDAYS.APPLICABLE_OFFICES' | translate }}</ion-label>
          <ion-select
            [attr.aria-label]="'HOLIDAYS.APPLICABLE_OFFICES' | translate"
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
        {{ formatArrayDate(holiday.fromDate) }}
      </ng-template>

      <ng-template appCellTemplate="toDate" let-holiday>
        {{ formatArrayDate(holiday.toDate) }}
      </ng-template>

      <ng-template appCellTemplate="status" let-holiday>
        <app-status-badge [status]="holiday.status"></app-status-badge>
      </ng-template>

      <ng-template appCellTemplate="actions" let-holiday>
        @if (holiday.status?.code === 'holidayStatusType.pending.for.activation') {
          <ion-button
            fill="clear"
            color="primary"
            [attr.aria-label]="'HOLIDAYS.ACTIVATE' | translate"
            [appTooltip]="'HOLIDAYS.ACTIVATE' | translate"
            (click)="onActivateHoliday(holiday)"
          >
            <ion-icon name="checkmark-circle-outline"></ion-icon>
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
  private readonly holidaysService = inject(HolidaysService);
  private readonly officesService = inject(OfficesService);
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

  readonly holidays = signal<GetHolidaysResponse[]>([]);
  readonly offices = signal<GetOfficesResponse[]>([]);
  readonly selectedOfficeId = signal(1);
  readonly isLoading = signal(false);

  ngOnInit(): void {
    this.loadOffices();
  }

  private loadOffices(): void {
    this.isLoading.set(true);
    this.officesService.getOffices(true).subscribe({
      next: (data) => {
        this.offices.set(data || []);
        if (this.offices().length > 0) {
          const hasOffice1 = this.offices().some((o) => o.id === 1);
          this.selectedOfficeId.set(hasOffice1 ? 1 : this.offices()[0].id!);
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
    this.holidaysService.getHolidays(this.selectedOfficeId()).subscribe({
      next: (data) => {
        this.holidays.set(data || []);
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

  onActivateHoliday(holiday: GetHolidaysResponse): Promise<void> {
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
          this.holidaysService.postHolidaysHolidayId(holiday.id!, {}, 'activate').subscribe({
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

  formatArrayDate(dateArray: unknown): string {
    if (!dateArray || !Array.isArray(dateArray) || dateArray.length < 3) {
      return '-';
    }
    return `${dateArray[0]}-${String(dateArray[1]).padStart(2, '0')}-${String(dateArray[2]).padStart(2, '0')}`;
  }
}
