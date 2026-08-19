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

import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonSpinner } from '@ionic/angular/standalone';

import { GroupsService } from '../../../api';
import { StatusBadgeComponent } from '../../../shared';
import { TranslatePipe } from '../../../core/adapters';

/**
 * The accounts a group holds in its own name.
 *
 * `GET /groups/{id}/accounts` is the only endpoint that answers this, and it **omits** empty
 * collections rather than returning them empty — a group with no loans has no `loanAccounts` key
 * at all. Reading it as though the keys were always present is how a list silently becomes
 * `undefined.length`.
 */
@Component({
  selector: 'app-group-accounts-tab',
  standalone: true,
  imports: [StatusBadgeComponent, TranslatePipe, IonSpinner],
  template: `
    @if (isLoading()) {
      <ion-spinner data-testid="group-accounts-loading"></ion-spinner>
    } @else {
      <h2>{{ 'GROUPS.LOAN_ACCOUNTS' | appTranslate }}</h2>
      @if (loanAccounts().length === 0) {
        <p class="empty-state" data-testid="group-loan-accounts-empty">
          {{ 'GROUPS.NO_LOAN_ACCOUNTS' | appTranslate }}
        </p>
      } @else {
        <table class="accounts-table" data-testid="group-loan-accounts">
          <tbody>
            @for (account of loanAccounts(); track account.id) {
              <tr class="clickable" (click)="openLoan(account.id)">
                <td>{{ account.accountNo }}</td>
                <td>{{ account.productName }}</td>
                <td><app-status-badge [status]="account.status?.value"></app-status-badge></td>
              </tr>
            }
          </tbody>
        </table>
      }

      <h2>{{ 'GROUPS.SAVINGS_ACCOUNTS' | appTranslate }}</h2>
      @if (savingsAccounts().length === 0) {
        <p class="empty-state" data-testid="group-savings-accounts-empty">
          {{ 'GROUPS.NO_SAVINGS_ACCOUNTS' | appTranslate }}
        </p>
      } @else {
        <table class="accounts-table" data-testid="group-savings-accounts">
          <tbody>
            @for (account of savingsAccounts(); track account.id) {
              <tr class="clickable" (click)="openSavings(account.id)">
                <td>{{ account.accountNo }}</td>
                <td>{{ account.productName }}</td>
                <td><app-status-badge [status]="account.status?.value"></app-status-badge></td>
              </tr>
            }
          </tbody>
        </table>
      }
    }
  `,
  styles: [
    `
      h2 {
        font-size: 1rem;
        margin: 16px 0 8px;
      }
      .accounts-table {
        width: 100%;
        border-collapse: collapse;
      }
      .accounts-table td {
        padding: 8px;
        border-bottom: 1px solid var(--ion-color-light-shade);
      }
      .clickable {
        cursor: pointer;
      }
      .empty-state {
        color: #95a5a6;
        padding: 12px 0;
      }
    `,
  ],
})
export class GroupAccountsTabComponent implements OnInit {
  readonly groupId = input.required<number>();

  private readonly groupsService = inject(GroupsService);
  private readonly router = inject(Router);

  readonly loanAccounts = signal<GroupAccountRow[]>([]);
  readonly savingsAccounts = signal<GroupAccountRow[]>([]);
  readonly isLoading = signal(false);

  ngOnInit(): void {
    this.isLoading.set(true);
    this.groupsService.getGroupsGroupIdAccounts(this.groupId()).subscribe({
      next: (accounts) => {
        const response = accounts as GroupAccountsResponse;
        this.loanAccounts.set([...(response.loanAccounts ?? [])]);
        this.savingsAccounts.set([...(response.savingsAccounts ?? [])]);
        this.isLoading.set(false);
      },
      error: () => {
        this.loanAccounts.set([]);
        this.savingsAccounts.set([]);
        this.isLoading.set(false);
      },
    });
  }

  openLoan(id: number | undefined): void {
    if (id !== undefined) {
      void this.router.navigate(['/loans/view', id]);
    }
  }

  openSavings(id: number | undefined): void {
    if (id !== undefined) {
      void this.router.navigate(['/products/savings-accounts/view', id]);
    }
  }
}

interface GroupAccountRow {
  id?: number;
  accountNo?: string;
  productName?: string;
  status?: { value?: string };
}

interface GroupAccountsResponse {
  loanAccounts?: GroupAccountRow[];
  savingsAccounts?: GroupAccountRow[];
}
