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
import { Observable } from 'rxjs';
import { DatePipe } from '@angular/common';
import {
  BulkImportService,
  CentersService,
  ClientService,
  FixedDepositAccountService,
  GeneralLedgerAccountService,
  GroupsService,
  GuarantorsService,
  JournalEntriesService,
  LoansService,
  OfficesService,
  RecurringDepositAccountService,
  SavingsAccountService,
  ShareAccountService,
  StaffService,
  UsersService,
} from '../../../api';
import { DataTableComponent, ColumnDef, CellTemplateDirective } from '../../../shared';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { DOWNLOAD, TranslatePipe } from '../../../core/adapters';
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
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-bulk-import',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    DatePipe,
    IonIcon,
    IonButton,
    IonInput,
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
          <ion-card-title>{{ 'SYSTEM.BULK_IMPORT' | appTranslate }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="config-row">
            <ion-item fill="outline">
              <ion-label position="stacked">{{ 'SYSTEM.ENTITY_TYPE' | appTranslate }}</ion-label>
              <ion-select
                [attr.aria-label]="'SYSTEM.ENTITY_TYPE' | appTranslate"
                interface="popover"
                data-testid="bulk-import-entity-type"
                [(ngModel)]="selectedEntity"
                (ionChange)="onEntityChange()"
              >
                @for (entity of entityTypes; track entity.value) {
                  <ion-select-option [value]="entity.value">{{
                    entity.label | appTranslate
                  }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            @if (requiresLoanId()) {
              <div class="loan-id-field">
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'SYSTEM.BULK_IMPORT_LOAN_ID' | appTranslate
                  }}</ion-label>
                  <ion-input
                    type="number"
                    [attr.aria-label]="'SYSTEM.BULK_IMPORT_LOAN_ID' | appTranslate"
                    [(ngModel)]="guarantorLoanId"
                  ></ion-input>
                </ion-item>
                @if (!guarantorLoanId) {
                  <p class="loan-id-hint">
                    {{ 'SYSTEM.BULK_IMPORT_LOAN_ID_REQUIRED' | appTranslate }}
                  </p>
                }
              </div>
            }

            <div class="actions">
              <ion-button
                fill="outline"
                color="primary"
                [disabled]="requiresLoanId() && !guarantorLoanId"
                (click)="onDownloadTemplate()"
              >
                <ion-icon name="download-outline"></ion-icon>
                {{ 'SYSTEM.DOWNLOAD_TEMPLATE' | appTranslate }}
              </ion-button>

              <ion-button
                color="primary"
                [disabled]="requiresLoanId() && !guarantorLoanId"
                (click)="fileInput.click()"
              >
                <ion-icon name="cloud-upload-outline"></ion-icon>
                {{ 'SYSTEM.UPLOAD_CSV' | appTranslate }}
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
        [title]="'SYSTEM.IMPORT_HISTORY' | appTranslate"
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
            [attr.aria-label]="'SYSTEM.DOWNLOAD_RESULT' | appTranslate"
            [appTooltip]="'SYSTEM.DOWNLOAD_RESULT' | appTranslate"
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
      .loan-id-hint {
        color: var(--text-muted, #6b7280);
        font-size: 0.85rem;
        margin: 4px 0 0;
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
  private readonly officesService = inject(OfficesService);
  private readonly usersService = inject(UsersService);
  private readonly groupsService = inject(GroupsService);
  private readonly centersService = inject(CentersService);
  private readonly staffService = inject(StaffService);
  private readonly fixedDepositService = inject(FixedDepositAccountService);
  private readonly recurringDepositService = inject(RecurringDepositAccountService);
  private readonly shareAccountService = inject(ShareAccountService);
  private readonly guarantorsService = inject(GuarantorsService);
  private readonly glAccountService = inject(GeneralLedgerAccountService);

  /**
   * Mirrors web-app's `BulkImports` list (`organization/bulk-import/view-bulk-import/bulk-imports.ts`).
   * `glaccounts` used to call the journal-entries template by mistake — every other bulk-import
   * screen names its own resource in the `value`, so "Chart of Accounts" downloading the journal
   * entries file was a copy-paste of the wrong service, not a deliberate choice. `journalentries`
   * is its own, separate entry here, wired to the endpoint `glaccounts` was wrongly borrowing.
   */
  /**
   * `value` is this screen's own key — it selects the template and upload endpoints below.
   *
   * `importType` is what `GET /imports?entityType=` accepts, and it is *not* always the same
   * word: the platform answers 404 for `clients`, `savingsaccounts`, `glaccounts`,
   * `journalentries`, `recurringdepositaccounts`, `loanrepayments` and
   * `recurringdeposittransactions`, which is every entry that carries one here. Selecting any of
   * those left the import history empty with the 404 going only to the console. Where the two
   * agree, `importType` is omitted and `value` is used.
   */
  entityTypes: { label: string; value: string; importType?: string }[] = [
    { label: 'nav.clients', value: 'clients', importType: 'client' },
    { label: 'nav.loans', value: 'loans' },
    { label: 'nav.savingsAccounts', value: 'savingsaccounts', importType: 'savingsaccount' },
    { label: 'nav.chartOfAccounts', value: 'glaccounts', importType: 'chartofaccounts' },
    { label: 'nav.journalEntries', value: 'journalentries', importType: 'gljournalentries' },
    { label: 'nav.offices', value: 'offices' },
    { label: 'nav.users', value: 'users' },
    { label: 'nav.groups', value: 'groups' },
    { label: 'nav.centers', value: 'centers' },
    { label: 'nav.staff', value: 'staff' },
    { label: 'nav.fixedDeposits', value: 'fixeddepositaccounts' },
    {
      label: 'nav.recurringDeposits',
      value: 'recurringdepositaccounts',
      importType: 'recurringdeposits',
    },
    { label: 'nav.shares', value: 'shareaccounts' },
    {
      label: 'SYSTEM.BULK_IMPORT_LOAN_REPAYMENTS',
      value: 'loanrepayments',
      importType: 'loantransactions',
    },
    { label: 'SYSTEM.BULK_IMPORT_SAVINGS_TRANSACTIONS', value: 'savingstransactions' },
    { label: 'SYSTEM.BULK_IMPORT_FIXED_DEPOSIT_TRANSACTIONS', value: 'fixeddeposittransactions' },
    {
      label: 'SYSTEM.BULK_IMPORT_RECURRING_DEPOSIT_TRANSACTIONS',
      value: 'recurringdeposittransactions',
      importType: 'recurringdepositstransactions',
    },
    { label: 'SYSTEM.BULK_IMPORT_GUARANTORS', value: 'guarantors' },
  ];

  /** The word the platform knows the selected entity by, which is not always our own key. */
  private importEntityType(): string {
    const entity = this.entityTypes.find((candidate) => candidate.value === this.selectedEntity);
    return entity?.importType ?? this.selectedEntity;
  }

  /** Entity types whose template is scoped to one loan rather than to the whole tenant. */
  private readonly loanScopedEntities = new Set(['guarantors']);

  selectedEntity = 'clients';
  guarantorLoanId: number | null = null;
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
    this.guarantorLoanId = null;
    this.loadImportHistory();
  }

  requiresLoanId(): boolean {
    return this.loanScopedEntities.has(this.selectedEntity);
  }

  loadImportHistory(): void {
    this.isLoading.set(true);
    this.bulkImportService.getImports(this.importEntityType()).subscribe({
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
        template$ = this.glAccountService.getGlaccountsDownloadtemplate(this.dateFormat);
        break;
      case 'journalentries':
        template$ = this.journalEntriesService.getJournalentriesDownloadtemplate(
          undefined,
          this.dateFormat,
        );
        break;
      case 'offices':
        template$ = this.officesService.getOfficesDownloadtemplate(this.dateFormat);
        break;
      case 'users':
        template$ = this.usersService.getUsersDownloadtemplate(
          undefined,
          undefined,
          this.dateFormat,
        );
        break;
      case 'groups':
        template$ = this.groupsService.getGroupsDownloadtemplate(
          undefined,
          undefined,
          this.dateFormat,
        );
        break;
      case 'centers':
        template$ = this.centersService.getCentersDownloadtemplate(
          undefined,
          undefined,
          this.dateFormat,
        );
        break;
      case 'staff':
        template$ = this.staffService.getStaffDownloadtemplate(undefined, this.dateFormat);
        break;
      case 'fixeddepositaccounts':
        template$ = this.fixedDepositService.getFixeddepositaccountsDownloadtemplate(
          undefined,
          undefined,
          this.dateFormat,
        );
        break;
      case 'recurringdepositaccounts':
        template$ = this.recurringDepositService.getRecurringdepositaccountsDownloadtemplate(
          undefined,
          undefined,
          this.dateFormat,
        );
        break;
      case 'shareaccounts':
        template$ = this.shareAccountService.getAccountsTypeDownloadtemplate(
          'share',
          undefined,
          this.dateFormat,
        );
        break;
      case 'loanrepayments':
        template$ = this.loansService.getLoansRepaymentsDownloadtemplate(
          undefined,
          this.dateFormat,
        );
        break;
      case 'savingstransactions':
        template$ = this.savingsService.getSavingsaccountsTransactionsDownloadtemplate(
          undefined,
          this.dateFormat,
        );
        break;
      case 'fixeddeposittransactions':
        template$ = this.fixedDepositService.getFixeddepositaccountsTransactionDownloadtemplate(
          undefined,
          this.dateFormat,
        );
        break;
      case 'recurringdeposittransactions':
        template$ =
          this.recurringDepositService.getRecurringdepositaccountsTransactionsDownloadtemplate(
            undefined,
            this.dateFormat,
          );
        break;
      case 'guarantors':
        if (this.guarantorLoanId) {
          template$ = this.guarantorsService.getLoansLoanIdGuarantorsDownloadtemplate(
            this.guarantorLoanId,
            undefined,
            this.dateFormat,
          );
        }
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
        upload$ = this.glAccountService.postGlaccountsUploadtemplate(this.dateFormat, 'en', file);
        break;
      case 'journalentries':
        upload$ = this.journalEntriesService.postJournalentriesUploadtemplate(
          this.dateFormat,
          'en',
          file,
        );
        break;
      case 'offices':
        upload$ = this.officesService.postOfficesUploadtemplate(this.dateFormat, 'en', file);
        break;
      case 'users':
        upload$ = this.usersService.postUsersUploadtemplate(this.dateFormat, 'en', file);
        break;
      case 'groups':
        upload$ = this.groupsService.postGroupsUploadtemplate(this.dateFormat, 'en', file);
        break;
      case 'centers':
        upload$ = this.centersService.postCentersUploadtemplate(this.dateFormat, 'en', file);
        break;
      case 'staff':
        upload$ = this.staffService.postStaffUploadtemplate(this.dateFormat, 'en', file);
        break;
      case 'fixeddepositaccounts':
        upload$ = this.fixedDepositService.postFixeddepositaccountsUploadtemplate(
          this.dateFormat,
          'en',
          file,
        );
        break;
      case 'recurringdepositaccounts':
        upload$ = this.recurringDepositService.postRecurringdepositaccountsUploadtemplate(
          this.dateFormat,
          'en',
          file,
        );
        break;
      case 'shareaccounts':
        upload$ = this.shareAccountService.postAccountsTypeUploadtemplate(
          'share',
          this.dateFormat,
          'en',
          file,
        );
        break;
      case 'loanrepayments':
        upload$ = this.loansService.postLoansRepaymentsUploadtemplate(this.dateFormat, 'en', file);
        break;
      case 'savingstransactions':
        upload$ = this.savingsService.postSavingsaccountsTransactionsUploadtemplate(
          this.dateFormat,
          'en',
          file,
        );
        break;
      case 'fixeddeposittransactions':
        upload$ = this.fixedDepositService.postFixeddepositaccountsTransactionUploadtemplate(
          this.dateFormat,
          'en',
          file,
        );
        break;
      case 'recurringdeposittransactions':
        upload$ =
          this.recurringDepositService.postRecurringdepositaccountsTransactionsUploadtemplate(
            this.dateFormat,
            'en',
            file,
          );
        break;
      case 'guarantors':
        if (this.guarantorLoanId) {
          upload$ = this.guarantorsService.postLoansLoanIdGuarantorsUploadtemplate(
            this.guarantorLoanId,
            this.dateFormat,
            'en',
            file,
          );
        }
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
    } else {
      // No request went out — e.g. guarantors without a loan id yet — so nothing will ever
      // clear the loading flag the top of this method set.
      this.isLoading.set(false);
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
