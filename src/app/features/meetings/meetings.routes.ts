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

export const MEETINGS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/dashboard',
  },
  {
    path: ':entityType/:entityId',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_MEETING' },
    loadComponent: () => import('./meetings-list.component').then((m) => m.MeetingsListComponent),
  },
  {
    path: ':entityType/:entityId/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_MEETING' },
    loadComponent: () => import('./meeting-form.component').then((m) => m.MeetingFormComponent),
  },
  {
    path: ':entityType/:entityId/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_MEETING' },
    loadComponent: () => import('./meeting-form.component').then((m) => m.MeetingFormComponent),
  },
];
