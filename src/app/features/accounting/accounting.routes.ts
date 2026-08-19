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

export const ACCOUNTING_ROUTES: Routes = [
  {
    path: 'chart-of-accounts',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_GLACCOUNT' },
    loadComponent: () =>
      import('./chart-of-accounts.component').then((m) => m.ChartOfAccountsComponent),
  },
  {
    path: 'chart-of-accounts/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_GLACCOUNT' },
    loadComponent: () =>
      import('./gl-account-form.component').then((m) => m.GLAccountFormComponent),
  },
  {
    path: 'chart-of-accounts/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_GLACCOUNT' },
    loadComponent: () =>
      import('./gl-account-form.component').then((m) => m.GLAccountFormComponent),
  },
  {
    path: 'journal-entries',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_JOURNALENTRY' },
    loadComponent: () =>
      import('./journal-entries-list.component').then((m) => m.JournalEntriesListComponent),
  },
  {
    path: 'journal-entries/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_JOURNALENTRY' },
    loadComponent: () =>
      import('./journal-entry-form.component').then((m) => m.JournalEntryFormComponent),
  },
  {
    path: 'journal-entries/view/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_JOURNALENTRY' },
    loadComponent: () =>
      import('./journal-entry-view.component').then((m) => m.JournalEntryViewComponent),
  },
  {
    path: 'frequent-postings',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_JOURNALENTRY' },
    loadComponent: () =>
      import('./frequent-postings.component').then((m) => m.FrequentPostingsComponent),
  },
  {
    path: 'opening-balances',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'DEFINEOPENINGBALANCE_JOURNALENTRY' },
    loadComponent: () =>
      import('./opening-balances.component').then((m) => m.OpeningBalancesComponent),
  },
  {
    path: 'closures',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_GLCLOSURE' },
    loadComponent: () =>
      import('./accounting-closures-list.component').then((m) => m.AccountingClosuresListComponent),
  },
  {
    path: 'closures/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_GLCLOSURE' },
    loadComponent: () =>
      import('./accounting-closure-form.component').then((m) => m.AccountingClosureFormComponent),
  },
  {
    path: 'rules',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_ACCOUNTINGRULE' },
    loadComponent: () =>
      import('./accounting-rules-list.component').then((m) => m.AccountingRulesListComponent),
  },
  {
    path: 'rules/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_ACCOUNTINGRULE' },
    loadComponent: () =>
      import('./accounting-rule-form.component').then((m) => m.AccountingRuleFormComponent),
  },
  {
    path: 'rules/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_ACCOUNTINGRULE' },
    loadComponent: () =>
      import('./accounting-rule-form.component').then((m) => m.AccountingRuleFormComponent),
  },
  {
    path: 'financial-activity-mappings',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_FINANCIALACTIVITYACCOUNT' },
    loadComponent: () =>
      import('./financial-activity-mappings-list.component').then(
        (m) => m.FinancialActivityMappingsListComponent,
      ),
  },
  {
    path: 'financial-activity-mappings/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_FINANCIALACTIVITYACCOUNT' },
    loadComponent: () =>
      import('./financial-activity-mapping-form.component').then(
        (m) => m.FinancialActivityMappingFormComponent,
      ),
  },
  {
    path: 'financial-activity-mappings/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_FINANCIALACTIVITYACCOUNT' },
    loadComponent: () =>
      import('./financial-activity-mapping-form.component').then(
        (m) => m.FinancialActivityMappingFormComponent,
      ),
  },
  {
    path: 'charges',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_CHARGE' },
    loadComponent: () =>
      import('./charges/charges-list.component').then((m) => m.ChargesListComponent),
  },
  {
    path: 'charges/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_CHARGE' },
    loadComponent: () =>
      import('./charges/charge-form.component').then((m) => m.ChargeFormComponent),
  },
  {
    path: 'charges/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_CHARGE' },
    loadComponent: () =>
      import('./charges/charge-form.component').then((m) => m.ChargeFormComponent),
  },
  {
    path: 'provisioning-categories',
    loadComponent: () =>
      import('./provisioning-categories/provisioning-categories-list.component').then(
        (m) => m.ProvisioningCategoriesListComponent,
      ),
  },
  {
    path: 'provisioning-categories/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_PROVISIONCATEGORY' },
    loadComponent: () =>
      import('./provisioning-categories/provisioning-categories-form.component').then(
        (m) => m.ProvisioningCategoriesFormComponent,
      ),
  },
  {
    path: 'provisioning-categories/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_PROVISIONCATEGORY' },
    loadComponent: () =>
      import('./provisioning-categories/provisioning-categories-form.component').then(
        (m) => m.ProvisioningCategoriesFormComponent,
      ),
  },
  {
    path: 'provisioning-criteria',
    loadComponent: () =>
      import('./provisioning-criteria/provisioning-criteria-list.component').then(
        (m) => m.ProvisioningCriteriaListComponent,
      ),
  },
  {
    path: 'provisioning-criteria/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_PROVISIONCRITERIA' },
    loadComponent: () =>
      import('./provisioning-criteria/provisioning-criteria-form.component').then(
        (m) => m.ProvisioningCriteriaFormComponent,
      ),
  },
  {
    path: 'provisioning-criteria/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_PROVISIONCRITERIA' },
    loadComponent: () =>
      import('./provisioning-criteria/provisioning-criteria-form.component').then(
        (m) => m.ProvisioningCriteriaFormComponent,
      ),
  },
  {
    path: 'provisioning-entries',
    loadComponent: () =>
      import('./provisioning-entries/provisioning-entries-list.component').then(
        (m) => m.ProvisioningEntriesListComponent,
      ),
  },
  {
    path: 'provisioning-entries/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_PROVISIONENTRIES' },
    loadComponent: () =>
      import('./provisioning-entries/provisioning-entries-form.component').then(
        (m) => m.ProvisioningEntriesFormComponent,
      ),
  },
  {
    path: 'run-accruals',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'EXECUTEJOB_SCHEDULER' },
    loadComponent: () =>
      import('./run-accruals/run-accruals.component').then((m) => m.RunAccrualsComponent),
  },
];
