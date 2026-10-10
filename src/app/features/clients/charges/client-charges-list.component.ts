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
import { ClientChargesService, GetClientsChargesPageItems } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { formatArrayDate } from '../../../core/utils/date-formatter';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';

/**
 * Lists the charges attached to a single client. The client id is read from the route
 * snapshot; create and delete actions operate within that client's charge collection.
 */
@Component({
  selector: 'app-client-charges-list',
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
      title="CLIENT_CHARGES.TITLE"
      helpTextKey="HELP.CLIENT_CHARGES_DESC"
      createButtonLabel="CLIENT_CHARGES.CREATE"
      createPermission="CREATE_CLIENTCHARGE"
      [columns]="columns"
      [data]="charges()"
      [totalRecords]="charges().length"
      [hasError]="hasError()"
      [localLogic]="true"
      (create)="onCreate()"
      (retry)="onRetry()"
    >
      <ng-template appCellTemplate="dueDate" let-row>
        {{ formatDate(row.dueDate) }}
      </ng-template>
      <ng-template appCellTemplate="amountPaid" let-row>
        {{ row.amountPaid ?? 0 }}
      </ng-template>
      <ng-template appCellTemplate="amountOutstanding" let-row>
        {{ row.amountOutstanding ?? 0 }}
      </ng-template>
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
export class ClientChargesListComponent implements OnInit {
  private readonly clientChargesService = inject(ClientChargesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'CLIENT_CHARGES.NAME', sortable: true },
    { key: 'amount', label: 'CLIENT_CHARGES.AMOUNT', sortable: true },
    { key: 'dueDate', label: 'CLIENT_CHARGES.DUE_DATE', sortable: false },
    { key: 'amountPaid', label: 'CLIENT_CHARGES.PAID', sortable: false },
    { key: 'amountOutstanding', label: 'CLIENT_CHARGES.OUTSTANDING', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  clientId!: number;
  readonly charges = signal<GetClientsChargesPageItems[]>([]);
  readonly hasError = signal(false);

  ngOnInit(): void {
    this.clientId = Number(this.route.snapshot.paramMap.get('clientId'));
    this.load();
  }

  load(): void {
    this.clientChargesService.getClientsClientIdCharges(this.clientId).subscribe({
      next: (data) => {
        this.charges.set(data?.pageItems ? Array.from(data.pageItems) : []);
        this.hasError.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load client charges', err);
        this.hasError.set(true);
      },
    });
  }

  onRetry(): void {
    this.load();
  }

  formatDate(value: unknown): string {
    return formatArrayDate(value);
  }

  onCreate(): void {
    this.router.navigate(['/clients', this.clientId, 'charges', 'create']);
  }

  async onDelete(row: GetClientsChargesPageItems): Promise<void> {
    if (!row.id) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('COMMON.DELETE'),
      message: this.i18n.translate('CLIENT_CHARGES.CONFIRM_DELETE', {
        name: row.name ?? '',
        amount: row.amount ?? '',
        dueDate: this.formatDate(row.dueDate),
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.clientChargesService
      .deleteClientsClientIdChargesChargeId(this.clientId, row.id)
      .subscribe({
        next: () => this.load(),
        error: (err: unknown) => console.error('Failed to delete client charge', err),
      });
  }
}
