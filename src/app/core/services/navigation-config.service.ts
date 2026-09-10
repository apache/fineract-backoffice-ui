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

import { InjectionToken, Injectable, Signal, computed, inject } from '@angular/core';
import { I18N } from '../adapters';
import { AuthService } from './auth.service';
import { InstitutionConfigService, InstitutionFeature } from './institution-config.service';
import { ConfigService, NavOverrides } from './config.service';
import { composeNavTree } from './nav-composition';
import { permissionsSatisfy } from '../utils/permission-matcher';

// Icon names shared by several nav items, hoisted so the strings are not duplicated.
const ICON_BUSINESS_OUTLINE = 'business-outline';
const ICON_CALCULATOR_OUTLINE = 'calculator-outline';
const ICON_CALENDAR_OUTLINE = 'calendar-outline';
const ICON_DOCUMENT_TEXT_OUTLINE = 'document-text-outline';
const ICON_GIT_NETWORK_OUTLINE = 'git-network-outline';
const ICON_GRID_OUTLINE = 'grid-outline';
const ICON_LOCK_CLOSED_OUTLINE = 'lock-closed-outline';
const ICON_OPTIONS_OUTLINE = 'options-outline';
const ICON_PEOPLE_OUTLINE = 'people-outline';
const ICON_RECEIPT_OUTLINE = 'receipt-outline';
const ICON_SWAP_HORIZONTAL_OUTLINE = 'swap-horizontal-outline';
const ICON_TIME_OUTLINE = 'time-outline';
const ICON_TRENDING_UP_OUTLINE = 'trending-up-outline';
const ICON_WALLET_OUTLINE = 'wallet-outline';

/**
 * A single entry in the application's navigation tree. Group headers omit
 * `route`; leaf items omit `children`. A `divider` entry is a purely visual
 * separator within a group and carries no other meaningful fields.
 */
export interface NavItemConfig {
  /**
   * Stable identifier, and the only thing a deployment's `nav` overrides may name.
   *
   * Deliberately not derived at runtime from `route` or `labelKey`. Both of those are fields
   * upstream is free to change — a screen moves, a label gets rewritten — and an override keyed
   * on either silently stops matching when it does, which surfaces as a menu the deployment
   * meant to hide reappearing in production with no error anywhere.
   *
   * Ids are group-qualified (`products.loan`, `admin.wc-cob-tools`) because the same route can
   * legitimately appear under two groups; `/admin/wc-cob-tools` is cross-listed under both
   * Working Capital and Admin today. Once written, an id never changes: it is an opaque handle,
   * so an entry keeps its id after a route change, a rename, or a move to another group.
   *
   * Omitted only on `divider` entries, which are not addressable.
   *
   * @see `scripts/check-nav-ids.mjs`, which enforces presence, uniqueness and stability.
   */
  id?: string;
  /** Router path. Omitted for group headers with no direct destination. */
  route?: string;
  /** i18n translation key, or a literal label where no key exists yet. */
  labelKey: string;
  /** Material icon name. */
  icon?: string;
  /** Permission(s) required to see this item. Omitted = always visible. */
  requiredPermissions?: string | string[];
  /** AND semantics for a `requiredPermissions` array. Default is OR (any match). */
  requiredAllPermissions?: boolean;
  /** Institution feature gate, checked via {@link InstitutionConfigService}. */
  featureFlag?: InstitutionFeature;
  /** Nested items, for group headers. */
  children?: NavItemConfig[];
  /** Marks a purely visual separator between sibling items; no other field applies. */
  divider?: boolean;
  /**
   * What activating this entry does. `route` (the default) navigates within the application;
   * `external` opens {@link url} in a new tab.
   *
   * `external` is deliberately a link and not an embedded frame. A top-level link navigation is
   * not a fetch, a script load or a frame, so the deployed Content-Security-Policy does not
   * govern it and adding one changes nothing about the security posture. Embedding the same URL
   * would require `frame-src`, which is a decision for a later release.
   */
  kind?: 'route' | 'external';
  /** Destination for a `kind: 'external'` entry. Must be `http(s)`. Ignored otherwise. */
  url?: string;
  /**
   * Sort key among siblings, ascending. Entries without one keep their declared order and sort
   * after those that have one, so adding `order` to a single entry does not reshuffle the rest.
   */
  order?: number;
  /**
   * Drives Fineract's `/v1/internal/**` endpoints, which exist only under the backend's `test`
   * profile. Hidden unless the deployment sets `developerToolsEnabled`.
   */
  developerTool?: boolean;
}

/** A permission-filtered navigation leaf suitable for global search. */
export interface NavSearchResult {
  route: string;
  label: string;
  groupLabel?: string;
  icon?: string;
}

/**
 * Flattens a navigation tree into searchable leaf routes, carrying the parent
 * group's label key for display context (e.g. "Organization › Offices").
 */
export function flattenNavRoutes(
  items: readonly NavItemConfig[],
  groupLabelKey?: string,
): { route: string; labelKey: string; groupLabelKey?: string; icon?: string }[] {
  return items.flatMap((item) => {
    if (item.divider) {
      return [];
    }
    if (item.children) {
      return flattenNavRoutes(item.children, item.labelKey);
    }
    if (!item.route) {
      return [];
    }
    // `icon` is omitted rather than set to undefined so a leaf without one has the shape
    // its callers and specs describe, instead of a key that is present but empty.
    return [
      {
        route: item.route,
        labelKey: item.labelKey,
        groupLabelKey,
        ...(item.icon ? { icon: item.icon } : {}),
      },
    ];
  });
}

