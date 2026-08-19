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
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';

import { JournalEntriesService, JournalEntryTransactionItem } from '../../api';
import { I18N, TranslatePipe } from '../../core/adapters';
import { DialogService } from '../../core/services/dialog.service';
import { NotificationService } from '../../core/services/notification.service';
import { RequiresPermissionDirective } from '../../shared';

/**
 * One ledger transaction, and the only place it can be reversed.
 *
 * The list screen shows a row per journal *line*; a transaction is the set of lines sharing a
 * `transactionId`, and it only balances when read together. So the route takes the line the user
 * clicked and then loads its siblings, rather than showing a single debit with no counterpart.
 *
 * Reversal is a property of the whole transaction — `POST /journalentries/{transactionId}` with
 * `command=reverse` — and Fineract accepts it only for manual entries that have not already been
 * reversed. Both conditions are checked here so the control explains itself instead of failing at
 * the server; the platform is still the authority, and its refusal is surfaced verbatim.
 */
@Component({
  selector: 'app-journal-entry-view',
  standalone: true,
  imports: [
    TranslatePipe,
    DatePipe,
    DecimalPipe,
    RequiresPermissionDirective,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
  template: `
    <div class="view-container">
      @if (isLoading()) {
        <ion-spinner data-testid="journal-entry-loading"></ion-spinner>
      } @else if (entry(); as journalEntry) {
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              {{ 'JOURNAL_ENTRIES.TRANSACTION' | appTranslate }} {{ journalEntry.transactionId }}
              @if (isReversed()) {
                <span class="status-chip reversed" data-testid="journal-entry-reversed">
                  {{ 'JOURNAL_ENTRIES.REVERSED' | appTranslate }}
                </span>
              }
            </ion-card-title>
          </ion-card-header>

          <ion-card-content>
            <dl class="detail-grid">
              <dt>{{ 'JOURNAL_ENTRIES.OFFICE' | appTranslate }}</dt>
              <dd>{{ journalEntry.officeName }}</dd>

              <dt>{{ 'JOURNAL_ENTRIES.TRANSACTION_DATE' | appTranslate }}</dt>
              <dd>{{ journalEntry.transactionDate | date: 'mediumDate' }}</dd>

              <dt>{{ 'JOURNAL_ENTRIES.ENTRY_TYPE' | appTranslate }}</dt>
              <dd data-testid="journal-entry-origin">
                {{
                  (journalEntry.manualEntry
                    ? 'JOURNAL_ENTRIES.MANUAL'
                    : 'JOURNAL_ENTRIES.SYSTEM_GENERATED'
                  ) | appTranslate
                }}
              </dd>

              <dt>{{ 'JOURNAL_ENTRIES.CREATED_BY' | appTranslate }}</dt>
              <dd>{{ journalEntry.createdByUserName }}</dd>

              @if (journalEntry.referenceNumber) {
                <dt>{{ 'JOURNAL_ENTRIES.REFERENCE_NUMBER' | appTranslate }}</dt>
                <dd>{{ journalEntry.referenceNumber }}</dd>
              }

              @if (journalEntry.comments) {
                <dt>{{ 'COMMON.COMMENT' | appTranslate }}</dt>
                <dd>{{ journalEntry.comments }}</dd>
              }
            </dl>

            <h2>{{ 'JOURNAL_ENTRIES.DEBITS' | appTranslate }}</h2>
            <table class="entry-table" data-testid="journal-entry-debits">
              <tbody>
                @for (line of debits(); track line.id) {
                  <tr>
                    <td>{{ line.glAccountCode }}</td>
                    <td>{{ line.glAccountName }}</td>
                    <td class="amount">{{ line.amount | number: '1.2-2' }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2">{{ 'COMMON.TOTAL' | appTranslate }}</td>
                  <td class="amount" data-testid="journal-entry-debit-total">
                    {{ debitTotal() | number: '1.2-2' }}
                  </td>
                </tr>
              </tfoot>
            </table>

            <h2>{{ 'JOURNAL_ENTRIES.CREDITS' | appTranslate }}</h2>
            <table class="entry-table" data-testid="journal-entry-credits">
              <tbody>
                @for (line of credits(); track line.id) {
                  <tr>
                    <td>{{ line.glAccountCode }}</td>
                    <td>{{ line.glAccountName }}</td>
                    <td class="amount">{{ line.amount | number: '1.2-2' }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2">{{ 'COMMON.TOTAL' | appTranslate }}</td>
                  <td class="amount" data-testid="journal-entry-credit-total">
                    {{ creditTotal() | number: '1.2-2' }}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div class="actions">
              <ion-button fill="outline" (click)="onBack()">
                {{ 'COMMON.BACK' | appTranslate }}
              </ion-button>

              @if (journalEntry.manualEntry && !isReversed()) {
                <ion-button
                  color="danger"
                  data-testid="journal-entry-reverse"
                  [disabled]="isReversing()"
                  appRequiresPermission="REVERSE_JOURNALENTRY"
                  (click)="onReverse()"
                >
                  <ion-icon name="return-down-back-outline" slot="start"></ion-icon>
                  {{ 'JOURNAL_ENTRIES.REVERSE' | appTranslate }}
                </ion-button>
              }
            </div>

            @if (!journalEntry.manualEntry) {
              <p class="note" data-testid="journal-entry-system-note">
                {{ 'JOURNAL_ENTRIES.SYSTEM_ENTRY_NOT_REVERSIBLE' | appTranslate }}
              </p>
            }
          </ion-card-content>
        </ion-card>
      } @else {
        <p data-testid="journal-entry-missing">{{ 'JOURNAL_ENTRIES.NOT_FOUND' | appTranslate }}</p>
      }
    </div>
  `,
  styles: [
    `
      .view-container {
        padding: 16px;
      }
      .detail-grid {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 8px 24px;
        margin: 0 0 24px;
      }
      .detail-grid dt {
        font-weight: 600;
      }
      .detail-grid dd {
        margin: 0;
      }
      .entry-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
      }
      .entry-table td {
        padding: 8px;
        border-bottom: 1px solid var(--ion-color-light-shade);
      }
      .entry-table tfoot td {
        font-weight: 600;
        border-bottom: none;
      }
      .amount {
        text-align: right;
      }
      .status-chip {
        margin-left: 8px;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
      }
      .reversed {
        background-color: #fce4ec;
        color: #c2185b;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-top: 16px;
      }
      .note {
        color: var(--ion-color-medium);
        font-size: 0.9rem;
      }
    `,
  ],
})
export class JournalEntryViewComponent implements OnInit {
  private readonly journalEntriesService = inject(JournalEntriesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  readonly entry = signal<JournalEntryTransactionItem | null>(null);
  readonly lines = signal<JournalEntryTransactionItem[]>([]);
  readonly isLoading = signal(true);
  readonly isReversing = signal(false);

  readonly debits = computed(() => this.linesOfType('DEBIT'));
  readonly credits = computed(() => this.linesOfType('CREDIT'));
  readonly debitTotal = computed(() => this.total(this.debits()));
  readonly creditTotal = computed(() => this.total(this.credits()));

  /** True when any line of the transaction is marked reversed — reversal is transaction-wide. */
  readonly isReversed = computed(
    () => this.entry()?.reversed === true || this.lines().some((line) => line.reversed),
  );

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id)) {
      this.isLoading.set(false);
      return;
    }
    this.load(id);
  }

  private load(id: number): void {
    this.isLoading.set(true);
    this.journalEntriesService.getJournalentriesJournalEntryId(id, true, true).subscribe({
      next: (entry) => {
        this.entry.set(entry);
        this.loadSiblings(entry);
      },
      error: () => {
        this.entry.set(null);
        this.isLoading.set(false);
      },
    });
  }

  /** The clicked line alone never balances; the transaction's other lines are what make it read. */
  private loadSiblings(entry: JournalEntryTransactionItem): void {
    if (!entry.transactionId) {
      this.lines.set([entry]);
      this.isLoading.set(false);
      return;
    }
    this.journalEntriesService
      .getJournalentries(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        entry.transactionId,
      )
      .subscribe({
        next: (page) => {
          this.lines.set(page.pageItems ?? [entry]);
          this.isLoading.set(false);
        },
        error: () => {
          this.lines.set([entry]);
          this.isLoading.set(false);
        },
      });
  }

  private linesOfType(type: 'DEBIT' | 'CREDIT'): JournalEntryTransactionItem[] {
    return this.lines().filter((line) => line.entryType?.value === type);
  }

  private total(lines: JournalEntryTransactionItem[]): number {
    return lines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  }

  async onReverse(): Promise<void> {
    const entry = this.entry();
    if (!entry?.transactionId) {
      return;
    }

    const confirmed = await this.dialog.confirm({
      title: this.i18n.translate('JOURNAL_ENTRIES.REVERSE'),
      message: this.i18n.translate('JOURNAL_ENTRIES.REVERSE_CONFIRM'),
      details: [
        {
          label: this.i18n.translate('JOURNAL_ENTRIES.TRANSACTION'),
          value: entry.transactionId,
        },
      ],
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    this.isReversing.set(true);
    this.journalEntriesService
      .postJournalentriesTransactionId(entry.transactionId, 'reverse', {})
      .subscribe({
        next: () => {
          this.isReversing.set(false);
          this.notifications.success(this.i18n.translate('JOURNAL_ENTRIES.REVERSED_SUCCESS'));
          this.load(entry.id as number);
        },
        error: () => this.isReversing.set(false),
      });
  }

  onBack(): void {
    void this.router.navigate(['/accounting/journal-entries']);
  }
}
