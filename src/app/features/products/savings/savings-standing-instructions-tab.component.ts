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

import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../../shared';
import { StandingInstructionsService } from '../../../api';
import { TranslatePipe } from '../../../core/adapters';

/** Fineract's PortfolioAccountType. A standing instruction's account id means nothing without it. */
const SAVINGS_ACCOUNT_TYPE = 2;

interface StandingInstructionRow {
  id?: number;
  name?: string;
  amount?: number;
  validFrom?: string;
  status?: { value?: string };
  transferType?: { value?: string };
  fromAccount?: { id?: number; accountNo?: number };
  fromAccountType?: { id?: number };
  toAccount?: { id?: number; accountNo?: number };
  toAccountType?: { id?: number };
  fromClient?: { displayName?: string };
  toClient?: { displayName?: string };
}

/**
 * The standing instructions that move money into or out of this savings account.
 *
 * A savings account is usually the *source* of an instruction rather than its destination, so
 * without this tab a monthly transfer out looks like a withdrawal nobody made.
 *
 * Filtered here rather than by the platform, for the same reason the loan tab is: the narrowest
 * request `getStandinginstructions` answers is by client, so the account is picked out of the
 * result by account id **and** account type. The id alone is ambiguous — savings account 7 and
 * loan account 7 both exist.
 */
@Component({
  selector: 'app-savings-standing-instructions-tab',
  standalone: true,
  imports: [DataTableComponent, CellTemplateDirective, TranslatePipe],
  template: `
    <app-data-table
      [data]="instructions()"
      [columns]="columns"
      [isLoading]="isLoading()"
      [hasError]="hasError()"
      (retry)="load()"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="direction" let-row>
        {{
          (row.toAccount?.id === savingsAccountId()
            ? 'SAVINGS.TRANSFER_IN'
            : 'SAVINGS.TRANSFER_OUT'
          ) | appTranslate
        }}
      </ng-template>
      <ng-template appCellTemplate="status" let-row>
        {{ row.status?.value || '-' }}
      </ng-template>
      <ng-template appCellTemplate="transferType" let-row>
        {{ row.transferType?.value || '-' }}
      </ng-template>
    </app-data-table>
  `,
})
export class SavingsStandingInstructionsTabComponent implements OnInit {
  readonly savingsAccountId = input.required<number>();
  readonly clientId = input<number | undefined>(undefined);

  private readonly standingInstructions = inject(StandingInstructionsService);

  readonly instructions = signal<StandingInstructionRow[]>([]);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);

  columns: ColumnDef[] = [
    { key: 'name', label: 'COMMON.NAME' },
    { key: 'direction', label: 'LOANS.DIRECTION' },
    { key: 'amount', label: 'COMMON.AMOUNT' },
    { key: 'transferType', label: 'LOANS.TRANSFER_TYPE' },
    { key: 'validFrom', label: 'LOANS.VALID_FROM' },
    { key: 'status', label: 'COMMON.STATUS' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const clientId = this.clientId();
    if (!clientId) {
      this.instructions.set([]);
      return;
    }

    this.isLoading.set(true);
    // Positional arguments, and easy to get wrong: the signature is
    // (externalId, offset, limit, orderBy, sortOrder, transferType, clientName, clientId, ...),
    // so `clientId` is the eighth. Passing it in the wrong slot still compiles, because the
    // generated types are all optional primitives.
    this.standingInstructions
      .getStandinginstructions(
        undefined,
        0,
        200,
        undefined,
        undefined,
        undefined,
        undefined,
        clientId,
      )
      .subscribe({
        next: (page) => {
          const rows = [...((page?.pageItems as Iterable<StandingInstructionRow>) ?? [])];
          this.instructions.set(rows.filter((row) => this.touchesThisAccount(row)));
          this.hasError.set(false);
          this.isLoading.set(false);
        },
        error: () => {
          this.hasError.set(true);
          this.isLoading.set(false);
        },
      });
  }

  private touchesThisAccount(row: StandingInstructionRow): boolean {
    const paysIn =
      row.toAccountType?.id === SAVINGS_ACCOUNT_TYPE &&
      row.toAccount?.id === this.savingsAccountId();
    const paysOut =
      row.fromAccountType?.id === SAVINGS_ACCOUNT_TYPE &&
      row.fromAccount?.id === this.savingsAccountId();
    return paysIn || paysOut;
  }
}