/**
 * The application's full navigation tree, transcribed from the sidebar
 * template. Permission and feature-flag gates match the ones already applied
 * to `sidebar.component.ts` — no new gates are introduced here.
 */
const NAV_CONFIG: readonly NavItemConfig[] = [
  { id: 'dashboard', route: '/dashboard', labelKey: 'nav.dashboard', icon: ICON_GRID_OUTLINE },
  {
    id: 'notifications',
    route: '/notifications',
    labelKey: 'nav.notifications',
    icon: 'notifications-outline',
  },
  { id: 'search', route: '/search', labelKey: 'SIDEBAR.SEARCH', icon: 'search-outline' },
  { id: 'profile', route: '/profile', labelKey: 'SIDEBAR.PROFILE', icon: 'person-circle-outline' },
  {
    id: 'clients',
    route: '/clients',
    requiredPermissions: 'READ_CLIENT',
    labelKey: 'nav.clients',
    icon: ICON_PEOPLE_OUTLINE,
  },
  {
    id: 'groups',
    route: '/groups',
    requiredPermissions: 'READ_GROUP',
    labelKey: 'nav.groups',
    icon: ICON_PEOPLE_OUTLINE,
    featureFlag: 'groups',
  },
  {
    id: 'centers',
    route: '/centers',
    requiredPermissions: 'READ_CENTER',
    labelKey: 'nav.centers',
    icon: 'location-outline',
    featureFlag: 'centers',
  },
  {
    id: 'collection-sheet',
    route: '/collection-sheet',
    requiredPermissions: 'READ_COLLECTIONSHEET',
    labelKey: 'nav.collectionSheet',
    icon: ICON_RECEIPT_OUTLINE,
    featureFlag: 'collection_sheet',
  },
  {
    id: 'loans',
    route: '/loans',
    requiredPermissions: 'READ_LOAN',
    labelKey: 'nav.loans',
    icon: 'cash-outline',
  },
  {
    id: 'loans.bulk-reassignment',
    route: '/loans/bulk-reassignment',
    requiredPermissions: 'BULKREASSIGN_LOAN',
    labelKey: 'nav.bulkReassignment',
    icon: ICON_SWAP_HORIZONTAL_OUTLINE,
  },
  {
    id: 'loans.point-in-time',
    route: '/loans/point-in-time',
    requiredPermissions: 'READ_LOAN',
    labelKey: 'nav.loansPointInTime',
    icon: ICON_TIME_OUTLINE,
  },
  {
    id: 'loans.account-locks',
    route: '/loans/account-locks',
    requiredPermissions: 'READ_LOAN',
    labelKey: 'LOAN_ACCOUNT_LOCK.TITLE',
    icon: ICON_LOCK_CLOSED_OUTLINE,
    developerTool: true,
  },
  {
    id: 'loans.cob-catchup',
    route: '/loans/cob-catchup',
    requiredPermissions: 'EXECUTEJOB_SCHEDULER',
    labelKey: 'LOAN_COB_CATCHUP.TITLE',
    icon: 'refresh-circle-outline',
  },
  {
    id: 'loans.schedule-modify',
    route: '/loans/schedule-modify',
    requiredPermissions: 'UPDATE_LOAN',
    labelKey: 'LOAN_SCHEDULE_MODIFY.TITLE',
    icon: 'calendar-number-outline',
  },
  {
    id: 'transfers',
    labelKey: 'nav.transfers',
    children: [
      {
        id: 'transfers.account-transfer',
        route: '/transfers/account-transfer',
        labelKey: 'nav.accountTransfer',
        icon: ICON_SWAP_HORIZONTAL_OUTLINE,
        // The screen is a transfer form, not a transfer list; making one is what it needs.
        requiredPermissions: 'CREATE_ACCOUNTTRANSFER',
      },
      {
        id: 'transfers.standing-instructions',
        route: '/transfers/standing-instructions',
        labelKey: 'nav.standingInstructions',
        icon: 'paper-plane-outline',
        requiredPermissions: 'READ_STANDINGINSTRUCTION',
      },
      {
        id: 'transfers.standing-instructions-history',
        route: '/transfers/standing-instructions/history',
        labelKey: 'nav.standingInstructionsHistory',
        icon: ICON_TIME_OUTLINE,
        requiredPermissions: 'READ_STANDINGINSTRUCTION',
      },
      {
        id: 'transfers.history',
        route: '/transfers/history',
        requiredPermissions: 'READ_ACCOUNTTRANSFER',
        labelKey: 'nav.transferHistory',
        icon: ICON_TIME_OUTLINE,
      },
    ],
  },
  {
    id: 'products',
    labelKey: 'nav.products',
    children: [
      {
        id: 'products.loan',
        route: '/products/loan',
        requiredPermissions: 'READ_LOANPRODUCT',
        labelKey: 'nav.loanProducts',
        icon: ICON_SWAP_HORIZONTAL_OUTLINE,
      },
      {
        id: 'products.savings',
        route: '/products/savings',
        requiredPermissions: 'READ_SAVINGSPRODUCT',
        labelKey: 'nav.savingsProducts',
        icon: ICON_WALLET_OUTLINE,
      },
      {
        id: 'products.fixed',
        route: '/products/fixed',
        requiredPermissions: 'READ_FIXEDDEPOSITPRODUCT',
        labelKey: 'nav.fixedDepositProducts',
        icon: ICON_BUSINESS_OUTLINE,
      },
      {
        id: 'products.recurring',
        route: '/products/recurring',
        requiredPermissions: 'READ_RECURRINGDEPOSITPRODUCT',
        labelKey: 'nav.recurringDepositProducts',
        icon: 'refresh-outline',
      },
      {
        id: 'products.share',
        route: '/products/share',
        labelKey: 'nav.shareProducts',
        icon: 'pie-chart-outline',
      },
      {
        id: 'products.tax-components',
        route: '/products/tax-components',
        requiredPermissions: 'READ_TAXCOMPONENT',
        labelKey: 'nav.taxComponents',
        icon: ICON_CALCULATOR_OUTLINE,
      },
      {
        id: 'products.tax-groups',
        route: '/products/tax-groups',
        requiredPermissions: 'READ_TAXGROUP',
        labelKey: 'nav.taxGroups',
        icon: ICON_RECEIPT_OUTLINE,
      },
      {
        id: 'products.floating-rates',
        route: '/products/floating-rates',
        requiredPermissions: 'READ_FLOATINGRATE',
        labelKey: 'nav.floatingRates',
        icon: ICON_TRENDING_UP_OUTLINE,
      },
      {
        id: 'products.rates',
        route: '/products/rates',
        requiredPermissions: 'READ_RATE',
        labelKey: 'nav.rates',
        icon: ICON_CALCULATOR_OUTLINE,
      },
      {
        id: 'products.interest-rate-charts',
        route: '/products/interest-rate-charts',
        labelKey: 'nav.interestRateCharts',
        icon: ICON_TRENDING_UP_OUTLINE,
      },
      {
        id: 'products.loan-originators',
        route: '/products/loan-originators',
        requiredPermissions: 'READ_LOAN_ORIGINATOR',
        labelKey: 'nav.loanOriginators',
        icon: 'people-circle-outline',
      },
      {
        id: 'products.collateral-management',
        route: '/products/collateral-management',
        labelKey: 'nav.collateralManagement',
        icon: 'cube-outline',
      },
      { labelKey: '', divider: true },
      {
        id: 'products.savings-accounts',
        route: '/products/savings-accounts',
        requiredPermissions: 'READ_SAVINGSACCOUNT',
        labelKey: 'nav.savingsAccounts',
        icon: ICON_WALLET_OUTLINE,
      },
      {
        id: 'products.fixed-deposits',
        route: '/products/fixed-deposits',
        requiredPermissions: 'READ_FIXEDDEPOSITACCOUNT',
        labelKey: 'nav.fixedDeposits',
        icon: ICON_LOCK_CLOSED_OUTLINE,
      },
      {
        id: 'products.recurring-deposits',
        route: '/products/recurring-deposits',
        requiredPermissions: 'READ_RECURRINGDEPOSITACCOUNT',
        labelKey: 'nav.recurringDeposits',
        icon: ICON_TIME_OUTLINE,
      },
      {
        id: 'products.shares',
        route: '/products/shares',
        labelKey: 'nav.shares',
        icon: ICON_TRENDING_UP_OUTLINE,
      },
    ],
  },
  {
    id: 'working-capital',
    labelKey: 'nav.workingCapital',
    children: [
      {
        id: 'working-capital.loans',
        route: '/working-capital/loans',
        labelKey: 'nav.wcLoans',
        icon: ICON_BUSINESS_OUTLINE,
        requiredPermissions: 'READ_WORKINGCAPITALLOAN',
      },
      {
        id: 'working-capital.loan-products',
        route: '/working-capital/loan-products',
        labelKey: 'nav.wcLoanProducts',
        icon: ICON_WALLET_OUTLINE,
        requiredPermissions: 'READ_WORKINGCAPITALLOANPRODUCT',
      },
      {
        id: 'working-capital.breach',
        route: '/working-capital/breach',
        labelKey: 'nav.wcBreach',
        icon: 'warning-outline',
        requiredPermissions: 'READ_WORKINGCAPITALBREACH',
      },
      {
        id: 'working-capital.near-breach',
        route: '/working-capital/near-breach',
        labelKey: 'nav.wcNearBreach',
        icon: 'warning-outline',
        requiredPermissions: 'READ_WORKINGCAPITALNEARBREACH',
      },
      {
        id: 'working-capital.account-locks',
        route: '/working-capital/loans/account-locks',
        requiredPermissions: 'READ_WORKINGCAPITALLOAN',
        labelKey: 'WC_LOAN_ACCOUNT_LOCK.TITLE',
        icon: ICON_LOCK_CLOSED_OUTLINE,
        developerTool: true,
      },
      {
        id: 'working-capital.cob-catchup',
        route: '/working-capital/loans/cob-catchup',
        requiredPermissions: 'EXECUTEJOB_SCHEDULER',
        labelKey: 'WC_LOAN_COB_CATCHUP.TITLE',
        icon: 'refresh-circle-outline',
      },
      {
        id: 'working-capital.wc-cob-tools',
        route: '/admin/wc-cob-tools',
        requiredPermissions: 'EXECUTEJOB_SCHEDULER',
        labelKey: 'WC_COB_TOOLS.TITLE',
        icon: ICON_OPTIONS_OUTLINE,
        developerTool: true,
      },
    ],
  },
  {
    id: 'spm',
    labelKey: 'nav.spm',
    children: [
      {
        id: 'spm.surveys',
        route: '/spm/surveys',
        labelKey: 'nav.spmSurveys',
        icon: 'bar-chart-outline',
      },
      {
        id: 'spm.poverty-line',
        route: '/spm/poverty-line',
        labelKey: 'nav.povertyLine',
        icon: 'trending-down-outline',
      },
      {
        id: 'spm.likelihood',
        route: '/spm/likelihood',
        requiredPermissions: 'UPDATE_LIKELIHOOD',
        labelKey: 'nav.likelihood',
        icon: 'analytics-outline',
      },
      {
        id: 'spm.survey-responses',
        route: '/spm/survey-responses',
        labelKey: 'SURVEY_RESPONSES.TITLE',
        icon: 'help-circle-outline',
      },
    ],
  },
  {
    id: 'campaigns',
    labelKey: 'Campaigns',
    children: [
      {
        id: 'campaigns.email',
        route: '/campaigns/email',
        labelKey: 'EMAIL_CAMPAIGNS.TITLE',
        icon: 'megaphone-outline',
        requiredPermissions: 'READ_EMAIL_CAMPAIGN',
      },
      {
        id: 'campaigns.sms',
        route: '/campaigns/sms',
        labelKey: 'SMS_CAMPAIGNS.TITLE',
        icon: 'chatbubble-outline',
        requiredPermissions: 'READ_SMSCAMPAIGN',
      },
      {
        id: 'campaigns.email-messages',
        route: '/campaigns/email-messages',
        requiredPermissions: 'READ_EMAIL_CAMPAIGN',
        labelKey: 'EMAIL_MESSAGES.TITLE',
        icon: 'mail-outline',
      },
    ],
  },
  {
    id: 'interop',
    labelKey: 'Interop',
    children: [
      {
        id: 'interop.parties',
        route: '/interop/parties',
        labelKey: 'INTEROP.PARTY_TITLE',
        icon: ICON_PEOPLE_OUTLINE,
        requiredPermissions: 'READ_INTERID',
      },
      {
        id: 'interop.accounts',
        route: '/interop/accounts',
        requiredPermissions: 'READ_INTERID',
        labelKey: 'INTEROP.ACCOUNT_TITLE',
        icon: ICON_BUSINESS_OUTLINE,
      },
      {
        id: 'interop.quotes',
        route: '/interop/quotes',
        labelKey: 'INTEROP.QUOTES_TITLE',
        icon: ICON_DOCUMENT_TEXT_OUTLINE,
        requiredPermissions: 'READ_INTERQUOTE',
      },
      {
        id: 'interop.transfers',
        route: '/interop/transfers',
        labelKey: 'INTEROP.TRANSFER_TITLE',
        icon: ICON_SWAP_HORIZONTAL_OUTLINE,
        requiredPermissions: 'READ_INTERTRANSFER',
      },
      {
        id: 'interop.health',
        route: '/interop/health',
        requiredPermissions: 'READ_INTERID',
        labelKey: 'INTEROP.HEALTH_TITLE',
        icon: 'pulse-outline',
      },
    ],
  },
  {
    id: 'admin',
    labelKey: 'Admin',
    requiredPermissions: 'READ_SCHEDULER',
    children: [
      {
        id: 'admin.batch-operations',
        route: '/admin/batch-operations',
        requiredPermissions: 'ALL_FUNCTIONS',
        labelKey: 'BATCH_OPERATIONS.TITLE',
        icon: 'layers-outline',
      },
      {
        id: 'admin.inline-job',
        route: '/admin/inline-job',
        requiredPermissions: 'EXECUTEJOB_SCHEDULER',
        labelKey: 'INLINE_JOB.TITLE',
        icon: 'play-circle-outline',
      },
      {
        id: 'admin.cob-tools',
        route: '/admin/cob-tools',
        requiredPermissions: 'EXECUTEJOB_SCHEDULER',
        labelKey: 'COB_TOOLS.TITLE',
        icon: 'construct-outline',
        developerTool: true,
      },
      {
        id: 'admin.wc-cob-tools',
        route: '/admin/wc-cob-tools',
        requiredPermissions: 'EXECUTEJOB_SCHEDULER',
        labelKey: 'WC_COB_TOOLS.TITLE',
        icon: 'build-outline',
        developerTool: true,
      },
      {
        id: 'admin.external-events',
        route: '/admin/external-events',
        requiredPermissions: 'READ_EXTERNAL_EVENT_CONFIGURATION',
        labelKey: 'EXTERNAL_EVENTS.TITLE',
        icon: ICON_CALENDAR_OUTLINE,
        developerTool: true,
      },
      {
        id: 'admin.progressive-loan',
        route: '/admin/progressive-loan',
        requiredPermissions: 'READ_LOANPRODUCT',
        labelKey: 'PROGRESSIVE_LOAN.TITLE',
        icon: ICON_TRENDING_UP_OUTLINE,
        developerTool: true,
      },
    ],
  },
  {
    id: 'fintech',
    labelKey: 'nav.fintech',
    children: [
      {
        id: 'fintech.asset-owners',
        route: '/fintech/asset-owners',
        labelKey: 'nav.assetOwners',
        icon: 'shield-checkmark-outline',
      },
    ],
  },
  {
    id: 'accounting',
    labelKey: 'nav.accounting',
    requiredPermissions: 'READ_GLACCOUNT',
    children: [
      {
        id: 'accounting.chart-of-accounts',
        route: '/accounting/chart-of-accounts',
        requiredPermissions: 'READ_GLACCOUNT',
        labelKey: 'nav.chartOfAccounts',
        icon: ICON_GIT_NETWORK_OUTLINE,
      },
      {
        id: 'accounting.journal-entries',
        route: '/accounting/journal-entries',
        requiredPermissions: 'READ_JOURNALENTRY',
        labelKey: 'nav.journalEntries',
        icon: 'book-outline',
      },
      {
        id: 'accounting.frequent-postings',
        route: '/accounting/frequent-postings',
        requiredPermissions: 'CREATE_JOURNALENTRY',
        labelKey: 'nav.frequentPostings',
        icon: 'flash-outline',
      },
      {
        id: 'accounting.opening-balances',
        route: '/accounting/opening-balances',
        requiredPermissions: 'DEFINEOPENINGBALANCE_JOURNALENTRY',
        labelKey: 'nav.openingBalances',
        icon: 'play-outline',
      },
      {
        id: 'accounting.closures',
        route: '/accounting/closures',
        requiredPermissions: 'READ_GLCLOSURE',
        labelKey: 'nav.accountingClosures',
        icon: 'clipboard-outline',
      },
      {
        id: 'accounting.rules',
        route: '/accounting/rules',
        requiredPermissions: 'READ_ACCOUNTINGRULE',
        labelKey: 'nav.accountingRules',
        icon: 'hammer-outline',
      },
      {
        id: 'accounting.financial-activity-mappings',
        route: '/accounting/financial-activity-mappings',
        requiredPermissions: 'READ_FINANCIALACTIVITYACCOUNT',
        labelKey: 'nav.financialActivityMappings',
        icon: ICON_SWAP_HORIZONTAL_OUTLINE,
      },
      {
        id: 'accounting.charges',
        route: '/accounting/charges',
        requiredPermissions: 'READ_CHARGE',
        labelKey: 'nav.charges',
        icon: ICON_CALCULATOR_OUTLINE,
      },
      {
        id: 'accounting.provisioning-categories',
        route: '/accounting/provisioning-categories',
        labelKey: 'nav.provisioningCategories',
        icon: 'pricetags-outline',
      },
      {
        id: 'accounting.provisioning-criteria',
        route: '/accounting/provisioning-criteria',
        labelKey: 'nav.provisioningCriteria',
        icon: 'checkbox-outline',
      },
      {
        id: 'accounting.provisioning-entries',
        route: '/accounting/provisioning-entries',
        labelKey: 'nav.provisioningEntries',
        icon: ICON_RECEIPT_OUTLINE,
      },
      {
        id: 'accounting.run-accruals',
        route: '/accounting/run-accruals',
        requiredPermissions: 'EXECUTEJOB_SCHEDULER',
        labelKey: 'nav.runAccruals',
        icon: ICON_CALCULATOR_OUTLINE,
      },
    ],
  },
  {
    id: 'tasks',
    labelKey: 'nav.tasks',
    children: [
      {
        id: 'tasks.work-queues',
        route: '/tasks/work-queues',
        requiredPermissions: ['READ_LOAN', 'READ_CLIENT'],
        labelKey: 'nav.workQueues',
        icon: 'checkmark-done-outline',
      },
      {
        id: 'tasks.checker-inbox',
        route: '/tasks/checker-inbox',
        requiredPermissions: 'READ_AUDIT',
        labelKey: 'nav.checker_inbox',
        icon: 'file-tray-outline',
      },
    ],
  },
  {
    id: 'security',
    labelKey: 'nav.security',
    requiredPermissions: ['READ_USER', 'READ_ROLE', 'READ_AUDIT'],
    children: [
      {
        id: 'security.users',
        route: '/security/users',
        requiredPermissions: 'READ_USER',
        labelKey: 'nav.users',
        icon: 'person-outline',
      },
      {
        id: 'security.roles',
        route: '/security/roles',
        requiredPermissions: 'READ_ROLE',
        labelKey: 'nav.roles',
        icon: 'person-circle-outline',
      },
      {
        id: 'security.audits',
        route: '/security/audits',
        requiredPermissions: 'READ_AUDIT',
        labelKey: 'nav.audits',
        icon: 'git-commit-outline',
      },
    ],
  },
  {
    id: 'reporting',
    labelKey: 'nav.reporting',
    children: [
      {
        id: 'reporting.reports',
        route: '/reporting',
        requiredPermissions: 'READ_REPORT',
        labelKey: 'nav.reports',
        icon: 'bar-chart-outline',
      },
    ],
  },
  {
    id: 'settings',
    labelKey: 'nav.settings',
    requiredPermissions: 'READ_CONFIGURATION',
    children: [
      {
        id: 'settings.configurations',
        route: '/settings/configurations',
        requiredPermissions: 'READ_CONFIGURATION',
        labelKey: 'nav.globalConfigurations',
        icon: ICON_OPTIONS_OUTLINE,
      },
      {
        id: 'settings.holidays',
        route: '/settings/holidays',
        requiredPermissions: 'READ_HOLIDAY',
        labelKey: 'nav.holidays',
        icon: 'calendar-clear-outline',
      },
      {
        id: 'settings.working-days',
        route: '/settings/working-days',
        requiredPermissions: 'READ_WORKINGDAYS',
        labelKey: 'nav.workingDays',
        icon: ICON_CALENDAR_OUTLINE,
      },
      {
        id: 'settings.two-factor',
        route: '/settings/two-factor',
        requiredPermissions: 'READ_TWOFACTOR_CONFIGURATION',
        labelKey: 'TWO_FACTOR_CONFIG.TITLE',
        icon: 'shield-outline',
      },
      {
        id: 'settings.forgot-password',
        route: '/auth/forgot-password',
        labelKey: 'FORGOT_PASSWORD.TITLE',
        icon: ICON_LOCK_CLOSED_OUTLINE,
      },
    ],
  },
  {
    id: 'teller-operations',
    labelKey: 'nav.tellerOperations',
    children: [
      {
        id: 'teller-operations.tellers',
        route: '/tellers',
        labelKey: 'nav.tellers',
        icon: 'storefront-outline',
      },
    ],
  },
  {
    id: 'organization',
    labelKey: 'nav.organization',
    children: [
      {
        id: 'organization.offices',
        route: '/organization/offices',
        requiredPermissions: 'READ_OFFICE',
        labelKey: 'nav.offices',
        icon: ICON_BUSINESS_OUTLINE,
      },
      {
        id: 'organization.staff',
        route: '/organization/staff',
        requiredPermissions: 'READ_STAFF',
        labelKey: 'nav.staff',
        icon: 'id-card-outline',
      },
      {
        id: 'organization.funds',
        route: '/organization/funds',
        requiredPermissions: 'READ_FUND',
        labelKey: 'nav.funds',
        icon: ICON_WALLET_OUTLINE,
      },
      {
        id: 'organization.payment-types',
        route: '/organization/payment-types',
        requiredPermissions: 'READ_PAYMENTTYPE',
        labelKey: 'nav.paymentTypes',
        icon: 'cash-outline',
      },
      {
        id: 'organization.group-levels',
        route: '/organization/group-levels',
        labelKey: 'nav.groupLevels',
        icon: ICON_GIT_NETWORK_OUTLINE,
      },
      {
        id: 'organization.currencies',
        route: '/organization/currencies',
        requiredPermissions: 'READ_CURRENCY',
        labelKey: 'nav.currencies',
        icon: ICON_SWAP_HORIZONTAL_OUTLINE,
      },
      {
        id: 'organization.account-number-formats',
        route: '/organization/account-number-formats',
        requiredPermissions: 'READ_ACCOUNTNUMBERFORMAT',
        labelKey: 'nav.accountNumberFormats',
        icon: 'list-outline',
      },
      {
        id: 'organization.office-transactions',
        route: '/organization/office-transactions',
        requiredPermissions: 'READ_OFFICETRANSACTION',
        labelKey: 'OFFICE_TRANSACTIONS.TITLE',
        icon: ICON_SWAP_HORIZONTAL_OUTLINE,
      },
      {
        id: 'organization.loan-portfolio-summary',
        route: '/organization/loan-portfolio-summary',
        requiredPermissions: 'READ_LOAN',
        labelKey: 'ORGANIZATION.LOAN_PORTFOLIO_SUMMARY',
        icon: 'bar-chart-outline',
      },
    ],
  },
  {
    id: 'system',
    labelKey: 'nav.system',
    requiredPermissions: ['READ_DATATABLE', 'READ_HOOK'],
    children: [
      {
        id: 'system.data-tables',
        route: '/system/data-tables',
        requiredPermissions: 'READ_DATATABLE',
        labelKey: 'nav.dataTables',
        icon: ICON_GRID_OUTLINE,
      },
      {
        id: 'system.bulk-import',
        route: '/system/bulk-import',
        requiredPermissions: 'READ_IMPORT',
        labelKey: 'nav.bulkImport',
        icon: 'cloud-upload-outline',
      },
      {
        id: 'system.delinquency',
        route: '/system/delinquency',
        requiredPermissions: 'READ_DELINQUENCY_BUCKET',
        labelKey: 'nav.delinquency',
        icon: 'hammer-outline',
      },
      {
        id: 'system.hooks',
        route: '/system/hooks',
        requiredPermissions: 'READ_HOOK',
        labelKey: 'nav.hooks',
        icon: ICON_GIT_NETWORK_OUTLINE,
      },
      {
        id: 'system.credit-bureau-config',
        route: '/system/credit-bureau-config',
        requiredPermissions: 'UPDATE_CREDITBUREAU_CONFIGURATION',
        labelKey: 'nav.creditBureauConfig',
        icon: 'card-outline',
      },
      {
        id: 'system.adhoc-query',
        route: '/system/adhoc-query',
        labelKey: 'nav.adhocQuery',
        icon: 'analytics-outline',
      },
      {
        id: 'system.sms',
        route: '/system/sms',
        requiredPermissions: 'READ_SMS',
        labelKey: 'nav.sms',
        icon: 'chatbubble-outline',
      },
      {
        id: 'system.report-definitions',
        route: '/system/report-definitions',
        requiredPermissions: 'READ_REPORT',
        labelKey: 'nav.reportDefinitions',
        icon: 'document-text-outline',
      },
      {
        id: 'system.report-mailing-jobs',
        route: '/system/report-mailing-jobs',
        requiredPermissions: 'READ_REPORTMAILINGJOB',
        labelKey: 'nav.reportMailingJobs',
        icon: 'mail-open-outline',
      },
      {
        id: 'system.entity-data-table-checks',
        route: '/system/entity-data-table-checks',
        requiredPermissions: 'READ_ENTITY_DATATABLE_CHECK',
        labelKey: 'nav.entityDataTableChecks',
        icon: 'checkbox-outline',
      },
      {
        id: 'system.entity-mapping',
        route: '/system/entity-mapping',
        labelKey: 'nav.entityMapping',
        icon: ICON_GIT_NETWORK_OUTLINE,
      },
      {
        id: 'system.scheduler-jobs',
        route: '/system/scheduler-jobs',
        requiredPermissions: 'READ_SCHEDULER',
        labelKey: 'nav.schedulerJobs',
        icon: ICON_TIME_OUTLINE,
      },
      {
        id: 'system.permissions',
        route: '/system/permissions',
        requiredPermissions: 'READ_PERMISSION',
        labelKey: 'nav.permissions',
        icon: 'shield-checkmark-outline',
      },
      {
        id: 'system.business-steps',
        route: '/system/business-steps',
        requiredPermissions: 'UPDATE_BATCH_BUSINESS_STEP',
        labelKey: 'nav.businessSteps',
        icon: ICON_OPTIONS_OUTLINE,
      },
      {
        id: 'system.cache',
        route: '/system/cache',
        requiredPermissions: 'READ_CACHE',
        labelKey: 'nav.cache',
        icon: 'hardware-chip-outline',
      },
      {
        id: 'system.external-events',
        route: '/system/external-events',
        requiredPermissions: 'READ_EXTERNAL_EVENT_CONFIGURATION',
        labelKey: 'nav.externalEvents',
        icon: ICON_CALENDAR_OUTLINE,
      },
      {
        id: 'system.external-services',
        route: '/system/external-services',
        requiredPermissions: 'UPDATE_EXTERNALSERVICES',
        labelKey: 'nav.externalServices',
        icon: 'cloud-outline',
      },
      {
        id: 'system.password-preferences',
        route: '/system/password-preferences',
        requiredPermissions: 'READ_PASSWORD_PREFERENCES',
        labelKey: 'nav.passwordPreferences',
        icon: 'key-outline',
      },
      {
        id: 'system.notifications-config',
        route: '/system/notifications-config',
        requiredPermissions: 'READ_EMAIL_CONFIGURATION',
        labelKey: 'nav.notificationsConfig',
        icon: 'notifications-outline',
      },
      {
        id: 'system.instance-mode',
        route: '/system/instance-mode',
        labelKey: 'nav.instanceMode',
        icon: ICON_OPTIONS_OUTLINE,
      },
      {
        id: 'system.oidc-config',
        route: '/system/oidc-config',
        labelKey: 'nav.oidcConfig',
        icon: 'key-outline',
      },
      {
        id: 'system.field-configuration',
        route: '/system/field-configuration',
        labelKey: 'nav.fieldConfiguration',
        icon: ICON_GRID_OUTLINE,
      },
      {
        id: 'system.loan-product-details',
        route: '/system/loan-product-details',
        labelKey: 'nav.loanProductDetails',
        icon: ICON_DOCUMENT_TEXT_OUTLINE,
      },
      {
        id: 'system.codes',
        route: '/system/codes',
        requiredPermissions: 'READ_CODE',
        labelKey: 'nav.codes',
        icon: 'code-slash-outline',
      },
      {
        id: 'system.business-dates',
        route: '/system/business-dates',
        requiredPermissions: 'READ_BUSINESS_DATE',
        labelKey: 'nav.businessDates',
        icon: 'today-outline',
      },
      {
        id: 'system.templates',
        route: '/system/templates',
        requiredPermissions: 'READ_TEMPLATE',
        labelKey: 'nav.templates',
        icon: ICON_DOCUMENT_TEXT_OUTLINE,
      },
    ],
  },
];

