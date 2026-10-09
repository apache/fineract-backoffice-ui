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
import { provideFakeAdapters } from '../../testing/adapters';

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
    expect(result).toHaveLength(1);
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
      {
        labelKey: 'nav.products',
        children: [{ route: '/products/loan', labelKey: 'nav.loanProducts' }],
      },
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
  const findItem = (items: readonly NavItemConfig[], id: string): NavItemConfig | undefined => {
    for (const item of items) {
      if (item.id === id) return item;
      const nested = item.children ? findItem(item.children, id) : undefined;
      if (nested) return nested;
    }
    return undefined;
  };

  const COB_TOOLS_ROUTE = '/admin/cob-tools';
  const PLACE_LOCK_ROUTE = '/working-capital/loans/account-locks';
  const SECURITY_USERS_ROUTE = '/security/users';
  const ACCOUNTING_CHART_ROUTE = '/accounting/chart-of-accounts';
  const TRANSFER_HISTORY_ROUTE = '/transfers/history';

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
        // searchRoutes matches on the translated label, because that is what the user
        // typed; the fake adapter echoes the key, which is enough to exercise the match.
        ...provideFakeAdapters().providers,
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

  it('organizes all destinations into clear work areas without changing their routes', () => {
    expect(service.navConfig.map((item) => item.id)).toEqual([
      'dashboard',
      'workspace',
      'client-services',
      'lending',
      'products-and-accounts',
      'operations',
      'finance',
      'administration',
    ]);
    expect(findRoute(service.navConfig, '/notifications')).toBe(true);
    expect(findRoute(service.navConfig, '/clients')).toBe(true);
    expect(findRoute(service.navConfig, '/loans')).toBe(true);
    expect(findRoute(service.navConfig, '/working-capital/loans')).toBe(true);
    expect(findRoute(service.navConfig, '/products/loan')).toBe(true);
    expect(findRoute(service.navConfig, '/products/savings-accounts')).toBe(true);
    expect(findRoute(service.navConfig, '/transfers/history')).toBe(true);
    expect(findRoute(service.navConfig, '/accounting/journal-entries')).toBe(true);
    expect(findRoute(service.navConfig, '/system/data-tables')).toBe(true);
  });

  it('separates account destinations from product setup while retaining stable item ids', () => {
    const catalog = findItem(service.navConfig, 'products');
    const accounts = findItem(service.navConfig, 'accounts');

    expect(catalog?.children?.some((item) => item.id === 'products.loan')).toBe(true);
    expect(catalog?.children?.some((item) => item.id === 'products.savings-accounts')).toBe(false);
    expect(accounts?.children?.map((item) => item.id)).toEqual([
      'products.savings-accounts',
      'products.fixed-deposits',
      'products.recurring-deposits',
      'products.shares',
    ]);
  });

  it('shows everything when rbacEnabled is false, regardless of permissions', () => {
    TestBed.resetTestingModule();
    configure({ rbacEnabled: false });
    setPermissions([]);
    const items = service.filteredNavItems();
    expect(findRoute(items, SECURITY_USERS_ROUTE)).toBe(true);
    expect(findRoute(items, ACCOUNTING_CHART_ROUTE)).toBe(true);
  });

  it('hides permission-gated groups from a user with no matching permissions', () => {
    setPermissions(['READ_CLIENT']);
    const items = service.filteredNavItems();
    expect(findRoute(items, SECURITY_USERS_ROUTE)).toBe(false);
    expect(findRoute(items, ACCOUNTING_CHART_ROUTE)).toBe(false);
    // ungated items remain
    expect(findRoute(items, '/dashboard')).toBe(true);
  });

  it('shows the entries a permission covers, and only those, within a gated group', () => {
    setPermissions(['READ_USER']);
    const items = service.filteredNavItems();
    expect(findRoute(items, SECURITY_USERS_ROUTE)).toBe(true);
    // Every entry now carries the permission its own route declares, so a sibling the user
    // cannot open stays hidden rather than riding in on a group-level gate.
    expect(findRoute(items, '/security/roles')).toBe(false);
    expect(findRoute(items, '/security/audits')).toBe(false);
    // other gated groups the user lacks permissions for stay hidden
    expect(findRoute(items, ACCOUNTING_CHART_ROUTE)).toBe(false);
  });

  it('a superuser (ALL_FUNCTIONS) sees every permission-gated group', () => {
    setPermissions(['ALL_FUNCTIONS']);
    const items = service.filteredNavItems();
    expect(findRoute(items, SECURITY_USERS_ROUTE)).toBe(true);
    expect(findRoute(items, ACCOUNTING_CHART_ROUTE)).toBe(true);
    expect(findRoute(items, '/system/data-tables')).toBe(true);
  });

  it('filters institution-feature items by institution type', () => {
    setPermissions(['ALL_FUNCTIONS']);
    institutionConfig.setInstitutionType('cb');
    const items = service.filteredNavItems();
    expect(findRoute(items, '/groups')).toBe(false);
    expect(findRoute(items, '/centers')).toBe(false);
    expect(findRoute(items, '/collection-sheet')).toBe(false);
    expect(findRoute(items, '/clients')).toBe(true);
  });

  describe('deployment navigation overrides', () => {
    it('hides the entries the deployment names by id, leaving the rest alone', () => {
      TestBed.resetTestingModule();
      configure({ nav: { hidden: ['groups', 'centers'] } });
      setPermissions(['ALL_FUNCTIONS']);

      const items = service.filteredNavItems();
      expect(findRoute(items, '/groups')).toBe(false);
      expect(findRoute(items, '/centers')).toBe(false);
      expect(findRoute(items, '/clients')).toBe(true);
    });

    it('hides an entry even where RBAC is off', () => {
      // What a deployment offers is a different question from what a user may reach, so the
      // switch that answers the second one must not answer the first.
      TestBed.resetTestingModule();
      configure({ rbacEnabled: false, nav: { hidden: ['groups'] } });
      setPermissions([]);

      const items = service.filteredNavItems();
      expect(findRoute(items, '/groups')).toBe(false);
      expect(findRoute(items, '/clients')).toBe(true);
    });

    it('ignores a labelKey where an id is required', () => {
      // `hidden` used to match on labelKey, which upstream renames freely — so an override
      // silently stopped matching and the hidden entry reappeared in production. Only the stable
      // id works now, and the old key has to be inert rather than quietly half-supported.
      TestBed.resetTestingModule();
      configure({ nav: { hidden: ['nav.groups'] } });
      setPermissions(['ALL_FUNCTIONS']);

      expect(findRoute(service.filteredNavItems(), '/groups')).toBe(true);
    });

    it('reports an override naming an id that does not exist', () => {
      TestBed.resetTestingModule();
      configure({ nav: { overrides: { 'nav.groups': { labelKey: 'Teams' } } } });
      setPermissions(['ALL_FUNCTIONS']);

      expect(service.navConfigDefects()).toEqual([
        expect.objectContaining({ code: 'unknown-id', id: 'nav.groups' }),
      ]);
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
      expect(findRoute(items, INTEROP_PARTIES_ROUTE)).toBe(false);
      expect(findRoute(items, INTEROP_QUOTES_ROUTE)).toBe(false);
      expect(findRoute(items, INTEROP_TRANSFERS_ROUTE)).toBe(false);
      expect(findRoute(items, CAMPAIGNS_EMAIL_ROUTE)).toBe(false);
      expect(findRoute(items, CAMPAIGNS_SMS_ROUTE)).toBe(false);
      expect(findRoute(items, WC_LOANS_ROUTE)).toBe(false);
      expect(findRoute(items, WC_LOAN_PRODUCTS_ROUTE)).toBe(false);
      expect(findRoute(items, WC_BREACH_ROUTE)).toBe(false);
      expect(findRoute(items, WC_NEAR_BREACH_ROUTE)).toBe(false);
      expect(findRoute(items, ACCOUNT_TRANSFER_ROUTE)).toBe(false);
      expect(findRoute(items, STANDING_INSTRUCTIONS_ROUTE)).toBe(false);
      expect(findRoute(items, STANDING_INSTRUCTIONS_HISTORY_ROUTE)).toBe(false);

      // These were the ungated siblings when this test was written. Every routed entry now
      // carries its route's permission, so a user with none of them sees none of these either.
      expect(findRoute(items, '/interop/accounts')).toBe(false);
      expect(findRoute(items, '/interop/health')).toBe(false);
      expect(findRoute(items, '/campaigns/email-messages')).toBe(false);
      expect(findRoute(items, '/working-capital/loans/cob-catchup')).toBe(false);
      expect(findRoute(items, TRANSFER_HISTORY_ROUTE)).toBe(false);

      // Hidden for a different reason than the twelve above: these drive Fineract's
      // /v1/internal endpoints and are gated by `developerToolsEnabled`, not by permission.
      expect(findRoute(items, '/working-capital/loans/account-locks')).toBe(false);
      expect(findRoute(items, '/admin/wc-cob-tools')).toBe(false);
    });

    it('shows only the specific interop routes the user has permission for', () => {
      setPermissions(['READ_INTERID']);
      const items = service.filteredNavItems();
      expect(findRoute(items, INTEROP_PARTIES_ROUTE)).toBe(true);
      expect(findRoute(items, INTEROP_QUOTES_ROUTE)).toBe(false);
      expect(findRoute(items, INTEROP_TRANSFERS_ROUTE)).toBe(false);
    });

    it('shows only the specific campaign routes the user has permission for', () => {
      setPermissions(['READ_SMSCAMPAIGN']);
      const items = service.filteredNavItems();
      expect(findRoute(items, CAMPAIGNS_SMS_ROUTE)).toBe(true);
      expect(findRoute(items, CAMPAIGNS_EMAIL_ROUTE)).toBe(false);
    });

    it('shows only the specific working capital routes the user has permission for', () => {
      setPermissions(['READ_WORKINGCAPITALBREACH']);
      const items = service.filteredNavItems();
      expect(findRoute(items, WC_BREACH_ROUTE)).toBe(true);
      expect(findRoute(items, WC_LOANS_ROUTE)).toBe(false);
      expect(findRoute(items, WC_LOAN_PRODUCTS_ROUTE)).toBe(false);
      expect(findRoute(items, WC_NEAR_BREACH_ROUTE)).toBe(false);
    });

    it('separates reading transfers from making one', () => {
      // The Account Transfer screen is a form that posts a transfer, so it needs
      // CREATE_ACCOUNTTRANSFER. READ_ACCOUNTTRANSFER opens the history and nothing else —
      // offering the form to a user who can only read would lead straight to a refusal.
      setPermissions(['READ_ACCOUNTTRANSFER']);
      let items = service.filteredNavItems();
      expect(findRoute(items, TRANSFER_HISTORY_ROUTE)).toBe(true);
      expect(findRoute(items, ACCOUNT_TRANSFER_ROUTE)).toBe(false);
      expect(findRoute(items, STANDING_INSTRUCTIONS_ROUTE)).toBe(false);

      setPermissions(['CREATE_ACCOUNTTRANSFER']);
      items = service.filteredNavItems();
      expect(findRoute(items, ACCOUNT_TRANSFER_ROUTE)).toBe(true);
      expect(findRoute(items, TRANSFER_HISTORY_ROUTE)).toBe(false);
    });

    it('shows both Standing Instructions routes once the user has READ_STANDINGINSTRUCTION', () => {
      setPermissions(['READ_STANDINGINSTRUCTION']);
      const items = service.filteredNavItems();
      expect(findRoute(items, STANDING_INSTRUCTIONS_ROUTE)).toBe(true);
      expect(findRoute(items, STANDING_INSTRUCTIONS_HISTORY_ROUTE)).toBe(true);
      expect(findRoute(items, ACCOUNT_TRANSFER_ROUTE)).toBe(false);
    });

    it('a superuser (ALL_FUNCTIONS) sees all 12 newly-gated routes', () => {
      setPermissions(['ALL_FUNCTIONS']);
      const items = service.filteredNavItems();
      expect(findRoute(items, INTEROP_PARTIES_ROUTE)).toBe(true);
      expect(findRoute(items, INTEROP_QUOTES_ROUTE)).toBe(true);
      expect(findRoute(items, INTEROP_TRANSFERS_ROUTE)).toBe(true);
      expect(findRoute(items, CAMPAIGNS_EMAIL_ROUTE)).toBe(true);
      expect(findRoute(items, CAMPAIGNS_SMS_ROUTE)).toBe(true);
      expect(findRoute(items, WC_LOANS_ROUTE)).toBe(true);
      expect(findRoute(items, WC_LOAN_PRODUCTS_ROUTE)).toBe(true);
      expect(findRoute(items, WC_BREACH_ROUTE)).toBe(true);
      expect(findRoute(items, WC_NEAR_BREACH_ROUTE)).toBe(true);
      expect(findRoute(items, ACCOUNT_TRANSFER_ROUTE)).toBe(true);
      expect(findRoute(items, STANDING_INSTRUCTIONS_ROUTE)).toBe(true);
      expect(findRoute(items, STANDING_INSTRUCTIONS_HISTORY_ROUTE)).toBe(true);
    });
  });

  describe('route permission parity', () => {
    it('shows a read-only user the lists and none of the forms', () => {
      // ALL_FUNCTIONS_READ admits a request only when every required code is a READ_* one, so
      // gating list and form routes on different codes is what makes this distinction work.
      setPermissions(['ALL_FUNCTIONS_READ']);
      const items = service.filteredNavItems();
      expect(findRoute(items, '/clients')).toBe(true);
      expect(findRoute(items, '/loans')).toBe(true);
      expect(findRoute(items, ACCOUNTING_CHART_ROUTE)).toBe(true);
      // Write-only entries: no READ_* code covers them, so the read-only shortcut does not apply.
      expect(findRoute(items, '/transfers/account-transfer')).toBe(false);
      expect(findRoute(items, '/loans/schedule-modify')).toBe(false);
      expect(findRoute(items, '/system/external-services')).toBe(false);
    });

    it('hides a whole group when the user holds none of its entries permissions', () => {
      setPermissions(['READ_CLIENT']);
      const items = service.filteredNavItems();
      expect(findRoute(items, '/clients')).toBe(true);
      // filterNavItems drops a group once every child is filtered out; with only READ_CLIENT
      // the accounting group has nothing left to show.
      expect(items.some((item) => item.labelKey === 'nav.accounting')).toBe(false);
      expect(items.some((item) => item.labelKey === 'nav.security')).toBe(false);
    });

    it('does not let one permission leak a sibling entry in the same group', () => {
      setPermissions(['READ_OFFICE']);
      const items = service.filteredNavItems();
      expect(findRoute(items, '/organization/offices')).toBe(true);
      expect(findRoute(items, '/organization/staff')).toBe(false);
      expect(findRoute(items, '/organization/funds')).toBe(false);
      expect(findRoute(items, '/organization/payment-types')).toBe(false);
    });

    it('leaves the self-service entries reachable to a user with no permissions at all', () => {
      // These carry no gate by design; a user refused everywhere else must still land
      // somewhere and be able to reach their own profile.
      setPermissions([]);
      const items = service.filteredNavItems();
      expect(findRoute(items, '/dashboard')).toBe(true);
      expect(findRoute(items, '/profile')).toBe(true);
      expect(findRoute(items, '/search')).toBe(true);
      expect(findRoute(items, '/notifications')).toBe(true);
    });

    it('never treats an unknown permission code as a wildcard', () => {
      setPermissions(['NOT_A_REAL_PERMISSION']);
      const items = service.filteredNavItems();
      expect(findRoute(items, '/clients')).toBe(false);
      expect(findRoute(items, ACCOUNTING_CHART_ROUTE)).toBe(false);
    });
  });

  describe('isItemVisible (synthetic items)', () => {
    const isVisible = (item: NavItemConfig): boolean =>
      (service as unknown as { isItemVisible: (i: NavItemConfig) => boolean }).isItemVisible(item);

    it('is always visible when it has no permission or feature gate', () => {
      setPermissions([]);
      expect(isVisible({ route: '/x', labelKey: 'x' })).toBe(true);
    });

    it('respects requiredAllPermissions (AND) semantics', () => {
      setPermissions(['READ_CLIENT', 'CREATE_CLIENT']);
      const item: NavItemConfig = {
        route: '/x',
        labelKey: 'x',
        requiredPermissions: ['READ_CLIENT', 'CREATE_CLIENT'],
        requiredAllPermissions: true,
      };
      expect(isVisible(item)).toBe(true);

      setPermissions(['READ_CLIENT']);
      expect(isVisible(item)).toBe(false);
    });

    it('defaults to OR semantics for a requiredPermissions array', () => {
      setPermissions(['READ_CLIENT']);
      const item: NavItemConfig = {
        route: '/x',
        labelKey: 'x',
        requiredPermissions: ['READ_CLIENT', 'CREATE_CLIENT'],
      };
      expect(isVisible(item)).toBe(true);
    });

    it('hides an item when the user has none of the required permissions', () => {
      setPermissions(['READ_LOAN']);
      expect(isVisible({ route: '/x', labelKey: 'x', requiredPermissions: 'READ_CLIENT' })).toBe(
        false,
      );
    });

    it('does not let ALL_FUNCTIONS_READ satisfy a non-READ_* gate', () => {
      setPermissions(['ALL_FUNCTIONS_READ']);
      expect(isVisible({ route: '/x', labelKey: 'x', requiredPermissions: 'READ_CLIENT' })).toBe(
        true,
      );
      expect(isVisible({ route: '/x', labelKey: 'x', requiredPermissions: 'CREATE_CLIENT' })).toBe(
        false,
      );
    });
  });

  describe('developer tools', () => {
    /**
     * These screens drive Fineract's /v1/internal endpoints, which the backend serves only under
     * its test Spring profile and which answer 404 on a normal deployment.
     */
    it('hides the internal-endpoint screens by default', () => {
      TestBed.resetTestingModule();
      configure();
      setPermissions(['ALL_FUNCTIONS']);

      expect(findRoute(service.filteredNavItems(), COB_TOOLS_ROUTE)).toBe(false);
      expect(findRoute(service.filteredNavItems(), PLACE_LOCK_ROUTE)).toBe(false);
    });

    it('shows them when the deployment opts in', () => {
      TestBed.resetTestingModule();
      configure({ developerToolsEnabled: true });
      setPermissions(['ALL_FUNCTIONS']);

      expect(findRoute(service.filteredNavItems(), COB_TOOLS_ROUTE)).toBe(true);
      expect(findRoute(service.filteredNavItems(), PLACE_LOCK_ROUTE)).toBe(true);
    });

    /**
     * Turning RBAC off means "show this user everything they may reach", not "expose endpoints
     * this deployment cannot serve" — so the developer-tool check sits before that short-circuit.
     */
    it('keeps them hidden even when RBAC is disabled', () => {
      TestBed.resetTestingModule();
      configure({ rbacEnabled: false });

      expect(findRoute(service.filteredNavItems(), COB_TOOLS_ROUTE)).toBe(false);
      expect(findRoute(service.filteredNavItems(), SECURITY_USERS_ROUTE)).toBe(true);
    });
  });

  describe('searchRoutes', () => {
    it('returns matching navigation shortcuts from the filtered tree', () => {
      setPermissions(['ALL_FUNCTIONS']);
      const results = service.searchRoutes('offices');
      expect(results.some((result) => result.route === '/organization/offices')).toBe(true);
      expect(results[0]?.label).toBeTruthy();
    });

    it('excludes routes the user cannot access', () => {
      setPermissions([]);
      const results = service.searchRoutes('users');
      expect(results.some((result) => result.route === '/security/users')).toBe(false);
    });

    it('does not return the global search page itself', () => {
      setPermissions(['ALL_FUNCTIONS']);
      const results = service.searchRoutes('search');
      expect(results.some((result) => result.route === '/search')).toBe(false);
    });

    /**
     * Matching the section name is useful — typing "organization" should surface that
     * section's pages — but it must never outrank a page named for the query itself,
     * or a small limit gets filled with siblings before the page the user asked for.
     */
    it('ranks a page whose own name matches above one matched by its section', () => {
      setPermissions(['ALL_FUNCTIONS']);

      const results = service.searchRoutes('offices');
      const officesIndex = results.findIndex((result) => result.route === '/organization/offices');
      const siblingIndex = results.findIndex(
        (result) => result.groupLabel && !result.label.toLowerCase().includes('offices'),
      );

      expect(officesIndex).toBe(0);
      if (siblingIndex !== -1) {
        expect(officesIndex).toBeLessThan(siblingIndex);
      }
    });

    it('honours the limit', () => {
      setPermissions(['ALL_FUNCTIONS']);
      expect(service.searchRoutes('a', 3).length).toBeLessThanOrEqual(3);
    });
  });

  describe('navDestinationsForPermissions', () => {
    const routes = (permissions: string[]) =>
      service.navDestinationsForPermissions(permissions).map((entry) => entry.route);

    it('answers for the permissions passed in, not the signed-in user', () => {
      setPermissions([]);
      expect(routes(['READ_USER'])).toContain(SECURITY_USERS_ROUTE);
    });

    it('omits a destination the permissions do not cover', () => {
      setPermissions(['ALL_FUNCTIONS']);
      expect(routes(['READ_USER'])).not.toContain(ACCOUNTING_CHART_ROUTE);
    });

    it('keeps ungated destinations for an empty permission set', () => {
      expect(routes([])).toContain('/dashboard');
      expect(routes([])).not.toContain(SECURITY_USERS_ROUTE);
    });

    it('trims the trailing spaces Fineract seed data carries on some codes', () => {
      expect(routes(['READ_USER '])).toContain(SECURITY_USERS_ROUTE);
    });

    it('honours ALL_FUNCTIONS', () => {
      const all = routes(['ALL_FUNCTIONS']);
      expect(all).toContain(SECURITY_USERS_ROUTE);
      expect(all).toContain(ACCOUNTING_CHART_ROUTE);
    });

    it('carries the label and group needed to name a destination', () => {
      const entry = service
        .navDestinationsForPermissions(['READ_USER'])
        .find((item) => item.route === SECURITY_USERS_ROUTE);
      expect(entry?.labelKey).toBeTruthy();
    });

    it('returns the whole tree when the deployment has RBAC turned off', () => {
      TestBed.resetTestingModule();
      configure({ rbacEnabled: false });
      expect(routes([])).toContain(SECURITY_USERS_ROUTE);
    });
  });
});
