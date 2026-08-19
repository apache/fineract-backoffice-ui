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

import { permissionGuard } from './core/guards/permission.guard';
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './layout/main-layout.component';
import { loadRemoteModule } from '@angular-architects/native-federation';

export const routes: Routes = [
  {
    path: 'login',
    title: 'login.title',
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
        title: 'nav.dashboard',
        loadComponent: () =>
          import('./features/dashboard/system-status.component').then(
            (m) => m.SystemStatusComponent,
          ),
      },
      {
        // Where `permissionGuard` sends a user it refuses. Deliberately carries no `data.permissions`
        // of its own: a refusal that could itself be refused would loop. It stays inside the
        // authenticated shell so the user keeps the navigation and can go somewhere they are allowed.
        path: 'forbidden',
        title: 'ACCESS_DENIED.TITLE',
        loadComponent: () =>
          import('./features/errors/access-denied.component').then((m) => m.AccessDeniedComponent),
      },
      {
        path: 'fineract-mfe',
        loadComponent: () =>
          loadRemoteModule('fineract-mfe', './Component').then((m) => m.FineractMfeComponent),
      },
      {
        path: 'clients',
        canActivate: [authGuard, permissionGuard],
        data: { permissions: 'READ_CLIENT' },
        title: 'nav.clients',
        loadChildren: () =>
          import('./features/clients/clients.routes').then((m) => m.CLIENTS_ROUTES),
      },
      {
        path: 'groups',
        canActivate: [authGuard, permissionGuard],
        data: { permissions: 'READ_GROUP' },
        title: 'nav.groups',
        loadChildren: () => import('./features/groups/groups.routes').then((m) => m.GROUPS_ROUTES),
      },
      {
        path: 'centers',
        canActivate: [authGuard, permissionGuard],
        data: { permissions: 'READ_CENTER' },
        title: 'nav.centers',
        loadChildren: () =>
          import('./features/centers/centers.routes').then((m) => m.CENTERS_ROUTES),
      },
      {
        path: 'products',
        title: 'nav.products',
        loadChildren: () =>
          import('./features/products/products.routes').then((m) => m.PRODUCTS_ROUTES),
      },
      {
        path: 'fintech',
        title: 'nav.fintech',
        loadChildren: () =>
          import('./features/fintech/fintech.routes').then((m) => m.FINTECH_ROUTES),
      },
      {
        path: 'transfers',
        title: 'nav.transfers',
        loadChildren: () =>
          import('./features/transfers/transfers.routes').then((m) => m.TRANSFERS_ROUTES),
      },
      {
        path: 'accounting',
        title: 'nav.accounting',
        loadChildren: () =>
          import('./features/accounting/accounting.routes').then((m) => m.ACCOUNTING_ROUTES),
      },
      {
        path: 'security',
        title: 'nav.security',
        loadChildren: () =>
          import('./features/security/security.routes').then((m) => m.SECURITY_ROUTES),
      },
      {
        path: 'loans',
        canActivate: [authGuard, permissionGuard],
        data: { permissions: 'READ_LOAN' },
        title: 'nav.loans',
        loadChildren: () => import('./features/loans/loans.routes').then((m) => m.LOANS_ROUTES),
      },
      {
        path: 'tellers',
        title: 'nav.tellers',
        loadChildren: () =>
          import('./features/tellers/tellers.routes').then((m) => m.TELLERS_ROUTES),
      },
      {
        path: 'organization',
        title: 'nav.organization',
        loadChildren: () =>
          import('./features/organization/organization.routes').then((m) => m.ORGANIZATION_ROUTES),
      },
      {
        path: 'system',
        title: 'nav.system',
        loadChildren: () => import('./features/system/system.routes').then((m) => m.SYSTEM_ROUTES),
      },
      {
        path: 'reporting',
        canActivate: [authGuard, permissionGuard],
        data: { permissions: 'READ_REPORT' },
        title: 'nav.reporting',
        loadChildren: () =>
          import('./features/reporting/reporting.routes').then((m) => m.REPORTING_ROUTES),
      },
      {
        path: 'tasks',
        title: 'nav.tasks',
        loadChildren: () => import('./features/tasks/tasks.routes').then((m) => m.TASKS_ROUTES),
      },
      {
        path: 'settings',
        title: 'nav.settings',
        loadChildren: () =>
          import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        path: 'spm',
        loadChildren: () => import('./features/spm/spm.routes').then((m) => m.SPM_ROUTES),
      },
      {
        path: 'meetings',
        title: 'MEETINGS.TITLE',
        loadChildren: () =>
          import('./features/meetings/meetings.routes').then((m) => m.MEETINGS_ROUTES),
      },
      {
        path: 'calendars',
        title: 'CALENDARS.TITLE',
        loadChildren: () =>
          import('./features/calendars/calendars.routes').then((m) => m.CALENDARS_ROUTES),
      },
      {
        path: 'collection-sheet',
        canActivate: [authGuard, permissionGuard],
        data: { permissions: 'READ_COLLECTIONSHEET' },
        title: 'COLLECTION_SHEET.TITLE',
        loadComponent: () =>
          import('./features/collection-sheet/collection-sheet.component').then(
            (m) => m.CollectionSheetComponent,
          ),
      },
      {
        path: 'notifications',
        title: 'nav.notifications',
        loadComponent: () =>
          import('./features/notifications/notifications-list.component').then(
            (m) => m.NotificationsListComponent,
          ),
        canActivate: [authGuard],
      },
      {
        path: 'working-capital',
        title: 'nav.workingCapital',
        loadChildren: () =>
          import('./features/working-capital/working-capital.routes').then(
            (m) => m.WORKING_CAPITAL_ROUTES,
          ),
      },
      {
        path: 'search',
        title: 'SEARCH.TITLE',
        loadComponent: () =>
          import('./features/search/global-search.component').then((m) => m.GlobalSearchComponent),
      },
      {
        path: 'campaigns',
        loadChildren: () =>
          import('./features/campaigns/campaigns.routes').then((m) => m.CAMPAIGNS_ROUTES),
      },
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
      {
        path: 'interop',
        loadChildren: () =>
          import('./features/interop/interop.routes').then((m) => m.INTEROP_ROUTES),
      },
      {
        path: 'auth/forgot-password',
        title: 'FORGOT_PASSWORD.TITLE',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password.component').then(
            (m) => m.ForgotPasswordComponent,
          ),
      },
      {
        path: 'profile',
        title: 'PROFILE.TITLE',
        loadComponent: () =>
          import('./features/profile/user-profile.component').then((m) => m.UserProfileComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
