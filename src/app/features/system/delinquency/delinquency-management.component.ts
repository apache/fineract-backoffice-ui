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
import { TranslateModule } from '@ngx-translate/core';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import {
  IonButton,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular/standalone';
import {
  DataTableComponent,
  ColumnDef,
  HasPermissionDirective,
  CellTemplateDirective,
} from '../../../shared';
import {
  DelinquencyRangeAndBucketsManagementService,
  DelinquencyRangeData,
  DelinquencyBucketResponse,
} from '../../../api';

/**
 * The tabs on this screen, named.
 *
 * They were positional strings — '0', '7' — which say nothing at the point of use and shift
 * meaning whenever a tab is inserted in the middle. The values are still strings because
 * `ion-segment` compares them as such.
 */
export const DELINQUENCY_TAB = {
  ranges: 'ranges',
  buckets: 'buckets',
} as const;

export type DelinquencyTab = (typeof DELINQUENCY_TAB)[keyof typeof DELINQUENCY_TAB];

@Component({
  selector: 'app-delinquency-management',
  standalone: true,
  imports: [
    RouterModule,
    TranslateModule,
    DataTableComponent,
    HasPermissionDirective,
    CellTemplateDirective,
    IonIcon,
    IonButton,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    TooltipDirective,
  ],
  template: `
    <div class="management-container">
      <ion-segment [value]="activeTab()" (ionChange)="activeTab.set($any($event).detail.value)">
        <ion-segment-button [value]="TAB.ranges">
          <ion-label>{{ 'SYSTEM.DELINQUENCY_RANGES' | translate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.buckets">
          <ion-label>{{ 'SYSTEM.DELINQUENCY_BUCKETS' | translate }}</ion-label>
        </ion-segment-button>
      </ion-segment>

      @if (activeTab() === TAB.ranges) {
        <div class="tab-content">
          <app-data-table
            title="SYSTEM.DELINQUENCY_RANGES"
            [columns]="rangeColumns"
            [data]="ranges()"
            [isLoading]="isLoadingRanges()"
            [localLogic]="true"
          >
            <ion-button
              headerActions
              color="primary"
              [routerLink]="['ranges', 'create']"
              *appHasPermission="'CREATE_DELINQUENCY_RANGE'"
            >
              <ion-icon name="add-outline"></ion-icon>
              {{ 'SYSTEM.CREATE_RANGE' | translate }}
            </ion-button>

            <ng-template appCellTemplate="actions" let-row>
              <div class="action-buttons">
                <ion-button
                  fill="clear"
                  color="primary"
                  [routerLink]="['ranges', 'edit', row.id]"
                  *appHasPermission="'UPDATE_DELINQUENCY_RANGE'"
                  [attr.aria-label]="'COMMON.EDIT' | translate"
                  [appTooltip]="'COMMON.EDIT' | translate"
                >
                  <ion-icon name="create-outline"></ion-icon>
                </ion-button>
                <ion-button
                  fill="clear"
                  color="danger"
                  (click)="onDeleteRange(row.id)"
                  *appHasPermission="'DELETE_DELINQUENCY_RANGE'"
                  [attr.aria-label]="'COMMON.DELETE' | translate"
                  [appTooltip]="'COMMON.DELETE' | translate"
                >
                  <ion-icon name="trash-outline"></ion-icon>
                </ion-button>
              </div>
            </ng-template>
          </app-data-table>
        </div>
      }
      @if (activeTab() === TAB.buckets) {
        <div class="tab-content">
          <app-data-table
            title="SYSTEM.DELINQUENCY_BUCKETS"
            [columns]="bucketColumns"
            [data]="buckets()"
            [isLoading]="isLoadingBuckets()"
            [localLogic]="true"
          >
            <ion-button
              headerActions
              color="primary"
              [routerLink]="['buckets', 'create']"
              *appHasPermission="'CREATE_DELINQUENCY_BUCKET'"
            >
              <ion-icon name="add-outline"></ion-icon>
              {{ 'SYSTEM.CREATE_BUCKET' | translate }}
            </ion-button>

            <ng-template appCellTemplate="ranges" let-row>
              @for (range of row.ranges; track range.id; let last = $last) {
                {{ range.classification }}{{ !last ? ', ' : '' }}
              }
            </ng-template>

            <ng-template appCellTemplate="actions" let-row>
              <div class="action-buttons">
                <ion-button
                  fill="clear"
                  color="primary"
                  [routerLink]="['buckets', 'edit', row.id]"
                  *appHasPermission="'UPDATE_DELINQUENCY_BUCKET'"
                  [attr.aria-label]="'COMMON.EDIT' | translate"
                  [appTooltip]="'COMMON.EDIT' | translate"
                >
                  <ion-icon name="create-outline"></ion-icon>
                </ion-button>
                <ion-button
                  fill="clear"
                  color="danger"
                  (click)="onDeleteBucket(row.id)"
                  *appHasPermission="'DELETE_DELINQUENCY_BUCKET'"
                  [attr.aria-label]="'COMMON.DELETE' | translate"
                  [appTooltip]="'COMMON.DELETE' | translate"
                >
                  <ion-icon name="trash-outline"></ion-icon>
                </ion-button>
              </div>
            </ng-template>
          </app-data-table>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .management-container {
        padding: 24px;
      }
      .tab-content {
        padding-top: 16px;
      }
      .action-buttons {
        display: flex;
        gap: 8px;
      }
    `,
  ],
})
export class DelinquencyManagementComponent implements OnInit {
  /** Selected tab; mat-tab-group tracked this internally, ion-segment does not. */
  /** Exposed so the template names its tabs instead of numbering them. */
  protected readonly TAB = DELINQUENCY_TAB;

