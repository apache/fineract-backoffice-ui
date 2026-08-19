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
import { Router } from '@angular/router';
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
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';

import {
  AccountingRuleData,
  AccountingRulesService,
  CurrencyConfigurationData,
  CurrencyService,
  JournalEntriesService,
  PaymentTypeService,
} from '../../api';
import { I18N, TranslatePipe } from '../../core/adapters';
import { NotificationService } from '../../core/services/notification.service';
import { HelpIconComponent } from '../../shared';
import {
  FINERACT_DATE_FORMAT,
  formatDateToFineract,
  toIsoDate,
} from '../../core/utils/date-formatter';

/**
 * Posting a journal entry from a saved accounting rule.
 *
 * A rule already names the accounts a recurring posting touches, so the operator supplies only the
 * amount and the date. That is the whole point of the screen: the postings a branch makes every
 * day are the ones most worth protecting from a mistyped account code.
 *
 * The rule is applied on this side rather than sent as an identifier. `accountingRuleId` is
 * declared in the API specification but the running platform refuses it —
 * *"The parameter accountingRuleId is not supported"* — so the accounts it names are expanded into
 * the debit and credit lines the journal entry endpoint does accept. The posted entry is therefore
 * identical to one made by hand, which is also what makes it reversible from the entry screen.
 */
