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

import { TranslateModule } from '@ngx-translate/core';
import { IonButton, IonBadge, IonIcon } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CellTemplateDirective, ColumnDef } from '../../shared';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { LoanProductsService, GetLoanProductsResponse } from '../../api';
import { readScheduleTypeCode, readScheduleTypeLabel } from './loan-schedule-type';

@Component({
  selector: 'app-loan-products-list',
  standalone: true,
  imports: [
    TranslateModule,
    IonButton,
    IonBadge,
    IonIcon,
    DataTableComponent,
    CellTemplateDirective,
  ],
  template: `
    <app-data-table
      [hasError]="hasError()"
      (retry)="onRetry()"
      title="nav.loanProducts"
      helpTextKey="HELP.LOAN_PRODUCTS_DESC"
      createButtonLabel="PRODUCTS.CREATE_LOAN_PRODUCT"
      createPermission="CREATE_LOANPRODUCT"
      [columns]="columns"
      [data]="products()"
      [totalRecords]="products().length"
      [showSearch]="true"
      [localLogic]="true"
      (create)="onCreateProduct()"
    >
      <ng-template appCellTemplate="loanScheduleType" let-product>
        @if (getLoanScheduleType(product); as scheduleType) {
          <ion-badge [color]="scheduleType === 'PROGRESSIVE' ? 'tertiary' : 'primary'">
            {{ getLoanScheduleTypeLabel(product) }}
          </ion-badge>
        }
      </ng-template>
      <ng-template appCellTemplate="actions" let-product>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.VIEW' | translate"
          (click)="onViewProduct(product)"
        >
          <ion-icon name="eye-outline" slot="icon-only"></ion-icon>
        </ion-button>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          (click)="onEditProduct(product)"
        >
          <ion-icon name="create-outline" slot="icon-only"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class LoanProductsListComponent implements OnInit {
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  private readonly loanProductsService = inject(LoanProductsService);
  private readonly router = inject(Router);

  readonly columns: ColumnDef[] = [
    { key: 'name', label: 'COMMON.NAME', sortable: true },
    { key: 'shortName', label: 'PRODUCTS.SHORT_NAME', sortable: true },
    { key: 'description', label: 'PRODUCTS.DESCRIPTION', sortable: false },
    { key: 'loanScheduleType', label: 'PRODUCTS.LOAN_SCHEDULE_TYPE', sortable: false },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly products = signal<GetLoanProductsResponse[]>([]);

  ngOnInit(): void {
    this.loadProducts();
  }

  private loadProducts(): void {
    this.loanProductsService
      .getLoanproducts()
      .pipe(
        tap(() => this.hasError.set(false)),
        catchError(() => {
          this.hasError.set(true);
          return of([]);
        }),
      )
      .subscribe((data: GetLoanProductsResponse[]) => {
        this.products.set(data || []);
      });
  }

  onCreateProduct(): void {
    this.router.navigate(['/products/loan/create']);
  }

  onEditProduct(product: GetLoanProductsResponse): void {
    this.router.navigate(['/products/loan/edit', product.id]);
  }

  onViewProduct(product: GetLoanProductsResponse): void {
    this.router.navigate(['/products/loan/view', product.id]);
  }

  getLoanScheduleType(product: GetLoanProductsResponse): string | undefined {
    return readScheduleTypeCode(product);
  }

  getLoanScheduleTypeLabel(product: GetLoanProductsResponse): string {
    return readScheduleTypeLabel(product);
  }

  onRetry(): void {
    this.loadProducts();
  }
}
