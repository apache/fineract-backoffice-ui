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
import { TranslateModule } from '@ngx-translate/core';
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { WorkingCapitalLoansService, GetWorkingCapitalLoansLoanIdResponse } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

/**
 * Lists Working Capital Loans. The list endpoint returns a Spring Data page
 * (`content`, `totalElements`, ...); the rows are flattened into table-friendly
 * fields so the shared DataTable can paginate locally.
 *
 * Note: the working-capital endpoints are Fineract 1.15.0-only and are not reachable
 * on the older community sandbox; this screen is verified against the frozen spec.
 */
interface WcLoanRow {
  id?: number;
  accountNo?: string;
  clientName?: string;
  clientId?: number;
  principal?: number;
  status?: string;
}

@Component({
  selector: 'app-wc-loans-list',
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
      title="nav.wcLoans"
      helpTextKey="HELP.WC_LOANS_DESC"
      createButtonLabel="WC_LOANS.CREATE"
      createPermission="CREATE_WORKINGCAPITALLOAN"
      [columns]="columns"
      [data]="loans()"
      [totalRecords]="loans().length"
      [localLogic]="true"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="actions" let-row>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.VIEW' | translate"
          [appTooltip]="'COMMON.VIEW' | translate"
          (click)="onView(row)"
        >
          <ion-icon name="eye-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class WcLoansListComponent implements OnInit {
  private readonly loansService = inject(WorkingCapitalLoansService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'accountNo', label: 'WC_LOANS.ACCOUNT_NO', sortable: true },
    { key: 'clientName', label: 'WC_LOANS.CLIENT', sortable: true },
    { key: 'principal', label: 'WC_LOANS.PRINCIPAL', sortable: true },
    { key: 'status', label: 'WC_LOANS.STATUS', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly loans = signal<WcLoanRow[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loansService.getWorkingCapitalLoans().subscribe({
      next: (data) => {
        this.loans.set(
          (data.content ?? []).map((loan: GetWorkingCapitalLoansLoanIdResponse) => ({
            id: loan.id,
            accountNo: loan.accountNo,
            clientName: loan.client?.displayName,
            clientId: loan.client?.id,
            principal: loan.proposedPrincipal ?? loan.approvedPrincipal,
            status: loan.status?.value,
          })),
        );
      },
      error: (err: unknown) => {
        console.error('Failed to load working-capital loans', err);
      },
    });
  }

  onCreate(): void {
    this.router.navigate(['/working-capital/loans/create']);
  }

  onView(row: WcLoanRow): void {
    if (!row.id) return;
    this.router.navigate(['/working-capital/loans/view', row.id]);
  }
}
