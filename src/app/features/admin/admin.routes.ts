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

export const ADMIN_ROUTES: Routes = [
  {
    path: 'batch-operations',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'ALL_FUNCTIONS' },
    loadComponent: () =>
      import('./batch-operations/batch-operations.component').then(
        (m) => m.BatchOperationsComponent,
      ),
  },
  {
    path: 'inline-job',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'EXECUTEJOB_SCHEDULER' },
    loadComponent: () =>
      import('./inline-job/inline-job.component').then((m) => m.InlineJobComponent),
  },
  {
    path: 'cob-tools',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'EXECUTEJOB_SCHEDULER' },
    canMatch: [developerToolsGuard],
    loadComponent: () => import('./cob-tools/cob-tools.component').then((m) => m.CobToolsComponent),
  },
  {
    path: 'wc-cob-tools',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'EXECUTEJOB_SCHEDULER' },
    canMatch: [developerToolsGuard],
    loadComponent: () =>
      import('./wc-cob-tools/wc-cob-tools.component').then((m) => m.WcCobToolsComponent),
  },
  {
    path: 'external-events',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_EXTERNAL_EVENT_CONFIGURATION' },
    canMatch: [developerToolsGuard],
    loadComponent: () =>
      import('./external-events/external-events.component').then((m) => m.ExternalEventsComponent),
  },
  {
    path: 'progressive-loan',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_LOANPRODUCT' },
    canMatch: [developerToolsGuard],
    loadComponent: () =>
      import('./progressive-loan/progressive-loan-model.component').then(
        (m) => m.ProgressiveLoanModelComponent,
      ),
  },
];
