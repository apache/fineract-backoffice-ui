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

import { Component, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SidebarComponent } from './sidebar.component';
import { SidebarService } from '../core/services/sidebar.service';
import { ViewportService } from '../core/services/viewport.service';
import { AuthService } from '../core/services/auth.service';
import { TranslateModule } from '@ngx-translate/core';
import { Router, RouterModule } from '@angular/router';
import { provideTranslateTesting } from '../testing/i18n-testing';

@Component({ standalone: true, template: '' })
class SidebarNavigationTestRoute {}

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let sidebarService: SidebarService;
  let isMobile: WritableSignal<boolean>;

  const panel = (): HTMLElement =>
    (fixture.nativeElement as HTMLElement).querySelector('.sidebar')!;

  // Pinned rather than inherited from jsdom's stubbed matchMedia, the same reasoning as
  // header.component.test.ts and sidebar.service.test.ts: the component renders one of two
  // unrelated things either side of the breakpoint (a permanent landmark vs. a modal dialog), so
  // which one has to be driven explicitly.
  beforeEach(async () => {
    isMobile = signal(false);

    await TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot(),
        RouterModule.forRoot([{ path: '**', component: SidebarNavigationTestRoute }]),
        SidebarComponent,
      ],
      providers: [
        ...provideTranslateTesting(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ViewportService, useValue: { isMobile } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    sidebarService = TestBed.inject(SidebarService);
    const auth = TestBed.inject(AuthService);
    (auth as unknown as { setSession: (session: object) => void }).setSession({
      username: 'test-user',
      userId: 1,
      base64EncodedAuthenticationKey: 'dGVzdDp0ZXN0',
      authenticated: true,
      officeId: 1,
      officeName: 'Head Office',
      permissions: ['ALL_FUNCTIONS'],
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render navigation links', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const navLinks = compiled.querySelectorAll('.nav-item');
    expect(navLinks.length).toBeGreaterThan(0);
  });

  describe('on a wide viewport', () => {
    it('renders as a plain navigation landmark, not a dialog', () => {
      expect(panel().getAttribute('role')).toBe('navigation');
      expect(panel().hasAttribute('aria-modal')).toBe(false);
      expect(panel().hasAttribute('inert')).toBe(false);
      expect(panel().classList.contains('drawer')).toBe(false);
    });

    it('reflects the collapsed column state, and never the drawer state', () => {
      expect(panel().classList.contains('collapsed')).toBe(false);

      sidebarService.toggle();
      fixture.detectChanges();

      expect(panel().classList.contains('collapsed')).toBe(true);
      expect(panel().classList.contains('open')).toBe(false);
    });

    it('renders no close button', () => {
      expect(panel().querySelector('.drawer-close')).toBeNull();
    });

    it('keeps group expansion independent across navigation groups', () => {
      const groupButtons = Array.from(
        panel().querySelectorAll<HTMLButtonElement>('.nav-group-button'),
      );

      expect(groupButtons.length).toBeGreaterThan(1);
      const [firstGroup, secondGroup] = groupButtons;

      expect(firstGroup.getAttribute('aria-expanded')).toBe('true');
      expect(secondGroup.getAttribute('aria-expanded')).toBe('true');
      expect(firstGroup.getAttribute('aria-controls')).toBeTruthy();
      expect(panel().querySelector(`#${firstGroup.getAttribute('aria-controls')}`)).not.toBeNull();
      expect(firstGroup.querySelector('.nav-group-toggle')?.classList.contains('expanded')).toBe(
        true,
      );

      firstGroup.click();
      fixture.detectChanges();

      expect(firstGroup.getAttribute('aria-expanded')).toBe('false');
      expect(secondGroup.getAttribute('aria-expanded')).toBe('true');
      const controlledList = panel().querySelector<HTMLElement>(
        `#${firstGroup.getAttribute('aria-controls')}`,
      );
      expect(controlledList?.hidden).toBe(true);
      expect(controlledList?.querySelector('.nav-item')).toBeNull();
      expect(firstGroup.querySelector('.nav-group-toggle')?.classList.contains('expanded')).toBe(
        false,
      );
    });

    it('automatically expands all ancestor sections containing the active route', async () => {
      await TestBed.inject(Router).navigateByUrl('/security/users');
      fixture.detectChanges();

      const administration = panel().querySelector<HTMLButtonElement>(
        '[aria-controls="nav-group-administration"]',
      );
      const security = panel().querySelector<HTMLButtonElement>(
        '[aria-controls="nav-group-security"]',
      );
      expect(administration?.getAttribute('aria-expanded')).toBe('true');
      expect(security?.getAttribute('aria-expanded')).toBe('true');
      expect(TestBed.inject(Router).url).toBe('/security/users');
      expect(panel().querySelectorAll('.nav-group-button.active').length).toBeGreaterThan(0);
    });

    it('keeps every destination labeled and reachable in compact desktop mode', () => {
      sidebarService.toggle();
      fixture.detectChanges();

      expect(panel().classList.contains('collapsed')).toBe(true);
      const links = Array.from(panel().querySelectorAll<HTMLAnchorElement>('.nav-item'));
      expect(links.length).toBeGreaterThan(10);
      expect(links.every((link) => link.getAttribute('aria-label'))).toBe(true);
      expect(links.every((link) => link.getAttribute('title'))).toBe(true);
    });
  });

  describe('on a narrow viewport', () => {
    beforeEach(() => {
      isMobile.set(true);
      fixture.detectChanges();
    });

    it('renders as a modal dialog, inert while closed', () => {
      expect(panel().getAttribute('role')).toBe('dialog');
      expect(panel().getAttribute('aria-modal')).toBe('true');
      expect(panel().classList.contains('drawer')).toBe(true);
      expect(panel().classList.contains('open')).toBe(false);
      expect(panel().hasAttribute('inert')).toBe(true);
    });

    it('drops inert and gains the open class once the drawer opens', () => {
      sidebarService.toggle();
      fixture.detectChanges();

      expect(panel().classList.contains('open')).toBe(true);
      expect(panel().hasAttribute('inert')).toBe(false);
    });

    it('the close button closes the drawer', () => {
      sidebarService.toggle();
      fixture.detectChanges();
      expect(sidebarService.isDrawerOpen()).toBe(true);

      panel().querySelector<HTMLButtonElement>('.drawer-close')!.click();
      fixture.detectChanges();

      expect(sidebarService.isDrawerOpen()).toBe(false);
      expect(panel().hasAttribute('inert')).toBe(true);
    });

    it('Escape closes an open drawer', () => {
      sidebarService.toggle();
      fixture.detectChanges();
      expect(sidebarService.isDrawerOpen()).toBe(true);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(sidebarService.isDrawerOpen()).toBe(false);
    });

    it('Escape is a no-op while the drawer is already closed', () => {
      const closeSpy = vi.spyOn(sidebarService, 'closeDrawer');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('closes the drawer once a navigation completes, so the destination is never left hidden behind it', async () => {
      sidebarService.toggle();
      fixture.detectChanges();
      expect(sidebarService.isDrawerOpen()).toBe(true);

      // The test wildcard route lets us exercise a completed navigation without declaring
      // product routes in the sidebar's isolated unit-test module.
      await TestBed.inject(Router).navigateByUrl('/');
      fixture.detectChanges();

      expect(sidebarService.isDrawerOpen()).toBe(false);
    });
  });
});
