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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ClientSearchV2Service, PageClientSearchData, ClientSearchData } from '../../api';
import { CdkTableModule } from '@angular/cdk/table';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { PageEvent } from '../../shared/models/table.model';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-client-search-v2',
  standalone: true,
  imports: [
    FormsModule,
    CdkTableModule,
    TranslateModule,
    IonIcon,
    IonButton,
    IonSpinner,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    PaginatorComponent,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'CLIENT_SEARCH_V2.TITLE' | translate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div class="search-row">
          <ion-item fill="outline" class="search-field">
            <ion-label position="stacked">{{ 'CLIENT_SEARCH_V2.QUERY' | translate }}</ion-label>
            <ion-input
              [attr.aria-label]="'CLIENT_SEARCH_V2.QUERY' | translate"
              [(ngModel)]="query"
              (keyup.enter)="search()"
              [disabled]="isLoading()"
            ></ion-input>
          </ion-item>
          <ion-button color="primary" (click)="search()" [disabled]="!query || isLoading()">
            <ion-icon name="search-outline"></ion-icon>
            {{ 'CLIENT_SEARCH_V2.SEARCH' | translate }}
          </ion-button>
        </div>

        @if (isLoading()) {
          <div class="spinner-row">
            <ion-spinner name="crescent"></ion-spinner>
          </div>
        }

        @if (results().length > 0) {
          <table cdk-table [dataSource]="results()" class="full-width">
            <ng-container cdkColumnDef="displayName">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'CLIENT_SEARCH_V2.NAME' | translate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.displayName }}</td>
            </ng-container>

            <ng-container cdkColumnDef="accountNo">
              <th cdk-header-cell *cdkHeaderCellDef>
                {{ 'CLIENT_SEARCH_V2.ACCOUNT_NO' | translate }}
              </th>
              <td cdk-cell *cdkCellDef="let row">{{ row.accountNo }}</td>
            </ng-container>

            <ng-container cdkColumnDef="status">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'CLIENT_SEARCH_V2.STATUS' | translate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.status?.value }}</td>
            </ng-container>

            <ng-container cdkColumnDef="officeName">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'CLIENT_SEARCH_V2.OFFICE' | translate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.officeName }}</td>
            </ng-container>

            <ng-container cdkColumnDef="actions">
              <th cdk-header-cell *cdkHeaderCellDef></th>
              <td cdk-cell *cdkCellDef="let row">
                <ion-button
                  fill="clear"
                  (click)="viewClient(row.id)"
                  [title]="'CLIENT_SEARCH_V2.VIEW' | translate"
                  [attr.aria-label]="'CLIENT_SEARCH_V2.VIEW' | translate"
                >
                  <ion-icon name="eye-outline"></ion-icon>
                </ion-button>
              </td>
            </ng-container>

            <tr cdk-header-row *cdkHeaderRowDef="displayedColumns"></tr>
            <tr
              cdk-row
              *cdkRowDef="let row; columns: displayedColumns"
              class="clickable-row"
              (click)="viewClient(row.id)"
            ></tr>
          </table>

          <app-paginator
            [length]="totalElements()"
            [pageSize]="pageSize"
            [pageIndex]="pageIndex"
            [pageSizeOptions]="[10, 25, 50]"
            (page)="onPage($event)"
          ></app-paginator>
        }

        @if (searched() && results().length === 0 && !isLoading()) {
          <p class="no-results">{{ 'CLIENT_SEARCH_V2.NO_RESULTS' | translate }}</p>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .search-row {
        display: flex;
        gap: 16px;
        align-items: center;
        margin-bottom: 8px;
      }
      .search-field {
        flex: 1;
      }
      .spinner-row {
        display: flex;
        justify-content: center;
        padding: 24px;
      }
      .full-width {
        width: 100%;
      }
      .clickable-row {
        cursor: pointer;
      }
      .clickable-row:hover {
        background: rgba(0, 0, 0, 0.04);
      }
      .no-results {
        text-align: center;
        color: rgba(0, 0, 0, 0.5);
        padding: 24px 0;
      }
    `,
  ],
})
export class ClientSearchV2Component {
  private readonly clientSearchService = inject(ClientSearchV2Service);
  private readonly router = inject(Router);

  query = '';
  pageSize = 10;
  pageIndex = 0;
  pageNumber = 0;
  readonly isLoading = signal(false);
  readonly searched = signal(false);

  readonly results = signal<ClientSearchData[]>([]);
  readonly totalElements = signal(0);

  displayedColumns = ['displayName', 'accountNo', 'status', 'officeName', 'actions'];

  search(page = 0): void {
    if (!this.query.trim()) return;
    this.isLoading.set(true);
    this.pageNumber = page;

    this.clientSearchService
      .postClientsSearch({
        request: { text: this.query },
        page: this.pageNumber,
        size: this.pageSize,
      })
      .subscribe({
        next: (data: PageClientSearchData) => {
          this.results.set(data?.content ?? []);
          this.totalElements.set(data?.totalElements ?? 0);
          this.isLoading.set(false);
          this.searched.set(true);
        },
        error: () => {
          this.isLoading.set(false);
          this.searched.set(true);
        },
      });
  }

  onPage(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.search(event.pageIndex);
  }

  viewClient(id: number): void {
    this.router.navigate(['/clients/view', id]);
  }
}
