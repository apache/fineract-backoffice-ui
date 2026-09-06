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

export const ORGANIZATION_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'offices',
    pathMatch: 'full',
  },
  {
    path: 'offices',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_OFFICE' },
    title: 'nav.offices',
    loadComponent: () =>
      import('./offices/offices-list.component').then((m) => m.OfficesListComponent),
  },
  {
    path: 'offices/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_OFFICE' },
    title: 'OFFICES.CREATE_OFFICE',
    loadComponent: () =>
      import('./offices/office-form.component').then((m) => m.OfficeFormComponent),
  },
  {
    path: 'offices/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_OFFICE' },
    title: 'OFFICES.EDIT_OFFICE',
    loadComponent: () =>
      import('./offices/office-form.component').then((m) => m.OfficeFormComponent),
  },
  {
    path: 'offices/view/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_OFFICE' },
    title: 'nav.offices',
    loadComponent: () =>
      import('./offices/office-view.component').then((m) => m.OfficeViewComponent),
  },
  {
    path: 'funds',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_FUND' },
    title: 'nav.funds',
    loadComponent: () => import('./funds/funds-list.component').then((m) => m.FundsListComponent),
  },
  {
    path: 'funds/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_FUND' },
    title: 'FUNDS.CREATE_FUND',
    loadComponent: () => import('./funds/fund-form.component').then((m) => m.FundFormComponent),
  },
  {
    path: 'funds/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_FUND' },
    title: 'FUNDS.EDIT_FUND',
    loadComponent: () => import('./funds/fund-form.component').then((m) => m.FundFormComponent),
  },
  {
    path: 'payment-types',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_PAYMENTTYPE' },
    title: 'nav.paymentTypes',
    loadComponent: () =>
      import('./payment-types/payment-types-list.component').then(
        (m) => m.PaymentTypesListComponent,
      ),
  },
  {
    path: 'payment-types/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_PAYMENTTYPE' },
    title: 'PAYMENT_TYPES.CREATE',
    loadComponent: () =>
      import('./payment-types/payment-type-form.component').then((m) => m.PaymentTypeFormComponent),
  },
  {
    path: 'payment-types/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_PAYMENTTYPE' },
    title: 'PAYMENT_TYPES.EDIT',
    loadComponent: () =>
      import('./payment-types/payment-type-form.component').then((m) => m.PaymentTypeFormComponent),
  },
  {
    path: 'staff',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_STAFF' },
    title: 'ORGANIZATION.STAFF',
    loadComponent: () => import('./staff/staff-list.component').then((m) => m.StaffListComponent),
  },
  {
    path: 'staff/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_STAFF' },
    title: 'ORGANIZATION.CREATE_STAFF',
    loadComponent: () => import('./staff/staff-form.component').then((m) => m.StaffFormComponent),
  },
  {
    path: 'staff/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_STAFF' },
    title: 'ORGANIZATION.EDIT_STAFF',
    loadComponent: () => import('./staff/staff-form.component').then((m) => m.StaffFormComponent),
  },
  {
    path: 'currencies',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_CURRENCY' },
    title: 'CURRENCIES.TITLE',
    loadComponent: () =>
      import('./currencies/currencies.component').then((m) => m.CurrenciesComponent),
  },
  {
    path: 'account-number-formats',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_ACCOUNTNUMBERFORMAT' },
    title: 'ACCOUNT_NUMBER_FORMATS.TITLE',
    loadComponent: () =>
      import('./account-number-formats/account-number-formats-list.component').then(
        (m) => m.AccountNumberFormatsListComponent,
      ),
  },
  {
    path: 'account-number-formats/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_ACCOUNTNUMBERFORMAT' },
    title: 'ACCOUNT_NUMBER_FORMATS.CREATE_TITLE',
    loadComponent: () =>
      import('./account-number-formats/account-number-format-form.component').then(
        (m) => m.AccountNumberFormatFormComponent,
      ),
  },
  {
    path: 'account-number-formats/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_ACCOUNTNUMBERFORMAT' },
    title: 'ACCOUNT_NUMBER_FORMATS.EDIT_TITLE',
    loadComponent: () =>
      import('./account-number-formats/account-number-format-form.component').then(
        (m) => m.AccountNumberFormatFormComponent,
      ),
  },
  {
    path: 'group-levels',
    title: 'nav.groupLevels',
    loadComponent: () =>
      import('./group-levels/group-levels-list.component').then((m) => m.GroupLevelsListComponent),
  },
  {
    path: 'office-transactions',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_OFFICETRANSACTION' },
    title: 'OFFICE_TRANSACTIONS.TITLE',
    loadComponent: () =>
      import('./office-transactions/office-transactions-list.component').then(
        (m) => m.OfficeTransactionsListComponent,
      ),
  },
  {
    path: 'office-transactions/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_OFFICETRANSACTION' },
    title: 'OFFICE_TRANSACTIONS.CREATE',
    loadComponent: () =>
      import('./office-transactions/office-transaction-form.component').then(
        (m) => m.OfficeTransactionFormComponent,
      ),
  },
  {
    path: 'loan-portfolio-summary',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_LOAN' },
    title: 'ORGANIZATION.LOAN_PORTFOLIO_SUMMARY',
    loadComponent: () =>
      import('./loan-portfolio-summary/loan-portfolio-summary.component').then(
        (m) => m.LoanPortfolioSummaryComponent,
      ),
  },
];
