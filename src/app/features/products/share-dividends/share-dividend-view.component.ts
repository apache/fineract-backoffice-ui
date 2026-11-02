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
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import {
  I18N,
  SHARE_DIVIDEND_API,
  TranslatePipe,
  type ShareDividend,
  type ShareDividendPayout,
  type ShareDividendPayoutPage,
} from '../../../core/adapters';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigService } from '../../../core/services/config.service';
import { DialogService } from '../../../core/services/dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  CellTemplateDirective,
  ColumnDef,
  PageEvent,
  RequiresPermissionDirective,
} from '../../../shared';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { LoadErrorComponent } from '../../../shared/components/load-error/load-error.component';
import { ButtonComponent } from '../../../ui/button/button.component';
import { CardComponent } from '../../../ui/card/card.component';
import { SpinnerComponent } from '../../../ui/spinner/spinner.component';

/** Status codes Fineract uses for a dividend and for each account's share of it. */
const STATUS_KEYS: Record<string, string> = {
  pending: 'SHARE_DIVIDENDS.STATUS_PENDING',
  approved: 'SHARE_DIVIDENDS.STATUS_APPROVED',
  posted: 'SHARE_DIVIDENDS.STATUS_POSTED',
  unknown: 'SHARE_DIVIDENDS.STATUS_UNKNOWN',
};

/**
 * One declared share dividend: its period, total and status, the amount each share account
 * receives, and the actions that move it on. Fineract credits the accounts only after the
 * dividend is approved, and deletes it only while it is still pending.
 */
@Component({
  selector: 'app-share-dividend-view',
  standalone: true,
  imports: [
    TranslatePipe,
    DataTableComponent,
    CellTemplateDirective,
    ButtonComponent,
    CardComponent,
    SpinnerComponent,
    LoadErrorComponent,
    RequiresPermissionDirective,
  ],
  template: `
    <div class="view-container">
      <app-button
        type="button"
        emphasis="quiet"
        icon="arrow-back-outline"
        [link]="['/products/shares', productId, 'dividends']"
        >{{ 'COMMON.BACK' | appTranslate }}</app-button
      >

      @if (loadError() === 'forbidden') {
        <app-load-error
          testId="share-dividend-load-error"
          icon="lock-closed-outline"
          [message]="'SHARE_DIVIDENDS.NO_ACCESS' | appTranslate"
        ></app-load-error>
      } @else if (loadError() === 'not-found') {
        <app-load-error
          testId="share-dividend-load-error"
          [message]="'SHARE_DIVIDENDS.NOT_FOUND' | appTranslate"
        ></app-load-error>
      } @else if (loadError() === 'failed') {
        <app-load-error
          testId="share-dividend-load-error"
          [message]="'SHARE_DIVIDENDS.LOAD_FAILED' | appTranslate"
          [actionLabel]="'COMMON.RETRY' | appTranslate"
          (action)="load()"
        ></app-load-error>
      } @else if (dividend(); as d) {
        <app-card heading="SHARE_DIVIDENDS.DETAIL_TITLE">
          <dl class="summary" data-testid="share-dividend-summary">
            <div>
              <dt>{{ 'SHARE_DIVIDENDS.PERIOD' | appTranslate }}</dt>
              <dd>{{ d.periodStartDate ?? '-' }} – {{ d.periodEndDate ?? '-' }}</dd>
            </div>
            <div>
              <dt>{{ 'SHARE_DIVIDENDS.TOTAL_AMOUNT' | appTranslate }}</dt>
              <dd>{{ d.amount ?? '-' }}</dd>
            </div>
            <div>
              <dt>{{ 'SHARE_DIVIDENDS.ACCOUNTS' | appTranslate }}</dt>
              <dd>{{ accountCount() ?? '-' }}</dd>
            </div>
            <div>
              <dt>{{ 'COMMON.STATUS' | appTranslate }}</dt>
              <dd data-testid="share-dividend-status">{{ statusKey(d.status) | appTranslate }}</dd>
            </div>
          </dl>

          @if (d.status === 'pending' && approvalSubmitted()) {
            <p class="submitted-note" data-testid="share-dividend-approval-submitted">
              {{ 'SHARE_DIVIDENDS.APPROVAL_SUBMITTED' | appTranslate }}
            </p>
          }

          @if (d.status === 'pending') {
            <div class="actions">
              <app-button
                type="button"
                intent="danger"
                emphasis="outline"
                icon="trash-outline"
                data-testid="share-dividend-delete"
                appRequiresPermission="DELETE_DIVIDEND_SHAREPRODUCT"
                [disabled]="!canDelete() || busy() || approvalSent()"
                (click)="onDelete()"
                >{{ 'COMMON.DELETE' | appTranslate }}</app-button
              >
              <app-button
                type="button"
                icon="checkmark-done-outline"
                data-testid="share-dividend-approve"
                appRequiresPermission="APPROVE_DIVIDEND_SHAREPRODUCT"
                [disabled]="!canApprove() || busy() || accountCount() === null || approvalSent()"
                [busy]="approving()"
                (click)="onApprove()"
                >{{ 'SHARE_DIVIDENDS.APPROVE' | appTranslate }}</app-button
              >
            </div>
          }
        </app-card>

        <app-data-table
          title="SHARE_DIVIDENDS.PAYOUTS_TITLE"
          searchLabel="SHARE_DIVIDENDS.SEARCH_ACCOUNT_NO"
          searchPlaceholder="SHARE_DIVIDENDS.SEARCH_ACCOUNT_NO"
          [columns]="columns"
          [data]="payouts()"
          [totalRecords]="totalRecords()"
          [pageSize]="pageSize"
          [pageIndex]="pageIndex()"
          [isLoading]="payoutsLoading()"
          [hasError]="payoutsError() !== null"
          [errorStatus]="payoutsError()"
          (searchChange)="onSearch($event)"
          (pageChange)="onPage($event)"
          (retry)="loadPayouts()"
        >
          <ng-template appCellTemplate="status" let-row>
            {{ statusKey(row.status) | appTranslate }}
          </ng-template>
        </app-data-table>
      } @else {
        <app-spinner [label]="'COMMON.LOADING' | appTranslate" />
      }
    </div>
  `,
  styles: [
    `
      .view-container {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }
      .view-container > app-button {
        align-self: flex-start;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        margin: 0;
      }
      .summary dt {
        color: var(--ion-color-medium);
        font-size: 0.85rem;
      }
      .summary dd {
        margin: 4px 0 0;
        font-weight: 500;
      }
      .submitted-note {
        margin: 16px 0 0;
        color: var(--ion-color-medium);
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
      }
    `,
  ],
})
export class ShareDividendViewComponent implements OnInit {
  private readonly api = inject(SHARE_DIVIDEND_API);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly config = inject(ConfigService);
  private readonly dialogService = inject(DialogService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);
  private headerRequest = 0;
  private payoutRequest = 0;

