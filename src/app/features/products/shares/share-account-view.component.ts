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

import { CdkTableModule } from '@angular/cdk/table';
import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonSpinner,
} from '@ionic/angular/standalone';
import { Observable, from } from 'rxjs';

import { ShareAccountService } from '../../../api';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { DialogService } from '../../../core/services/dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatArrayDate,
  formatDateToFineract,
  toIsoDate,
} from '../../../core/utils/date-formatter';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import {
  ShareQuantityDialogComponent,
  ShareQuantityDialogData,
  ShareQuantityResult,
} from './share-quantity-dialog.component';

/** `GET /accounts/share/{id}`, as far as this screen reads it. */
interface ShareAccountDetail {
  id?: number;
  accountNo?: string;
  clientId?: number;
  clientName?: string;
  productName?: string;
  savingsAccountId?: number;
  savingsAccountNumber?: string;
  currency?: { displaySymbol?: string; code?: string };
  currentMarketPrice?: number;
  status?: Record<string, unknown>;
  timeline?: Record<string, unknown>;
  summary?: { totalApprovedShares?: number; totalPendingForApprovalShares?: number };
  purchasedShares?: PurchasedShare[];
  charges?: Record<string, unknown>[];
  dividends?: Record<string, unknown>[];
}

interface PurchasedShare {
  id?: number;
  purchasedDate?: number[];
  numberOfShares?: number;
  purchasedPrice?: number;
  amount?: number;
  chargeAmount?: number;
  status?: { value?: string };
  type?: { value?: string };
}

/**
 * A share account's detail screen.
 *
 * Share accounts could be created and edited but never opened: there was no view component and
 * no route to one, so nothing an operator does after the application — approving it, activating
 * it, buying more shares, redeeming some, closing the account — was reachable at all.
 *
 * The nine commands the platform exposes are enumerated in `runCommand`. They disagree about
 * their date field — `approvedDate`, `activatedDate`, `rejectedDate`, `closedDate`,
 * `requestedDate` — so each one names its own rather than sharing a guess.
 */
