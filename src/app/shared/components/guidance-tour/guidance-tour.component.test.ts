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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { provideIonicTesting } from '../../../testing/ionic-testing';
import { GuidanceTourComponent } from './guidance-tour.component';
import { GuidanceService } from '../../../core/services/guidance.service';

describe('GuidanceTourComponent', () => {
  let fixture: ComponentFixture<GuidanceTourComponent>;
  let guidance: GuidanceService;
  let routerEvents: Subject<NavigationEnd>;

  /**
   * Built node by node rather than parsed from an HTML string: `ga:check` rejects raw HTML
   * sinks anywhere under `src/`, and a test is not exempt from a rule about them.
   */
  function el(tag: string, className: string): HTMLElement {
    const node = document.createElement(tag);
    node.className = className;
    return node;
  }

  /** Stands in for the routed view, so a `'content'` step has a `main` to search. */
  function mountContent(...children: HTMLElement[]): HTMLElement {
    const main = document.createElement('main');
    main.append(...children);
    document.body.append(main);
    return main;
  }

  beforeEach(async () => {
    routerEvents = new Subject<NavigationEnd>();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [GuidanceTourComponent, TranslateModule.forRoot()],
      // No animations provider: `provideNoopAnimations` is deprecated as of Angular 20.2, and
      // app.config.ts deliberately provides none — there is nothing to no-op.
      providers: [
        provideIonicTesting(),
        GuidanceService,
        { provide: Router, useValue: { events: routerEvents } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GuidanceTourComponent);
    guidance = TestBed.inject(GuidanceService);
    fixture.detectChanges();
  });

  afterEach(() => {
    guidance.endTour();
    document.querySelectorAll('main').forEach((el) => el.remove());
  });

  it('renders nothing until a tour is playing', () => {
    expect(fixture.nativeElement.querySelector('.guidance-card')).toBeNull();
  });

  it('is a dialog, named and described by its own copy', async () => {
    guidance.startTour('/dashboard');
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.getAttribute('aria-labelledby')).toBe('guidance-title');
    expect(panel.getAttribute('aria-describedby')).toBe('guidance-description');
    // Next replaces the copy in place, so the change has to be announced rather than just drawn.
    expect(fixture.nativeElement.querySelector('.progress-info')?.getAttribute('aria-live')).toBe(
      'polite',
    );
  });

  /**
   * The original bug: the dashboard step's selector was a bare `ul`, and
   * `document.querySelector('ul')` returns the first in the whole document — the sidebar's own
   * nav list, which renders before the routed view. Scoping the lookup to `main` is what makes
   * that class of mistake impossible rather than merely corrected for one step.
   */
  it('looks for a content step inside the routed view only', async () => {
    const shell = document.createElement('div');
    shell.append(el('ul', 'nav-list'));
    document.body.prepend(shell);
    const main = mountContent(el('ul', 'status-list'));

    guidance.startTour('/dashboard');
    fixture.detectChanges();
    guidance.nextStep();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(main.querySelector('.status-list')?.classList).toContain('guidance-highlight');
    expect(shell.querySelector('.nav-list')?.classList).not.toContain('guidance-highlight');
    shell.remove();
  });

  it('moves the highlight off the previous target when the step changes', async () => {
    const main = mountContent(el('div', 'status-list'), el('div', 'tab-group'));

    guidance.startTour('/dashboard');
    fixture.detectChanges();
    guidance.nextStep();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(main.querySelector('.status-list')?.classList).toContain('guidance-highlight');

    guidance.previousStep();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(main.querySelector('.status-list')?.classList).not.toContain('guidance-highlight');
  });

  it('leaves nothing highlighted once the tour ends', async () => {
    const main = mountContent(el('div', 'status-list'));

    guidance.startTour('/dashboard');
    fixture.detectChanges();
    guidance.nextStep();
    fixture.detectChanges();
    await fixture.whenStable();

    guidance.endTour();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(main.querySelector('.status-list')?.classList).not.toContain('guidance-highlight');
  });

  /**
   * The tour is non-modal on purpose: the user is meant to click and read the screen it is
   * describing. So Escape has to be answered wherever focus happens to be. As a host binding
   * it only saw events bubbling out of the card, which meant one click on the page behind it
   * left the tour with no keyboard way out.
   */
  it('closes on Escape with focus outside the card', async () => {
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    guidance.startTour('/dashboard');
    fixture.detectChanges();
    await fixture.whenStable();

    elsewhere.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(guidance.isPlaying()).toBe(false);
    elsewhere.remove();
  });

  it('leaves an Escape alone when no tour is playing', async () => {
    // It listens on `document`, so without a guard it would answer an Escape meant for
    // whatever else is on screen.
    const endTour = vi.spyOn(guidance, 'endTour');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(endTour).not.toHaveBeenCalled();
  });

  /**
   * A tour describes one screen, so it cannot outlive being on it. Navigating with it open used
   * to carry the dashboard card onto the client list, where Next walked steps about a
   * `.status-list` that is not in that view — the same wrongness as the old dashboard fallback,
   * reached by navigating rather than by pressing the button.
   */
  it('ends when the user navigates away', async () => {
    const main = mountContent(el('div', 'status-list'));
    guidance.startTour('/dashboard');
    fixture.detectChanges();
    guidance.nextStep();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(guidance.isPlaying()).toBe(true);

    routerEvents.next(new NavigationEnd(1, '/clients', '/clients'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(guidance.isPlaying()).toBe(false);
    expect(fixture.nativeElement.querySelector('.guidance-card')).toBeNull();
    expect(main.querySelector('.status-list')?.classList).not.toContain('guidance-highlight');
  });

  it('hands focus back to whatever opened it', async () => {
    const opener = document.createElement('button');
    opener.className = 'tour-btn';
    document.body.append(opener);
    opener.focus();

    guidance.startTour('/dashboard');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).not.toBe(opener);

    guidance.endTour();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(opener);

    opener.remove();
  });
});
