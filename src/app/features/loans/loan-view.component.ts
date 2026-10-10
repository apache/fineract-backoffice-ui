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
  Signal,
  computed,
  effect,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { I18N, TranslatePipe } from '../../core/adapters';
import { Observable, from } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, JsonPipe, NgClass } from '@angular/common';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { EntityDatatablesComponent } from '../../shared/components/entity-datatables/entity-datatables.component';
import { LOAN_SCHEDULE_TYPE } from '../products/loan-schedule-type';
import { DialogService } from '../../core/services/dialog.service';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatArrayDate,
  formatDateToFineract,
} from '../../core/utils/date-formatter';
import { RequiresPermissionDirective } from '../../shared';
import {
  LoanChargebackData,
  LoanChargebackDialogComponent,
  LoanChargebackResult,
} from './loan-chargeback-dialog.component';
import {
  LoanUndoApprovalDialogComponent,
  LoanUndoApprovalResult,
} from './loan-undo-approval-dialog.component';
import { LoanDelinquencyTabComponent } from './tabs/loan-delinquency-tab.component';
import { LoanTermVariationsTabComponent } from './tabs/loan-term-variations-tab.component';
import { LoanOverdueChargesTabComponent } from './tabs/loan-overdue-charges-tab.component';
import { LoanOriginatorsTabComponent } from './tabs/loan-originators-tab.component';
import { LoanStandingInstructionsTabComponent } from './tabs/loan-standing-instructions-tab.component';
import {
  LoanDisburseToSavingsDialogComponent,
  LoanDisburseToSavingsResult,
} from './loan-disburse-to-savings-dialog.component';
import {
  LoanUnassignOfficerDialogComponent,
  LoanUnassignOfficerResult,
} from './loan-unassign-officer-dialog.component';
import {
  LoanApprovedAmountDialogComponent,
  LoanApprovedAmountResult,
} from './loan-approved-amount-dialog.component';
import {
  LoanAvailableDisbursementAmountDialogComponent,
  LoanAvailableDisbursementAmountResult,
} from './loan-available-disbursement-amount-dialog.component';
import { LoanAssetTransfersTabComponent } from './tabs/loan-asset-transfers-tab.component';
import { LoanOverdueCharge } from './tabs/loan-overdue-charge.model';
import { EntityNotesComponent } from '../../shared/components/entity-notes/entity-notes.component';
import { EntityDocumentsComponent } from '../../shared/components/entity-documents/entity-documents.component';
import { TransactionDetailDialogComponent } from './transaction-detail-dialog.component';
import { NotificationService } from '../../core/services/notification.service';
import { canTerminateLoanContract, isLoanContractTerminated } from './loan-contract-termination';
import { isRefundableLoanCharge } from './loan-charge-refund';
import { CdkTableModule } from '@angular/cdk/table';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular/standalone';
import {
  LoansService,
  LoanTransactionsService,
  GetLoansLoanIdResponse,
  GetLoansLoanIdRepaymentPeriod,
  GetLoansLoanIdTransactions,
  GetLoansLoanIdLoanChargeData,
  LoanBuyDownFeesService,
  BuyDownFeeAmortizationDetails,
  LoanCapitalizedIncomeService,
  CapitalizedIncomeDetails,
  LoanDisbursementDetailsService,
  LoanCollateralManagementService,
  GetLoansLoanIdDisbursementDetails,
  LoanCollateralResponseData,
} from '../../api';

/**
 * The tabs on this screen, named.
 *
 * They were positional strings — '0', '7' — which say nothing at the point of use and shift
 * meaning whenever a tab is inserted in the middle. The values are still strings because
 * `ion-segment` compares them as such.
 */
export const LOAN_TAB = {
  overview: 'overview',
  repaymentSchedule: 'repaymentSchedule',
  transactions: 'transactions',
  charges: 'charges',
  customFields: 'customFields',
  notes: 'notes',
  documents: 'documents',
  buyDownFees: 'buyDownFees',
  capitalizedIncome: 'capitalizedIncome',
  disbursementDetails: 'disbursementDetails',
  collateral: 'collateral',
  delinquency: 'delinquency',
  termVariations: 'termVariations',
  overdueCharges: 'overdueCharges',
  originators: 'originators',
  standingInstructions: 'standingInstructions',
  assetTransfers: 'assetTransfers',
} as const;

export type LoanTab = (typeof LOAN_TAB)[keyof typeof LOAN_TAB];

/**
 * Normalises whatever the disbursement-detail endpoint answers with into the `YYYY-MM-DD` an
 * `<ion-input type="date">` binds to.
 *
 * The generated model types `expectedDisbursementDate` as a `string` because that is what the
 * OpenAPI document declares, but the platform actually sends a `[year, month, day]` array.
 * Both shapes are handled rather than trusting either one.
 */
export function toEditableDate(value: unknown): string {
  if (Array.isArray(value)) {
    const iso = formatArrayDate(value);
    return iso === '-' ? '' : iso;
  }
  return typeof value === 'string' ? value.split('T', 1)[0] : '';
}

