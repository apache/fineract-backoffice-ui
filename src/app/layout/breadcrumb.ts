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

import { ActivatedRouteSnapshot } from '@angular/router';
import type { TranslateParams } from '../core/adapters/i18n/i18n.adapter';

/** Record names are literal text; navigation labels are translated when rendered. */
export type BreadcrumbLabel =
  { kind: 'translation'; key: string; params?: TranslateParams } | { kind: 'text'; text: string };

export interface Breadcrumb {
  label: BreadcrumbLabel;
  /** Ancestors have URLs; the current page does not need a link. */
  url?: string;
}

export interface AccountBreadcrumbData {
  owner: {
    type: 'client' | 'group';
    id: number;
    name: string;
  };
  accountType: 'loan' | 'savings' | 'fixed-deposit' | 'recurring-deposit' | 'share';
  accountNo: string;
}

const ACCOUNT_LABEL_KEYS: Record<AccountBreadcrumbData['accountType'], string> = {
  loan: 'BREADCRUMBS.LOAN_ACCOUNT',
  savings: 'BREADCRUMBS.SAVINGS_ACCOUNT',
  'fixed-deposit': 'BREADCRUMBS.FIXED_DEPOSIT',
  'recurring-deposit': 'BREADCRUMBS.RECURRING_DEPOSIT',
  share: 'BREADCRUMBS.SHARE_ACCOUNT',
};

/** Builds an owner-based trail independently of the account's route or navigation history. */
export function buildAccountBreadcrumbs(data: AccountBreadcrumbData): Breadcrumb[] {
  const { owner, accountType, accountNo } = data;
  const ownerPath = owner.type === 'client' ? '/clients' : '/groups';

  return [
    {
      label: {
        kind: 'translation',
        key: owner.type === 'client' ? 'nav.clients' : 'nav.groups',
      },
      url: ownerPath,
    },
    {
      label: { kind: 'text', text: owner.name },
      url: `${ownerPath}/view/${owner.id}`,
    },
    {
      label: {
        kind: 'translation',
        key: ACCOUNT_LABEL_KEYS[accountType],
        params: { accountNo },
      },
    },
  ];
}

/**
 * Builds the breadcrumb trail for the current route tree from each level's `title` —
 * the same translation-key route data `TranslatedTitleStrategy` already sets on nearly every
 * route for the browser tab title, reused here rather than duplicated as separate route data.
 *
 * A route config is commonly split into an outer segment (`path: 'clients'`, titled) wrapping
 * an inner empty-path child (`path: ''`, titled identically) that lazy-loads the feature — both
 * would otherwise contribute the same crumb back to back, so adjacent duplicates collapse into
 * one.
 */
export function buildBreadcrumbs(root: ActivatedRouteSnapshot): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [];
  let route: ActivatedRouteSnapshot | null = root;
  let url = '';

  while (route) {
    const segment = route.url.map((s) => s.path).join('/');
    if (segment) url += `/${segment}`;

    const title = route.routeConfig?.title;
    const previousLabel = crumbs.at(-1)?.label;
    if (
      typeof title === 'string' &&
      !(previousLabel?.kind === 'translation' && previousLabel.key === title)
    ) {
      crumbs.push({ label: { kind: 'translation', key: title }, url });
    }
    route = route.firstChild;
  }

  return crumbs;
}
