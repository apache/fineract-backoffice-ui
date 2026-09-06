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
import { TestBed } from '@angular/core/testing';
import { SidebarService } from './sidebar.service';
import { ViewportService } from './viewport.service';

describe('SidebarService', () => {
  let service: SidebarService;
  let isMobile: WritableSignal<boolean>;

  // Pinned rather than inherited from the real ViewportService, the same reasoning as
  // header.component.test.ts: the service renders one of two unrelated behaviours either side
  // of the breakpoint (a collapsible column vs. a modal drawer), so the split has to be driven
  // explicitly rather than left to whatever jsdom's stubbed matchMedia happens to report.
  const configure = (mobile: boolean) => {
    isMobile = signal(mobile);
    TestBed.configureTestingModule({
      providers: [SidebarService, { provide: ViewportService, useValue: { isMobile } }],
    });
    service = TestBed.inject(SidebarService);
  };

  describe('on a wide viewport', () => {
    beforeEach(() => configure(false));

    it('is created with the column expanded and the drawer closed', () => {
      expect(service.isCollapsed()).toBe(false);
      expect(service.isDrawerOpen()).toBe(false);
    });

    it('toggle() narrows the column to icons, not the drawer', () => {
      service.toggle();

      expect(service.isCollapsed()).toBe(true);
      expect(service.isDrawerOpen()).toBe(false);

      service.toggle();
      expect(service.isCollapsed()).toBe(false);
    });

    it('reports the drawer as closed even if it was left open on a narrower viewport', () => {
      // isDrawerOpen is `viewport.isMobile() && _isDrawerOpen()` — a drawer flag alone must
      // never present as "open" once the layout is the wide one, regardless of history.
      isMobile.set(true);
      service.toggle();
      expect(service.isDrawerOpen()).toBe(true);

      isMobile.set(false);
      expect(service.isDrawerOpen()).toBe(false);
    });
  });

  describe('on a narrow viewport', () => {
    beforeEach(() => configure(true));

    it('is created with the drawer closed', () => {
      expect(service.isDrawerOpen()).toBe(false);
    });

    it('toggle() opens and closes the drawer, not the column', () => {
      service.toggle();
      expect(service.isDrawerOpen()).toBe(true);
      expect(service.isCollapsed()).toBe(false);

      service.toggle();
      expect(service.isDrawerOpen()).toBe(false);
    });

    it('closeDrawer() closes an open drawer', () => {
      service.toggle();
      expect(service.isDrawerOpen()).toBe(true);

      service.closeDrawer();
      expect(service.isDrawerOpen()).toBe(false);
    });

    it('closeDrawer() is a no-op when the drawer is already closed', () => {
      service.closeDrawer();
      expect(service.isDrawerOpen()).toBe(false);
    });

    it('leaving mobile clears the drawer flag, so returning to mobile does not restore an open overlay', () => {
      service.toggle();
      expect(service.isDrawerOpen()).toBe(true);

      isMobile.set(false);
      TestBed.tick();

      isMobile.set(true);
      expect(service.isDrawerOpen()).toBe(false);
    });
  });
});
