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

import { computed, inject, signal, Component, OnInit } from '@angular/core';
import { from } from 'rxjs';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DecimalPipe, NgClass } from '@angular/common';
import {
  SavingsAccountService,
  SavingsAccountTransactionsService,
  SavingsAccountData,
  SavingsAccountTransactionData,
  SavingsAccountChargeData,
} from '../../api';
import { StatusBadgeComponent, RequiresPermissionDirective } from '../../shared';
import { EntityNotesComponent } from '../../shared/components/entity-notes/entity-notes.component';
import { EntityDocumentsComponent } from '../../shared/components/entity-documents/entity-documents.component';
import { EntityDatatablesComponent } from '../../shared/components/entity-datatables/entity-datatables.component';
import { SavingsStandingInstructionsTabComponent } from './savings/savings-standing-instructions-tab.component';
import { NotificationService } from '../../core/services/notification.service';
import { DialogService } from '../../core/services/dialog.service';
import {
  SavingsBlockDialogComponent,
  SavingsBlockDialogData,
  SavingsBlockResult,
} from './savings-block-dialog.component';
import {
  SavingsOfficerDialogComponent,
  SavingsOfficerResult,
} from './savings-officer-dialog.component';
import {
  formatDateToFineract,
  toIsoDate,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../core/utils/date-formatter';
import { CdkTableModule } from '@angular/cdk/table';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonChip,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular/standalone';
import {
  resolveAccountActionType,
  resolveAccountRoutePrefix,
} from '../../core/utils/account-type-resolver';

/**
 * The tabs on this screen, named.
 *
 * They were positional strings — '0', '7' — which say nothing at the point of use and shift
 * meaning whenever a tab is inserted in the middle. The values are still strings because
 * `ion-segment` compares them as such.
 */
export const SAVINGS_TAB = {
  overview: 'overview',
  transactions: 'transactions',
  charges: 'charges',
  notes: 'notes',
  documents: 'documents',
  standingInstructions: 'standingInstructions',
  customFields: 'customFields',
} as const;

export type SavingsTab = (typeof SAVINGS_TAB)[keyof typeof SAVINGS_TAB];

@Component({
  selector: 'app-savings-account-view',
  standalone: true,
  imports: [
    EntityNotesComponent,
    EntityDocumentsComponent,
    EntityDatatablesComponent,
    SavingsStandingInstructionsTabComponent,
    RouterModule,
    TranslateModule,
    CdkTableModule,
    StatusBadgeComponent,
    RequiresPermissionDirective,
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
    IonChip,
    IonItem,
    IonLabel,
    IonList,
    IonPopover,
    TooltipDirective,
  ],
  template: `
    @if (account()) {
      <div class="view-container">
        <!-- Header Actions Card -->
        <ion-card class="header-card">
          <ion-card-content class="header-content">
            <div class="savings-title-area">
              <div class="avatar-circle">
                <ion-icon name="wallet-outline"></ion-icon>
              </div>
              <div class="title-details">
                <h2>{{ account()?.savingsProductName }}</h2>
                <div class="subtitle-row">
                  <span class="account-no">#{{ account()?.accountNo }}</span>
                  <span class="divider">|</span>
                  <span class="client-name">Client: {{ account()?.clientName }}</span>
                  <app-status-badge
                    [status]="account()?.status"
                    class="status-badge"
                  ></app-status-badge>
                  @if (blockLabelKey(); as blockKey) {
                    <ion-chip color="warning" highlighted data-testid="savings-blocked-chip">
                      {{ blockKey | translate }}
                    </ion-chip>
                  }
                </div>
              </div>
            </div>
            <div class="actions-area">
              @if (account()?.status?.submittedAndPendingApproval) {
                <ion-button
                  color="secondary"
                  appRequiresPermission="APPROVE_SAVINGSACCOUNT"
                  (click)="onSavingsAction('approve')"
                  [appTooltip]="'SAVINGS.APPROVE' | translate"
                >
                  <ion-icon name="checkmark-circle-outline"></ion-icon>
                  {{ 'SAVINGS.APPROVE' | translate }}
                </ion-button>
              }
              @if (account()?.status?.submittedAndPendingApproval) {
                <ion-button
                  color="danger"
                  fill="outline"
                  data-testid="savings-reject"
                  appRequiresPermission="REJECT_SAVINGSACCOUNT"
                  (click)="onDatedCommand('reject', 'rejectedOnDate')"
                >
                  <ion-icon name="close-circle-outline"></ion-icon>
                  {{ 'SAVINGS.REJECT' | translate }}
                </ion-button>
                <ion-button
                  color="medium"
                  fill="outline"
                  data-testid="savings-withdrawn"
                  appRequiresPermission="WITHDRAW_SAVINGSACCOUNT"
                  (click)="onDatedCommand('withdrawnByApplicant', 'withdrawnOnDate')"
                >
                  <ion-icon name="arrow-undo-outline"></ion-icon>
                  {{ 'SAVINGS.WITHDRAWN_BY_APPLICANT' | translate }}
                </ion-button>
              }
              @if (account()?.status?.approved) {
                <ion-button
                  color="primary"
                  appRequiresPermission="ACTIVATE_SAVINGSACCOUNT"
                  (click)="onSavingsAction('activate')"
                  [appTooltip]="'SAVINGS.ACTIVATE' | translate"
                >
                  <ion-icon name="play-circle-outline"></ion-icon>
                  {{ 'SAVINGS.ACTIVATE' | translate }}
                </ion-button>
              }
              @if (account()?.status?.active) {
                <ion-button
                  color="danger"
                  appRequiresPermission="CLOSE_SAVINGSACCOUNT"
                  (click)="onSavingsAction('close')"
                  [appTooltip]="'SAVINGS.CLOSE' | translate"
                >
                  <ion-icon name="power-outline"></ion-icon>
                  {{ 'SAVINGS.CLOSE' | translate }}
                </ion-button>
              }
              <ion-button
                color="primary"
                appRequiresPermission="DEPOSIT_SAVINGSACCOUNT"
                (click)="onTransaction('deposit')"
                [appTooltip]="'SAVINGS.DEPOSIT_CASH' | translate"
              >
                <ion-icon name="add-circle-outline"></ion-icon>
                {{ 'SAVINGS.DEPOSIT' | translate }}
              </ion-button>
              <ion-button
                color="danger"
                appRequiresPermission="WITHDRAW_SAVINGSACCOUNT"
                (click)="onTransaction('withdrawal')"
                [appTooltip]="'SAVINGS.WITHDRAW_CASH' | translate"
              >
                <ion-icon name="remove-circle-outline"></ion-icon>
                {{ 'SAVINGS.WITHDRAW' | translate }}
              </ion-button>
              @if (isActive()) {
                <ion-button color="primary" id="savingsMenu-trigger" data-testid="savings-actions">
                  <ion-icon name="caret-down-outline"></ion-icon>
                  {{ 'COMMON.ACTIONS' | translate }}
                </ion-button>
                <ion-popover trigger="savingsMenu-trigger" [dismissOnSelect]="true">
                  <ng-template>
                    <ion-list>
                      <ion-item
                        button
                        data-testid="savings-calculate-interest"
                        (click)="onSimpleCommand('calculateInterest')"
                      >
                        <ion-icon slot="start" name="calculator-outline"></ion-icon>
                        <ion-label>{{ 'SAVINGS.CALCULATE_INTEREST' | translate }}</ion-label>
                      </ion-item>

                      <ion-item
                        button
                        data-testid="savings-post-interest"
                        (click)="onSimpleCommand('postInterest')"
                      >
                        <ion-icon slot="start" name="trending-up-outline"></ion-icon>
                        <ion-label>{{ 'SAVINGS.POST_INTEREST' | translate }}</ion-label>
                      </ion-item>

                      <ion-item
                        button
                        data-testid="savings-apply-annual-fees"
                        (click)="onSimpleCommand('applyAnnualFees')"
                      >
                        <ion-icon slot="start" name="pricetag-outline"></ion-icon>
                        <ion-label>{{ 'SAVINGS.APPLY_ANNUAL_FEES' | translate }}</ion-label>
                      </ion-item>

                      <ion-item
                        button
                        data-testid="savings-assign-officer"
                        (click)="onAssignOfficer()"
                      >
                        <ion-icon slot="start" name="person-add-outline"></ion-icon>
                        <ion-label>{{ 'SAVINGS.ASSIGN_OFFICER' | translate }}</ion-label>
                      </ion-item>

                      @if (hasOfficer()) {
                        <ion-item
                          button
                          data-testid="savings-unassign-officer"
                          (click)="onDatedCommand('unassignSavingsOfficer', 'unassignedDate')"
                        >
                          <ion-icon slot="start" name="person-remove-outline"></ion-icon>
                          <ion-label>{{ 'SAVINGS.UNASSIGN_OFFICER' | translate }}</ion-label>
                        </ion-item>
                      }

                      <ion-item button data-testid="savings-hold-amount" (click)="onHoldAmount()">
                        <ion-icon slot="start" name="pause-circle-outline"></ion-icon>
                        <ion-label>{{ 'SAVINGS.HOLD_AMOUNT' | translate }}</ion-label>
                      </ion-item>

                      @if (!isBlocked()) {
                        <ion-item
                          button
                          class="warn-item"
                          data-testid="savings-block"
                          (click)="onBlockCommand('block')"
                        >
                          <ion-icon slot="start" color="danger" name="lock-closed-outline">
                          </ion-icon>
                          <ion-label>{{ 'SAVINGS.BLOCK' | translate }}</ion-label>
                        </ion-item>

                        @if (!isDebitBlocked()) {
                          <ion-item
                            button
                            data-testid="savings-block-debit"
                            (click)="onBlockCommand('blockDebit')"
                          >
                            <ion-icon slot="start" name="arrow-up-circle-outline"></ion-icon>
                            <ion-label>{{ 'SAVINGS.BLOCK_DEBIT' | translate }}</ion-label>
                          </ion-item>
                        }
                        @if (!isCreditBlocked()) {
                          <ion-item
                            button
                            data-testid="savings-block-credit"
                            (click)="onBlockCommand('blockCredit')"
                          >
                            <ion-icon slot="start" name="arrow-down-circle-outline"></ion-icon>
                            <ion-label>{{ 'SAVINGS.BLOCK_CREDIT' | translate }}</ion-label>
                          </ion-item>
                        }
                      }

                      <!-- Reversals only. Fineract rejects each one unless the matching block is
                           actually in force, so they appear only when it is. -->
                      @if (isBlocked()) {
                        <ion-item
                          button
                          data-testid="savings-unblock"
                          (click)="onSimpleCommand('unblock')"
                        >
                          <ion-icon slot="start" name="lock-open-outline"></ion-icon>
                          <ion-label>{{ 'SAVINGS.UNBLOCK' | translate }}</ion-label>
                        </ion-item>
                      }
                      @if (isDebitBlocked()) {
                        <ion-item
                          button
                          data-testid="savings-unblock-debit"
                          (click)="onSimpleCommand('unblockDebit')"
                        >
                          <ion-icon slot="start" name="lock-open-outline"></ion-icon>
                          <ion-label>{{ 'SAVINGS.UNBLOCK_DEBIT' | translate }}</ion-label>
                        </ion-item>
                      }
                      @if (isCreditBlocked()) {
                        <ion-item
                          button
                          data-testid="savings-unblock-credit"
                          (click)="onSimpleCommand('unblockCredit')"
                        >
                          <ion-icon slot="start" name="lock-open-outline"></ion-icon>
                          <ion-label>{{ 'SAVINGS.UNBLOCK_CREDIT' | translate }}</ion-label>
                        </ion-item>
                      }
                    </ion-list>
                  </ng-template>
                </ion-popover>
              }
              <ion-button fill="clear" (click)="onBack()">
                <ion-icon name="arrow-back-outline"></ion-icon>
                {{ 'COMMON.BACK' | translate }}
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Tabs Section -->
        <ion-segment [value]="activeTab()" (ionChange)="activeTab.set($any($event).detail.value)">
          <ion-segment-button [value]="TAB.overview">
            <ion-label>Overview</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.transactions" data-testid="savings-tab-transactions">
            <ion-label>{{ 'COMMON.TRANSACTIONS' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.charges">
            <ion-label>{{ 'LOANS.CHARGES' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.notes" data-testid="savings-tab-notes">
            <ion-label>{{ 'SAVINGS.NOTES' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.documents" data-testid="savings-tab-documents">
            <ion-label>{{ 'SAVINGS.DOCUMENTS' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button
            [value]="TAB.standingInstructions"
            data-testid="savings-tab-standing-instructions"
          >
            <ion-label>{{ 'SAVINGS.STANDING_INSTRUCTIONS' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.customFields" data-testid="savings-tab-custom-fields">
            <ion-label>{{ 'SYSTEM.CUSTOM_FIELDS' | translate }}</ion-label>
          </ion-segment-button>
        </ion-segment>

        @if (activeTab() === TAB.overview) {
          <div class="tab-content">
            <div class="info-grid">
              <ion-card class="info-card">
                <ion-card-header>
                  <ion-card-title>
                    <ion-icon name="information-circle-outline"></ion-icon>
                    Interest Settings
                  </ion-card-title>
                </ion-card-header>
                <ion-card-content class="details-list">
                  <div class="detail-item">
                    <span class="label">Nominal Annual Interest Rate</span>
                    <span class="value">{{ account()?.nominalAnnualInterestRate }}%</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Compounding Period</span>
                    <span class="value">{{ account()?.interestCompoundingPeriodType?.value }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Posting Period</span>
                    <span class="value">{{ account()?.interestPostingPeriodType?.value }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Interest Calculation Day-in-Year</span>
                    <span class="value">{{
                      account()?.interestCalculationDaysInYearType?.value
                    }}</span>
                  </div>
                </ion-card-content>
              </ion-card>

              <ion-card class="info-card">
                <ion-card-header>
                  <ion-card-title>
                    <ion-icon name="pulse-outline"></ion-icon>
                    Timeline & Balance
                  </ion-card-title>
                </ion-card-header>
                <ion-card-content class="details-list">
                  <div class="detail-item">
                    <span class="label">Submitted On Date</span>
                    <span class="value">{{ formattedSubmittedDate }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Activated On Date</span>
                    <span class="value">{{ formattedActivatedDate }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Field Officer</span>
                    <span class="value">{{ account()?.fieldOfficerName || '-' }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Account Balance</span>
                    <span class="value">
                      {{ account()?.currency?.displaySymbol }}
                      {{ account()?.summary?.accountBalance || 0 | number: '1.2-2' }}
                    </span>
                  </div>
                </ion-card-content>
              </ion-card>
            </div>
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
                            'debit-amount': tx.debit && !tx.reversed,
                            'credit-amount': tx.credit && !tx.reversed,
                            'reversed-amount': tx.reversed,
                          }"
                        >
                          {{ tx.debit ? '-' : tx.credit ? '+' : '' }}
                          {{ account()?.currency?.displaySymbol }}{{ tx.amount | number: '1.2-2' }}
                        </span>
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="runningBalance">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'COMMON.RUNNING_BALANCE' | translate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let tx">
                        {{ account()?.currency?.displaySymbol }}
                        {{ tx.runningBalance || 0 | number: '1.2-2' }}
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="actions">
                      <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.ACTIONS' | translate }}</th>
                      <td cdk-cell *cdkCellDef="let tx">
                        @if (canRelease(tx)) {
                          <ion-button
                            fill="clear"
                            size="small"
                            [attr.data-testid]="'savings-tx-release-' + tx.id"
                            [attr.aria-label]="'ACTIONS.RELEASE_AMOUNT' | translate"
                            (click)="onReleaseAmount(tx)"
                          >
                            <ion-icon name="lock-open-outline"></ion-icon>
                          </ion-button>
                        } @else if (canUndo(tx)) {
                          <ion-button
                            fill="clear"
                            color="danger"
                            size="small"
                            [attr.data-testid]="'savings-tx-undo-' + tx.id"
                            [attr.aria-label]="'ACTIONS.UNDO_TRANSACTION' | translate"
                            (click)="onUndoTransaction(tx)"
                          >
                            <ion-icon name="arrow-undo-outline"></ion-icon>
                          </ion-button>
                        } @else if (tx.reversed) {
                          <span class="reversed-marker" data-testid="savings-tx-reversed">
                            {{ 'COMMON.REVERSED' | translate }}
                          </span>
                        }
                      </td>
                    </ng-container>

                    <tr cdk-header-row *cdkHeaderRowDef="transactionColumns"></tr>
                    <tr cdk-row *cdkRowDef="let row; columns: transactionColumns"></tr>
                  </table>
                } @else {
                  <div class="empty-state">
                    <ion-icon name="receipt-outline"></ion-icon>
                    <p>{{ 'LOANS.NO_TRANSACTIONS' | translate }}</p>
                  </div>
                }
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
                      <td cdk-cell *cdkCellDef="let c">
                        {{ account()?.currency?.displaySymbol }} {{ c.amount | number: '1.2-2' }}
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="outstanding">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.OUTSTANDING' | translate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let c">
                        {{ account()?.currency?.displaySymbol }}
                        {{ c.amountOutstanding | number: '1.2-2' }}
                      </td>
                    </ng-container>

                    <tr cdk-header-row *cdkHeaderRowDef="chargeColumns"></tr>
                    <tr cdk-row *cdkRowDef="let row; columns: chargeColumns"></tr>
                  </table>
                } @else {
                  <div class="empty-state">
                    <ion-icon name="cash-outline"></ion-icon>
                    <p>{{ 'SAVINGS.NO_CHARGES' | translate }}</p>
                  </div>
                }
              </ion-card-content>
            </ion-card>
          </div>
        }

        @if (activeTab() === TAB.notes) {
          <div class="tab-content">
            <app-entity-notes resourceType="savings" [resourceId]="accountId"></app-entity-notes>
          </div>
        }

        @if (activeTab() === TAB.documents) {
          <div class="tab-content">
            <app-entity-documents
              entityType="savings"
              [entityId]="accountId"
            ></app-entity-documents>
          </div>
        }

        @if (activeTab() === TAB.standingInstructions) {
          <div class="tab-content">
            <app-savings-standing-instructions-tab
              [savingsAccountId]="accountId"
              [clientId]="account()?.clientId"
            ></app-savings-standing-instructions-tab>
          </div>
        }

        @if (activeTab() === TAB.customFields) {
          <div class="tab-content">
            <app-entity-datatables
              apptableName="m_savings_account"
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
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }
      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
      }
      .savings-title-area {
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
        color: #2c3e50;
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
      .actions-area {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .tab-group {
        background-color: #fff;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }
      .tab-content {
        padding: 24px;
      }
      .info-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 24px;
      }
      .info-card {
        border-radius: 8px;
        border: 1px solid #eaedf1;
      }
      .info-card mat-card-header {
        margin-bottom: 12px;
      }
      .info-card mat-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
        color: #34495e;
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
        border-bottom: 1px solid #f5f7fa;
      }
      .detail-item .label {
        color: #7f8c8d;
        font-size: 14px;
        font-weight: 500;
      }
      .detail-item .value {
        color: #2c3e50;
        font-size: 14px;
        font-weight: 600;
      }
      .table-card {
        border: 1px solid #eaedf1;
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
      .debit-amount {
        color: #e74c3c;
        font-weight: 600;
      }
      .credit-amount {
        color: #2ecc71;
        font-weight: 600;
      }
      .reversed-amount {
        text-decoration: line-through;
        opacity: 0.6;
        color: #7f8c8d;
      }
      .reversed-marker {
        color: #7f8c8d;
        font-style: italic;
      }
    `,
  ],
})
export class SavingsAccountViewComponent implements OnInit {
  /** Selected tab; mat-tab-group tracked this internally, ion-segment does not. */
  /** Exposed so the template names its tabs instead of numbering them. */
  protected readonly TAB = SAVINGS_TAB;