@Component({
  selector: 'app-share-account-view',
  standalone: true,
  imports: [
    CdkTableModule,
    DecimalPipe,
    TranslatePipe,
    StatusBadgeComponent,
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
    IonSpinner,
  ],
  template: `
    @if (isLoading()) {
      <div class="state-panel"><ion-spinner name="crescent"></ion-spinner></div>
    } @else if (hasError()) {
      <div class="state-panel" data-testid="share-account-load-error">
        <ion-icon name="alert-circle-outline"></ion-icon>
        <p>{{ 'SHARE_ACCOUNTS.LOAD_FAILED' | appTranslate }}</p>
        <ion-button color="primary" (click)="loadAccount()">
          {{ 'COMMON.RETRY' | appTranslate }}
        </ion-button>
      </div>
    } @else if (account(); as detail) {
      <div class="view-container">
        <ion-card class="header-card">
          <ion-card-content class="header-content">
            <div class="identity">
              <h2>{{ detail.productName }}</h2>
              <div class="sub">
                <span class="account-no">#{{ detail.accountNo }}</span>
                <span class="divider">|</span>
                <span>{{ detail.clientName }}</span>
                <app-status-badge
                  data-testid="share-account-status"
                  [status]="statusValue()"
                ></app-status-badge>
              </div>
            </div>

            <div class="header-actions">
              <ion-button color="primary" id="share-actions-trigger" data-testid="share-actions">
                <ion-icon name="settings-outline"></ion-icon>
                {{ 'COMMON.ACTIONS' | appTranslate }}
              </ion-button>

              <ion-popover trigger="share-actions-trigger" [dismissOnSelect]="true">
                <ng-template>
                  <ion-list>
                    @if (isPending()) {
                      <ion-item button data-testid="share-action-approve" (click)="onApprove()">
                        <ion-icon slot="start" name="checkmark-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.APPROVE' | appTranslate }}</ion-label>
                      </ion-item>
                      <ion-item button data-testid="share-action-reject" (click)="onReject()">
                        <ion-icon slot="start" name="close-circle-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.REJECT' | appTranslate }}</ion-label>
                      </ion-item>
                    }
                    @if (isApproved()) {
                      <ion-item button data-testid="share-action-activate" (click)="onActivate()">
                        <ion-icon slot="start" name="play-circle-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.ACTIVATE' | appTranslate }}</ion-label>
                      </ion-item>
                      <ion-item
                        button
                        data-testid="share-action-undoapproval"
                        (click)="onUndoApproval()"
                      >
                        <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.UNDO_APPROVAL' | appTranslate }}</ion-label>
                      </ion-item>
                    }
                    @if (isActive()) {
                      <ion-item button data-testid="share-action-apply" (click)="onApplyShares()">
                        <ion-icon slot="start" name="add-outline"></ion-icon>
                        <ion-label>{{ 'SHARE_ACCOUNTS.APPLY_SHARES' | appTranslate }}</ion-label>
                      </ion-item>
                      <ion-item button data-testid="share-action-redeem" (click)="onRedeemShares()">
                        <ion-icon slot="start" name="remove-outline"></ion-icon>
                        <ion-label>{{ 'SHARE_ACCOUNTS.REDEEM_SHARES' | appTranslate }}</ion-label>
                      </ion-item>
                      <ion-item button data-testid="share-action-close" (click)="onClose()">
                        <ion-icon slot="start" name="lock-closed-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.CLOSE' | appTranslate }}</ion-label>
                      </ion-item>
                    }
                    @if (!isPending() && !isApproved() && !isActive()) {
                      <ion-item data-testid="share-no-actions">
                        <ion-label>{{ 'ACTIONS.NONE_AVAILABLE' | appTranslate }}</ion-label>
                      </ion-item>
                    }
                  </ion-list>
                </ng-template>
              </ion-popover>

              <ion-button fill="clear" (click)="onBack()">
                <ion-icon name="arrow-back-outline"></ion-icon>
                {{ 'COMMON.BACK' | appTranslate }}
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-segment [value]="activeTab()" (ionChange)="activeTab.set($any($event).detail.value)">
          <ion-segment-button value="overview" data-testid="share-tab-overview">
            <ion-label>{{ 'COMMON.OVERVIEW' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="shares" data-testid="share-tab-shares">
            <ion-label>{{ 'SHARE_ACCOUNTS.SHARES' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="dividends" data-testid="share-tab-dividends">
            <ion-label>{{ 'SHARE_ACCOUNTS.DIVIDENDS' | appTranslate }}</ion-label>
          </ion-segment-button>
        </ion-segment>

        @if (activeTab() === 'overview') {
          <div class="tab-content">
            <ion-card>
              <ion-card-header>
                <ion-card-title>{{ 'COMMON.OVERVIEW' | appTranslate }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <dl class="info-grid">
                  <dt>{{ 'SHARE_ACCOUNTS.TOTAL_SHARES' | appTranslate }}</dt>
                  <dd data-testid="share-total-approved">{{ approvedShares() }}</dd>

                  <dt>{{ 'SHARE_ACCOUNTS.PENDING_SHARES' | appTranslate }}</dt>
                  <dd data-testid="share-total-pending">{{ pendingShares() }}</dd>

                  <dt>{{ 'SHARE_ACCOUNTS.MARKET_PRICE' | appTranslate }}</dt>
                  <dd>{{ currencySymbol() }} {{ detail.currentMarketPrice | number: '1.2-2' }}</dd>

                  <dt>{{ 'SHARE_ACCOUNTS.LINKED_SAVINGS' | appTranslate }}</dt>
                  <dd data-testid="share-linked-savings">
                    {{ detail.savingsAccountNumber || '-' }}
                  </dd>

                  <dt>{{ 'COMMON.SUBMITTED_ON' | appTranslate }}</dt>
                  <dd>{{ timelineDate('submittedOnDate') }}</dd>

                  <dt>{{ 'COMMON.ACTIVATED_ON' | appTranslate }}</dt>
                  <dd>{{ timelineDate('activatedDate') }}</dd>
                </dl>
              </ion-card-content>
            </ion-card>
          </div>
        }

        @if (activeTab() === 'shares') {
          <div class="tab-content">
            @if (!purchasedShares().length) {
              <p class="empty" data-testid="share-transactions-empty">
                {{ 'SHARE_ACCOUNTS.NO_SHARE_TRANSACTIONS' | appTranslate }}
              </p>
            } @else {
              <table cdk-table [dataSource]="purchasedShares()" class="share-table">
                <ng-container cdkColumnDef="date">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.DATE' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let row">{{ displayDate(row.purchasedDate) }}</td>
                </ng-container>
                <ng-container cdkColumnDef="type">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.TYPE' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.type?.value }}</td>
                </ng-container>
                <ng-container cdkColumnDef="shares">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'SHARE_ACCOUNTS.NUMBER_OF_SHARES' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.numberOfShares }}</td>
                </ng-container>
                <ng-container cdkColumnDef="price">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'SHARE_ACCOUNTS.UNIT_PRICE' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">
                    {{ currencySymbol() }} {{ row.purchasedPrice | number: '1.2-2' }}
                  </td>
                </ng-container>
                <ng-container cdkColumnDef="amount">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.AMOUNT' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let row">
                    {{ currencySymbol() }} {{ row.amount | number: '1.2-2' }}
                  </td>
                </ng-container>
                <ng-container cdkColumnDef="status">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.STATUS' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.status?.value }}</td>
                </ng-container>
                <tr cdk-header-row *cdkHeaderRowDef="shareColumns"></tr>
                <tr cdk-row *cdkRowDef="let row; columns: shareColumns"></tr>
              </table>
            }
          </div>
        }

        @if (activeTab() === 'dividends') {
          <div class="tab-content">
            <p class="empty" data-testid="share-dividends-empty">
              {{ 'SHARE_ACCOUNTS.NO_DIVIDENDS' | appTranslate }}
            </p>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .view-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
      }
      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }
      .identity h2 {
        margin: 0;
      }
      .sub {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-muted, #6b7280);
        font-size: 14px;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .info-grid {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 8px 24px;
        margin: 0;
      }
      .info-grid dt {
        color: var(--text-muted, #6b7280);
        font-size: 13px;
      }
      .info-grid dd {
        margin: 0;
        font-weight: 500;
      }
      .share-table {
        width: 100%;
      }
      .state-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 48px 16px;
      }
      .empty {
        color: var(--text-muted, #6b7280);
        padding: 16px;
      }
      @media (max-width: 700px) {
        .info-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ShareAccountViewComponent implements OnInit {
  private readonly shareService = inject(ShareAccountService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  private static readonly TYPE = 'share';
  private readonly LIST_PATH = '/products/shares';

  accountId = 0;
  readonly account = signal<ShareAccountDetail | null>(null);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly activeTab = signal('overview');

  readonly shareColumns = ['date', 'type', 'shares', 'price', 'amount', 'status'];

  ngOnInit(): void {
    this.accountId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadAccount();
  }

  loadAccount(): void {
    this.isLoading.set(true);
    this.shareService
      .getAccountsTypeAccountId(this.accountId, ShareAccountViewComponent.TYPE)
      .subscribe({
        next: (data) => {
          this.account.set(data as unknown as ShareAccountDetail);
          this.hasError.set(false);
          this.isLoading.set(false);
        },
        error: () => {
          this.hasError.set(true);
          this.isLoading.set(false);
        },
      });
  }

  // --- Status ---------------------------------------------------------------------------------

  /** Gated on the booleans beside the id, not on `value`, which is the server's English label. */
  private statusFlag(flag: string): boolean {
    return this.account()?.status?.[flag] === true;
  }

  readonly isPending = computed(() => this.statusFlag('submittedAndPendingApproval'));
  readonly isApproved = computed(() => this.statusFlag('approved'));
  readonly isActive = computed(() => this.statusFlag('active'));

  statusValue(): string {
    return (this.account()?.status?.['value'] as string) ?? '';
  }

  currencySymbol(): string {
    return this.account()?.currency?.displaySymbol ?? '';
  }

  readonly approvedShares = computed(() => this.account()?.summary?.totalApprovedShares ?? 0);
  readonly pendingShares = computed(
    () => this.account()?.summary?.totalPendingForApprovalShares ?? 0,
  );
  readonly purchasedShares = computed<PurchasedShare[]>(
    () => this.account()?.purchasedShares ?? [],
  );

  displayDate(value: unknown): string {
    return formatArrayDate(value);
  }

  timelineDate(key: string): string {
    return formatArrayDate(this.account()?.timeline?.[key]);
  }

  // --- Commands -------------------------------------------------------------------------------

  /**
   * The date a command carries, never earlier than one the platform already stamped.
   *
   * Those are written in the tenant's timezone; the browser's clock is a different one for as
   * long as the offset between them, and the command validates against the stamped date. Same
   * reasoning as the group and deposit screens.
   */
  private commandDate(floorKey: string): string {
    const today = toIsoDate(new Date());
    const stamped = formatArrayDate(this.account()?.timeline?.[floorKey]);
    const iso = stamped !== '-' && stamped > today ? stamped : today;
    return formatDateToFineract(iso);
  }

  /** A dated command body, under the field name this particular command expects. */
  private dated(field: string, floorKey: string): Record<string, unknown> {
    return {
      [field]: this.commandDate(floorKey),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };
  }

  onApprove(): void {
    this.confirmCommand('APPROVE', 'approve', () => this.dated('approvedDate', 'submittedOnDate'));
  }

  onReject(): void {
    this.confirmCommand(
      'REJECT',
      'reject',
      () => this.dated('rejectedDate', 'submittedOnDate'),
      true,
    );
  }

  onActivate(): void {
    this.confirmCommand('ACTIVATE', 'activate', () => this.dated('activatedDate', 'approvedDate'));
  }

  onUndoApproval(): void {
    this.confirmCommand('UNDO_APPROVAL', 'undoapproval', () => ({}));
  }

  onClose(): void {
    this.confirmCommand('CLOSE', 'close', () => this.dated('closedDate', 'activatedDate'), true);
  }

  async onApplyShares(): Promise<void> {
    await this.tradeShares('SHARE_ACCOUNTS.APPLY_SHARES', 'applyadditionalshares', false);
  }

  async onRedeemShares(): Promise<void> {
    await this.tradeShares('SHARE_ACCOUNTS.REDEEM_SHARES', 'redeemshares', true);
  }

  /**
   * Buying more shares, or selling some back.
   *
   * Both take `requestedDate` and `requestedShares`; a redemption is additionally bounded by the
   * holding, which the dialog is given so the teller sees the ceiling rather than discovering it.
   */
  private async tradeShares(titleKey: string, command: string, bounded: boolean): Promise<void> {
    const result = await this.dialogService.open<ShareQuantityResult>(
      ShareQuantityDialogComponent,
      {
        data: {
          titleKey,
          bounded,
          heldShares: this.approvedShares(),
        } satisfies ShareQuantityDialogData,
      },
    );
    if (!result) return;

    this.runCommand(command, {
      ...this.dated('requestedDate', 'activatedDate'),
      requestedShares: result.requestedShares,
    });
  }

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

  /**
   * Posts a command and re-reads.
   *
   * No error toast: `errorInterceptor` already raises one carrying the platform's own message,
   * and for these that message is the useful one — redeeming more than the client holds, or
   * activating before the linked savings account is active, each say exactly why.
   */
  private runCommand(command: string, body: Record<string, unknown>): void {
    const request$: Observable<unknown> = this.shareService.postAccountsTypeAccountId(
      ShareAccountViewComponent.TYPE,
      this.accountId,
      body,
      command,
    );

    request$.subscribe({
      next: () => {
        void this.notifications.success(this.i18n.translate('COMMON.SUCCESS'));
        this.loadAccount();
      },
      error: () => undefined,
    });
  }

  onBack(): void {
    void this.router.navigate([this.LIST_PATH]);
  }
}
