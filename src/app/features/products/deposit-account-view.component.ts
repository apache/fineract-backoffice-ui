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
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { PlatformDateService } from '../../core/services/platform-date.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { from } from 'rxjs';
import { DecimalPipe, NgClass } from '@angular/common';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { LoadErrorComponent } from '../../shared';
import { SpinnerComponent } from '../../ui/spinner/spinner.component';
import { HttpErrorResponse } from '@angular/common/http';
import { EntityDatatablesComponent } from '../../shared/components/entity-datatables/entity-datatables.component';
import { SavingsStandingInstructionsTabComponent } from './savings/savings-standing-instructions-tab.component';
import { DEPOSIT_ACCOUNT_API, I18N, TranslatePipe } from '../../core/adapters';
import type {
  DepositAccount,
  DepositAccountCharge,
  DepositChartRow,
  DepositTransaction,
  DepositType,
} from '../../core/adapters';
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
  formatDateToFineract,
} from '../../core/utils/date-formatter';
import { CdkTableModule } from '@angular/cdk/table';
import { RequiresPermissionDirective } from '../../shared/directives/requires-permission.directive';
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
  charges: 'charges',
  interestRateChart: 'interestRateChart',
  standingInstructions: 'standingInstructions',
  customFields: 'customFields',
} as const;

export type DepositTab = (typeof DEPOSIT_TAB)[keyof typeof DEPOSIT_TAB];

