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

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  viewChildren,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '../../../core/adapters';
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
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { CdkTableModule } from '@angular/cdk/table';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import {
  WorkingCapitalLoansService,
  WorkingCapitalLoanChargesService,
  WorkingCapitalLoanTransactionsService,
  WorkingCapitalLoanDelinquencyActionsService,
  WorkingCapitalLoanDelinquencyRangeScheduleService,
  WorkingCapitalLoanBreachScheduleService,
  WorkingCapitalLoanBreachActionsService,
  WorkingCapitalLoanNearBreachActionsService,
  WorkingCapitalLoanOriginatorsService,
  LoanOriginatorsService,
  GetWorkingCapitalLoansLoanIdResponse,
  WorkingCapitalLoanChargeData,
  GetWorkingCapitalLoanTransactionIdResponse,
  WorkingCapitalLoanDelinquencyActionData,
  WorkingCapitalLoanDelinquencyRangeScheduleData,
  WorkingCapitalLoanBreachScheduleData,
  WorkingCapitalLoanBreachActionData,
  WorkingCapitalLoanNearBreachActionData,
  LoanOriginatorData,
  WorkingCapitalLoanPeriodPaymentRateChangeData,
  ProjectedAmortizationScheduleData,
  GetWorkingCapitalLoanDelinquencyRangeScheduleTagHistoryResponse,
} from '../../../api';

