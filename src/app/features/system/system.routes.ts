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

import { permissionGuard } from '../../core/guards/permission.guard';
import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const SYSTEM_ROUTES: Routes = [
  {
    path: 'data-tables',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_DATATABLE' },
    title: 'SYSTEM.DATA_TABLES',
    loadComponent: () =>
      import('./data-tables/datatables-list.component').then((m) => m.DatatablesListComponent),
  },
  {
    path: 'data-tables/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_DATATABLE' },
    title: 'SYSTEM.CREATE_DATA_TABLE',
    loadComponent: () =>
      import('./data-tables/datatables-form.component').then((m) => m.DatatablesFormComponent),
  },
  {
    path: 'data-tables/edit/:name',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_DATATABLE' },
    title: 'SYSTEM.EDIT_DATA_TABLE',
    loadComponent: () =>
      import('./data-tables/datatables-form.component').then((m) => m.DatatablesFormComponent),
  },
  {
    path: 'codes',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_CODE' },
    title: 'CODES.TITLE',
    loadComponent: () => import('./codes/codes-list.component').then((m) => m.CodesListComponent),
  },
  {
    path: 'codes/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_CODE' },
    title: 'CODES.CREATE_TITLE',
    loadComponent: () => import('./codes/code-form.component').then((m) => m.CodeFormComponent),
  },
  {
    path: 'codes/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_CODE' },
    title: 'CODES.EDIT_TITLE',
    loadComponent: () => import('./codes/code-form.component').then((m) => m.CodeFormComponent),
  },
  {
    path: 'codes/:codeId/values',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_CODEVALUE' },
    title: 'CODE_VALUES.TITLE',
    loadComponent: () =>
      import('./codes/code-values-list.component').then((m) => m.CodeValuesListComponent),
  },
  {
    path: 'codes/:codeId/values/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_CODEVALUE' },
    title: 'CODE_VALUES.CREATE_TITLE',
    loadComponent: () =>
      import('./codes/code-value-form.component').then((m) => m.CodeValueFormComponent),
  },
  {
    path: 'codes/:codeId/values/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_CODEVALUE' },
    title: 'CODE_VALUES.EDIT_TITLE',
    loadComponent: () =>
      import('./codes/code-value-form.component').then((m) => m.CodeValueFormComponent),
  },
  {
    path: 'business-dates',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_BUSINESS_DATE' },
    title: 'BUSINESS_DATES.TITLE',
    loadComponent: () =>
      import('./business-dates/business-dates.component').then((m) => m.BusinessDatesComponent),
  },
  {
    path: 'templates',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_TEMPLATE' },
    title: 'TEMPLATES.TITLE',
    loadComponent: () =>
      import('./templates/templates-list.component').then((m) => m.TemplatesListComponent),
  },
  {
    path: 'templates/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_TEMPLATE' },
    title: 'TEMPLATES.CREATE_TITLE',
    loadComponent: () =>
      import('./templates/template-form.component').then((m) => m.TemplateFormComponent),
  },
  {
    path: 'templates/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_TEMPLATE' },
    title: 'TEMPLATES.EDIT_TITLE',
    loadComponent: () =>
      import('./templates/template-form.component').then((m) => m.TemplateFormComponent),
  },
  {
    path: 'bulk-import',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_IMPORT' },
    title: 'SYSTEM.BULK_IMPORT',
    loadComponent: () =>
      import('./bulk-import/bulk-import.component').then((m) => m.BulkImportComponent),
  },
  {
    path: 'delinquency',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_DELINQUENCY_BUCKET' },
    title: 'nav.delinquency',
    loadComponent: () =>
      import('./delinquency/delinquency-management.component').then(
        (m) => m.DelinquencyManagementComponent,
      ),
  },
  {
    path: 'credit-bureau-config',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_CREDITBUREAU_CONFIGURATION' },
    title: 'CREDIT_BUREAU_CONFIG.TITLE',
    loadComponent: () =>
      import('./credit-bureau-config/credit-bureau-config.component').then(
        (m) => m.CreditBureauConfigComponent,
      ),
  },
  {
    path: 'report-definitions',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_REPORT' },
    title: 'nav.reportDefinitions',
    loadComponent: () =>
      import('./report-definitions/report-definitions-list.component').then(
        (m) => m.ReportDefinitionsListComponent,
      ),
  },
  {
    path: 'report-definitions/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_REPORT' },
    title: 'REPORT_DEFINITIONS.CREATE',
    loadComponent: () =>
      import('./report-definitions/report-definition-form.component').then(
        (m) => m.ReportDefinitionFormComponent,
      ),
  },
  {
    path: 'report-definitions/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_REPORT' },
    title: 'REPORT_DEFINITIONS.EDIT',
    loadComponent: () =>
      import('./report-definitions/report-definition-form.component').then(
        (m) => m.ReportDefinitionFormComponent,
      ),
  },
  {
    path: 'hooks',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_HOOK' },
    title: 'nav.hooks',
    loadComponent: () => import('./hooks/hooks-list.component').then((m) => m.HooksListComponent),
  },
  {
    path: 'hooks/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_HOOK' },
    title: 'HOOKS.CREATE',
    loadComponent: () => import('./hooks/hooks-form.component').then((m) => m.HooksFormComponent),
  },
  {
    path: 'hooks/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_HOOK' },
    title: 'HOOKS.EDIT',
    loadComponent: () => import('./hooks/hooks-form.component').then((m) => m.HooksFormComponent),
  },
  {
    path: 'adhoc-query',
    title: 'nav.adhocQuery',
    loadComponent: () =>
      import('./adhoc-query/adhoc-query-list.component').then((m) => m.AdhocQueryListComponent),
  },
  {
    path: 'adhoc-query/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_ADHOC' },
    title: 'ADHOC_QUERY.CREATE',
    loadComponent: () =>
      import('./adhoc-query/adhoc-query-form.component').then((m) => m.AdhocQueryFormComponent),
  },
  {
    path: 'adhoc-query/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_ADHOC' },
    title: 'ADHOC_QUERY.EDIT',
    loadComponent: () =>
      import('./adhoc-query/adhoc-query-form.component').then((m) => m.AdhocQueryFormComponent),
  },
  {
    path: 'sms',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_SMS' },
    title: 'nav.sms',
    loadComponent: () => import('./sms/sms-list.component').then((m) => m.SmsListComponent),
  },
  {
    path: 'sms/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_SMS' },
    title: 'SMS.CREATE',
    loadComponent: () => import('./sms/sms-form.component').then((m) => m.SmsFormComponent),
  },
  {
    path: 'sms/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_SMS' },
    title: 'SMS.EDIT',
    loadComponent: () => import('./sms/sms-form.component').then((m) => m.SmsFormComponent),
  },
  {
    path: 'report-mailing-jobs',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_REPORTMAILINGJOB' },
    title: 'nav.reportMailingJobs',
    loadComponent: () =>
      import('./report-mailing-jobs/report-mailing-jobs-list.component').then(
        (m) => m.ReportMailingJobsListComponent,
      ),
  },
  {
    path: 'report-mailing-jobs/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_REPORTMAILINGJOB' },
    title: 'REPORT_MAILING_JOBS.CREATE',
    loadComponent: () =>
      import('./report-mailing-jobs/report-mailing-jobs-form.component').then(
        (m) => m.ReportMailingJobsFormComponent,
      ),
  },
  {
    path: 'report-mailing-jobs/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_REPORTMAILINGJOB' },
    title: 'REPORT_MAILING_JOBS.EDIT',
    loadComponent: () =>
      import('./report-mailing-jobs/report-mailing-jobs-form.component').then(
        (m) => m.ReportMailingJobsFormComponent,
      ),
  },
  {
    path: 'entity-data-table-checks',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_ENTITY_DATATABLE_CHECK' },
    title: 'nav.entityDataTableChecks',
    loadComponent: () =>
      import('./entity-data-table-checks/entity-data-table-checks-list.component').then(
        (m) => m.EntityDataTableChecksListComponent,
      ),
  },
  {
    path: 'entity-data-table-checks/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_ENTITY_DATATABLE_CHECK' },
    title: 'ENTITY_DATA_TABLE_CHECKS.CREATE',
    loadComponent: () =>
      import('./entity-data-table-checks/entity-data-table-checks-form.component').then(
        (m) => m.EntityDataTableChecksFormComponent,
      ),
  },
  {
    path: 'entity-mapping',
    title: 'nav.entityMapping',
    loadComponent: () =>
      import('./entity-mapping/entity-mapping-list.component').then(
        (m) => m.EntityMappingListComponent,
      ),
  },
  {
    path: 'entity-mapping/create',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'CREATE_ENTITYMAPPING' },
    title: 'ENTITY_MAPPING.CREATE',
    loadComponent: () =>
      import('./entity-mapping/entity-mapping-form.component').then(
        (m) => m.EntityMappingFormComponent,
      ),
  },
  {
    path: 'entity-mapping/edit/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_ENTITYMAPPING' },
    title: 'ENTITY_MAPPING.EDIT',
    loadComponent: () =>
      import('./entity-mapping/entity-mapping-form.component').then(
        (m) => m.EntityMappingFormComponent,
      ),
  },
  {
    path: 'business-steps',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_BATCH_BUSINESS_STEP' },
    title: 'BUSINESS_STEPS.TITLE',
    loadComponent: () =>
      import('./business-steps/business-steps.component').then((m) => m.BusinessStepsComponent),
  },
  {
    path: 'cache',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_CACHE' },
    title: 'CACHE.TITLE',
    loadComponent: () => import('./cache/cache.component').then((m) => m.CacheComponent),
  },
  {
    path: 'external-events',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_EXTERNAL_EVENT_CONFIGURATION' },
    title: 'nav.externalEvents',
    loadComponent: () =>
      import('./external-events/external-events.component').then((m) => m.ExternalEventsComponent),
  },
  {
    path: 'external-services',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'UPDATE_EXTERNALSERVICES' },
    title: 'EXTERNAL_SERVICES.TITLE',
    loadComponent: () =>
      import('./external-services/external-services.component').then(
        (m) => m.ExternalServicesComponent,
      ),
  },
  {
    path: 'password-preferences',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_PASSWORD_PREFERENCES' },
    title: 'PASSWORD_PREFERENCES.TITLE',
    loadComponent: () =>
      import('./password-preferences/password-preferences.component').then(
        (m) => m.PasswordPreferencesComponent,
      ),
  },
  {
    path: 'notifications-config',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_EMAIL_CONFIGURATION' },
    title: 'NOTIFICATIONS_CONFIG.TITLE',
    loadComponent: () =>
      import('./notifications-config/notifications-config.component').then(
        (m) => m.NotificationsConfigComponent,
      ),
  },
  {
    path: 'instance-mode',
    title: 'INSTANCE_MODE.TITLE',
    loadComponent: () =>
      import('./instance-mode/instance-mode.component').then((m) => m.InstanceModeComponent),
  },
  {
    path: 'scheduler-jobs',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_SCHEDULER' },
    title: 'nav.schedulerJobs',
    loadComponent: () =>
      import('./scheduler-jobs/scheduler-jobs-list.component').then(
        (m) => m.SchedulerJobsListComponent,
      ),
  },
  {
    path: 'scheduler-jobs/:id/history',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_SCHEDULER' },
    title: 'SCHEDULER_JOBS.RUN_HISTORY',
    loadComponent: () =>
      import('./scheduler-jobs/scheduler-job-history.component').then(
        (m) => m.SchedulerJobHistoryComponent,
      ),
  },
  {
    path: 'permissions',
    canActivate: [authGuard, permissionGuard],
    data: { permissions: 'READ_PERMISSION' },
    title: 'PERMISSIONS.TITLE',
    loadComponent: () =>
      import('./permissions/permissions.component').then((m) => m.PermissionsListComponent),
  },
  {
    path: 'oidc-config',
    title: 'OIDC_CONFIG.TITLE',
    loadComponent: () =>
      import('./oidc-config/oidc-config.component').then((m) => m.OidcConfigComponent),
  },
  {
    path: 'field-configuration',
    title: 'FIELD_CONFIG.TITLE',
    loadComponent: () =>
      import('./field-configuration/field-configuration.component').then(
        (m) => m.FieldConfigurationComponent,
      ),
  },
  {
    path: 'loan-product-details',
    title: 'LOAN_PRODUCT_DETAILS.TITLE',
    loadComponent: () =>
      import('./loan-product-details/loan-product-details.component').then(
        (m) => m.LoanProductDetailsComponent,
      ),
  },
];
