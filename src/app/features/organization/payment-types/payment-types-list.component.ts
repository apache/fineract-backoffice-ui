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
import { PaymentTypeService, PaymentTypeData } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

/**
 * Lists payment types (a master-data resource) with create / edit / delete.
 * Delete is offered only for non system-defined entries.
 */
@Component({
  selector: 'app-payment-types-list',
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
        {{ (row.isCashPayment ? 'COMMON.YES' : 'COMMON.NO') | translate }}
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
        @if (!row.isSystemDefined) {
          <ion-button
            fill="clear"
            color="danger"
            [attr.aria-label]="'COMMON.DELETE' | translate"
            [appTooltip]="'COMMON.DELETE' | translate"
            (click)="onDelete(row)"
          >
            <ion-icon name="trash-outline"></ion-icon>
          </ion-button>
        }
      </ng-template>
    </app-data-table>
  `,
})
export class PaymentTypesListComponent implements OnInit {
  private readonly paymentTypeService = inject(PaymentTypeService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

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
    if (!row.id || !confirm(this.translate.instant('PAYMENT_TYPES.CONFIRM_DELETE'))) {
      return;
    }
    this.paymentTypeService.deletePaymenttypesPaymentTypeId(row.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => console.error('Failed to delete payment type', err),
    });
  }
}
