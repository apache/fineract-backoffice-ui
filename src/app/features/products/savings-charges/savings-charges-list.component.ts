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
import { ActivatedRoute, Router } from '@angular/router';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { DialogService } from '../../../core/services/dialog.service';
import { ButtonComponent } from '../../../ui/button/button.component';
import {
  SavingsChargesService,
  GetSavingsAccountsSavingsAccountIdChargesResponse,
} from '../../../api';

/**
 * Lists the charges attached to a single savings account. The savings account id is read
 * from the route snapshot; create and delete actions operate within that account's charge
 * collection.
 */
@Component({
  selector: 'app-savings-charges-list',
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
      title="SAVINGS_CHARGES.TITLE"
      helpTextKey="HELP.SAVINGS_CHARGES_DESC"
      createButtonLabel="SAVINGS_CHARGES.CREATE"
      createPermission="UPDATE_SAVINGSACCOUNT"
      [columns]="columns"
      [data]="charges()"
      [totalRecords]="charges().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="actions" let-row>
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
export class SavingsChargesListComponent implements OnInit {
  private readonly savingsChargesService = inject(SavingsChargesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'SAVINGS_CHARGES.NAME', sortable: true },
    { key: 'amount', label: 'SAVINGS_CHARGES.AMOUNT', sortable: true },
    { key: 'amountOutstanding', label: 'SAVINGS_CHARGES.AMOUNT_OUTSTANDING', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  savingsAccountId!: number;
  readonly charges = signal<GetSavingsAccountsSavingsAccountIdChargesResponse[]>([]);

  ngOnInit(): void {
    this.savingsAccountId = Number(this.route.snapshot.paramMap.get('savingsAccountId'));
    this.load();
  }

  load(): void {
    this.savingsChargesService
      .getSavingsaccountsSavingsAccountIdCharges(this.savingsAccountId)
      .subscribe({
        next: (data: GetSavingsAccountsSavingsAccountIdChargesResponse[]) => {
          this.charges.set(data || []);
        },
        error: (err: unknown) => console.error('Failed to load savings charges', err),
      });
  }

  onCreate(): void {
    this.router.navigate([
      '/products/savings-accounts',
      this.savingsAccountId,
      'charges',
      'create',
    ]);
  }

  async onDelete(row: GetSavingsAccountsSavingsAccountIdChargesResponse): Promise<void> {
    if (!row.id) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('SAVINGS_CHARGES.DELETE'),
      message: this.i18n.translate('SAVINGS_CHARGES.CONFIRM_DELETE', {
        name: row.name ?? '',
        amount: row.amount ?? '',
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.savingsChargesService
      .deleteSavingsaccountsSavingsAccountIdChargesSavingsAccountChargeId(
        this.savingsAccountId,
        row.id,
      )
      .subscribe({
        next: () => this.load(),
        error: (err: unknown) => console.error('Failed to delete savings charge', err),
      });
  }
}
