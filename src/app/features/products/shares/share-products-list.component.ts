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
import { CurrencyPipe } from '@angular/common';
import { of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../../shared';
import { ProductsService, GetProductsTypeResponse, GetProductsPageItems } from '../../../api';

@Component({
  selector: 'app-share-products-list',
  standalone: true,
  imports: [
    TranslateModule,
    IonButton,
    IonIcon,
    DataTableComponent,
    CellTemplateDirective,
    CurrencyPipe,
  ],
  template: `
    <app-data-table
      [hasError]="hasError()"
      (retry)="onRetry()"
      title="nav.shares"
      createButtonLabel="PRODUCTS.CREATE_SHARE_PRODUCT"
      createPermission="CREATE_SHAREPRODUCT"
      [columns]="columns"
      [data]="products()"
      [showSearch]="true"
      [localLogic]="true"
      [isLoading]="isLoading()"
      (create)="onCreate()"
    >
      <ng-template appCellTemplate="unitPrice" let-product>
        {{ product.unitPrice | currency: product.currency?.code }}
      </ng-template>

      <ng-template appCellTemplate="actions" let-product>
        <ion-button
          fill="clear"
          color="primary"
          [attr.aria-label]="'COMMON.EDIT' | translate"
          (click)="onEdit(product)"
        >
          <ion-icon name="create-outline" slot="icon-only"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
})
export class ShareProductsListComponent implements OnInit {
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  private readonly productService = inject(ProductsService);
  private readonly router = inject(Router);

  columns: ColumnDef[] = [
    { key: 'name', label: 'COMMON.NAME', sortable: true },
    { key: 'shortName', label: 'PRODUCTS.SHORT_NAME', sortable: true },
    { key: 'currency.code', label: 'PRODUCTS.CURRENCY', sortable: true },
    { key: 'unitPrice', label: 'PRODUCTS.UNIT_PRICE', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS', sortable: false },
  ];

  readonly products = signal<GetProductsPageItems[]>([]);
  readonly isLoading = signal(true);

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.isLoading.set(true);
    this.productService
      .getProductsType('share')
      .pipe(
        tap(() => this.hasError.set(false)),
        catchError(() => {
          this.hasError.set(true);
          return of({ pageItems: [] } as unknown as GetProductsTypeResponse);
        }),
      )
      .subscribe((response: GetProductsTypeResponse) => {
        this.products.set(Array.from(response.pageItems || []));
        this.isLoading.set(false);
      });
  }

  onCreate() {
    this.router.navigate(['/products/share/create']);
  }

  onEdit(product: GetProductsPageItems) {
    this.router.navigate(['/products/share/edit', product.id]);
  }

  onRetry(): void {
    this.loadProducts();
  }
}
