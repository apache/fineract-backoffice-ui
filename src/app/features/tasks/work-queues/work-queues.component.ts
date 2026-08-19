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
import { Router } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  IonButton,
  IonCheckbox,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from '@ionic/angular/standalone';

import {
  BatchAPIService,
  BatchRequest,
  ClientService,
  LoansService,
  RescheduleLoansService,
} from '../../../api';
import { I18N, TranslatePipe } from '../../../core/adapters';
import { DialogService } from '../../../core/services/dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RequiresPermissionDirective } from '../../../shared';
import { FINERACT_DATE_FORMAT, formatDateToFineract } from '../../../core/utils/date-formatter';

/**
 * Fineract's loan status ids. The list endpoint takes the **number**, and answers 500 with a
 * NumberFormatException if given the display name — so these are not decoration.
 */
const LOAN_STATUS = { pendingApproval: 100, approvedAwaitingDisbursal: 200 } as const;

interface QueueRow {
  id: number;
  primary: string;
  secondary: string;
  amount?: number;
  date?: string;
  selected: boolean;
}

type QueueKey = 'loanApproval' | 'loanDisbursal' | 'clientActivation' | 'rescheduleApproval';

/**
 * The approvals a branch works through in a batch rather than one record at a time.
 *
 * Each queue is a real platform query — pending loans, loans awaiting disbursal, pending clients,
 * pending reschedule requests — and each action goes through `POST /batches`, which carries the
 * whole selection in one request and answers with a status **per item**. That per-item status is
 * why the result is reported as "7 of 9 approved" with the two failures named, instead of one
 * toast that hides a partial failure.
 *
 * The two list filters disagree with each other, and both spellings are the platform's:
 * `/loans` wants a numeric status id, while `/clients` wants a lowercase name and rejects the
 * number. Getting either wrong is a 500 or a 400, not an empty list.
 */
@Component({
  selector: 'app-work-queues',
  standalone: true,
  imports: [
    TranslatePipe,
    DatePipe,
    DecimalPipe,
    RequiresPermissionDirective,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonCheckbox,
    IonButton,
    IonSpinner,
  ],
  template: `
    <div class="queue-container">
      <h1>{{ 'WORK_QUEUES.TITLE' | appTranslate }}</h1>

      <ion-segment [value]="activeQueue()" (ionChange)="onQueueChange($any($event).detail.value)">
        <ion-segment-button value="loanApproval" data-testid="queue-loan-approval">
          <ion-label>{{ 'WORK_QUEUES.LOAN_APPROVAL' | appTranslate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="loanDisbursal" data-testid="queue-loan-disbursal">
          <ion-label>{{ 'WORK_QUEUES.LOAN_DISBURSAL' | appTranslate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="clientActivation" data-testid="queue-client-activation">
          <ion-label>{{ 'WORK_QUEUES.CLIENT_ACTIVATION' | appTranslate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="rescheduleApproval" data-testid="queue-reschedule-approval">
          <ion-label>{{ 'WORK_QUEUES.RESCHEDULE_APPROVAL' | appTranslate }}</ion-label>
        </ion-segment-button>
      </ion-segment>

      @if (isLoading()) {
        <ion-spinner data-testid="queue-loading"></ion-spinner>
      } @else if (rows().length === 0) {
        <p class="empty-state" data-testid="queue-empty">
          {{ 'WORK_QUEUES.EMPTY' | appTranslate }}
        </p>
      } @else {
        <table class="queue-table" data-testid="queue-table">
          <thead>
            <tr>
              <th>
                <ion-checkbox
                  data-testid="queue-select-all"
                  [checked]="allSelected()"
                  [attr.aria-label]="'WORK_QUEUES.SELECT_ALL' | appTranslate"
                  (ionChange)="onSelectAll($any($event).detail.checked)"
                ></ion-checkbox>
              </th>
              <th>{{ 'COMMON.NAME' | appTranslate }}</th>
              <th>{{ 'COMMON.DETAILS' | appTranslate }}</th>
              <th>{{ 'COMMON.AMOUNT' | appTranslate }}</th>
              <th>{{ 'COMMON.DATE' | appTranslate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr>
                <td>
                  <ion-checkbox
                    [attr.data-testid]="'queue-select-' + row.id"
                    [checked]="row.selected"
                    [attr.aria-label]="row.primary"
                    (ionChange)="onSelectRow(row, $any($event).detail.checked)"
                  ></ion-checkbox>
                </td>
                <td>
                  <button type="button" class="clickable-link" (click)="openRecord(row)">
                    {{ row.primary }}
                  </button>
                </td>
                <td>{{ row.secondary }}</td>
                <td>{{ row.amount !== undefined ? (row.amount | number: '1.2-2') : '-' }}</td>
                <td>{{ row.date ? (row.date | date: 'mediumDate') : '-' }}</td>
              </tr>
            }
          </tbody>
        </table>

        <div class="actions">
          <span data-testid="queue-selected-count">
            {{ 'WORK_QUEUES.SELECTED' | appTranslate }}: {{ selectedRows().length }}
          </span>
          <ion-button
            data-testid="queue-run"
            [disabled]="selectedRows().length === 0 || isRunning()"
            [appRequiresPermission]="requiredPermission()"
            (click)="onRun()"
          >
            @if (isRunning()) {
              <ion-spinner name="dots"></ion-spinner>
            } @else {
              {{ actionLabel() | appTranslate }}
            }
          </ion-button>
        </div>
      }

      @if (lastResult(); as result) {
        <p class="result" role="status" data-testid="queue-result">{{ result }}</p>
      }
    </div>
  `,
  styles: [
    `
      .queue-container {
        padding: 16px;
      }
      h1 {
        font-size: 1.25rem;
      }
      .queue-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 16px;
      }
      .queue-table th,
      .queue-table td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid var(--ion-color-light-shade);
      }
      .clickable-link {
        cursor: pointer;
        color: var(--ion-color-primary);
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        text-decoration: underline;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-top: 16px;
      }
      .empty-state {
        color: #95a5a6;
        padding: 24px 0;
      }
    `,
  ],
})
export class WorkQueuesComponent implements OnInit {
  private readonly loansService = inject(LoansService);
  private readonly clientService = inject(ClientService);
  private readonly rescheduleService = inject(RescheduleLoansService);
  private readonly batchService = inject(BatchAPIService);
  private readonly dialog = inject(DialogService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18N);

