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

interface StandingInstructionRow {
  id?: number;
  name?: string;
  amount?: number;
  validFrom?: string;
  status?: { value?: string };
  transferType?: { value?: string };
  fromAccount?: { id?: number; accountNo?: number };
  toAccount?: { id?: number; accountNo?: number };
  fromClient?: { displayName?: string };
  toClient?: { displayName?: string };
}

/**
 * Every standing instruction this client is party to.
 *
 * The loan and savings tabs each show the instructions touching one account; this is the client's
 * whole set, which is the level a branch officer is usually asked about — "what leaves this
 * client's accounts automatically?" — and the level the platform actually filters on.
 */
@Component({
  selector: 'app-client-standing-instructions-tab',
  standalone: true,
  imports: [DataTableComponent, CellTemplateDirective],
  template: `
    <app-data-table
      [data]="instructions()"
      [columns]="columns"
      [isLoading]="isLoading()"
      [hasError]="hasError()"
      (retry)="load()"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="from" let-row>
        {{ row.fromAccount?.accountNo || '-' }}
      </ng-template>
      <ng-template appCellTemplate="to" let-row>
        {{ row.toAccount?.accountNo || '-' }}
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
export class ClientStandingInstructionsTabComponent implements OnInit {
  readonly clientId = input.required<number>();

  private readonly standingInstructions = inject(StandingInstructionsService);

  readonly instructions = signal<StandingInstructionRow[]>([]);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);

  columns: ColumnDef[] = [
    { key: 'name', label: 'COMMON.NAME' },
    { key: 'from', label: 'TRANSFERS.FROM_ACCOUNT' },
    { key: 'to', label: 'TRANSFERS.TO_ACCOUNT' },
    { key: 'amount', label: 'COMMON.AMOUNT' },
    { key: 'transferType', label: 'LOANS.TRANSFER_TYPE' },
    { key: 'validFrom', label: 'LOANS.VALID_FROM' },
    { key: 'status', label: 'COMMON.STATUS' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    // Positional and easy to get wrong: the signature is
    // (externalId, offset, limit, orderBy, sortOrder, transferType, clientName, clientId, ...),
    // so `clientId` is the eighth argument.
    this.standingInstructions
      .getStandinginstructions(
        undefined,
        0,
        200,
        undefined,
        undefined,
        undefined,
        undefined,
        this.clientId(),
      )
      .subscribe({
        next: (page) => {
          this.instructions.set([...((page?.pageItems as Iterable<StandingInstructionRow>) ?? [])]);
          this.hasError.set(false);
          this.isLoading.set(false);
        },
        error: () => {
          this.hasError.set(true);
          this.isLoading.set(false);
        },
      });
  }
}
