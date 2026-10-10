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
import { I18N, TranslatePipe } from '../../../core/adapters';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { LoanOriginatorsService, GetLoanOriginatorsResponse } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';

/**
 * Lists loan originator master-data records (name + external id + type/channel/status).
 * Originators are a small reference list, so the table uses local pagination.
 */
@Component({
  selector: 'app-loan-originators-list',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    ButtonComponent,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      title="nav.loanOriginators"
      helpTextKey="HELP.LOAN_ORIGINATORS_DESC"
      createButtonLabel="LOAN_ORIGINATORS.CREATE"
      createPermission="CREATE_LOAN_ORIGINATOR"
      [columns]="columns"
      [data]="originators()"
      [totalRecords]="originators().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="originatorType" let-row>
        {{ row.originatorType?.name }}
      </ng-template>
      <ng-template appCellTemplate="channelType" let-row>
        {{ row.channelType?.name }}
      </ng-template>
      <ng-template appCellTemplate="actions" let-row>
        <app-button
          type="button"
          intent="primary"
          emphasis="quiet"
          [label]="'COMMON.EDIT' | appTranslate"
          icon="create-outline"
          [appTooltip]="'COMMON.EDIT' | appTranslate"
          (click)="onEdit(row)"
        />
        <app-button
          type="button"
          intent="danger"
          emphasis="quiet"
          [label]="'COMMON.DELETE' | appTranslate"
          icon="trash-outline"
          [appTooltip]="'COMMON.DELETE' | appTranslate"
          (click)="onDelete(row)"
        />
      </ng-template>
    </app-data-table>
  `,
})
export class LoanOriginatorsListComponent implements OnInit {
  private readonly originatorsService = inject(LoanOriginatorsService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'LOAN_ORIGINATORS.NAME', sortable: true },
    { key: 'externalId', label: 'LOAN_ORIGINATORS.EXTERNAL_ID', sortable: true },
    { key: 'originatorType', label: 'LOAN_ORIGINATORS.ORIGINATOR_TYPE', sortable: false },
    { key: 'channelType', label: 'LOAN_ORIGINATORS.CHANNEL_TYPE', sortable: false },
    { key: 'status', label: 'LOAN_ORIGINATORS.STATUS', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly originators = signal<GetLoanOriginatorsResponse[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.originatorsService.getLoanOriginators().subscribe({
      next: (data: GetLoanOriginatorsResponse[]) => {
        this.originators.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load loan originators', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/products/loan-originators/create']);
  }

  onEdit(row: GetLoanOriginatorsResponse): void {
    this.router.navigate(['/products/loan-originators/edit', row.id]);
  }

  async onDelete(row: GetLoanOriginatorsResponse): Promise<void> {
    if (!row.id) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('LOAN_ORIGINATORS.DELETE'),
      message: this.i18n.translate('LOAN_ORIGINATORS.CONFIRM_DELETE', { name: row.name ?? '' }),
      destructive: true,
    });
    if (!confirmed) return;
    this.originatorsService.deleteLoanOriginatorsOriginatorId(row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete loan originator', err),
    });
  }
}
