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
import { LoanChargesService, GetLoansLoanIdChargesChargeIdResponse } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';

/**
 * Lists the charges attached to a single loan. The loan id is read from the route snapshot;
 * create and delete actions operate within that loan's charge collection. Paid charges cannot
 * be deleted and the delete button is hidden for those rows.
 */
@Component({
  selector: 'app-loan-charges-list',
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
      title="LOAN_CHARGES.TITLE"
      helpTextKey="HELP.LOAN_CHARGES_DESC"
      createButtonLabel="LOAN_CHARGES.ADD_TITLE"
      createPermission="CREATE_LOANCHARGE"
      [columns]="columns"
      [data]="charges()"
      [totalRecords]="charges().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="paid" let-row>
        @if (row.paid) {
          <span class="badge badge-success">{{ 'COMMON.YES' | appTranslate }}</span>
        } @else {
          <span class="badge badge-neutral">{{ 'COMMON.NO' | appTranslate }}</span>
        }
      </ng-template>

      <ng-template appCellTemplate="actions" let-row>
        @if (!row.paid) {
          <app-button
            type="button"
            intent="danger"
            emphasis="quiet"
            [label]="'COMMON.DELETE' | appTranslate"
            icon="trash-outline"
            [appTooltip]="'COMMON.DELETE' | appTranslate"
            (click)="onDelete(row)"
          />
        }
      </ng-template>
    </app-data-table>
  `,
})
export class LoanChargesListComponent implements OnInit {
  private readonly loanChargesService = inject(LoanChargesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'LOAN_CHARGES.TITLE', sortable: true },
    { key: 'amount', label: 'LOAN_CHARGES.AMOUNT', sortable: true },
    { key: 'dueDate', label: 'LOAN_CHARGES.DUE_DATE', sortable: false },
    { key: 'paid', label: 'LOAN_CHARGES.PAID', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  loanId!: number;
  readonly charges = signal<GetLoansLoanIdChargesChargeIdResponse[]>([]);

  ngOnInit(): void {
    this.loanId = Number(this.route.snapshot.paramMap.get('loanId'));
    this.load();
  }

  load(): void {
    this.loanChargesService.getLoansLoanIdCharges(this.loanId).subscribe({
      next: (data: GetLoansLoanIdChargesChargeIdResponse[]) => {
        this.charges.set(data || []);
      },
      error: (err: unknown) => console.error('Failed to load loan charges', err),
    });
  }

  onCreate(): void {
    this.router.navigate(['/loans', this.loanId, 'charges', 'add']);
  }

  async onDelete(row: GetLoansLoanIdChargesChargeIdResponse): Promise<void> {
    if (!row.id) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('COMMON.DELETE'),
      message: this.i18n.translate('LOAN_CHARGES.DELETE_CONFIRM', {
        name: row.name ?? '',
        amount: row.amount ?? '',
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.loanChargesService.deleteLoansLoanIdChargesLoanChargeId(this.loanId, row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete loan charge', err),
    });
  }
}
