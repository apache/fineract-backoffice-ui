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
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../../shared';
import { ChargesService, ChargeData } from '../../../api';
import { TranslatePipe } from '../../../core/adapters';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

/**
 * Component for listing globally configured charges and penalties.
 *
 * Provides a management view for all types of fees (Loan, Savings, Client).
 */
@Component({
  selector: 'app-charges-list',
  standalone: true,
  imports: [
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    TranslatePipe,
    DecimalPipe,
    CurrencyPipe,
    IonIcon,
    IonButton,
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
        {{ (charge.penalty ? 'COMMON.YES' : 'COMMON.NO') | translate }}
      </ng-template>

      <ng-template appCellTemplate="active" let-charge>
        {{ (charge.active ? 'COMMON.YES' : 'COMMON.NO') | translate }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-charge>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          [title]="'CHARGES.EDIT' | appTranslate"
          (click)="onEditCharge(charge)"
        >
          <ion-icon name="create-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class ChargesListComponent implements OnInit {
  private readonly chargesService = inject(ChargesService);
  private readonly router = inject(Router);

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
}