/**
 * Recursively filters a navigation tree using the given visibility predicate.
 * Dividers always pass through. A group whose children are all filtered out
 * is itself omitted, so consumers never need to special-case an empty group
 * header. Pure and Angular-free, so it is directly unit-testable with
 * synthetic trees.
 *
 * @param items - The nav tree (or subtree) to filter
 * @param isVisible - Predicate deciding whether a single, non-divider item passes
 */
export function filterNavItems(
  items: readonly NavItemConfig[],
  isVisible: (item: NavItemConfig) => boolean,
): NavItemConfig[] {
  return items.reduce<NavItemConfig[]>((visible, item) => {
    if (item.divider) {
      visible.push(item);
      return visible;
    }

    if (!isVisible(item)) {
      return visible;
    }

    if (item.children) {
      const filteredChildren = filterNavItems(item.children, isVisible);
      if (filteredChildren.length === 0) {
        return visible;
      }
      visible.push({ ...item, children: filteredChildren });
      return visible;
    }

    visible.push(item);
    return visible;
  }, []);
}

/**
 * Deployment adjustments to the navigation tree.
 *
 * Reads from `config.json` by default, so hiding an entry needs no rebuild and no patch
 * against `NAV_CONFIG` — a file every feature appends to, and therefore a conflict on every
 * upstream release for anyone who edits it. A downstream that wants to decide this in code
 * instead can override the token, which is why the indirection exists at all.
 */
