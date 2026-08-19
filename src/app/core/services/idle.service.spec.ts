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

import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { IdleService } from './idle.service';
import { AuthService } from './auth.service';
import { DialogService } from './dialog.service';
import { FakeOverlayAdapter, provideFakeAdapters } from '../../testing/adapters';

describe('IdleService', () => {
  let service: IdleService;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let routerEvents: Subject<unknown>;
  let overlay: FakeOverlayAdapter;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['logout', 'isAuthenticated']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routerEvents = new Subject<unknown>();
    // `Router.events` is a real Observable, not a spied method — the constructor subscribes
    // to it directly, so the double has to supply one rather than leave it undefined.
    (routerSpy as unknown as { events: Subject<unknown> }).events = routerEvents;
    const fakes = provideFakeAdapters();
    overlay = fakes.overlay;

    TestBed.configureTestingModule({
      providers: [
        IdleService,
        DialogService,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        ...fakes.providers,
      ],
    });

    authServiceSpy.isAuthenticated.and.returnValue(false);
  });

  it('should be created', () => {
    service = TestBed.inject(IdleService);
    expect(service).toBeTruthy();
  });

  it('should show warning dialog before timeout', fakeAsync(() => {
    authServiceSpy.isAuthenticated.and.returnValue(true);
    overlay.nextModalResult = true;

    service = TestBed.inject(IdleService);

    // Total 15m, Warning at 13m. Advance to 13m
    tick(13 * 60 * 1000 + 1000);

    expect(overlay.modals).toHaveSize(1);
    // Ignoring the warning has to fall through to the logout timer, so neither the backdrop
    // nor Escape may take it down.
    expect(overlay.lastModal!.dismissible).toBe(false);
    service.ngOnDestroy();
  }));

  it('should logout if user does not respond to warning', fakeAsync(() => {
    authServiceSpy.isAuthenticated.and.returnValue(true);
    // The user never answers the warning, so the hard logout timer must fire.
    spyOn(overlay, 'presentModal').and.resolveTo({
      result: new Promise(() => undefined),
      dismiss: () => Promise.resolve(),
    });

    service = TestBed.inject(IdleService);

    // Advance to 13m (warning shows)
    tick(13 * 60 * 1000 + 1000);
    expect(overlay.presentModal).toHaveBeenCalled();

    // Advance remaining 2m
    tick(2 * 60 * 1000 + 1000);

    expect(authServiceSpy.logout).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalled();

    service.ngOnDestroy();
  }));

  it('keeps the hard logout timer running when activity is reported while the warning is still being presented', fakeAsync(() => {
    authServiceSpy.isAuthenticated.and.returnValue(true);

    // Simulates the window between the warning timer firing and `dialogService.present()`
    // actually resolving — the exact gap in which `dialogRef` used to sit unset, making the
    // "don't reset while a warning is up" guard ineffective: an activity event landing here
    // used to call `resetTimer()`, which clears the hard logout timer `showInactivityWarning()`
    // had just set and reschedules a fresh 13-minute wait, leaving the visible warning up with
    // nothing left to time it out.
    let resolvePresent!: (handle: {
      result: Promise<unknown>;
      dismiss: () => Promise<void>;
    }) => void;
    spyOn(overlay, 'presentModal').and.returnValue(
      new Promise((resolve) => {
        resolvePresent = resolve;
      }),
    );

    service = TestBed.inject(IdleService);

    tick(13 * 60 * 1000 + 1000);
    expect(overlay.presentModal).toHaveBeenCalledTimes(1);

    // An activity event lands before the modal has actually presented.
    window.dispatchEvent(new Event('mousemove'));
    tick(1);

    // The modal now presents, and the user never answers it.
    resolvePresent({ result: new Promise(() => undefined), dismiss: () => Promise.resolve() });
    tick();

    // If the stray activity event had reset the timer, this would not be enough time to
    // reach the hard logout — it would take another ~13 minutes instead.
    tick(2 * 60 * 1000 + 1000);

    expect(authServiceSpy.logout).toHaveBeenCalled();
    expect(overlay.presentModal).toHaveBeenCalledTimes(1);

    service.ngOnDestroy();
  }));

  it('closes the warning dialog once navigation actually lands on the login page', fakeAsync(() => {
    authServiceSpy.isAuthenticated.and.returnValue(true);
    // The user never answers, so nothing else would close this dialog before the hard
    // logout timer does — the router subscription below has to be what closes it instead.
    const dismissSpy = jasmine.createSpy('dismiss').and.resolveTo(undefined);
    spyOn(overlay, 'presentModal').and.resolveTo({
      result: new Promise(() => undefined),
      dismiss: dismissSpy,
    });

    service = TestBed.inject(IdleService);

    tick(13 * 60 * 1000 + 1000);
    expect(overlay.presentModal).toHaveBeenCalled();
    expect(dismissSpy).not.toHaveBeenCalled();

    routerEvents.next(new NavigationEnd(1, '/login?reason=inactivity', '/login?reason=inactivity'));
    tick();

    expect(dismissSpy).toHaveBeenCalled();

    service.ngOnDestroy();
  }));
});
