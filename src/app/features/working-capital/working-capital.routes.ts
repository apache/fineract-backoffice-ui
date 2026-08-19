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

import { authGuard } from '../../core/guards/auth.guard';
import { permissionGuard } from '../../core/guards/permission.guard';
import { Routes } from '@angular/router';
import { developerToolsGuard } from '../../core/guards/developer-tools.guard';

export const WORKING_CAPITAL_ROUTES: Routes = [
  {
    path: 'breach',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_WORKINGCAPITALBREACH' },
    loadComponent: () =>
      import('./breach/wc-breach-list.component').then((m) => m.WcBreachListComponent),
  },
  {
    path: 'breach/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_WORKINGCAPITALBREACH' },
    loadComponent: () =>
      import('./breach/wc-breach-form.component').then((m) => m.WcBreachFormComponent),
  },
  {
    path: 'breach/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_WORKINGCAPITALBREACH' },
    loadComponent: () =>
      import('./breach/wc-breach-form.component').then((m) => m.WcBreachFormComponent),
  },
  {
    path: 'near-breach',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_WORKINGCAPITALNEARBREACH' },
    loadComponent: () =>
      import('./near-breach/wc-near-breach-list.component').then(
        (m) => m.WcNearBreachListComponent,
      ),
  },
  {
    path: 'near-breach/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_WORKINGCAPITALNEARBREACH' },
    loadComponent: () =>
      import('./near-breach/wc-near-breach-form.component').then(
        (m) => m.WcNearBreachFormComponent,
      ),
  },
  {
    path: 'near-breach/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_WORKINGCAPITALNEARBREACH' },
    loadComponent: () =>
      import('./near-breach/wc-near-breach-form.component').then(
        (m) => m.WcNearBreachFormComponent,
      ),
  },
  {
    path: 'loan-products',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_WORKINGCAPITALLOANPRODUCT' },
    loadComponent: () =>
      import('./loan-products/wc-loan-products-list.component').then(
        (m) => m.WcLoanProductsListComponent,
      ),
  },
  {
    path: 'loan-products/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_WORKINGCAPITALLOANPRODUCT' },
    loadComponent: () =>
      import('./loan-products/wc-loan-product-form.component').then(
        (m) => m.WcLoanProductFormComponent,
      ),
  },
  {
    path: 'loan-products/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_WORKINGCAPITALLOANPRODUCT' },
    loadComponent: () =>
      import('./loan-products/wc-loan-product-form.component').then(
        (m) => m.WcLoanProductFormComponent,
      ),
  },
  {
    path: 'loans',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_WORKINGCAPITALLOAN' },
    loadComponent: () =>
      import('./loans/wc-loans-list.component').then((m) => m.WcLoansListComponent),
  },
  {
    path: 'loans/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_WORKINGCAPITALLOAN' },
    loadComponent: () =>
      import('./loans/wc-loan-form.component').then((m) => m.WcLoanFormComponent),
  },
  {
    path: 'loans/view/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_WORKINGCAPITALLOAN' },
    loadComponent: () =>
      import('./loans/wc-loan-view.component').then((m) => m.WcLoanViewComponent),
  },
  {
    path: 'loans/:id/action/:command',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_WORKINGCAPITALLOAN' },
    loadComponent: () =>
      import('./loans/wc-loan-action-form.component').then((m) => m.WcLoanActionFormComponent),
  },
  {
    path: 'loans/account-locks',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_WORKINGCAPITALLOAN' },
    canMatch: [developerToolsGuard],
    loadComponent: () =>
      import('./loans/wc-account-lock/wc-loan-account-lock.component').then(
        (m) => m.WcLoanAccountLockComponent,
      ),
  },
  {
    path: 'loans/cob-catchup',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'EXECUTEJOB_SCHEDULER' },
    loadComponent: () =>
      import('./loans/wc-cob-catchup/wc-loan-cob-catchup.component').then(
        (m) => m.WcLoanCobCatchupComponent,
      ),
  },
];
