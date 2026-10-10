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
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { OFFICE_API, TranslatePipe } from '../../../core/adapters';
import type { Office } from '../../../core/adapters';
import { ButtonComponent } from '../../../ui/button/button.component';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-offices-list',
  standalone: true,
  imports: [
    DataTableComponent,
    CellTemplateDirective,
    ButtonComponent,
    TooltipDirective,
    TranslatePipe,
    HasPermissionDirective,
  ],
  template: `
    <app-data-table
      title="nav.offices"
      helpTextKey="HELP.OFFICES_DESC"
      createButtonLabel="OFFICES.CREATE_OFFICE"
      createPermission="CREATE_OFFICE"
      [columns]="columns"
      [data]="offices()"
      [totalRecords]="offices().length"
      [localLogic]="true"
      (create)="onCreateOffice()"
    >
      <ng-template appCellTemplate="openingDate" let-office>
        {{ office.openingDate ?? '-' }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-office>
        <app-button
          type="button"
          emphasis="quiet"
          data-testid="office-view"
          icon="eye-outline"
          [label]="'COMMON.VIEW' | appTranslate"
          (click)="onViewOffice(office)"
        />
        <!--
          Gated for the same reason the create button above is: the offices/edit/:id route
          declares UPDATE_OFFICE, so a reader offered this control is being led to Access
          Denied. The directive decides what is offered, never what is allowed — Fineract
          refuses the PUT either way. See DOCS/RBAC.md step 4 and security.md.
        -->
        <app-button
          *appHasPermission="'UPDATE_OFFICE'"
          type="button"
          emphasis="quiet"
          intent="primary"
          data-testid="office-edit"
          icon="create-outline"
          [appTooltip]="'COMMON.EDIT' | appTranslate"
          [label]="'COMMON.EDIT' | appTranslate"
          (click)="onEditOffice(office)"
        />
      </ng-template>
    </app-data-table>
  `,
})
export class OfficesListComponent implements OnInit {
  private readonly officeApi = inject(OFFICE_API);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'OFFICES.NAME', sortable: true },
    { key: 'externalId', label: 'OFFICES.EXTERNAL_ID', sortable: true },
    { key: 'openingDate', label: 'OFFICES.OPENING_DATE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly offices = signal<Office[]>([]);

  ngOnInit(): void {
    this.officeApi.list(true).subscribe({
      next: (data: Office[]) => {
        this.offices.set(data);
      },
      error: (err: unknown) => {
        console.error('Failed to load offices', err);
      },
    });
  }

  onCreateOffice(): void {
    this.router.navigate(['/organization/offices/create']);
  }

  onViewOffice(office: Office): void {
    void this.router.navigate(['/organization/offices/view', office.id]);
  }

  onEditOffice(office: Office): void {
    this.router.navigate(['/organization/offices/edit', office.id]);
  }
}
