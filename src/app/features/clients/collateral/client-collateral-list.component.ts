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
import { ClientCollateralManagementService, ClientCollateralManagementData } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ButtonComponent } from '../../../ui/button/button.component';

/**
 * Lists the collateral attached to a single client. The client id is read from the route
 * snapshot; create, edit and delete actions operate within that client's collateral collection.
 */
@Component({
  selector: 'app-client-collateral-list',
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
      title="CLIENT_COLLATERAL.TITLE"
      helpTextKey="HELP.CLIENT_COLLATERAL_DESC"
      createButtonLabel="CLIENT_COLLATERAL.CREATE"
      createPermission="CREATE_CLIENT_COLLATERAL_PRODUCT"
      [columns]="columns"
      [data]="collaterals()"
      [totalRecords]="collaterals().length"
      [hasError]="hasError()"
      [localLogic]="true"
      (create)="onCreate()"
      (retry)="onRetry()"
    >
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
export class ClientCollateralListComponent implements OnInit {
  private readonly collateralService = inject(ClientCollateralManagementService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'CLIENT_COLLATERAL.NAME', sortable: true },
    { key: 'quantity', label: 'CLIENT_COLLATERAL.QUANTITY', sortable: true },
    { key: 'unitPrice', label: 'CLIENT_COLLATERAL.UNIT_PRICE', sortable: false },
    { key: 'totalCollateral', label: 'CLIENT_COLLATERAL.TOTAL_COLLATERAL', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  clientId!: number;
  readonly collaterals = signal<ClientCollateralManagementData[]>([]);
  readonly hasError = signal(false);

  ngOnInit(): void {
    this.clientId = Number(this.route.snapshot.paramMap.get('clientId'));
    this.load();
  }

  load(): void {
    this.collateralService.getClientsClientIdCollaterals(this.clientId).subscribe({
      next: (data: ClientCollateralManagementData[]) => {
        this.collaterals.set(data || []);
        this.hasError.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load client collaterals', err);
        this.hasError.set(true);
      },
    });
  }

  onRetry(): void {
    this.load();
  }

  onCreate(): void {
    this.router.navigate(['/clients', this.clientId, 'collaterals', 'create']);
  }

  onEdit(row: ClientCollateralManagementData): void {
    this.router.navigate(['/clients', this.clientId, 'collaterals', 'edit', row.id]);
  }

  async onDelete(row: ClientCollateralManagementData): Promise<void> {
    if (!row.id) return;
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('COMMON.DELETE'),
      message: this.i18n.translate('CLIENT_COLLATERAL.CONFIRM_DELETE', {
        name: row.name ?? '',
        quantity: row.quantity ?? '',
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.collateralService
      .deleteClientsClientIdCollateralsCollateralId(this.clientId, row.id)
      .subscribe({
        next: () => this.load(),
        error: (err: unknown) => console.error('Failed to delete client collateral', err),
      });
  }
}
