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
import { MainLayoutComponent } from './main-layout.component';
import { AuthService, UserSession } from '../core/services/auth.service';
import { GuidanceService } from '../core/services/guidance.service';
import { Router, RouterModule } from '@angular/router';
import { Component, signal } from '@angular/core';
import { provideTranslateTesting } from '../testing/i18n-testing';
import { BusinessDateManagementService } from '../api';
import { of } from 'rxjs';

@Component({ selector: 'app-test-page', standalone: true, template: '<h1>Page</h1>' })
class TestPageComponent {}

function keydown(overrides: Partial<KeyboardEvent> & { target: EventTarget }): KeyboardEvent {
  return {
    key: '',
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as KeyboardEvent;
}

describe('MainLayoutComponent', () => {
  let component: MainLayoutComponent;
  let fixture: ComponentFixture<MainLayoutComponent>;
  let authServiceSpy: SpyObj<AuthService>;

  beforeEach(async () => {
    const mockSession: UserSession = {
      username: 'mifos',
      base64EncodedAuthenticationKey: 'YmFzZTY0',
      authenticated: true,
      officeId: 1,
      officeName: 'Head Office',
      userId: 1,
      permissions: ['ALL_FUNCTIONS'],
    };

    authServiceSpy = Object.assign(createSpyObj<AuthService>(['hasPermission']), {
      username: signal('mifos'),
      officeName: signal('Head Office'),
      currentUser: signal<UserSession | null>(mockSession),
    });
    authServiceSpy.hasPermission.mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([]), MainLayoutComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: BusinessDateManagementService, useValue: { getBusinessdate: () => of([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render header and sidebar', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-header')).toBeTruthy();
    expect(compiled.querySelector('app-sidebar')).toBeTruthy();
  });

  describe('skip link', () => {
    it('is the first focusable element in the shell', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const first = compiled.querySelector('a[href], button, input, [tabindex="0"]');
      expect(first?.classList.contains('skip-link')).toBe(true);
      expect(first?.getAttribute('href')).toBe('#main-content');
    });

    it('moves focus to main instead of following the link', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });

      compiled.querySelector('.skip-link')!.dispatchEvent(click);

      expect(click.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(compiled.querySelector('main#main-content'));
    });
  });

  describe('focus on a change of page', () => {
    let router: Router;
    let main: HTMLElement;
    let outside: HTMLButtonElement;

    beforeEach(async () => {
      router = TestBed.inject(Router);
      router.resetConfig([
        { path: 'first', component: TestPageComponent },
        { path: 'second', component: TestPageComponent },
      ]);
      main = (fixture.nativeElement as HTMLElement).querySelector('main')!;
      outside = document.createElement('button');
      document.body.append(outside);

      await router.navigateByUrl('/first');
      outside.focus();
    });

    afterEach(() => outside.remove());

    it('moves focus to main when the path changes', async () => {
      await router.navigateByUrl('/second');

      expect(document.activeElement).toBe(main);
    });

    it('leaves focus where it is when only the query string changes', async () => {
      await router.navigateByUrl('/first?page=2');

      expect(document.activeElement).toBe(outside);
    });

    it('does not take focus from an element already inside main', async () => {
      const inside = document.createElement('button');
      main.append(inside);
      inside.focus();

      await router.navigateByUrl('/second');

      expect(document.activeElement).toBe(inside);
    });
  });

  describe('global keyboard shortcuts', () => {
    it('navigates to the bound route on a shortcut keydown', () => {
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate');

      component.onKeydown(keydown({ key: 'c', altKey: true, target: document.body }));

      expect(navigateSpy).toHaveBeenCalledWith(['/clients/create']);
    });

    it('starts the guidance tour for the current route on the help shortcut', () => {
      vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/dashboard');
      const startTourSpy = vi.spyOn(TestBed.inject(GuidanceService), 'startTour');

      component.onKeydown(keydown({ key: 'h', altKey: true, target: document.body }));

      expect(startTourSpy).toHaveBeenCalledWith('/dashboard');
    });

    it('ignores keydown events while typing into a form control', () => {
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate');
      const input = document.createElement('input');

      component.onKeydown(keydown({ key: 'c', altKey: true, target: input }));

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('ignores unbound key combinations', () => {
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate');

      component.onKeydown(keydown({ key: 'z', altKey: true, target: document.body }));

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});