export const NAV_OVERRIDES = new InjectionToken<Signal<NavOverrides>>('NAV_OVERRIDES', {
  providedIn: 'root',
  factory: () => {
    const config = inject(ConfigService);
    return computed(() => config.config().nav ?? {});
  },
});

/**
 * Provides the application's navigation tree, filtered by the current user's
 * permissions and institution configuration.
 */
@Injectable({
  providedIn: 'root',
})
export class NavigationConfigService {
  private readonly authService = inject(AuthService);
  private readonly institutionConfig = inject(InstitutionConfigService);
  private readonly config = inject(ConfigService);
  private readonly overrides = inject(NAV_OVERRIDES);
  private readonly i18n = inject(I18N);

  /** The full, unfiltered navigation tree, as upstream declares it. */
  readonly navConfig: readonly NavItemConfig[] = NAV_CONFIG;

  /** `id`s this deployment hides outright, whatever the user's permissions. */
  private readonly hidden = computed(() => new Set(this.overrides().hidden));

  /**
   * The upstream tree with this deployment's added entries and per-entry patches applied, before
   * any permission or feature gate. Recomputed only when the deployment's `nav` block changes.
   */
  private readonly composed = computed(() => composeNavTree(NAV_CONFIG, this.overrides()));

  /**
   * Problems found in the deployment's `nav` block — an override naming an entry that no longer
   * exists, an added entry colliding with a built-in id, an external item without a usable URL.
   *
   * Exposed rather than logged and forgotten: a typo in a deployment's config otherwise presents
   * as a missing feature, which is indistinguishable from a bug in the application.
   */
  readonly navConfigDefects = computed(() => this.composed().defects);

