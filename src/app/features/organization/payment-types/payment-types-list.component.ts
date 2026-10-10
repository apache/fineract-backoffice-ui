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
import { PaymentTypeService, PaymentTypeData } from '../../../api';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';
import { I18N, TranslatePipe } from '../../../core/adapters';

/**
 * Lists payment types (a master-data resource) with create / edit / delete.
 * Delete is offered only for non system-defined entries.
 */
@Component({
  selector: 'app-payment-types-list',
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
      title="nav.paymentTypes"
      helpTextKey="HELP.PAYMENT_TYPES_DESC"
      createButtonLabel="PAYMENT_TYPES.CREATE"
      createPermission="CREATE_PAYMENTTYPE"
      [columns]="columns"
      [data]="paymentTypes()"
      [totalRecords]="paymentTypes().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="isCashPayment" let-row>
        {{ (row.isCashPayment ? 'COMMON.YES' : 'COMMON.NO') | appTranslate }}
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
        @if (!row.isSystemDefined) {
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
export class PaymentTypesListComponent implements OnInit {
  private readonly paymentTypeService = inject(PaymentTypeService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'PAYMENT_TYPES.NAME', sortable: true },
    { key: 'description', label: 'COMMON.DESCRIPTION', sortable: false },
    { key: 'isCashPayment', label: 'PAYMENT_TYPES.IS_CASH', sortable: true },
    { key: 'position', label: 'PAYMENT_TYPES.POSITION', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly paymentTypes = signal<PaymentTypeData[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.paymentTypeService.getPaymenttypes().subscribe({
      next: (data: PaymentTypeData[]) => {
        this.paymentTypes.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load payment types', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/organization/payment-types/create']);
  }

  onEdit(row: PaymentTypeData): void {
    this.router.navigate(['/organization/payment-types/edit', row.id]);
  }

  onDelete(row: PaymentTypeData): void {
    if (!row.id || !confirm(this.i18n.translate('PAYMENT_TYPES.CONFIRM_DELETE'))) {
      return;
    }
    this.paymentTypeService.deletePaymenttypesPaymentTypeId(row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete payment type', err),
    });
  }
}
