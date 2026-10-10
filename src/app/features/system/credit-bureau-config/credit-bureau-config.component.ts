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
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
import { HelpIconComponent } from '../../../shared';
import { CreditBureauConfigurationService, CreditBureauIntegrationService } from '../../../api';
import { CdkTableModule } from '@angular/cdk/table';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
} from '@ionic/angular/standalone';

interface CreditBureauRow {
  id?: number;
  name?: string;
  product?: string;
  country?: string;
  implementationKey?: string;
}

interface LoanProductMappingRow {
  loanProductId?: number;
  loanProductName?: string;
  organisationCreditBureauId?: number;
  alias?: string;
  isCreditCheckMandatory?: boolean;
}

/**
 * Read-leaning view of the configured credit bureaus and their loan-product mappings.
 * The credit-bureau configuration endpoints return raw JSON strings, so the bodies are
 * parsed before display. The post/update endpoints are complex and intentionally omitted.
 */
@Component({
  selector: 'app-credit-bureau-config',
  standalone: true,
  imports: [
    JsonPipe,
    FormsModule,
    TranslatePipe,
    CdkTableModule,
    HelpIconComponent,
    IonButton,
    IonSpinner,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
  ],
  template: `
    <div class="cbc-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ 'CREDIT_BUREAU_CONFIG.TITLE' | appTranslate }}
            <app-help-icon helpTextKey="HELP.CREDIT_BUREAU_CONFIG_DESC"></app-help-icon>
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          @if (isLoading()) {
            <ion-spinner name="crescent"></ion-spinner>
          } @else {
            <h3>{{ 'CREDIT_BUREAU_CONFIG.BUREAUS' | appTranslate }}</h3>
            <table cdk-table [dataSource]="bureaus()" class="cbc-table">
              <ng-container cdkColumnDef="id">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'CREDIT_BUREAU_CONFIG.ID' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.id }}</td>
              </ng-container>
              <ng-container cdkColumnDef="name">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'CREDIT_BUREAU_CONFIG.NAME' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.name }}</td>
              </ng-container>
              <ng-container cdkColumnDef="product">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'CREDIT_BUREAU_CONFIG.PRODUCT' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.product }}</td>
              </ng-container>
              <ng-container cdkColumnDef="country">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'CREDIT_BUREAU_CONFIG.COUNTRY' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.country }}</td>
              </ng-container>
              <tr cdk-header-row *cdkHeaderRowDef="bureauColumns"></tr>
              <tr cdk-row *cdkRowDef="let row; columns: bureauColumns"></tr>
            </table>

            <h3 class="cbc-section">{{ 'CREDIT_BUREAU_CONFIG.MAPPINGS' | appTranslate }}</h3>
            <table cdk-table [dataSource]="mappings()" class="cbc-table">
              <ng-container cdkColumnDef="loanProductName">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'CREDIT_BUREAU_CONFIG.LOAN_PRODUCT' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.loanProductName }}</td>
              </ng-container>
              <ng-container cdkColumnDef="organisationCreditBureauId">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'CREDIT_BUREAU_CONFIG.ORG_BUREAU_ID' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.organisationCreditBureauId }}</td>
              </ng-container>
              <ng-container cdkColumnDef="alias">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'CREDIT_BUREAU_CONFIG.ALIAS' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.alias }}</td>
              </ng-container>
              <ng-container cdkColumnDef="isCreditCheckMandatory">
                <th cdk-header-cell *cdkHeaderCellDef>
                  {{ 'CREDIT_BUREAU_CONFIG.MANDATORY' | appTranslate }}
                </th>
                <td cdk-cell *cdkCellDef="let row">{{ row.isCreditCheckMandatory }}</td>
              </ng-container>
              <tr cdk-header-row *cdkHeaderRowDef="mappingColumns"></tr>
              <tr cdk-row *cdkRowDef="let row; columns: mappingColumns"></tr>
            </table>

            <h3 class="cbc-section">{{ 'CREDIT_BUREAU_CONFIG.INTEGRATION' | appTranslate }}</h3>

            <div class="integration-form">
              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'CREDIT_BUREAU_CONFIG.NATIONAL_ID' | appTranslate
                }}</ion-label>
                <ion-input
                  [attr.aria-label]="'CREDIT_BUREAU_CONFIG.NATIONAL_ID' | appTranslate"
                  [(ngModel)]="nationalId"
                  name="nationalId"
                ></ion-input>
              </ion-item>

              @for (bureau of bureaus(); track bureau.id) {
                <div class="bureau-actions">
                  <span class="bureau-label">{{ bureau.name }}</span>
                  <ion-button
                    fill="outline"
                    (click)="fetchReport(bureau.id)"
                    [disabled]="integrationLoading()"
                  >
                    {{ 'CREDIT_BUREAU_CONFIG.FETCH_REPORT' | appTranslate }}
                  </ion-button>
                  <ion-button
                    fill="outline"
                    (click)="searchByNationalId(bureau.id)"
                    [disabled]="!nationalId || integrationLoading()"
                  >
                    {{ 'CREDIT_BUREAU_CONFIG.SEARCH_NATIONAL_ID' | appTranslate }}
                  </ion-button>
                </div>
              }
            </div>

            @if (integrationLoading()) {
              <ion-spinner name="crescent"></ion-spinner>
            }

            @if (creditReport().length > 0) {
              <pre class="report-output">{{ creditReport() | json }}</pre>
            } @else if (reportFetched()) {
              <p class="no-report">{{ 'CREDIT_BUREAU_CONFIG.NO_REPORT' | appTranslate }}</p>
            }
          }
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .cbc-container {
        padding: 24px;
      }
      .cbc-table {
        width: 100%;
      }
      .cbc-section {
        margin-top: 24px;
      }
      .integration-form {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        margin-bottom: 16px;
      }
      .bureau-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .bureau-label {
        font-weight: 500;
        min-width: 120px;
      }
      .report-output {
        background: #f5f5f5;
        padding: 16px;
        border-radius: 4px;
        overflow: auto;
        max-height: 400px;
        font-size: 12px;
      }
      .no-report {
        color: rgba(0, 0, 0, 0.54);
        padding: 8px 0;
      }
    `,
  ],
})
export class CreditBureauConfigComponent implements OnInit {
  private readonly configService = inject(CreditBureauConfigurationService);
  private readonly integrationService = inject(CreditBureauIntegrationService);

