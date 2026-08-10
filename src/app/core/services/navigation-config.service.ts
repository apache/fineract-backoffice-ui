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
    return [{ route: item.route, labelKey: item.labelKey, groupLabelKey, icon: item.icon }];
  });
}

/**
 * The application's full navigation tree, transcribed from the sidebar
 * template. Permission and feature-flag gates match the ones already applied
 * to `sidebar.component.ts` — no new gates are introduced here.
 */
const NAV_CONFIG: readonly NavItemConfig[] = [
  { route: '/dashboard', labelKey: 'nav.dashboard', icon: ICON_GRID_OUTLINE },
  { route: '/notifications', labelKey: 'nav.notifications', icon: 'notifications-outline' },
  { route: '/search', labelKey: 'SIDEBAR.SEARCH', icon: 'search-outline' },
  { route: '/profile', labelKey: 'SIDEBAR.PROFILE', icon: 'person-circle-outline' },
  { route: '/clients', labelKey: 'nav.clients', icon: ICON_PEOPLE_OUTLINE },
  { route: '/clients/search', labelKey: 'nav.clientSearchV2', icon: 'search-circle-outline' },
  { route: '/groups', labelKey: 'nav.groups', icon: ICON_PEOPLE_OUTLINE, featureFlag: 'groups' },
  { route: '/centers', labelKey: 'nav.centers', icon: 'location-outline', featureFlag: 'centers' },
  {
    route: '/collection-sheet',
    labelKey: 'nav.collectionSheet',
    icon: ICON_RECEIPT_OUTLINE,
    featureFlag: 'collection_sheet',
  },
  { route: '/loans', labelKey: 'nav.loans', icon: 'cash-outline' },
  {
    route: '/loans/bulk-reassignment',
    labelKey: 'nav.bulkReassignment',
    icon: ICON_SWAP_HORIZONTAL_OUTLINE,
  },
  { route: '/loans/point-in-time', labelKey: 'nav.loansPointInTime', icon: ICON_TIME_OUTLINE },
  {
    route: '/loans/account-locks',
    labelKey: 'LOAN_ACCOUNT_LOCK.TITLE',
    icon: ICON_LOCK_CLOSED_OUTLINE,
  },
  {
    route: '/loans/cob-catchup',
    labelKey: 'LOAN_COB_CATCHUP.TITLE',
    icon: 'refresh-circle-outline',
  },
  {
    route: '/loans/schedule-modify',
    labelKey: 'LOAN_SCHEDULE_MODIFY.TITLE',
    icon: 'calendar-number-outline',
  },
  {
    labelKey: 'nav.transfers',
    children: [
      {
        route: '/transfers/account-transfer',
        labelKey: 'nav.accountTransfer',
        icon: ICON_SWAP_HORIZONTAL_OUTLINE,
        requiredPermissions: 'READ_ACCOUNTTRANSFER',
      },
      {
        route: '/transfers/standing-instructions',
        labelKey: 'nav.standingInstructions',
        icon: 'paper-plane-outline',
        requiredPermissions: 'READ_STANDINGINSTRUCTION',
      },
      {
        route: '/transfers/standing-instructions/history',
        labelKey: 'nav.standingInstructionsHistory',
        icon: ICON_TIME_OUTLINE,
        requiredPermissions: 'READ_STANDINGINSTRUCTION',
      },
      { route: '/transfers/history', labelKey: 'nav.transferHistory', icon: ICON_TIME_OUTLINE },
    ],
  },
  {
    labelKey: 'nav.products',
    children: [
      { route: '/products/loan', labelKey: 'nav.loanProducts', icon: ICON_SWAP_HORIZONTAL_OUTLINE },
      { route: '/products/savings', labelKey: 'nav.savingsProducts', icon: ICON_WALLET_OUTLINE },
      {
        route: '/products/fixed',
        labelKey: 'nav.fixedDepositProducts',
        icon: ICON_BUSINESS_OUTLINE,
      },
      {
        route: '/products/recurring',
        labelKey: 'nav.recurringDepositProducts',
        icon: 'refresh-outline',
      },
      { route: '/products/share', labelKey: 'nav.shareProducts', icon: 'pie-chart-outline' },
      {
        route: '/products/tax-components',
        labelKey: 'nav.taxComponents',
        icon: ICON_CALCULATOR_OUTLINE,
      },
      { route: '/products/tax-groups', labelKey: 'nav.taxGroups', icon: ICON_RECEIPT_OUTLINE },
      {
        route: '/products/floating-rates',
        labelKey: 'nav.floatingRates',
        icon: ICON_TRENDING_UP_OUTLINE,
      },
      { route: '/products/rates', labelKey: 'nav.rates', icon: ICON_CALCULATOR_OUTLINE },
      {
        route: '/products/interest-rate-charts',
        labelKey: 'nav.interestRateCharts',
        icon: ICON_TRENDING_UP_OUTLINE,
      },
      {
        route: '/products/loan-originators',
        labelKey: 'nav.loanOriginators',
        icon: 'people-circle-outline',
      },
      {
        route: '/products/collateral-management',
        labelKey: 'nav.collateralManagement',
        icon: 'cube-outline',
      },
      { labelKey: '', divider: true },
      {
        route: '/products/savings-accounts',
        labelKey: 'nav.savingsAccounts',
        icon: ICON_WALLET_OUTLINE,
      },
      {
        route: '/products/fixed-deposits',
        labelKey: 'nav.fixedDeposits',
        icon: ICON_LOCK_CLOSED_OUTLINE,
      },
      {
        route: '/products/recurring-deposits',
        labelKey: 'nav.recurringDeposits',
        icon: ICON_TIME_OUTLINE,
      },
      { route: '/products/shares', labelKey: 'nav.shares', icon: ICON_TRENDING_UP_OUTLINE },
    ],
  },
  {
    labelKey: 'nav.workingCapital',
    children: [
      {
        route: '/working-capital/loans',
        labelKey: 'nav.wcLoans',
        icon: ICON_BUSINESS_OUTLINE,
        requiredPermissions: 'READ_WORKINGCAPITALLOAN',
      },
      {
        route: '/working-capital/loan-products',
        labelKey: 'nav.wcLoanProducts',
        icon: ICON_WALLET_OUTLINE,
        requiredPermissions: 'READ_WORKINGCAPITALLOANPRODUCT',
      },
      {
        route: '/working-capital/breach',
        labelKey: 'nav.wcBreach',
        icon: 'warning-outline',
        requiredPermissions: 'READ_WORKINGCAPITALBREACH',
      },
      {
        route: '/working-capital/near-breach',
        labelKey: 'nav.wcNearBreach',
        icon: 'warning-outline',
        requiredPermissions: 'READ_WORKINGCAPITALNEARBREACH',
      },
      {
        route: '/working-capital/loans/account-locks',
        labelKey: 'WC_LOAN_ACCOUNT_LOCK.TITLE',
        icon: ICON_LOCK_CLOSED_OUTLINE,
      },
      {
        route: '/working-capital/loans/cob-catchup',
        labelKey: 'WC_LOAN_COB_CATCHUP.TITLE',
        icon: 'refresh-circle-outline',
      },
      { route: '/admin/wc-cob-tools', labelKey: 'WC_COB_TOOLS.TITLE', icon: ICON_OPTIONS_OUTLINE },
    ],
  },
  {
    labelKey: 'nav.spmMix',
    children: [
      { route: '/spm/surveys', labelKey: 'nav.spmSurveys', icon: 'bar-chart-outline' },
      { route: '/spm/poverty-line', labelKey: 'nav.povertyLine', icon: 'trending-down-outline' },
      { route: '/spm/likelihood', labelKey: 'nav.likelihood', icon: 'analytics-outline' },
      { route: '/mix/mapping', labelKey: 'nav.mixMapping', icon: 'link-outline' },
      { route: '/mix/report', labelKey: 'nav.mixReport', icon: ICON_DOCUMENT_TEXT_OUTLINE },
      { route: '/mix/taxonomy', labelKey: 'nav.mixTaxonomy', icon: ICON_GIT_NETWORK_OUTLINE },
      {
        route: '/spm/survey-responses',
        labelKey: 'SURVEY_RESPONSES.TITLE',
        icon: 'help-circle-outline',
      },
    ],
  },
  {
    labelKey: 'Campaigns',
    children: [
      {
        route: '/campaigns/email',
        labelKey: 'EMAIL_CAMPAIGNS.TITLE',
        icon: 'megaphone-outline',
        requiredPermissions: 'READ_EMAIL_CAMPAIGN',
      },
      {
        route: '/campaigns/sms',
        labelKey: 'SMS_CAMPAIGNS.TITLE',
        icon: 'chatbubble-outline',
        requiredPermissions: 'READ_SMSCAMPAIGN',
      },
      {
        route: '/campaigns/email-messages',
        labelKey: 'EMAIL_MESSAGES.TITLE',
        icon: 'mail-outline',
      },
    ],
  },
  {
    labelKey: 'Interop',
    children: [
      {
        route: '/interop/parties',
        labelKey: 'INTEROP.PARTY_TITLE',
        icon: ICON_PEOPLE_OUTLINE,
        requiredPermissions: 'READ_INTERID',
      },
      {
        route: '/interop/accounts',
        labelKey: 'INTEROP.ACCOUNT_TITLE',
        icon: ICON_BUSINESS_OUTLINE,
      },
      {
        route: '/interop/quotes',
        labelKey: 'INTEROP.QUOTES_TITLE',
        icon: ICON_DOCUMENT_TEXT_OUTLINE,
        requiredPermissions: 'READ_INTERQUOTE',
      },
      {
        route: '/interop/transfers',
        labelKey: 'INTEROP.TRANSFER_TITLE',
        icon: ICON_SWAP_HORIZONTAL_OUTLINE,
        requiredPermissions: 'READ_INTERTRANSFER',
      },
      { route: '/interop/health', labelKey: 'INTEROP.HEALTH_TITLE', icon: 'pulse-outline' },
    ],
  },
  {
    labelKey: 'Admin',
    requiredPermissions: 'READ_SCHEDULER',
    children: [
      {
        route: '/admin/batch-operations',
        labelKey: 'BATCH_OPERATIONS.TITLE',
        icon: 'layers-outline',
      },
      { route: '/admin/inline-job', labelKey: 'INLINE_JOB.TITLE', icon: 'play-circle-outline' },
      { route: '/admin/cob-tools', labelKey: 'COB_TOOLS.TITLE', icon: 'construct-outline' },
      { route: '/admin/wc-cob-tools', labelKey: 'WC_COB_TOOLS.TITLE', icon: 'build-outline' },
      {
        route: '/admin/external-events',
        labelKey: 'EXTERNAL_EVENTS.TITLE',
        icon: ICON_CALENDAR_OUTLINE,
      },
      {
        route: '/admin/progressive-loan',
        labelKey: 'PROGRESSIVE_LOAN.TITLE',
        icon: ICON_TRENDING_UP_OUTLINE,
      },
    ],
  },
  {
    labelKey: 'nav.fintech',
    children: [
      {
        route: '/fintech/asset-owners',
        labelKey: 'nav.assetOwners',
        icon: 'shield-checkmark-outline',
      },
    ],
  },
  {
    labelKey: 'nav.accounting',
    requiredPermissions: 'READ_GLACCOUNT',
    children: [
      {
        route: '/accounting/chart-of-accounts',
        labelKey: 'nav.chartOfAccounts',
        icon: ICON_GIT_NETWORK_OUTLINE,
      },
      {
        route: '/accounting/journal-entries',
        labelKey: 'nav.journalEntries',
        icon: 'book-outline',
      },
      {
        route: '/accounting/closures',
        labelKey: 'nav.accountingClosures',
        icon: 'clipboard-outline',
      },
      { route: '/accounting/rules', labelKey: 'nav.accountingRules', icon: 'hammer-outline' },
      {
        route: '/accounting/financial-activity-mappings',
        labelKey: 'nav.financialActivityMappings',
        icon: ICON_SWAP_HORIZONTAL_OUTLINE,
      },
      { route: '/accounting/charges', labelKey: 'nav.charges', icon: ICON_CALCULATOR_OUTLINE },
      {
        route: '/accounting/provisioning-categories',
        labelKey: 'nav.provisioningCategories',
        icon: 'pricetags-outline',
      },
      {
        route: '/accounting/provisioning-criteria',
        labelKey: 'nav.provisioningCriteria',
        icon: 'checkbox-outline',
      },
      {
        route: '/accounting/provisioning-entries',
        labelKey: 'nav.provisioningEntries',
        icon: ICON_RECEIPT_OUTLINE,
      },
      {
        route: '/accounting/run-accruals',
        labelKey: 'nav.runAccruals',
        icon: ICON_CALCULATOR_OUTLINE,
      },
    ],
  },
  {
    labelKey: 'nav.tasks',
    children: [
      { route: '/tasks/checker-inbox', labelKey: 'nav.checker_inbox', icon: 'file-tray-outline' },
    ],
  },
  {
    labelKey: 'nav.security',
    requiredPermissions: ['READ_USER', 'READ_ROLE', 'READ_AUDIT'],
    children: [
      { route: '/security/users', labelKey: 'nav.users', icon: 'person-outline' },
      { route: '/security/roles', labelKey: 'nav.roles', icon: 'person-circle-outline' },
      { route: '/security/audits', labelKey: 'nav.audits', icon: 'git-commit-outline' },
    ],
  },
  {
    labelKey: 'nav.reporting',
    children: [{ route: '/reporting', labelKey: 'nav.reports', icon: 'bar-chart-outline' }],
  },
  {
    labelKey: 'nav.settings',
    requiredPermissions: 'READ_CONFIGURATION',
    children: [
      {
        route: '/settings/configurations',
        labelKey: 'nav.globalConfigurations',
        icon: ICON_OPTIONS_OUTLINE,
      },
      { route: '/settings/holidays', labelKey: 'nav.holidays', icon: 'calendar-clear-outline' },
      { route: '/settings/working-days', labelKey: 'nav.workingDays', icon: ICON_CALENDAR_OUTLINE },
      {
        route: '/settings/two-factor',
        labelKey: 'TWO_FACTOR_CONFIG.TITLE',
        icon: 'shield-outline',
      },
      {
        route: '/auth/forgot-password',
        labelKey: 'FORGOT_PASSWORD.TITLE',
        icon: ICON_LOCK_CLOSED_OUTLINE,
      },
    ],
  },
  {
    labelKey: 'nav.tellerOperations',
    children: [
      { route: '/tellers', labelKey: 'nav.tellers', icon: 'storefront-outline' },
      {
        route: '/tellers/cashier-journals',
        labelKey: 'nav.cashierJournals',
        icon: 'book-outline',
      },
    ],
  },
  {
    labelKey: 'nav.organization',
    children: [
      { route: '/organization/offices', labelKey: 'nav.offices', icon: ICON_BUSINESS_OUTLINE },
      { route: '/organization/staff', labelKey: 'nav.staff', icon: 'id-card-outline' },
      { route: '/organization/funds', labelKey: 'nav.funds', icon: ICON_WALLET_OUTLINE },
      {
        route: '/organization/payment-types',
        labelKey: 'nav.paymentTypes',
        icon: 'cash-outline',
      },
      {
        route: '/organization/group-levels',
        labelKey: 'nav.groupLevels',
        icon: ICON_GIT_NETWORK_OUTLINE,
      },
      {
        route: '/organization/currencies',
        labelKey: 'nav.currencies',
        icon: ICON_SWAP_HORIZONTAL_OUTLINE,
      },
      {
        route: '/organization/account-number-formats',
        labelKey: 'nav.accountNumberFormats',
        icon: 'list-outline',
      },
      {
        route: '/organization/office-transactions',
        labelKey: 'OFFICE_TRANSACTIONS.TITLE',
        icon: ICON_SWAP_HORIZONTAL_OUTLINE,
      },
    ],
  },
  {
    labelKey: 'nav.system',
    requiredPermissions: ['READ_DATATABLE', 'READ_HOOK'],
    children: [
      { route: '/system/data-tables', labelKey: 'nav.dataTables', icon: ICON_GRID_OUTLINE },
      { route: '/system/bulk-import', labelKey: 'nav.bulkImport', icon: 'cloud-upload-outline' },
      { route: '/system/delinquency', labelKey: 'nav.delinquency', icon: 'hammer-outline' },
      { route: '/system/hooks', labelKey: 'nav.hooks', icon: ICON_GIT_NETWORK_OUTLINE },
      {
        route: '/system/credit-bureau-config',
        labelKey: 'nav.creditBureauConfig',
        icon: 'card-outline',
      },
      { route: '/system/adhoc-query', labelKey: 'nav.adhocQuery', icon: 'analytics-outline' },
      { route: '/system/sms', labelKey: 'nav.sms', icon: 'chatbubble-outline' },
      {
        route: '/system/report-mailing-jobs',
        labelKey: 'nav.reportMailingJobs',
        icon: 'mail-open-outline',
      },
      {
        route: '/system/entity-data-table-checks',
        labelKey: 'nav.entityDataTableChecks',
        icon: 'checkbox-outline',
      },
      {
        route: '/system/entity-mapping',
        labelKey: 'nav.entityMapping',
        icon: ICON_GIT_NETWORK_OUTLINE,
      },
      {
        route: '/system/scheduler-jobs',
        labelKey: 'nav.schedulerJobs',
        icon: ICON_TIME_OUTLINE,
      },
      {
        route: '/system/permissions',
        labelKey: 'nav.permissions',
        icon: 'shield-checkmark-outline',
      },
      {
        route: '/system/business-steps',
        labelKey: 'nav.businessSteps',
        icon: ICON_OPTIONS_OUTLINE,
      },
      { route: '/system/cache', labelKey: 'nav.cache', icon: 'hardware-chip-outline' },
      {
        route: '/system/external-events',
        labelKey: 'nav.externalEvents',
        icon: ICON_CALENDAR_OUTLINE,
      },
      {
        route: '/system/external-services',
        labelKey: 'nav.externalServices',
        icon: 'cloud-outline',
      },
      {
        route: '/system/password-preferences',
        labelKey: 'nav.passwordPreferences',
        icon: 'key-outline',
      },
      {
        route: '/system/notifications-config',
        labelKey: 'nav.notificationsConfig',
        icon: 'notifications-outline',
      },
      {
        route: '/system/instance-mode',
        labelKey: 'nav.instanceMode',
        icon: ICON_OPTIONS_OUTLINE,
      },
      { route: '/system/oidc-config', labelKey: 'nav.oidcConfig', icon: 'key-outline' },
      {
        route: '/system/field-configuration',
        labelKey: 'nav.fieldConfiguration',
        icon: ICON_GRID_OUTLINE,
      },
      {
        route: '/system/loan-product-details',
        labelKey: 'nav.loanProductDetails',
        icon: ICON_DOCUMENT_TEXT_OUTLINE,
      },
      { route: '/system/codes', labelKey: 'nav.codes', icon: 'code-slash-outline' },
      {
        route: '/system/business-dates',
        labelKey: 'nav.businessDates',
        icon: 'today-outline',
      },
      { route: '/system/templates', labelKey: 'nav.templates', icon: ICON_DOCUMENT_TEXT_OUTLINE },
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

  /** The full, unfiltered navigation tree. */
  readonly navConfig: readonly NavItemConfig[] = NAV_CONFIG;

  /** `labelKey`s this deployment hides outright, whatever the user's permissions. */
  private readonly hidden = computed(() => new Set(this.overrides().hidden ?? []));

  /**
   * Reactive, filtered navigation tree — recomputed whenever the current
   * user's permissions, the institution type, or the deployment's configuration change.
   */
  readonly filteredNavItems = computed(() => {
    // Access the signals so this computed re-evaluates when any of them changes.
    this.authService.currentUser();
    this.institutionConfig.institutionType();
    this.config.rbacEnabled();
    this.hidden();
    return filterNavItems(NAV_CONFIG, (item) => this.isItemVisible(item));
  });

  private isItemVisible(item: NavItemConfig): boolean {
    // Checked before the RBAC short-circuit: hiding an entry is what this deployment offers,
    // which is a separate question from what this user is allowed to reach.
    if (this.hidden().has(item.labelKey)) {
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
      !this.authService.hasPermission(
        item.requiredPermissions,
        item.requiredAllPermissions ?? false,
      )
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

    return flattenNavRoutes(this.filteredNavItems())
      .filter((entry) => entry.route !== '/search')
      .map((entry) => ({
        route: entry.route,
        label: this.i18n.translate(entry.labelKey),
        groupLabel: entry.groupLabelKey ? this.i18n.translate(entry.groupLabelKey) : undefined,
        icon: entry.icon,
      }))
      .filter((result) => {
        const haystack = [result.label, result.groupLabel].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, limit);
  }
}
