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
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, from, map } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { EntityDatatablesComponent } from '../../shared/components/entity-datatables/entity-datatables.component';
import {
  FixedDepositAccountService,
  FixedDepositAccountTransactionsService,
  RecurringDepositAccountService,
  RecurringDepositAccountTransactionsService,
} from '../../api';
import { BASE_PATH } from '../../api/variables';
import { I18N } from '../../core/adapters';
import { NotificationService } from '../../core/services/notification.service';
import { DialogService } from '../../core/services/dialog.service';
import {
  DepositClosureDialogComponent,
  DepositClosureDialogData,
  DepositClosureResult,
} from './deposit-closure-dialog.component';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatArrayDate,
  formatDateToFineract,
  toIsoDate,
} from '../../core/utils/date-formatter';
import { CdkTableModule } from '@angular/cdk/table';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular/standalone';

/**
 * The tabs on this screen, named.
 *
 * They were positional strings — '0', '7' — which say nothing at the point of use and shift
 * meaning whenever a tab is inserted in the middle. The values are still strings because
 * `ion-segment` compares them as such.
 */
export const DEPOSIT_TAB = {
  overview: 'overview',
  transactions: 'transactions',
  customFields: 'customFields',
} as const;

export type DepositTab = (typeof DEPOSIT_TAB)[keyof typeof DEPOSIT_TAB];

