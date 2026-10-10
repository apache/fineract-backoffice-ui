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
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../core/adapters';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../shared';
import { StandingInstructionsService, GetPageItemsStandingInstructionSwagger } from '../../api';

@Component({
  selector: 'app-standing-instructions-list',
  standalone: true,
  imports: [
    RouterModule,
    TranslatePipe,
    IonButton,
    IonIcon,
    DataTableComponent,
    CellTemplateDirective,
    DatePipe,
    DecimalPipe,
  ],
  template: `
    <app-data-table
      title="CLIENTS.STANDING_INSTRUCTIONS"
      [columns]="columns"
      [data]="instructions()"
      [isLoading]="isLoading()"
      [localLogic]="true"
    >
      <ion-button
        headerActions
        color="primary"
        [routerLink]="['create']"
        id="create-standing-instruction-btn"
        data-testid="create-standing-instruction-btn"
      >
        <ion-icon name="add-outline" slot="start"></ion-icon>
        {{ 'CLIENTS.CREATE_STANDING_INSTRUCTION' | appTranslate }}
      </ion-button>

      <ng-template appCellTemplate="amount" let-row>
        {{ row.amount | number: '1.2-2' }}
      </ng-template>

      <ng-template appCellTemplate="validFrom" let-row>
        {{ row.validFrom | date }}
      </ng-template>

      <ng-template appCellTemplate="validTill" let-row>
        {{ row.validTill | date }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-row>
        <div class="action-buttons">
          <ion-button
            fill="clear"
            color="primary"
            [routerLink]="['edit', row.id]"
            [attr.aria-label]="'COMMON.EDIT' | appTranslate"
            [id]="'edit-standing-instruction-btn-' + row.id"
            [attr.data-testid]="'edit-standing-instruction-btn-' + row.id"
          >
            <ion-icon name="create-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </div>
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .action-buttons {
        display: flex;
        gap: 8px;
      }
    `,
  ],
})
export class StandingInstructionsListComponent implements OnInit {
  private readonly instructionsService = inject(StandingInstructionsService);

  readonly instructions = signal<GetPageItemsStandingInstructionSwagger[]>([]);
  readonly isLoading = signal<boolean>(false);

  columns: ColumnDef[] = [
    { key: 'name', label: 'COMMON.NAME' },
    { key: 'fromClientName', label: 'CLIENTS.FROM_CLIENT' },
    { key: 'fromAccount.accountNo', label: 'CLIENTS.FROM_ACCOUNT' },
    { key: 'toClientName', label: 'CLIENTS.TO_CLIENT' },
    { key: 'toAccount.accountNo', label: 'CLIENTS.TO_ACCOUNT' },
    { key: 'amount', label: 'COMMON.AMOUNT' },
    { key: 'validFrom', label: 'CLIENTS.VALID_FROM' },
    { key: 'validTill', label: 'CLIENTS.VALID_TILL' },
    { key: 'status.value', label: 'COMMON.STATUS' },
    { key: 'actions', label: 'COMMON.ACTIONS' },
  ];

  ngOnInit(): void {
    this.loadInstructions();
  }

  loadInstructions(): void {
    this.isLoading.set(true);
    this.instructionsService.getStandinginstructions().subscribe({
      next: (data) => {
        this.instructions.set(Array.from(data.pageItems || []));
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load standing instructions', err);
        this.isLoading.set(false);
      },
    });
  }
}