  readonly columns: ColumnDef[] = [
    { key: 'accountNo', label: 'SHARE_DIVIDENDS.ACCOUNT_NO', sortable: false },
    { key: 'clientName', label: 'SHARE_DIVIDENDS.CLIENT', sortable: false },
    { key: 'amount', label: 'SHARE_DIVIDENDS.AMOUNT', sortable: false },
    { key: 'status', label: 'COMMON.STATUS', sortable: false },
  ];
  readonly pageSize = 10;

  productId!: number;
  dividendId!: number;
  private accountNo = '';

  readonly dividend = signal<ShareDividend | null>(null);
  readonly loadError = signal<'forbidden' | 'not-found' | 'failed' | null>(null);
  readonly payouts = signal<ShareDividendPayout[]>([]);
  readonly totalRecords = signal(0);
  readonly pageIndex = signal(0);
  readonly payoutsLoading = signal(false);
  readonly payoutsError = signal<number | null>(null);
  /** Accounts the whole dividend pays, from the last page read without an account filter. */
  readonly accountCount = signal<number | null>(null);
  /** True from the approve request until the refresh after it lands, so it cannot be sent twice. */
  readonly approving = signal(false);
  readonly deleting = signal(false);
  readonly busy = computed(() => this.approving() || this.deleting());
  /**
   * Maker-checker queued this user's approval. The dividend stays pending until a checker acts,
   * so Approve is held off here rather than letting the same command be queued again.
   */
  readonly approvalSubmitted = signal(false);
  /**
   * An approval went through from this page, queued or applied. Approve and Delete stay held off
   * even if the refresh that would show the new status fails.
   */
  readonly approvalSent = signal(false);

  readonly statusKey = (status: string): string => STATUS_KEYS[status] ?? STATUS_KEYS['unknown'];

