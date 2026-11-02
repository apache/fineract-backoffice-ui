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
import { Cashier, I18N, TELLER_API, TranslatePipe } from '../../../core/adapters';
import { DialogService } from '../../../core/services/dialog.service';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { ColumnDef, CellTemplateDirective, RequiresPermissionDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

@Component({
  selector: 'app-cashiers-list',
  standalone: true,
  imports: [
    TranslatePipe,
    IonButton,
    IonIcon,
    DataTableComponent,
    CellTemplateDirective,
    RequiresPermissionDirective,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      title="TELLERS.CASHIERS"
      helpTextKey="HELP.CASHIERS_DESC"
      createButtonLabel="TELLERS.ALLOCATE_CASHIER"
      createPermission="ALLOCATECASHIER_TELLER"
      [columns]="columns"
      [data]="cashiers()"
      [totalRecords]="cashiers().length"
      [localLogic]="true"
      (create)="onAllocateCashier()"
    >
      <ng-template appCellTemplate="startDate" let-cashier>
        {{ cashier.startDate ?? '-' }}
      </ng-template>

      <ng-template appCellTemplate="endDate" let-cashier>
        {{ cashier.endDate ?? '-' }}
      </ng-template>

      <ng-template appCellTemplate="fullDay" let-cashier>
        {{ (cashier.isFullDay ? 'COMMON.YES' : 'COMMON.NO') | appTranslate }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-cashier>
        <ion-button
          fill="clear"
          [attr.aria-label]="'TELLERS.CASHIER_TRANSACTIONS' | appTranslate"
          [appTooltip]="'TELLERS.CASHIER_TRANSACTIONS' | appTranslate"
          (click)="onViewTransactions(cashier)"
          [id]="'cashier-transactions-btn-' + cashier.id"
          [attr.data-testid]="'cashier-transactions-btn-' + cashier.id"
        >
          <ion-icon name="cash-outline" slot="icon-only"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="primary"
          appRequiresPermission="UPDATECASHIERALLOCATION_TELLER"
          [attr.aria-label]="'TELLERS.EDIT_CASHIER' | appTranslate"
          [appTooltip]="'TELLERS.EDIT_CASHIER' | appTranslate"
          (click)="onEditCashier(cashier)"
          [id]="'edit-cashier-btn-' + cashier.id"
          [attr.data-testid]="'edit-cashier-btn-' + cashier.id"
        >
          <ion-icon name="create-outline" slot="icon-only"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="danger"
          appRequiresPermission="DELETECASHIERALLOCATION_TELLER"
          [attr.aria-label]="'TELLERS.REMOVE_CASHIER' | appTranslate"
          [appTooltip]="'TELLERS.REMOVE_CASHIER' | appTranslate"
          (click)="onRemoveCashier(cashier)"
          [id]="'delete-cashier-btn-' + cashier.id"
          [attr.data-testid]="'delete-cashier-btn-' + cashier.id"
        >
          <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class CashiersListComponent implements OnInit {
  private readonly tellerApi = inject(TELLER_API);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(DialogService);
  private readonly i18n = inject(I18N);

  tellerId = 0;

  readonly columns: ColumnDef[] = [
    { key: 'staffName', label: 'TELLERS.STAFF', sortable: true },
    { key: 'startDate', label: 'TELLERS.START_DATE', sortable: true },
    { key: 'endDate', label: 'TELLERS.END_DATE', sortable: true },
    { key: 'fullDay', label: 'TELLERS.IS_FULL_TIME', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly cashiers = signal<Cashier[]>([]);

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.tellerId = +params['tellerId'];
      this.loadCashiers();
    });
  }

  /**
   * Loads the cashiers allocated to this teller.
   *
   * The contract reads `/tellers/{tellerId}/cashiers`, not the top-level `/cashiers` collection,
   * which answers `204 No Content` for every combination of filters and rendered this list empty.
   */
  private loadCashiers(): void {
    this.tellerApi.listCashiers(this.tellerId).subscribe({
      next: (data) => {
        this.cashiers.set(data);
      },
      error: (err: unknown) => {
        console.error('Failed to load cashiers', err);
      },
    });
  }

  onAllocateCashier(): void {
    this.router.navigate(['/tellers', this.tellerId, 'cashiers', 'create']);
  }

  onViewTransactions(cashier: Cashier): void {
    this.router.navigate(['/tellers', this.tellerId, 'cashiers', cashier.id, 'transactions']);
  }

  onEditCashier(cashier: Cashier): void {
    this.router.navigate(['/tellers', this.tellerId, 'cashiers', cashier.id, 'edit']);
  }

  /**
   * Removes a cashier's allocation.
   *
   * On `DialogService.confirm` rather than the browser's `confirm()`, which this used before: the
   * native dialog cannot be translated, styled or tested like the rest, and it sat beside a
   * destructive action that now has a translated confirmation of its own. Editing an allocation
   * is the non-destructive alternative to removing and recreating one, which is what #786 added.
   */
  async onRemoveCashier(cashier: Cashier): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: this.i18n.translate('TELLERS.REMOVE_CASHIER'),
      message: this.i18n.translate('TELLERS.REMOVE_CASHIER_CONFIRM'),
      details: [{ label: this.i18n.translate('TELLERS.STAFF'), value: cashier.staffName }],
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    this.tellerApi.removeCashier(this.tellerId, cashier.id).subscribe({
      next: () => this.loadCashiers(),
      error: (err: unknown) => {
        console.error('Failed to remove cashier allocation', err);
      },
    });
  }
}
