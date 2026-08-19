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

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

import {
  CurrencyConfigurationData,
  CurrencyService,
  GetOfficesResponse,
  JournalEntriesService,
  OfficesService,
  SingleDebitOrCreditEntryCommand,
} from '../../api';
import { I18N, TranslatePipe } from '../../core/adapters';
import { NotificationService } from '../../core/services/notification.service';
import { HelpIconComponent } from '../../shared';
import { FINERACT_DATE_FORMAT, formatDateToFineract } from '../../core/utils/date-formatter';

/** One ledger account with the balance the user is carrying into this application. */
interface OpeningBalanceRow {
  glAccountId: number;
  glAccountName: string;
  glAccountCode: string;
  accountType: string;
  debit: number | null;
  credit: number | null;
}

/** The shape `GET /journalentries/openingbalance` answers with. */
interface OpeningBalanceTemplate {
  officeId?: number;
  officeName?: string;
  transactionDate?: number[];
  contraAccount?: { id?: number; name?: string; glCode?: string };
  assetAccountOpeningBalances?: TemplateAccount[];
  liabityAccountOpeningBalances?: TemplateAccount[];
  incomeAccountOpeningBalances?: TemplateAccount[];
  equityAccountOpeningBalances?: TemplateAccount[];
  expenseAccountOpeningBalances?: TemplateAccount[];
}

interface TemplateAccount {
  glAccountId?: number;
  glAccountName?: string;
  glAccountCode?: string;
  openingBalance?: number;
}

/**
 * Carrying an existing ledger into this application.
 *
 * Fineract will only accept opening balances while the office's ledger is still empty — once any
 * journal entry is posted the command is refused with a domain rule, which this screen surfaces as
 * written rather than as a generic failure, because it tells the user something true and final.
 *
 * The screen also depends on financial activity 300 (opening-balances contra) being mapped. When
 * it is not, the platform answers 404 naming that activity, and the user is pointed at the
 * financial activity mappings screen instead of being shown an empty form.
 *
 * Each account takes a debit *and* a credit column rather than one signed amount: the sides must
 * balance for the platform to accept them, and asking for the two sides separately is how an
 * accountant reads a trial balance.
 */
