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

import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DecimalPipe } from '@angular/common';
import {
  ClientService,
  NotesService,
  GetClientsClientIdResponse,
  GetClientsLoanAccounts,
  GetClientsSavingsAccounts,
  PostClientsClientIdRequest,
} from '../../api';
import { StatusBadgeComponent } from '../../shared';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { resolveAccountActionType } from '../../core/utils/account-type-resolver';
import { ClientActionDialogComponent } from './client-action-dialog.component';
import {
  ClientTransferDialogComponent,
  ClientTransferResult,
} from './client-transfer-dialog.component';
import {
  ClientTransferResponseDialogComponent,
  ClientTransferResponseResult,
} from './client-transfer-response-dialog.component';
import { ClientStaffDialogComponent, ClientStaffResult } from './client-staff-dialog.component';
import {
  ClientSavingsAccountDialogComponent,
  ClientSavingsAccountResult,
} from './client-savings-account-dialog.component';
import { CLIENT_STATUS, ClientServicingFields } from './client-servicing.model';
import {
  formatDateToFineract,
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
} from '../../core/utils/date-formatter';
import { ClientIdentifiersListComponent } from './tabs/client-identifiers-list.component';
import { ClientAddressesListComponent } from './tabs/client-addresses-list.component';
import { ClientFamilyMembersListComponent } from './tabs/client-family-members-list.component';
import { ClientNotesListComponent } from './tabs/client-notes-list.component';
import { ClientDocumentsListComponent } from './tabs/client-documents-list.component';
import { EntityDatatablesComponent } from '../../shared/components/entity-datatables/entity-datatables.component';
import { CdkTableModule } from '@angular/cdk/table';
import { DialogService } from '../../core/services/dialog.service';
import { I18N } from '../../core/adapters';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
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

/** Shape the client action dialog resolves with. */
interface ClientActionResult {
  actionDate: Date;
  reasonId?: number;
  note?: string;
}

/**
 * Menu identifier to platform command name, for the two that differ.
 *
 * `undoReject` and `undoWithdraw` are not near-misses the platform tolerates — it answers
 * `400 "The query parameter command has an unsupported value of: undoReject"` and never reaches
 * the payload, so both menu items were dead. Matching is case-insensitive, so the casing here is
 * for readability; the words are what matter. See issue #273.
 */
const CLIENT_COMMAND_NAMES: Record<string, string> = {
  undoReject: 'UndoRejection',
  undoWithdraw: 'UndoWithdrawal',
};

