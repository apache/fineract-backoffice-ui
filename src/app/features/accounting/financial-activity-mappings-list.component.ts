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
import { TranslatePipe } from '../../core/adapters';
import { MappingFinancialActivitiesToAccountsService } from '../../api/api/mappingFinancialActivitiesToAccounts.service';
import { GetFinancialActivityAccountsResponse } from '../../api/model/models';
import {
  DataTableComponent,
  ColumnDef,
} from '../../shared/components/data-table/data-table.component';
import { CellTemplateDirective } from '../../shared/components/data-table/cell-template.directive';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-financial-activity-mappings-list',
  standalone: true,
  imports: [DataTableComponent, CellTemplateDirective, TranslatePipe, IonIcon, IonButton],
  template: `
    <div class="container">
      <app-data-table
        title="nav.financialActivityMappings"
        [data]="mappings()"
        [columns]="columns"
        [localLogic]="true"
        createButtonLabel="ACCOUNTING.DEFINE_MAPPING"
        createPermission="CREATE_FINANCIALACTIVITYACCOUNT"
        (create)="onCreate()"
      >
        <ng-template appCellTemplate="financialActivity" let-row>
          {{ row.financialActivityData?.name || '' }}
        </ng-template>
        <ng-template appCellTemplate="glAccountName" let-row>
          {{ row.glAccountData?.name || '' }}
        </ng-template>
        <ng-template appCellTemplate="glAccountCode" let-row>
          {{ row.glAccountData?.glCode || '' }}
        </ng-template>
        <ng-template appCellTemplate="actions" let-row>
          <ion-button
            fill="clear"
            color="primary"
            (click)="onEdit(row)"
            [attr.aria-label]="'COMMON.EDIT' | appTranslate"
          >
            <ion-icon name="create-outline"></ion-icon>
          </ion-button>
          <ion-button
            fill="clear"
            color="danger"
            (click)="onDelete(row)"
            [attr.aria-label]="'COMMON.DELETE' | appTranslate"
          >
            <ion-icon name="trash-outline"></ion-icon>
          </ion-button>
        </ng-template>
      </app-data-table>
    </div>
  `,
  styles: [
    `
      .container {
        padding: 20px;
      }
    `,
  ],
})
export class FinancialActivityMappingsListComponent implements OnInit {
  private financialActivityService = inject(MappingFinancialActivitiesToAccountsService);
  private router = inject(Router);

  readonly mappings = signal<GetFinancialActivityAccountsResponse[]>([]);
  columns: ColumnDef[] = [
    { key: 'financialActivity', label: 'Financial Activity', sortable: true },
    { key: 'glAccountName', label: 'GL Account', sortable: true },
    { key: 'glAccountCode', label: 'GL Code', sortable: true },
    { key: 'actions', label: 'Actions' },
  ];

  ngOnInit() {
    this.loadMappings();
  }

  loadMappings() {
    this.financialActivityService.getFinancialactivityaccounts().subscribe((mappings) => {
      this.mappings.set(mappings);
    });
  }

  onCreate() {
    this.router.navigate(['/accounting/financial-activity-mappings/create']);
  }

  onEdit(mapping: GetFinancialActivityAccountsResponse) {
    this.router.navigate(['/accounting/financial-activity-mappings/edit', mapping.id]);
  }

  onDelete(mapping: GetFinancialActivityAccountsResponse) {
    if (confirm('Are you sure you want to delete this mapping?')) {
      this.financialActivityService
        .deleteFinancialactivityaccountsMappingId(mapping.id!)
        .subscribe(() => {
          this.loadMappings();
        });
    }
  }
}
