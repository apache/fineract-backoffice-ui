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
import { describe, expect, it } from 'vitest';
import { buildAccountBreadcrumbs, buildBreadcrumbs } from './breadcrumb';
import type { AccountBreadcrumbData } from './breadcrumb';

/** Builds a minimal linked chain of snapshot-shaped nodes, root first. */
function chain(nodes: { segment?: string; title?: string }[]): ActivatedRouteSnapshot {
  const snapshots = nodes.map(
    (n) =>
      ({
        url: n.segment ? n.segment.split('/').map((path) => ({ path })) : [],
        routeConfig: n.title ? { title: n.title } : null,
        firstChild: null,
      }) as unknown as ActivatedRouteSnapshot,
  );
  for (let i = 0; i < snapshots.length - 1; i++) {
    (snapshots[i] as { firstChild: ActivatedRouteSnapshot }).firstChild = snapshots[i + 1];
  }
  return snapshots[0];
}

describe('buildBreadcrumbs', () => {
  it('returns nothing for a root with no titled segments', () => {
    expect(buildBreadcrumbs(chain([{}]))).toEqual([]);
  });

  it('builds one crumb per titled segment, accumulating the URL', () => {
    const root = chain([
      { segment: '', title: undefined },
      { segment: 'clients', title: 'nav.clients' },
      { segment: 'view/5', title: 'CLIENTS.DETAILS' },
    ]);

    expect(buildBreadcrumbs(root)).toEqual([
      { label: { kind: 'translation', key: 'nav.clients' }, url: '/clients' },
      { label: { kind: 'translation', key: 'CLIENTS.DETAILS' }, url: '/clients/view/5' },
    ]);
  });

  it('collapses an outer route and its empty-path child sharing the same title', () => {
    const root = chain([
      { segment: '', title: undefined },
      { segment: 'clients', title: 'nav.clients' },
      { segment: '', title: 'nav.clients' },
    ]);

    expect(buildBreadcrumbs(root)).toEqual([
      { label: { kind: 'translation', key: 'nav.clients' }, url: '/clients' },
    ]);
  });

  it('keeps two non-adjacent crumbs that happen to share a title', () => {
    const root = chain([
      { segment: 'a', title: 'SAME' },
      { segment: 'b', title: 'OTHER' },
      { segment: 'c', title: 'SAME' },
    ]);

    expect(buildBreadcrumbs(root)).toEqual([
      { label: { kind: 'translation', key: 'SAME' }, url: '/a' },
      { label: { kind: 'translation', key: 'OTHER' }, url: '/a/b' },
      { label: { kind: 'translation', key: 'SAME' }, url: '/a/b/c' },
    ]);
  });
});

describe('buildAccountBreadcrumbs', () => {
  it.each(['client', 'group'] as const)(
    'builds links for a %s owner and preserves the literal name',
    (type) => {
      const path = type === 'client' ? '/clients' : '/groups';
      expect(
        buildAccountBreadcrumbs({
          owner: { type, id: 42, name: 'Navigation Test' },
          accountType: 'loan',
          accountNo: '000000001',
        }),
      ).toEqual([
        {
          label: { kind: 'translation', key: type === 'client' ? 'nav.clients' : 'nav.groups' },
          url: path,
        },
        { label: { kind: 'text', text: 'Navigation Test' }, url: `${path}/view/42` },
        {
          label: {
            kind: 'translation',
            key: 'BREADCRUMBS.LOAN_ACCOUNT',
            params: { accountNo: '000000001' },
          },
        },
      ]);
    },
  );

  it.each<[AccountBreadcrumbData['accountType'], string]>([
    ['loan', 'BREADCRUMBS.LOAN_ACCOUNT'],
    ['savings', 'BREADCRUMBS.SAVINGS_ACCOUNT'],
    ['fixed-deposit', 'BREADCRUMBS.FIXED_DEPOSIT'],
    ['recurring-deposit', 'BREADCRUMBS.RECURRING_DEPOSIT'],
    ['share', 'BREADCRUMBS.SHARE_ACCOUNT'],
  ])('uses the translated account label for %s', (accountType, key) => {
    const crumbs = buildAccountBreadcrumbs({
      owner: { type: 'client', id: 42, name: 'Navigation Test' },
      accountType,
      accountNo: '000000001',
    });
    expect(crumbs.at(-1)).toEqual({
      label: { kind: 'translation', key, params: { accountNo: '000000001' } },
    });
  });
});
