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

export const SECURITY_ROUTES: Routes = [
  {
    path: 'users',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_USER' },
    title: 'nav.users',
    loadComponent: () => import('./users/users-list.component').then((m) => m.UsersListComponent),
  },
  {
    path: 'users/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_USER' },
    title: 'USERS.CREATE_USER',
    loadComponent: () => import('./users/user-form.component').then((m) => m.UserFormComponent),
  },
  {
    path: 'users/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_USER' },
    title: 'USERS.EDIT_USER',
    loadComponent: () => import('./users/user-form.component').then((m) => m.UserFormComponent),
  },
  {
    path: 'roles',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_ROLE' },
    title: 'nav.roles',
    loadComponent: () => import('./roles/roles-list.component').then((m) => m.RolesListComponent),
  },
  {
    path: 'roles/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_ROLE' },
    title: 'ROLES.CREATE_ROLE',
    loadComponent: () => import('./roles/role-form.component').then((m) => m.RoleFormComponent),
  },
  {
    path: 'roles/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_ROLE' },
    title: 'ROLES.EDIT_ROLE',
    loadComponent: () => import('./roles/role-form.component').then((m) => m.RoleFormComponent),
  },
  {
    path: 'audits',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_AUDIT' },
    title: 'SECURITY.AUDIT_LOGS',
    loadComponent: () =>
      import('./audit-logs/audit-logs-list.component').then((m) => m.AuditLogsListComponent),
  },
  {
    // The payload can carry personal data from any user's request, so the entry is gated
    // exactly like the list. ALL_FUNCTIONS_READ satisfies it as it does every READ_ code.
    path: 'audits/:auditId',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_AUDIT' },
    title: 'AUDIT.ENTRY_DETAIL',
    loadComponent: () =>
      import('./audit-logs/audit-entry-view.component').then((m) => m.AuditEntryViewComponent),
  },
  {
    // Leftover bookmarks and docs used this path. Without an alias the catch-all
    // dumped people on the dashboard with no explanation.
    path: 'audit-trails',
    redirectTo: 'audits',
    pathMatch: 'full',
  },
];