  readonly bureauColumns = ['id', 'name', 'product', 'country'];
  readonly mappingColumns = [
    'loanProductName',
    'organisationCreditBureauId',
    'alias',
    'isCreditCheckMandatory',
  ];

  readonly bureaus = signal<CreditBureauRow[]>([]);
  readonly mappings = signal<LoanProductMappingRow[]>([]);
  readonly isLoading = signal(false);

  nationalId = '';
  readonly creditReport = signal<unknown[]>([]);
  readonly integrationLoading = signal(false);
  readonly reportFetched = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.configService.getCreditBureauConfiguration().subscribe({
      next: (raw: string) => {
        this.bureaus.set(this.parseList<CreditBureauRow>(raw));
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load credit bureaus', err);
        this.isLoading.set(false);
      },
    });

    this.configService.getCreditBureauConfigurationLoanProduct().subscribe({
      next: (raw: string) => {
        this.mappings.set(this.parseList<LoanProductMappingRow>(raw));
      },
      error: (err: unknown) => {
        console.error('Failed to load loan-product mappings', err);
      },
    });
  }

  fetchReport(bureauId?: number): void {
    if (!bureauId) return;
    this.integrationLoading.set(true);
    this.creditReport.set([]);
    this.reportFetched.set(false);
    this.integrationService
      .getCreditBureauIntegrationCreditReportCreditBureauId(bureauId)
      .subscribe({
        next: (raw: string) => {
          this.creditReport.set(this.parseList<unknown>(raw));
          this.reportFetched.set(true);
          this.integrationLoading.set(false);
        },
        error: () => {
          this.reportFetched.set(true);
          this.integrationLoading.set(false);
        },
      });
  }

  searchByNationalId(bureauId?: number): void {
    if (!bureauId || !this.nationalId) return;
    this.integrationLoading.set(true);
    this.creditReport.set([]);
    this.reportFetched.set(false);
    this.integrationService
      .postCreditBureauIntegrationSaveCreditReport(bureauId, this.nationalId)
      .subscribe({
        next: (raw: string) => {
          this.creditReport.set(this.parseList<unknown>(raw));
          this.reportFetched.set(true);
          this.integrationLoading.set(false);
        },
        error: () => {
          this.reportFetched.set(true);
          this.integrationLoading.set(false);
        },
      });
  }

  private parseList<T>(raw: string): T[] {
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
}
