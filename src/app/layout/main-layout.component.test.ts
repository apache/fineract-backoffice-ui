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
import { signal } from '@angular/core';
import { provideTranslateTesting } from '../testing/i18n-testing';
import { BusinessDateManagementService } from '../api';
import { of } from 'rxjs';
import { OVERLAY } from '../core/adapters';

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
  let dismissPopover: ReturnType<typeof vi.fn>;

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
    dismissPopover = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([]), MainLayoutComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: BusinessDateManagementService, useValue: { getBusinessdate: () => of([]) } },
        { provide: OVERLAY, useValue: { dismissPopovers: dismissPopover } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    dismissPopover.mockClear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render header and sidebar', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-header')).toBeTruthy();
    expect(compiled.querySelector('app-sidebar')).toBeTruthy();
  });

  it('dismisses an open popover when navigation starts', async () => {
    await TestBed.inject(Router)
      .navigateByUrl('/another-page')
      .catch(() => false);

    expect(dismissPopover).toHaveBeenCalledOnce();
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