  /**
   * Reactive, filtered navigation tree — recomputed whenever the current
   * user's permissions, the institution type, or the deployment's configuration change.
   */
  readonly filteredNavItems = computed(() => {
    // Access the signals so this computed re-evaluates when any of them changes.
    this.authService.currentUser();
    this.institutionConfig.institutionType();
    this.config.rbacEnabled();
    this.config.developerToolsEnabled();
    this.hidden();
    return filterNavItems(this.composed().items, (item) => this.isItemVisible(item));
  });

  /**
   * Navigation leaves a principal holding exactly `permissions` would see, keyed by route.
   *
   * The whole point is that this runs the *same* gates as {@link filteredNavItems} — the
   * deployment's `hidden` list, developer tools, institution features and the permission check —
   * with the signed-in user's codes swapped for the ones passed in. A role editor can then show
   * what its pending selection actually changes, rather than a second guess at the rule.
   *
   * Note that when `rbacEnabled` is false the sidebar shows everything regardless of
   * permissions, so every call here returns the whole tree. That is not a bug in the preview;
   * it is what the deployment does, and a caller showing this to a user should say so.
   */
  navDestinationsForPermissions(
    permissions: readonly string[],
  ): { route: string; labelKey: string; groupLabelKey?: string; icon?: string }[] {
    const held = new Set(permissions.map((code) => code.trim()));
    const tree = filterNavItems(this.composed().items, (item) =>
      this.isItemVisible(item, (required, matchAll) =>
        permissionsSatisfy(held, required, matchAll),
      ),
    );
    return flattenNavRoutes(tree);
  }

