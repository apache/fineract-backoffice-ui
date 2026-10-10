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
import { AccountNumberFormatService, GetAccountNumberFormatsIdResponse } from '../../../api';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { DialogService } from '../../../core/services/dialog.service';
import { ButtonComponent } from '../../../ui/button/button.component';
import { I18N, TranslatePipe } from '../../../core/adapters';

@Component({
  selector: 'app-account-number-formats-list',
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
      [title]="'ACCOUNT_NUMBER_FORMATS.TITLE' | appTranslate"
      createButtonLabel="ACCOUNT_NUMBER_FORMATS.TITLE"
      createPermission="CREATE_ACCOUNTNUMBERFORMAT"
      [columns]="columns"
      [data]="formats()"
      [totalRecords]="formats().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="accountType" let-row>
        {{ row.accountType?.value ?? '-' }}
      </ng-template>

      <ng-template appCellTemplate="prefixType" let-row>
        {{ row.prefixType?.value ?? '-' }}
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
export class AccountNumberFormatsListComponent implements OnInit {
  private readonly accountNumberFormatService = inject(AccountNumberFormatService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'accountType', label: 'ACCOUNT_NUMBER_FORMATS.ACCOUNT_TYPE', sortable: true },
    { key: 'prefixType', label: 'ACCOUNT_NUMBER_FORMATS.PREFIX_TYPE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly formats = signal<GetAccountNumberFormatsIdResponse[]>([]);

  ngOnInit(): void {
    this.loadFormats();
  }

  private loadFormats(): void {
    this.accountNumberFormatService.getAccountnumberformats().subscribe({
      next: (data: GetAccountNumberFormatsIdResponse[]) => {
        this.formats.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load account number formats', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/organization/account-number-formats/create']);
  }

  onEdit(row: GetAccountNumberFormatsIdResponse): void {
    this.router.navigate(['/organization/account-number-formats/edit', row.id]);
  }

  onDelete(row: GetAccountNumberFormatsIdResponse): void {
    if (!row.id) return;
    void this.dialogService
      .confirm({
        title: this.i18n.translate('ACCOUNT_NUMBER_FORMATS.DELETE'),
        message: this.i18n.translate('ACCOUNT_NUMBER_FORMATS.CONFIRM_DELETE', {
          name: row.accountType?.value ?? row.id,
        }),
        destructive: true,
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.accountNumberFormatService
          .deleteAccountnumberformatsAccountNumberFormatId(row.id!)
          .subscribe({
            next: () => {
              this.formats.set(this.formats().filter((f) => f.id !== row.id));
            },
            error: (err: unknown) => {
              console.error('Failed to delete account number format', err);
            },
          });
      });
  }
}
