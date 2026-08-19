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
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import {
  ExternalAssetOwnersService,
  ExternalTransferData,
  PageExternalTransferData,
  ExternalOwnerTransferJournalEntryData,
  JournalEntryData,
  ExternalAssetOwnerLoanProductAttributesService,
} from '../../../api';
import { DataTableComponent, ColumnDef, StatusBadgeComponent } from '../../../shared';
import { CdkTableModule } from '@angular/cdk/table';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular/standalone';

/**
 * The tabs on this screen, named.
 *
 * They were positional strings — '0', '7' — which say nothing at the point of use and shift
 * meaning whenever a tab is inserted in the middle. The values are still strings because
 * `ion-segment` compares them as such.
 */
export const ASSET_OWNER_TAB = {
  details: 'details',
  loanProductAttributes: 'loanProductAttributes',
} as const;

export type AssetOwnerTab = (typeof ASSET_OWNER_TAB)[keyof typeof ASSET_OWNER_TAB];

@Component({
  selector: 'app-asset-owner-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    CdkTableModule,
    DataTableComponent,
    StatusBadgeComponent,
    IonIcon,
    IonButton,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSegment,
    IonSegmentButton,
    IonLabel,
  ],
  template: `
    @if (transfer$ | async; as transfer) {
      <div class="container">
        <div class="breadcrumb">
          <a routerLink="/fintech/asset-owners">External Asset Owners</a> /
          <span>{{ transfer.owner?.externalId }}</span>
        </div>
        <ion-card class="header-card">
          <ion-card-header>
            <ion-card-title>
              Asset Owner: {{ transfer.owner?.externalId }}
              <app-status-badge [status]="transfer.status"></app-status-badge>
            </ion-card-title>
            <div class="header-actions">
              <ion-button
                fill="outline"
                color="primary"
                [routerLink]="['/loans/view', transfer.loan?.loanId]"
              >
                <ion-icon name="business-outline"></ion-icon>
                View Loan Account
              </ion-button>
            </div>
          </ion-card-header>
          <ion-card-content>
            <div class="details-grid">
              <div class="detail-item">
                <span class="label">Transfer ID:</span>
                <span class="value">{{ transfer.transferExternalId }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Loan External ID:</span>
                <span class="value">{{ transfer.loan?.externalId }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Purchase Price Ratio:</span>
                <span class="value">{{ transfer.purchasePriceRatio }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Settlement Date:</span>
                <span class="value">{{ transfer.settlementDate }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Effective From:</span>
                <span class="value">{{ transfer.effectiveFrom }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Effective To:</span>
                <span class="value">{{ transfer.effectiveTo || 'N/A' }}</span>
              </div>
            </div>
          </ion-card-content>
        </ion-card>
        <ion-segment [value]="activeTab()" (ionChange)="activeTab.set($any($event).detail.value)">
          <ion-segment-button [value]="TAB.details">
            <ion-label>Journal Entries</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.loanProductAttributes">
            <ion-label>{{ 'ASSET_OWNERS.LOAN_PRODUCT_ATTRIBUTES' | translate }}</ion-label>
          </ion-segment-button>
        </ion-segment>

        @if (activeTab() === TAB.details) {
          <app-data-table
            title="Journal Entries"
            [columns]="journalColumns"
            [data]="(journalEntries$ | async) || []"
            [showSearch]="false"
            [localLogic]="true"
          >
          </app-data-table>
        }
        @if (activeTab() === TAB.loanProductAttributes) {
          <div class="tab-content">
            @if (attributes().length === 0) {
              <p class="empty-state">{{ 'COMMON.NO_DATA' | translate }}</p>
            } @else {
              <table cdk-table [dataSource]="attributes()" class="full-width-table">
                <ng-container cdkColumnDef="attributeKey">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'ASSET_OWNERS.ATTRIBUTE_KEY' | translate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.attributeKey }}</td>
                </ng-container>
                <ng-container cdkColumnDef="attributeValue">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'ASSET_OWNERS.ATTRIBUTE_VALUE' | translate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.attributeValue }}</td>
                </ng-container>
                <ng-container cdkColumnDef="actions">
                  <th cdk-header-cell *cdkHeaderCellDef></th>
                  <td cdk-cell *cdkCellDef="let row">
                    <!-- placeholder for edit action -->
                  </td>
                </ng-container>
                <tr cdk-header-row *cdkHeaderRowDef="attributeColumns"></tr>
                <tr cdk-row *cdkRowDef="let row; columns: attributeColumns"></tr>
              </table>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .container {
        padding: 24px;
      }
      .breadcrumb {
        margin-bottom: 16px;
        font-size: 14px;
      }
      .breadcrumb a {
        text-decoration: none;
        color: #1976d2;
      }
      .header-card {
        margin-bottom: 24px;
      }
      mat-card-title {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .header-actions {
        margin-left: auto;
      }
      .details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 16px;
        margin-top: 16px;
      }
      .detail-item {
        display: flex;
        flex-direction: column;
      }
      .label {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
        margin-bottom: 4px;
      }
      .value {
        font-weight: 500;
      }
      .content-tabs {
        margin-top: 24px;
      }
      .tab-content {
        padding: 16px 0;
      }
      .empty-state {
        color: rgba(0, 0, 0, 0.54);
        font-style: italic;
      }
      .full-width-table {
        width: 100%;
      }
    `,
  ],
})
export class AssetOwnerViewComponent implements OnInit {
  /** Selected tab; mat-tab-group tracked this internally, ion-segment does not. */
  /** Exposed so the template names its tabs instead of numbering them. */
  protected readonly TAB = ASSET_OWNER_TAB;