/**
 * Detail view for a single Working Capital Loan. Shows a Details key/value summary plus tabs for
 * charges, transactions, delinquency range schedule and breach schedule (read-only, each backed
 * by its own GET), and delinquency actions, breach actions, near-breach actions and originators
 * (read/write).
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
  breachActions: 'breachActions',
  nearBreachActions: 'nearBreachActions',
  originators: 'originators',
  rateChanges: 'rateChanges',
  amortizationSchedule: 'amortizationSchedule',
  delinquencyRangeTags: 'delinquencyRangeTags',
} as const;

export type WcLoanTab = (typeof WC_LOAN_TAB)[keyof typeof WC_LOAN_TAB];

@Component({
  selector: 'app-wc-loan-view',
  standalone: true,
  imports: [
    TranslatePipe,
    FormsModule,
    CdkTableModule,
    DecimalPipe,
    IonIcon,
    IonButton,
    IonCardContent,
    IonCard,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
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
                <span
                  >{{ 'WC_LOANS.CLIENT' | appTranslate }}: {{ loan()?.client?.displayName }}</span
                >
                <span class="divider">|</span>
                <span>{{ loan()?.status?.value }}</span>
              </div>
            </div>
          </div>
          <div class="actions-area">
            <ion-button fill="clear" (click)="onBack()">
              <ion-icon name="arrow-back-outline"></ion-icon>
              {{ 'COMMON.BACK' | appTranslate }}
            </ion-button>

            @if (isLoanActive) {
              <ion-button
                color="primary"
                (click)="onRepayment()"
                [appTooltip]="'WC_LOANS.REPAYMENT' | appTranslate"
              >
                <ion-icon name="cash-outline"></ion-icon>
                {{ 'WC_LOANS.REPAYMENT' | appTranslate }}
              </ion-button>
            }

            @if (isLoanPendingApproval) {
              <ion-button
                color="secondary"
                (click)="onAction('approve')"
                [appTooltip]="'WC_LOANS.APPROVE' | appTranslate"
              >
                <ion-icon name="checkmark-circle-outline"></ion-icon>
                {{ 'WC_LOANS.APPROVE' | appTranslate }}
              </ion-button>
            }

            @if (isLoanApproved) {
              <ion-button
                color="secondary"
                (click)="onAction('disburse')"
                [appTooltip]="'WC_LOANS.DISBURSE' | appTranslate"
              >
                <ion-icon name="open-outline"></ion-icon>
                {{ 'WC_LOANS.DISBURSE' | appTranslate }}
              </ion-button>
            }

            <ion-button id="loanMenu-trigger">
              <ion-icon name="caret-down-outline"></ion-icon>
              {{ 'COMMON.ACTIONS' | appTranslate }}
            </ion-button>
            <ion-popover trigger="loanMenu-trigger" [dismissOnSelect]="true">
              <ng-template>
                <ion-list>
                  @if (isLoanPendingApproval) {
                    <ion-item button (click)="onEdit()">
                      <ion-icon slot="start" name="create-outline"></ion-icon>
                      <ion-label>{{ 'WC_LOANS.ACTIONS.MODIFY' | appTranslate }}</ion-label>
                    </ion-item>
                    <ion-item button (click)="onAction('reject')">
                      <ion-icon slot="start" name="close-circle-outline"></ion-icon>
                      <ion-label>{{ 'WC_LOANS.ACTIONS.REJECT' | appTranslate }}</ion-label>
                    </ion-item>
                  }
                  @if (isLoanApproved) {
                    <ion-item button (click)="onAction('undoapproval')">
                      <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                      <ion-label>{{ 'WC_LOANS.ACTIONS.UNDO_APPROVAL' | appTranslate }}</ion-label>
                    </ion-item>
                  }
                  @if (isLoanActive) {
                    <ion-item button (click)="onAction('undodisbursal')">
                      <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                      <ion-label>{{ 'WC_LOANS.ACTIONS.UNDO_DISBURSAL' | appTranslate }}</ion-label>
                    </ion-item>
                    <ion-item button (click)="onAction('markasfraud')">
                      <ion-icon slot="start" name="alert-circle-outline"></ion-icon>
                      <ion-label>{{ 'WC_LOANS.ACTIONS.MARK_AS_FRAUD' | appTranslate }}</ion-label>
                    </ion-item>
                    <ion-item button (click)="onAction('discount')">
                      <ion-icon slot="start" name="pricetag-outline"></ion-icon>
                      <ion-label>{{ 'WC_LOANS.ACTIONS.APPLY_DISCOUNT' | appTranslate }}</ion-label>
                    </ion-item>
                    <ion-item button (click)="onAction('paymentrate')">
                      <ion-icon slot="start" name="trending-up-outline"></ion-icon>
                      <ion-label>{{
                        'WC_LOANS.ACTIONS.CHANGE_PAYMENT_RATE' | appTranslate
                      }}</ion-label>
                    </ion-item>
                  }
                  <ion-item button (click)="onDelete()">
                    <ion-icon slot="start" name="trash-outline"></ion-icon>
                    <ion-label>{{ 'WC_LOANS.ACTIONS.DELETE' | appTranslate }}</ion-label>
                  </ion-item>
                </ion-list>
              </ng-template>
            </ion-popover>
          </div>
        </ion-card-content>
      </ion-card>

      <ion-segment [value]="activeTab()" (ionChange)="activeTab.set($any($event).detail.value)">
        <ion-segment-button [value]="TAB.details">
          <ion-label>{{ 'WC_LOANS.TABS.DETAILS' | appTranslate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.charges">
          <ion-label>{{ 'WC_LOANS.TABS.CHARGES' | appTranslate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.transactions">
          <ion-label>{{ 'WC_LOANS.TABS.TRANSACTIONS' | appTranslate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.delinquencyActions">
          <ion-label>{{ 'WC_LOANS.TABS.DELINQUENCY_ACTIONS' | appTranslate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.delinquencyRangeSchedule">
          <ion-label>{{ 'WC_LOANS.TABS.DELINQUENCY_RANGE_SCHEDULE' | appTranslate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.breachSchedule">
          <ion-label>{{ 'WC_LOANS.TABS.BREACH_SCHEDULE' | appTranslate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.breachActions">
          <ion-label>{{ 'WC_LOANS.TABS.BREACH_ACTIONS' | appTranslate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.nearBreachActions">
          <ion-label>{{ 'WC_LOANS.TABS.NEAR_BREACH_ACTIONS' | appTranslate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.originators">
          <ion-label>{{ 'WC_LOANS.TABS.ORIGINATORS' | appTranslate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.rateChanges">
          <ion-label>{{ 'WC_LOANS.TABS.RATE_CHANGES' | appTranslate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.amortizationSchedule">
          <ion-label>{{ 'WC_LOANS.TABS.AMORTIZATION_SCHEDULE' | appTranslate }}</ion-label>
        </ion-segment-button>
        <ion-segment-button [value]="TAB.delinquencyRangeTags">
          <ion-label>{{ 'WC_LOANS.TABS.DELINQUENCY_RANGE_TAGS' | appTranslate }}</ion-label>
        </ion-segment-button>
      </ion-segment>

      @if (activeTab() === TAB.details) {
        <div class="tab-content">
          <ion-card class="info-card">
            <ion-card-content class="details-list">
              <div class="detail-item">
                <span class="label">{{ 'WC_LOANS.ACCOUNT_NO' | appTranslate }}</span>
                <span class="value">{{ loan()?.accountNo || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ 'WC_LOANS.CLIENT' | appTranslate }}</span>
                <span class="value">{{ loan()?.client?.displayName || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ 'WC_LOANS.PRODUCT' | appTranslate }}</span>
                <span class="value">{{ loan()?.product?.name || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ 'WC_LOANS.PRINCIPAL' | appTranslate }}</span>
                <span class="value">
                  {{ loan()?.currency?.displaySymbol }}
                  {{ loan()?.proposedPrincipal ?? loan()?.approvedPrincipal | number: '1.2-2' }}
                </span>
              </div>
              <div class="detail-item">
                <span class="label">{{ 'WC_LOANS.STATUS' | appTranslate }}</span>
                <span class="value">{{ loan()?.status?.value || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ 'WC_LOANS.REPAYMENT_EVERY' | appTranslate }}</span>
                <span class="value">
                  {{ loan()?.repaymentEvery || '-' }}
                  {{ loan()?.repaymentFrequencyType?.value }}
                </span>
              </div>
              <div class="detail-item">
                <span class="label">{{ 'WC_LOANS.BREACH' | appTranslate }}</span>
                <span class="value">{{ loan()?.breach?.name || '-' }}</span>
              </div>
            </ion-card-content>
          </ion-card>
        </div>
      }
      @if (activeTab() === TAB.charges) {
        <div class="tab-content">
          <div class="tab-toolbar">
            <ion-button color="primary" (click)="onAddCharge()" [disabled]="!loan()">
              <ion-icon name="add-outline"></ion-icon>
              {{ 'WC_LOANS.CHARGE.ADD' | appTranslate }}
            </ion-button>
          </div>
          <ion-card class="table-card">
            <ion-card-content>
              @if (charges().length > 0) {
                <table cdk-table [dataSource]="charges()" class="full-width-table">
                  <ng-container cdkColumnDef="name">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.NAME' | appTranslate }}</th>
                    <td cdk-cell *cdkCellDef="let c">{{ c.name }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="amount">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.AMOUNT' | appTranslate }}</th>
                    <td cdk-cell *cdkCellDef="let c">{{ c.amount | number: '1.2-2' }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="paid">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'WC_LOANS.PAID' | appTranslate }}</th>
                    <td cdk-cell *cdkCellDef="let c">{{ c.amountPaid | number: '1.2-2' }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="outstanding">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.OUTSTANDING' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let c">
                      {{ c.amountOutstanding | number: '1.2-2' }}
                    </td>
                  </ng-container>
                  <ng-container cdkColumnDef="actions">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ACTIONS' | appTranslate }}</th>
                    <td cdk-cell *cdkCellDef="let c">
                      @if (!c.paid) {
                        <ion-button
                          fill="clear"
                          color="danger"
                          [attr.aria-label]="'WC_LOANS.CHARGE.WAIVE' | appTranslate"
                          [appTooltip]="'WC_LOANS.CHARGE.WAIVE' | appTranslate"
                          (click)="onWaiveCharge(c)"
                        >
                          {{ 'WC_LOANS.CHARGE.WAIVE' | appTranslate }}
                        </ion-button>
                      }
                    </td>
                  </ng-container>
                  <tr cdk-header-row *cdkHeaderRowDef="chargeColumns"></tr>
                  <tr cdk-row *cdkRowDef="let row; columns: chargeColumns"></tr>
                </table>
              } @else {
                <div class="empty-state">
                  <ion-icon name="cash-outline"></ion-icon>
                  <p>{{ 'WC_LOANS.NO_DATA' | appTranslate }}</p>
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
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ID' | appTranslate }}</th>
                    <td cdk-cell *cdkCellDef="let tx">{{ tx.id }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="date">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.DATE' | appTranslate }}</th>
                    <td cdk-cell *cdkCellDef="let tx">{{ tx.transactionDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="type">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.TYPE' | appTranslate }}</th>
                    <td cdk-cell *cdkCellDef="let tx">{{ tx.type?.value }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="amount">
                    <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.AMOUNT' | appTranslate }}</th>
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
                  <p>{{ 'WC_LOANS.NO_DATA' | appTranslate }}</p>
                </div>
              }
            </ion-card-content>
          </ion-card>
        </div>
      }
      @if (activeTab() === TAB.delinquencyActions) {
        <div class="tab-content">
          <div class="tab-toolbar">
            <ion-button color="primary" (click)="onNewDelinquencyAction()" [disabled]="!loan()">
              <ion-icon name="add-outline"></ion-icon>
              {{ 'WC_LOANS.DELINQUENCY_ACTION.NEW' | appTranslate }}
            </ion-button>
          </div>
          <ion-card class="table-card">
            <ion-card-content>
              @if (delinquencyActions().length > 0) {
                <table cdk-table [dataSource]="delinquencyActions()" class="full-width-table">
                  <ng-container cdkColumnDef="action">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.ACTION' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let a">{{ a.action }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="startDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.START_DATE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let a">{{ a.startDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="endDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.END_DATE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let a">{{ a.endDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="frequency">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.DELINQUENCY_ACTION.FREQUENCY' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let a">
                      {{ a.frequency ? a.frequency + ' ' + a.frequencyType : '-' }}
                    </td>
                  </ng-container>
                  <tr cdk-header-row *cdkHeaderRowDef="delinquencyActionColumns"></tr>
                  <tr cdk-row *cdkRowDef="let row; columns: delinquencyActionColumns"></tr>
                </table>
              } @else {
                <div class="empty-state">
                  <ion-icon name="hammer-outline"></ion-icon>
                  <p>{{ 'WC_LOANS.NO_DATA' | appTranslate }}</p>
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
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.PERIOD' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let r">{{ r.periodNumber }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="fromDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.FROM_DATE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let r">{{ r.fromDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="toDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.TO_DATE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let r">{{ r.toDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="outstanding">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.OUTSTANDING' | appTranslate }}
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
                  <p>{{ 'WC_LOANS.NO_DATA' | appTranslate }}</p>
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
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.PERIOD' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let b">{{ b.periodNumber }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="fromDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.FROM_DATE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let b">{{ b.fromDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="toDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.TO_DATE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let b">{{ b.toDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="breach">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.BREACH' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let b">
                      {{ (b.breach ? 'COMMON.YES' : 'COMMON.NO') | appTranslate }}
                    </td>
                  </ng-container>
                  <tr cdk-header-row *cdkHeaderRowDef="breachScheduleColumns"></tr>
                  <tr cdk-row *cdkRowDef="let row; columns: breachScheduleColumns"></tr>
                </table>
              } @else {
                <div class="empty-state">
                  <ion-icon name="warning-outline"></ion-icon>
                  <p>{{ 'WC_LOANS.NO_DATA' | appTranslate }}</p>
                </div>
              }
            </ion-card-content>
          </ion-card>
        </div>
      }
      @if (activeTab() === TAB.breachActions) {
        <div class="tab-content">
          <div class="tab-toolbar">
            <ion-button color="primary" (click)="onNewBreachAction()" [disabled]="!loan()">
              <ion-icon name="add-outline"></ion-icon>
              {{ 'WC_LOANS.BREACH_ACTION.NEW' | appTranslate }}
            </ion-button>
          </div>
          <ion-card class="table-card">
            <ion-card-content>
              @if (breachActions().length > 0) {
                <table cdk-table [dataSource]="breachActions()" class="full-width-table">
                  <ng-container cdkColumnDef="action">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.ACTION' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let a">{{ a.action }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="startDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.START_DATE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let a">{{ a.startDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="endDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.END_DATE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let a">{{ a.endDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="frequency">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.BREACH_ACTION.FREQUENCY' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let a">
                      {{ a.frequency ? a.frequency + ' ' + a.frequencyType : '-' }}
                    </td>
                  </ng-container>
                  <tr cdk-header-row *cdkHeaderRowDef="breachActionColumns"></tr>
                  <tr cdk-row *cdkRowDef="let row; columns: breachActionColumns"></tr>
                </table>
              } @else {
                <div class="empty-state">
                  <ion-icon name="hammer-outline"></ion-icon>
                  <p>{{ 'WC_LOANS.NO_DATA' | appTranslate }}</p>
                </div>
              }
            </ion-card-content>
          </ion-card>
        </div>
      }
      @if (activeTab() === TAB.nearBreachActions) {
        <div class="tab-content">
          <div class="tab-toolbar">
            <ion-button color="primary" (click)="onNewNearBreachAction()" [disabled]="!loan()">
              <ion-icon name="add-outline"></ion-icon>
              {{ 'WC_LOANS.NEAR_BREACH_ACTION.NEW' | appTranslate }}
            </ion-button>
          </div>
          <ion-card class="table-card">
            <ion-card-content>
              @if (nearBreachActions().length > 0) {
                <table cdk-table [dataSource]="nearBreachActions()" class="full-width-table">
                  <ng-container cdkColumnDef="action">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.ACTION' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let a">{{ a.action }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="frequency">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.NEAR_BREACH_ACTION.FREQUENCY' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let a">{{ a.frequency }} {{ a.frequencyType }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="threshold">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.NEAR_BREACH_ACTION.THRESHOLD' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let a">{{ a.threshold }}%</td>
                  </ng-container>
                  <ng-container cdkColumnDef="createdDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.NEAR_BREACH_ACTION.CREATED_DATE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let a">{{ a.createdDate }}</td>
                  </ng-container>
                  <tr cdk-header-row *cdkHeaderRowDef="nearBreachActionColumns"></tr>
                  <tr cdk-row *cdkRowDef="let row; columns: nearBreachActionColumns"></tr>
                </table>
              } @else {
                <div class="empty-state">
                  <ion-icon name="warning-outline"></ion-icon>
                  <p>{{ 'WC_LOANS.NO_DATA' | appTranslate }}</p>
                </div>
              }
            </ion-card-content>
          </ion-card>
        </div>
      }
      @if (activeTab() === TAB.originators) {
        <div class="tab-content">
          <div class="tab-toolbar">
            <ion-item fill="outline" class="attach-select">
              <ion-label position="stacked">{{
                'WC_LOANS.ORIGINATORS.SELECT_ORIGINATOR' | appTranslate
              }}</ion-label>
              <ion-select
                [attr.aria-label]="'WC_LOANS.ORIGINATORS.SELECT_ORIGINATOR' | appTranslate"
                interface="popover"
                [ngModel]="originatorToAttach()"
                (ngModelChange)="originatorToAttach.set($event)"
              >
                @for (opt of attachableOriginators(); track opt.id) {
                  <ion-select-option [value]="opt.id">{{ opt.name }}</ion-select-option>
                }
              </ion-select>
            </ion-item>
            <ion-button
              color="primary"
              (click)="onAttachOriginator()"
              [disabled]="!originatorToAttach()"
            >
              <ion-icon name="link-outline"></ion-icon>
              {{ 'WC_LOANS.ORIGINATORS.ATTACH' | appTranslate }}
            </ion-button>
          </div>
          <ion-card class="table-card">
            <ion-card-content>
              @if (originators().length > 0) {
                <table cdk-table [dataSource]="originators()" class="full-width-table">
                  <ng-container cdkColumnDef="name">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.ORIGINATORS.NAME' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let o">{{ o.name }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="type">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.ORIGINATORS.TYPE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let o">{{ o.originatorType?.name }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="channel">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.ORIGINATORS.CHANNEL' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let o">{{ o.channelType?.name }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="status">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.ORIGINATORS.STATUS' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let o">{{ o.status }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="actions">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'COMMON.ACTIONS' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let o">
                      <ion-button
                        fill="clear"
                        color="danger"
                        [attr.aria-label]="'WC_LOANS.ORIGINATORS.DETACH' | appTranslate"
                        [appTooltip]="'WC_LOANS.ORIGINATORS.DETACH' | appTranslate"
                        (click)="onDetachOriginator(o)"
                      >
                        <ion-icon name="unlink-outline"></ion-icon>
                      </ion-button>
                    </td>
                  </ng-container>
                  <tr cdk-header-row *cdkHeaderRowDef="originatorColumns"></tr>
                  <tr cdk-row *cdkRowDef="let row; columns: originatorColumns"></tr>
                </table>
              } @else {
                <div class="empty-state">
                  <ion-icon name="people-outline"></ion-icon>
                  <p>{{ 'WC_LOANS.NO_DATA' | appTranslate }}</p>
                </div>
              }
            </ion-card-content>
          </ion-card>
        </div>
      }
      @if (activeTab() === TAB.rateChanges) {
        <div class="tab-content">
          <ion-card class="table-card">
            <ion-card-content>
              @if (rateChanges().length > 0) {
                <table cdk-table [dataSource]="rateChanges()" class="full-width-table">
                  <ng-container cdkColumnDef="effectiveDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.RATE_CHANGE.EFFECTIVE_DATE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let r">{{ r.effectiveDate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="previousRate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.RATE_CHANGE.PREVIOUS_RATE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let r">{{ r.previousRate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="newRate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.RATE_CHANGE.NEW_RATE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let r">{{ r.newRate }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="reversed">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.RATE_CHANGE.REVERSED' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let r">
                      {{ (r.reversed ? 'COMMON.YES' : 'COMMON.NO') | appTranslate }}
                    </td>
                  </ng-container>
                  <tr cdk-header-row *cdkHeaderRowDef="rateChangeColumns"></tr>
                  <tr cdk-row *cdkRowDef="let row; columns: rateChangeColumns"></tr>
                </table>
              } @else {
                <div class="empty-state">
                  <ion-icon name="trending-up-outline"></ion-icon>
                  <p>{{ 'WC_LOANS.NO_DATA' | appTranslate }}</p>
                </div>
              }
            </ion-card-content>
          </ion-card>
        </div>
      }
      @if (activeTab() === TAB.amortizationSchedule) {
        <div class="tab-content">
          @if (amortizationSchedule(); as schedule) {
            <ion-card class="info-card">
              <ion-card-content class="details-list">
                <div class="detail-item">
                  <span class="label">{{ 'WC_LOANS.PERIOD_PAYMENT_RATE' | appTranslate }}</span>
                  <span class="value">{{ schedule.periodPaymentRate ?? '-' }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">
                    {{ 'WC_LOANS.AMORTIZATION.NET_DISBURSEMENT_AMOUNT' | appTranslate }}
                  </span>
                  <span class="value">{{ schedule.netDisbursementAmount | number: '1.2-2' }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">{{ 'WC_LOANS.TOTAL_PAYMENT_VOLUME' | appTranslate }}</span>
                  <span class="value">{{ schedule.totalPaymentVolume | number: '1.2-2' }}</span>
                </div>
              </ion-card-content>
            </ion-card>
            <ion-card class="table-card">
              <ion-card-content>
                @if ((schedule.payments ?? []).length > 0) {
                  <table cdk-table [dataSource]="schedule.payments ?? []" class="full-width-table">
                    <ng-container cdkColumnDef="paymentNo">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'WC_LOANS.AMORTIZATION.PAYMENT_NO' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let p">{{ p.paymentNo }}</td>
                    </ng-container>
                    <ng-container cdkColumnDef="paymentDate">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'WC_LOANS.AMORTIZATION.PAYMENT_DATE' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let p">{{ p.paymentDate }}</td>
                    </ng-container>
                    <ng-container cdkColumnDef="expectedPaymentAmount">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'WC_LOANS.AMORTIZATION.EXPECTED_PAYMENT_AMOUNT' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let p">
                        {{ p.expectedPaymentAmount | number: '1.2-2' }}
                      </td>
                    </ng-container>
                    <tr cdk-header-row *cdkHeaderRowDef="amortizationColumns"></tr>
                    <tr cdk-row *cdkRowDef="let row; columns: amortizationColumns"></tr>
                  </table>
                } @else {
                  <div class="empty-state">
                    <ion-icon name="calendar-outline"></ion-icon>
                    <p>{{ 'WC_LOANS.NO_DATA' | appTranslate }}</p>
                  </div>
                }
              </ion-card-content>
            </ion-card>
          } @else {
            <div class="empty-state">
              <ion-icon name="calendar-outline"></ion-icon>
              <p>{{ 'WC_LOANS.NO_DATA' | appTranslate }}</p>
            </div>
          }
        </div>
      }
      @if (activeTab() === TAB.delinquencyRangeTags) {
        <div class="tab-content">
          <ion-card class="table-card">
            <ion-card-content>
              @if (delinquencyRangeTags().length > 0) {
                <table cdk-table [dataSource]="delinquencyRangeTags()" class="full-width-table">
                  <ng-container cdkColumnDef="periodNumber">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.PERIOD' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let t">{{ t.periodNumber }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="delinquencyRange">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.RANGE_TAG.DELINQUENCY_RANGE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let t">{{ t.delinquencyRange?.classification }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="delinquentDays">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.RANGE_TAG.DELINQUENT_DAYS' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let t">{{ t.delinquentDays }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="delinquentAmount">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.RANGE_TAG.DELINQUENT_AMOUNT' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let t">{{ t.delinquentAmount | number: '1.2-2' }}</td>
                  </ng-container>
                  <ng-container cdkColumnDef="addedOnDate">
                    <th cdk-header-cell *cdkHeaderCellDef>
                      {{ 'WC_LOANS.RANGE_TAG.ADDED_ON_DATE' | appTranslate }}
                    </th>
                    <td cdk-cell *cdkCellDef="let t">{{ t.addedOnDate }}</td>
                  </ng-container>
                  <tr cdk-header-row *cdkHeaderRowDef="rangeTagColumns"></tr>
                  <tr cdk-row *cdkRowDef="let row; columns: rangeTagColumns"></tr>
                </table>
              } @else {
                <div class="empty-state">
                  <ion-icon name="flag-outline"></ion-icon>
                  <p>{{ 'WC_LOANS.NO_DATA' | appTranslate }}</p>
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
        color: var(--text-muted);
        font-size: 14px;
      }
      .divider {
        color: var(--border-color);
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
      .tab-toolbar {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .tab-toolbar .attach-select {
        min-width: 260px;
        --min-height: 0;
      }
      .full-width-table {
        width: 100%;
      }
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px;
        color: var(--text-muted);
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
export class WcLoanViewComponent implements OnInit, OnDestroy {
  /** Selected tab; mat-tab-group tracked this internally, ion-segment does not. */
  /** Exposed so the template names its tabs instead of numbering them. */
  protected readonly TAB = WC_LOAN_TAB;

  private readonly popovers = viewChildren(IonPopover);

  readonly activeTab = signal<WcLoanTab>(WC_LOAN_TAB.details);
  private readonly loansService = inject(WorkingCapitalLoansService);
  private readonly chargesService = inject(WorkingCapitalLoanChargesService);
  private readonly transactionsService = inject(WorkingCapitalLoanTransactionsService);
  private readonly delinquencyActionsService = inject(WorkingCapitalLoanDelinquencyActionsService);
  private readonly delinquencyRangeScheduleService = inject(
    WorkingCapitalLoanDelinquencyRangeScheduleService,
  );
  private readonly breachScheduleService = inject(WorkingCapitalLoanBreachScheduleService);
  private readonly breachActionsService = inject(WorkingCapitalLoanBreachActionsService);
  private readonly nearBreachActionsService = inject(WorkingCapitalLoanNearBreachActionsService);
  private readonly wcOriginatorsService = inject(WorkingCapitalLoanOriginatorsService);
  private readonly originatorsService = inject(LoanOriginatorsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  loanId = 0;
  readonly loan = signal<GetWorkingCapitalLoansLoanIdResponse | null>(null);
  readonly charges = signal<WorkingCapitalLoanChargeData[]>([]);
  readonly transactions = signal<GetWorkingCapitalLoanTransactionIdResponse[]>([]);
  readonly delinquencyActions = signal<WorkingCapitalLoanDelinquencyActionData[]>([]);
  readonly delinquencyRangeSchedule = signal<WorkingCapitalLoanDelinquencyRangeScheduleData[]>([]);
  readonly breachSchedule = signal<WorkingCapitalLoanBreachScheduleData[]>([]);
  readonly breachActions = signal<WorkingCapitalLoanBreachActionData[]>([]);
  readonly nearBreachActions = signal<WorkingCapitalLoanNearBreachActionData[]>([]);
  readonly originators = signal<LoanOriginatorData[]>([]);
  /** The full master list, used to offer only originators not already attached to this loan. */
  private readonly allOriginators = signal<LoanOriginatorData[]>([]);
  readonly attachableOriginators = computed(() => {
    const attachedIds = new Set(this.originators().map((o) => o.id));
    return this.allOriginators().filter((o) => !attachedIds.has(o.id));
  });
  readonly originatorToAttach = signal<number | null>(null);
  readonly rateChanges = signal<WorkingCapitalLoanPeriodPaymentRateChangeData[]>([]);
  readonly amortizationSchedule = signal<ProjectedAmortizationScheduleData | null>(null);
  readonly delinquencyRangeTags = signal<
    GetWorkingCapitalLoanDelinquencyRangeScheduleTagHistoryResponse[]
  >([]);

  chargeColumns = ['name', 'amount', 'paid', 'outstanding', 'actions'];
  transactionColumns = ['id', 'date', 'type', 'amount'];
  delinquencyActionColumns = ['action', 'startDate', 'endDate', 'frequency'];
  delinquencyRangeColumns = ['periodNumber', 'fromDate', 'toDate', 'outstanding'];
  breachScheduleColumns = ['periodNumber', 'fromDate', 'toDate', 'breach'];
  breachActionColumns = ['action', 'startDate', 'endDate', 'frequency'];
  nearBreachActionColumns = ['action', 'frequency', 'threshold', 'createdDate'];
  originatorColumns = ['name', 'type', 'channel', 'status', 'actions'];
  rateChangeColumns = ['effectiveDate', 'previousRate', 'newRate', 'reversed'];
  amortizationColumns = ['paymentNo', 'paymentDate', 'expectedPaymentAmount'];
  rangeTagColumns = [
    'periodNumber',
    'delinquencyRange',
    'delinquentDays',
    'delinquentAmount',
    'addedOnDate',
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loanId = +id;
      this.loadData();
    }

    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab && Object.values(WC_LOAN_TAB).includes(tab as WcLoanTab)) {
      this.activeTab.set(tab as WcLoanTab);
    }
  }

  ngOnDestroy(): void {
    for (const popover of this.popovers()) {
      void popover.dismiss().catch(() => false);
    }
  }

  loadData(): void {
    this.loansService.getWorkingCapitalLoansLoanId(this.loanId).subscribe({
      next: (data) => this.loan.set(data),
      error: (err: unknown) => console.error('Failed to load working-capital loan', err),
    });

    this.loadCharges();

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

    this.breachActionsService.getWorkingCapitalLoansLoanIdBreachActions(this.loanId).subscribe({
      next: (data) => this.breachActions.set(data ?? []),
      error: (err: unknown) => console.error('Failed to load breach actions', err),
    });

    this.nearBreachActionsService
      .getWorkingCapitalLoansLoanIdNearBreachActions(this.loanId)
      .subscribe({
        next: (data) => this.nearBreachActions.set(data ?? []),
        error: (err: unknown) => console.error('Failed to load near-breach actions', err),
      });

    this.loadOriginators();

    this.originatorsService.getLoanOriginators().subscribe({
      next: (data) => this.allOriginators.set(data ?? []),
      error: (err: unknown) => console.error('Failed to load loan originators', err),
    });

    this.loansService.getWorkingCapitalLoansLoanIdRateChanges(this.loanId).subscribe({
      next: (data) => this.rateChanges.set(data ?? []),
      error: (err: unknown) => console.error('Failed to load rate changes', err),
    });

    this.loansService.getWorkingCapitalLoansLoanIdAmortizationSchedule(this.loanId).subscribe({
      next: (data) => this.amortizationSchedule.set(data ?? null),
      error: (err: unknown) => console.error('Failed to load amortization schedule', err),
    });

    this.loansService.getWorkingCapitalLoansLoanIdDelinquencyrangetags(this.loanId).subscribe({
      next: (data) => this.delinquencyRangeTags.set(data ?? []),
      error: (err: unknown) => console.error('Failed to load delinquency range tags', err),
    });
  }

  loadCharges(): void {
    this.chargesService.getWorkingCapitalLoansLoanIdCharges(this.loanId).subscribe({
      next: (data) => this.charges.set(data ?? []),
      error: (err: unknown) => console.error('Failed to load loan charges', err),
    });
  }

  loadOriginators(): void {
    this.wcOriginatorsService.getWorkingCapitalLoansLoanIdOriginators(this.loanId).subscribe({
      next: (data) => this.originators.set(data.originators ?? []),
      error: (err: unknown) => console.error('Failed to load loan originators for this loan', err),
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

  onNewDelinquencyAction(): void {
    this.router.navigate([`/working-capital/loans/${this.loanId}/delinquency-action`]);
  }

  onAddCharge(): void {
    this.router.navigate([`/working-capital/loans/${this.loanId}/charge`]);
  }

  onWaiveCharge(charge: WorkingCapitalLoanChargeData): void {
    if (!charge.id || !confirm(`Waive the charge "${charge.name}"?`)) return;
    this.chargesService
      .postWorkingCapitalLoansLoanIdChargesLoanChargeId(this.loanId, charge.id, {}, 'waive')
      .subscribe({
        next: () => this.loadCharges(),
        error: (err: unknown) => console.error('Failed to waive loan charge', err),
      });
  }

  onNewBreachAction(): void {
    this.router.navigate([`/working-capital/loans/${this.loanId}/breach-action`]);
  }

  onNewNearBreachAction(): void {
    this.router.navigate([`/working-capital/loans/${this.loanId}/near-breach-action`]);
  }

  onAttachOriginator(): void {
    const originatorId = this.originatorToAttach();
    if (!originatorId) return;
    this.wcOriginatorsService
      .postWorkingCapitalLoansLoanIdOriginatorsOriginatorId(this.loanId, originatorId)
      .subscribe({
        next: () => {
          this.originatorToAttach.set(null);
          this.loadOriginators();
        },
        error: (err: unknown) => console.error('Failed to attach originator', err),
      });
  }

  onDetachOriginator(originator: LoanOriginatorData): void {
    if (!originator.id || !confirm(`Detach ${originator.name} from this loan?`)) return;
    this.wcOriginatorsService
      .deleteWorkingCapitalLoansLoanIdOriginatorsOriginatorId(this.loanId, originator.id)
      .subscribe({
        next: () => this.loadOriginators(),
        error: (err: unknown) => console.error('Failed to detach originator', err),
      });
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