  /**
   * Read in the template as well as through appRequiresPermission: the directive marks only the
   * host, and the button's own `[disabled]` binding is what keeps the control disabled. Like the
   * directive, it lets everything through when the deployment turns RBAC display off.
   */
  readonly canApprove = computed(() => this.granted('APPROVE_DIVIDEND_SHAREPRODUCT'));
  readonly canDelete = computed(() => this.granted('DELETE_DIVIDEND_SHAREPRODUCT'));

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.productId = Number(params.get('productId'));
    this.dividendId = Number(params.get('dividendId'));
    this.load();
  }

  /**
   * Loads the header from the product's dividend list together with a page of payouts. Either
   * failing hides the page: a payout table under a header that could not be read says nothing.
   * `refresh` keeps what is on screen, the page and the account search, as after an approval,
   * and a refresh that fails for any reason but 403 or 404 leaves it there; the error
   * interceptor reports the failure.
   */
  load(refresh = false): void {
    // The header has its own token: paging or searching during a refresh must not drop it.
    const header = ++this.headerRequest;
    const request = ++this.payoutRequest;
    this.loadError.set(null);
    if (!refresh) {
      this.dividend.set(null);
      this.accountNo = '';
      this.pageIndex.set(0);
    }
    const accountNo = this.accountNo;
    forkJoin({
      dividends: this.api.list(this.productId),
      page: this.api.get(this.productId, this.dividendId, this.payoutQuery()),
    })
      .pipe(finalize(() => refresh && this.approving.set(false)))
      .subscribe({
        next: ({ dividends, page }) => {
          if (header !== this.headerRequest) return;
          const dividend = dividends.find((d) => d.id === this.dividendId);
          if (!dividend) {
            this.dividend.set(null);
            this.loadError.set('not-found');
            return;
          }
          this.dividend.set(dividend);
          if (request !== this.payoutRequest) return;
          this.applyPage(page);
          if (!accountNo) this.accountCount.set(page.totalFilteredRecords);
        },
        error: (error: unknown) => {
          if (header !== this.headerRequest) return;
          const status = error instanceof HttpErrorResponse ? error.status : 0;
          if (refresh && status !== 403 && status !== 404 && this.dividend()) return;
          this.loadError.set(
            status === 403 ? 'forbidden' : status === 404 ? 'not-found' : 'failed',
          );
        },
      });
  }

  loadPayouts(): void {
    const request = ++this.payoutRequest;
    const accountNo = this.accountNo;
    this.payoutsLoading.set(true);
    this.api.get(this.productId, this.dividendId, this.payoutQuery()).subscribe({
      next: (page) => {
        if (request !== this.payoutRequest) return;
        this.applyPage(page);
        if (!accountNo) this.accountCount.set(page.totalFilteredRecords);
      },
      error: (error: unknown) => {
        if (request !== this.payoutRequest) return;
        this.payoutsLoading.set(false);
        this.payouts.set([]);
        this.payoutsError.set(error instanceof HttpErrorResponse ? error.status : null);
      },
    });
  }

  onSearch(value: string): void {
    this.accountNo = value.trim();
    this.pageIndex.set(0);
    this.loadPayouts();
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.loadPayouts();
  }

  async onApprove(): Promise<void> {
    const dividend = this.dividend();
    if (
      !dividend ||
      dividend.status !== 'pending' ||
      !this.canApprove() ||
      this.busy() ||
      this.approvalSent()
    ) {
      return;
    }
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('SHARE_DIVIDENDS.APPROVE_TITLE'),
      message: this.i18n.translate('SHARE_DIVIDENDS.CONFIRM_APPROVE', {
        amount: dividend.amount ?? '',
        count: this.accountCount() ?? '',
        startDate: dividend.periodStartDate ?? '-',
        endDate: dividend.periodEndDate ?? '-',
      }),
      confirmText: this.i18n.translate('SHARE_DIVIDENDS.APPROVE'),
    });
    if (!confirmed) return;
    this.approving.set(true);
    this.api.approve(this.productId, this.dividendId).subscribe({
      next: ({ pendingApproval }) => {
        this.approvalSubmitted.set(pendingApproval);
        this.approvalSent.set(true);
        void this.notifications.success(
          this.i18n.translate(
            pendingApproval ? 'COMMON.MUTATION_SUBMITTED_FOR_APPROVAL' : 'SHARE_DIVIDENDS.APPROVED',
          ),
        );
        this.load(true);
      },
      // The error interceptor reports the failure.
      error: () => this.approving.set(false),
    });
  }

  async onDelete(): Promise<void> {
    const dividend = this.dividend();
    if (
      !dividend ||
      dividend.status !== 'pending' ||
      !this.canDelete() ||
      this.busy() ||
      // Approved, or a checker is about to act on it: deleting it would fail either way.
      this.approvalSent()
    ) {
      return;
    }
    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('SHARE_DIVIDENDS.DELETE'),
      message: this.i18n.translate('SHARE_DIVIDENDS.CONFIRM_DELETE', {
        amount: dividend.amount ?? '',
        startDate: dividend.periodStartDate ?? '-',
        endDate: dividend.periodEndDate ?? '-',
      }),
      destructive: true,
    });
    if (!confirmed) return;
    this.deleting.set(true);
    this.api.delete(this.productId, this.dividendId).subscribe({
      next: () => {
        this.deleting.set(false);
        void this.notifications.success(this.i18n.translate('SHARE_DIVIDENDS.DELETED'));
        void this.router.navigate(['/products/shares', this.productId, 'dividends']);
      },
      error: () => this.deleting.set(false),
    });
  }

  private granted(code: string): boolean {
    this.auth.currentUser();
    return !this.config.rbacEnabled() || this.auth.hasPermission(code);
  }

  /** The current page and account search; an empty search is left off the request. */
  private payoutQuery(): { offset: number; limit: number; accountNo?: string } {
    const query = { offset: this.pageIndex() * this.pageSize, limit: this.pageSize };
    return this.accountNo ? { ...query, accountNo: this.accountNo } : query;
  }

  private applyPage(page: ShareDividendPayoutPage): void {
    this.payoutsLoading.set(false);
    this.payoutsError.set(null);
    this.payouts.set([...page.items]);
    this.totalRecords.set(page.totalFilteredRecords);
  }
}
