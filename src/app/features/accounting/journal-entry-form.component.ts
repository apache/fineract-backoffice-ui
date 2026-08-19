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

import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  JournalEntriesService,
  JournalEntryCommand,
  SingleDebitOrCreditEntryCommand,
  GeneralLedgerAccountService,
  GetGLAccountsResponse,
  OfficesService,
  GetOfficesResponse,
  CurrencyService,
  CurrencyConfigurationData,
  CurrencyData,
} from '../../api';
import { HelpIconComponent } from '../../shared';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';
import { toIsoDate } from '../../core/utils/date-formatter';

/**
 * Component for creating manual accounting journal entries.
 *
 * Supports multi-row debit and credit entries with account selection.
 */
@Component({
  selector: 'app-journal-entry-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    HelpIconComponent,
    IonIcon,
    IonButton,
    IonSpinner,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            Add Journal Entry
            <app-help-icon [helpTextKey]="'HELP.JOURNAL_ENTRIES_DESC'"></app-help-icon>
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #entryForm="ngForm" (ngSubmit)="onSubmit()" class="journal-entry-form">
            <div class="form-grid">
              <!-- Office -->
              <ion-item fill="outline">
                <ion-label position="stacked">Office</ion-label>
                <ion-select
                  aria-label="Office"
                  interface="popover"
                  name="officeId"
                  [(ngModel)]="command.officeId"
                  required
                >
                  @for (office of offices(); track office.id) {
                    <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <!-- Currency -->
              <ion-item fill="outline">
                <ion-label position="stacked">Currency</ion-label>
                <ion-select
                  aria-label="Currency"
                  interface="popover"
                  name="currencyCode"
                  [(ngModel)]="command.currencyCode"
                  required
                >
                  @for (currency of currencies(); track currency.code) {
                    <ion-select-option [value]="currency.code">{{
                      currency.name
                    }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <!-- Transaction Date -->
              <ion-item fill="outline">
                <ion-label position="stacked">Transaction Date</ion-label>
                <ion-datetime-button datetime="transactionDate-picker"></ion-datetime-button>
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="transactionDate-picker"
                      data-testid="transactionDate-picker"
                      presentation="date"
                      name="transactionDate"
                      [(ngModel)]="transactionDate"
                      required
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>

              <!-- Reference Number -->
              <ion-item fill="outline">
                <ion-label position="stacked">Reference Number</ion-label>
                <ion-input
                  aria-label="Reference Number"
                  name="referenceNumber"
                  [(ngModel)]="command.referenceNumber"
                ></ion-input>
              </ion-item>
            </div>

            <div class="entries-section">
              <h3>Debits</h3>
              @for (debit of debits; track $index) {
                <div class="entry-row">
                  <ion-item fill="outline" class="account-field">
                    <ion-label position="stacked">Account</ion-label>
                    <ion-select
                      aria-label="Account"
                      interface="popover"
                      name="debitAccount{{ $index }}"
                      [(ngModel)]="debit.glAccountId"
                      required
                    >
                      @for (account of glAccounts(); track account.id) {
                        <ion-select-option [value]="account.id"
                          >{{ account.name }} ({{ account.glCode }})</ion-select-option
                        >
                      }
                    </ion-select>
                  </ion-item>
                  <ion-item fill="outline" class="amount-field">
                    <ion-label position="stacked">Amount</ion-label>
                    <ion-input
                      aria-label="Amount"
                      type="number"
                      name="debitAmount{{ $index }}"
                      [(ngModel)]="debit.amount"
                      required
                    ></ion-input>
                  </ion-item>
                  <ion-button
                    fill="clear"
                    color="danger"
                    type="button"
                    (click)="removeDebit($index)"
                    [disabled]="debits.length === 1"
                    [attr.aria-label]="'JOURNAL_ENTRIES.REMOVE_DEBIT' | translate"
                  >
                    <ion-icon name="trash-outline"></ion-icon>
                  </ion-button>
                </div>
              }
              <ion-button fill="clear" color="primary" type="button" (click)="addDebit()">
                <ion-icon name="add-outline"></ion-icon> Add Debit
              </ion-button>
            </div>

            <div class="entries-section">
              <h3>Credits</h3>
              @for (credit of credits; track $index) {
                <div class="entry-row">
                  <ion-item fill="outline" class="account-field">
                    <ion-label position="stacked">Account</ion-label>
                    <ion-select
                      aria-label="Account"
                      interface="popover"
                      name="creditAccount{{ $index }}"
                      [(ngModel)]="credit.glAccountId"
                      required
                    >
                      @for (account of glAccounts(); track account.id) {
                        <ion-select-option [value]="account.id"
                          >{{ account.name }} ({{ account.glCode }})</ion-select-option
                        >
                      }
                    </ion-select>
                  </ion-item>
                  <ion-item fill="outline" class="amount-field">
                    <ion-label position="stacked">Amount</ion-label>
                    <ion-input
                      aria-label="Amount"
                      type="number"
                      name="creditAmount{{ $index }}"
                      [(ngModel)]="credit.amount"
                      required
                    ></ion-input>
                  </ion-item>
                  <ion-button
                    fill="clear"
                    color="danger"
                    type="button"
                    (click)="removeCredit($index)"
                    [disabled]="credits.length === 1"
                    [attr.aria-label]="'JOURNAL_ENTRIES.REMOVE_CREDIT' | translate"
                  >
                    <ion-icon name="trash-outline"></ion-icon>
                  </ion-button>
                </div>
              }
              <ion-button fill="clear" color="primary" type="button" (click)="addCredit()">
                <ion-icon name="add-outline"></ion-icon> Add Credit
              </ion-button>
            </div>

            <!-- Comments -->
            <ion-item fill="outline" class="full-width">
              <ion-label position="stacked">Comments</ion-label>
              <ion-textarea
                aria-label="Comments"
                name="comments"
                [(ngModel)]="command.comments"
                rows="3"
              ></ion-textarea>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                Cancel
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="entryForm.invalid || isSaving() || !isBalanced()"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  Saving...
                } @else {
                  Save
                }
              </ion-button>
            </div>
            @if (!isBalanced()) {
              <p class="error-text">Total debits must equal total credits.</p>
            }
          </form>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 24px;
        max-width: 1000px;
        margin: 0 auto;
      }
      .journal-entry-form {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
      .entries-section {
        border: 1px solid #e0e0e0;
        padding: 16px;
        border-radius: 8px;
      }
      .entry-row {
        display: flex;
        gap: 16px;
        align-items: center;
        margin-bottom: 8px;
      }
      .account-field {
        flex: 2;
      }
      .amount-field {
        flex: 1;
      }
      .full-width {
        width: 100%;
      }
      .error-text {
        color: #f44336;
        text-align: right;
        margin-top: -16px;
      }
    `,
  ],
})
export class JournalEntryFormComponent implements OnInit {
  private readonly journalService = inject(JournalEntriesService);
  private readonly glAccountService = inject(GeneralLedgerAccountService);
  private readonly officeService = inject(OfficesService);
  private readonly currencyService = inject(CurrencyService);
  private readonly router = inject(Router);

  readonly offices = signal<GetOfficesResponse[]>([]);
  readonly currencies = signal<CurrencyData[]>([]);
  readonly glAccounts = signal<GetGLAccountsResponse[]>([]);

  command: JournalEntryCommand = {
    officeId: undefined,
    currencyCode: '',
    comments: '',
    referenceNumber: '',
  };

  transactionDate = toIsoDate(new Date());
  debits: SingleDebitOrCreditEntryCommand[] = [{ glAccountId: undefined, amount: 0 }];
  credits: SingleDebitOrCreditEntryCommand[] = [{ glAccountId: undefined, amount: 0 }];

  readonly isSaving = signal(false);

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    this.officeService
      .getOffices()
      .subscribe((data: GetOfficesResponse[]) => this.offices.set(data));
    this.currencyService.getCurrencies().subscribe((data: CurrencyConfigurationData) => {
      this.currencies.set(
        data.selectedCurrencyOptions ? Array.from(data.selectedCurrencyOptions) : [],
      );
    });
    this.glAccountService
      .getGlaccounts()
      .subscribe((data: GetGLAccountsResponse[]) => this.glAccounts.set(data));
  }

  addDebit() {
    this.debits.push({ glAccountId: undefined, amount: 0 });
  }

  removeDebit(index: number) {
    this.debits.splice(index, 1);
  }

  addCredit() {
    this.credits.push({ glAccountId: undefined, amount: 0 });
  }

  removeCredit(index: number) {
    this.credits.splice(index, 1);
  }

  isBalanced(): boolean {
    const totalDebits = this.debits.reduce((sum, d) => sum + (d.amount || 0), 0);
    const totalCredits = this.credits.reduce((sum, c) => sum + (c.amount || 0), 0);
    return Math.abs(totalDebits - totalCredits) < 0.001 && totalDebits > 0;
  }

  onSubmit() {
    this.isSaving.set(true);

    const formattedDate = toIsoDate(this.transactionDate);

    this.command.transactionDate = formattedDate;
    this.command.dateFormat = 'yyyy-MM-dd';
    this.command.locale = 'en';
    this.command.debits = this.debits;
    this.command.credits = this.credits;

    this.journalService.postJournalentries(undefined, this.command).subscribe({
      next: () => this.router.navigate(['/accounting/journal-entries']),
      error: () => this.isSaving.set(false),
    });
  }

  onCancel() {
    this.router.navigate(['/accounting/journal-entries']);
  }
}