@Component({
  selector: 'app-deposit-account-view',
  standalone: true,
  imports: [
    TranslatePipe,
    RouterLink,
    CdkTableModule,
    StatusBadgeComponent,
    EntityDatatablesComponent,
    SavingsStandingInstructionsTabComponent,
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
    RequiresPermissionDirective,
    LoadErrorComponent,
    SpinnerComponent,
  ],
  template: `
    @if (loadError() === 'not-found') {
      <div class="view-container">
        <app-load-error
          testId="deposit-load-error"
          icon="wallet-outline"
          [message]="'DEPOSITS.NOT_FOUND' | appTranslate"
          [actionLabel]="'COMMON.BACK' | appTranslate"
          (action)="onBack()"
        ></app-load-error>
      </div>
    } @else if (loadError() === 'failed') {
      <div class="view-container">
        <app-load-error
          testId="deposit-load-error"
          [message]="'DEPOSITS.LOAD_FAILED' | appTranslate"
          [actionLabel]="'COMMON.RETRY' | appTranslate"
          (action)="loadData()"
        ></app-load-error>
      </div>
    } @else if (isLoading()) {
      <div class="view-container">
        <app-spinner data-testid="deposit-loading" />
      </div>
    } @else if (deposit()) {
      <div class="view-container">
        <ion-card class="header-card">
          <ion-card-content class="header-content">
            <div class="title-area">
              <div class="avatar-circle">
                <ion-icon name="wallet-outline"></ion-icon>
              </div>
              <div class="title-details">
                <h2>{{ deposit()?.productName }}</h2>
                <div class="subtitle-row">
                  <span class="account-no">#{{ deposit()?.accountNo }}</span>
                  <span class="divider">|</span>
                  @if (deposit()?.clientId) {
                    <a
                      class="client-name clickable-link"
                      [routerLink]="['/clients/view', deposit()!.clientId]"
                      data-testid="deposit-client-link"
                      >Client: {{ deposit()?.clientName }}</a
                    >
                  } @else {
                    <span class="client-name">Client: {{ deposit()?.clientName }}</span>
                  }
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
                {{ 'COMMON.ACTIONS' | appTranslate }}
              </ion-button>
              <ion-popover trigger="actionsMenu-trigger" [dismissOnSelect]="true">
                <ng-template>
                  <ion-list>
                    @if (isPending()) {
                      <ion-item button data-testid="deposit-action-approve" (click)="onApprove()">
                        <ion-icon slot="start" name="checkmark-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.APPROVE' | appTranslate }}</ion-label>
                      </ion-item>
                      <ion-item button data-testid="deposit-action-reject" (click)="onReject()">
                        <ion-icon slot="start" name="close-circle-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.REJECT' | appTranslate }}</ion-label>
                      </ion-item>
                      <ion-item
                        button
                        data-testid="deposit-action-withdrawnByApplicant"
                        (click)="onWithdrawnByApplicant()"
                      >
                        <ion-icon slot="start" name="person-remove-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.WITHDRAWN_BY_CLIENT' | appTranslate }}</ion-label>
                      </ion-item>
                    }
                    @if (isApproved()) {
                      <ion-item button data-testid="deposit-action-activate" (click)="onActivate()">
                        <ion-icon slot="start" name="play-circle-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.ACTIVATE' | appTranslate }}</ion-label>
                      </ion-item>
                      <ion-item
                        button
                        data-testid="deposit-action-undoapproval"
                        (click)="onUndoApproval()"
                      >
                        <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.UNDO_APPROVAL' | appTranslate }}</ion-label>
                      </ion-item>
                    }
                    @if (isActive()) {
                      <ion-item button data-testid="deposit-action-deposit" (click)="onDeposit()">
                        <ion-icon slot="start" name="add-outline"></ion-icon>
                        <ion-label>{{ 'SAVINGS.DEPOSIT' | appTranslate }}</ion-label>
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
                          <ion-label>{{ 'SAVINGS.WITHDRAW' | appTranslate }}</ion-label>
                        </ion-item>
                      }
                      <ion-item
                        button
                        data-testid="deposit-action-postInterest"
                        (click)="onPostInterest()"
                      >
                        <ion-icon slot="start" name="cash-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.POST_INTEREST' | appTranslate }}</ion-label>
                      </ion-item>
                      <ion-item
                        button
                        data-testid="deposit-action-prematureClose"
                        (click)="onPrematureClose()"
                      >
                        <ion-icon slot="start" name="alert-circle-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.PREMATURE_CLOSE' | appTranslate }}</ion-label>
                      </ion-item>
                      <ion-item button data-testid="deposit-action-close" (click)="onClose()">
                        <ion-icon slot="start" name="lock-closed-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.CLOSE' | appTranslate }}</ion-label>
                      </ion-item>
                    }
                    @if (!isPending() && !isApproved() && !isActive()) {
                      <ion-item data-testid="deposit-no-actions">
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
          <ion-segment-button [value]="TAB.overview">
            <ion-label>{{ 'COMMON.OVERVIEW' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.transactions" data-testid="deposit-tab-transactions">
            <ion-label>{{ 'COMMON.TRANSACTIONS' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.charges" data-testid="deposit-tab-charges">
            <ion-label>{{ 'LOANS.CHARGES' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button
            [value]="TAB.interestRateChart"
            data-testid="deposit-tab-interest-rate-chart"
          >
            <ion-label>{{ 'INTEREST_RATE_CHARTS.TAB_LABEL' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button
            [value]="TAB.standingInstructions"
            data-testid="deposit-tab-standing-instructions"
          >
            <ion-label>{{ 'SAVINGS.STANDING_INSTRUCTIONS' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.customFields">
            <ion-label>{{ 'SYSTEM.CUSTOM_FIELDS' | appTranslate }}</ion-label>
          </ion-segment-button>
        </ion-segment>

        @if (activeTab() === TAB.overview) {
          <div class="tab-content">
            <div class="info-grid">
              <ion-card class="info-card">
                <ion-card-header>
                  <ion-card-title>{{ 'COMMON.DETAILS' | appTranslate }}</ion-card-title>
                </ion-card-header>
                <ion-card-content class="details-list">
                  <div class="detail-item">
                    <span class="label">{{ 'COMMON.BALANCE' | appTranslate }}</span>
                    <span class="value"
                      >{{ getCurrencySymbol() }} {{ getAccountBalance() | number: '1.2-2' }}</span
                    >
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'COMMON.INTEREST_RATE' | appTranslate }}</span>
                    <span class="value">{{ deposit()?.nominalAnnualInterestRate }}%</span>
                  </div>

                  <!-- The figures that define a term deposit. Each is rendered only when the
                       payload carries it, so the savings accounts that share this view are
                       unaffected rather than showing a row of blanks. -->
                  @if (getDepositAmount() !== null) {
                    <div class="detail-item" data-testid="deposit-amount">
                      <span class="label">{{ 'DEPOSITS.DEPOSIT_AMOUNT' | appTranslate }}</span>
                      <span class="value"
                        >{{ getCurrencySymbol() }} {{ getDepositAmount() | number: '1.2-2' }}</span
                      >
                    </div>
                  }
                  @if (getDepositTerm()) {
                    <div class="detail-item" data-testid="deposit-term">
                      <span class="label">{{ 'COMMON.TERM' | appTranslate }}</span>
                      <span class="value">{{ getDepositTerm() }}</span>
                    </div>
                  }
                  @if (getMaturityAmount() !== null) {
                    <div class="detail-item" data-testid="deposit-maturity-amount">
                      <span class="label">{{ 'COMMON.MATURITY_AMOUNT' | appTranslate }}</span>
                      <span class="value"
                        >{{ getCurrencySymbol() }} {{ getMaturityAmount() | number: '1.2-2' }}</span
                      >
                    </div>
                  }
                  @if (deposit()?.maturityDate) {
                    <div class="detail-item" data-testid="deposit-maturity-date">
                      <span class="label">{{ 'DEPOSITS.MATURITY_DATE' | appTranslate }}</span>
                      <span class="value">{{ getMaturityDate() }}</span>
                    </div>
                  }
                  @if (getLinkedAccountNo()) {
                    <div class="detail-item" data-testid="deposit-linked-account">
                      <span class="label">{{ 'DEPOSITS.LINKED_ACCOUNT' | appTranslate }}</span>
                      <span class="value">{{ getLinkedAccountNo() }}</span>
                    </div>
                  }
                  @if (deposit()?.transferInterestToSavings) {
                    <div class="detail-item" data-testid="deposit-transfer-interest">
                      <span class="label">{{
                        'DEPOSITS.TRANSFER_INTEREST_TO_SAVINGS' | appTranslate
                      }}</span>
                      <span class="value">{{ 'COMMON.YES' | appTranslate }}</span>
                    </div>
                  }
                  @if (deposit()?.minRequiredOpeningBalance !== null) {
                    <div class="detail-item">
                      <span class="label">{{ 'SAVINGS.MIN_BALANCE_REQUIRED' | appTranslate }}</span>
                      <span class="value">{{ deposit()?.minRequiredOpeningBalance }}</span>
                    </div>
                  }
                </ion-card-content>
              </ion-card>

              <ion-card class="info-card">
                <ion-card-header>
                  <ion-card-title>{{ 'LOANS.TIMELINE_STATUS' | appTranslate }}</ion-card-title>
                </ion-card-header>
                <ion-card-content class="details-list">
                  <div class="detail-item">
                    <span class="label">{{ 'COMMON.ACTIVATION_DATE' | appTranslate }}</span>
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
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.DATE' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let tx">{{ formatDate(tx.date) }}</td>
                </ng-container>
                <ng-container cdkColumnDef="type">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.TYPE' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let tx">{{ tx.typeLabel }}</td>
                </ng-container>
                <ng-container cdkColumnDef="amount">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.AMOUNT' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let tx">
                    <span
                      [ngClass]="{
                        debit: tx.entryType === 'DEBIT' && !tx.reversed,
                        credit: tx.entryType !== 'DEBIT' && !tx.reversed,
                        'reversed-amount': tx.reversed,
                      }"
                    >
                      {{ tx.currencySymbol }} {{ tx.amount | number: '1.2-2' }}
                    </span>
                  </td>
                </ng-container>
                <ng-container cdkColumnDef="runningBalance">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'COMMON.RUNNING_BALANCE' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let tx">
                    {{ tx.currencySymbol }} {{ tx.runningBalance || 0 | number: '1.2-2' }}
                  </td>
                </ng-container>
                <ng-container cdkColumnDef="actions">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ACTIONS' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let tx">
                    @if (canUndo(tx)) {
                      <ion-button
                        fill="clear"
                        color="danger"
                        size="small"
                        [attr.data-testid]="'deposit-tx-undo-' + tx.id"
                        [attr.aria-label]="'ACTIONS.UNDO_TRANSACTION' | appTranslate"
                        (click)="onUndoTransaction(tx)"
                      >
                        <ion-icon name="arrow-undo-outline"></ion-icon>
                      </ion-button>
                    } @else if (tx.reversed) {
                      <span class="reversed-marker" data-testid="deposit-tx-reversed">
                        {{ 'COMMON.REVERSED' | appTranslate }}
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
                <p>{{ 'LOANS.NO_TRANSACTIONS' | appTranslate }}</p>
              </div>
            }
          </div>
        }
        @if (activeTab() === TAB.charges) {
          <div class="tab-content">
            <ion-card class="table-card">
              <ion-card-content>
                <div class="tab-actions">
                  <ion-button
                    size="small"
                    data-testid="deposit-add-charge"
                    appRequiresPermission="CREATE_SAVINGSACCOUNTCHARGE"
                    [disabled]="chargeOptions().length === 0"
                    (click)="onAddCharge()"
                  >
                    <ion-icon slot="start" name="add-outline"></ion-icon>
                    {{ 'SAVINGS_CHARGES.CREATE' | appTranslate }}
                  </ion-button>
                </div>
                @if (charges().length > 0) {
                  <table cdk-table [dataSource]="charges()" class="full-width-table">
                    <ng-container cdkColumnDef="name">
                      <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.NAME' | appTranslate }}</th>
                      <td cdk-cell *cdkCellDef="let c">{{ c.name }}</td>
                    </ng-container>

                    <ng-container cdkColumnDef="amount">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'COMMON.AMOUNT' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let c">
                        {{ getCurrencySymbol() }} {{ c.amount | number: '1.2-2' }}
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="outstanding">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.OUTSTANDING' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let c">
                        {{ getCurrencySymbol() }} {{ c.amountOutstanding | number: '1.2-2' }}
                      </td>
                    </ng-container>

                    <tr cdk-header-row *cdkHeaderRowDef="chargeColumns"></tr>
                    <tr cdk-row *cdkRowDef="let row; columns: chargeColumns"></tr>
                  </table>
                } @else {
                  <div class="empty-state" data-testid="deposit-no-charges">
                    <ion-icon name="cash-outline"></ion-icon>
                    <p>{{ 'SAVINGS.NO_CHARGES' | appTranslate }}</p>
                  </div>
                }
              </ion-card-content>
            </ion-card>
          </div>
        }
        @if (activeTab() === TAB.interestRateChart) {
          <div class="tab-content">
            <ion-card class="table-card">
              <ion-card-content>
                @if (chartRows().length > 0) {
                  <table class="full-width-table" data-testid="deposit-interest-rate-chart">
                    <thead>
                      <tr>
                        <th>{{ 'COMMON.PERIOD' | appTranslate }}</th>
                        <th>
                          {{ 'INTEREST_RATE_CHARTS.AMOUNT_RANGE_FROM' | appTranslate }} -
                          {{ 'INTEREST_RATE_CHARTS.AMOUNT_RANGE_TO' | appTranslate }}
                        </th>
                        <th>{{ 'INTEREST_RATE_CHARTS.ANNUAL_INTEREST_RATE' | appTranslate }}</th>
                        <th>{{ 'INTEREST_RATE_CHARTS.DESCRIPTION' | appTranslate }}</th>
                        <th>{{ 'COMMON.ACTIONS' | appTranslate }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (slab of chartRows(); track $index) {
                        <tr>
                          <td>
                            {{ slab.fromPeriod }} - {{ slab.toPeriod }} {{ slab.periodTypeLabel }}
                          </td>
                          <td>
                            {{ slab.amountRangeFrom | number: '1.2-2' }} -
                            {{ slab.amountRangeTo | number: '1.2-2' }}
                          </td>
                          <td>{{ slab.annualInterestRate | number: '1.2-2' }} %</td>
                          <td>{{ slab.description }}</td>
                          <td>
                            @if (slab.incentives.length) {
                              <ion-button
                                fill="clear"
                                size="small"
                                [attr.data-testid]="'deposit-toggle-incentives-' + $index"
                                (click)="onToggleIncentives($index)"
                              >
                                {{
                                  (expandedSlabIndex() === $index
                                    ? 'INTEREST_RATE_CHARTS.HIDE_INCENTIVES'
                                    : 'INTEREST_RATE_CHARTS.VIEW_INCENTIVES'
                                  ) | appTranslate
                                }}
                              </ion-button>
                            }
                          </td>
                        </tr>
                        @if (expandedSlabIndex() === $index && slab.incentives.length) {
                          <tr>
                            <td colspan="5">
                              <h4>{{ 'INTEREST_RATE_CHARTS.INCENTIVES' | appTranslate }}</h4>
                              <table class="full-width-table incentives-table">
                                <thead>
                                  <tr>
                                    <th>{{ 'SYSTEM.ENTITY_TYPE' | appTranslate }}</th>
                                    <th>
                                      {{ 'INTEREST_RATE_CHARTS.ATTRIBUTE_NAME' | appTranslate }}
                                    </th>
                                    <th>
                                      {{ 'INTEREST_RATE_CHARTS.CONDITION_TYPE' | appTranslate }}
                                    </th>
                                    <th>
                                      {{ 'INTEREST_RATE_CHARTS.ATTRIBUTE_VALUE' | appTranslate }}
                                    </th>
                                    <th>
                                      {{ 'INTEREST_RATE_CHARTS.INCENTIVE_TYPE' | appTranslate }}
                                    </th>
                                    <th>{{ 'COMMON.AMOUNT' | appTranslate }}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  @for (incentive of slab.incentives; track $index) {
                                    <tr>
                                      <td>{{ incentive.entityType }}</td>
                                      <td>{{ incentive.attributeName }}</td>
                                      <td>{{ incentive.conditionType }}</td>
                                      <td>{{ incentive.attributeValue }}</td>
                                      <td>{{ incentive.incentiveType }}</td>
                                      <td>{{ incentive.amount | number: '1.2-2' }}</td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        }
                      }
                    </tbody>
                  </table>
                } @else {
                  <div class="empty-state" data-testid="deposit-no-interest-rate-chart">
                    <ion-icon name="trending-up-outline"></ion-icon>
                    <p>{{ 'INTEREST_RATE_CHARTS.NO_CHART' | appTranslate }}</p>
                  </div>
                }
              </ion-card-content>
            </ion-card>
          </div>
        }
        @if (activeTab() === TAB.standingInstructions) {
          <div class="tab-content">
            <app-savings-standing-instructions-tab
              [savingsAccountId]="accountId"
              [clientId]="clientId()"
            ></app-savings-standing-instructions-tab>
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
        color: var(--text-muted);
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
        color: var(--text-muted);
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
        color: var(--text-muted);
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
      .incentives-table {
        margin-top: 8px;
        background: var(--ion-color-light, #f4f5f8);
      }
    `,
  ],
})
export class DepositAccountViewComponent implements OnInit, OnDestroy {
  /** Selected tab; mat-tab-group tracked this internally, ion-segment does not. */
  /** Exposed so the template names its tabs instead of numbering them. */
  protected readonly TAB = DEPOSIT_TAB;

