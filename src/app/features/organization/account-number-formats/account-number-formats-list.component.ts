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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { AccountNumberFormatService, GetAccountNumberFormatsIdResponse } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { DialogService } from '../../../core/services/dialog.service';

@Component({
  selector: 'app-account-number-formats-list',
  standalone: true,
  imports: [
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    IonIcon,
    IonButton,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      [title]="'ACCOUNT_NUMBER_FORMATS.TITLE' | translate"
      createButtonLabel="ACCOUNT_NUMBER_FORMATS.TITLE"
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
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          [appTooltip]="'COMMON.EDIT' | translate"
          (click)="onEdit(row)"
        >
          <ion-icon name="create-outline"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="danger"
          [attr.aria-label]="'COMMON.DELETE' | translate"
          [appTooltip]="'COMMON.DELETE' | translate"
          (click)="onDelete(row)"
        >
          <ion-icon name="trash-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class AccountNumberFormatsListComponent implements OnInit {
  private readonly accountNumberFormatService = inject(AccountNumberFormatService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly translate = inject(TranslateService);

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
        title: this.translate.instant('ACCOUNT_NUMBER_FORMATS.DELETE'),
        message: this.translate.instant('ACCOUNT_NUMBER_FORMATS.CONFIRM_DELETE', {
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
