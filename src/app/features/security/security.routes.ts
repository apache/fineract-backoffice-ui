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
    loadComponent: () => import('./users/users-list.component').then((m) => m.UsersListComponent),
  },
  {
    path: 'users/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_USER' },
    loadComponent: () => import('./users/user-form.component').then((m) => m.UserFormComponent),
  },
  {
    path: 'users/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_USER' },
    loadComponent: () => import('./users/user-form.component').then((m) => m.UserFormComponent),
  },
  {
    path: 'roles',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_ROLE' },
    loadComponent: () => import('./roles/roles-list.component').then((m) => m.RolesListComponent),
  },
  {
    path: 'roles/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_ROLE' },
    loadComponent: () => import('./roles/role-form.component').then((m) => m.RoleFormComponent),
  },
  {
    path: 'roles/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_ROLE' },
    loadComponent: () => import('./roles/role-form.component').then((m) => m.RoleFormComponent),
  },
  {
    path: 'audits',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_AUDIT' },
    loadComponent: () =>
      import('./audit-logs/audit-logs-list.component').then((m) => m.AuditLogsListComponent),
  },
];