@Component({
  selector: 'app-opening-balances',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    DecimalPipe,
    HelpIconComponent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonInput,
    IonButton,
    IonSpinner,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ 'OPENING_BALANCES.TITLE' | appTranslate }}
            <app-help-icon [helpTextKey]="'HELP.OPENING_BALANCES_DESC'"></app-help-icon>
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <div class="form-grid">
            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'JOURNAL_ENTRIES.OFFICE' | appTranslate
              }}</ion-label>
              <ion-select
                interface="popover"
                name="officeId"
                data-testid="opening-balances-office"
                [attr.aria-label]="'JOURNAL_ENTRIES.OFFICE' | appTranslate"
                [(ngModel)]="officeId"
                (ngModelChange)="onSelectionChange()"
              >
                @for (office of offices(); track office.id) {
                  <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>

            <ion-item fill="outline">
              <ion-label position="stacked">{{
                'JOURNAL_ENTRIES.CURRENCY' | appTranslate
              }}</ion-label>
              <ion-select
                interface="popover"
                name="currencyCode"
                data-testid="opening-balances-currency"
                [attr.aria-label]="'JOURNAL_ENTRIES.CURRENCY' | appTranslate"
                [(ngModel)]="currencyCode"
                (ngModelChange)="onSelectionChange()"
              >
                @for (currency of currencies(); track currency.code) {
                  <ion-select-option [value]="currency.code">{{ currency.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>
          </div>

          @if (isLoading()) {
            <ion-spinner data-testid="opening-balances-loading"></ion-spinner>
          }

          @if (unavailableReason(); as reason) {
            <p class="error" role="alert" data-testid="opening-balances-unavailable">
              {{ reason }}
            </p>
          }

          @if (rows().length > 0) {
            <table class="balances-table" data-testid="opening-balances-table">
              <thead>
                <tr>
                  <th>{{ 'COMMON.TYPE' | appTranslate }}</th>
                  <th>{{ 'JOURNAL_ENTRIES.ACCOUNT' | appTranslate }}</th>
                  <th>{{ 'JOURNAL_ENTRIES.DEBITS' | appTranslate }}</th>
                  <th>{{ 'JOURNAL_ENTRIES.CREDITS' | appTranslate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.glAccountId) {
                  <tr>
                    <td>{{ row.accountType }}</td>
                    <td>{{ row.glAccountCode }} — {{ row.glAccountName }}</td>
                    <td>
                      <ion-input
                        type="number"
                        [attr.aria-label]="row.glAccountName + ' debit'"
                        [attr.data-testid]="'opening-balance-debit-' + row.glAccountId"
                        [(ngModel)]="row.debit"
                        [name]="'debit-' + row.glAccountId"
                        (ngModelChange)="recalculate()"
                      ></ion-input>
                    </td>
                    <td>
                      <ion-input
                        type="number"
                        [attr.aria-label]="row.glAccountName + ' credit'"
                        [attr.data-testid]="'opening-balance-credit-' + row.glAccountId"
                        [(ngModel)]="row.credit"
                        [name]="'credit-' + row.glAccountId"
                        (ngModelChange)="recalculate()"
                      ></ion-input>
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2">{{ 'COMMON.TOTAL' | appTranslate }}</td>
                  <td data-testid="opening-balances-debit-total">
                    {{ debitTotal() | number: '1.2-2' }}
                  </td>
                  <td data-testid="opening-balances-credit-total">
                    {{ creditTotal() | number: '1.2-2' }}
                  </td>
                </tr>
              </tfoot>
            </table>

            @if (!isBalanced()) {
              <p class="error" role="alert" data-testid="opening-balances-unbalanced">
                {{ 'JOURNAL_ENTRIES.BALANCED_ERROR' | appTranslate }}
              </p>
            }

            <ion-button
              data-testid="opening-balances-save"
              [disabled]="!isBalanced() || isSaving()"
              (click)="onSave()"
            >
              @if (isSaving()) {
                <ion-spinner name="dots"></ion-spinner>
              } @else {
                {{ 'COMMON.SAVE' | appTranslate }}
              }
            </ion-button>
          }
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
      }
      .balances-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
      }
      .balances-table th,
      .balances-table td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid var(--ion-color-light-shade);
      }
      .balances-table tfoot td {
        font-weight: 600;
      }
      .error {
        color: var(--ion-color-danger);
      }
    `,
  ],
})
export class OpeningBalancesComponent implements OnInit {
  private readonly journalEntriesService = inject(JournalEntriesService);
  private readonly officeService = inject(OfficesService);
  private readonly currencyService = inject(CurrencyService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  readonly offices = signal<GetOfficesResponse[]>([]);
  readonly currencies = signal<{ code?: string; name?: string }[]>([]);
  readonly rows = signal<OpeningBalanceRow[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly unavailableReason = signal<string | null>(null);

  /**
   * The date the platform itself proposes for the opening entry, echoed back on save. Deriving
   * "today" in the browser would be the tenant-timezone bug all over again: the ledger date has to
   * be the backend's, not the operator's.
   */
  private readonly templateDate = signal<number[] | null>(null);

  private readonly totals = signal({ debit: 0, credit: 0 });
  readonly debitTotal = computed(() => this.totals().debit);
  readonly creditTotal = computed(() => this.totals().credit);
  readonly isBalanced = computed(
    () => this.debitTotal() > 0 && this.debitTotal() === this.creditTotal(),
  );

  officeId: number | undefined;
  currencyCode: string | undefined;

  ngOnInit(): void {
    this.officeService.getOffices().subscribe({
      next: (offices: GetOfficesResponse[]) => this.offices.set(offices),
      error: () => this.offices.set([]),
    });
    this.currencyService.getCurrencies().subscribe({
      next: (data: CurrencyConfigurationData) =>
        this.currencies.set(
          data.selectedCurrencyOptions ? Array.from(data.selectedCurrencyOptions) : [],
        ),
      error: () => this.currencies.set([]),
    });
  }

  onSelectionChange(): void {
    if (this.officeId === undefined || !this.currencyCode) {
      return;
    }
    this.loadTemplate(this.officeId, this.currencyCode);
  }

  private loadTemplate(officeId: number, currencyCode: string): void {
    this.isLoading.set(true);
    this.unavailableReason.set(null);
    this.rows.set([]);

    this.journalEntriesService.getJournalentriesOpeningbalance(officeId, currencyCode).subscribe({
      next: (template) => {
        const parsed = template as unknown as OpeningBalanceTemplate;
        this.templateDate.set(parsed.transactionDate ?? null);
        this.rows.set(this.toRows(parsed));
        this.recalculate();
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        // A 404 here does not mean "no such screen": Fineract answers it when financial activity
        // 300 has no GL account mapped, which is a setup step the user can go and complete.
        this.unavailableReason.set(
          error.status === 404
            ? this.i18n.translate('OPENING_BALANCES.CONTRA_NOT_MAPPED')
            : this.i18n.translate('OPENING_BALANCES.LOAD_FAILED'),
        );
        this.isLoading.set(false);
      },
    });
  }

  private toRows(template: OpeningBalanceTemplate): OpeningBalanceRow[] {
    const groups: [string, TemplateAccount[] | undefined][] = [
      ['ASSET', template.assetAccountOpeningBalances],
      // Spelled as the platform spells it; renaming it here would silently drop the section.
      ['LIABILITY', template.liabityAccountOpeningBalances],
      ['EQUITY', template.equityAccountOpeningBalances],
      ['INCOME', template.incomeAccountOpeningBalances],
      ['EXPENSE', template.expenseAccountOpeningBalances],
    ];

    return groups.flatMap(([accountType, accounts]) =>
      (accounts ?? []).map((account) => ({
        glAccountId: account.glAccountId as number,
        glAccountName: account.glAccountName ?? '',
        glAccountCode: account.glAccountCode ?? '',
        accountType,
        debit: null,
        credit: null,
      })),
    );
  }

  recalculate(): void {
    const rows = this.rows();
    this.totals.set({
      debit: rows.reduce((sum, row) => sum + (Number(row.debit) || 0), 0),
      credit: rows.reduce((sum, row) => sum + (Number(row.credit) || 0), 0),
    });
  }

  onSave(): void {
    if (this.officeId === undefined || !this.currencyCode || !this.isBalanced()) {
      return;
    }

    const debits: SingleDebitOrCreditEntryCommand[] = [];
    const credits: SingleDebitOrCreditEntryCommand[] = [];
    for (const row of this.rows()) {
      if (Number(row.debit) > 0) {
        debits.push({ glAccountId: row.glAccountId, amount: Number(row.debit) });
      }
      if (Number(row.credit) > 0) {
        credits.push({ glAccountId: row.glAccountId, amount: Number(row.credit) });
      }
    }

    this.isSaving.set(true);
    this.journalEntriesService
      .postJournalentries('defineOpeningBalance', {
        officeId: this.officeId,
        currencyCode: this.currencyCode,
        transactionDate: formatDateToFineract(this.templateDate()),
        dateFormat: FINERACT_DATE_FORMAT,
        locale: 'en',
        debits,
        credits,
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.notifications.success(this.i18n.translate('OPENING_BALANCES.SAVED'));
        },
        error: () => this.isSaving.set(false),
      });
  }
}