@Component({
  selector: 'app-deposit-account-view',
  standalone: true,
  imports: [
    TranslateModule,
    CdkTableModule,
    StatusBadgeComponent,
    EntityDatatablesComponent,
    DecimalPipe,
    NgClass,
    IonIcon,
    IonButton,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonPopover,
    IonList,
    IonItem,
  ],
  template: `
    @if (account()) {
      <div class="view-container">
        <ion-card class="header-card">
          <ion-card-content class="header-content">
            <div class="title-area">
              <div class="avatar-circle">
                <ion-icon name="wallet-outline"></ion-icon>
              </div>
              <div class="title-details">
                <h2>{{ account()?.['productName'] }}</h2>
                <div class="subtitle-row">
                  <span class="account-no">#{{ account()?.['accountNo'] }}</span>
                  <span class="divider">|</span>
                  <span class="client-name">Client: {{ account()?.['clientName'] }}</span>
                  <app-status-badge
                    data-testid="deposit-status"
                    [status]="getStatusValue()"
                  ></app-status-badge>
                </div>
              </div>
            </div>
            <div class="actions-area">
              <ion-button color="primary" id="actionsMenu-trigger" data-testid="deposit-actions">
                <ion-icon name="settings-outline"></ion-icon>
                {{ 'COMMON.ACTIONS' | translate }}
              </ion-button>
              <ion-popover trigger="actionsMenu-trigger" [dismissOnSelect]="true">
                <ng-template>
                  <ion-list>
                    @if (isPending()) {
                      <ion-item button data-testid="deposit-action-approve" (click)="onApprove()">
                        <ion-icon slot="start" name="checkmark-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.APPROVE' | translate }}</ion-label>
                      </ion-item>
                      <ion-item button data-testid="deposit-action-reject" (click)="onReject()">
                        <ion-icon slot="start" name="close-circle-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.REJECT' | translate }}</ion-label>
                      </ion-item>
                      <ion-item
                        button
                        data-testid="deposit-action-withdrawnByApplicant"
                        (click)="onWithdrawnByApplicant()"
                      >
                        <ion-icon slot="start" name="person-remove-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.WITHDRAWN_BY_CLIENT' | translate }}</ion-label>
                      </ion-item>
                    }
                    @if (isApproved()) {
                      <ion-item button data-testid="deposit-action-activate" (click)="onActivate()">
                        <ion-icon slot="start" name="play-circle-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.ACTIVATE' | translate }}</ion-label>
                      </ion-item>
                      <ion-item
                        button
                        data-testid="deposit-action-undoapproval"
                        (click)="onUndoApproval()"
                      >
                        <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.UNDO_APPROVAL' | translate }}</ion-label>
                      </ion-item>
                    }
                    @if (isActive()) {
                      <ion-item button data-testid="deposit-action-deposit" (click)="onDeposit()">
                        <ion-icon slot="start" name="add-outline"></ion-icon>
                        <ion-label>{{ 'SAVINGS.DEPOSIT' | translate }}</ion-label>
                      </ion-item>
                      <!-- Withdrawal is a recurring-deposit capability only. A fixed deposit
                           refuses it outright — see onWithdraw. -->
                      @if (isRD) {
                        <ion-item
                          button
                          data-testid="deposit-action-withdraw"
                          (click)="onWithdraw()"
                        >
                          <ion-icon slot="start" name="remove-outline"></ion-icon>
                          <ion-label>{{ 'SAVINGS.WITHDRAW' | translate }}</ion-label>
                        </ion-item>
                      }
                      <ion-item
                        button
                        data-testid="deposit-action-postInterest"
                        (click)="onPostInterest()"
                      >
                        <ion-icon slot="start" name="cash-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.POST_INTEREST' | translate }}</ion-label>
                      </ion-item>
                      <ion-item
                        button
                        data-testid="deposit-action-prematureClose"
                        (click)="onPrematureClose()"
                      >
                        <ion-icon slot="start" name="alert-circle-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.PREMATURE_CLOSE' | translate }}</ion-label>
                      </ion-item>
                      <ion-item button data-testid="deposit-action-close" (click)="onClose()">
                        <ion-icon slot="start" name="lock-closed-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.CLOSE' | translate }}</ion-label>
                      </ion-item>
                    }
                    @if (!isPending() && !isApproved() && !isActive()) {
                      <ion-item data-testid="deposit-no-actions">
                        <ion-label>{{ 'ACTIONS.NONE_AVAILABLE' | translate }}</ion-label>
                      </ion-item>
                    }
                  </ion-list>
                </ng-template>
              </ion-popover>

              <ion-button fill="clear" (click)="onBack()">
                <ion-icon name="arrow-back-outline"></ion-icon>
                {{ 'COMMON.BACK' | translate }}
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-segment [value]="activeTab()" (ionChange)="activeTab.set($any($event).detail.value)">
          <ion-segment-button [value]="TAB.overview">
            <ion-label>{{ 'COMMON.OVERVIEW' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.transactions" data-testid="deposit-tab-transactions">
            <ion-label>{{ 'COMMON.TRANSACTIONS' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.customFields">
            <ion-label>{{ 'SYSTEM.CUSTOM_FIELDS' | translate }}</ion-label>
          </ion-segment-button>
        </ion-segment>

        @if (activeTab() === TAB.overview) {
          <div class="tab-content">
            <div class="info-grid">
              <ion-card class="info-card">
                <ion-card-header>
                  <ion-card-title>{{ 'COMMON.DETAILS' | translate }}</ion-card-title>
                </ion-card-header>
                <ion-card-content class="details-list">
                  <div class="detail-item">
                    <span class="label">{{ 'COMMON.BALANCE' | translate }}</span>
                    <span class="value"
                      >{{ getCurrencySymbol() }} {{ getAccountBalance() | number: '1.2-2' }}</span
                    >
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'COMMON.INTEREST_RATE' | translate }}</span>
                    <span class="value">{{ account()?.['nominalAnnualInterestRate'] }}%</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'SAVINGS.MIN_BALANCE_REQUIRED' | translate }}</span>
                    <span class="value">{{ account()?.['minRequiredOpeningBalance'] }}</span>
                  </div>
                </ion-card-content>
              </ion-card>

              <ion-card class="info-card">
                <ion-card-header>
                  <ion-card-title>{{ 'LOANS.TIMELINE_STATUS' | translate }}</ion-card-title>
                </ion-card-header>
                <ion-card-content class="details-list">
                  <div class="detail-item">
                    <span class="label">{{ 'COMMON.ACTIVATION_DATE' | translate }}</span>
                    <span class="value">{{ getActivationDate() }}</span>
                  </div>
                </ion-card-content>
              </ion-card>
            </div>
          </div>
        }
        @if (activeTab() === TAB.transactions) {
          <div class="tab-content">
            @if (transactions().length > 0) {
              <table cdk-table [dataSource]="transactions()" class="full-width-table">
                <ng-container cdkColumnDef="id">
                  <th cdk-header-cell *cdkHeaderCellDef>ID</th>
                  <td cdk-cell *cdkCellDef="let tx">{{ tx.id }}</td>
                </ng-container>
                <ng-container cdkColumnDef="date">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.DATE' | translate }}</th>
                  <td cdk-cell *cdkCellDef="let tx">{{ formatDate(tx.date) }}</td>
                </ng-container>
                <ng-container cdkColumnDef="type">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.TYPE' | translate }}</th>
                  <td cdk-cell *cdkCellDef="let tx">{{ tx.transactionType?.value }}</td>
                </ng-container>
                <ng-container cdkColumnDef="amount">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.AMOUNT' | translate }}</th>
                  <td cdk-cell *cdkCellDef="let tx">
                    <span
                      [ngClass]="{
                        debit: tx.entryType === 'DEBIT' && !tx.reversed,
                        credit: tx.entryType !== 'DEBIT' && !tx.reversed,
                        'reversed-amount': tx.reversed,
                      }"
                    >
                      {{ tx.currency?.displaySymbol }} {{ tx.amount | number: '1.2-2' }}
                    </span>
                  </td>
                </ng-container>
                <ng-container cdkColumnDef="runningBalance">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'COMMON.RUNNING_BALANCE' | translate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let tx">
                    {{ tx.currency?.displaySymbol }} {{ tx.runningBalance || 0 | number: '1.2-2' }}
                  </td>
                </ng-container>
                <ng-container cdkColumnDef="actions">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ACTIONS' | translate }}</th>
                  <td cdk-cell *cdkCellDef="let tx">
                    @if (canUndo(tx)) {
                      <ion-button
                        fill="clear"
                        color="danger"
                        size="small"
                        [attr.data-testid]="'deposit-tx-undo-' + tx.id"
                        [attr.aria-label]="'ACTIONS.UNDO_TRANSACTION' | translate"
                        (click)="onUndoTransaction(tx)"
                      >
                        <ion-icon name="arrow-undo-outline"></ion-icon>
                      </ion-button>
                    } @else if (tx.reversed) {
                      <span class="reversed-marker" data-testid="deposit-tx-reversed">
                        {{ 'COMMON.REVERSED' | translate }}
                      </span>
                    }
                  </td>
                </ng-container>
                <tr cdk-header-row *cdkHeaderRowDef="transactionColumns"></tr>
                <tr cdk-row *cdkRowDef="let row; columns: transactionColumns"></tr>
              </table>
            } @else {
              <div class="empty-state" data-testid="deposit-no-transactions">
                <ion-icon name="receipt-outline"></ion-icon>
                <p>{{ 'LOANS.NO_TRANSACTIONS' | translate }}</p>
              </div>
            }
          </div>
        }
        @if (activeTab() === TAB.customFields) {
          <div class="tab-content">
            <app-entity-datatables
              [apptableName]="isRD ? 'm_savings_account' : 'm_savings_account'"
              [entityId]="accountId"
            ></app-entity-datatables>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .view-container {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .header-card {
        border-radius: 12px;
      }
      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .title-area {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .avatar-circle {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: #3f51b5;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .avatar-circle mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }
      .title-details h2 {
        margin: 0;
      }
      .subtitle-row {
        display: flex;
        gap: 8px;
        align-items: center;
        color: #666;
        font-size: 14px;
      }
      .actions-area {
        display: flex;
        gap: 12px;
      }
      .tab-group {
        border-radius: 12px;
        background: white;
      }
      .tab-content {
        padding: 24px;
      }
      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
      }
      .details-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .detail-item {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px solid #eee;
        padding-bottom: 8px;
      }
      .label {
        color: #777;
      }
      .value {
        font-weight: 600;
      }
      .full-width-table {
        width: 100%;
      }
      .debit {
        color: #e74c3c;
      }
      .credit {
        color: #2ecc71;
      }
      /* Matches the savings account view, so a reversed row reads the same on both screens. */
      .reversed-amount {
        text-decoration: line-through;
        opacity: 0.6;
        color: #7f8c8d;
      }
      .reversed-marker {
        color: var(--text-muted, #6b7280);
        font-style: italic;
      }
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 48px 16px;
        color: var(--text-muted, #6b7280);
      }
      .empty-state ion-icon {
        font-size: 40px;
      }
    `,
  ],
})
export class DepositAccountViewComponent implements OnInit {
  /** Selected tab; mat-tab-group tracked this internally, ion-segment does not. */
  /** Exposed so the template names its tabs instead of numbering them. */
  protected readonly TAB = DEPOSIT_TAB;