@Component({
  selector: 'app-loan-view',
  standalone: true,
  imports: [
    RouterModule,
    TranslatePipe,
    CdkTableModule,
    FormsModule,
    StatusBadgeComponent,
    EntityDatatablesComponent,
    EntityNotesComponent,
    EntityDocumentsComponent,
    DecimalPipe,
    NgClass,
    JsonPipe,
    IonIcon,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonChip,
    IonSegment,
    IonSegmentButton,
    IonPopover,
    IonList,
    TooltipDirective,
    RequiresPermissionDirective,
    LoanDelinquencyTabComponent,
    LoanTermVariationsTabComponent,
    LoanOverdueChargesTabComponent,
    LoanOriginatorsTabComponent,
    LoanStandingInstructionsTabComponent,
    LoanAssetTransfersTabComponent,
  ],
  template: `
    @if (loan()) {
      <div class="view-container">
        <!-- Header Actions Card -->
        <ion-card class="header-card">
          <ion-card-content class="header-content">
            <div class="loan-title-area">
              <div class="avatar-circle">
                <ion-icon name="cash-outline"></ion-icon>
              </div>
              <div class="title-details">
                <h2>{{ loan()?.loanProductName }}</h2>
                <div class="subtitle-row">
                  <span class="account-no">#{{ loan()?.accountNo }}</span>
                  <span class="divider">|</span>
                  <span class="client-name">Client: {{ loan()?.clientName }}</span>
                  <app-status-badge
                    [status]="loan()?.status"
                    class="status-badge"
                  ></app-status-badge>
                  @if (chargedOff()) {
                    <div>
                      <ion-chip
                        color="warning"
                        highlighted
                        data-testid="loan-charged-off-chip"
                        [appTooltip]="'HELP.CHARGE_OFF_DESC' | appTranslate"
                      >
                        {{ 'LOANS.ACTIONS.CHARGED_OFF' | appTranslate }}
                      </ion-chip>
                    </div>
                  }
                  @if (loan()?.loanScheduleType?.value) {
                    <div>
                      <ion-chip
                        [color]="isProgressiveLoan() ? 'secondary' : 'primary'"
                        highlighted
                        [appTooltip]="'HELP.LOAN_SCHEDULE_TYPE_DESC' | appTranslate"
                      >
                        {{ 'PRODUCTS.LOAN_SCHEDULE_TYPE' | appTranslate }}:
                        {{ loan()?.loanScheduleType?.value }}
                      </ion-chip>
                    </div>
                  }
                </div>
              </div>
            </div>
            <div class="actions-area">
              <!--
                Hidden rather than disabled, like the Approve and Disburse buttons beside it: the
                platform refuses a repayment unless the loan is active, fully paid or overpaid
                (error.msg.loan.must.be.active.fully.paid.or.overpaid), so on a loan awaiting
                approval the button only led to a filled-in form and a rejection on submit.
              -->
              @if (canAcceptRepayment) {
                <ion-button
                  color="primary"
                  data-testid="loan-repayment-action"
                  appRequiresPermission="REPAYMENT_LOAN"
                  (click)="onRepayment()"
                  [appTooltip]="'LOANS.REPAYMENT' | appTranslate"
                >
                  <ion-icon name="card-outline"></ion-icon>
                  {{ 'LOANS.REPAYMENT' | appTranslate }}
                </ion-button>
              }

              @if (isLoanPendingApproval) {
                <ion-button
                  color="secondary"
                  data-testid="loan-approve-action"
                  appRequiresPermission="APPROVE_LOAN"
                  (click)="onLoanAction('approve')"
                  [appTooltip]="'LOANS.APPROVE' | appTranslate"
                >
                  <ion-icon name="checkmark-circle-outline"></ion-icon>
                  {{ 'LOANS.APPROVE' | appTranslate }}
                </ion-button>
              }

              @if (isLoanApproved) {
                <!--
                  Carries a data-testid like its neighbours, because when the permission
                  directive refuses this control it replaces the accessible name with the
                  reason — so a role- or name-based locator stops finding exactly the button a
                  permission test needs to assert on.
                -->
                <ion-button
                  color="secondary"
                  data-testid="loan-disburse-action"
                  appRequiresPermission="DISBURSE_LOAN"
                  (click)="onDisburse()"
                  [appTooltip]="'LOANS.DISBURSE' | appTranslate"
                >
                  <ion-icon name="open-outline"></ion-icon>
                  {{ 'LOANS.DISBURSE' | appTranslate }}
                </ion-button>
              }

              <!-- Actions Dropdown Menu -->
              <ion-button color="primary" id="loanMenu-trigger">
                <ion-icon name="caret-down-outline"></ion-icon>
                {{ 'COMMON.ACTIONS' | appTranslate }}
              </ion-button>
              <ion-popover trigger="loanMenu-trigger" [dismissOnSelect]="true">
                <ng-template>
                  <ion-list>
                    <ion-item
                      button
                      appRequiresPermission="CREATE_LOANCHARGE"
                      (click)="onAddCharge()"
                    >
                      <ion-icon slot="start" name="add-outline"></ion-icon>
                      <ion-label>{{ 'LOANS.ACTIONS.ADD_CHARGE' | appTranslate }}</ion-label>
                    </ion-item>

                    @if (isLoanPendingApproval) {
                      <ion-item button appRequiresPermission="UPDATE_LOAN" (click)="onModifyLoan()">
                        <ion-icon slot="start" name="create-outline"></ion-icon>
                        <ion-label>{{
                          'LOANS.ACTIONS.MODIFY_APPLICATION' | appTranslate
                        }}</ion-label>
                      </ion-item>

                      <ion-item
                        button
                        appRequiresPermission="REJECT_LOAN"
                        (click)="onLoanAction('reject')"
                      >
                        <ion-icon slot="start" name="close-circle-outline"></ion-icon>
                        <ion-label>{{ 'LOANS.ACTIONS.REJECT' | appTranslate }}</ion-label>
                      </ion-item>

                      <ion-item
                        button
                        appRequiresPermission="WITHDRAW_LOAN"
                        (click)="onLoanAction('withdrawnByClient')"
                      >
                        <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                        <ion-label>{{
                          'LOANS.ACTIONS.WITHDRAWN_BY_CLIENT' | appTranslate
                        }}</ion-label>
                      </ion-item>

                      <ion-item button appRequiresPermission="DELETE_LOAN" (click)="onDeleteLoan()">
                        <ion-icon slot="start" name="trash-outline"></ion-icon>
                        <ion-label>{{ 'COMMON.DELETE' | appTranslate }}</ion-label>
                      </ion-item>
                    }

                    @if (isLoanApproved) {
                      <ion-item
                        button
                        data-testid="loan-disburse-to-savings-action"
                        (click)="onDisburseToSavings()"
                        appRequiresPermission="DISBURSETOSAVINGS_LOAN"
                      >
                        <ion-icon slot="start" name="wallet-outline"></ion-icon>
                        <ion-label>
                          {{ 'LOANS.ACTIONS.DISBURSE_TO_SAVINGS' | appTranslate }}
                        </ion-label>
                      </ion-item>

                      <ion-item
                        button
                        data-testid="loan-undo-approval-action"
                        (click)="onUndoApproval()"
                        appRequiresPermission="APPROVALUNDO_LOAN"
                      >
                        <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                        <ion-label>{{ 'LOANS.ACTIONS.UNDO_APPROVAL' | appTranslate }}</ion-label>
                      </ion-item>
                    }

                    @if (canReviseLoanAmounts) {
                      <ion-item
                        button
                        data-testid="loan-revise-approved-amount-action"
                        (click)="onReviseApprovedAmount()"
                        appRequiresPermission="UPDATE_APPROVED_AMOUNT_LOAN"
                      >
                        <ion-icon slot="start" name="create-outline"></ion-icon>
                        <ion-label>
                          {{ 'LOANS.ACTIONS.REVISE_APPROVED_AMOUNT' | appTranslate }}
                        </ion-label>
                      </ion-item>

                      <!--
                        ALL_FUNCTIONS, meaning superuser only, because the platform grants no
                        narrower code for this. It previously named
                        UPDATE_LOAN_AVAILABLE_DISBURSEMENT_AMOUNT, which is not in Fineract's
                        catalogue at all, so the control was permanently disabled for every
                        account except a superuser's -- and DOCS/RBAC.md is explicit that a gate
                        on a code that does not exist is worse than no gate, because no role can
                        ever satisfy it.

                        Measured by bisection: a role granted all 721 grantable codes is still
                        refused PUT /loans/{id}/available-disbursement-amount with 403, while the
                        superuser gets 400 on the same request. So there is no code to name here;
                        ALL_FUNCTIONS is the true requirement and the hint now tells an
                        administrator something they can act on.
                      -->
                      <ion-item
                        button
                        data-testid="loan-revise-available-disbursement-amount-action"
                        (click)="onReviseAvailableDisbursementAmount()"
                        appRequiresPermission="ALL_FUNCTIONS"
                      >
                        <ion-icon slot="start" name="create-outline"></ion-icon>
                        <ion-label>
                          {{ 'LOANS.ACTIONS.REVISE_AVAILABLE_DISBURSEMENT_AMOUNT' | appTranslate }}
                        </ion-label>
                      </ion-item>
                    }

                    <ion-item
                      button
                      appRequiresPermission="CREATE_COLLATERAL"
                      (click)="onAddCollateral()"
                    >
                      <ion-icon slot="start" name="shield-outline"></ion-icon>
                      <ion-label>{{ 'LOANS.ACTIONS.ADD_COLLATERAL' | appTranslate }}</ion-label>
                    </ion-item>

                    <ion-item
                      button
                      appRequiresPermission="UPDATELOANOFFICER_LOAN"
                      (click)="onAssignLoanOfficer()"
                    >
                      <ion-icon slot="start" name="person-add-outline"></ion-icon>
                      <ion-label>{{
                        'LOANS.ACTIONS.ASSIGN_LOAN_OFFICER' | appTranslate
                      }}</ion-label>
                    </ion-item>

                    @if (hasLoanOfficer()) {
                      <ion-item
                        button
                        data-testid="loan-unassign-officer-action"
                        (click)="onUnassignLoanOfficer()"
                        appRequiresPermission="REMOVELOANOFFICER_LOAN"
                      >
                        <ion-icon slot="start" name="person-remove-outline"></ion-icon>
                        <ion-label>
                          {{ 'LOANS.ACTIONS.UNASSIGN_LOAN_OFFICER' | appTranslate }}
                        </ion-label>
                      </ion-item>
                    }

                    @if (isLoanActive && isMultiDisburse()) {
                      <ion-item
                        button
                        data-testid="loan-undo-last-disbursal-action"
                        (click)="onUndoLastDisbursal()"
                        appRequiresPermission="DISBURSALLASTUNDO_LOAN"
                      >
                        <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                        <ion-label>
                          {{ 'LOANS.ACTIONS.UNDO_LAST_DISBURSAL' | appTranslate }}
                        </ion-label>
                      </ion-item>
                    }

                    @if (isLoanActive) {
                      <ion-item
                        button
                        appRequiresPermission="DISBURSALUNDO_LOAN"
                        (click)="onUndoDisbursal()"
                      >
                        <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                        <ion-label>{{ 'LOANS.ACTIONS.UNDO_DISBURSAL' | appTranslate }}</ion-label>
                      </ion-item>

                      <ion-item
                        button
                        appRequiresPermission="WAIVEINTERESTPORTION_LOAN"
                        (click)="onLoanTransactionAction('waiveinterest')"
                      >
                        <ion-icon slot="start" name="cash-outline"></ion-icon>
                        <ion-label>{{ 'LOANS.ACTIONS.WAIVE_INTEREST' | appTranslate }}</ion-label>
                      </ion-item>

                      <ion-item
                        button
                        appRequiresPermission="REPAYMENT_LOAN"
                        (click)="onLoanTransactionAction('prepayLoan')"
                      >
                        <ion-icon slot="start" name="play-forward-outline"></ion-icon>
                        <ion-label>{{ 'LOANS.ACTIONS.PREPAY_LOAN' | appTranslate }}</ion-label>
                      </ion-item>

                      <ion-item
                        button
                        appRequiresPermission="FORECLOSURE_LOAN"
                        (click)="onLoanTransactionAction('foreclosure')"
                      >
                        <ion-icon slot="start" name="flag-outline"></ion-icon>
                        <ion-label>{{ 'LOANS.ACTIONS.FORECLOSURE' | appTranslate }}</ion-label>
                      </ion-item>

                      <ion-item
                        button
                        appRequiresPermission="CLOSE_LOAN"
                        (click)="onLoanTransactionAction('close')"
                      >
                        <ion-icon slot="start" name="lock-closed-outline"></ion-icon>
                        <ion-label>{{ 'LOANS.ACTIONS.CLOSE' | appTranslate }}</ion-label>
                      </ion-item>

                      <ion-item
                        button
                        data-testid="loan-close-as-rescheduled-action"
                        appRequiresPermission="CLOSEASRESCHEDULED_LOAN"
                        (click)="onLoanTransactionAction('close-rescheduled')"
                      >
                        <ion-icon slot="start" name="calendar-outline"></ion-icon>
                        <ion-label>
                          {{ 'LOANS.ACTIONS.CLOSE_AS_RESCHEDULED' | appTranslate }}
                        </ion-label>
                      </ion-item>

                      @if (canTerminateContract()) {
                        <ion-item
                          button
                          data-testid="loan-contract-termination-action"
                          appRequiresPermission="CONTRACT_TERMINATION_LOAN"
                          (click)="onLoanTransactionAction('contractTermination')"
                        >
                          <ion-icon slot="start" name="lock-closed-outline"></ion-icon>
                          <ion-label>{{
                            'LOANS.ACTIONS.CONTRACT_TERMINATION' | appTranslate
                          }}</ion-label>
                        </ion-item>
                      }

                      @if (isContractTerminated()) {
                        <ion-item
                          button
                          data-testid="loan-undo-contract-termination-action"
                          appRequiresPermission="CONTRACT_TERMINATION_UNDO_LOAN"
                          (click)="onLoanTransactionAction('undoContractTermination')"
                        >
                          <ion-icon slot="start" name="lock-open-outline"></ion-icon>
                          <ion-label>{{
                            'LOANS.ACTIONS.UNDO_CONTRACT_TERMINATION' | appTranslate
                          }}</ion-label>
                        </ion-item>
                      }

                      <ion-item
                        button
                        class="warn-item"
                        appRequiresPermission="WRITEOFF_LOAN"
                        (click)="onLoanTransactionAction('writeoff')"
                      >
                        <ion-icon slot="start" color="danger" name="trash-bin-outline"></ion-icon>
                        <ion-label>{{ 'LOANS.ACTIONS.WRITE_OFF' | appTranslate }}</ion-label>
                      </ion-item>

                      @if (!chargedOff()) {
                        <ion-item
                          button
                          class="warn-item"
                          data-testid="loan-charge-off-action"
                          appRequiresPermission="CHARGEOFF_LOAN"
                          (click)="onLoanTransactionAction('charge-off')"
                        >
                          <ion-icon slot="start" color="warning" name="alert-circle-outline">
                          </ion-icon>
                          <ion-label>{{ 'LOANS.ACTIONS.CHARGE_OFF' | appTranslate }}</ion-label>
                        </ion-item>
                      }

                      <!-- Refunds and credits, all available while the loan is active. -->
                      <ion-item
                        button
                        data-testid="loan-merchant-issued-refund-action"
                        appRequiresPermission="MERCHANTISSUEDREFUND_LOAN"
                        (click)="onLoanTransactionAction('merchantIssuedRefund')"
                      >
                        <ion-icon slot="start" name="storefront-outline"></ion-icon>
                        <ion-label>{{
                          'LOANS.ACTIONS.MERCHANT_ISSUED_REFUND' | appTranslate
                        }}</ion-label>
                      </ion-item>

                      <ion-item
                        button
                        data-testid="loan-payout-refund-action"
                        appRequiresPermission="PAYOUTREFUND_LOAN"
                        (click)="onLoanTransactionAction('payoutRefund')"
                      >
                        <ion-icon slot="start" name="return-down-back-outline"></ion-icon>
                        <ion-label>{{ 'LOANS.ACTIONS.PAYOUT_REFUND' | appTranslate }}</ion-label>
                      </ion-item>

                      <!-- Only a loan paid ahead of schedule has an advance balance to hand back. -->
                      @if (hasAdvanceBalance()) {
                        <ion-item
                          button
                          data-testid="loan-refund-by-cash-action"
                          appRequiresPermission="REFUNDBYCASH_LOAN"
                          (click)="onLoanTransactionAction('refundByCash')"
                        >
                          <ion-icon slot="start" name="cash-outline"></ion-icon>
                          <ion-label>{{ 'LOANS.ACTIONS.REFUND_BY_CASH' | appTranslate }}</ion-label>
                        </ion-item>
                      }

                      <ion-item
                        button
                        data-testid="loan-goodwill-credit-action"
                        appRequiresPermission="GOODWILLCREDIT_LOAN"
                        (click)="onLoanTransactionAction('goodwillCredit')"
                      >
                        <ion-icon slot="start" name="gift-outline"></ion-icon>
                        <ion-label>{{ 'LOANS.ACTIONS.GOODWILL_CREDIT' | appTranslate }}</ion-label>
                      </ion-item>

                      <!-- Progressive-engine servicing. Fineract rejects these outright on a
                           cumulative loan, so they are not offered there. -->
                      @if (canTakeDownPayment()) {
                        <ion-item
                          button
                          data-testid="loan-down-payment-action"
                          appRequiresPermission="DOWNPAYMENT_LOAN"
                          (click)="onLoanTransactionAction('downPayment')"
                        >
                          <ion-icon slot="start" name="wallet-outline"></ion-icon>
                          <ion-label>{{ 'LOANS.ACTIONS.DOWN_PAYMENT' | appTranslate }}</ion-label>
                        </ion-item>
                      }

                      @if (isProgressiveLoan()) {
                        <ion-item
                          button
                          data-testid="loan-interest-payment-waiver-action"
                          appRequiresPermission="INTERESTPAYMENTWAIVER_LOAN"
                          (click)="onLoanTransactionAction('interestPaymentWaiver')"
                        >
                          <ion-icon slot="start" name="remove-circle-outline"></ion-icon>
                          <ion-label>{{
                            'LOANS.ACTIONS.INTEREST_PAYMENT_WAIVER' | appTranslate
                          }}</ion-label>
                        </ion-item>

                        <ion-item
                          button
                          data-testid="loan-re-age-action"
                          appRequiresPermission="REAGE_LOAN"
                          (click)="onLoanTransactionAction('reAge')"
                        >
                          <ion-icon slot="start" name="calendar-number-outline"></ion-icon>
                          <ion-label>{{ 'LOANS.ACTIONS.RE_AGE' | appTranslate }}</ion-label>
                        </ion-item>

                        <ion-item
                          button
                          data-testid="loan-re-amortize-action"
                          appRequiresPermission="REAMORTIZE_LOAN"
                          (click)="onLoanTransactionAction('reAmortize')"
                        >
                          <ion-icon slot="start" name="repeat-outline"></ion-icon>
                          <ion-label>{{ 'LOANS.ACTIONS.RE_AMORTIZE' | appTranslate }}</ion-label>
                        </ion-item>
                      }
                    }

                    <!-- Only an overpaid loan has a credit balance to give back. -->
                    @if (isOverpaid()) {
                      <ion-item
                        button
                        data-testid="loan-credit-balance-refund-action"
                        appRequiresPermission="CREDITBALANCEREFUND_LOAN"
                        (click)="onLoanTransactionAction('creditBalanceRefund')"
                      >
                        <ion-icon slot="start" name="cash-outline"></ion-icon>
                        <ion-label>{{
                          'LOANS.ACTIONS.CREDIT_BALANCE_REFUND' | appTranslate
                        }}</ion-label>
                      </ion-item>
                    }

                    @if (canRefundCharge()) {
                      <ion-item
                        button
                        data-testid="loan-charge-refund-action"
                        appRequiresPermission="CHARGEREFUND_LOAN"
                        (click)="onLoanTransactionAction('chargeRefund')"
                      >
                        <ion-icon slot="start" name="receipt-outline"></ion-icon>
                        <ion-label>{{ 'LOANS.ACTIONS.CHARGE_REFUND' | appTranslate }}</ion-label>
                      </ion-item>
                    }

                    <!-- Both require the loan to have been written off. -->
                    @if (isWrittenOff()) {
                      <ion-item
                        button
                        data-testid="loan-recovery-payment-action"
                        appRequiresPermission="RECOVERYPAYMENT_LOAN"
                        (click)="onLoanTransactionAction('recoverypayment')"
                      >
                        <ion-icon slot="start" name="trending-up-outline"></ion-icon>
                        <ion-label>{{ 'LOANS.ACTIONS.RECOVERY_PAYMENT' | appTranslate }}</ion-label>
                      </ion-item>

                      <ion-item
                        button
                        data-testid="loan-undo-write-off-action"
                        appRequiresPermission="UNDOWRITEOFF_LOAN"
                        (click)="onLoanTransactionAction('undowriteoff')"
                      >
                        <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                        <ion-label>{{ 'LOANS.ACTIONS.UNDO_WRITE_OFF' | appTranslate }}</ion-label>
                      </ion-item>
                    }

                    @if (chargedOff()) {
                      <ion-item
                        button
                        data-testid="loan-undo-charge-off-action"
                        appRequiresPermission="UNDOCHARGEOFF_LOAN"
                        (click)="onUndoChargeOff()"
                      >
                        <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                        <ion-label>{{ 'LOANS.ACTIONS.UNDO_CHARGE_OFF' | appTranslate }}</ion-label>
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

        <!-- Tabs Section -->
        <ion-segment [value]="activeTab()" (ionChange)="activeTab.set($any($event).detail.value)">
          <ion-segment-button [value]="TAB.overview">
            <ion-label>{{ 'LOANS.OVERVIEW' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.repaymentSchedule">
            <ion-label>{{ 'LOANS.REPAYMENT_SCHEDULE' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.transactions">
            <ion-label>{{ 'LOANS.TRANSACTIONS' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.charges">
            <ion-label>{{ 'LOANS.CHARGES' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.customFields">
            <ion-label>{{ 'SYSTEM.CUSTOM_FIELDS' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.notes">
            <ion-label>{{ 'LOANS.NOTES' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.documents">
            <ion-label>{{ 'LOANS.DOCUMENTS' | appTranslate }}</ion-label>
          </ion-segment-button>
          @if (showBuyDownFees()) {
            <ion-segment-button [value]="TAB.buyDownFees">
              <ion-label>{{ 'LOANS.BUY_DOWN_FEES' | appTranslate }}</ion-label>
            </ion-segment-button>
          }
          @if (showCapitalizedIncome()) {
            <ion-segment-button [value]="TAB.capitalizedIncome">
              <ion-label>{{ 'LOANS.CAPITALIZED_INCOME' | appTranslate }}</ion-label>
            </ion-segment-button>
          }
          <ion-segment-button [value]="TAB.disbursementDetails">
            <ion-label>{{ 'LOANS.DISBURSEMENT_DETAILS' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.collateral">
            <ion-label>{{ 'LOANS.COLLATERAL_MANAGEMENT' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.delinquency" data-testid="loan-tab-delinquency">
            <ion-label>{{ 'LOANS.DELINQUENCY' | appTranslate }}</ion-label>
          </ion-segment-button>
          @if (hasTermVariations()) {
            <ion-segment-button [value]="TAB.termVariations" data-testid="loan-tab-term-variations">
              <ion-label>{{ 'LOANS.TERM_VARIATIONS' | appTranslate }}</ion-label>
            </ion-segment-button>
          }
          @if (hasOverdueCharges()) {
            <ion-segment-button [value]="TAB.overdueCharges" data-testid="loan-tab-overdue-charges">
              <ion-label>{{ 'LOANS.OVERDUE_CHARGES' | appTranslate }}</ion-label>
            </ion-segment-button>
          }
          @if (hasOriginators()) {
            <ion-segment-button [value]="TAB.originators" data-testid="loan-tab-originators">
              <ion-label>{{ 'LOANS.ORIGINATORS' | appTranslate }}</ion-label>
            </ion-segment-button>
          }
          <ion-segment-button
            [value]="TAB.standingInstructions"
            data-testid="loan-tab-standing-instructions"
          >
            <ion-label>{{ 'LOANS.STANDING_INSTRUCTIONS' | appTranslate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button [value]="TAB.assetTransfers" data-testid="loan-tab-asset-transfers">
            <ion-label>{{ 'LOANS.ASSET_TRANSFERS' | appTranslate }}</ion-label>
          </ion-segment-button>
        </ion-segment>

        @if (activeTab() === TAB.overview) {
          <div class="tab-content">
            <div class="info-grid">
              <ion-card class="info-card">
                <ion-card-header>
                  <ion-card-title>
                    <ion-icon name="information-circle-outline"></ion-icon>
                    {{ 'LOANS.LOAN_TERMS' | appTranslate }}
                  </ion-card-title>
                </ion-card-header>
                <ion-card-content class="details-list">
                  <div class="detail-item">
                    <span class="label">{{ 'LOANS.PRINCIPAL_AMOUNT' | appTranslate }}</span>
                    <span class="value">
                      {{ loan()?.currency?.displaySymbol }}
                      {{ loan()?.principal | number: '1.2-2' }}
                    </span>
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'LOANS.ANNUAL_INTEREST_RATE' | appTranslate }}</span>
                    <span class="value">{{ loan()?.annualInterestRate }}%</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'LOANS.REPAYMENTS' | appTranslate }}</span>
                    <span class="value">
                      {{ loan()?.numberOfRepayments }} {{ 'COMMON.EVERY' | appTranslate }}
                      {{ loan()?.repaymentEvery }}
                      {{ repaymentFrequencyValue }}
                    </span>
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'LOANS.LOAN_OFFICER' | appTranslate }}</span>
                    <span class="value">{{ loan()?.loanOfficerName || '-' }}</span>
                  </div>
                </ion-card-content>
              </ion-card>

              <ion-card class="info-card">
                <ion-card-header>
                  <ion-card-title>
                    <ion-icon name="pulse-outline"></ion-icon>
                    {{ 'LOANS.TIMELINE_STATUS' | appTranslate }}
                  </ion-card-title>
                </ion-card-header>
                <ion-card-content class="details-list">
                  <div class="detail-item">
                    <span class="label">{{ 'LOANS.SUBMITTED_DATE' | appTranslate }}</span>
                    <span class="value">{{ formattedSubmittedDate }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'LOANS.EXPECTED_DISBURSEMENT' | appTranslate }}</span>
                    <span class="value">{{ formattedExpectedDisbursementDate }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'LOANS.TOTAL_DISBURSED' | appTranslate }}</span>
                    <span class="value">
                      {{ loan()?.currency?.displaySymbol }}
                      {{ loan()?.summary?.principalDisbursed || 0 | number: '1.2-2' }}
                    </span>
                  </div>
                  <div class="detail-item">
                    <span class="label">{{ 'LOANS.TOTAL_OUTSTANDING' | appTranslate }}</span>
                    <span class="value">
                      {{ loan()?.currency?.displaySymbol }}
                      {{ loan()?.summary?.totalOutstanding || 0 | number: '1.2-2' }}
                    </span>
                  </div>
                </ion-card-content>
              </ion-card>
            </div>
          </div>
        }
        @if (activeTab() === TAB.repaymentSchedule) {
          <div class="tab-content">
            <ion-card class="table-card" style="overflow-x: auto;">
              <ion-card-content>
                @if (periods().length > 0) {
                  <table cdk-table [dataSource]="periods()" class="full-width-table">
                    <!-- Category Headers -->
                    <ng-container cdkColumnDef="empty-header">
                      <th cdk-header-cell *cdkHeaderCellDef [attr.colspan]="5"></th>
                    </ng-container>

                    <ng-container cdkColumnDef="balance-header">
                      <th
                        cdk-header-cell
                        *cdkHeaderCellDef
                        [attr.colspan]="2"
                        style="text-align: center; font-weight: 600; border-bottom: 2px solid #e0e0e0;"
                      >
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.BALANCE' | appTranslate }}
                      </th>
                    </ng-container>

                    <ng-container cdkColumnDef="cost-header">
                      <th
                        cdk-header-cell
                        *cdkHeaderCellDef
                        [attr.colspan]="3"
                        style="text-align: center; font-weight: 600; border-bottom: 2px solid #e0e0e0;"
                      >
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.COST' | appTranslate }}
                      </th>
                    </ng-container>

                    <ng-container cdkColumnDef="totals-header">
                      <th
                        cdk-header-cell
                        *cdkHeaderCellDef
                        [attr.colspan]="5"
                        style="text-align: center; font-weight: 600; border-bottom: 2px solid #e0e0e0;"
                      >
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.TOTALS' | appTranslate }}
                      </th>
                    </ng-container>

                    <!-- Column Containers -->
                    <ng-container cdkColumnDef="period">
                      <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.HASH' | appTranslate }}</th>
                      <td cdk-cell *cdkCellDef="let p">{{ p.period || '' }}</td>
                      <td cdk-footer-cell *cdkFooterCellDef>
                        <strong>{{ 'COMMON.TOTAL' | appTranslate }}</strong>
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="days">
                      <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.DAYS' | appTranslate }}</th>
                      <td cdk-cell *cdkCellDef="let p">{{ p.daysInPeriod || '' }}</td>
                      <td cdk-footer-cell *cdkFooterCellDef></td>
                    </ng-container>

                    <ng-container cdkColumnDef="dueDate">
                      <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.DATE' | appTranslate }}</th>
                      <td cdk-cell *cdkCellDef="let p">{{ formatPeriodDate(p.dueDate) }}</td>
                      <td cdk-footer-cell *cdkFooterCellDef></td>
                    </ng-container>

                    <ng-container cdkColumnDef="paidDate">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.PAID_DATE' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let p">
                        {{ formatPeriodDate(p.obligationsMetOnDate) }}
                      </td>
                      <td cdk-footer-cell *cdkFooterCellDef></td>
                    </ng-container>

                    <ng-container cdkColumnDef="check">
                      <th cdk-header-cell *cdkHeaderCellDef></th>
                      <td cdk-cell *cdkCellDef="let p">
                        @if (p.obligationsMetOnDate) {
                          <ion-icon style="color: #2ecc71" name="checkmark-outline"></ion-icon>
                        }
                      </td>
                      <td cdk-footer-cell *cdkFooterCellDef></td>
                    </ng-container>

                    <ng-container cdkColumnDef="balance">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.BALANCE_OF_LOAN' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let p">
                        {{
                          p.principalLoanBalanceOutstanding !== undefined &&
                          p.principalLoanBalanceOutstanding !== null
                            ? (p.principalLoanBalanceOutstanding | number: '1.2-2')
                            : ''
                        }}
                      </td>
                      <td cdk-footer-cell *cdkFooterCellDef></td>
                    </ng-container>

                    <ng-container cdkColumnDef="principal">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.PRINCIPAL_DUE' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let p">
                        {{
                          p.principalDue !== undefined && p.principalDue !== null && p.period
                            ? (p.principalDue | number: '1.2-2')
                            : ''
                        }}
                      </td>
                      <td cdk-footer-cell *cdkFooterCellDef>
                        <strong
                          >{{ loan()?.currency?.displaySymbol
                          }}{{ totalPrincipalDue | number: '1.2-2' }}</strong
                        >
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="interest">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.INTEREST' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let p">
                        {{
                          p.interestDue !== undefined && p.interestDue !== null
                            ? (p.interestDue | number: '1.2-2')
                            : ''
                        }}
                      </td>
                      <td cdk-footer-cell *cdkFooterCellDef>
                        <strong
                          >{{ loan()?.currency?.displaySymbol
                          }}{{ totalInterestDue | number: '1.2-2' }}</strong
                        >
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="fees">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.FEES' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let p">
                        {{
                          p.feeChargesDue !== undefined && p.feeChargesDue !== null
                            ? (p.feeChargesDue | number: '1.2-2')
                            : ''
                        }}
                      </td>
                      <td cdk-footer-cell *cdkFooterCellDef>
                        <strong
                          >{{ loan()?.currency?.displaySymbol
                          }}{{ totalFeesDue | number: '1.2-2' }}</strong
                        >
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="penalties">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.PENALTIES' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let p">
                        {{
                          p.penaltyChargesDue !== undefined &&
                          p.penaltyChargesDue !== null &&
                          p.period
                            ? (p.penaltyChargesDue | number: '1.2-2')
                            : ''
                        }}
                      </td>
                      <td cdk-footer-cell *cdkFooterCellDef>
                        <strong
                          >{{ loan()?.currency?.displaySymbol
                          }}{{ totalPenaltiesDue | number: '1.2-2' }}</strong
                        >
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="due">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.DUE' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let p">
                        {{
                          p.totalDueForPeriod !== undefined && p.totalDueForPeriod !== null
                            ? (p.totalDueForPeriod | number: '1.2-2')
                            : ''
                        }}
                      </td>
                      <td cdk-footer-cell *cdkFooterCellDef>
                        <strong
                          >{{ loan()?.currency?.displaySymbol
                          }}{{ totalDue | number: '1.2-2' }}</strong
                        >
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="paid">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.PAID' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let p">
                        {{
                          p.totalPaidForPeriod !== undefined && p.totalPaidForPeriod !== null
                            ? (p.totalPaidForPeriod | number: '1.2-2')
                            : ''
                        }}
                      </td>
                      <td cdk-footer-cell *cdkFooterCellDef>
                        <strong
                          >{{ loan()?.currency?.displaySymbol
                          }}{{ totalPaid | number: '1.2-2' }}</strong
                        >
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="inAdvance">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.IN_ADVANCE' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let p">
                        {{
                          p.totalPaidInAdvanceForPeriod !== undefined &&
                          p.totalPaidInAdvanceForPeriod !== null &&
                          p.period
                            ? (p.totalPaidInAdvanceForPeriod | number: '1.2-2')
                            : ''
                        }}
                      </td>
                      <td cdk-footer-cell *cdkFooterCellDef>
                        <strong
                          >{{ loan()?.currency?.displaySymbol
                          }}{{ totalPaidInAdvance | number: '1.2-2' }}</strong
                        >
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="late">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.LATE' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let p">
                        {{
                          p.totalPaidLateForPeriod !== undefined &&
                          p.totalPaidLateForPeriod !== null &&
                          p.period
                            ? (p.totalPaidLateForPeriod | number: '1.2-2')
                            : ''
                        }}
                      </td>
                      <td cdk-footer-cell *cdkFooterCellDef>
                        <strong
                          >{{ loan()?.currency?.displaySymbol
                          }}{{ totalPaidLate | number: '1.2-2' }}</strong
                        >
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="outstanding">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.OUTSTANDING' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let p">
                        {{
                          p.totalOutstandingForPeriod !== undefined &&
                          p.totalOutstandingForPeriod !== null &&
                          p.period
                            ? (p.totalOutstandingForPeriod | number: '1.2-2')
                            : ''
                        }}
                      </td>
                      <td cdk-footer-cell *cdkFooterCellDef>
                        <strong
                          >{{ loan()?.currency?.displaySymbol
                          }}{{ totalOutstanding | number: '1.2-2' }}</strong
                        >
                      </td>
                    </ng-container>

                    <tr cdk-header-row *cdkHeaderRowDef="categoryHeaderColumns"></tr>
                    <tr cdk-header-row *cdkHeaderRowDef="scheduleColumns"></tr>
                    <tr cdk-row *cdkRowDef="let row; columns: scheduleColumns"></tr>
                    <tr cdk-footer-row *cdkFooterRowDef="scheduleColumns"></tr>
                  </table>
                } @else {
                  <div class="empty-state">
                    <ion-icon name="calendar-outline"></ion-icon>
                    <p>{{ 'LOANS.NO_REPAYMENT_SCHEDULE' | appTranslate }}</p>
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
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'COMMON.TRANSACTION_DATE' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let tx">{{ formatPeriodDate(tx.date) }}</td>
                    </ng-container>

                    <ng-container cdkColumnDef="type">
                      <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.TYPE' | appTranslate }}</th>
                      <td cdk-cell *cdkCellDef="let tx">{{ tx.type?.value }}</td>
                    </ng-container>

                    <ng-container cdkColumnDef="amount">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'COMMON.AMOUNT' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let tx">
                        <span
                          [ngClass]="{
                            'debit-amount': isDebitTransaction(tx) && !tx.manuallyReversed,
                            'credit-amount': isCreditTransaction(tx) && !tx.manuallyReversed,
                            'reversed-amount': tx.manuallyReversed,
                          }"
                        >
                          {{ isDebitTransaction(tx) ? '-' : isCreditTransaction(tx) ? '+' : '' }}
                          {{ loan()?.currency?.displaySymbol }}{{ tx.amount | number: '1.2-2' }}
                        </span>
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="txActions">
                      <th cdk-header-cell *cdkHeaderCellDef></th>
                      <td cdk-cell *cdkCellDef="let tx">
                        <ion-button
                          fill="clear"
                          (click)="onViewTransaction(tx)"
                          [attr.aria-label]="'COMMON.VIEW' | appTranslate"
                          [appTooltip]="'COMMON.VIEW' | appTranslate"
                        >
                          <ion-icon name="eye-outline"></ion-icon>
                        </ion-button>
                        @if (isChargebackEligible(tx)) {
                          <ion-button
                            fill="clear"
                            color="danger"
                            appRequiresPermission="CHARGEBACK_LOAN"
                            [attr.data-testid]="'loan-chargeback-' + tx.id"
                            (click)="onChargeback(tx)"
                            [attr.aria-label]="'LOANS.ACTIONS.CHARGEBACK' | appTranslate"
                            [appTooltip]="'LOANS.ACTIONS.CHARGEBACK' | appTranslate"
                          >
                            <ion-icon name="arrow-undo-outline"></ion-icon>
                          </ion-button>
                        }
                      </td>
                    </ng-container>

                    <tr cdk-header-row *cdkHeaderRowDef="transactionColumns"></tr>
                    <tr cdk-row *cdkRowDef="let row; columns: transactionColumns"></tr>
                  </table>
                } @else {
                  <div class="empty-state">
                    <ion-icon name="receipt-outline"></ion-icon>
                    <p>{{ 'LOANS.NO_TRANSACTIONS' | appTranslate }}</p>
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
                      <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.NAME' | appTranslate }}</th>
                      <td cdk-cell *cdkCellDef="let c">{{ c.name }}</td>
                    </ng-container>

                    <ng-container cdkColumnDef="amount">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'COMMON.AMOUNT' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let c">
                        {{ loan()?.currency?.displaySymbol }} {{ c.amount | number: '1.2-2' }}
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="due">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.DUE' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let c">
                        {{ loan()?.currency?.displaySymbol }} {{ c.amountDue | number: '1.2-2' }}
                      </td>
                    </ng-container>

                    <ng-container cdkColumnDef="outstanding">
                      <th cdk-header-cell *cdkHeaderCellDef>
                        {{ 'LOANS.REPAYMENT_SCHEDULE_HEADERS.OUTSTANDING' | appTranslate }}
                      </th>
                      <td cdk-cell *cdkCellDef="let c">
                        {{ loan()?.currency?.displaySymbol }}
                        {{ c.amountOutstanding | number: '1.2-2' }}
                      </td>
                    </ng-container>

                    <tr cdk-header-row *cdkHeaderRowDef="chargeColumns"></tr>
                    <tr cdk-row *cdkRowDef="let row; columns: chargeColumns"></tr>
                  </table>
                } @else {
                  <div class="empty-state">
                    <ion-icon name="cash-outline"></ion-icon>
                    <p>{{ 'LOANS.CHARGES' | appTranslate }}</p>
                  </div>
                }
              </ion-card-content>
            </ion-card>
          </div>
        }
        @if (activeTab() === TAB.customFields) {
          <div class="tab-content">
            <app-entity-datatables
              apptableName="m_loan"
              [entityId]="loanId()"
            ></app-entity-datatables>
          </div>
        }
        @if (activeTab() === TAB.notes) {
          <div class="tab-content">
            <app-entity-notes resourceType="loans" [resourceId]="loanId()"></app-entity-notes>
          </div>
        }
        @if (activeTab() === TAB.documents) {
          <div class="tab-content">
            <app-entity-documents entityType="loans" [entityId]="loanId()"></app-entity-documents>
          </div>
        }
        @if (activeTab() === TAB.buyDownFees && showBuyDownFees()) {
          <div class="tab-content">
            @if (buyDownFees().length === 0) {
              <p class="empty-state">{{ 'COMMON.NO_DATA' | appTranslate }}</p>
            } @else {
              <table cdk-table [dataSource]="buyDownFees()" class="full-width-table">
                <ng-container cdkColumnDef="transactionId">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'LOANS.TRANSACTION_ID' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.transactionId }}</td>
                </ng-container>
                <ng-container cdkColumnDef="buyDownFeeAmount">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'LOANS.BUY_DOWN_FEE_AMOUNT' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.buyDownFeeAmount | number }}</td>
                </ng-container>
                <ng-container cdkColumnDef="amortizedAmount">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'LOANS.AMORTIZED_AMOUNT' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.amortizedAmount | number }}</td>
                </ng-container>
                <ng-container cdkColumnDef="notYetAmortizedAmount">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'LOANS.NOT_YET_AMORTIZED_AMOUNT' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.notYetAmortizedAmount | number }}</td>
                </ng-container>
                <tr cdk-header-row *cdkHeaderRowDef="buyDownFeeColumns"></tr>
                <tr cdk-row *cdkRowDef="let row; columns: buyDownFeeColumns"></tr>
              </table>
            }
          </div>
        }
        @if (activeTab() === TAB.capitalizedIncome && showCapitalizedIncome()) {
          <div class="tab-content">
            @if (capitalizedIncomes().length === 0) {
              <p class="empty-state">{{ 'COMMON.NO_DATA' | appTranslate }}</p>
            } @else {
              <table cdk-table [dataSource]="capitalizedIncomes()" class="full-width-table">
                <ng-container cdkColumnDef="amount">
                  <th cdk-header-cell *cdkHeaderCellDef>{{ 'COMMON.AMOUNT' | appTranslate }}</th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.amount | number }}</td>
                </ng-container>
                <ng-container cdkColumnDef="amortizedAmount">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'LOANS.AMORTIZED_AMOUNT' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.amortizedAmount | number }}</td>
                </ng-container>
                <ng-container cdkColumnDef="unrecognizedAmount">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'LOANS.UNRECOGNIZED_AMOUNT' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.unrecognizedAmount | number }}</td>
                </ng-container>
                <ng-container cdkColumnDef="amountAdjustment">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'LOANS.AMOUNT_ADJUSTMENT' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.amountAdjustment | number }}</td>
                </ng-container>
                <ng-container cdkColumnDef="chargedOffAmount">
                  <th cdk-header-cell *cdkHeaderCellDef>
                    {{ 'LOANS.CHARGED_OFF_AMOUNT' | appTranslate }}
                  </th>
                  <td cdk-cell *cdkCellDef="let row">{{ row.chargedOffAmount | number }}</td>
                </ng-container>
                <tr cdk-header-row *cdkHeaderRowDef="capitalizedIncomeColumns"></tr>
                <tr cdk-row *cdkRowDef="let row; columns: capitalizedIncomeColumns"></tr>
              </table>
            }
          </div>
        }
        @if (activeTab() === TAB.disbursementDetails) {
          <div class="tab-content">
            <ion-card class="info-card" style="margin-bottom: 24px;">
              <ion-card-header>
                <ion-card-title>
                  <ion-icon name="open-outline"></ion-icon>
                  {{ 'LOANS.DISBURSEMENT_DETAILS' | appTranslate }}
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <div
                  class="form-row"
                  style="display: flex; gap: 12px; align-items: center; margin-bottom: 16px;"
                >
                  <ion-item fill="outline" style="flex: 1;">
                    <ion-label position="stacked">{{
                      'LOANS.DISBURSEMENT_ID' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'LOANS.DISBURSEMENT_ID' | appTranslate"
                      type="number"
                      [(ngModel)]="editDisbId"
                    ></ion-input>
                  </ion-item>
                  <ion-button color="primary" (click)="loadDisbursementDetail()">
                    <ion-icon name="search-outline"></ion-icon>
                    {{ 'LOANS.LOAD_DISBURSEMENT' | appTranslate }}
                  </ion-button>
                </div>

                @if (disbursementDetail()) {
                  <pre class="json-block">{{ disbursementDetail() | json }}</pre>

                  <div
                    class="edit-form"
                    style="margin-top: 16px; display: flex; flex-direction: column; gap: 12px;"
                  >
                    <ion-item fill="outline">
                      <ion-label position="stacked">{{
                        'LOANS.EXPECTED_DISBURSEMENT' | appTranslate
                      }}</ion-label>
                      <!--
                        A plain text box here rendered the raw year/month/day array the platform
                        answers with, and let a user type anything at all into a field the
                        command then parses strictly.
                      -->
                      <ion-input
                        [attr.aria-label]="'LOANS.EXPECTED_DISBURSEMENT' | appTranslate"
                        type="date"
                        data-testid="disbursement-expected-date"
                        [(ngModel)]="disbursementEditForm.expectedDisbursementDate"
                      ></ion-input>
                    </ion-item>
                    <ion-item fill="outline">
                      <ion-label position="stacked">{{
                        'LOANS.PRINCIPAL_AMOUNT' | appTranslate
                      }}</ion-label>
                      <ion-input
                        [attr.aria-label]="'LOANS.PRINCIPAL_AMOUNT' | appTranslate"
                        type="number"
                        data-testid="disbursement-principal"
                        [(ngModel)]="disbursementEditForm.principal"
                      ></ion-input>
                    </ion-item>
                    <div>
                      <ion-button color="secondary" (click)="saveDisbursementDetail()">
                        <ion-icon name="save-outline"></ion-icon>
                        {{ 'COMMON.SAVE' | appTranslate }}
                      </ion-button>
                    </div>
                  </div>
                }
              </ion-card-content>
            </ion-card>
          </div>
        }
        @if (activeTab() === TAB.collateral) {
          <div class="tab-content">
            <ion-card class="info-card" style="margin-bottom: 24px;">
              <ion-card-header>
                <ion-card-title>
                  <ion-icon name="shield-outline"></ion-icon>
                  {{ 'LOANS.COLLATERAL_MANAGEMENT' | appTranslate }}
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <!-- Load collateral -->
                <div
                  class="form-row"
                  style="display: flex; gap: 12px; align-items: center; margin-bottom: 16px;"
                >
                  <ion-item fill="outline" style="flex: 1;">
                    <ion-label position="stacked">{{
                      'LOANS.COLLATERAL_ID' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'LOANS.COLLATERAL_ID' | appTranslate"
                      type="number"
                      [(ngModel)]="collateralDetailId"
                    ></ion-input>
                  </ion-item>
                  <ion-button color="primary" (click)="loadCollateralDetail()">
                    <ion-icon name="search-outline"></ion-icon>
                    {{ 'LOANS.LOAD_COLLATERAL' | appTranslate }}
                  </ion-button>
                </div>

                @if (collateralDetail()) {
                  <pre class="json-block">{{ collateralDetail() | json }}</pre>
                }

                <!-- Delete collateral -->
                <div
                  class="form-row"
                  style="display: flex; gap: 12px; align-items: center; margin-top: 24px;"
                >
                  <ion-item fill="outline" style="flex: 1;">
                    <ion-label position="stacked">{{
                      'LOANS.COLLATERAL_ID' | appTranslate
                    }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'LOANS.COLLATERAL_ID' | appTranslate"
                      type="number"
                      [ngModel]="deleteCollateralId()"
                      (ngModelChange)="deleteCollateralId.set($event)"
                    ></ion-input>
                  </ion-item>
                  <ion-button color="danger" (click)="deleteCollateral()">
                    <ion-icon name="trash-outline"></ion-icon>
                    {{ 'LOANS.DELETE_COLLATERAL' | appTranslate }}
                  </ion-button>
                </div>
              </ion-card-content>
            </ion-card>
          </div>
        }
        @if (activeTab() === TAB.delinquency) {
          <div class="tab-content">
            <app-loan-delinquency-tab
              [loanId]="loanId()"
              [summary]="loan()?.delinquent"
              [isActive]="isLoanActive"
              (changed)="loadLoanData()"
            ></app-loan-delinquency-tab>
          </div>
        }
        @if (activeTab() === TAB.termVariations && hasTermVariations()) {
          <div class="tab-content">
            <app-loan-term-variations-tab
              [variations]="loan()?.loanTermVariations"
            ></app-loan-term-variations-tab>
          </div>
        }
        @if (activeTab() === TAB.overdueCharges && hasOverdueCharges()) {
          <div class="tab-content">
            <app-loan-overdue-charges-tab
              [charges]="overdueCharges()"
            ></app-loan-overdue-charges-tab>
          </div>
        }
        @if (activeTab() === TAB.originators && hasOriginators()) {
          <div class="tab-content">
            <app-loan-originators-tab
              [originators]="loan()?.originators"
            ></app-loan-originators-tab>
          </div>
        }
        @if (activeTab() === TAB.standingInstructions) {
          <div class="tab-content">
            <app-loan-standing-instructions-tab
              [loanId]="loanId()"
              [clientId]="loan()?.clientId"
            ></app-loan-standing-instructions-tab>
          </div>
        }
        @if (activeTab() === TAB.assetTransfers) {
          <div class="tab-content">
            <app-loan-asset-transfers-tab [loanId]="loanId()"></app-loan-asset-transfers-tab>
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
        color: var(--text-color);
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
      .actions-area {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .tab-group {
        background-color: var(--card-bg);
        border-radius: 12px;
        box-shadow: var(--shadow-sm);
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
        border: 1px solid var(--border-color);
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
        color: var(--secondary-color);
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
        color: var(--text-muted);
      }
      .json-block {
        background: var(--card-bg, #f5f5f5);
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 6px;
        padding: 16px;
        font-size: 13px;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-all;
      }
    `,
  ],
})
export class LoanViewComponent implements OnInit, OnDestroy {
  /** Selected tab; mat-tab-group tracked this internally, ion-segment does not. */
  /** Exposed so the template names its tabs instead of numbering them. */
  protected readonly TAB = LOAN_TAB;

