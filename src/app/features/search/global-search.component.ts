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

import {
  Component,
  OnInit,
  AfterViewInit,
  signal,
  inject,
  viewChild,
  DestroyRef,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/adapters';
import { SearchAPIService, GetSearchResponse } from '../../api';

export { SearchAPIService, GetSearchResponse };
import {
  NavigationConfigService,
  NavSearchResult,
} from '../../core/services/navigation-config.service';
import { CdkTableModule } from '@angular/cdk/table';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [
    FormsModule,
    CdkTableModule,
    RouterModule,
    TranslatePipe,
    IonButton,
    IonSpinner,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonCheckbox,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'SEARCH.TITLE' | appTranslate }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div class="search-form">
          <ion-item fill="outline">
            <ion-label position="stacked">{{ 'SEARCH.QUERY' | appTranslate }}</ion-label>
            <ion-input
              #searchInput
              [attr.aria-label]="'SEARCH.QUERY' | appTranslate"
              [(ngModel)]="query"
              name="query"
              [autofocus]="true"
              required
              (keyup.enter)="onSearch()"
            ></ion-input>
          </ion-item>

          <ion-item fill="outline">
            <ion-label position="stacked">{{ 'SEARCH.RESOURCE_TYPE' | appTranslate }}</ion-label>
            <ion-select
              [attr.aria-label]="'SEARCH.RESOURCE_TYPE' | appTranslate"
              interface="popover"
              [(ngModel)]="selectedResource"
              name="resource"
            >
              <ion-select-option value="">{{
                'SEARCH.ALL_TYPES' | appTranslate
              }}</ion-select-option>
              @for (type of allowedSearchTypes(); track type) {
                <ion-select-option [value]="type">{{ type }}</ion-select-option>
              }
            </ion-select>
          </ion-item>

          <ion-checkbox [(ngModel)]="exactMatch" name="exactMatch">
            {{ 'SEARCH.EXACT_MATCH' | appTranslate }}
          </ion-checkbox>

          <ion-button color="primary" [disabled]="!query || isLoading()" (click)="onSearch()">
            {{ 'SEARCH.SEARCH_BTN' | appTranslate }}
          </ion-button>
        </div>

        @if (isLoading()) {
          <div class="spinner-container">
            <ion-spinner name="crescent"></ion-spinner>
          </div>
        }

        @if (!isLoading() && searched() && results().length === 0 && navResults().length === 0) {
          <p class="no-results">{{ 'SEARCH.NO_RESULTS' | appTranslate }}</p>
        }

        @if (!isLoading() && navResults().length > 0) {
          <h3 class="results-section-title">{{ 'SEARCH.PAGES_SECTION' | appTranslate }}</h3>
          <table cdk-table [dataSource]="navResults()" class="results-table nav-results-table">
            <ng-container cdkColumnDef="pageType">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'SEARCH.ENTITY_TYPE' | appTranslate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ 'SEARCH.PAGE_TYPE' | appTranslate }}</td>
            </ng-container>

            <ng-container cdkColumnDef="pageName">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'SEARCH.ENTITY_NAME' | appTranslate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.label }}</td>
            </ng-container>

            <ng-container cdkColumnDef="pageSection">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'SEARCH.SECTION' | appTranslate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.groupLabel }}</td>
            </ng-container>

            <tr cdk-header-row *cdkHeaderRowDef="navDisplayedColumns"></tr>
            <tr
              cdk-row
              *cdkRowDef="let row; columns: navDisplayedColumns"
              class="clickable-row"
              (click)="onNavResultClick(row)"
            ></tr>
          </table>
        }

        @if (!isLoading() && results().length > 0) {
          @if (navResults().length > 0) {
            <h3 class="results-section-title">{{ 'SEARCH.ENTITIES_SECTION' | appTranslate }}</h3>
          }
          <table cdk-table [dataSource]="results()" class="results-table">
            <ng-container cdkColumnDef="entityType">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'SEARCH.ENTITY_TYPE' | appTranslate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.entityType }}</td>
            </ng-container>

            <ng-container cdkColumnDef="entityName">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'SEARCH.ENTITY_NAME' | appTranslate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.entityName }}</td>
            </ng-container>

            <ng-container cdkColumnDef="entityAccountNo">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'SEARCH.ACCOUNT_NO' | appTranslate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.entityAccountNo }}</td>
            </ng-container>

            <ng-container cdkColumnDef="entityExternalId">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'SEARCH.EXTERNAL_ID' | appTranslate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.entityExternalId }}</td>
            </ng-container>

            <ng-container cdkColumnDef="parentName">
              <th cdk-header-cell *cdkHeaderCellDef>{{ 'SEARCH.PARENT' | appTranslate }}</th>
              <td cdk-cell *cdkCellDef="let row">{{ row.parentName }}</td>
            </ng-container>

            <tr cdk-header-row *cdkHeaderRowDef="displayedColumns"></tr>
            <tr
              cdk-row
              *cdkRowDef="let row; columns: displayedColumns"
              class="clickable-row"
              (click)="onRowClick(row)"
            ></tr>
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
        flex: 1 1 200px;
      }
      .spinner-container {
        display: flex;
        justify-content: center;
        padding: 32px;
      }
      .no-results {
        text-align: center;
        color: rgba(0, 0, 0, 0.54);
        padding: 32px;
      }
      .results-table {
        width: 100%;
      }
      .nav-results-table {
        margin-bottom: 24px;
      }
      .results-section-title {
        margin: 24px 0 12px;
        font-size: 1rem;
        font-weight: 600;
      }
      .clickable-row {
        cursor: pointer;
      }
      .clickable-row:hover {
        background: rgba(0, 0, 0, 0.04);
      }
    `,
  ],
})
export class GlobalSearchComponent implements OnInit, AfterViewInit {
  private searchApiService = inject(SearchAPIService);
  private navigationConfig = inject(NavigationConfigService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  readonly searchInput = viewChild<IonInput>('searchInput');

  query = '';
  selectedResource = '';
  exactMatch = false;
  readonly isLoading = signal(false);
  readonly searched = signal(false);
  readonly allowedSearchTypes = signal<string[]>([]);
  readonly results = signal<GetSearchResponse[]>([]);
  readonly navResults = signal<NavSearchResult[]>([]);
  displayedColumns = [
    'entityType',
    'entityName',
    'entityAccountNo',
    'entityExternalId',
    'parentName',
  ];
  navDisplayedColumns = ['pageType', 'pageName', 'pageSection'];

  ngOnInit(): void {
    this.searchApiService
      .getSearchTemplate()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (template) => {
          this.allowedSearchTypes.set(
            ((template as Record<string, unknown>)?.[`allowedSearchTypes`] as string[]) ?? [],
          );
        },
      });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const q = params.get('q');
      if (q && q !== this.query) {
        this.query = q;
        this.onSearch();
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      const input = this.searchInput();
      if (input && typeof input.setFocus === 'function') {
        input.setFocus();
      }
    });
  }

  onSearch(): void {
    if (!this.query) return;
    this.isLoading.set(true);
    this.searched.set(false);
    this.navResults.set(this.navigationConfig.searchRoutes(this.query));
    const resource = this.selectedResource || undefined;
    this.searchApiService.getSearch(this.query, resource, this.exactMatch).subscribe({
      next: (data) => {
        this.results.set(data ?? []);
        this.isLoading.set(false);
        this.searched.set(true);
      },
      error: () => {
        this.results.set([]);
        this.isLoading.set(false);
        this.searched.set(true);
      },
    });
  }

  onNavResultClick(result: NavSearchResult): void {
    this.router.navigateByUrl(result.route);
  }

  onRowClick(row: GetSearchResponse): void {
    const id = row.entityId;
    switch (row.entityType) {
      case 'CLIENT':
        this.router.navigate(['/clients', id]);
        break;
      case 'LOAN':
        this.router.navigate(['/loans', id]);
        break;
      case 'GROUP':
        this.router.navigate(['/groups', id]);
        break;
      case 'SAVING':
        this.router.navigate(['/savings', id]);
        break;
    }
  }
}
