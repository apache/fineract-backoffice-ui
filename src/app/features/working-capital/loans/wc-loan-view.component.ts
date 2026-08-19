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
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DecimalPipe } from '@angular/common';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular/standalone';
import { CdkTableModule } from '@angular/cdk/table';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import {
  WorkingCapitalLoansService,
  WorkingCapitalLoanChargesService,
  WorkingCapitalLoanTransactionsService,
  WorkingCapitalLoanDelinquencyActionsService,
  WorkingCapitalLoanDelinquencyRangeScheduleService,
  WorkingCapitalLoanBreachScheduleService,
  GetWorkingCapitalLoansLoanIdResponse,
  WorkingCapitalLoanChargeData,
  GetWorkingCapitalLoanTransactionIdResponse,
  WorkingCapitalLoanDelinquencyActionData,
  WorkingCapitalLoanDelinquencyRangeScheduleData,
  WorkingCapitalLoanBreachScheduleData,
} from '../../../api';

/**
 * Detail view for a single Working Capital Loan. Shows a Details key/value
 * summary plus read-only tabs for charges, transactions, delinquency actions,
 * delinquency range schedule and breach schedule, each backed by its own GET.
 */
/**
 * The tabs on this screen, named.
 *
 * They were positional strings — '0', '7' — which say nothing at the point of use and shift
 * meaning whenever a tab is inserted in the middle. The values are still strings because
 * `ion-segment` compares them as such.
 */
export const WC_LOAN_TAB = {
  details: 'details',
  charges: 'charges',
  transactions: 'transactions',
  delinquencyActions: 'delinquencyActions',
  delinquencyRangeSchedule: 'delinquencyRangeSchedule',
  breachSchedule: 'breachSchedule',
} as const;

export type WcLoanTab = (typeof WC_LOAN_TAB)[keyof typeof WC_LOAN_TAB];