  readonly activeTab = signal<DepositTab>(DEPOSIT_TAB.overview);
  private readonly fdService = inject(FixedDepositAccountService);
  private readonly rdService = inject(RecurringDepositAccountService);
  private readonly fdTransactionsService = inject(FixedDepositAccountTransactionsService);
  private readonly rdTransactionsService = inject(RecurringDepositAccountTransactionsService);
  private readonly httpClient = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  accountId = 0;
  isRD = false;
  readonly account = signal<Record<string, unknown> | null>(null);
  readonly transactions = signal<Record<string, unknown>[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);

  readonly transactionColumns = ['id', 'date', 'type', 'amount', 'runningBalance', 'actions'];

  ngOnInit(): void {
    this.accountId = Number(this.route.snapshot.paramMap.get('id'));
    this.isRD = this.router.url.includes('recurring');
    this.loadData();
  }

  /**
   * Reads the account.
   *
   * This used to reach through the service as `service['retrieveOne14']` — a name that exists on
   * neither generated service, so the lookup produced `undefined` and calling it threw
   * `TypeError: call is not a function` out of `ngOnInit`. The template is wrapped in
   * `@if (account())`, so the page rendered as nothing at all: every fixed and recurring deposit
   * account opened to a blank screen.
   *
   * The double cast through `Record<string, unknown>` is what let that compile. Calling the
   * generated methods by name is the point — ADR-0001 stabilises those names precisely so a
   * rename becomes a compile error rather than a blank page.
   */
  loadData(): void {
    this.isLoading.set(true);
    // Widened to `unknown`: the two responses are distinct generated types with no common
    // supertype, and the screen reads both through the same untyped record either way.
    const request$: Observable<unknown> = this.isRD
      ? this.rdService.getRecurringdepositaccountsAccountId(this.accountId)
      : this.fdService.getFixeddepositaccountsAccountId(this.accountId);

    request$.subscribe({
      next: (data) => {
        this.account.set(data as unknown as Record<string, unknown>);
        this.hasError.set(false);
        this.isLoading.set(false);
        this.loadTransactions();
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Reads the transaction list, which the account response does not carry.
   *
   * `GET /fixeddepositaccounts/{id}` and `GET /recurringdepositaccounts/{id}` answer without a
   * `transactions` key unless asked for one, so the tab read `account['transactions']` and found
   * `undefined` on every account ever opened — the tab was empty by construction, not because
   * these accounts had no transactions.
   *
   * The two account types are asked differently because only one of them can be:
   *
   * - **Fixed deposit** has a list endpoint, `GET /fixeddepositaccounts/{id}/transactions`, and a
   *   generated method for it. That is the typed path and it is used.
   * - **Recurring deposit** has no such endpoint — `GET /recurringdepositaccounts/{id}/transactions`
   *   answers `405`. Its transactions come from `?associations=transactions` on the account, and
   *   the upstream OpenAPI document does not describe an `associations` parameter for either
   *   deposit type (it does for `/savingsaccounts/{accountId}`), so the generated client cannot
   *   send it. Hence the same `HttpClient` escape hatch `group-view` uses, for the same reason.
   *   Delete this branch once upstream describes the parameter.
   *
   * A failure here leaves the rest of the screen intact: the account loaded, and a missing
   * transaction list is not a reason to blank the lifecycle actions.
   */
  private loadTransactions(): void {
    const transactions$: Observable<unknown[]> = this.isRD
      ? this.httpClient
          .get<{
            transactions?: unknown[];
          }>(`${this.basePath}/v1/recurringdepositaccounts/${this.accountId}`, {
            params: { associations: 'transactions' },
          })
          .pipe(map((account) => account.transactions ?? []))
      : this.fdTransactionsService.getFixeddepositaccountsFixedDepositAccountIdTransactions(
          this.accountId,
        );

    transactions$.subscribe({
      next: (transactions) => this.transactions.set(transactions as Record<string, unknown>[]),
      error: () => this.transactions.set([]),
    });
  }

  /**
   * Whether a row can still be undone.
   *
   * The platform is lenient here — it accepts `command=undo` against a transaction that is
   * already reversed, and against a hold or a release, answering `200` each time and doing
   * nothing useful. Offering the action anyway would mean a button that reports success and
   * changes nothing, so the screen is stricter than the server: only a live entry is offered.
   */
  canUndo(transaction: Record<string, unknown>): boolean {
    return this.isActive() && !transaction['reversed'];
  }

  /**
   * Reverses a transaction.
   *
   * The row is not removed. Fineract marks it `reversed` and keeps it in the list, and the tab
   * renders it struck through — an undone transaction that vanished would take the audit trail
   * with it.
   */
  onUndoTransaction(transaction: Record<string, unknown>): void {
    const transactionId = Number(transaction['id']);
    void this.dialogService
      .confirm({
        title: this.i18n.translate('ACTIONS.UNDO_TRANSACTION'),
        message: this.i18n.translate('ACTIONS.CONFIRM_UNDO_TRANSACTION'),
        destructive: true,
      })
      .then((confirmed) => {
        if (!confirmed) return;
        // Both twins take (accountId, transactionId, body, command); the body is unused by the
        // `undo` command but is a required positional argument.
        const request$: Observable<unknown> = this.isRD
          ? this.rdTransactionsService.postRecurringdepositaccountsRecurringDepositAccountIdTransactionsTransactionId(
              this.accountId,
              transactionId,
              {},
              'undo',
            )
          : this.fdTransactionsService.postFixeddepositaccountsFixedDepositAccountIdTransactionsTransactionId(
              this.accountId,
              transactionId,
              {},
              'undo',
            );

        request$.subscribe({
          next: () => {
            void this.notifications.success(this.i18n.translate('COMMON.SUCCESS'));
            this.loadData();
          },
          error: () => undefined,
        });
      });
  }

  getStatusValue(): string {
    const status = this.account()?.['status'] as Record<string, unknown>;
    return (status?.['value'] as string) || '';
  }

  getCurrencySymbol(): string {
    const currency = this.account()?.['currency'] as Record<string, unknown>;
    return (currency?.['displaySymbol'] as string) || '';
  }

  getAccountBalance(): number | null {
    const balance = this.account()?.['accountBalance'];
    return balance != null ? Number(balance) : null;
  }

  getActivationDate(): string {
    const timeline = this.account()?.['timeline'] as Record<string, unknown>;
    return this.formatDate(timeline?.['activatedOnDate']);
  }

  getBalance(): number {
    return (this.account()?.['accountBalance'] as number) || 0;
  }

  formatDate(date: unknown): string {
    if (Array.isArray(date)) {
      return new Date(date[0], date[1] - 1, date[2]).toLocaleDateString();
    }
    return '-';
  }

  // --- Lifecycle ------------------------------------------------------------------------------

  /**
   * Fineract reports a deposit account's state as booleans beside the id, exactly as it does for
   * savings, and the actions gate on those rather than on `status.value` — the value is the
   * server's English label and moves with its locale.
   */
  private statusFlag(flag: string): boolean {
    const status = this.account()?.['status'] as Record<string, unknown> | undefined;
    return status?.[flag] === true;
  }

  readonly isPending = computed(() => this.statusFlag('submittedAndPendingApproval'));
  readonly isApproved = computed(() => this.statusFlag('approved'));
  readonly isActive = computed(() => this.statusFlag('active'));

  /**
   * The date to send for a command, never earlier than the one the platform already stamped.
   *
   * A command's date is validated against a date Fineract wrote itself — an approval cannot
   * precede submission, an activation cannot precede approval — and it wrote it in the tenant's
   * timezone. The browser's clock disagrees with that for as long as the offset between them, so
   * a UTC browser against an `Asia/Kolkata` tenant sends yesterday from 18:30 UTC onwards and the
   * command is refused. Taking the later of the two removes the browser's clock from the decision
   * wherever the platform has already made it.
   *
   * Compared lexically: both sides are zero-padded `YYYY-MM-DD`, which orders identically to the
   * dates it spells, and parsing them back into `Date` would reintroduce the timezone this is
   * here to keep out.
   */
  private commandDateIso(floor: unknown): string {
    const today = toIsoDate(new Date());
    const stamped = Array.isArray(floor) && floor.length >= 3 ? formatArrayDate(floor) : '-';
    return stamped !== '-' && stamped > today ? stamped : today;
  }

  private commandDate(floor: unknown): string {
    // Through the parts rather than through `new Date(iso)`, which parses as UTC midnight and
    // then reads back in local time — a day out for anyone west of Greenwich.
    return formatDateToFineract(this.commandDateIso(floor).split('-').map(Number));
  }

  /** A date the platform stamped on this account, by timeline key. */
  private timelineDate(key: string): unknown {
    const timeline = this.account()?.['timeline'] as Record<string, unknown> | undefined;
    return timeline?.[key];
  }

  /** `locale` and `dateFormat` belong with a date, and only with one — see `onUndoApproval`. */
  private dated(field: string, floor: unknown): Record<string, unknown> {
    return {
      [field]: this.commandDate(floor),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };
  }

  onApprove(): void {
    this.confirmCommand('APPROVE', 'approve', () =>
      this.dated('approvedOnDate', this.timelineDate('submittedOnDate')),
    );
  }

  onReject(): void {
    this.confirmCommand(
      'REJECT',
      'reject',
      () => this.dated('rejectedOnDate', this.timelineDate('submittedOnDate')),
      true,
    );
  }

  onWithdrawnByApplicant(): void {
    this.confirmCommand('WITHDRAWN_BY_CLIENT', 'withdrawnByApplicant', () =>
      this.dated('withdrawnOnDate', this.timelineDate('submittedOnDate')),
    );
  }

  onActivate(): void {
    this.confirmCommand('ACTIVATE', 'activate', () =>
      this.dated('activatedOnDate', this.timelineDate('approvedOnDate')),
    );
  }

  /**
   * Sends an empty body, deliberately.
   *
   * The command erases a date rather than carrying one, and it refuses `locale` and `dateFormat`
   * outright — "The parameter locale is not supported" — so the pair that every other command
   * here requires is exactly what makes this one fail.
   */
  onUndoApproval(): void {
    this.confirmCommand('UNDO_APPROVAL', 'undoapproval', () => ({}));
  }

  onPostInterest(): void {
    this.confirmCommand('POST_INTEREST', 'postInterest', () => ({
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    }));
  }

  /**
   * Closing at maturity, and closing before it.
   *
   * Both need to say what happens to the money. `withdrawBalance: true` pays it out, which is the
   * only option that needs no second account — transferring to a savings account needs an account
   * to transfer to, and choosing one is its own screen.
   */
  onClose(): void {
    void this.closeAccount(false);
  }

  onPrematureClose(): void {
    void this.closeAccount(true);
  }

  private async closeAccount(premature: boolean): Promise<void> {
    const activatedOn = this.timelineDate('activatedOnDate');
    // ISO for the dialog, which prices the closure; the command itself carries the Fineract
    // spelling of the same day.
    const closedOnIso = this.commandDateIso(activatedOn);

    const result = await this.dialogService.open<DepositClosureResult>(
      DepositClosureDialogComponent,
      {
        data: {
          accountId: this.accountId,
          isRD: this.isRD,
          premature,
          closedOnDate: closedOnIso,
          currency: this.getCurrencySymbol(),
        } satisfies DepositClosureDialogData,
      },
    );
    if (!result) return;

    this.runCommand(premature ? 'prematureClose' : 'close', {
      ...this.dated('closedOnDate', activatedOn),
      onAccountClosureId: result.onAccountClosureId,
    });
  }

  /**
   * Confirms, then posts.
   *
   * The payload is built after confirmation rather than before, so the date is the one at the
   * moment of sending — a dialog left open across midnight would otherwise send yesterday.
   *
   * No error toast: `errorInterceptor` already raises one carrying the platform's own message,
   * and for these commands that message is the useful one — closing before maturity, or
   * activating an account whose client is not active, each say exactly why.
   */
  private confirmCommand(
    key: string,
    command: string,
    payload: () => Record<string, unknown>,
    destructive = false,
  ): void {
    from(
      this.dialogService.confirm({
        title: this.i18n.translate(`ACTIONS.${key}`),
        message: this.i18n.translate(`ACTIONS.CONFIRM_${key}`),
        destructive,
      }),
    ).subscribe((confirmed) => {
      if (!confirmed) return;
      this.runCommand(command, payload());
    });
  }

  private runCommand(command: string, body: Record<string, unknown>): void {
    const request$: Observable<unknown> = this.isRD
      ? this.rdService.postRecurringdepositaccountsAccountId(this.accountId, body, command)
      : this.fdService.postFixeddepositaccountsAccountId(this.accountId, body, command);

    request$.subscribe({
      next: () => {
        void this.notifications.success(this.i18n.translate('COMMON.SUCCESS'));
        // Re-read rather than patch: a command moves the status, stamps a date and, for a
        // closure, moves the balance. A screen that guessed at those would drift.
        this.loadData();
      },
      error: () => undefined,
    });
  }

  onDeposit(): void {
    const path = this.isRD
      ? `/products/recurring-deposits/${this.accountId}/transactions/create`
      : `/products/fixed-deposits/${this.accountId}/transactions/deposit`;
    this.router.navigate([path]);
  }

  /**
   * Recurring deposits only.
   *
   * A fixed deposit refuses the command rather than merely lacking a screen for it:
   * `POST /fixeddepositaccounts/{id}/transactions?command=withdrawal` answers `503`
   * `error.msg.fixeddepositaccount.account.trasaction.withdraw.notallowed`. The action is
   * therefore hidden for a fixed deposit rather than offered and then failed — the money leaves
   * a fixed deposit through maturity or premature closure, both of which are already on the menu.
   */
  onWithdraw(): void {
    this.router.navigate([
      `/products/recurring-deposits/${this.accountId}/transactions/withdrawal`,
    ]);
  }

  onBack(): void {
    const path = this.isRD ? '/products/recurring-deposits' : '/products/fixed-deposits';
    this.router.navigate([path]);
  }
}