  private readonly popovers = viewChildren(IonPopover);

  readonly activeTab = signal<DepositTab>(DEPOSIT_TAB.overview);
  private readonly route = inject(ActivatedRoute);
  /**
   * Today, as the platform reckons it: the business date when one governs, and the platform's
   * own clock otherwise. Fineract judges "the future" by that reckoning, so a date seeded from
   * `new Date()` is refused whenever the browser runs ahead of it (#758).
   */
  private readonly platformDate = inject(PlatformDateService);
  private readonly router = inject(Router);
  private readonly deposits = inject(DEPOSIT_ACCOUNT_API);
  private readonly dialogService = inject(DialogService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  accountId = 0;
  isRD = false;
  readonly transactions = signal<DepositTransaction[]>([]);
  readonly charges = signal<DepositAccountCharge[]>([]);

  /**
   * The account, as the adapter models it — the whole of what this screen knows about it.
   *
   * There used to be a second signal beside this one holding the payload itself, which the
   * template read by string. That is how the heading came to bind `productName`, a field a
   * deposit account does not send. See `DepositAccount`.
   */
  readonly deposit = signal<DepositAccount | null>(null);

  /** Which kind of deposit this screen is showing, for the adapter's operations. */
  private get depositType(): DepositType {
    return this.isRD ? 'recurring' : 'fixed';
  }

  /**
   * The charges this account's product allows, from the account template.
   *
   * A deposit account is a savings-type account, so the charge is created through
   * `POST /savingsaccounts/{id}/charges` — but *which* charges are valid is a property of the
   * deposit product, and the account template is what states it. With none, the Add button is
   * disabled rather than opening a dialog with an empty list.
   */
  readonly chargeOptions = signal<{ id?: number; name?: string }[]>([]);
  readonly chartRows = signal<readonly DepositChartRow[]>([]);
  readonly expandedSlabIndex = signal<number | null>(null);
  readonly isLoading = signal(true);
  /**
   * Why the account is not on screen: absent, or the read failed. `null` once it is loaded.
   *
   * This replaces a `hasError` boolean that nothing rendered — the template was wrapped in
   * `@if (deposit())`, so a failed read showed the breadcrumb and an empty page, which is the
   * savings view's #763 on this screen. Two states, because a 404 or 403 cannot be retried.
   */
  readonly loadError = signal<'not-found' | 'failed' | null>(null);

  readonly transactionColumns = ['id', 'date', 'type', 'amount', 'runningBalance', 'actions'];
  readonly chargeColumns = ['name', 'amount', 'outstanding'];

  ngOnInit(): void {
    this.accountId = Number(this.route.snapshot.paramMap.get('id'));
    this.isRD = this.router.url.includes('recurring');
    this.loadData();
  }

  ngOnDestroy(): void {
    for (const popover of this.popovers()) {
      void popover.dismiss().catch(() => false);
    }
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

    this.deposits.get(this.depositType, this.accountId).subscribe({
      next: (account) => {
        this.deposit.set(account);
        this.charges.set([...account.charges]);
        this.chartRows.set(account.chartRows);
        this.loadError.set(null);
        this.isLoading.set(false);
        this.loadTransactions();
        this.loadChargeOptions();
      },
      // The interceptor's toast still fires here, unlike on the savings view: this read goes
      // through `DEPOSIT_ACCOUNT_API`, which takes no per-request context, and suppressing it
      // inside the adapter would also silence the deposit *form*, which reports nothing of its
      // own. A toast beside the panel is a duplicate report; a silent form is a blank screen.
      error: (error: HttpErrorResponse) => {
        this.loadError.set(error.status === 404 || error.status === 403 ? 'not-found' : 'failed');
        this.isLoading.set(false);
      },
    });
  }

  /**
   * The charges this product allows, from the account template.
   *
   * Addressed with the client and product the account itself reports, because the template's
   * `chargeOptions` is product-specific — offering a charge the product does not allow would be
   * a dialog whose submit can only be refused.
   */
  private loadChargeOptions(): void {
    const clientId = this.deposit()?.clientId;
    const productId = this.deposit()?.productId;
    if (clientId === null || clientId === undefined) return;
    if (productId === null || productId === undefined) return;

    this.deposits.template(this.depositType, clientId, productId).subscribe({
      next: (template) => this.chargeOptions.set([...template.chargeOptions]),
      error: () => this.chargeOptions.set([]),
    });
  }

  /**
   * Adds a charge to this deposit account.
   *
   * `POST /savingsaccounts/{id}/charges` — a deposit account is a savings-type account, and this
   * is the endpoint the platform exposes for it; there is no deposit-specific one. `amount` and
   * `dueDate` are both demanded, which is the same pair the savings charge screens send.
   */
  async onAddCharge(): Promise<void> {
    const options = this.chargeOptions();
    if (options.length === 0) return;

    const values = await this.dialogService.prompt({
      title: this.i18n.translate('SAVINGS_CHARGES.CREATE'),
      message: this.i18n.translate('SAVINGS_CHARGES.CHARGE'),
      fields: [
        {
          name: 'chargeId',
          label: this.i18n.translate('SAVINGS_CHARGES.CHARGE'),
          type: 'select',
          value: options[0]?.id,
          options: options
            .filter((option): option is { id: number; name: string } => option.id !== undefined)
            .map((option) => ({ id: option.id, name: option.name ?? String(option.id) })),
        },
        {
          name: 'amount',
          label: this.i18n.translate('COMMON.AMOUNT'),
          type: 'number',
        },
        {
          name: 'dueDate',
          label: this.i18n.translate('SAVINGS_CHARGES.DUE_DATE'),
          type: 'date',
          value: this.platformDate.today(),
        },
      ],
    });
    if (!values) return;

    this.deposits
      .addCharge(this.accountId, {
        chargeId: Number(values['chargeId']),
        amount: Number(values['amount']),
        dueDate: String(values['dueDate']),
      })
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.translate('CHARGES.SAVED'));
          // One read brings the charge list back with the account, so there is nothing separate
          // to refresh.
          this.loadData();
        },
        error: () => this.notifications.error(this.i18n.translate('CHARGES.FAILED')),
      });
  }

  onToggleIncentives(index: number): void {
    this.expandedSlabIndex.set(this.expandedSlabIndex() === index ? null : index);
  }

  /**
   * Reads the transaction list, which the account read does not carry.
   *
   * How it is fetched differs by deposit type, and that divergence now lives in
   * `FineractDepositAccountApi` where it is a fact about the platform rather than about this
   * screen.
   *
   * A failure here leaves the rest of the screen intact: the account loaded, and a missing
   * transaction list is not a reason to blank the lifecycle actions.
   */
  private loadTransactions(): void {
    this.deposits.transactions(this.depositType, this.accountId).subscribe({
      next: (transactions) => this.transactions.set(transactions),
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
  canUndo(transaction: DepositTransaction): boolean {
    return this.isActive() && !transaction.reversed;
  }

  /**
   * Reverses a transaction.
   *
   * The row is not removed. Fineract marks it `reversed` and keeps it in the list, and the tab
   * renders it struck through — an undone transaction that vanished would take the audit trail
   * with it.
   */
  onUndoTransaction(transaction: DepositTransaction): void {
    const transactionId = transaction.id;
    void this.dialogService
      .confirm({
        title: this.i18n.translate('ACTIONS.UNDO_TRANSACTION'),
        message: this.i18n.translate('ACTIONS.CONFIRM_UNDO_TRANSACTION'),
        destructive: true,
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.deposits
          .transactionCommand(this.depositType, this.accountId, transactionId, 'undo')
          .subscribe({
            next: () => {
              void this.notifications.success(this.i18n.translate('COMMON.SUCCESS'));
              this.loadData();
            },
            error: () => undefined,
          });
      });
  }

  getStatusValue(): string {
    return this.deposit()?.status.value ?? '';
  }

  getCurrencySymbol(): string {
    return this.deposit()?.currencySymbol ?? '';
  }

  /**
   * The account's balance.
   *
   * `summary.accountBalance`, not the top level. A deposit account response carries no
   * `accountBalance` of its own — measured against a running Fineract, where an active fixed
   * deposit holding 5,000 answers `accountBalance: undefined` and
   * `summary: { accountBalance: 5000 }`. Reading the top level rendered the balance as blank on
   * every deposit account, which is issue #764.
   *
   * The top level is still read as a fallback rather than dropped: the savings screens share
   * this component's shape, and a payload that does carry it should not be ignored.
   */
  getAccountBalance(): number | null {
    return this.deposit()?.balance ?? null;
  }

  /** The figures that define a term deposit, each absent from the view before #764. */
  getDepositAmount(): number | null {
    return this.deposit()?.depositAmount ?? null;
  }

  getMaturityAmount(): number | null {
    return this.deposit()?.maturityAmount ?? null;
  }

  getMaturityDate(): string {
    return this.formatDate(this.deposit()?.maturityDate);
  }

  /**
   * The term, as "12 Months".
   *
   * The unit is `depositPeriodFrequency`, which the payload sends as an enum object — a bare
   * "12" could be days, months or years and the three are not interchangeable in a
   * conversation with a customer.
   */
  getDepositTerm(): string {
    const period = this.deposit()?.depositPeriod;
    if (period === null || period === undefined) return '';
    const unit = this.deposit()?.depositPeriodUnit ?? '';
    return unit ? `${period} ${unit}` : String(period);
  }

  /** The savings account this deposit draws from, if one was linked. See the form for why. */
  getLinkedAccountNo(): string {
    return this.deposit()?.linkedAccountNo ?? '';
  }

  getActivationDate(): string {
    return this.formatDate(this.deposit()?.timeline.activatedOnDate);
  }

  readonly clientId = computed(() => this.deposit()?.clientId ?? undefined);

  /**
   * A date as the browser's locale writes it, or `'-'`.
   *
   * Every date this screen holds is now ISO `YYYY-MM-DD`: the account's own dates always were,
   * and a transaction row's is since the adapter started modelling them. It used to also accept
   * Fineract's `[year, month, day]`, because the rows arrived as raw payload records — narrowing
   * it then threw `date.split is not a function` once per row, which emptied the row and took
   * its actions with it.
   *
   * The parts are read out and handed to the local-time constructor rather than to
   * `new Date('2026-10-18')`, which ECMAScript reads as UTC midnight — west of Greenwich that
   * renders as the day before.
   */
  formatDate(date: string | null | undefined): string {
    const [year, month, day] = (date ?? '').split('-').map(Number);
    if (!year || !month || !day) return '-';
    return new Date(year, month - 1, day).toLocaleDateString();
  }

  // --- Lifecycle ------------------------------------------------------------------------------

  /**
   * Fineract reports a deposit account's state as booleans beside the id, exactly as it does for
   * savings, and the actions gate on those rather than on `status.value` — the value is the
   * server's English label and moves with its locale.
   */
  readonly isPending = computed(() => this.deposit()?.status.submittedAndPendingApproval === true);
  readonly isApproved = computed(() => this.deposit()?.status.approved === true);
  readonly isActive = computed(() => this.deposit()?.status.active === true);

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
  private commandDateIso(floor: string | null): string {
    const today = this.platformDate.today();
    return floor !== null && floor > today ? floor : today;
  }

  private commandDate(floor: string | null): string {
    return formatDateToFineract(this.commandDateIso(floor));
  }

  /** `locale` and `dateFormat` belong with a date, and only with one — see `onUndoApproval`. */
  private dated(field: string, floor: string | null): Record<string, unknown> {
    return {
      [field]: this.commandDate(floor),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    };
  }

  onApprove(): void {
    this.confirmCommand('APPROVE', 'approve', () =>
      this.dated('approvedOnDate', this.deposit()?.timeline.submittedOnDate ?? null),
    );
  }

  onReject(): void {
    this.confirmCommand(
      'REJECT',
      'reject',
      () => this.dated('rejectedOnDate', this.deposit()?.timeline.submittedOnDate ?? null),
      true,
    );
  }

  onWithdrawnByApplicant(): void {
    this.confirmCommand('WITHDRAWN_BY_CLIENT', 'withdrawnByApplicant', () =>
      this.dated('withdrawnOnDate', this.deposit()?.timeline.submittedOnDate ?? null),
    );
  }

  onActivate(): void {
    this.confirmCommand('ACTIVATE', 'activate', () =>
      this.dated('activatedOnDate', this.deposit()?.timeline.approvedOnDate ?? null),
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
   * Both need to say what happens to the money, and the dialog now collects whichever extra
   * field the chosen option requires: an account for a transfer to savings, nothing for a
   * withdrawal or a re-investment. A premature closure cannot re-invest at all — the platform
   * answers `reinvest.not.allowed` — which the dialog handles by not offering it.
   */
  onClose(): void {
    void this.closeAccount(false);
  }

  onPrematureClose(): void {
    void this.closeAccount(true);
  }

  private async closeAccount(premature: boolean): Promise<void> {
    const activatedOn = this.deposit()?.timeline.activatedOnDate ?? null;
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
      // Both only for a transfer to savings, where the platform makes the target mandatory.
      ...(result.toSavingsAccountId === undefined
        ? {}
        : {
            toSavingsAccountId: result.toSavingsAccountId,
            transferDescription: result.transferDescription,
          }),
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
    this.deposits.command(this.depositType, this.accountId, command, body).subscribe({
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

  /** Returns to the owning client, falling back to the deposit list (#797). */
  onBack(): void {
    const clientId = this.deposit()?.clientId;
    if (clientId) {
      this.router.navigate(['/clients/view', clientId]);
      return;
    }
    const path = this.isRD ? '/products/recurring-deposits' : '/products/fixed-deposits';
    this.router.navigate([path]);
  }
}
