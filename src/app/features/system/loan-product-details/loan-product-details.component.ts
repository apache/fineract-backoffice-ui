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
import { ColumnDef, CellTemplateDirective } from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { LoanProductsDetailsService, LoanProductBasicDetailsData } from '../../../api';

/**
 * Read-only list of loan product basic details (id, name, short name, type, currency).
 * getLoanproductsBasicDetails takes no required arguments.
 */
@Component({
  selector: 'app-loan-product-details',
  standalone: true,
  imports: [DataTableComponent, CellTemplateDirective],
  template: `
    <app-data-table
      title="LOAN_PRODUCT_DETAILS.TITLE"
      helpTextKey="HELP.LOAN_PRODUCT_DETAILS_DESC"
      [columns]="columns"
      [data]="details()"
      [totalRecords]="details().length"
      [localLogic]="true"
    >
      <ng-template appCellTemplate="currency" let-row>
        {{ row.currency?.code }}
      </ng-template>
    </app-data-table>
  `,
})
export class LoanProductDetailsComponent implements OnInit {
  private readonly detailsService = inject(LoanProductsDetailsService);

  readonly columns: ColumnDef[] = [
    { key: 'id', label: 'LOAN_PRODUCT_DETAILS.ID', sortable: true },
    { key: 'name', label: 'LOAN_PRODUCT_DETAILS.NAME', sortable: true },
    { key: 'shortName', label: 'LOAN_PRODUCT_DETAILS.SHORT_NAME', sortable: true },
    { key: 'productType', label: 'LOAN_PRODUCT_DETAILS.PRODUCT_TYPE', sortable: true },
    { key: 'currency', label: 'LOAN_PRODUCT_DETAILS.CURRENCY', sortable: false },
    { key: 'description', label: 'LOAN_PRODUCT_DETAILS.DESCRIPTION', sortable: false },
  ];

  readonly details = signal<LoanProductBasicDetailsData[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.detailsService.getLoanproductsBasicDetails().subscribe({
      next: (data: LoanProductBasicDetailsData[]) => {
        this.details.set(data || []);
      },
      error: (err: unknown) => console.error('Failed to load loan product details', err),
    });
  }
}