  readonly activeTab = signal<DelinquencyTab>(DELINQUENCY_TAB.ranges);
  private readonly delinquencyService = inject(DelinquencyRangeAndBucketsManagementService);

  readonly ranges = signal<DelinquencyRangeData[]>([]);
  readonly buckets = signal<DelinquencyBucketResponse[]>([]);
  readonly isLoadingRanges = signal<boolean>(false);
  readonly isLoadingBuckets = signal<boolean>(false);

  rangeColumns: ColumnDef[] = [
    { key: 'classification', label: 'COMMON.NAME', sortable: true },
    { key: 'minimumAgeDays', label: 'SYSTEM.MIN_AGE_DAYS', sortable: true },
    { key: 'maximumAgeDays', label: 'SYSTEM.MAX_AGE_DAYS', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS' },
  ];

  bucketColumns: ColumnDef[] = [
    { key: 'name', label: 'COMMON.NAME', sortable: true },
    { key: 'ranges', label: 'SYSTEM.RANGES' },
    { key: 'actions', label: 'COMMON.ACTIONS' },
  ];

  ngOnInit(): void {
    this.loadRanges();
    this.loadBuckets();
  }

  loadRanges(): void {
    this.isLoadingRanges.set(true);
    this.delinquencyService.getDelinquencyRanges().subscribe({
      next: (data) => {
        this.ranges.set(data);
        this.isLoadingRanges.set(false);
      },
      error: (err) => {
        console.error('Failed to load delinquency ranges', err);
        this.isLoadingRanges.set(false);
      },
    });
  }

  loadBuckets(): void {
    this.isLoadingBuckets.set(true);
    this.delinquencyService.getDelinquencyBuckets().subscribe({
      next: (data) => {
        this.buckets.set(data);
        this.isLoadingBuckets.set(false);
      },
      error: (err) => {
        console.error('Failed to load delinquency buckets', err);
        this.isLoadingBuckets.set(false);
      },
    });
  }

  onDeleteRange(id: number): void {
    if (confirm('Are you sure you want to delete this delinquency range?')) {
      this.delinquencyService.deleteDelinquencyRangesDelinquencyRangeId(id).subscribe({
        next: () => this.loadRanges(),
        error: (err) => console.error('Delete range failed', err),
      });
    }
  }

  onDeleteBucket(id: number): void {
    if (confirm('Are you sure you want to delete this delinquency bucket?')) {
      this.delinquencyService.deleteDelinquencyBucketsDelinquencyBucketId(id).subscribe({
        next: () => this.loadBuckets(),
        error: (err) => console.error('Delete bucket failed', err),
      });
    }
  }
}
