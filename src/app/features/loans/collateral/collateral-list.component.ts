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
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../../shared';
import { LoanCollateralService, CollateralData, LoansService } from '../../../api';
import { LoanSummary } from '../loan-summary.model';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

/**
 * Component for listing collateral associated with a specific loan.
 */
@Component({
  selector: 'app-collateral-list',
  standalone: true,
  imports: [TranslateModule, DataTableComponent, CellTemplateDirective, IonIcon, IonButton],
  template: `
    @if (loanSummary(); as summary) {
      <div class="loan-context">
        {{ 'LOANS.ACCOUNT_NO' | translate }}: {{ summary.accountNo }} &middot;
        {{ 'COMMON.CLIENT' | translate }}: {{ summary.clientName }} &middot;
        {{ 'LOANS.PRODUCT_NAME' | translate }}: {{ summary.loanProductName }}
      </div>
    }
    <app-data-table
      title="LOANS.COLLATERAL"
      helpTextKey="HELP.COLLATERAL_DESC"
      createButtonLabel="LOANS.ADD_COLLATERAL"
      createPermission="CREATE_COLLATERAL"
      [columns]="columns"
      [data]="collaterals()"
      [totalRecords]="collaterals().length"
      [showSearch]="false"
      [localLogic]="true"
      (create)="onCreateCollateral()"
    >
      <ng-template appCellTemplate="type" let-collateral>
        {{ collateral.type?.name }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-collateral>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          title="Edit Collateral"
          (click)="onEditCollateral(collateral)"
        >
          <ion-icon name="create-outline"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="danger"
          [attr.aria-label]="'COMMON.DELETE' | translate"
          title="Delete Collateral"
          (click)="onDeleteCollateral(collateral)"
        >
          <ion-icon name="trash-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .loan-context {
        margin: 16px 24px 0;
        color: rgba(0, 0, 0, 0.6);
        font-size: 14px;
      }
    `,
  ],
})
export class CollateralListComponent implements OnInit {
  private readonly collateralService = inject(LoanCollateralService);
  private readonly loansService = inject(LoansService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  loanId: number | null = null;
  readonly loanSummary = signal<LoanSummary | null>(null);

  readonly columns: ColumnDef[] = [
    { key: 'type', label: 'COMMON.TYPE', sortable: true },
    { key: 'value', label: 'COMMON.VALUE', sortable: true },
    { key: 'description', label: 'COMMON.DESCRIPTION', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly collaterals = signal<CollateralData[]>([]);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('loanId');
      if (id) {
        this.loanId = +id;
        this.loadCollaterals();
        this.loadLoanSummary();
      }
    });
  }

  private loadCollaterals(): void {
    if (!this.loanId) return;
    this.collateralService.getLoansLoanIdCollaterals(this.loanId).subscribe({
      next: (data) => {
        this.collaterals.set(data || []);
      },
      error: (err) => console.error('Failed to load collateral details', err),
    });
  }

  private loadLoanSummary(): void {
    if (!this.loanId) return;
    this.loansService.getLoansLoanId(this.loanId).subscribe({
      next: (data) => {
        this.loanSummary.set({
          accountNo: data.accountNo,
          clientName: data.clientName,
          loanProductName: data.loanProductName,
        });
      },
      error: () => {
        // Non-critical context display; the list still works without it.
      },
    });
  }

  onCreateCollateral(): void {
    if (this.loanId) {
      this.router.navigate(['/loans', this.loanId, 'collateral', 'create']);
    }
  }

  onEditCollateral(collateral: CollateralData): void {
    if (this.loanId && collateral.id) {
      this.router.navigate(['/loans', this.loanId, 'collateral', 'edit', collateral.id]);
    }
  }

  onDeleteCollateral(collateral: CollateralData): void {
    if (
      this.loanId &&
      collateral.id &&
      confirm('Are you sure you want to delete this collateral?')
    ) {
      this.collateralService
        .deleteLoansLoanIdCollateralsCollateralId(this.loanId, collateral.id)
        .subscribe({
          next: () => this.loadCollaterals(),
          error: (err) => console.error('Failed to delete collateral', err),
        });
    }
  }
}
