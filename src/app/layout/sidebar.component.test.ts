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

import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SidebarComponent } from './sidebar.component';
import { SidebarService } from '../core/services/sidebar.service';
import { ViewportService } from '../core/services/viewport.service';
import { TranslateModule } from '@ngx-translate/core';
import { Router, RouterModule } from '@angular/router';

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
      imports: [TranslateModule.forRoot(), RouterModule.forRoot([]), SidebarComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ViewportService, useValue: { isMobile } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    sidebarService = TestBed.inject(SidebarService);
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

      // RouterModule.forRoot([]) has no routes configured, so only the always-matching root
      // path can be navigated to here without the router itself rejecting it.
      await TestBed.inject(Router).navigateByUrl('/');
      fixture.detectChanges();

      expect(sidebarService.isDrawerOpen()).toBe(false);
    });
  });
});
