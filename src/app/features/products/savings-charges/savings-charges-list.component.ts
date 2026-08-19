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
import { TranslateModule } from '@ngx-translate/core';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
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
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    IonIcon,
    IonButton,
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
export class SavingsChargesListComponent implements OnInit {
  private readonly savingsChargesService = inject(SavingsChargesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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

  onDelete(row: GetSavingsAccountsSavingsAccountIdChargesResponse): void {
    if (!row.id || !window.confirm('Delete this charge?')) return;
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