  private isItemVisible(
    item: NavItemConfig,
    hasPermission: (required: string | string[], matchAll: boolean) => boolean = (
      required,
      matchAll,
    ) => this.authService.hasPermission(required, matchAll),
  ): boolean {
    // Checked before the RBAC short-circuit: hiding an entry is what this deployment offers,
    // which is a separate question from what this user is allowed to reach.
    //
    // Keyed on `id`, never on `labelKey`. A label is upstream's to rewrite, so an override keyed
    // on one stops matching after a rename and the entry the deployment meant to suppress comes
    // back — silently, in production. See the note on `NavItemConfig.id`.
    if (item.id && this.hidden().has(item.id)) {
      return false;
    }

    // Checked before the RBAC short-circuit, and for the same reason the `hidden` check is:
    // turning RBAC off means "show this user everything they may reach", not "expose endpoints
    // this deployment cannot serve". A developer tool stays hidden either way.
    if (item.developerTool && !this.config.developerToolsEnabled()) {
      return false;
    }

    if (!this.config.rbacEnabled()) {
      return true;
    }

    if (item.featureFlag && !this.institutionConfig.isFeatureEnabled(item.featureFlag)) {
      return false;
    }

    if (
      item.requiredPermissions &&
      !hasPermission(item.requiredPermissions, item.requiredAllPermissions ?? false)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Returns navigation shortcuts whose translated labels match the query.
   * Results are already filtered by the current user's permissions and institution config.
   */
  searchRoutes(query: string, limit = 15): NavSearchResult[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    const candidates = flattenNavRoutes(this.filteredNavItems())
      .filter((entry) => entry.route !== '/search')
      .map((entry) => ({
        route: entry.route,
        label: this.i18n.translate(entry.labelKey),
        groupLabel: entry.groupLabelKey ? this.i18n.translate(entry.groupLabelKey) : undefined,
        icon: entry.icon,
      }));

    // Partitioned rather than scored and sorted, because the only ordering that matters is
    // this one: a page whose own name matches comes before a page matched only through its
    // section. Ranking them together would let "organization" fill the whole result list
    // with every leaf beneath Organization — and in the header, where the limit is small,
    // that pushes the entity hits off the bottom.
    const named = candidates.filter((result) =>
      result.label.toLowerCase().includes(normalizedQuery),
    );
    const bySection = candidates.filter(
      (result) =>
        !result.label.toLowerCase().includes(normalizedQuery) &&
        result.groupLabel?.toLowerCase().includes(normalizedQuery),
    );

    return [...named, ...bySection].slice(0, limit);
  }
}
