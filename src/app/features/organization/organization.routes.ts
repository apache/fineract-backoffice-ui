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
    path: 'offices',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_OFFICE' },
    loadComponent: () =>
      import('./offices/offices-list.component').then((m) => m.OfficesListComponent),
  },
  {
    path: 'offices/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_OFFICE' },
    loadComponent: () =>
      import('./offices/office-form.component').then((m) => m.OfficeFormComponent),
  },
  {
    path: 'offices/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_OFFICE' },
    loadComponent: () =>
      import('./offices/office-form.component').then((m) => m.OfficeFormComponent),
  },
  {
    path: 'offices/view/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_OFFICE' },
    loadComponent: () =>
      import('./offices/office-view.component').then((m) => m.OfficeViewComponent),
  },
  {
    path: 'funds',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_FUND' },
    loadComponent: () => import('./funds/funds-list.component').then((m) => m.FundsListComponent),
  },
  {
    path: 'funds/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_FUND' },
    loadComponent: () => import('./funds/fund-form.component').then((m) => m.FundFormComponent),
  },
  {
    path: 'funds/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_FUND' },
    loadComponent: () => import('./funds/fund-form.component').then((m) => m.FundFormComponent),
  },
  {
    path: 'payment-types',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_PAYMENTTYPE' },
    loadComponent: () =>
      import('./payment-types/payment-types-list.component').then(
        (m) => m.PaymentTypesListComponent,
      ),
  },
  {
    path: 'payment-types/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_PAYMENTTYPE' },
    loadComponent: () =>
      import('./payment-types/payment-type-form.component').then((m) => m.PaymentTypeFormComponent),
  },
  {
    path: 'payment-types/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_PAYMENTTYPE' },
    loadComponent: () =>
      import('./payment-types/payment-type-form.component').then((m) => m.PaymentTypeFormComponent),
  },
  {
    path: 'staff',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_STAFF' },
    loadComponent: () => import('./staff/staff-list.component').then((m) => m.StaffListComponent),
  },
  {
    path: 'staff/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_STAFF' },
    loadComponent: () => import('./staff/staff-form.component').then((m) => m.StaffFormComponent),
  },
  {
    path: 'staff/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_STAFF' },
    loadComponent: () => import('./staff/staff-form.component').then((m) => m.StaffFormComponent),
  },
  {
    path: 'currencies',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_CURRENCY' },
    loadComponent: () =>
      import('./currencies/currencies.component').then((m) => m.CurrenciesComponent),
  },
  {
    path: 'account-number-formats',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_ACCOUNTNUMBERFORMAT' },
    loadComponent: () =>
      import('./account-number-formats/account-number-formats-list.component').then(
        (m) => m.AccountNumberFormatsListComponent,
      ),
  },
  {
    path: 'account-number-formats/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_ACCOUNTNUMBERFORMAT' },
    loadComponent: () =>
      import('./account-number-formats/account-number-format-form.component').then(
        (m) => m.AccountNumberFormatFormComponent,
      ),
  },
  {
    path: 'account-number-formats/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_ACCOUNTNUMBERFORMAT' },
    loadComponent: () =>
      import('./account-number-formats/account-number-format-form.component').then(
        (m) => m.AccountNumberFormatFormComponent,
      ),
  },
  {
    path: 'group-levels',
    loadComponent: () =>
      import('./group-levels/group-levels-list.component').then((m) => m.GroupLevelsListComponent),
  },
  {
    path: 'office-transactions',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_OFFICETRANSACTION' },
    loadComponent: () =>
      import('./office-transactions/office-transactions-list.component').then(
        (m) => m.OfficeTransactionsListComponent,
      ),
  },
  {
    path: 'office-transactions/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_OFFICETRANSACTION' },
    loadComponent: () =>
      import('./office-transactions/office-transaction-form.component').then(
        (m) => m.OfficeTransactionFormComponent,
      ),
  },
];
