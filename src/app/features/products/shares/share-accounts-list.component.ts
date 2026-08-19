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
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import {
  DataTableComponent,
  ColumnDef,
  CellTemplateDirective,
  StatusBadgeComponent,
} from '../../../shared';
import { ShareAccountService, GetAccountsTypeResponse, GetAccountsPageItems } from '../../../api';
import { PageEvent } from '../../../shared/models/table.model';

/**
 * Component for listing customer share accounts.
 *
 * Provides a paginated overview of all share accounts.
 * Integrates with Fineract's ShareAccountService.
 */
@Component({
  selector: 'app-share-accounts-list',
  standalone: true,
  imports: [
    TranslateModule,
    IonButton,
    IonIcon,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
  ],
  template: `
    <app-data-table
      title="Share Accounts"
      helpTextKey="HELP.SHARE_ACCOUNTS_DESC"
      createButtonLabel="SHARE_ACCOUNTS.CREATE"
      createPermission="CREATE_SHAREACCOUNT"
      [columns]="columns"
      [data]="accounts()"
      [totalRecords]="totalRecords()"
      [showSearch]="false"
      (create)="onCreateAccount()"
      (pageChange)="onPageChange($event)"
    >
      <ng-template appCellTemplate="status" let-account>
        <app-status-badge [status]="account.status"></app-status-badge>
      </ng-template>

      <ng-template appCellTemplate="actions" let-account>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.VIEW' | translate"
          [attr.data-testid]="'share-account-view-' + account.id"
          (click)="onViewAccount(account)"
        >
          <ion-icon name="eye-outline" slot="icon-only"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          (click)="onEditAccount(account)"
        >
          <ion-icon name="create-outline" slot="icon-only"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class ShareAccountsListComponent implements OnInit {
  /** Service for Share account management */
  private readonly shareService = inject(ShareAccountService);
  /** Router for navigation */
  private readonly router = inject(Router);

  /** Data table column definitions */
  readonly columns: ColumnDef[] = [
    { key: 'accountNo', label: 'COMMON.ACCOUNT_NO', sortable: false },
    { key: 'clientName', label: 'COMMON.NAME', sortable: false },
    { key: 'totalApprovedShares', label: 'SHARE_ACCOUNTS.TOTAL_SHARES', sortable: false },
    { key: 'status', label: 'COMMON.STATUS', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  /** List of retrieved accounts */
  readonly accounts = signal<GetAccountsPageItems[]>([]);
  /** Total number of records for pagination */
  readonly totalRecords = signal(0);

  /**
   * Component initialization.
   */
  ngOnInit(): void {
    this.loadAccounts(0, 10);
  }

  /**
   * Fetches share accounts from the API.
   *
   * @param offset - Pagination offset.
   * @param limit - Pagination limit.
   */
  private loadAccounts(offset: number, limit: number): void {
    this.shareService.getAccountsType('share', offset, limit).subscribe({
      next: (response: GetAccountsTypeResponse) => {
        this.accounts.set(Array.from(response.pageItems || []));
        this.totalRecords.set(response.totalFilteredRecords || 0);
      },
      error: (err: unknown) => {
        console.error('Failed to load share accounts', err);
      },
    });
  }

  /**
   * Handles pagination changes.
   *
   * @param event - Page change event containing offset and limit.
   */
  onPageChange(event: PageEvent): void {
    this.loadAccounts(event.pageIndex * event.pageSize, event.pageSize);
  }

  /**
   * Navigates to the share account creation form.
   */
  onCreateAccount(): void {
    this.router.navigate(['/products/shares/create']);
  }

  /**
   * Navigates to the share account edit form.
   *
   * @param account - The share account entity.
   */
  onViewAccount(account: GetAccountsPageItems): void {
    this.router.navigate(['/products/shares/view', account.id]);
  }

  onEditAccount(account: GetAccountsPageItems): void {
    this.router.navigate(['/products/shares/edit', account.id]);
  }
}