  readonly activeQueue = signal<QueueKey>('loanApproval');
  readonly rows = signal<QueueRow[]>([]);
  readonly isLoading = signal(false);
  readonly isRunning = signal(false);
  readonly lastResult = signal<string | null>(null);

  readonly selectedRows = computed(() => this.rows().filter((row) => row.selected));
  readonly allSelected = computed(
    () => this.rows().length > 0 && this.rows().every((row) => row.selected),
  );

  readonly requiredPermission = computed(
    () =>
      ({
        loanApproval: 'APPROVE_LOAN',
        loanDisbursal: 'DISBURSE_LOAN',
        clientActivation: 'ACTIVATE_CLIENT',
        rescheduleApproval: 'APPROVE_RESCHEDULELOAN',
      })[this.activeQueue()],
  );

  readonly actionLabel = computed(
    () =>
      ({
        loanApproval: 'WORK_QUEUES.APPROVE_SELECTED',
        loanDisbursal: 'WORK_QUEUES.DISBURSE_SELECTED',
        clientActivation: 'WORK_QUEUES.ACTIVATE_SELECTED',
        rescheduleApproval: 'WORK_QUEUES.APPROVE_SELECTED',
      })[this.activeQueue()],
  );

  ngOnInit(): void {
    this.load();
  }

  onQueueChange(queue: QueueKey): void {
    this.activeQueue.set(queue);
    this.lastResult.set(null);
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.rows.set([]);

    switch (this.activeQueue()) {
      case 'loanApproval':
        this.loadLoans(LOAN_STATUS.pendingApproval);
        break;
      case 'loanDisbursal':
        this.loadLoans(LOAN_STATUS.approvedAwaitingDisbursal);
        break;
      case 'clientActivation':
        this.loadPendingClients();
        break;
      case 'rescheduleApproval':
        this.loadRescheduleRequests();
        break;
    }
  }