@Component({
  selector: 'app-client-view',
  standalone: true,
  imports: [
    RouterModule,
    TranslateModule,
    CdkTableModule,
    StatusBadgeComponent,
    HasPermissionDirective,
    ClientIdentifiersListComponent,
    ClientAddressesListComponent,
    ClientFamilyMembersListComponent,
    ClientNotesListComponent,
    ClientDocumentsListComponent,
    EntityDatatablesComponent,
    DecimalPipe,
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
    TooltipDirective,
  ],
  template: `
    <div class="view-container">
      @if (client()) {
        <div class="breadcrumb">
          <a routerLink="/clients">Clients</a> /
          <span>{{ client()?.displayName }}</span>
        </div>

        <ion-card class="header-card">
          <ion-card-content class="header-content">
            <div class="client-title-area">
              <div class="avatar-circle">
                <ion-icon name="person-outline"></ion-icon>
              </div>
              <div class="title-details">
                <h2>{{ client()?.displayName }}</h2>
                <div class="subtitle-row">
                  <span class="account-no">#{{ client()?.accountNo }}</span>
                  <span class="divider">|</span>
                  <span class="office-name">{{ client()?.officeName }}</span>
                  <app-status-badge [status]="client()?.status"></app-status-badge>
                  @if (assignedStaffName()) {
                    <span class="divider">|</span>
                    <span class="staff-name" data-testid="client-staff-name">
                      {{ assignedStaffName() }}
                    </span>
                  }
                </div>
              </div>
            </div>

            <div class="actions-area">
              <ion-button
                fill="outline"
                color="primary"
                (click)="onEditClient()"
                *appHasPermission="'UPDATE_CLIENT'"
              >
                <ion-icon name="create-outline"></ion-icon>
                {{ 'COMMON.EDIT' | translate }}
              </ion-button>

              <ion-button
                fill="outline"
                color="secondary"
                id="clientActionsMenu-trigger"
                *appHasPermission="[
                  'ACTIVATE_CLIENT',
                  'CLOSE_CLIENT',
                  'REJECT_CLIENT',
                  'WITHDRAW_CLIENT',
                  'DELETE_CLIENT',
                  'REACTIVATE_CLIENT',
                  'UNDOREJECT_CLIENT',
                  'UNDOWITHDRAW_CLIENT',
                  'PROPOSETRANSFER_CLIENT',
                  'PROPOSEANDACCEPTTRANSFER_CLIENT',
                  'ACCEPTTRANSFER_CLIENT',
                  'REJECTTRANSFER_CLIENT',
                  'WITHDRAWTRANSFER_CLIENT',
                  'ASSIGNSTAFF_CLIENT',
                  'UNASSIGNSTAFF_CLIENT',
                  'UPDATESAVINGSACCOUNT_CLIENT',
                ]"
              >
                <ion-icon name="settings-outline"></ion-icon>
                {{ 'COMMON.ACTIONS' | translate }}
              </ion-button>

              <ion-popover trigger="clientActionsMenu-trigger" [dismissOnSelect]="true">
                <ng-template>
                  <ion-list>
                    @if (client()?.status?.id === CLIENT_STATUS.PENDING) {
                      <ion-item
                        button
                        (click)="onClientAction('activate')"
                        *appHasPermission="'ACTIVATE_CLIENT'"
                      >
                        <ion-icon slot="start" name="play-circle-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.ACTIVATE_CLIENT' | translate }}</ion-label>
                      </ion-item>
                      <ion-item
                        button
                        (click)="onClientAction('reject')"
                        *appHasPermission="'REJECT_CLIENT'"
                      >
                        <ion-icon slot="start" name="alert-circle-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.REJECT_CLIENT' | translate }}</ion-label>
                      </ion-item>
                      <ion-item
                        button
                        (click)="onClientAction('withdraw')"
                        *appHasPermission="'WITHDRAW_CLIENT'"
                      >
                        <ion-icon slot="start" name="close-circle-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.WITHDRAW_CLIENT' | translate }}</ion-label>
                      </ion-item>
                      <ion-item
                        button
                        (click)="onDeleteClient()"
                        *appHasPermission="'DELETE_CLIENT'"
                      >
                        <ion-icon slot="start" name="trash-outline"></ion-icon>
                        <ion-label>{{ 'COMMON.DELETE' | translate }}</ion-label>
                      </ion-item>
                    }
                    @if (client()?.status?.id === CLIENT_STATUS.ACTIVE) {
                      <ion-item
                        button
                        (click)="onClientAction('close')"
                        *appHasPermission="'CLOSE_CLIENT'"
                      >
                        <ion-icon slot="start" name="close-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.CLOSE_CLIENT' | translate }}</ion-label>
                      </ion-item>
                      <ion-item
                        button
                        (click)="onProposeTransfer()"
                        data-testid="client-propose-transfer-action"
                        *appHasPermission="'PROPOSETRANSFER_CLIENT'"
                      >
                        <ion-icon slot="start" name="swap-horizontal-outline"></ion-icon>
                        <ion-label>{{ 'CLIENTS.ACTIONS.PROPOSE_TRANSFER' | translate }}</ion-label>
                      </ion-item>
                      <ion-item
                        button
                        (click)="onProposeAndAcceptTransfer()"
                        data-testid="client-propose-and-accept-transfer-action"
                        *appHasPermission="'PROPOSEANDACCEPTTRANSFER_CLIENT'"
                      >
                        <ion-icon slot="start" name="git-compare-outline"></ion-icon>
                        <ion-label>
                          {{ 'CLIENTS.ACTIONS.PROPOSE_AND_ACCEPT_TRANSFER' | translate }}
                        </ion-label>
                      </ion-item>
                    }

                    @if (client()?.status?.id === CLIENT_STATUS.TRANSFER_IN_PROGRESS) {
                      <ion-item
                        button
                        (click)="onAcceptTransfer()"
                        data-testid="client-accept-transfer-action"
                        *appHasPermission="'ACCEPTTRANSFER_CLIENT'"
                      >
                        <ion-icon slot="start" name="checkmark-circle-outline"></ion-icon>
                        <ion-label>{{ 'CLIENTS.ACTIONS.ACCEPT_TRANSFER' | translate }}</ion-label>
                      </ion-item>
                      <ion-item
                        button
                        (click)="onRejectTransfer()"
                        data-testid="client-reject-transfer-action"
                        *appHasPermission="'REJECTTRANSFER_CLIENT'"
                      >
                        <ion-icon slot="start" name="close-circle-outline"></ion-icon>
                        <ion-label>{{ 'CLIENTS.ACTIONS.REJECT_TRANSFER' | translate }}</ion-label>
                      </ion-item>
                    }

                    <!--
                      Withdrawing is offered from "on hold" as well as "in progress". A rejected
                      transfer leaves the client on hold at the source office, and this command is
                      the only way back to Active from there.
                    -->
                    @if (isTransferPending()) {
                      <ion-item
                        button
                        (click)="onWithdrawTransfer()"
                        data-testid="client-withdraw-transfer-action"
                        *appHasPermission="'WITHDRAWTRANSFER_CLIENT'"
                      >
                        <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                        <ion-label>{{ 'CLIENTS.ACTIONS.WITHDRAW_TRANSFER' | translate }}</ion-label>
                      </ion-item>
                    }

                    @if (canServiceClient()) {
                      <ion-item
                        button
                        (click)="onAssignStaff()"
                        data-testid="client-assign-staff-action"
                        *appHasPermission="'ASSIGNSTAFF_CLIENT'"
                      >
                        <ion-icon slot="start" name="person-add-outline"></ion-icon>
                        <ion-label>{{ 'CLIENTS.ACTIONS.ASSIGN_STAFF' | translate }}</ion-label>
                      </ion-item>
                      @if (assignedStaffId() !== undefined) {
                        <ion-item
                          button
                          (click)="onUnassignStaff()"
                          data-testid="client-unassign-staff-action"
                          *appHasPermission="'UNASSIGNSTAFF_CLIENT'"
                        >
                          <ion-icon slot="start" name="person-remove-outline"></ion-icon>
                          <ion-label>{{ 'CLIENTS.ACTIONS.UNASSIGN_STAFF' | translate }}</ion-label>
                        </ion-item>
                      }
                      <ion-item
                        button
                        (click)="onUpdateSavingsAccount()"
                        data-testid="client-update-savings-account-action"
                        *appHasPermission="'UPDATESAVINGSACCOUNT_CLIENT'"
                      >
                        <ion-icon slot="start" name="wallet-outline"></ion-icon>
                        <ion-label>
                          {{ 'CLIENTS.ACTIONS.UPDATE_SAVINGS_ACCOUNT' | translate }}
                        </ion-label>
                      </ion-item>
                    }
                    @if (client()?.status?.id === CLIENT_STATUS.CLOSED) {
                      <ion-item
                        button
                        (click)="onClientAction('reactivate')"
                        *appHasPermission="'REACTIVATE_CLIENT'"
                      >
                        <ion-icon slot="start" name="refresh-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.REACTIVATE_CLIENT' | translate }}</ion-label>
                      </ion-item>
                    }
                    @if (client()?.status?.id === CLIENT_STATUS.REJECTED) {
                      <ion-item
                        button
                        (click)="onClientAction('undoReject')"
                        *appHasPermission="'UNDOREJECT_CLIENT'"
                      >
                        <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.UNDO_REJECT_CLIENT' | translate }}</ion-label>
                      </ion-item>
                    }
                    @if (client()?.status?.id === CLIENT_STATUS.WITHDRAWN) {
                      <ion-item
                        button
                        (click)="onClientAction('undoWithdraw')"
                        *appHasPermission="'UNDOWITHDRAW_CLIENT'"
                      >
                        <ion-icon slot="start" name="arrow-undo-outline"></ion-icon>
                        <ion-label>{{ 'ACTIONS.UNDO_WITHDRAW_CLIENT' | translate }}</ion-label>
                      </ion-item>
                    }
                  </ion-list>
                </ng-template>
              </ion-popover>

              <ion-button color="primary" id="createMenu-trigger">
                <ion-icon name="add-outline"></ion-icon>
                {{ 'ACTIONS.NEW_ACCOUNT' | translate }}
              </ion-button>

              <ion-popover trigger="createMenu-trigger" [dismissOnSelect]="true">
                <ng-template>
                  <ion-list>
                    <ion-item button (click)="onCreateLoan()" *appHasPermission="'CREATE_LOAN'">
                      <ion-icon slot="start" name="business-outline"></ion-icon>
                      <ion-label>{{ 'ACTIONS.LOAN_ACCOUNT' | translate }}</ion-label>
                    </ion-item>
                    <ion-item
                      button
                      (click)="onCreateSavings()"
                      *appHasPermission="'CREATE_SAVINGSACCOUNT'"
                    >
                      <ion-icon slot="start" name="wallet-outline"></ion-icon>
                      <ion-label>{{ 'ACTIONS.SAVINGS_ACCOUNT' | translate }}</ion-label>
                    </ion-item>
                    <ion-item
                      button
                      (click)="onCreateFixed()"
                      *appHasPermission="'CREATE_FIXEDDEPOSITACCOUNT'"
                    >
                      <ion-icon slot="start" name="lock-closed-outline"></ion-icon>
                      <ion-label>{{ 'ACTIONS.FIXED_DEPOSIT' | translate }}</ion-label>
                    </ion-item>
                    <ion-item
                      button
                      (click)="onCreateRecurring()"
                      *appHasPermission="'CREATE_RECURRINGDEPOSITACCOUNT'"
                    >
                      <ion-icon slot="start" name="refresh-circle-outline"></ion-icon>
                      <ion-label>{{ 'ACTIONS.RECURRING_DEPOSIT' | translate }}</ion-label>
                    </ion-item>
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

        <div class="content-body">
          <ion-segment [value]="activeTab()" (ionChange)="activeTab.set($any($event).detail.value)">
            <ion-segment-button value="0">
              <ion-label>{{ 'CLIENTS.DETAILS' | translate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="1">
              <ion-label>{{ 'CLIENTS.SAVINGS_ACCOUNTS' | translate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="2">
              <ion-label>{{ 'CLIENTS.LOAN_ACCOUNTS' | translate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="3">
              <ion-label>{{ 'CLIENTS.IDENTIFIERS' | translate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="4">
              <ion-label>{{ 'CLIENTS.ADDRESSES' | translate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="5">
              <ion-label>{{ 'CLIENTS.FAMILY_MEMBERS' | translate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="6">
              <ion-label>{{ 'CLIENTS.NOTES' | translate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="7">
              <ion-label>{{ 'CLIENTS.DOCUMENTS' | translate }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="8">
              <ion-label>{{ 'SYSTEM.CUSTOM_FIELDS' | translate }}</ion-label>
            </ion-segment-button>
          </ion-segment>

          @if (activeTab() === '0') {
            <div class="tab-content">
              <div class="info-grid">
                <ion-card class="info-card">
                  <ion-card-header>
                    <ion-card-title>
                      <ion-icon name="id-card-outline"></ion-icon>
                      {{ 'CLIENTS.GENERAL_PROFILE' | translate }}
                    </ion-card-title>
                  </ion-card-header>
                  <ion-card-content class="details-list">
                    <div class="detail-item">
                      <span class="label">{{ 'CLIENTS.FIRST_NAME' | translate }}</span>
                      <span class="value">{{ client()?.firstname || '-' }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="label">{{ 'CLIENTS.LAST_NAME' | translate }}</span>
                      <span class="value">{{ client()?.lastname || '-' }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="label">{{ 'COMMON.EXTERNAL_ID' | translate }}</span>
                      <span class="value">{{ client()?.externalId || '-' }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="label">{{ 'CLIENTS.LEGAL_FORM' | translate }}</span>
                      <span class="value">{{ 'CLIENTS.PERSON' | translate }}</span>
                    </div>
                  </ion-card-content>
                </ion-card>

                <ion-card class="info-card">
                  <ion-card-header>
                    <ion-card-title>
                      <ion-icon name="mail-open-outline"></ion-icon>
                      {{ 'CLIENTS.CONTACT_STATUS' | translate }}
                    </ion-card-title>
                  </ion-card-header>
                  <ion-card-content class="details-list">
                    <div class="detail-item">
                      <span class="label">{{ 'COMMON.EMAIL' | translate }}</span>
                      <span class="value">{{ client()?.emailAddress || '-' }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="label">{{ 'COMMON.ACTIVATION_DATE' | translate }}</span>
                      <span class="value">{{ formattedActivationDate }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="label">{{ 'CLIENTS.TIMELINE_SUBMITTED' | translate }}</span>
                      <span class="value">{{ formattedSubmissionDate }}</span>
                    </div>
                  </ion-card-content>
                </ion-card>
              </div>
            </div>
          }
          @if (activeTab() === '1') {
            <div class="tab-content">
              <ion-card class="table-card">
                <ion-card-content>
                  @if (savingsAccounts().length > 0) {
                    <table cdk-table [dataSource]="savingsAccounts()" class="full-width-table">
                      <ng-container cdkColumnDef="accountNo">
                        <th cdk-header-cell *cdkHeaderCellDef>
                          {{ 'COMMON.ACCOUNT_NO' | translate }}
                        </th>
                        <td cdk-cell *cdkCellDef="let account">
                          <a
                            class="clickable-link"
                            [routerLink]="['/products/savings-accounts/view', account.id]"
                          >
                            {{ account.accountNo }}
                          </a>
                        </td>
                      </ng-container>

                      <ng-container cdkColumnDef="productName">
                        <th cdk-header-cell *cdkHeaderCellDef>
                          {{ 'COMMON.PRODUCT' | translate }}
                        </th>
                        <td cdk-cell *cdkCellDef="let account">{{ account.productName }}</td>
                      </ng-container>

                      <ng-container cdkColumnDef="balance">
                        <th cdk-header-cell *cdkHeaderCellDef>
                          {{ 'COMMON.BALANCE' | translate }}
                        </th>
                        <td cdk-cell *cdkCellDef="let account">
                          {{ account.currency?.displaySymbol }}
                          {{ account.accountBalance || 0 | number: '1.2-2' }}
                        </td>
                      </ng-container>

                      <ng-container cdkColumnDef="status">
                        <th cdk-header-cell *cdkHeaderCellDef>
                          {{ 'COMMON.STATUS' | translate }}
                        </th>
                        <td cdk-cell *cdkCellDef="let account">
                          <app-status-badge [status]="account.status"></app-status-badge>
                        </td>
                      </ng-container>

                      <ng-container cdkColumnDef="actions">
                        <th cdk-header-cell *cdkHeaderCellDef>
                          {{ 'COMMON.ACTIONS' | translate }}
                        </th>
                        <td cdk-cell *cdkCellDef="let account">
                          <ion-button
                            fill="clear"
                            color="primary"
                            (click)="onSavingsTransaction(account.id, 'deposit')"
                            *appHasPermission="'DEPOSIT_SAVINGSACCOUNT'"
                            [appTooltip]="'SAVINGS.DEPOSIT' | translate"
                          >
                            <ion-icon name="add-circle-outline"></ion-icon>
                          </ion-button>

                          @if (account.status?.value === 'Submitted and pending approval') {
                            <ion-button
                              fill="clear"
                              color="secondary"
                              (click)="onSavingsAction(account.id, 'approve', account)"
                              *appHasPermission="'APPROVE_SAVINGSACCOUNT'"
                              [appTooltip]="'LOANS.APPROVE' | translate"
                            >
                              <ion-icon name="checkmark-circle-outline"></ion-icon>
                            </ion-button>
                          }

                          @if (account.status?.value === 'Approved') {
                            <ion-button
                              fill="clear"
                              color="primary"
                              (click)="onSavingsAction(account.id, 'activate', account)"
                              *appHasPermission="'ACTIVATE_SAVINGSACCOUNT'"
                              [appTooltip]="'LOANS.ACTIVATE' | translate"
                            >
                              <ion-icon name="play-circle-outline"></ion-icon>
                            </ion-button>
                          }

                          @if (account.status?.value === 'Active') {
                            <ion-button
                              fill="clear"
                              color="danger"
                              (click)="onSavingsAction(account.id, 'close', account)"
                              *appHasPermission="'CLOSE_SAVINGSACCOUNT'"
                              [appTooltip]="'LOANS.CLOSE' | translate"
                            >
                              <ion-icon name="close-circle-outline"></ion-icon>
                            </ion-button>
                          }

                          <ion-button
                            fill="clear"
                            color="danger"
                            (click)="onSavingsTransaction(account.id, 'withdrawal')"
                            *appHasPermission="'WITHDRAW_SAVINGSACCOUNT'"
                            [appTooltip]="'SAVINGS.WITHDRAWAL' | translate"
                          >
                            <ion-icon name="remove-circle-outline"></ion-icon>
                          </ion-button>
                        </td>
                      </ng-container>

                      <tr cdk-header-row *cdkHeaderRowDef="savingsColumns"></tr>
                      <tr cdk-row *cdkRowDef="let row; columns: savingsColumns"></tr>
                    </table>
                  } @else {
                    <div class="empty-state">
                      <ion-icon name="wallet-outline"></ion-icon>
                      <p>{{ 'CLIENTS.NO_SAVINGS_ACCOUNTS' | translate }}</p>
                      <ion-button
                        color="primary"
                        (click)="onCreateSavings()"
                        *appHasPermission="'CREATE_SAVINGSACCOUNT'"
                        data-testid="client-empty-savings-create"
                      >
                        <ion-icon slot="start" name="add-outline"></ion-icon>
                        {{ 'CLIENTS.NEW_SAVINGS_ACCOUNT' | translate }}
                      </ion-button>
                    </div>
                  }
                </ion-card-content>
              </ion-card>
            </div>
          }
          @if (activeTab() === '2') {
            <div class="tab-content">
              <ion-card class="table-card">
                <ion-card-content>
                  @if (loanAccounts().length > 0) {
                    <table cdk-table [dataSource]="loanAccounts()" class="full-width-table">
                      <ng-container cdkColumnDef="accountNo">
                        <th cdk-header-cell *cdkHeaderCellDef>
                          {{ 'COMMON.ACCOUNT_NO' | translate }}
                        </th>
                        <td cdk-cell *cdkCellDef="let account">
                          <a class="clickable-link" [routerLink]="['/loans/view', account.id]">
                            {{ account.accountNo }}
                          </a>
                        </td>
                      </ng-container>

                      <ng-container cdkColumnDef="productName">
                        <th cdk-header-cell *cdkHeaderCellDef>
                          {{ 'COMMON.PRODUCT' | translate }}
                        </th>
                        <td cdk-cell *cdkCellDef="let account">{{ account.productName }}</td>
                      </ng-container>

                      <ng-container cdkColumnDef="principal">
                        <th cdk-header-cell *cdkHeaderCellDef>
                          {{ 'LOANS.PRINCIPAL' | translate }}
                        </th>
                        <td cdk-cell *cdkCellDef="let account">
                          {{ account.currency?.displaySymbol }}
                          {{ account.originalPrincipal || 0 | number: '1.2-2' }}
                        </td>
                      </ng-container>

                      <ng-container cdkColumnDef="status">
                        <th cdk-header-cell *cdkHeaderCellDef>
                          {{ 'COMMON.STATUS' | translate }}
                        </th>
                        <td cdk-cell *cdkCellDef="let account">
                          <app-status-badge [status]="account.status"></app-status-badge>
                        </td>
                      </ng-container>

                      <ng-container cdkColumnDef="actions">
                        <th cdk-header-cell *cdkHeaderCellDef>
                          {{ 'COMMON.ACTIONS' | translate }}
                        </th>
                        <td cdk-cell *cdkCellDef="let account">
                          <ion-button
                            fill="clear"
                            color="primary"
                            (click)="onLoanTransaction(account.id, 'repayment')"
                            *appHasPermission="'REPAYMENT_LOAN'"
                            [appTooltip]="'LOANS.REPAYMENT' | translate"
                          >
                            <ion-icon name="card-outline"></ion-icon>
                          </ion-button>

                          @if (account.status?.value === 'Submitted and pending approval') {
                            <ion-button
                              fill="clear"
                              color="secondary"
                              (click)="onLoanAction(account.id, 'approve')"
                              [appTooltip]="'LOANS.APPROVE' | translate"
                            >
                              <ion-icon name="checkmark-circle-outline"></ion-icon>
                            </ion-button>
                          }

                          @if (account.status?.value === 'Approved') {
                            <ion-button
                              fill="clear"
                              color="secondary"
                              (click)="onLoanAction(account.id, 'disburse')"
                              [appTooltip]="'LOANS.DISBURSE' | translate"
                            >
                              <ion-icon name="open-outline"></ion-icon>
                            </ion-button>
                          }

                          @if (account.status?.active) {
                            <ion-button
                              fill="clear"
                              color="danger"
                              (click)="onLoanAction(account.id, 'close')"
                              *appHasPermission="'CLOSE_LOAN'"
                              [appTooltip]="'LOANS.CLOSE' | translate"
                            >
                              <ion-icon name="close-circle-outline"></ion-icon>
                            </ion-button>
                          }
                        </td>
                      </ng-container>

                      <tr cdk-header-row *cdkHeaderRowDef="loanColumns"></tr>
                      <tr cdk-row *cdkRowDef="let row; columns: loanColumns"></tr>
                    </table>
                  } @else {
                    <div class="empty-state">
                      <ion-icon name="card-outline"></ion-icon>
                      <p>{{ 'CLIENTS.NO_LOAN_ACCOUNTS' | translate }}</p>
                      <ion-button
                        color="primary"
                        (click)="onCreateLoan()"
                        *appHasPermission="'CREATE_LOAN'"
                        data-testid="client-empty-loans-create"
                      >
                        <ion-icon slot="start" name="add-outline"></ion-icon>
                        {{ 'CLIENTS.APPLY_FOR_LOAN' | translate }}
                      </ion-button>
                    </div>
                  }
                </ion-card-content>
              </ion-card>
            </div>
          }
          @if (activeTab() === '3') {
            <div class="tab-content">
              <app-client-identifiers-list [clientId]="clientId()"></app-client-identifiers-list>
            </div>
          }
          @if (activeTab() === '4') {
            <div class="tab-content">
              <app-client-addresses-list [clientId]="clientId()"></app-client-addresses-list>
            </div>
          }
          @if (activeTab() === '5') {
            <div class="tab-content">
              <app-client-family-members-list
                [clientId]="clientId()"
              ></app-client-family-members-list>
            </div>
          }
          @if (activeTab() === '6') {
            <div class="tab-content">
              <app-client-notes-list [clientId]="clientId()"></app-client-notes-list>
            </div>
          }
          @if (activeTab() === '7') {
            <div class="tab-content">
              <app-client-documents-list [clientId]="clientId()"></app-client-documents-list>
            </div>
          }
          @if (activeTab() === '8') {
            <div class="tab-content">
              <app-entity-datatables
                apptableName="m_client"
                [entityId]="clientId()"
              ></app-entity-datatables>
            </div>
          }
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
      .breadcrumb {
        font-size: 14px;
        margin-bottom: -8px;
      }
      .breadcrumb a {
        text-decoration: none;
        color: var(--primary-color);
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
      .client-title-area {
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
      .empty-state ion-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
      }
      .empty-state ion-button {
        margin-top: 16px;
      }
      .clickable-link {
        color: #3f51b5;
        text-decoration: none;
        font-weight: 500;
        cursor: pointer;
      }
      .clickable-link:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class ClientViewComponent implements OnInit {
  /** Selected tab; mat-tab-group tracked this internally, ion-segment does not. */
  readonly activeTab = signal('0');
  private readonly clientService = inject(ClientService);
  private readonly notesService = inject(NotesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18n = inject(I18N);

  readonly clientId = signal(0);
  readonly client = signal<GetClientsClientIdResponse | null>(null);
  readonly loanAccounts = signal<GetClientsLoanAccounts[]>([]);
  readonly savingsAccounts = signal<GetClientsSavingsAccounts[]>([]);

  savingsColumns = ['accountNo', 'productName', 'balance', 'status', 'actions'];
  loanColumns = ['accountNo', 'productName', 'principal', 'status', 'actions'];

  /** Exposed so the template can name the statuses it gates on rather than spell out ids. */
  protected readonly CLIENT_STATUS = CLIENT_STATUS;

  /**
   * The fields `GetClientsClientIdResponse` does not describe but the endpoint returns.
   * See {@link ClientServicingFields} for why this cast is here rather than a spec change.
   */
  private readonly servicing = computed<ClientServicingFields>(
    () => (this.client() as unknown as ClientServicingFields | null) ?? {},
  );
  readonly assignedStaffId = computed(() => this.servicing().staffId);
  readonly assignedStaffName = computed(() => this.servicing().staffName);
  readonly defaultSavingsAccountId = computed(() => this.servicing().savingsAccountId);

  /** True while a transfer is awaiting an answer, and while a rejected one is on hold. */
  readonly isTransferPending = computed(() => {
    const status = this.client()?.status?.id;
    return (
      status === CLIENT_STATUS.TRANSFER_IN_PROGRESS || status === CLIENT_STATUS.TRANSFER_ON_HOLD
    );
  });

  /**
   * Whether the day-to-day servicing actions apply. Staff assignment and the default savings
   * account are settings on a live record; a client who has been rejected, withdrawn or closed
   * has nobody to service and no account to disburse into.
   */
  readonly canServiceClient = computed(() => {
    const status = this.client()?.status?.id;
    return status === CLIENT_STATUS.PENDING || status === CLIENT_STATUS.ACTIVE;
  });

  get formattedActivationDate(): string {
    const actDateArray = this.client()?.activationDate as unknown as number[];
    if (actDateArray && Array.isArray(actDateArray)) {
      return new Date(actDateArray[0], actDateArray[1] - 1, actDateArray[2]).toLocaleDateString();
    }
    return '-';
  }

  get formattedSubmissionDate(): string {
    const submitDateArray = this.client()?.timeline?.submittedOnDate as unknown as number[];
    if (submitDateArray && Array.isArray(submitDateArray)) {
      return new Date(
        submitDateArray[0],
        submitDateArray[1] - 1,
        submitDateArray[2],
      ).toLocaleDateString();
    }
    return '-';
  }

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.clientId.set(+id);
        this.loadClientData();
        this.loadClientAccounts();
      }
    });
  }

  loadClientData() {
    this.clientService.getClientsClientId(this.clientId()).subscribe({
      next: (data) => this.client.set(data),
      error: (err) => console.error('Failed to load client details', err),
    });
  }

  loadClientAccounts() {
    this.clientService.getClientsClientIdAccounts(this.clientId()).subscribe({
      next: (accounts) => {
        this.loanAccounts.set(Array.from(accounts.loanAccounts || []));
        this.savingsAccounts.set(Array.from(accounts.savingsAccounts || []));
      },
      error: (err) => console.error('Failed to load client accounts', err),
    });
  }

  onEditClient() {
    this.router.navigate(['/clients/edit', this.clientId()]);
  }

  private buildClientActionPayload(
    command: string,
    result: { actionDate: Date; reasonId?: number; note?: string },
    formattedDate: string,
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      locale: FINERACT_LOCALE,
      dateFormat: FINERACT_DATE_FORMAT,
    };

    switch (command) {
      case 'activate':
        payload['activationDate'] = formattedDate;
        break;
      case 'close':
        payload['closedOnDate'] = formattedDate;
        payload['closureReasonId'] = result.reasonId;
        if (result.note) payload['comments'] = result.note;
        break;
      case 'reject':
        payload['rejectionDate'] = formattedDate;
        payload['rejectionReasonId'] = result.reasonId;
        if (result.note) payload['comments'] = result.note;
        break;
      case 'withdraw':
        payload['withdrawalDate'] = formattedDate;
        payload['withdrawalReasonId'] = result.reasonId;
        if (result.note) payload['comments'] = result.note;
        break;
      case 'reactivate':
        payload['reactivationDate'] = formattedDate;
        break;
      case 'undoReject':
      case 'undoWithdraw':
        payload['reopenedDate'] = formattedDate;
        break;
    }
    return payload;
  }

  onClientAction(command: string): Promise<void> {
    return this.dialogService
      .open<ClientActionResult>(ClientActionDialogComponent, {
        data: {
          title: `ACTIONS.${command.toUpperCase()}_CLIENT`,
          command: command,
          clientId: this.clientId(),
        },
      })
      .then((result) => {
        if (!result) return;

        const formattedDate = formatDateToFineract(result.actionDate);
        const payload = this.buildClientActionPayload(command, result, formattedDate);

        this.clientService
          .postClientsClientId(
            this.clientId(),
            payload as PostClientsClientIdRequest,
            CLIENT_COMMAND_NAMES[command] ?? command,
          )
          .subscribe({
            next: () => {
              const isNoteOnlyCommand =
                command === 'activate' ||
                command === 'reactivate' ||
                command === 'undoReject' ||
                command === 'undoWithdraw';

              if (result.note && isNoteOnlyCommand) {
                this.notesService
                  .postResourceTypeResourceIdNotes('clients', this.clientId(), {
                    note: result.note,
                  })
                  .subscribe({
                    next: () => this.loadClientData(),
                    error: (err) => {
                      console.error('Failed to save activation note', err);
                      this.loadClientData();
                    },
                  });
              } else {
                this.loadClientData();
              }
            },
            error: (err) => console.error(`Failed to execute ${command}`, err),
          });
      });
  }

  /**
   * Posts a client command and reloads.
   *
   * Every body here is cast: `PostClientsClientIdRequest` describes only the
   * activate/reject/withdraw/close family, so `destinationOfficeId`, `staffId` and
   * `savingsAccountId` have no declared home. See {@link ClientServicingFields}.
   *
   * No error toast is raised — `errorInterceptor` already shows one carrying the platform's own
   * message, which for these commands is the useful part ("The Client with id `18` is not
   * awaiting transfer" says more than anything this component could add).
   */
  private runClientCommand(command: string, body: Record<string, unknown>): void {
    this.clientService
      .postClientsClientId(this.clientId(), body as PostClientsClientIdRequest, command)
      .subscribe({
        next: () => this.loadClientData(),
        error: () => undefined,
      });
  }

  onProposeTransfer(): Promise<void> {
    return this.openTransferDialog('propose');
  }

  onProposeAndAcceptTransfer(): Promise<void> {
    return this.openTransferDialog('proposeAndAccept');
  }

  private async openTransferDialog(mode: 'propose' | 'proposeAndAccept'): Promise<void> {
    const result = await this.dialogService.open<ClientTransferResult>(
      ClientTransferDialogComponent,
      { data: { mode, officeId: this.client()?.officeId } },
    );
    if (!result) return;

    const body: Record<string, unknown> = {
      destinationOfficeId: result.destinationOfficeId,
    };
    // `proposeTransfer` requires a date and the locale/format that make it parseable;
    // `proposeAndAcceptTransfer` rejects `transferDate` outright, so neither is sent for it.
    if (mode === 'propose' && result.transferDate) {
      body['transferDate'] = formatDateToFineract(new Date(result.transferDate));
      body['locale'] = FINERACT_LOCALE;
      body['dateFormat'] = FINERACT_DATE_FORMAT;
    }
    if (result.note) body['note'] = result.note;

    this.runClientCommand(
      mode === 'propose' ? 'proposeTransfer' : 'proposeAndAcceptTransfer',
      body,
    );
  }

  onAcceptTransfer(): Promise<void> {
    return this.respondToTransfer('acceptTransfer', {
      titleKey: 'CLIENTS.ACTIONS.ACCEPT_TRANSFER',
      messageKey: 'CLIENTS.CONFIRM_ACCEPT_TRANSFER',
    });
  }

  onRejectTransfer(): Promise<void> {
    return this.respondToTransfer('rejectTransfer', {
      titleKey: 'CLIENTS.ACTIONS.REJECT_TRANSFER',
      messageKey: 'CLIENTS.CONFIRM_REJECT_TRANSFER',
      destructive: true,
    });
  }

  onWithdrawTransfer(): Promise<void> {
    return this.respondToTransfer('withdrawTransfer', {
      titleKey: 'CLIENTS.ACTIONS.WITHDRAW_TRANSFER',
      messageKey: 'CLIENTS.CONFIRM_WITHDRAW_TRANSFER',
      destructive: true,
    });
  }

  /**
   * The three answers to a pending transfer. All take an optional note and nothing else — a date
   * or a `locale` is refused with "The parameter … is not supported", so the body is built here
   * rather than shared with {@link buildClientActionPayload}.
   */
  private async respondToTransfer(
    command: string,
    data: {
      titleKey: string;
      messageKey: string;
      destructive?: boolean;
    },
  ): Promise<void> {
    const result = await this.dialogService.open<ClientTransferResponseResult>(
      ClientTransferResponseDialogComponent,
      { data },
    );
    if (!result) return;

    this.runClientCommand(command, result.note ? { note: result.note } : {});
  }

  async onAssignStaff(): Promise<void> {
    const result = await this.dialogService.open<ClientStaffResult>(ClientStaffDialogComponent, {
      data: { officeId: this.client()?.officeId, staffId: this.assignedStaffId() },
    });
    if (!result) return;

    this.runClientCommand('assignStaff', { staffId: result.staffId });
  }

  async onUnassignStaff(): Promise<void> {
    const staffId = this.assignedStaffId();
    if (staffId === undefined) return;

    const confirmed = await this.dialogService.confirm({
      title: this.i18n.translate('CLIENTS.ACTIONS.UNASSIGN_STAFF'),
      message: this.i18n.translate('CLIENTS.CONFIRM_UNASSIGN_STAFF'),
      destructive: true,
    });
    if (!confirmed) return;

    // `staffId` is mandatory even to unassign — an empty body answers
    // "The parameter `staffId` is mandatory." So the current holder is echoed back.
    this.runClientCommand('unassignStaff', { staffId });
  }

  async onUpdateSavingsAccount(): Promise<void> {
    const result = await this.dialogService.open<ClientSavingsAccountResult>(
      ClientSavingsAccountDialogComponent,
      { data: { clientId: this.clientId(), savingsAccountId: this.defaultSavingsAccountId() } },
    );
    if (!result) return;

    this.runClientCommand('updateSavingsAccount', { savingsAccountId: result.savingsAccountId });
  }

  onDeleteClient() {
    if (confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
      this.clientService.deleteClientsClientId(this.clientId()).subscribe({
        next: () => {
          this.router.navigate(['/clients']);
        },
        error: (err) => console.error('Failed to delete client', err),
      });
    }
  }

  onCreateLoan() {
    this.router.navigate(['/loans/create'], {
      queryParams: { clientId: this.clientId() },
    });
  }

  onCreateSavings() {
    this.router.navigate(['/products/savings-accounts/create'], {
      queryParams: { clientId: this.clientId() },
    });
  }

  onCreateFixed() {
    this.router.navigate(['/products/fixed-deposits/create'], {
      queryParams: { clientId: this.clientId() },
    });
  }

  onCreateRecurring() {
    this.router.navigate(['/products/recurring-deposits/create'], {
      queryParams: { clientId: this.clientId() },
    });
  }

  onSavingsTransaction(accountId: number, command: string) {
    this.router.navigate([`/products/savings-accounts/${accountId}/transactions/${command}`]);
  }

  onSavingsAction(accountId: number, command: string, account: Record<string, unknown>) {
    const type = resolveAccountActionType(account);
    this.router.navigate([`/products/${type}/${accountId}/action/${command}`]);
  }

  onLoanAction(loanId: number, command: string) {
    this.router.navigate([`/products/loan/${loanId}/action/${command}`]);
  }

  onLoanTransaction(loanId: number, type: string) {
    this.router.navigate([`/loans/${loanId}/transactions/${type}`]);
  }

  onBack() {
    this.router.navigate(['/clients']);
  }
}
