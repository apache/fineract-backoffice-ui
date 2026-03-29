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

import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './layout/main-layout.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/system-status.component').then(
            (m) => m.SystemStatusComponent,
          ),
      },
      {
        path: 'features/clients',
        loadComponent: () =>
          import('./features/clients/clients.component').then((m) => m.ClientsComponent),
      },
      {
        path: 'features/loans',
        loadComponent: () => import('./features/loans/loans.component').then((m) => m.LoansComponent),
      },
      {
        path: 'features/organization',
        loadComponent: () =>
          import('./features/organization/organization.component').then(
            (m) => m.OrganizationComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
