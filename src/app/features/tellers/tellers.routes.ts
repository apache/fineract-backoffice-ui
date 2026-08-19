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

export const TELLERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tellers-list.component').then((m) => m.TellersListComponent),
  },
  {
    path: 'create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_TELLER' },
    loadComponent: () => import('./teller-form.component').then((m) => m.TellerFormComponent),
  },
  {
    path: 'edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_TELLER' },
    loadComponent: () => import('./teller-form.component').then((m) => m.TellerFormComponent),
  },
  {
    path: ':tellerId/cashiers',
    loadComponent: () =>
      import('./cashiers/cashiers-list.component').then((m) => m.CashiersListComponent),
  },
  {
    path: ':tellerId/cashiers/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'ALLOCATECASHIER_TELLER' },
    loadComponent: () =>
      import('./cashiers/cashier-form.component').then((m) => m.CashierFormComponent),
  },
  // Declared after `:tellerId/cashiers/create` so the literal segment is matched before
  // `:cashierId` is allowed to capture it.
  {
    path: ':tellerId/cashiers/:cashierId/transactions',
    loadComponent: () =>
      import('./cashiers/cashier-transactions.component').then(
        (m) => m.CashierTransactionsComponent,
      ),
  },
  {
    path: ':tellerId/cashiers/:cashierId/transactions/:command',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'ALLOCATECASHTOCASHIER_TELLER' },
    loadComponent: () =>
      import('./cashiers/cashier-transaction-form.component').then(
        (m) => m.CashierTransactionFormComponent,
      ),
  },
];
