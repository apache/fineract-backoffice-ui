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

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService, UserSession } from './auth.service';
import { InstitutionConfigService } from './institution-config.service';
import {
  NavigationConfigService,
  NavItemConfig,
  filterNavItems,
  flattenNavRoutes,
} from './navigation-config.service';
import type { AppConfig } from './config.service';
import { provideTestConfig } from '../../testing/config';

describe('filterNavItems (pure function)', () => {
  const alwaysVisible = () => true;
  const neverVisible = () => false;

  it('keeps a leaf item the predicate approves', () => {
    const items: NavItemConfig[] = [{ route: '/a', labelKey: 'a' }];
    expect(filterNavItems(items, alwaysVisible)).toEqual(items);
  });

  it('drops a leaf item the predicate rejects', () => {
    const items: NavItemConfig[] = [{ route: '/a', labelKey: 'a' }];
    expect(filterNavItems(items, neverVisible)).toEqual([]);
  });

  it('always passes dividers through regardless of the predicate', () => {
    const items: NavItemConfig[] = [{ labelKey: '', divider: true }];
    expect(filterNavItems(items, neverVisible)).toEqual(items);
  });

  it('recursively filters children and keeps the group when some remain', () => {
    const items: NavItemConfig[] = [
      {
        labelKey: 'group',
        children: [
          { route: '/visible', labelKey: 'visible' },
          { route: '/hidden', labelKey: 'hidden' },
        ],
      },
    ];
    const isVisible = (item: NavItemConfig) => item.route !== '/hidden';

    const result = filterNavItems(items, isVisible);
    expect(result).toHaveSize(1);
    expect(result[0].children).toEqual([{ route: '/visible', labelKey: 'visible' }]);
  });

  it('drops a group entirely when every child is filtered out', () => {
    const items: NavItemConfig[] = [
      {
        labelKey: 'group',
        children: [
          { route: '/a', labelKey: 'a' },
          { route: '/b', labelKey: 'b' },
        ],
      },
    ];
    expect(filterNavItems(items, neverVisible)).toEqual([]);
  });

  it('drops a group whose predicate itself fails, without inspecting children', () => {
    const items: NavItemConfig[] = [
      {
        labelKey: 'group',
        requiredPermissions: 'READ_X',
        children: [{ route: '/a', labelKey: 'a' }],
      },
    ];
    const isVisible = (item: NavItemConfig) => item.requiredPermissions === undefined;
    expect(filterNavItems(items, isVisible)).toEqual([]);
  });
});

describe('flattenNavRoutes (pure function)', () => {
  const ORG_LABEL_KEY = 'nav.organization';
  const OFFICES_LABEL_KEY = 'nav.offices';
  const OFFICES_ROUTE = '/organization/offices';

  it('collects leaf routes and preserves the parent group label key', () => {
    const items: NavItemConfig[] = [
      {
        labelKey: ORG_LABEL_KEY,
        children: [
          { route: OFFICES_ROUTE, labelKey: OFFICES_LABEL_KEY },
          { route: '/organization/staff', labelKey: 'nav.staff' },
        ],
      },
    ];

    expect(flattenNavRoutes(items)).toEqual([
      {
        route: OFFICES_ROUTE,
        labelKey: OFFICES_LABEL_KEY,
        groupLabelKey: ORG_LABEL_KEY,
      },
      {
        route: '/organization/staff',
        labelKey: 'nav.staff',
        groupLabelKey: ORG_LABEL_KEY,
      },
    ]);
  });

  it('skips dividers and group headers without routes', () => {
    const items: NavItemConfig[] = [
      { labelKey: '', divider: true },
      { labelKey: 'nav.products', children: [{ route: '/products/loan', labelKey: 'nav.loanProducts' }] },
    ];

    expect(flattenNavRoutes(items)).toEqual([
      {
        route: '/products/loan',
        labelKey: 'nav.loanProducts',
        groupLabelKey: 'nav.products',
      },
    ]);
  });
});

