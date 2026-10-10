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

import { createSpyObj, SpyObj } from '../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HeaderComponent } from './header.component';
import { AuthService } from '../core/services/auth.service';
import { NavigationConfigService } from '../core/services/navigation-config.service';
import { Router } from '@angular/router';
import { ViewportService } from '../core/services/viewport.service';
import { EMPTY, of } from 'rxjs';
import { WritableSignal, signal } from '@angular/core';
import { provideTranslateTesting } from '../testing/i18n-testing';
import { BusinessDateManagementService } from '../api';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let authServiceSpy: SpyObj<AuthService>;
  let navigationConfigSpy: SpyObj<NavigationConfigService>;
  let routerSpy: SpyObj<Router>;
  let isMobile: WritableSignal<boolean>;
  let businessDates: { type: string; date: number[] }[];

  beforeEach(async () => {
    authServiceSpy = Object.assign(createSpyObj<AuthService>(['logout']), {
      username: signal('mifos'),
      officeName: signal('Head Office'),
    });
    navigationConfigSpy = createSpyObj(['searchRoutes']);
    navigationConfigSpy.searchRoutes.mockReturnValue([]);
    // `routerState` and `events` are properties, not methods, so createSpyObj needs them in the
    // property bag. The header reads the route tree for the phone header's page title, the same
    // way BreadcrumbComponent does; without them it throws in ngOnInit.
    routerSpy = Object.assign(createSpyObj<Router>(['navigate', 'navigateByUrl']), {
      routerState: { snapshot: { root: { url: [], routeConfig: null, firstChild: null } } },
      events: EMPTY,
    });

    // Pinned, not inherited from the harness. The header renders a different set of controls
    // either side of the breakpoint. Pinning the value keeps these assertions independent of
    // the test environment's viewport.
    isMobile = signal(false);
    businessDates = [];

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: NavigationConfigService, useValue: navigationConfigSpy },
        {
          provide: BusinessDateManagementService,
          useValue: { getBusinessdate: () => of(businessDates) },
        },
        { provide: Router, useValue: routerSpy },
        { provide: ViewportService, useValue: { isMobile } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('leaves out the business date chip when the instance has no business date', () => {
    // GET /businessdate answers [] when the feature is not configured.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('COMMON.BUSINESS_DATE');
    expect(compiled.textContent).toContain('COMMON.RENDER_TIME');
  });

  it('shows the business date when the instance has one', () => {
    businessDates = [{ type: 'BUSINESS_DATE', date: [2026, 10, 2] }];
    fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('COMMON.BUSINESS_DATE');
    expect(compiled.textContent).toContain(new Date(2026, 9, 2).toLocaleDateString());
  });

  it('should display username and office', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.username')?.textContent).toContain('mifos');
    expect(compiled.querySelector('.office')?.textContent).toContain('Head Office');
  });

  it('moves the actions into an overflow menu on a narrow viewport', () => {
    // The counterpart to the case above: below the breakpoint those same controls are not in
    // the bar at all, and reaching them is what the overflow trigger is for.
    isMobile.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.username')).toBeNull();
    expect(compiled.querySelector('#header-overflow')).not.toBeNull();
    expect(compiled.querySelector('.page-title')).not.toBeNull();
  });

  it('should call logout and navigate', () => {
    component.logout();
    expect(authServiceSpy.logout).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should switch language', () => {
    const i18n = (component as unknown as { i18n: { use(language: string): unknown } }).i18n;
    const useSpy = vi.spyOn(i18n, 'use');
    component.switchLanguage('hi');
    expect(useSpy).toHaveBeenCalledWith('hi');
  });

  it('navigates to a page result via navigateByUrl', () => {
    component.onResultSelected({
      kind: 'nav',
      nav: { route: '/organization/offices', label: 'Offices' },
    });
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/organization/offices');
  });

  it('navigates to an entity result by type', () => {
    component.onResultSelected({
      kind: 'entity',
      entity: { entityType: 'LOAN', entityId: 42 } as never,
    });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/loans/view', 42]);
  });

  it('prevents the mousedown default on a result item, so the searchbar never blurs to start the 150ms hide race', () => {
    // Drives `showResults` through the public entry point rather than reaching into the
    // (protected) signal directly; `searchResults` is set directly since the debounced
    // pipeline behind `onSearchInput` never resolves within a synchronous test.
    component.onSearchInput({ detail: { value: 'Offices' } } as unknown as Event);
    component.searchResults.set([
      { kind: 'nav', nav: { route: '/organization/offices', label: 'Offices' } },
    ]);
    fixture.detectChanges();

    const item = fixture.debugElement.query(By.css('ion-item'));
    const event = createSpyObj(['preventDefault']);
    item.triggerEventHandler('mousedown', event);

    expect(event.preventDefault).toHaveBeenCalled();
  });
});
