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
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { DatePipe } from '@angular/common';
import {
  BulkImportService,
  ClientService,
  LoansService,
  SavingsAccountService,
  JournalEntriesService,
} from '../../../api';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../../shared';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { DOWNLOAD } from '../../../core/adapters';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-bulk-import',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    DataTableComponent,
    CellTemplateDirective,
    DatePipe,
    IonIcon,
    IonButton,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    TooltipDirective,
  ],
  template: `
    <div class="bulk-import-container">
      <ion-card class="import-config-card">
        <ion-card-header>
          <ion-card-title>{{ 'SYSTEM.BULK_IMPORT' | translate }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="config-row">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'SYSTEM.ENTITY_TYPE' | translate }}</ion-label>
              <ion-select
                [attr.aria-label]="'SYSTEM.ENTITY_TYPE' | translate"
                interface="popover"
                [(ngModel)]="selectedEntity"
                (ionChange)="onEntityChange()"
              >
                @for (entity of entityTypes; track entity.value) {
                  <ion-select-option [value]="entity.value">{{
                    entity.label | translate
                  }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <div class="actions">
              <ion-button fill="outline" color="primary" (click)="onDownloadTemplate()">
                <ion-icon name="download-outline"></ion-icon>
                {{ 'SYSTEM.DOWNLOAD_TEMPLATE' | translate }}
              </ion-button>

              <ion-button color="primary" (click)="fileInput.click()">
                <ion-icon name="cloud-upload-outline"></ion-icon>
                {{ 'SYSTEM.UPLOAD_CSV' | translate }}
              </ion-button>
              <input
                #fileInput
                type="file"
                (change)="onFileSelected($event)"
                style="display: none"
              />
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <app-data-table
        [title]="'SYSTEM.IMPORT_HISTORY' | translate"
        [columns]="columns"
        [data]="importHistory()"
        [isLoading]="isLoading()"
        [localLogic]="true"
      >
        <ng-template appCellTemplate="importTime" let-row>
          {{ row['importTime'] | date: 'medium' }}
        </ng-template>

        <ng-template appCellTemplate="actions" let-row>
          <ion-button
            fill="clear"
            color="primary"
            (click)="onDownloadResult(row['importDocumentId'])"
            [attr.aria-label]="'SYSTEM.DOWNLOAD_RESULT' | translate"
            [appTooltip]="'SYSTEM.DOWNLOAD_RESULT' | translate"
          >
            <ion-icon name="download-outline"></ion-icon>
          </ion-button>
        </ng-template>
      </app-data-table>
    </div>
  `,
  styles: [
    `
      .bulk-import-container {
        padding: 24px;
      }
      .import-config-card {
        margin: 24px;
      }
      .config-row {
        display: flex;
        align-items: center;
        gap: 24px;
        padding-top: 16px;
      }
      .actions {
        display: flex;
        gap: 12px;
      }
      ion-item {
        min-width: 250px;
      }
    `,
  ],
})
export class BulkImportComponent implements OnInit {
  private readonly bulkImportService = inject(BulkImportService);
  private readonly download = inject(DOWNLOAD);
  private readonly clientService = inject(ClientService);
  private readonly loansService = inject(LoansService);
  private readonly savingsService = inject(SavingsAccountService);
  private readonly journalEntriesService = inject(JournalEntriesService);

  entityTypes = [
    { label: 'nav.clients', value: 'clients' },
    { label: 'nav.loans', value: 'loans' },
    { label: 'nav.savingsAccounts', value: 'savingsaccounts' },
    { label: 'nav.chartOfAccounts', value: 'glaccounts' },
  ];

  selectedEntity = 'clients';
  readonly importHistory = signal<Record<string, unknown>[]>([]);
  readonly isLoading = signal<boolean>(false);

  private readonly dateFormat = 'dd MMMM yyyy';

  columns: ColumnDef[] = [
    { key: 'name', label: 'COMMON.NAME', sortable: true },
    { key: 'importTime', label: 'SYSTEM.IMPORT_TIME', sortable: true },
    { key: 'createdBy', label: 'SYSTEM.CREATED_BY', sortable: true },
    { key: 'status', label: 'COMMON.STATUS', sortable: true },
    { key: 'actions', label: 'COMMON.ACTIONS' },
  ];

  ngOnInit(): void {
    this.loadImportHistory();
  }

  onEntityChange(): void {
    this.loadImportHistory();
  }

  loadImportHistory(): void {
    this.isLoading.set(true);
    this.bulkImportService.getImports(this.selectedEntity).subscribe({
      next: (data: unknown) => {
        const result = (typeof data === 'string' ? JSON.parse(data) : data) as Record<
          string,
          unknown
        >[];
        this.importHistory.set(result || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load import history', err);
        this.isLoading.set(false);
      },
    });
  }

  onDownloadTemplate(): void {
    let template$: Observable<unknown> | undefined;

    switch (this.selectedEntity) {
      case 'clients':
        template$ = this.clientService.getClientsDownloadtemplate(
          undefined,
          undefined,
          undefined,
          this.dateFormat,
        );
        break;
      case 'loans':
        template$ = this.loansService.getLoansDownloadtemplate(
          undefined,
          undefined,
          this.dateFormat,
        );
        break;
      case 'savingsaccounts':
        template$ = this.savingsService.getSavingsaccountsDownloadtemplate(
          undefined,
          undefined,
          this.dateFormat,
        );
        break;
      case 'glaccounts':
        template$ = this.journalEntriesService.getJournalentriesDownloadtemplate(
          undefined,
          this.dateFormat,
        );
        break;
    }

    template$?.subscribe({
      next: (blob: unknown) => {
        this.download.save(blob as Blob, `${this.selectedEntity}_template.xls`);
      },
      error: (err: unknown) => console.error('Failed to download template', err),
    });
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      this.uploadFile(file);
    }
  }

  uploadFile(file: File): void {
    this.isLoading.set(true);
    let upload$: Observable<unknown> | undefined;

    switch (this.selectedEntity) {
      case 'clients':
        upload$ = this.clientService.postClientsUploadtemplate(
          undefined,
          this.dateFormat,
          'en',
          file,
        );
        break;
      case 'loans':
        upload$ = this.loansService.postLoansUploadtemplate(this.dateFormat, 'en', file);
        break;
      case 'savingsaccounts':
        upload$ = this.savingsService.postSavingsaccountsUploadtemplate(
          this.dateFormat,
          'en',
          file,
        );
        break;
      case 'glaccounts':
        upload$ = this.journalEntriesService.postJournalentriesUploadtemplate(
          this.dateFormat,
          'en',
          file,
        );
        break;
    }

    if (upload$) {
      upload$.subscribe({
        next: () => {
          this.loadImportHistory();
        },
        error: (err: unknown) => {
          console.error('Upload failed', err);
          this.isLoading.set(false);
        },
      });
    }
  }

  onDownloadResult(id: string): void {
    this.bulkImportService
      .getImportsDownloadOutputTemplate(Number(id))
      .subscribe((blob: unknown) => {
        this.download.save(blob as Blob, `import_result_${id}.xlsx`);
      });
  }
}
