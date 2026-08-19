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

import { Component, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { Subject, merge, of } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';
import { DataTableComponent, CellTemplateDirective, ColumnDef } from '../../shared';
import { ExternalAssetOwnersService, ExternalTransferData } from '../../api';
import { PageEvent } from '../../shared/models/table.model';
import { IonButton, IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-asset-owners-list',
  standalone: true,
  imports: [
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    NgClass,
    IonIcon,
    IonButton,
  ],
  template: `
    <app-data-table
      [hasError]="hasError()"
      (retry)="onRetry()"
      title="External Asset Owners"
      helpTextKey="HELP.ASSET_OWNERS_DESC"
      [columns]="columns"
      [data]="transfers()"
      [totalRecords]="totalRecords"
      (searchChange)="onSearch($event)"
      [pageIndex]="pageIndex()"
      (pageChange)="onPage($event)"
    >
      <ng-template appCellTemplate="status" let-transfer>
        <span class="status-tag" [ngClass]="transfer.status?.toLowerCase()">
          {{ transfer.status }}
        </span>
      </ng-template>

      <ng-template appCellTemplate="actions" let-transfer>
        <ion-button
          fill="clear"
          color="primary"
          (click)="onViewDetails(transfer)"
          [attr.aria-label]="'COMMON.VIEW_DETAILS' | translate"
        >
          <ion-icon name="eye-outline"></ion-icon>
        </ion-button>
      </ng-template>
    </app-data-table>
  `,
  styles: [
    `
      .status-tag {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        text-transform: uppercase;
      }
      .active {
        background-color: #e6f4ea;
        color: #1e8e3e;
      }
      .pending {
        background-color: #fef7e0;
        color: #f29900;
      }
    `,
  ],
})
export class ExternalAssetOwnersListComponent {
  /** True when the last load failed, so the table offers a retry instead of an empty list. */
  readonly hasError = signal(false);

  /** Re-runs the query behind the table when the user asks to try again. */
  private readonly retrySubject = new Subject<void>();

  private readonly assetOwnersService = inject(ExternalAssetOwnersService);
  private readonly router = inject(Router);

  columns: ColumnDef[] = [
    { key: 'transferExternalId', label: 'Transfer ID', sortable: false },
    { key: 'owner.externalId', label: 'Owner ID', sortable: false },
    { key: 'loan.externalId', label: 'Loan Account', sortable: false },
    { key: 'purchasePriceRatio', label: 'Purchase Ratio', sortable: false },
    { key: 'status', label: 'Status', sortable: false },
    { key: 'actions', label: 'Actions', sortable: false },
  ];

  readonly transfers = signal<ExternalTransferData[]>([]);
  totalRecords = 0;

  private searchSubject = new Subject<string>();
  private pageSubject = new Subject<PageEvent>();

  private currentFilter = '';
  private currentPage: PageEvent = { pageIndex: 0, pageSize: 10, length: 0 };
  /** Mirrors currentPage.pageIndex for the data-table, so resetting to the
      first page on search/sort/filter actually moves the paginator. */
  readonly pageIndex = signal(0);

  constructor() {
    merge(this.searchSubject, this.pageSubject, this.retrySubject)
      .pipe(
        startWith({}),
        switchMap(() => {
          // Use searchInvestorData with PagedRequestExternalAssetOwnerSearchRequest
          const request = {
            page: this.currentPage.pageIndex,
            size: this.currentPage.pageSize,
            request: {
              text: this.currentFilter || undefined,
            },
          };

          return this.assetOwnersService.postExternalAssetOwnersSearch(request).pipe(
            tap(() => this.hasError.set(false)),
            catchError(() => {
              this.hasError.set(true);
              return of(null);
            }),
          );
        }),
        map((response) => {
          if (response === null) return [];
          this.totalRecords = response.totalElements || 0;
          return response.content || [];
        }),
      )
      .subscribe((data) => {
        this.transfers.set(data);
      });
  }

  onSearch(value: string) {
    this.currentFilter = value;
    this.currentPage.pageIndex = 0;
    this.pageIndex.set(0);
    this.searchSubject.next(value);
  }

  onPage(event: PageEvent) {
    this.currentPage = event;
    this.pageIndex.set(event.pageIndex);
    this.pageSubject.next(event);
  }

  onViewDetails(transfer: ExternalTransferData) {
    this.router.navigate(['/fintech/asset-owners/view', transfer.transferExternalId], {
      queryParams: { ownerExternalId: transfer.owner?.externalId },
    });
  }

  onRetry(): void {
    this.retrySubject.next();
  }
}
