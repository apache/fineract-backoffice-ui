/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CdkTableModule } from '@angular/cdk/table';
import { formatDateToFineract, toIsoDate } from '../../../core/utils/date-formatter';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonDatetime,
  IonDatetimeButton,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSpinner,
} from '@ionic/angular/standalone';

import {
  LoansPointInTimeService,
  RetrieveLoansPointInTimeRequest,
  LoanPointInTimeData,
} from '../../../api';

@Component({
  selector: 'app-loans-point-in-time',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    TranslateModule,
    CdkTableModule,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonSpinner,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'LOANS_POINT_IN_TIME.TITLE' | translate }}</ion-card-title>
      </ion-card-header>

      <ion-card-content>
        <div class="search-form">
          <ion-item fill="outline">
            <ion-label position="stacked">{{ 'LOANS_POINT_IN_TIME.DATE' | translate }}</ion-label>
            <ion-datetime-button datetime="searchDate-picker"></ion-datetime-button>
            <ion-modal [keepContentsMounted]="true">
              <ng-template>
                <ion-datetime
                  id="searchDate-picker"
                  data-testid="searchDate-picker"
                  presentation="date"
                  name="searchDate"
                  [(ngModel)]="searchDate"
                  required
                ></ion-datetime>
              </ng-template>
            </ion-modal>
          </ion-item>

          <ion-item fill="outline">
            <ion-label position="stacked">{{
              'LOANS_POINT_IN_TIME.LOAN_IDS' | translate
            }}</ion-label>
            <ion-input
              [attr.aria-label]="'LOANS_POINT_IN_TIME.LOAN_IDS' | translate"
              [(ngModel)]="loanIdsInput"
              placeholder="1, 2, 3"
            ></ion-input>
          </ion-item>

          <ion-button color="primary" [disabled]="!searchDate || isLoading()" (click)="onSearch()">
            {{ 'LOANS_POINT_IN_TIME.SEARCH' | translate }}
          </ion-button>
        </div>

        @if (isLoading()) {
          <div class="spinner-container">
            <ion-spinner name="crescent"></ion-spinner>
          </div>
        }

        @if (!isLoading() && results().length === 0) {
          <p class="no-results">{{ 'LOANS_POINT_IN_TIME.NO_RESULTS' | translate }}</p>
        }

        @if (!isLoading() && results().length > 0) {
          <table cdk-table [dataSource]="results()" class="results-table">
            <ng-container cdkColumnDef="id">
              <th cdk-header-cell *cdkHeaderCellDef>Loan ID</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.id }}</td>
            </ng-container>

            <ng-container cdkColumnDef="accountNo">
              <th cdk-header-cell *cdkHeaderCellDef>Account No</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.accountNo }}</td>
            </ng-container>

            <ng-container cdkColumnDef="status">
              <th cdk-header-cell *cdkHeaderCellDef>Status</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.status?.value }}</td>
            </ng-container>

            <ng-container cdkColumnDef="principalDisbursed">
              <th cdk-header-cell *cdkHeaderCellDef>Principal Disbursed</th>
              <td cdk-cell *cdkCellDef="let row">
                {{ row.principal?.principalDisbursed | number: '1.2-2' }}
              </td>
            </ng-container>

            <ng-container cdkColumnDef="principalOutstanding">
              <th cdk-header-cell *cdkHeaderCellDef>Principal Outstanding</th>
              <td cdk-cell *cdkCellDef="let row">
                {{ row.principal?.principalOutstanding | number: '1.2-2' }}
              </td>
            </ng-container>

            <ng-container cdkColumnDef="totalOutstanding">
              <th cdk-header-cell *cdkHeaderCellDef>Total Outstanding</th>
              <td cdk-cell *cdkCellDef="let row">
                {{ row.total?.totalOutstanding | number: '1.2-2' }}
              </td>
            </ng-container>

            <ng-container cdkColumnDef="currency">
              <th cdk-header-cell *cdkHeaderCellDef>Currency</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.currency?.code }}</td>
            </ng-container>

            <tr cdk-header-row *cdkHeaderRowDef="displayedColumns"></tr>
            <tr cdk-row *cdkRowDef="let row; columns: displayedColumns"></tr>
          </table>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .search-form {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: center;
        margin-bottom: 24px;
      }

      .search-form mat-form-field {
        min-width: 220px;
      }

      .spinner-container {
        display: flex;
        justify-content: center;
        padding: 32px 0;
      }

      .no-results {
        text-align: center;
        color: rgba(0, 0, 0, 0.54);
        padding: 24px 0;
      }

      .results-table {
        width: 100%;
      }
    `,
  ],
})
export class LoansPointInTimeComponent {
  searchDate = toIsoDate(new Date());
  loanIdsInput = '';
  readonly results = signal<LoanPointInTimeData[]>([]);
  readonly isLoading = signal(false);

  readonly displayedColumns = [
    'id',
    'accountNo',
    'status',
    'principalDisbursed',
    'principalOutstanding',
    'totalOutstanding',
    'currency',
  ];

  private loansPointInTimeService = inject(LoansPointInTimeService);

  onSearch(): void {
    if (!this.searchDate) {
      return;
    }

    const loanIds: number[] = this.loanIdsInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(Number)
      .filter((n) => !isNaN(n));

    const dateStr = formatDateToFineract(this.searchDate);

    const body: RetrieveLoansPointInTimeRequest = {
      date: dateStr as unknown as object,
      dateFormat: 'yyyy-MM-dd',
      locale: 'en',
      ...(loanIds.length > 0 ? { loanIds } : {}),
    };

    this.isLoading.set(true);
    this.results.set([]);

    this.loansPointInTimeService.postLoansAtDateSearch(body).subscribe({
      next: (data) => {
        this.results.set(data ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }
}