@Component({
  selector: 'app-frequent-postings',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
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
    IonTextarea,
    IonButton,
    IonSpinner,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ 'FREQUENT_POSTINGS.TITLE' | appTranslate }}
            <app-help-icon [helpTextKey]="'HELP.FREQUENT_POSTINGS_DESC'"></app-help-icon>
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          @if (rules().length === 0) {
            <p data-testid="frequent-postings-empty">
              {{ 'FREQUENT_POSTINGS.NO_RULES' | appTranslate }}
            </p>
          } @else {
            <div class="form-grid">
              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'FREQUENT_POSTINGS.RULE' | appTranslate
                }}</ion-label>
                <ion-select
                  interface="popover"
                  name="ruleId"
                  data-testid="frequent-posting-rule"
                  [attr.aria-label]="'FREQUENT_POSTINGS.RULE' | appTranslate"
                  [(ngModel)]="ruleId"
                >
                  @for (rule of rules(); track rule.id) {
                    <ion-select-option [value]="rule.id">{{ rule.name }}</ion-select-option>
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
                  data-testid="frequent-posting-currency"
                  [attr.aria-label]="'JOURNAL_ENTRIES.CURRENCY' | appTranslate"
                  [(ngModel)]="currencyCode"
                >
                  @for (currency of currencies(); track currency.code) {
                    <ion-select-option [value]="currency.code">{{
                      currency.name
                    }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.AMOUNT' | appTranslate }}</ion-label>
                <ion-input
                  type="number"
                  name="amount"
                  data-testid="frequent-posting-amount"
                  [attr.aria-label]="'COMMON.AMOUNT' | appTranslate"
                  [(ngModel)]="amount"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'JOURNAL_ENTRIES.TRANSACTION_DATE' | appTranslate
                }}</ion-label>
                <ion-datetime-button datetime="frequent-posting-date"></ion-datetime-button>
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="frequent-posting-date"
                      data-testid="frequent-posting-date"
                      presentation="date"
                      name="transactionDate"
                      [(ngModel)]="transactionDate"
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{
                  'JOURNAL_ENTRIES.PAYMENT_TYPE' | appTranslate
                }}</ion-label>
                <ion-select
                  interface="popover"
                  name="paymentTypeId"
                  data-testid="frequent-posting-payment-type"
                  [attr.aria-label]="'JOURNAL_ENTRIES.PAYMENT_TYPE' | appTranslate"
                  [(ngModel)]="paymentTypeId"
                >
                  @for (paymentType of paymentTypes(); track paymentType.id) {
                    <ion-select-option [value]="paymentType.id">{{
                      paymentType.name
                    }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.COMMENT' | appTranslate }}</ion-label>
                <ion-textarea
                  name="comments"
                  data-testid="frequent-posting-comments"
                  [attr.aria-label]="'COMMON.COMMENT' | appTranslate"
                  [(ngModel)]="comments"
                ></ion-textarea>
              </ion-item>
            </div>

            @if (selectedRule; as rule) {
              <div class="rule-preview" data-testid="frequent-posting-preview">
                <h2>{{ 'FREQUENT_POSTINGS.WILL_POST' | appTranslate }}</h2>
                <p>
                  <strong>{{ 'JOURNAL_ENTRIES.DEBITS' | appTranslate }}:</strong>
                  {{ accountNames(rule.debitAccounts) }}
                </p>
                <p>
                  <strong>{{ 'JOURNAL_ENTRIES.CREDITS' | appTranslate }}:</strong>
                  {{ accountNames(rule.creditAccounts) }}
                </p>
                <p class="office">
                  <strong>{{ 'JOURNAL_ENTRIES.OFFICE' | appTranslate }}:</strong>
                  {{ rule.officeName }}
                </p>
              </div>
            }

            <ion-button
              data-testid="frequent-posting-submit"
              [disabled]="!canSubmit || isSaving()"
              (click)="onSubmit()"
            >
              @if (isSaving()) {
                <ion-spinner name="dots"></ion-spinner>
              } @else {
                {{ 'FREQUENT_POSTINGS.POST' | appTranslate }}
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
      .rule-preview {
        padding: 12px;
        margin-bottom: 16px;
        border-radius: 4px;
        background: var(--ion-color-light);
      }
      .rule-preview h2 {
        font-size: 1rem;
        margin: 0 0 8px;
      }
      .rule-preview p {
        margin: 4px 0;
      }
    `,
  ],
})
export class FrequentPostingsComponent implements OnInit {
  private readonly rulesService = inject(AccountingRulesService);
  private readonly journalEntriesService = inject(JournalEntriesService);
  private readonly currencyService = inject(CurrencyService);
  private readonly paymentTypeService = inject(PaymentTypeService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18N);

  readonly rules = signal<AccountingRuleData[]>([]);
  readonly currencies = signal<{ code?: string; name?: string }[]>([]);
  readonly paymentTypes = signal<{ id?: number; name?: string }[]>([]);
  readonly isSaving = signal(false);

  ruleId: number | undefined;
  currencyCode: string | undefined;
  amount: number | null = null;
  transactionDate: string = toIsoDate(new Date());
  paymentTypeId: number | undefined;
  comments = '';

  /**
   * Plain getters rather than computed signals: these read `ngModel` fields, and every edit of one
   * arrives as a template event, which marks this view dirty on its own. A mirrored signal would
   * add a second copy of the same state and one more place for the two to disagree.
   */
  get selectedRule(): AccountingRuleData | undefined {
    return this.rules().find((rule) => rule.id === this.ruleId);
  }

  get canSubmit(): boolean {
    const rule = this.selectedRule;
    return (
      !!rule &&
      !!this.currencyCode &&
      Number(this.amount) > 0 &&
      (rule.debitAccounts?.length ?? 0) > 0 &&
      (rule.creditAccounts?.length ?? 0) > 0
    );
  }

  ngOnInit(): void {
    this.rulesService.getAccountingrules().subscribe({
      next: (rules: AccountingRuleData[]) => this.rules.set(rules),
      error: () => this.rules.set([]),
    });
    this.currencyService.getCurrencies().subscribe({
      next: (data: CurrencyConfigurationData) =>
        this.currencies.set(
          data.selectedCurrencyOptions ? Array.from(data.selectedCurrencyOptions) : [],
        ),
      error: () => this.currencies.set([]),
    });
    this.paymentTypeService.getPaymenttypes().subscribe({
      next: (types) => this.paymentTypes.set(types ?? []),
      error: () => this.paymentTypes.set([]),
    });
  }

  accountNames(accounts: { name?: string; glCode?: string }[] | undefined): string {
    return (accounts ?? []).map((account) => `${account.glCode} — ${account.name}`).join(', ');
  }

  onSubmit(): void {
    const rule = this.selectedRule;
    const amount = Number(this.amount);
    if (!rule || !this.currencyCode || amount <= 0) {
      return;
    }

    // One rule can name several accounts on a side. Splitting evenly would invent a policy the
    // rule does not state, so the whole amount goes to each named account only when there is
    // exactly one; otherwise the operator is sent to the full journal entry form.
    const debits = rule.debitAccounts ?? [];
    const credits = rule.creditAccounts ?? [];
    if (debits.length !== 1 || credits.length !== 1) {
      this.notifications.error(this.i18n.translate('FREQUENT_POSTINGS.MULTI_ACCOUNT_RULE'));
      return;
    }

    this.isSaving.set(true);
    this.journalEntriesService
      .postJournalentries(undefined, {
        officeId: rule.officeId,
        currencyCode: this.currencyCode,
        transactionDate: formatDateToFineract(this.transactionDate),
        dateFormat: FINERACT_DATE_FORMAT,
        locale: 'en',
        amount,
        comments: this.comments || undefined,
        paymentTypeId: this.paymentTypeId,
        debits: [{ glAccountId: debits[0].id, amount }],
        credits: [{ glAccountId: credits[0].id, amount }],
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.notifications.success(this.i18n.translate('FREQUENT_POSTINGS.POSTED'));
          void this.router.navigate(['/accounting/journal-entries']);
        },
        error: () => this.isSaving.set(false),
      });
  }
}