  private readonly popovers = viewChildren(IonPopover);

  readonly activeTab = signal<LoanTab>(LOAN_TAB.overview);
  private readonly loansService = inject(LoansService);
  private readonly transactionService = inject(LoanTransactionsService);
  private readonly buyDownFeesService = inject(LoanBuyDownFeesService);
  private readonly capitalizedIncomeService = inject(LoanCapitalizedIncomeService);
  private readonly disbursementDetailsService = inject(LoanDisbursementDetailsService);
  private readonly collateralManagementService = inject(LoanCollateralManagementService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly loanId = signal(0);
  readonly loan = signal<GetLoansLoanIdResponse | null>(null);
  readonly periods = signal<GetLoansLoanIdRepaymentPeriod[]>([]);
  readonly transactions = signal<GetLoansLoanIdTransactions[]>([]);
  readonly charges = signal<GetLoansLoanIdLoanChargeData[]>([]);
  readonly buyDownFees = signal<BuyDownFeeAmortizationDetails[]>([]);
  readonly capitalizedIncomes = signal<CapitalizedIncomeDetails[]>([]);

  // Disbursement Details
  readonly disbursementDetail = signal<GetLoansLoanIdDisbursementDetails | null>(null);
  editDisbId = 0;
  disbursementEditForm = {
    expectedDisbursementDate: '',
    principal: 0,
  };
  /**
   * The tranche's date as it stands on the server, kept apart from the edited value.
   *
   * `updateDisbursementDate` wants both: `expectedDisbursementDate` identifies the tranche being
   * moved and `updatedExpectedDisbursementDate` carries where it moves to. Editing one field in
   * place would leave nothing to send for the other.
   */
  private originalDisbursementDate = '';

  // Collateral Management
  readonly collateralDetail = signal<LoanCollateralResponseData | null>(null);
  collateralDetailId = 0;
  readonly deleteCollateralId = signal(0);

  /**
   * Fineract keeps a charged-off loan `Active` and flags it separately, so the status badge alone
   * cannot tell the two apart — an officer would see a normal active loan.
   */
  readonly chargedOff = computed(() => this.loan()?.chargedOff === true);

  /** Overpaid loans are the only ones that can refund a credit balance. */
  readonly isOverpaid = computed(
    () => (this.loan()?.status as unknown as Record<string, unknown>)?.['overpaid'] === true,
  );

  readonly isContractTerminated = computed(() => isLoanContractTerminated(this.loan()));
  readonly canTerminateContract = computed(() => canTerminateLoanContract(this.loan()));

  /** Charges the shared refund form can reverse without an installment selector. */
  readonly refundableCharges = computed(() =>
    this.charges().filter((charge) => isRefundableLoanCharge(charge, this.transactions())),
  );

  /**
   * Charge refund is valid for the same broad statuses Fineract accepts and needs at least one
   * collected charge to reverse. Looking at the loaded charge list avoids offering a menu item
   * that could only lead to an empty form.
   */
  readonly canRefundCharge = computed(() => {
    const status = this.loan()?.status as unknown as Record<string, unknown> | undefined;
    const statusAllowsRefund =
      status?.['active'] === true ||
      status?.['closedObligationsMet'] === true ||
      status?.['overpaid'] === true;
    return statusAllowsRefund && this.refundableCharges().length > 0;
  });

  /**
   * A cash refund returns money the borrower paid ahead of schedule, so the platform accepts it
   * only while the loan is still active *and* carries an advance balance. Both halves matter, and
   * each fails differently: an active loan with nothing paid ahead answers `403`
   * `error.msg.loan.refund.amount.invalid` ("loan is not paid in advance"), while an overpaid —
   * therefore closed — loan answers `400` `error.msg.loan.refund.account.is.not.active`. Offering
   * the action outside that window would hand the user something that can only fail, which is the
   * conditional-offering rule #268 established for undo-last-disbursal.
   *
   * `paidInAdvance` is not on the generated `GetLoansLoanIdResponse` (see #448), so it is read
   * defensively rather than through the typed model — the same shape as `isOverpaid` above.
   */
  readonly hasAdvanceBalance = computed(() => {
    const block = (this.loan() as unknown as Record<string, unknown> | undefined)?.[
      'paidInAdvance'
    ] as { paidInAdvance?: number } | undefined;
    return (block?.paidInAdvance ?? 0) > 0;
  });

  /** Recovery payments and undoing a write-off both require the loan to be written off. */
  readonly isWrittenOff = computed(
    () =>
      (this.loan()?.status as unknown as Record<string, unknown>)?.['closedWrittenOff'] === true,
  );

  /**
   * Down payment is only meaningful when the product enabled it.
   *
   * Fineract's own message for the neighbouring re-amortize command — "only available for
   * progressive repayment schedule and Advanced payment allocation strategy" — is why these
   * three are gated on the engine rather than offered everywhere.
   */
  readonly canTakeDownPayment = computed(
    () => this.isProgressiveLoan() && this.loan()?.enableDownPayment === true,
  );

  isProgressiveLoan(): boolean {
    return this.loan()?.loanScheduleType?.code === LOAN_SCHEDULE_TYPE.PROGRESSIVE;
  }

  /**
   * Whether this loan can carry buy-down fees / capitalized income at all.
   *
   * Gated on the loan's own capability flag rather than on the schedule type. Both are features
   * of the progressive engine, so a cumulative loan never has them — but a progressive loan only
   * has them when the product enabled them, and a tab that can never hold anything is worse than
   * no tab: an empty table gives the user no way to tell "none recorded" from "not applicable".
   */
  readonly showBuyDownFees = computed(() => this.loan()?.enableBuyDownFee === true);
  readonly showCapitalizedIncome = computed(() => this.loan()?.enableIncomeCapitalization === true);

  /** Tabs that are not always present, keyed by the segment value that selects them. */
  /**
   * `overdueCharges` is absent from the generated response type — the upstream document omits
   * it — so it is read through a declared shape rather than cast at the point of use.
   */
  readonly overdueCharges = computed<LoanOverdueCharge[]>(
    () =>
      (this.loan() as unknown as { overdueCharges?: LoanOverdueCharge[] })?.overdueCharges ?? [],
  );

  // Hidden when empty rather than shown empty. An empty table here would read as "nothing was
  // varied" / "no originator", which is the same thing a failed read looks like; the platform
  // returns these arrays on every loan and most loans have none.
  readonly hasTermVariations = computed(() => (this.loan()?.loanTermVariations ?? []).length > 0);
  readonly hasOverdueCharges = computed(() => this.overdueCharges().length > 0);
  readonly hasOriginators = computed(() => (this.loan()?.originators ?? []).length > 0);

  readonly hasLoanOfficer = computed(() => !!this.loan()?.loanOfficerId);

  /**
   * `multiDisburseLoan` is absent from the generated response type even though every loan
   * carries it, so it is read through a declared shape — same as `overdueCharges`.
   *
   * Gating on it keeps "Undo Last Disbursal" off a single-disbursal loan, where the platform
   * can only ever answer 403 `loan.product.does.not.support.multiple.disbursals`.
   */
  readonly isMultiDisburse = computed(
    () => (this.loan() as unknown as { multiDisburseLoan?: boolean })?.multiDisburseLoan === true,
  );

  /** Tabs that exist only when the loan says so. Keyed by tab, which is why tabs have names. */
  private readonly conditionalTabs: Partial<Record<LoanTab, Signal<boolean>>> = {
    [LOAN_TAB.buyDownFees]: this.showBuyDownFees,
    [LOAN_TAB.capitalizedIncome]: this.showCapitalizedIncome,
    [LOAN_TAB.termVariations]: this.hasTermVariations,
    [LOAN_TAB.overdueCharges]: this.hasOverdueCharges,
    [LOAN_TAB.originators]: this.hasOriginators,
  };

  constructor() {
    // A tab can disappear when the loan finishes loading — the segment defaults to a value before
    // the capabilities are known. Falling back to the overview keeps the page from rendering a
    // segment with nothing selected and no content beneath it.
    effect(() => {
      const available = this.conditionalTabs[this.activeTab()];
      if (available && !available()) {
        this.activeTab.set(LOAN_TAB.overview);
      }
    });
  }

  get isLoanApproved(): boolean {
    const status = this.loan()?.status;
    return (status as unknown as Record<string, unknown>)?.['value'] === 'Approved';
  }

  get isLoanPendingApproval(): boolean {
    const status = this.loan()?.status;
    return (
      (status as unknown as Record<string, unknown>)?.['value'] === 'Submitted and pending approval'
    );
  }

  get isLoanActive(): boolean {
    return !!this.loan()?.status?.active;
  }

  /**
   * Whether the platform will accept a repayment on this loan.
   *
   * `LoanRepaymentValidator` refuses anything else with
   * `error.msg.loan.must.be.active.fully.paid.or.overpaid`, so these three flags are the whole
   * rule — a loan awaiting approval, awaiting disbursal, rejected, withdrawn or written off
   * cannot take one.
   */
  get canAcceptRepayment(): boolean {
    const status = this.loan()?.status;
    return !!(status?.active || status?.overpaid || status?.closedObligationsMet);
  }

  /**
   * Whether the approved and available-disbursement amounts are meaningful to revise — #284.
   *
   * Both platform commands work on an approved loan and on an active one (revising after a
   * partial disbursement is exactly what the acceptance tests in `apache/fineract` cover), but
   * neither means anything before approval or after the loan closes. That is as far as this
   * gates: whether a decrease is allowed, and whether zero is allowed, depend on tranche and
   * disbursement state the client cannot know in advance, so those are left to the platform to
   * refuse.
   */
  get canReviseLoanAmounts(): boolean {
    return this.isLoanApproved || this.isLoanActive;
  }

  get repaymentFrequencyValue(): string {
    const freq = this.loan()?.repaymentFrequencyType;
    return ((freq as unknown as Record<string, unknown>)?.['value'] as string) || '';
  }

  categoryHeaderColumns = ['empty-header', 'balance-header', 'cost-header', 'totals-header'];
  scheduleColumns = [
    'period',
    'days',
    'dueDate',
    'paidDate',
    'check',
    'balance',
    'principal',
    'interest',
    'fees',
    'penalties',
    'due',
    'paid',
    'inAdvance',
    'late',
    'outstanding',
  ];
  transactionColumns = ['id', 'date', 'type', 'amount', 'txActions'];
  chargeColumns = ['name', 'amount', 'due', 'outstanding'];
  buyDownFeeColumns = [
    'transactionId',
    'buyDownFeeAmount',
    'amortizedAmount',
    'notYetAmortizedAmount',
  ];
  capitalizedIncomeColumns = [
    'amount',
    'amortizedAmount',
    'unrecognizedAmount',
    'amountAdjustment',
    'chargedOffAmount',
  ];

  get totalPrincipalDue(): number {
    return this.periods().reduce((acc, p) => acc + (p.principalDue || 0), 0);
  }
  get totalInterestDue(): number {
    return this.periods().reduce((acc, p) => acc + (p.interestDue || 0), 0);
  }
  get totalFeesDue(): number {
    return this.periods().reduce((acc, p) => acc + (p.feeChargesDue || 0), 0);
  }
  get totalPenaltiesDue(): number {
    return this.periods().reduce((acc, p) => acc + (p.penaltyChargesDue || 0), 0);
  }
  get totalDue(): number {
    return this.periods().reduce((acc, p) => acc + (p.totalDueForPeriod || 0), 0);
  }
  get totalPaid(): number {
    return this.periods().reduce((acc, p) => acc + (p.totalPaidForPeriod || 0), 0);
  }
  get totalPaidInAdvance(): number {
    return this.periods().reduce((acc, p) => acc + (p.totalPaidInAdvanceForPeriod || 0), 0);
  }
  get totalPaidLate(): number {
    return this.periods().reduce((acc, p) => acc + (p.totalPaidLateForPeriod || 0), 0);
  }
  get totalOutstanding(): number {
    return this.periods().reduce((acc, p) => acc + (p.totalOutstandingForPeriod || 0), 0);
  }

  get formattedSubmittedDate(): string {
    const dates = this.loan()?.timeline?.submittedOnDate as unknown as number[];
    if (dates && Array.isArray(dates)) {
      return new Date(dates[0], dates[1] - 1, dates[2]).toLocaleDateString();
    }
    return '-';
  }

  get formattedExpectedDisbursementDate(): string {
    const dates = this.loan()?.timeline?.expectedDisbursementDate as unknown as number[];
    if (dates && Array.isArray(dates)) {
      return new Date(dates[0], dates[1] - 1, dates[2]).toLocaleDateString();
    }
    return '-';
  }

  formatPeriodDate(dates: number[] | undefined | null): string {
    if (dates && Array.isArray(dates)) {
      return new Date(dates[0], dates[1] - 1, dates[2]).toLocaleDateString();
    }
    return '';
  }

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loanId.set(+id);
        this.loadLoanData();
      }
    });
  }

  ngOnDestroy(): void {
    for (const popover of this.popovers()) {
      void popover.dismiss().catch(() => false);
    }
  }

  loadLoanData() {
    // Request associations so repayment schedule, charges, and transactions are returned
    this.loansService.getLoansLoanId(this.loanId(), false, 'all').subscribe({
      next: (data) => {
        this.loan.set(data);
        this.periods.set(data.repaymentSchedule?.periods || []);
        this.transactions.set(data.transactions || []);
        this.charges.set(data.charges || []);
        // Only ask for what this loan can actually have. Both are progressive-engine features:
        // fetching them for every loan meant two guaranteed-useless requests per cumulative loan
        // view, with their failures swallowed so nothing ever surfaced the waste.
        // Addressed by loan id, not external id. Both tabs used the `/loans/external-id/…`
        // endpoints and so were gated on the loan *having* an external id — which is optional,
        // so on a loan without one the tab still appeared (it keys off `enable…` alone) and sat
        // permanently empty. The `enable…` flags are what keep this from being a wasted request.
        if (data.enableBuyDownFee) {
          this.buyDownFeesService.getLoansLoanIdBuydownFees(this.loanId()).subscribe({
            next: (fees) => this.buyDownFees.set(fees ?? []),
            error: () => this.buyDownFees.set([]),
          });
        }
        if (data.enableIncomeCapitalization) {
          this.capitalizedIncomeService.getLoansLoanIdCapitalizedIncomes(this.loanId()).subscribe({
            next: (items) => this.capitalizedIncomes.set(items ?? []),
            error: () => this.capitalizedIncomes.set([]),
          });
        }
      },
      error: (err) => console.error('Failed to load loan data', err),
    });
  }

  loadDisbursementDetail() {
    if (!this.editDisbId) return;
    this.disbursementDetailsService
      .getLoansLoanIdDisbursementsDisbursementId(this.loanId(), this.editDisbId)
      .subscribe({
        next: (data) => {
          let parsed: GetLoansLoanIdDisbursementDetails | null = null;
          try {
            parsed =
              typeof data === 'string'
                ? (JSON.parse(data) as GetLoansLoanIdDisbursementDetails)
                : (data as GetLoansLoanIdDisbursementDetails);
          } catch {
            parsed = data as GetLoansLoanIdDisbursementDetails;
          }
          this.disbursementDetail.set(parsed);
          this.originalDisbursementDate = toEditableDate(parsed?.expectedDisbursementDate);
          this.disbursementEditForm.expectedDisbursementDate = this.originalDisbursementDate;
          this.disbursementEditForm.principal = parsed?.principal ?? 0;
        },
        error: (err) => {
          // The global errorInterceptor already surfaces the backend's error
          // message via a snackbar for every failed HTTP call, so no local
          // one is needed here — just reset local state.
          console.error('Failed to load disbursement detail', err);
          this.disbursementDetail.set(null);
        },
      });
  }

  /**
   * Moves a tranche of a multi-disbursal loan, or changes the principal it carries.
   *
   * The platform's `updateDisbursementDate` command takes the tranche's current date as
   * `expectedDisbursementDate` and the edit as `updatedExpectedDisbursementDate` and
   * `updatedPrincipal`; all three are mandatory, as are `dateFormat` and `locale`. It refuses
   * anything outside that set outright, so the `note` this form used to collect took the whole
   * request down with `error.msg.parameter.unsupported` — the reason the field is gone.
   */
  saveDisbursementDetail() {
    if (!this.editDisbId) return;

    const updatedDate = formatDateToFineract(this.disbursementEditForm.expectedDisbursementDate);
    if (!updatedDate) {
      this.notifications.error(this.i18n.translate('LOANS.EXPECTED_DISBURSEMENT_REQUIRED'));
      return;
    }

    this.disbursementDetailsService
      .putLoansLoanIdDisbursementsDisbursementId(this.loanId(), this.editDisbId, {
        expectedDisbursementDate:
          formatDateToFineract(this.originalDisbursementDate) || updatedDate,
        updatedExpectedDisbursementDate: updatedDate,
        updatedPrincipal: Number(this.disbursementEditForm.principal) || 0,
        dateFormat: FINERACT_DATE_FORMAT,
        locale: FINERACT_LOCALE,
      })
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.translate('LOANS.DISBURSEMENT_SAVED'));
          this.loadDisbursementDetail();
        },
        // The global errorInterceptor already raises the platform's own message.
        error: (err) => console.error('Failed to save disbursement detail', err),
      });
  }

  loadCollateralDetail() {
    if (!this.collateralDetailId) return;
    this.collateralManagementService
      .getLoanCollateralManagementCollateralId(this.collateralDetailId)
      .subscribe({
        next: (data) => this.collateralDetail.set(data),
        error: (err) => console.error('Failed to load collateral detail', err),
      });
  }

  deleteCollateral() {
    if (!this.deleteCollateralId()) return;
    this.confirm('LOANS.DELETE_COLLATERAL', 'LOANS.CONFIRM_DELETE_COLLATERAL', true).subscribe(
      (confirmed) => {
        if (!confirmed) return;
        this.collateralManagementService
          .deleteLoanCollateralManagementId(this.loanId(), this.deleteCollateralId())
          .subscribe({
            next: () => {
              this.notifications.success('Collateral deleted successfully.');
              this.deleteCollateralId.set(0);
            },
            error: (err) => console.error('Failed to delete collateral', err),
          });
      },
    );
  }

  onRepayment() {
    this.router.navigate([`/loans/${this.loanId()}/transactions/repayment`]);
  }

  onDisburse() {
    this.router.navigate([`/loans/${this.loanId()}/transactions/disburse`]);
  }

  onLoanAction(command: string) {
    this.router.navigate([`/products/loan/${this.loanId()}/action/${command}`]);
  }

  onAddCharge() {
    this.router.navigate([`/products/loan/${this.loanId()}/action/applycharges`]);
  }

  onAddCollateral() {
    this.router.navigate([`/loans/${this.loanId()}/collateral/create`]);
  }

  onAssignLoanOfficer() {
    this.router.navigate([`/products/loan/${this.loanId()}/action/assignloanofficer`]);
  }

  onModifyLoan() {
    this.router.navigate([`/loans/edit/${this.loanId()}`]);
  }

  onDeleteLoan() {
    this.confirm('COMMON.DELETE', 'LOANS.CONFIRM_DELETE_LOAN', true).subscribe((confirmed) => {
      if (!confirmed) return;
      this.loansService.deleteLoansLoanId(this.loanId()).subscribe({
        next: () => this.router.navigate(['/loans']),
        error: (err) => console.error('Failed to delete loan', err),
      });
    });
  }

  /**
   * Returns an approved loan to `Submitted and pending approval`.
   *
   * Not routed through the shared account action form, for the same reason as
   * {@link onUndoChargeOff}: that form sends `locale` and `dateFormat` on every request, and
   * `undoapproval` rejects both — the platform answers 400 naming them as unsupported
   * parameters. It accepts an empty body, or one carrying only `note`.
   */
  async onUndoApproval(): Promise<void> {
    const result = await this.dialogService.open<LoanUndoApprovalResult>(
      LoanUndoApprovalDialogComponent,
    );
    if (!result) return;

    this.loansService.postLoansLoanId(this.loanId(), result, 'undoapproval').subscribe({
      next: () => {
        this.notifications.success(this.i18n.translate('LOANS.APPROVAL_UNDONE'));
        this.loadLoanData();
      },
      // No toast here: errorInterceptor already raises one with the platform's own message.
      error: () => undefined,
    });
  }

  /**
   * Revises the sanctioned amount on an approved or already-disbursing loan — #284.
   *
   * `PUT .../approved-amount`, not `postLoansLoanId`'s command family: it is its own
   * sub-resource, takes `{ amount, locale }`, and returns the old/new figures on `changes`
   * rather than the loan itself, so a reload is still needed to reflect it on screen.
   */
  async onReviseApprovedAmount(): Promise<void> {
    const result = await this.dialogService.open<LoanApprovedAmountResult>(
      LoanApprovedAmountDialogComponent,
      { data: { currentApprovedAmount: this.loan()?.approvedPrincipal } },
    );
    if (!result) return;

    this.loansService
      .putLoansLoanIdApprovedAmount(this.loanId(), {
        amount: result.amount,
        locale: FINERACT_LOCALE,
      })
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.translate('LOANS.APPROVED_AMOUNT_REVISED'));
          this.loadLoanData();
        },
        // No toast here: errorInterceptor already raises one with the platform's own message.
        error: () => undefined,
      });
  }

  /**
   * Revises how much of the approved amount may still be drawn — #284. Indirectly changes the
   * approved amount too (the platform's own `changes` on the response reflects both), which is
   * exactly why {@link onReviseApprovedAmount} and this exist as separate commands rather than
   * one dialog: they read the same underlying figure but from opposite ends.
   */
  async onReviseAvailableDisbursementAmount(): Promise<void> {
    const result = await this.dialogService.open<LoanAvailableDisbursementAmountResult>(
      LoanAvailableDisbursementAmountDialogComponent,
    );
    if (!result) return;

    this.loansService
      .putLoansLoanIdAvailableDisbursementAmount(this.loanId(), {
        amount: result.amount,
        locale: FINERACT_LOCALE,
      })
      .subscribe({
        next: () => {
          this.notifications.success(
            this.i18n.translate('LOANS.AVAILABLE_DISBURSEMENT_AMOUNT_REVISED'),
          );
          this.loadLoanData();
        },
        // No toast here: errorInterceptor already raises one with the platform's own message.
        error: () => undefined,
      });
  }

  /**
   * Disburses into the savings account the loan was linked to at application time.
   *
   * There is no destination to choose — the platform refuses the command on a loan with no
   * linked account ("requires linked savings account for payment"), so the dialog collects
   * only the date and the amount.
   */
  async onDisburseToSavings(): Promise<void> {
    const result = await this.dialogService.open<LoanDisburseToSavingsResult>(
      LoanDisburseToSavingsDialogComponent,
      { data: { amount: this.loan()?.principal } },
    );
    if (!result) return;

    this.runLoanCommand('disbursetosavings', {
      ...result,
      actualDisbursementDate: formatDateToFineract(result.actualDisbursementDate),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    });
  }

  /** Takes the loan officer off the loan from a given date. */
  async onUnassignLoanOfficer(): Promise<void> {
    const result = await this.dialogService.open<LoanUnassignOfficerResult>(
      LoanUnassignOfficerDialogComponent,
    );
    if (!result) return;

    this.runLoanCommand('unassignloanofficer', {
      unassignedDate: formatDateToFineract(result.unassignedDate),
      dateFormat: FINERACT_DATE_FORMAT,
      locale: FINERACT_LOCALE,
    });
  }

  /**
   * Reverses the most recent tranche of a multi-disbursal loan.
   *
   * Sends an empty body, matching its sibling `undoDisbursal` rather than the shared action
   * form — see {@link onUndoApproval} for why that form is not usable for parameterless
   * commands.
   */
  onUndoLastDisbursal(): void {
    this.confirm(
      'LOANS.ACTIONS.UNDO_LAST_DISBURSAL',
      'LOANS.CONFIRM_UNDO_LAST_DISBURSAL',
      true,
    ).subscribe((confirmed) => {
      if (!confirmed) return;
      this.runLoanCommand('undoLastDisbursal', {});
    });
  }

  /** Posts a loan state-transition command and re-reads the loan, with one success toast. */
  private runLoanCommand(command: string, body: Record<string, unknown>): void {
    this.loansService.postLoansLoanId(this.loanId(), body, command).subscribe({
      next: () => {
        this.notifications.success(this.i18n.translate('LOANS.COMMAND_APPLIED'));
        this.loadLoanData();
      },
      // No toast: errorInterceptor already raises one with the platform's own message.
      error: () => undefined,
    });
  }

  onUndoDisbursal() {
    this.confirm('LOANS.ACTIONS.UNDO_DISBURSAL', 'LOANS.CONFIRM_UNDO_DISBURSAL', true).subscribe(
      (confirmed) => {
        if (!confirmed) return;
        this.loansService.postLoansLoanId(this.loanId(), {}, 'undoDisbursal').subscribe({
          next: () => this.loadLoanData(),
          error: (err) => console.error('Failed to undo disbursal', err),
        });
      },
    );
  }

  onUndoChargeOff(): void {
    this.confirm('LOANS.ACTIONS.UNDO_CHARGE_OFF', 'LOANS.CONFIRM_UNDO_CHARGE_OFF').subscribe(
      (confirmed) => {
        if (!confirmed) return;
        // Deliberately not routed through the shared transaction form: this command takes an
        // empty body, and rejects the `locale` and `dateFormat` that form sends on every request.
        this.transactionService
          .postLoansLoanIdTransactions(this.loanId(), {}, 'undo-charge-off')
          .subscribe({
            next: () => {
              this.notifications.success(this.i18n.translate('LOANS.CHARGE_OFF_UNDONE'));
              this.loadLoanData();
            },
            error: () => this.notifications.error(this.i18n.translate('COMMON.ERRORS.UNEXPECTED')),
          });
      },
    );
  }

  onLoanTransactionAction(type: string) {
    this.router.navigate([`/loans/${this.loanId()}/transactions/${type}`]);
  }

  onViewTransaction(tx: GetLoansLoanIdTransactions): void {
    this.dialogService
      .open(TransactionDetailDialogComponent, {
        data: {
          loanId: this.loanId(),
          transactionId: tx.id,
          currencySymbol: this.loan()?.currency?.displaySymbol,
          adjustable: this.isCreditTransaction(tx) && !tx.manuallyReversed,
        },
      })
      .then((adjusted) => {
        if (adjusted) this.loadLoanData();
      });
  }

  /**
   * Charges back part or all of a repayment.
   *
   * Row-level rather than an Actions-menu command: the platform accepts `chargeback` only
   * against a specific transaction, and answers "unsupported value" for it at loan level.
   */
  async onChargeback(tx: GetLoansLoanIdTransactions): Promise<void> {
    if (tx.id === undefined) return;
    const data: LoanChargebackData = {
      loanId: this.loanId(),
      transactionId: tx.id,
      amount: tx.amount ?? 0,
      // The generated type says string; the platform sends [year, month, day], as the table does.
      date: this.formatPeriodDate(tx.date as unknown as number[]),
      currencySymbol: this.loan()?.currency?.displaySymbol,
    };
    const result = await this.dialogService.open<LoanChargebackResult>(
      LoanChargebackDialogComponent,
      { data },
    );
    if (!result) return;

    this.transactionService
      .postLoansLoanIdTransactionsTransactionId(
        this.loanId(),
        tx.id,
        { ...result, locale: FINERACT_LOCALE },
        'chargeback',
      )
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.translate('LOANS.CHARGEBACK_RECORDED'));
          this.loadLoanData();
        },
        // No toast here: errorInterceptor already raises one with the platform's own message.
        error: () => undefined,
      });
  }

  private confirm(titleKey: string, messageKey: string, destructive = false): Observable<boolean> {
    return from(
      this.dialogService.confirm({
        title: this.i18n.translate(titleKey),
        message: this.i18n.translate(messageKey),
        destructive,
      }),
    );
  }

  /** A repayment that has not been reversed — the only kind the platform lets you charge back. */
  isChargebackEligible(tx: GetLoansLoanIdTransactions): boolean {
    return !!tx.type?.repayment && !tx.manuallyReversed;
  }

  isDebitTransaction(tx: GetLoansLoanIdTransactions): boolean {
    return !!tx.type?.disbursement;
  }

  isCreditTransaction(tx: GetLoansLoanIdTransactions): boolean {
    return !!(
      tx.type?.repayment ||
      tx.type?.recoveryRepayment ||
      tx.type?.waiveInterest ||
      tx.type?.waiveCharges ||
      tx.type?.writeOff ||
      tx.type?.chargePayment ||
      tx.type?.refund ||
      tx.type?.creditBalanceRefund ||
      tx.type?.goodwillCredit ||
      tx.type?.merchantIssuedRefund ||
      tx.type?.payoutRefund
    );
  }

  onBack() {
    this.router.navigate(['/loans']);
  }
}
