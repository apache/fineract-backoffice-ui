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

import { permissionGuard } from '../../core/guards/permission.guard';
import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const LOANS_ROUTES: Routes = [
  {
    path: ':loanId/charges',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_LOAN' },
    loadComponent: () =>
      import('./charges/loan-charges-list.component').then((m) => m.LoanChargesListComponent),
  },
  {
    path: ':loanId/charges/add',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_LOANCHARGE' },
    loadComponent: () =>
      import('./charges/loan-charge-form.component').then((m) => m.LoanChargeFormComponent),
  },
  {
    path: ':loanId/rescheduling',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_RESCHEDULELOAN' },
    loadComponent: () =>
      import('./rescheduling/reschedule-requests-list.component').then(
        (m) => m.RescheduleRequestsListComponent,
      ),
  },
  {
    path: ':loanId/rescheduling/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_RESCHEDULELOAN' },
    loadComponent: () =>
      import('./rescheduling/reschedule-form.component').then((m) => m.RescheduleFormComponent),
  },
  {
    path: '',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_LOAN' },
    loadComponent: () => import('./loans-list.component').then((m) => m.LoansListComponent),
  },
  {
    path: 'create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_LOAN' },
    loadComponent: () => import('./loan-form.component').then((m) => m.LoanFormComponent),
  },
  {
    path: 'edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_LOAN' },
    loadComponent: () => import('./loan-form.component').then((m) => m.LoanFormComponent),
  },
  {
    path: 'view/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_LOAN' },
    loadComponent: () => import('./loan-view.component').then((m) => m.LoanViewComponent),
  },
  {
    path: ':loanId/collateral',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_COLLATERAL' },
    loadComponent: () =>
      import('./collateral/collateral-list.component').then((m) => m.CollateralListComponent),
  },
  {
    path: ':loanId/collateral/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_COLLATERAL' },
    loadComponent: () =>
      import('./collateral/collateral-form.component').then((m) => m.CollateralFormComponent),
  },
  {
    path: ':loanId/collateral/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_COLLATERAL' },
    loadComponent: () =>
      import('./collateral/collateral-form.component').then((m) => m.CollateralFormComponent),
  },
  {
    path: ':loanId/transactions/:type',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_LOAN' },
    loadComponent: () =>
      import('./loan-transaction-form.component').then((m) => m.LoanTransactionFormComponent),
  },
  {
    path: 'bulk-reassignment',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'BULKREASSIGN_LOAN' },
    loadComponent: () =>
      import('./bulk-reassignment/bulk-loan-reassignment.component').then(
        (m) => m.BulkLoanReassignmentComponent,
      ),
  },
  {
    path: 'point-in-time',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_LOAN' },
    loadComponent: () =>
      import('./point-in-time/loans-point-in-time.component').then(
        (m) => m.LoansPointInTimeComponent,
      ),
  },
  {
    path: ':loanId/guarantors',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_GUARANTOR' },
    loadComponent: () =>
      import('./guarantors/guarantors-list.component').then((m) => m.GuarantorsListComponent),
  },
  {
    path: ':loanId/guarantors/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_GUARANTOR' },
    loadComponent: () =>
      import('./guarantors/guarantor-form.component').then((m) => m.GuarantorFormComponent),
  },
  {
    path: ':loanId/guarantors/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_GUARANTOR' },
    loadComponent: () =>
      import('./guarantors/guarantor-form.component').then((m) => m.GuarantorFormComponent),
  },
  {
    path: ':loanId/interest-pauses',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_LOAN' },
    loadComponent: () =>
      import('./interest-pauses/interest-pauses-list.component').then(
        (m) => m.InterestPausesListComponent,
      ),
  },
  {
    path: ':loanId/interest-pauses/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_INTEREST_PAUSE' },
    loadComponent: () =>
      import('./interest-pauses/interest-pause-form.component').then(
        (m) => m.InterestPauseFormComponent,
      ),
  },
  {
    path: ':loanId/post-dated-checks',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_LOAN' },
    loadComponent: () =>
      import('./post-dated-checks/post-dated-checks-list.component').then(
        (m) => m.PostDatedChecksListComponent,
      ),
  },
  {
    path: ':loanId/post-dated-checks/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_REPAYMENT_WITH_POSTDATEDCHECKS' },
    loadComponent: () =>
      import('./post-dated-checks/post-dated-check-form.component').then(
        (m) => m.PostDatedCheckFormComponent,
      ),
  },
  {
    path: 'account-locks',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_LOAN' },
    loadComponent: () =>
      import('./loan-account-lock/loan-account-lock.component').then(
        (m) => m.LoanAccountLockComponent,
      ),
  },
  {
    path: 'cob-catchup',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'EXECUTEJOB_SCHEDULER' },
    loadComponent: () =>
      import('./cob-catchup/loan-cob-catchup.component').then((m) => m.LoanCobCatchupComponent),
  },
  {
    path: 'schedule-modify',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_LOAN' },
    loadComponent: () =>
      import('./loan-schedule-modify/loan-schedule-modify.component').then(
        (m) => m.LoanScheduleModifyComponent,
      ),
  },
];
