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
import { STAFF_API, TranslatePipe } from '../../../core/adapters';
import type { Staff } from '../../../core/adapters';
import {
  DataTableComponent,
  ColumnDef,
  HasPermissionDirective,
  CellTemplateDirective,
} from '../../../shared';
import { IconComponent } from '../../../ui/icon/icon.component';
import { ButtonComponent } from '../../../ui/button/button.component';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent,
    HasPermissionDirective,
    CellTemplateDirective,
    IconComponent,
    ButtonComponent,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      title="ORGANIZATION.STAFF"
      [columns]="columns"
      [data]="staff()"
      [isLoading]="isLoading()"
      [localLogic]="true"
    >
      <app-button
        headerActions
        type="button"
        intent="primary"
        icon="add-outline"
        [link]="['create']"
        *appHasPermission="'CREATE_STAFF'"
      >
        {{ 'ORGANIZATION.CREATE_STAFF' | appTranslate }}
      </app-button>

      <ng-template appCellTemplate="isLoanOfficer" let-row>
        <app-icon
          [tone]="row.isLoanOfficer ? 'success' : 'danger'"
          [name]="row.isLoanOfficer ? 'checkmark-circle-outline' : 'close-circle-outline'"
        />
      </ng-template>

      <ng-template appCellTemplate="isActive" let-row>
        <app-icon
          [tone]="row.isActive ? 'success' : 'danger'"
          [name]="row.isActive ? 'checkmark-circle-outline' : 'close-circle-outline'"
        />
      </ng-template>

      <ng-template appCellTemplate="actions" let-row>
        <div class="action-buttons">
          <app-button
            type="button"
            intent="primary"
            emphasis="quiet"
            icon="create-outline"
            [link]="['edit', row.id]"
            *appHasPermission="'UPDATE_STAFF'"
            [label]="'COMMON.EDIT' | appTranslate"
            [appTooltip]="'COMMON.EDIT' | appTranslate"
          />
        </div>
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .action-buttons {
        display: flex;
        gap: 8px;
      }
    `,
  ],
})
export class StaffListComponent implements OnInit {
  private readonly staffApi = inject(STAFF_API);

  readonly staff = signal<Staff[]>([]);
  readonly isLoading = signal<boolean>(false);

  columns: ColumnDef[] = [
    {
      key: 'displayName',
      label: 'COMMON.NAME',
    },
    {
      key: 'officeName',
      label: 'COMMON.OFFICE',
    },
    {
      key: 'isLoanOfficer',
      label: 'ORGANIZATION.IS_LOAN_OFFICER',
    },
    {
      key: 'isActive',
      label: 'COMMON.ACTIVE',
    },
    {
      key: 'actions',
      label: 'COMMON.ACTIONS',
    },
  ];

  ngOnInit(): void {
    this.loadStaff();
  }

  loadStaff(): void {
    this.isLoading.set(true);
    this.staffApi.list({ status: 'all' }).subscribe({
      next: (data) => {
        this.staff.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load staff', err);
        this.isLoading.set(false);
      },
    });
  }
}
