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

export const INTEROP_ROUTES: Routes = [
  {
    path: 'parties',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_INTERID' },
    loadComponent: () =>
      import('./interop-party-lookup.component').then((m) => m.InteropPartyLookupComponent),
  },
  {
    path: 'accounts',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_INTERID' },
    loadComponent: () =>
      import('./interop-account-view.component').then((m) => m.InteropAccountViewComponent),
  },
  {
    path: 'quotes',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_INTERQUOTE' },
    loadComponent: () => import('./interop-quotes.component').then((m) => m.InteropQuotesComponent),
  },
  {
    path: 'transfers',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_INTERTRANSFER' },
    loadComponent: () =>
      import('./interop-transfers.component').then((m) => m.InteropTransfersComponent),
  },
  {
    path: 'health',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_INTERID' },
    loadComponent: () => import('./interop-health.component').then((m) => m.InteropHealthComponent),
  },
];