@Component({
  selector: 'app-wc-loan-view',
  standalone: true,
  imports: [
    TranslateModule,
    CdkTableModule,
    DecimalPipe,
    IonIcon,
    IonButton,
    IonCardContent,
    IonCard,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonPopover,
    IonList,
    IonItem,
    TooltipDirective,
  ],
  template: `
    <div class="view-container">
      <ion-card class="header-card">
        <ion-card-content class="header-content">
          <div class="loan-title-area">
            <div class="avatar-circle">
              <ion-icon name="business-outline"></ion-icon>
            </div>
            <div class="title-details">
              <h2>#{{ loan()?.accountNo || loanId }}</h2>
              <div class="subtitle-row">
                <span>{{ 'WC_LOANS.CLIENT' | translate }}: {{ loan()?.client?.displayName }}</span>
                <span class="divider">|</span>
                <span>{{ loan()?.status?.value }}</span>
              </div>
            </div>
          </div>
          <div class="actions-area">
            <ion-button fill="clear" (click)="onBack()">
              <ion-icon name="arrow-back-outline"></ion-icon>
              {{ 'COMMON.BACK' | translate }}
            </ion-button>

            @if (isLoanActive) {
              <ion-button
                color="primary"
                (click)="onRepayment()"
                [appTooltip]="'WC_LOANS.REPAYMENT' | translate"
              >
                <ion-icon name="cash-outline"></ion-icon>
                {{ 'WC_LOANS.REPAYMENT' | translate }}
              </ion-button>
            }

            @if (isLoanPendingApproval) {
              <ion-button
                color="secondary"
                (click)="onAction('approve')"
                [appTooltip]="'WC_LOANS.APPROVE' | translate"
              >
                <ion-icon name="checkmark-circle-outline"></ion-icon>
                {{ 'WC_LOANS.APPROVE' | translate }}
              </ion-button>
            }

            @if (isLoanApproved) {
              <ion-button
                color="secondary"
                (click)="onAction('disburse')"
                [appTooltip]="'WC_LOANS.DISBURSE' | translate"
              >
                <ion-icon name="open-outline"></ion-icon>
                {{ 'WC_LOANS.DISBURSE' | translate }}
              </ion-button>
            }

            <ion-button id="loanMenu-trigger">
              <ion-icon name="caret-down-outline"></ion-icon>
              {{ 'COMMON.ACTIONS' | translate }}
            </ion-button>
            <ion-popover trigger="loanMenu-trigger" [dismissOnSelect]="true">
              <ng-template>
                <ion-list>
                  @if (isLoanPendingApproval) {
                    <ion-item button (click)="onEdit()">
                      <ion-icon slot="start" name="create-outline"></ion-icon>
                      <ion-label>{{ 'WC_LOANS.ACTIONS.MODIFY' | translate }}</ion-label>
                    </ion-item>
                    <ion-item button (click)="onAction('reject')">
                      <ion-icon slot="start" name="close-circle-outline"></ion-icon>
                      <ion-label>{{ 'WC_LOANS.ACTIONS.REJECT' | translate }}</ion-label>
                    </ion-item>
                  }
                  @if (isLoanApproved) {
                    <ion-item button (click)="onAction('undoapproval')">
                      <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                      <ion-label>{{ 'WC_LOANS.ACTIONS.UNDO_APPROVAL' | translate }}</ion-label>
                    </ion-item>
                  }
                  @if (isLoanActive) {
                    <ion-item button (click)="onAction('undodisbursal')">
                      <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                      <ion-label>{{ 'WC_LOANS.ACTIONS.UNDO_DISBURSAL' | translate }}</ion-label>
                    </ion-item>
                  }
                  <ion-item button (click)="onDelete()">
                    <ion-icon slot="start" name="trash-outline"></ion-icon>
                    <ion-label>{{ 'WC_LOANS.ACTIONS.DELETE' | translate }}</ion-label>
                  </ion-item>
                </ion-list>
              </ng-template>
            </ion-popover>
          </div>
        </ion-card-content>
      </ion-card>

      <ion-segment [value]="activeTab()" (ionChange)="activeTab.set($any($event).detail.value)">
        <ion-segment-button [value]="TAB.details">
          <ion-label>{{ 'WC_LOANS.TABS.DETAILS' | translate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.charges">
          <ion-label>{{ 'WC_LOANS.TABS.CHARGES' | translate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.transactions">
          <ion-label>{{ 'WC_LOANS.TABS.TRANSACTIONS' | translate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.delinquencyActions">
          <ion-label>{{ 'WC_LOANS.TABS.DELINQUENCY_ACTIONS' | translate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.delinquencyRangeSchedule">
          <ion-label>{{ 'WC_LOANS.TABS.DELINQUENCY_RANGE_SCHEDULE' | translate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.breachSchedule">
          <ion-label>{{ 'WC_LOANS.TABS.BREACH_SCHEDULE' | translate }}</ion-label>
        </ion-segment-button>
      </ion-segment>

      @if (activeTab() === TAB.details) {
        <div class="tab-content">
          <ion-card class="info-card">
            <ion-card-content class="details-list">
              <div class="detail-item">
                <span class="label">{{ 'WC_LOANS.ACCOUNT_NO' | translate }}</span>
                <span class="value">{{ loan()?.accountNo || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ 'WC_LOANS.CLIENT' | translate }}</span>
                <span class="value">{{ loan()?.client?.displayName || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ 'WC_LOANS.PRODUCT' | translate }}</span>
                <span class="value">{{ loan()?.product?.name || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ 'WC_LOANS.PRINCIPAL' | translate }}</span>
                <span class="value">
                  {{ loan()?.currency?.displaySymbol }}
                  {{ loan()?.proposedPrincipal ?? loan()?.approvedPrincipal | number: '1.2-2' }}
                </span>
              </div>
              <div class="detail-item">
                <span class="label">{{ 'WC_LOANS.STATUS' | translate }}</span>
                <span class="value">{{ loan()?.status?.value || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ 'WC_LOANS.REPAYMENT_EVERY' | translate }}</span>
                <span class="value">
                  {{ loan()?.repaymentEvery || '-' }}
                  {{ loan()?.repaymentFrequencyType?.value }}
                </span>
              </div>
              <div class="detail-item">
                <span class="label">{{ 'WC_LOANS.BREACH' | translate }}</span>
                <span class="value">{{ loan()?.breach?.name || '-' }}</span>
              </div>
            </ion-card-content>
          </ion-card>
        </div>
      }
      @if (activeTab() === TAB.charges) {
        <div class="tab-content">
          <ion-card class="table-card">
            <ion-card-content>
              @if (charges().length > 0) {
                <table cdk-table [dataSource]="charges()" class="full-width-table">
                  <ng-container cdkColumnDef="name">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.NAME' | translate }}</th>
                    <td cdk-cell *cdkCellDef="let c">{{ c.name }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="amount">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.AMOUNT' | translate }}</th>
                    <td cdk-cell *cdkCellDef="let c">{{ c.amount | number: '1.2-2' }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="paid">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'WC_LOANS.PAID' | translate }}</th>
                    <td cdk-cell *cdkCellDef="let c">{{ c.amountPaid | number: '1.2-2' }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="outstanding">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.OUTSTANDING' | translate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let c">
                      {{ c.amountOutstanding | number: '1.2-2' }}
                    </td>
                  </ng-container>
                  <tr cdk-header-row *cdkHeaderRowDef="chargeColumns"></tr>
                  <tr cdk-row *cdkRowDef="let row; columns: chargeColumns"></tr>
                </table>
              } @else {
                <div class="empty-state">
                  <ion-icon name="cash-outline"></ion-icon>
                  <p>{{ 'WC_LOANS.NO_DATA' | translate }}</p>
                </div>
              }
            </ion-card-content>
          </ion-card>
        </div>
      }
      @if (activeTab() === TAB.transactions) {
        <div class="tab-content">
          <ion-card class="table-card">
            <ion-card-content>
              @if (transactions().length > 0) {
                <table cdk-table [dataSource]="transactions()" class="full-width-table">
                  <ng-container cdkColumnDef="id">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ID' | translate }}</th>
                    <td cdk-cell *cdkCellDef="let tx">{{ tx.id }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="date">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.DATE' | translate }}</th>
                    <td cdk-cell *cdkCellDef="let tx">{{ tx.transactionDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="type">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.TYPE' | translate }}</th>
                    <td cdk-cell *cdkCellDef="let tx">{{ tx.type?.value }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="amount">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.AMOUNT' | translate }}</th>
                    <td cdk-cell *cdkCellDef="let tx">
                      {{ tx.transactionAmount | number: '1.2-2' }}
                    </td>
                  </ng-container>
                  <tr cdk-header-row *cdkHeaderRowDef="transactionColumns"></tr>
                  <tr cdk-row *cdkRowDef="let row; columns: transactionColumns"></tr>
                </table>
              } @else {
                <div class="empty-state">
                  <ion-icon name="receipt-outline"></ion-icon>
                  <p>{{ 'WC_LOANS.NO_DATA' | translate }}</p>
                </div>
              }
            </ion-card-content>
          </ion-card>
        </div>
      }
      @if (activeTab() === TAB.delinquencyActions) {
        <div class="tab-content">
          <ion-card class="table-card">
            <ion-card-content>
              @if (delinquencyActions().length > 0) {
                <table cdk-table [dataSource]="delinquencyActions()" class="full-width-table">
                  <ng-container cdkColumnDef="action">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'WC_LOANS.ACTION' | translate }}</th>
                    <td cdk-cell *cdkCellDef="let a">{{ a.action }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="startDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.START_DATE' | translate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let a">{{ a.startDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="endDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.END_DATE' | translate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let a">{{ a.endDate }}</td>
                  </ng-container>
                  <tr cdk-header-row *cdkHeaderRowDef="delinquencyActionColumns"></tr>
                  <tr cdk-row *cdkRowDef="let row; columns: delinquencyActionColumns"></tr>
                </table>
              } @else {
                <div class="empty-state">
                  <ion-icon name="hammer-outline"></ion-icon>
                  <p>{{ 'WC_LOANS.NO_DATA' | translate }}</p>
                </div>
              }
            </ion-card-content>
          </ion-card>
        </div>
      }
      @if (activeTab() === TAB.delinquencyRangeSchedule) {
        <div class="tab-content">
          <ion-card class="table-card">
            <ion-card-content>
              @if (delinquencyRangeSchedule().length > 0) {
                <table cdk-table [dataSource]="delinquencyRangeSchedule()" class="full-width-table">
                  <ng-container cdkColumnDef="periodNumber">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'WC_LOANS.PERIOD' | translate }}</th>
                    <td cdk-cell *cdkCellDef="let r">{{ r.periodNumber }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="fromDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.FROM_DATE' | translate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let r">{{ r.fromDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="toDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.TO_DATE' | translate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let r">{{ r.toDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="outstanding">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.OUTSTANDING' | translate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let r">
                      {{ r.outstandingAmount | number: '1.2-2' }}
                    </td>
                  </ng-container>
                  <tr cdk-header-row *cdkHeaderRowDef="delinquencyRangeColumns"></tr>
                  <tr cdk-row *cdkRowDef="let row; columns: delinquencyRangeColumns"></tr>
                </table>
              } @else {
                <div class="empty-state">
                  <ion-icon name="time-outline"></ion-icon>
                  <p>{{ 'WC_LOANS.NO_DATA' | translate }}</p>
                </div>
              }
            </ion-card-content>
          </ion-card>
        </div>
      }
      @if (activeTab() === TAB.breachSchedule) {
        <div class="tab-content">
          <ion-card class="table-card">
            <ion-card-content>
              @if (breachSchedule().length > 0) {
                <table cdk-table [dataSource]="breachSchedule()" class="full-width-table">
                  <ng-container cdkColumnDef="periodNumber">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'WC_LOANS.PERIOD' | translate }}</th>
                    <td cdk-cell *cdkCellDef="let b">{{ b.periodNumber }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="fromDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.FROM_DATE' | translate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let b">{{ b.fromDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="toDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.TO_DATE' | translate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let b">{{ b.toDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="breach">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'WC_LOANS.BREACH' | translate }}</th>
                    <td cdk-cell *cdkCellDef="let b">
                      {{ (b.breach ? 'COMMON.YES' : 'COMMON.NO') | translate }}
                    </td>
                  </ng-container>
                  <tr cdk-header-row *cdkHeaderRowDef="breachScheduleColumns"></tr>
                  <tr cdk-row *cdkRowDef="let row; columns: breachScheduleColumns"></tr>
                </table>
              } @else {
                <div class="empty-state">
                  <ion-icon name="warning-outline"></ion-icon>
                  <p>{{ 'WC_LOANS.NO_DATA' | translate }}</p>
                </div>
              }
            </ion-card-content>
          </ion-card>
        </div>
      }
    </div>
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
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }
      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
      }
      .loan-title-area {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .avatar-circle {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background-color: var(--primary-color, #3f51b5);
        color: #fff;
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
        margin: 0 0 4px 0;
        font-size: 24px;
        font-weight: 600;
      }
      .subtitle-row {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #7f8c8d;
        font-size: 14px;
      }
      .divider {
        color: #bdc3c7;
      }
      .tab-group {
        background-color: var(--card-bg);
        border-radius: 12px;
        box-shadow: var(--shadow-sm);
      }
      .tab-content {
        padding: 24px;
      }
      .info-card {
        border-radius: 8px;
        border: 1px solid var(--border-color);
      }
      .details-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .detail-item {
        display: flex;
        justify-content: space-between;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border-color);
      }
      .detail-item .label {
        color: var(--text-muted);
        font-size: 14px;
        font-weight: 500;
      }
      .detail-item .value {
        color: var(--text-color);
        font-size: 14px;
        font-weight: 600;
      }
      .table-card {
        border: 1px solid var(--border-color);
        box-shadow: none;
      }
      .full-width-table {
        width: 100%;
      }
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px;
        color: #95a5a6;
      }
      .empty-state mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
      }
      .empty-state p {
        margin: 0;
        font-size: 16px;
      }
    `,
  ],
})
export class WcLoanViewComponent implements OnInit {
  /** Selected tab; mat-tab-group tracked this internally, ion-segment does not. */
  /** Exposed so the template names its tabs instead of numbering them. */
  protected readonly TAB = WC_LOAN_TAB;