  readonly activeTab = signal<AssetOwnerTab>(ASSET_OWNER_TAB.details);
  private readonly route = inject(ActivatedRoute);
  private readonly assetOwnersService = inject(ExternalAssetOwnersService);
  private readonly attributesService = inject(ExternalAssetOwnerLoanProductAttributesService);

  readonly attributes = signal<Record<string, unknown>[]>([]);
  attributeColumns = ['attributeKey', 'attributeValue', 'actions'];

  transfer$!: Observable<ExternalTransferData>;
  journalEntries$!: Observable<JournalEntryData[]>;

  journalColumns: ColumnDef[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'transactionDate', label: 'Date', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true },
    { key: 'type.value', label: 'Type', sortable: true },
    { key: 'glAccountName', label: 'GL Account', sortable: true },
  ];

  ngOnInit() {
    const transferExternalId = this.route.snapshot.params['id'];

    // Get basic transfer details using transferExternalId
    this.transfer$ = this.assetOwnersService
      .getExternalAssetOwnersTransfers(transferExternalId, undefined, undefined, 0, 1)
      .pipe(
        map((page: PageExternalTransferData) => page.content?.[0] || {}),
        catchError(() => of({} as ExternalTransferData)),
      );

    // Load loan product attributes if the transfer has a loanProductId
    this.transfer$.subscribe((transfer: ExternalTransferData) => {
      if ((transfer as Record<string, unknown>)['loanProductId']) {
        this.attributesService
          .getExternalAssetOwnersLoanProductLoanProductIdAttributes(
            (transfer as Record<string, unknown>)['loanProductId'] as number,
          )
          .subscribe({
            next: (page: unknown) =>
              this.attributes.set((page as { content?: Record<string, unknown>[] })?.content ?? []),
            error: () => {
              /* ignored */
            },
          });
      }
    });

    // Get journal entries using the numeric transferId once transfer is loaded
    this.journalEntries$ = this.transfer$.pipe(
      switchMap((transfer) => {
        if (transfer.transferId) {
          return this.assetOwnersService
            .getExternalAssetOwnersTransfersTransferIdJournalEntries(transfer.transferId)
            .pipe(
              map(
                (response: ExternalOwnerTransferJournalEntryData) =>
                  response.journalEntryData?.content || [],
              ),
              catchError(() => of([])),
            );
        }
        return of([]);
      }),
    );
  }
}
