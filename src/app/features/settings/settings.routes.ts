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

export const SETTINGS_ROUTES: Routes = [
  {
    path: 'configurations',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_CONFIGURATION' },
    loadComponent: () =>
      import('./global-configurations.component').then((m) => m.GlobalConfigurationsListComponent),
  },
  {
    path: 'holidays',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_HOLIDAY' },
    loadComponent: () => import('./holidays-list.component').then((m) => m.HolidaysListComponent),
  },
  {
    path: 'holidays/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_HOLIDAY' },
    loadComponent: () => import('./holiday-form.component').then((m) => m.HolidayFormComponent),
  },
  {
    path: 'working-days',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_WORKINGDAYS' },
    loadComponent: () => import('./working-days.component').then((m) => m.WorkingDaysComponent),
  },
  {
    path: 'two-factor',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_TWOFACTOR_CONFIGURATION' },
    loadComponent: () =>
      import('./two-factor-config.component').then((m) => m.TwoFactorConfigComponent),
  },
];