  readonly activeTab = signal<WcLoanTab>(WC_LOAN_TAB.details);
  private readonly loansService = inject(WorkingCapitalLoansService);
  private readonly chargesService = inject(WorkingCapitalLoanChargesService);
  private readonly transactionsService = inject(WorkingCapitalLoanTransactionsService);
  private readonly delinquencyActionsService = inject(WorkingCapitalLoanDelinquencyActionsService);
  private readonly delinquencyRangeScheduleService = inject(
    WorkingCapitalLoanDelinquencyRangeScheduleService,
  );
  private readonly breachScheduleService = inject(WorkingCapitalLoanBreachScheduleService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  loanId = 0;
  readonly loan = signal<GetWorkingCapitalLoansLoanIdResponse | null>(null);
  readonly charges = signal<WorkingCapitalLoanChargeData[]>([]);
  readonly transactions = signal<GetWorkingCapitalLoanTransactionIdResponse[]>([]);
  readonly delinquencyActions = signal<WorkingCapitalLoanDelinquencyActionData[]>([]);
  readonly delinquencyRangeSchedule = signal<WorkingCapitalLoanDelinquencyRangeScheduleData[]>([]);
  readonly breachSchedule = signal<WorkingCapitalLoanBreachScheduleData[]>([]);

  chargeColumns = ['name', 'amount', 'paid', 'outstanding'];
  transactionColumns = ['id', 'date', 'type', 'amount'];
  delinquencyActionColumns = ['action', 'startDate', 'endDate'];
  delinquencyRangeColumns = ['periodNumber', 'fromDate', 'toDate', 'outstanding'];
  breachScheduleColumns = ['periodNumber', 'fromDate', 'toDate', 'breach'];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loanId = +id;
      this.loadData();
    }
  }

  loadData(): void {
    this.loansService.getWorkingCapitalLoansLoanId(this.loanId).subscribe({
      next: (data) => this.loan.set(data),
      error: (err: unknown) => console.error('Failed to load working-capital loan', err),
    });

    this.chargesService.getWorkingCapitalLoansLoanIdCharges(this.loanId).subscribe({
      next: (data) => this.charges.set(data ?? []),
      error: (err: unknown) => console.error('Failed to load loan charges', err),
    });

    this.transactionsService.getWorkingCapitalLoansLoanIdTransactions(this.loanId).subscribe({
      next: (data) => this.transactions.set(data.content ?? []),
      error: (err: unknown) => console.error('Failed to load loan transactions', err),
    });

    this.delinquencyActionsService
      .getWorkingCapitalLoansLoanIdDelinquencyActions(this.loanId)
      .subscribe({
        next: (data) => this.delinquencyActions.set(data ?? []),
        error: (err: unknown) => console.error('Failed to load delinquency actions', err),
      });

    this.delinquencyRangeScheduleService
      .getWorkingCapitalLoansLoanIdDelinquencyRangeSchedule(this.loanId)
      .subscribe({
        next: (data) => this.delinquencyRangeSchedule.set(data ?? []),
        error: (err: unknown) => console.error('Failed to load delinquency range schedule', err),
      });

    this.breachScheduleService.getWorkingCapitalLoansLoanIdBreachSchedule(this.loanId).subscribe({
      next: (data) => this.breachSchedule.set(data ?? []),
      error: (err: unknown) => console.error('Failed to load breach schedule', err),
    });
  }

  get isLoanPendingApproval(): boolean {
    return this.loan()?.status?.pendingApproval === true;
  }

  get isLoanApproved(): boolean {
    return this.loan()?.status?.waitingForDisbursal === true;
  }

  get isLoanActive(): boolean {
    return this.loan()?.status?.active === true;
  }

  onRepayment(): void {
    this.router.navigate([`/working-capital/loans/${this.loanId}/action/repayment`]);
  }

  onAction(command: string): void {
    this.router.navigate([`/working-capital/loans/${this.loanId}/action/${command}`]);
  }

  onEdit(): void {
    this.router.navigate([`/working-capital/loans/edit/${this.loanId}`]);
  }

  onDelete(): void {
    if (!confirm('Delete this loan?')) return;
    this.loansService.deleteWorkingCapitalLoansLoanId(this.loanId).subscribe({
      next: () => this.router.navigate(['/working-capital/loans']),
      error: (err: unknown) => console.error('Failed to delete loan', err),
    });
  }

  onBack(): void {
    this.router.navigate(['/working-capital/loans']);
  }
}