  readonly activeTab = signal<SavingsTab>(SAVINGS_TAB.overview);
  private readonly savingsService = inject(SavingsAccountService);
  private readonly savingsTransactionsService = inject(SavingsAccountTransactionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly dialogService = inject(DialogService);
  private readonly translate = inject(TranslateService);

  accountId = 0;
  readonly account = signal<SavingsAccountData | null>(null);
  readonly transactions = signal<SavingsAccountTransactionData[]>([]);
  readonly charges = signal<SavingsAccountChargeData[]>([]);

  transactionColumns = ['id', 'date', 'type', 'amount', 'runningBalance', 'actions'];
  chargeColumns = ['name', 'amount', 'outstanding'];

  get formattedSubmittedDate(): string {
    const dates = this.account()?.timeline?.submittedOnDate as unknown as number[];
    if (dates && Array.isArray(dates)) {
      return new Date(dates[0], dates[1] - 1, dates[2]).toLocaleDateString();
    }
    return '-';
  }

  get formattedActivatedDate(): string {
    const dates = this.account()?.timeline?.activatedOnDate as unknown as number[];
    if (dates && Array.isArray(dates)) {
      return new Date(dates[0], dates[1] - 1, dates[2]).toLocaleDateString();
    }
    return '-';
  }

  formatDate(dates: number[] | undefined | null): string {
    if (dates && Array.isArray(dates)) {
      return new Date(dates[0], dates[1] - 1, dates[2]).toLocaleDateString();
    }
    return '-';
  }

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.accountId = +id;
        this.loadAccountData();
      }
    });
  }

  loadAccountData() {
    this.savingsService
      .getSavingsaccountsAccountId(this.accountId, false, undefined, 'all')
      .subscribe({
        next: (data) => {
          this.account.set(data);
          this.transactions.set(data.transactions || []);
          this.charges.set(data.charges || []);
        },
        error: () => this.notifications.error('Operation failed. Please try again.'),
      });
  }

  onTransaction(command: string) {
    this.router.navigate([`/products/savings-accounts/${this.accountId}/transactions/${command}`]);
  }

  /**
   * `subStatus` is where Fineract records a block; `status` stays `Active` throughout, so the
   * status badge alone cannot tell a frozen account from a healthy one.
   */
  readonly isActive = computed(() => this.account()?.status?.active === true);
  readonly isBlocked = computed(() => this.subStatus()?.['block'] === true);
  readonly isDebitBlocked = computed(() => this.subStatus()?.['blockDebit'] === true);
  readonly isCreditBlocked = computed(() => this.subStatus()?.['blockCredit'] === true);

  private subStatus(): Record<string, unknown> | undefined {
    return (this.account() as unknown as Record<string, Record<string, unknown>> | null)?.[
      'subStatus'
    ];
  }

  /** The most restrictive block in force, or null when the account moves freely. */
  blockLabelKey(): string | null {
    if (this.isBlocked()) return 'SAVINGS.BLOCKED';
    if (this.isDebitBlocked() && this.isCreditBlocked()) return 'SAVINGS.BLOCKED';
    if (this.isDebitBlocked()) return 'SAVINGS.DEBITS_BLOCKED';
    if (this.isCreditBlocked()) return 'SAVINGS.CREDITS_BLOCKED';
    return null;
  }

  /**
   * Commands that need nothing beyond a confirmation.
   *
   * Each was verified against a running Fineract: they accept `dateFormat` and `locale` and
   * nothing else. The block commands are deliberately not here — they require a
   * `reasonForBlock` drawn from a different code list per block type, which needs its own picker.
   */
  onSimpleCommand(command: string): void {
    const titleKey = `SAVINGS.${command.replaceAll(/([A-Z])/g, '_$1').toUpperCase()}`;
    from(
      this.dialogService.confirm({
        title: this.translate.instant(titleKey),
        message: this.translate.instant(
          `SAVINGS.CONFIRM_${command.replaceAll(/([A-Z])/g, '_$1').toUpperCase()}`,
        ),
      }),
    ).subscribe((confirmed) => {
      if (!confirmed) return;
      this.savingsService
        .postSavingsaccountsAccountId(
          this.accountId,
          { dateFormat: 'dd MMMM yyyy', locale: 'en' } as never,
          command,
        )
        .subscribe({
          next: () => this.afterCommand(),
          error: () => this.commandFailed(),
        });
    });
  }

  /**
   * The block commands, each of which needs a reason.
   *
   * The three draw from *different* Fineract code lists, so the reason cannot be a shared
   * lookup — picking from the wrong list would offer reasons the server rejects.
   */
  /** Whether an officer is assigned. Fineract reports none as `0`, not as absent. */
  readonly hasOfficer = computed(() => {
    const id = (this.account() as unknown as Record<string, unknown> | null)?.['fieldOfficerId'];
    return typeof id === 'number' && id > 0;
  });

  /**
   * Commands that need only a date, under the field name Fineract expects for that command.
   *
   * The name differs per command — `rejectedOnDate`, `withdrawnOnDate`, `unassignedDate` — so it
   * is passed in rather than guessed.
   */
  onDatedCommand(command: string, dateField: string): void {
    const key = command.replaceAll(/([A-Z])/g, '_$1').toUpperCase();
    from(
      this.dialogService.confirm({
        title: this.translate.instant(`SAVINGS.${key}`),
        message: this.translate.instant(`SAVINGS.CONFIRM_${key}`),
        destructive: command === 'reject',
      }),
    ).subscribe((confirmed) => {
      if (!confirmed) return;
      this.runCommand(command, {
        [dateField]: formatDateToFineract(toIsoDate(new Date())),
        dateFormat: FINERACT_DATE_FORMAT,
        locale: FINERACT_LOCALE,
      });
    });
  }

  onAssignOfficer(): void {
    from(this.dialogService.open<SavingsOfficerResult>(SavingsOfficerDialogComponent)).subscribe(
      (result) => {
        if (!result) return;
        this.runCommand('assignSavingsOfficer', {
          toSavingsOfficerId: result.toSavingsOfficerId,
          assignmentDate: formatDateToFineract(toIsoDate(new Date())),
          dateFormat: FINERACT_DATE_FORMAT,
          locale: FINERACT_LOCALE,
        });
      },
    );
  }

  /**
   * Ring-fences part of the balance.
   *
   * Distinct from a block: a hold leaves the rest of the account working, which is the difference
   * between securing the disputed amount and freezing a customer out of their own money.
   */
  onHoldAmount(): void {
    from(
      this.dialogService.open<SavingsBlockResult>(SavingsBlockDialogComponent, {
        data: {
          titleKey: 'SAVINGS.HOLD_AMOUNT',
          messageKey: 'SAVINGS.CONFIRM_HOLD_AMOUNT',
          codeName: 'SavingsAccountBlockReasons',
          withAmount: true,
        } satisfies SavingsBlockDialogData,
      }),
    ).subscribe((result) => {
      if (!result?.transactionAmount) return;
      // On the transactions endpoint, not the account one, and the amount field is
      // `transactionAmount` — `amount` is rejected outright.
      this.savingsTransactionsService
        .postSavingsaccountsSavingsIdTransactions(
          this.accountId,
          {
            transactionAmount: result.transactionAmount,
            reasonForBlock: result.reasonForBlock,
            transactionDate: formatDateToFineract(toIsoDate(new Date())),
            dateFormat: FINERACT_DATE_FORMAT,
            locale: FINERACT_LOCALE,
          } as never,
          'holdAmount',
        )
        .subscribe({
          next: () => this.afterCommand(),
          error: () => this.commandFailed(),
        });
    });
  }

  /**
   * Whether this row is a hold that still ties up money.
   *
   * A hold is `transactionType.amountHold`; once released, Fineract records the id of the
   * releasing transaction on it. `releaseTransactionId` is `0` — not absent — while the hold
   * stands, so the check is for a truthy id rather than for the key. Releasing twice is refused
   * with `validation.msg.amount.is.not.on.hold`, and offering the button anyway would turn a
   * settled claim into an error toast.
   */
  canRelease(transaction: SavingsAccountTransactionData): boolean {
    const raw = transaction as unknown as Record<string, unknown>;
    const type = raw['transactionType'] as Record<string, unknown> | undefined;
    return Boolean(type?.['amountHold']) && !raw['releaseTransactionId'];
  }

  /**
   * Whether this row can still be reversed.
   *
   * Holds and releases are excluded even though the platform accepts `undo` against them and
   * answers `200`: a hold is unwound by releasing it, and an undo there reports success without
   * freeing the money. Already-reversed rows are excluded for the same reason.
   */
  canUndo(transaction: SavingsAccountTransactionData): boolean {
    const raw = transaction as unknown as Record<string, unknown>;
    const type = raw['transactionType'] as Record<string, unknown> | undefined;
    return !raw['reversed'] && !type?.['amountHold'] && !type?.['amountRelease'];
  }

  /**
   * Frees a held amount.
   *
   * `releaseAmount` is addressed to the hold transaction itself, not to the account, and takes no
   * body — the platform derives the amount from the transaction being released.
   */
  onReleaseAmount(transaction: SavingsAccountTransactionData): void {
    void this.dialogService
      .confirm({
        title: this.translate.instant('ACTIONS.RELEASE_AMOUNT'),
        message: this.translate.instant('ACTIONS.CONFIRM_RELEASE_AMOUNT'),
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.runTransactionCommand(Number(transaction.id), 'releaseAmount');
      });
  }

  /**
   * Reverses a transaction.
   *
   * The row stays in the list, struck through — Fineract marks it `reversed` rather than deleting
   * it, and the ledger depends on that entry still being there.
   */
  onUndoTransaction(transaction: SavingsAccountTransactionData): void {
    void this.dialogService
      .confirm({
        title: this.translate.instant('ACTIONS.UNDO_TRANSACTION'),
        message: this.translate.instant('ACTIONS.CONFIRM_UNDO_TRANSACTION'),
        destructive: true,
      })
      .then((confirmed) => {
        if (!confirmed) return;
        this.runTransactionCommand(Number(transaction.id), 'undo');
      });
  }

  private runTransactionCommand(transactionId: number, command: string): void {
    this.savingsTransactionsService
      .postSavingsaccountsSavingsIdTransactionsTransactionId(
        this.accountId,
        transactionId,
        {},
        command,
      )
      .subscribe({
        next: () => this.afterCommand(),
        error: () => this.commandFailed(),
      });
  }

  private runCommand(command: string, payload: Record<string, unknown>): void {
    this.savingsService
      .postSavingsaccountsAccountId(this.accountId, payload as never, command)
      .subscribe({
        next: () => this.afterCommand(),
        error: () => this.commandFailed(),
      });
  }

  private afterCommand(): void {
    this.notifications.success(this.translate.instant('COMMON.SUCCESS'));
    this.loadAccountData();
  }

  private commandFailed(): void {
    this.notifications.error(this.translate.instant('COMMON.ERRORS.UNEXPECTED'));
  }

  onBlockCommand(command: 'block' | 'blockDebit' | 'blockCredit'): void {
    const config = {
      block: { codeName: 'SavingsAccountBlockReasons', key: 'BLOCK' },
      blockDebit: { codeName: 'DebitTransactionFreezeReasons', key: 'BLOCK_DEBIT' },
      blockCredit: { codeName: 'CreditTransactionFreezeReasons', key: 'BLOCK_CREDIT' },
    }[command];

    from(
      this.dialogService.open<SavingsBlockResult>(SavingsBlockDialogComponent, {
        data: {
          titleKey: `SAVINGS.${config.key}`,
          messageKey: `SAVINGS.CONFIRM_${config.key}`,
          codeName: config.codeName,
        } satisfies SavingsBlockDialogData,
      }),
    ).subscribe((result) => {
      if (!result) return;
      this.savingsService
        .postSavingsaccountsAccountId(
          this.accountId,
          { reasonForBlock: result.reasonForBlock } as never,
          command,
        )
        .subscribe({
          next: () => this.afterCommand(),
          error: () => this.commandFailed(),
        });
    });
  }

  onSavingsAction(command: string) {
    const rawAccount = this.account() as unknown as Record<string, unknown>;
    const type = resolveAccountActionType(rawAccount);
    this.router.navigate([`/products/${type}/${this.accountId}/action/${command}`]);
  }

  onBack() {
    const rawAccount = this.account() as unknown as Record<string, unknown>;
    const routePrefix = resolveAccountRoutePrefix(rawAccount);
    this.router.navigate([`/products/${routePrefix}`]);
  }
}
