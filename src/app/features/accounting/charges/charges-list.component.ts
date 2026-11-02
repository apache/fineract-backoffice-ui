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
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
  RequiresPermissionDirective,
} from '../../../shared';
import { ChargesService, ChargeData } from '../../../api';
import { DialogService } from '../../../core/services/dialog.service';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { ButtonComponent } from '../../../ui/button/button.component';

/**
 * Component for listing globally configured charges and penalties.
 *
 * Provides a management view for all types of fees (Loan, Savings, Client).
 */
@Component({
  selector: 'app-charges-list',
  standalone: true,
  imports: [
    DataTableComponent,
    CellTemplateDirective,
    RequiresPermissionDirective,
    TranslatePipe,
    DecimalPipe,
    CurrencyPipe,
    ButtonComponent,
  ],
  template: `
    <app-data-table
      title="nav.charges"
      helpTextKey="HELP.CHARGES_DESC"
      createButtonLabel="CHARGES.CREATE"
      createPermission="CREATE_CHARGE"
      [columns]="columns"
      [data]="charges()"
      [totalRecords]="charges().length"
      [hasError]="hasError()"
      [showSearch]="true"
      [localLogic]="true"
      (create)="onCreateCharge()"
      (retry)="onRetry()"
    >
      <ng-template appCellTemplate="amount" let-charge>
        @if (
          charge.chargeCalculationType?.id === 1 ||
          charge.chargeCalculationType?.code === 'chargeCalculationType.flat'
        ) {
          {{ charge.amount | currency: charge.currency?.code }}
        } @else {
          {{ charge.amount | number: '1.2-2' }}%
        }
      </ng-template>

      <ng-template appCellTemplate="penalty" let-charge>
        {{ (charge.penalty ? 'COMMON.YES' : 'COMMON.NO') | appTranslate }}
      </ng-template>

      <ng-template appCellTemplate="active" let-charge>
        {{ (charge.active ? 'COMMON.YES' : 'COMMON.NO') | appTranslate }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-charge>
        <app-button
          type="button"
          emphasis="quiet"
          intent="primary"
          icon="create-outline"
          [label]="'COMMON.EDIT' | appTranslate"
          (click)="onEditCharge(charge)"
        />
        <app-button
          type="button"
          emphasis="quiet"
          intent="danger"
          icon="trash-outline"
          appRequiresPermission="DELETE_CHARGE"
          [label]="'CHARGES.DELETE' | appTranslate"
          (click)="onDeleteCharge(charge)"
        />
      </ng-template>
    </app-data-table>
  `,
})
export class ChargesListComponent implements OnInit {
  private readonly chargesService = inject(ChargesService);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'COMMON.NAME', sortable: true },
    { key: 'penalty', label: 'COMMON.PENALTY', sortable: true },
    { key: 'amount', label: 'COMMON.AMOUNT', sortable: true },
    { key: 'active', label: 'COMMON.ACTIVE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly charges = signal<ChargeData[]>([]);
  readonly hasError = signal(false);

  ngOnInit(): void {
    this.loadCharges();
  }

  private loadCharges(): void {
    this.chargesService.getCharges().subscribe({
      next: (data) => {
        this.hasError.set(false);
        this.charges.set(data || []);
      },
      error: () => {
        this.hasError.set(true);
        this.charges.set([]);
      },
    });
  }

  onRetry(): void {
    this.loadCharges();
  }

  onCreateCharge(): void {
    this.router.navigate(['/accounting/charges/create']);
  }

  onEditCharge(charge: ChargeData): void {
    this.router.navigate(['/accounting/charges/edit', charge.id]);
  }

  /**
   * Deletes a charge definition.
   *
   * Fineract refuses one still attached to a product or an account, and says which; that reaches
   * the operator through the error interceptor. The confirmation states the condition up front,
   * and the list reloads only on success so a charge the platform kept stays visible (#789).
   */
  async onDeleteCharge(charge: ChargeData): Promise<void> {
    if (charge.id === undefined) {
      return;
    }

    const confirmed = await this.dialog.confirm({
      title: this.i18n.translate('CHARGES.DELETE'),
      message: this.i18n.translate('CHARGES.DELETE_CONFIRM'),
      details: [{ label: this.i18n.translate('COMMON.NAME'), value: charge.name ?? '' }],
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    this.chargesService.deleteChargesChargeId(charge.id).subscribe({
      next: () => this.loadCharges(),
      error: (err: unknown) => {
        console.error('Failed to delete the charge definition', err);
      },
    });
  }
}
