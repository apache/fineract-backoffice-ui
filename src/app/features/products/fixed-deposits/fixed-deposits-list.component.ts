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
import { CurrencyPipe } from '@angular/common';
import {
  DataTableComponent,
  ColumnDef,
  CellTemplateDirective,
  StatusBadgeComponent,
} from '../../../shared';
import { FixedDepositAccountService, GetFixedDepositAccountsResponse } from '../../../api';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

@Component({
  selector: 'app-fixed-deposits-list',
  standalone: true,
  imports: [
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    CurrencyPipe,
    IonIcon,
    IonButton,
    TooltipDirective,
  ],
  template: `
    <app-data-table
      title="Fixed Deposit Accounts"
      helpTextKey="HELP.FIXED_DEPOSITS_DESC"
      createButtonLabel="FIXED_DEPOSITS.CREATE"
      createPermission="CREATE_FIXEDDEPOSITACCOUNT"
      [columns]="columns"
      [data]="accounts()"
      [totalRecords]="accounts().length"
      [showSearch]="true"
      [localLogic]="true"
      (create)="onCreateAccount()"
    >
      <ng-template appCellTemplate="depositAmount" let-account>
        {{ account.depositAmount | currency: account.currency?.code }}
      </ng-template>

      <ng-template appCellTemplate="maturityAmount" let-account>
        {{ account.maturityAmount | currency: account.currency?.code }}
      </ng-template>

      <ng-template appCellTemplate="status" let-account>
        <app-status-badge [status]="account.status"></app-status-badge>
      </ng-template>

      <ng-template appCellTemplate="actions" let-account>
        @if (account.status?.value === 'Submitted and pending approval') {
          <ion-button
            fill="clear"
            color="secondary"
            [attr.aria-label]="'LOANS.APPROVE' | translate"
            [appTooltip]="'LOANS.APPROVE' | translate"
            (click)="onApprove(account)"
          >
            <ion-icon name="checkmark-circle-outline"></ion-icon>
          </ion-button>
        }
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          title="Edit Account Details"
          (click)="onEditAccount(account)"
        >
          <ion-icon name="create-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class FixedDepositAccountsListComponent implements OnInit {
  private readonly fixedDepositService = inject(FixedDepositAccountService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'accountNo', label: 'COMMON.ACCOUNT_NO', sortable: true },
    { key: 'clientName', label: 'COMMON.NAME', sortable: true },
    { key: 'depositAmount', label: 'COMMON.AMOUNT', sortable: true },
    { key: 'maturityAmount', label: 'COMMON.MATURITY_AMOUNT', sortable: true },
    { key: 'status', label: 'COMMON.STATUS', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly accounts = signal<GetFixedDepositAccountsResponse[]>([]);

  ngOnInit(): void {
    this.loadAccounts();
  }

  private loadAccounts(): void {
    this.fixedDepositService.getFixeddepositaccounts().subscribe({
      next: (data: GetFixedDepositAccountsResponse[]) => {
        this.accounts.set(data || []);
      },
      error: (err: unknown) => {
        console.error('Failed to load fixed deposit accounts', err);
      },
    });
  }

  onCreateAccount(): void {
    this.router.navigate(['/products/fixed-deposits/create']);
  }

  onEditAccount(account: GetFixedDepositAccountsResponse): void {
    this.router.navigate(['/products/fixed-deposits/edit', account.id]);
  }

  onApprove(account: GetFixedDepositAccountsResponse): void {
    this.router.navigate([`/products/fixed/${account.id}/action/approve`]);
  }
}