describe('NavigationConfigService', () => {
  let service: NavigationConfigService;
  let authService: AuthService;
  let institutionConfig: InstitutionConfigService;

  const mockSession: UserSession = {
    username: 'mifos',
    userId: 1,
    base64EncodedAuthenticationKey: 'bWlmb3M6cGFzc3dvcmQ=',
    authenticated: true,
    officeId: 1,
    officeName: 'Head Office',
    permissions: [],
  };

  const setPermissions = (permissions: string[]) => {
    (authService as unknown as { setSession: (s: UserSession) => void }).setSession({
      ...mockSession,
      permissions,
    });
  };

  const findRoute = (items: readonly NavItemConfig[], route: string): boolean =>
    items.some(
      (item) => item.route === route || (item.children && findRoute(item.children, route)),
    );

  const SECURITY_USERS_ROUTE = '/security/users';
  const ACCOUNTING_CHART_ROUTE = '/accounting/chart-of-accounts';

  /** Configures the TestBed with the deployment configuration under test. */
  function configure(config: Partial<AppConfig> = {}): void {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        InstitutionConfigService,
        NavigationConfigService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTestConfig({ rbacEnabled: true, ...config }),
      ],
    });
    service = TestBed.inject(NavigationConfigService);
    authService = TestBed.inject(AuthService);
    institutionConfig = TestBed.inject(InstitutionConfigService);
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    configure();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('exposes the full, unfiltered navigation tree', () => {
    expect(service.navConfig.length).toBeGreaterThan(0);
  });

  it('shows everything when rbacEnabled is false, regardless of permissions', () => {
    TestBed.resetTestingModule();
    configure({ rbacEnabled: false });
    setPermissions([]);
    const items = service.filteredNavItems();
    expect(findRoute(items, SECURITY_USERS_ROUTE)).toBeTrue();
    expect(findRoute(items, ACCOUNTING_CHART_ROUTE)).toBeTrue();
  });

  it('hides permission-gated groups from a user with no matching permissions', () => {
    setPermissions(['READ_CLIENT']);
    const items = service.filteredNavItems();
    expect(findRoute(items, SECURITY_USERS_ROUTE)).toBeFalse();
    expect(findRoute(items, ACCOUNTING_CHART_ROUTE)).toBeFalse();
    // ungated items remain
    expect(findRoute(items, '/dashboard')).toBeTrue();
  });

  it('shows a permission-gated group once the user has any of its required permissions', () => {
    setPermissions(['READ_USER']);
    const items = service.filteredNavItems();
    expect(findRoute(items, SECURITY_USERS_ROUTE)).toBeTrue();
    expect(findRoute(items, '/security/roles')).toBeTrue();
    // other gated groups the user lacks permissions for stay hidden
    expect(findRoute(items, ACCOUNTING_CHART_ROUTE)).toBeFalse();
  });

  it('a superuser (ALL_FUNCTIONS) sees every permission-gated group', () => {
    setPermissions(['ALL_FUNCTIONS']);
    const items = service.filteredNavItems();
    expect(findRoute(items, SECURITY_USERS_ROUTE)).toBeTrue();
    expect(findRoute(items, ACCOUNTING_CHART_ROUTE)).toBeTrue();
    expect(findRoute(items, '/system/data-tables')).toBeTrue();
  });

  it('filters institution-feature items by institution type', () => {
    setPermissions(['ALL_FUNCTIONS']);
    institutionConfig.setInstitutionType('cb');
    const items = service.filteredNavItems();
    expect(findRoute(items, '/groups')).toBeFalse();
    expect(findRoute(items, '/centers')).toBeFalse();
    expect(findRoute(items, '/collection-sheet')).toBeFalse();
    expect(findRoute(items, '/clients')).toBeTrue();
  });

  describe('deployment navigation overrides', () => {
    it('hides the entries config.json names, leaving the rest alone', () => {
      TestBed.resetTestingModule();
      configure({ nav: { hidden: ['nav.groups', 'nav.centers'] } });
      setPermissions(['ALL_FUNCTIONS']);

      const items = service.filteredNavItems();
      expect(findRoute(items, '/groups')).toBeFalse();
      expect(findRoute(items, '/centers')).toBeFalse();
      expect(findRoute(items, '/clients')).toBeTrue();
    });

    it('hides an entry even where RBAC is off', () => {
      // What a deployment offers is a different question from what a user may reach, so the
      // switch that answers the second one must not answer the first.
      TestBed.resetTestingModule();
      configure({ rbacEnabled: false, nav: { hidden: ['nav.groups'] } });
      setPermissions([]);

      const items = service.filteredNavItems();
      expect(findRoute(items, '/groups')).toBeFalse();
      expect(findRoute(items, '/clients')).toBeTrue();
    });
  });

  describe('issue #142 — Interop, Campaigns, Working Capital, Account Transfer gates', () => {
    const INTEROP_PARTIES_ROUTE = '/interop/parties';
    const INTEROP_QUOTES_ROUTE = '/interop/quotes';
    const INTEROP_TRANSFERS_ROUTE = '/interop/transfers';
    const CAMPAIGNS_EMAIL_ROUTE = '/campaigns/email';
    const CAMPAIGNS_SMS_ROUTE = '/campaigns/sms';
    const WC_LOANS_ROUTE = '/working-capital/loans';
    const WC_LOAN_PRODUCTS_ROUTE = '/working-capital/loan-products';
    const WC_BREACH_ROUTE = '/working-capital/breach';
    const WC_NEAR_BREACH_ROUTE = '/working-capital/near-breach';
    const ACCOUNT_TRANSFER_ROUTE = '/transfers/account-transfer';
    const STANDING_INSTRUCTIONS_ROUTE = '/transfers/standing-instructions';
    const STANDING_INSTRUCTIONS_HISTORY_ROUTE = '/transfers/standing-instructions/history';

    it('hides all 12 newly-gated routes from a user with no matching permissions, leaving their ungated siblings visible', () => {
      setPermissions([]);
      const items = service.filteredNavItems();

      // gated
      expect(findRoute(items, INTEROP_PARTIES_ROUTE)).toBeFalse();
      expect(findRoute(items, INTEROP_QUOTES_ROUTE)).toBeFalse();
      expect(findRoute(items, INTEROP_TRANSFERS_ROUTE)).toBeFalse();
      expect(findRoute(items, CAMPAIGNS_EMAIL_ROUTE)).toBeFalse();
      expect(findRoute(items, CAMPAIGNS_SMS_ROUTE)).toBeFalse();
      expect(findRoute(items, WC_LOANS_ROUTE)).toBeFalse();
      expect(findRoute(items, WC_LOAN_PRODUCTS_ROUTE)).toBeFalse();
      expect(findRoute(items, WC_BREACH_ROUTE)).toBeFalse();
      expect(findRoute(items, WC_NEAR_BREACH_ROUTE)).toBeFalse();
      expect(findRoute(items, ACCOUNT_TRANSFER_ROUTE)).toBeFalse();
      expect(findRoute(items, STANDING_INSTRUCTIONS_ROUTE)).toBeFalse();
      expect(findRoute(items, STANDING_INSTRUCTIONS_HISTORY_ROUTE)).toBeFalse();

      // ungated siblings within the same groups remain visible
      expect(findRoute(items, '/interop/accounts')).toBeTrue();
      expect(findRoute(items, '/interop/health')).toBeTrue();
      expect(findRoute(items, '/campaigns/email-messages')).toBeTrue();
      expect(findRoute(items, '/working-capital/loans/account-locks')).toBeTrue();
      expect(findRoute(items, '/working-capital/loans/cob-catchup')).toBeTrue();
      expect(findRoute(items, '/admin/wc-cob-tools')).toBeTrue();
      expect(findRoute(items, '/transfers/history')).toBeTrue();
    });

    it('shows only the specific interop routes the user has permission for', () => {
      setPermissions(['READ_INTERID']);
      const items = service.filteredNavItems();
      expect(findRoute(items, INTEROP_PARTIES_ROUTE)).toBeTrue();
      expect(findRoute(items, INTEROP_QUOTES_ROUTE)).toBeFalse();
      expect(findRoute(items, INTEROP_TRANSFERS_ROUTE)).toBeFalse();
    });

    it('shows only the specific campaign routes the user has permission for', () => {
      setPermissions(['READ_SMSCAMPAIGN']);
      const items = service.filteredNavItems();
      expect(findRoute(items, CAMPAIGNS_SMS_ROUTE)).toBeTrue();
      expect(findRoute(items, CAMPAIGNS_EMAIL_ROUTE)).toBeFalse();
    });

    it('shows only the specific working capital routes the user has permission for', () => {
      setPermissions(['READ_WORKINGCAPITALBREACH']);
      const items = service.filteredNavItems();
      expect(findRoute(items, WC_BREACH_ROUTE)).toBeTrue();
      expect(findRoute(items, WC_LOANS_ROUTE)).toBeFalse();
      expect(findRoute(items, WC_LOAN_PRODUCTS_ROUTE)).toBeFalse();
      expect(findRoute(items, WC_NEAR_BREACH_ROUTE)).toBeFalse();
    });

    it('shows Account Transfer once the user has READ_ACCOUNTTRANSFER, without granting sibling gates', () => {
      setPermissions(['READ_ACCOUNTTRANSFER']);
      const items = service.filteredNavItems();
      expect(findRoute(items, ACCOUNT_TRANSFER_ROUTE)).toBeTrue();
      expect(findRoute(items, STANDING_INSTRUCTIONS_ROUTE)).toBeFalse();
      // ungated sibling still visible regardless
      expect(findRoute(items, '/transfers/history')).toBeTrue();
    });

    it('shows both Standing Instructions routes once the user has READ_STANDINGINSTRUCTION', () => {
      setPermissions(['READ_STANDINGINSTRUCTION']);
      const items = service.filteredNavItems();
      expect(findRoute(items, STANDING_INSTRUCTIONS_ROUTE)).toBeTrue();
      expect(findRoute(items, STANDING_INSTRUCTIONS_HISTORY_ROUTE)).toBeTrue();
      expect(findRoute(items, ACCOUNT_TRANSFER_ROUTE)).toBeFalse();
    });

    it('a superuser (ALL_FUNCTIONS) sees all 12 newly-gated routes', () => {
      setPermissions(['ALL_FUNCTIONS']);
      const items = service.filteredNavItems();
      expect(findRoute(items, INTEROP_PARTIES_ROUTE)).toBeTrue();
      expect(findRoute(items, INTEROP_QUOTES_ROUTE)).toBeTrue();
      expect(findRoute(items, INTEROP_TRANSFERS_ROUTE)).toBeTrue();
      expect(findRoute(items, CAMPAIGNS_EMAIL_ROUTE)).toBeTrue();
      expect(findRoute(items, CAMPAIGNS_SMS_ROUTE)).toBeTrue();
      expect(findRoute(items, WC_LOANS_ROUTE)).toBeTrue();
      expect(findRoute(items, WC_LOAN_PRODUCTS_ROUTE)).toBeTrue();
      expect(findRoute(items, WC_BREACH_ROUTE)).toBeTrue();
      expect(findRoute(items, WC_NEAR_BREACH_ROUTE)).toBeTrue();
      expect(findRoute(items, ACCOUNT_TRANSFER_ROUTE)).toBeTrue();
      expect(findRoute(items, STANDING_INSTRUCTIONS_ROUTE)).toBeTrue();
      expect(findRoute(items, STANDING_INSTRUCTIONS_HISTORY_ROUTE)).toBeTrue();
    });
  });

  describe('isItemVisible (synthetic items)', () => {
    const isVisible = (item: NavItemConfig): boolean =>
      (service as unknown as { isItemVisible: (i: NavItemConfig) => boolean }).isItemVisible(item);

    it('is always visible when it has no permission or feature gate', () => {
      setPermissions([]);
      expect(isVisible({ route: '/x', labelKey: 'x' })).toBeTrue();
    });

    it('respects requiredAllPermissions (AND) semantics', () => {
      setPermissions(['READ_CLIENT', 'CREATE_CLIENT']);
      const item: NavItemConfig = {
        route: '/x',
        labelKey: 'x',
        requiredPermissions: ['READ_CLIENT', 'CREATE_CLIENT'],
        requiredAllPermissions: true,
      };
      expect(isVisible(item)).toBeTrue();

      setPermissions(['READ_CLIENT']);
      expect(isVisible(item)).toBeFalse();
    });

    it('defaults to OR semantics for a requiredPermissions array', () => {
      setPermissions(['READ_CLIENT']);
      const item: NavItemConfig = {
        route: '/x',
        labelKey: 'x',
        requiredPermissions: ['READ_CLIENT', 'CREATE_CLIENT'],
      };
      expect(isVisible(item)).toBeTrue();
    });

    it('hides an item when the user has none of the required permissions', () => {
      setPermissions(['READ_LOAN']);
      expect(
        isVisible({ route: '/x', labelKey: 'x', requiredPermissions: 'READ_CLIENT' }),
      ).toBeFalse();
    });

    it('does not let ALL_FUNCTIONS_READ satisfy a non-READ_* gate', () => {
      setPermissions(['ALL_FUNCTIONS_READ']);
      expect(
        isVisible({ route: '/x', labelKey: 'x', requiredPermissions: 'READ_CLIENT' }),
      ).toBeTrue();
      expect(
        isVisible({ route: '/x', labelKey: 'x', requiredPermissions: 'CREATE_CLIENT' }),
      ).toBeFalse();
    });
  });

  describe('searchRoutes', () => {
    it('returns matching navigation shortcuts from the filtered tree', () => {
      setPermissions(['ALL_FUNCTIONS']);
      const results = service.searchRoutes('offices');
      expect(results.some((result) => result.route === '/organization/offices')).toBeTrue();
      expect(results[0]?.label).toBeTruthy();
    });

    it('excludes routes the user cannot access', () => {
      setPermissions([]);
      const results = service.searchRoutes('users');
      expect(results.some((result) => result.route === '/security/users')).toBeFalse();
    });

    it('does not return the global search page itself', () => {
      setPermissions(['ALL_FUNCTIONS']);
      const results = service.searchRoutes('search');
      expect(results.some((result) => result.route === '/search')).toBeFalse();
    });
  });
});
