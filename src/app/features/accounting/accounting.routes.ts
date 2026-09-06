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
    path: '',
    redirectTo: 'chart-of-accounts',
    pathMatch: 'full',
  },
  {
    path: 'chart-of-accounts',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_GLACCOUNT' },
    title: 'nav.chartOfAccounts',
    loadComponent: () =>
      import('./chart-of-accounts.component').then((m) => m.ChartOfAccountsComponent),
  },
  {
    path: 'chart-of-accounts/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_GLACCOUNT' },
    title: 'ACCOUNTING.CREATE_GL_ACCOUNT',
    loadComponent: () =>
      import('./gl-account-form.component').then((m) => m.GLAccountFormComponent),
  },
  {
    path: 'chart-of-accounts/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_GLACCOUNT' },
    title: 'ACCOUNTING.EDIT_GL_ACCOUNT',
    loadComponent: () =>
      import('./gl-account-form.component').then((m) => m.GLAccountFormComponent),
  },
  {
    path: 'journal-entries',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_JOURNALENTRY' },
    title: 'nav.journalEntries',
    loadComponent: () =>
      import('./journal-entries-list.component').then((m) => m.JournalEntriesListComponent),
  },
  {
    path: 'journal-entries/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_JOURNALENTRY' },
    title: 'JOURNAL_ENTRIES.CREATE',
    loadComponent: () =>
      import('./journal-entry-form.component').then((m) => m.JournalEntryFormComponent),
  },
  {
    path: 'journal-entries/view/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_JOURNALENTRY' },
    title: 'JOURNAL_ENTRIES.TRANSACTION',
    loadComponent: () =>
      import('./journal-entry-view.component').then((m) => m.JournalEntryViewComponent),
  },
  {
    path: 'frequent-postings',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_JOURNALENTRY' },
    title: 'FREQUENT_POSTINGS.TITLE',
    loadComponent: () =>
      import('./frequent-postings.component').then((m) => m.FrequentPostingsComponent),
  },
  {
    path: 'opening-balances',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'DEFINEOPENINGBALANCE_JOURNALENTRY' },
    title: 'OPENING_BALANCES.TITLE',
    loadComponent: () =>
      import('./opening-balances.component').then((m) => m.OpeningBalancesComponent),
  },
  {
    path: 'closures',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_GLCLOSURE' },
    title: 'nav.accountingClosures',
    loadComponent: () =>
      import('./accounting-closures-list.component').then((m) => m.AccountingClosuresListComponent),
  },
  {
    path: 'closures/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_GLCLOSURE' },
    title: 'ACCOUNTING_CLOSURES.CREATE',
    loadComponent: () =>
      import('./accounting-closure-form.component').then((m) => m.AccountingClosureFormComponent),
  },
  {
    path: 'rules',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_ACCOUNTINGRULE' },
    title: 'nav.accountingRules',
    loadComponent: () =>
      import('./accounting-rules-list.component').then((m) => m.AccountingRulesListComponent),
  },
  {
    path: 'rules/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_ACCOUNTINGRULE' },
    title: 'ACCOUNTING_RULES.CREATE',
    loadComponent: () =>
      import('./accounting-rule-form.component').then((m) => m.AccountingRuleFormComponent),
  },
  {
    path: 'rules/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_ACCOUNTINGRULE' },
    title: 'ACCOUNTING_RULES.EDIT',
    loadComponent: () =>
      import('./accounting-rule-form.component').then((m) => m.AccountingRuleFormComponent),
  },
  {
    path: 'financial-activity-mappings',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_FINANCIALACTIVITYACCOUNT' },
    title: 'nav.financialActivityMappings',
    loadComponent: () =>
      import('./financial-activity-mappings-list.component').then(
        (m) => m.FinancialActivityMappingsListComponent,
      ),
  },
  {
    path: 'financial-activity-mappings/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_FINANCIALACTIVITYACCOUNT' },
    title: 'ACCOUNTING.DEFINE_MAPPING',
    loadComponent: () =>
      import('./financial-activity-mapping-form.component').then(
        (m) => m.FinancialActivityMappingFormComponent,
      ),
  },
  {
    path: 'financial-activity-mappings/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_FINANCIALACTIVITYACCOUNT' },
    title: 'ACCOUNTING.EDIT_MAPPING',
    loadComponent: () =>
      import('./financial-activity-mapping-form.component').then(
        (m) => m.FinancialActivityMappingFormComponent,
      ),
  },
  {
    path: 'charges',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_CHARGE' },
    title: 'nav.charges',
    loadComponent: () =>
      import('./charges/charges-list.component').then((m) => m.ChargesListComponent),
  },
  {
    path: 'charges/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_CHARGE' },
    title: 'CHARGES.CREATE',
    loadComponent: () =>
      import('./charges/charge-form.component').then((m) => m.ChargeFormComponent),
  },
  {
    path: 'charges/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_CHARGE' },
    title: 'CHARGES.EDIT',
    loadComponent: () =>
      import('./charges/charge-form.component').then((m) => m.ChargeFormComponent),
  },
  {
    path: 'provisioning-categories',
    title: 'nav.provisioningCategories',
    loadComponent: () =>
      import('./provisioning-categories/provisioning-categories-list.component').then(
        (m) => m.ProvisioningCategoriesListComponent,
      ),
  },
  {
    path: 'provisioning-categories/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_PROVISIONCATEGORY' },
    title: 'PROVISIONING_CATEGORIES.CREATE',
    loadComponent: () =>
      import('./provisioning-categories/provisioning-categories-form.component').then(
        (m) => m.ProvisioningCategoriesFormComponent,
      ),
  },
  {
    path: 'provisioning-categories/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_PROVISIONCATEGORY' },
    title: 'PROVISIONING_CATEGORIES.EDIT',
    loadComponent: () =>
      import('./provisioning-categories/provisioning-categories-form.component').then(
        (m) => m.ProvisioningCategoriesFormComponent,
      ),
  },
  {
    path: 'provisioning-criteria',
    title: 'nav.provisioningCriteria',
    loadComponent: () =>
      import('./provisioning-criteria/provisioning-criteria-list.component').then(
        (m) => m.ProvisioningCriteriaListComponent,
      ),
  },
  {
    path: 'provisioning-criteria/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_PROVISIONCRITERIA' },
    title: 'PROVISIONING_CRITERIA.CREATE',
    loadComponent: () =>
      import('./provisioning-criteria/provisioning-criteria-form.component').then(
        (m) => m.ProvisioningCriteriaFormComponent,
      ),
  },
  {
    path: 'provisioning-criteria/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_PROVISIONCRITERIA' },
    title: 'PROVISIONING_CRITERIA.EDIT',
    loadComponent: () =>
      import('./provisioning-criteria/provisioning-criteria-form.component').then(
        (m) => m.ProvisioningCriteriaFormComponent,
      ),
  },
  {
    path: 'provisioning-entries',
    title: 'nav.provisioningEntries',
    loadComponent: () =>
      import('./provisioning-entries/provisioning-entries-list.component').then(
        (m) => m.ProvisioningEntriesListComponent,
      ),
  },
  {
    path: 'provisioning-entries/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_PROVISIONENTRIES' },
    title: 'PROVISIONING_ENTRIES.CREATE',
    loadComponent: () =>
      import('./provisioning-entries/provisioning-entries-form.component').then(
        (m) => m.ProvisioningEntriesFormComponent,
      ),
  },
  {
    path: 'run-accruals',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'EXECUTEJOB_SCHEDULER' },
    title: 'RUN_ACCRUALS.TITLE',
    loadComponent: () =>
      import('./run-accruals/run-accruals.component').then((m) => m.RunAccrualsComponent),
  },
];