  private loadLoans(status: number): void {
    this.loansService
      .getLoans(
        undefined,
        0,
        200,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        `${status}`,
      )
      .subscribe({
        next: (page) => {
          const items = [...((page?.pageItems as Iterable<LoanQueueItem>) ?? [])];
          this.rows.set(
            items.map((loan) => ({
              id: loan.id as number,
              primary: loan.accountNo ?? `${loan.id}`,
              secondary: `${loan.clientName ?? ''} — ${loan.loanProductName ?? ''}`,
              amount: loan.principal,
              date: undefined,
              selected: false,
            })),
          );
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  private loadPendingClients(): void {
    // `pending`, lowercase and spelled out. This endpoint rejects the numeric status id that the
    // loans endpoint insists on.
    // Positional: (officeId, externalId, displayName, firstName, lastName, status, ...), so
    // `status` is the sixth argument and the paging pair comes after it.
    this.clientService
      .getClients(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'pending',
        undefined,
        0,
        200,
      )
      .subscribe({
        next: (page) => {
          const items = [...((page?.pageItems as Iterable<ClientQueueItem>) ?? [])];
          this.rows.set(
            items.map((client) => ({
              id: client.id as number,
              primary: client.displayName ?? `${client.id}`,
              secondary: client.officeName ?? '',
              amount: undefined,
              date: undefined,
              selected: false,
            })),
          );
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  private loadRescheduleRequests(): void {
    this.rescheduleService.getRescheduleloans('pending').subscribe({
      next: (requests) => {
        const items = [...((requests as unknown as Iterable<RescheduleQueueItem>) ?? [])];
        this.rows.set(
          items.map((request) => ({
            id: request.id as number,
            primary: request.loanAccountNumber ?? `${request.id}`,
            secondary: request.clientName ?? '',
            amount: undefined,
            date: undefined,
            selected: false,
          })),
        );
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  onSelectRow(row: QueueRow, checked: boolean): void {
    this.rows.update((rows) =>
      rows.map((candidate) =>
        candidate.id === row.id ? { ...candidate, selected: checked } : candidate,
      ),
    );
  }

  onSelectAll(checked: boolean): void {
    this.rows.update((rows) => rows.map((row) => ({ ...row, selected: checked })));
  }

  openRecord(row: QueueRow): void {
    const target =
      this.activeQueue() === 'clientActivation'
        ? ['/clients/view', row.id]
        : ['/loans/view', row.id];
    void this.router.navigate(target);
  }

  async onRun(): Promise<void> {
    const selected = this.selectedRows();
    if (selected.length === 0) {
      return;
    }

    const confirmed = await this.dialog.confirm({
      title: this.i18n.translate(this.actionLabel()),
      message: this.i18n.translate('WORK_QUEUES.CONFIRM', { count: selected.length }),
    });
    if (!confirmed) {
      return;
    }

    this.isRunning.set(true);
    this.batchService
      .postBatches(selected.map((row, index) => this.toBatchRequest(row, index)))
      .subscribe({
        next: (responses) => {
          this.isRunning.set(false);
          this.reportOutcome(
            [...((responses as unknown as Iterable<BatchResponse>) ?? [])],
            selected,
          );
          this.load();
        },
        error: () => this.isRunning.set(false),
      });
  }

  private toBatchRequest(row: QueueRow, index: number): BatchRequest {
    const today = formatDateToFineract(new Date());
    const dated = (field: string) =>
      JSON.stringify({ [field]: today, locale: 'en', dateFormat: FINERACT_DATE_FORMAT });

    const request: Record<QueueKey, { relativeUrl: string; body: string }> = {
      loanApproval: {
        relativeUrl: `loans/${row.id}?command=approve`,
        body: dated('approvedOnDate'),
      },
      loanDisbursal: {
        relativeUrl: `loans/${row.id}?command=disburse`,
        body: dated('actualDisbursementDate'),
      },
      clientActivation: {
        relativeUrl: `clients/${row.id}?command=activate`,
        body: dated('activationDate'),
      },
      rescheduleApproval: {
        relativeUrl: `rescheduleloans/${row.id}?command=approve`,
        body: dated('approvedOnDate'),
      },
    };

    const { relativeUrl, body } = request[this.activeQueue()];
    return { requestId: index + 1, relativeUrl, method: 'POST', body } as BatchRequest;
  }

  /**
   * The batch endpoint answers 200 with a per-item status, so a partial failure looks exactly
   * like a success unless each item is read. Anything that is not 200 is named.
   */
  private reportOutcome(responses: BatchResponse[], selected: QueueRow[]): void {
    const failed = responses.filter((response) => response.statusCode !== 200);
    const succeeded = responses.length - failed.length;

    if (failed.length === 0) {
      this.lastResult.set(this.i18n.translate('WORK_QUEUES.ALL_SUCCEEDED', { count: succeeded }));
      this.notifications.success(
        this.i18n.translate('WORK_QUEUES.ALL_SUCCEEDED', { count: succeeded }),
      );
      return;
    }

    const names = failed
      .map((response) => selected[(response.requestId ?? 1) - 1]?.primary)
      .filter(Boolean)
      .join(', ');
    const message = this.i18n.translate('WORK_QUEUES.PARTIAL', {
      succeeded,
      total: responses.length,
      names,
    });
    this.lastResult.set(message);
    this.notifications.error(message);
  }
}

interface LoanQueueItem {
  id?: number;
  accountNo?: string;
  clientName?: string;
  loanProductName?: string;
  principal?: number;
}

interface ClientQueueItem {
  id?: number;
  displayName?: string;
  officeName?: string;
}

interface RescheduleQueueItem {
  id?: number;
  loanAccountNumber?: string;
  clientName?: string;
}

interface BatchResponse {
  requestId?: number;
  statusCode?: number;
  body?: string;
}
