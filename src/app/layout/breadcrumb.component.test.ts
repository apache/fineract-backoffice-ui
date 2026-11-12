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

import { describe, expect, it, beforeEach } from 'vitest';
import { buildAccountBreadcrumbs } from './breadcrumb';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BreadcrumbComponent } from './breadcrumb.component';
import { provideFakeAdapters } from '../testing/adapters';
import { BreadcrumbService } from '../core/services/breadcrumb.service';

@Component({ standalone: true, template: '' })
class RouteStub {}

describe('BreadcrumbComponent', () => {
  let router: Router;
  let breadcrumbService: BreadcrumbService;
  let fixture: ComponentFixture<BreadcrumbComponent>;

  beforeEach(() => {
    const adapters = provideFakeAdapters();
    adapters.i18n.catalogue.set('nav.groups', 'Groups');
    adapters.i18n.catalogue.set('nav.clients', 'Clients');
    adapters.i18n.catalogue.set('BREADCRUMBS.LOAN_ACCOUNT', 'Loan {{accountNo}}');
    adapters.i18n.catalogue.set('GROUPS.CREATE_GROUP', 'Create Group');

    TestBed.configureTestingModule({
      imports: [BreadcrumbComponent],
      providers: [
        ...adapters.providers,
        provideRouter([
          {
            path: 'groups',
            title: 'nav.groups',
            children: [
              { path: '', component: RouteStub },
              { path: 'create', title: 'GROUPS.CREATE_GROUP', component: RouteStub },
            ],
          },
          { path: 'untitled', component: RouteStub },
        ]),
      ],
    });

    router = TestBed.inject(Router);
    breadcrumbService = TestBed.inject(BreadcrumbService);
    fixture = TestBed.createComponent(BreadcrumbComponent);
  });

  it('renders nothing for a page whose trail is a single crumb', async () => {
    await router.navigateByUrl('/untitled');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
  });

  it('links every ancestor crumb and leaves the current page as plain text', async () => {
    await router.navigateByUrl('/groups/create');
    fixture.detectChanges();

    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].textContent?.trim()).toBe('Groups');
    expect(links[0].getAttribute('href')).toBe('/groups');

    const current = fixture.nativeElement.querySelector('.current');
    expect(current?.textContent?.trim()).toBe('Create Group');
  });

  it('re-derives the trail on every navigation', async () => {
    await router.navigateByUrl('/groups/create');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav')).not.toBeNull();

    await router.navigateByUrl('/groups');
    fixture.detectChanges();
    // '/groups' collapses to a single crumb (outer + empty-path child share one title), so the
    // trail — and the element it controls — disappears again.
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
  });

  it('renders owner names literally and interpolates the account number on the current page', () => {
    breadcrumbService.setOverride(
      buildAccountBreadcrumbs({
        owner: { type: 'client', id: 42, name: 'nav.groups <b>Test</b>' },
        accountType: 'loan',
        accountNo: '000000001',
      }),
    );
    fixture.detectChanges();

    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0].textContent?.trim()).toBe('Clients');
    expect(links[0].getAttribute('href')).toBe('/clients');
    expect(links[1].textContent?.trim()).toBe('nav.groups <b>Test</b>');
    expect(links[1].getAttribute('href')).toBe('/clients/view/42');
    expect(links[1].querySelector('b')).toBeNull();
    const current = fixture.nativeElement.querySelector('[aria-current="page"]');
    expect(current?.textContent?.trim()).toBe('Loan 000000001');
    expect(current?.querySelector('a')).toBeNull();
  });

  it('uses the route trail when the service has no override', async () => {
    await router.navigateByUrl('/groups/create');
    fixture.detectChanges();

    expect(breadcrumbService.override()).toBeNull();
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].textContent?.trim()).toBe('Groups');
    expect(links[0].getAttribute('href')).toBe('/groups');
    expect(fixture.nativeElement.querySelector('[aria-current="page"]')?.textContent.trim()).toBe(
      'Create Group',
    );
  });

  it('hides an existing route trail while the override is empty', async () => {
    await router.navigateByUrl('/groups/create');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav')).not.toBeNull();

    breadcrumbService.setOverride([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();

    breadcrumbService.clearOverride();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-current="page"]')?.textContent.trim()).toBe(
      'Create Group',
    );
  });

  it('reacts to a service override without another router navigation', async () => {
    await router.navigateByUrl('/groups/create');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-current="page"]')?.textContent.trim()).toBe(
      'Create Group',
    );

    breadcrumbService.setOverride(
      buildAccountBreadcrumbs({
        owner: { type: 'client', id: 42, name: 'Navigation Test' },
        accountType: 'loan',
        accountNo: '000000001',
      }),
    );
    fixture.detectChanges();

    expect(router.url).toBe('/groups/create');
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('a');
    expect(Array.from(links, (link) => link.textContent?.trim())).toEqual([
      'Clients',
      'Navigation Test',
    ]);
    expect(links[1].getAttribute('href')).toBe('/clients/view/42');
    expect(fixture.nativeElement.querySelector('[aria-current="page"]')?.textContent.trim()).toBe(
      'Loan 000000001',
    );
  });

  it('restores the latest route trail when the override is cleared', async () => {
    await router.navigateByUrl('/groups');
    breadcrumbService.setOverride(
      buildAccountBreadcrumbs({
        owner: { type: 'client', id: 42, name: 'Navigation Test' },
        accountType: 'loan',
        accountNo: '000000001',
      }),
    );
    fixture.detectChanges();

    await router.navigateByUrl('/groups/create');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-current="page"]')?.textContent.trim()).toBe(
      'Loan 000000001',
    );

    breadcrumbService.clearOverride();
    fixture.detectChanges();

    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/groups');
    expect(links[0].textContent?.trim()).toBe('Groups');
    expect(fixture.nativeElement.querySelector('[aria-current="page"]')?.textContent.trim()).toBe(
      'Create Group',
    );
  });
});
