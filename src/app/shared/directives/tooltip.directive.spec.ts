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

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TooltipDirective } from './tooltip.directive';

@Component({
  template: `
    <button id="first" [appTooltip]="'First host'">First</button>
    <button id="second" [appTooltip]="'Second host'">Second</button>
    <button id="variable" [appTooltip]="text()">Variable</button>
  `,
  standalone: true,
  imports: [TooltipDirective],
})
class TestComponent {
  readonly text = signal('Saves the form');
}

const SHOW_DELAY = 300;
const TOOLTIP_SELECTOR = '.app-tooltip';
const DESCRIBED_BY = 'aria-describedby';

describe('TooltipDirective', () => {
  let fixture: ComponentFixture<TestComponent>;

  function tooltipCount(): number {
    return document.querySelectorAll(TOOLTIP_SELECTOR).length;
  }

  function tooltip(): HTMLElement | null {
    return document.querySelector<HTMLElement>(TOOLTIP_SELECTOR);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TestComponent] });
    fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    jasmine.clock().install();
  });

  afterEach(() => {
    // Directives destroyed by the fixture already clean up after themselves; this only
    // catches anything a failing assertion left behind, so later specs start from zero.
    document.querySelectorAll(TOOLTIP_SELECTOR).forEach((el) => el.remove());
    jasmine.clock().uninstall();
  });

  function host(id: string): HTMLElement {
    return fixture.debugElement.query(By.css(id)).nativeElement as HTMLElement;
  }

  it('does not leave an orphaned bubble when mouseenter and focusin both fire before the delay elapses', () => {
    const el = host('#first');

    el.dispatchEvent(new Event('mouseenter'));
    el.dispatchEvent(new Event('focusin'));
    jasmine.clock().tick(SHOW_DELAY + 1);

    expect(tooltipCount()).toBe(1);
  });

  it('removes the tooltip on mouseleave', () => {
    const el = host('#first');

    el.dispatchEvent(new Event('mouseenter'));
    jasmine.clock().tick(SHOW_DELAY + 1);
    expect(tooltipCount()).toBe(1);

    el.dispatchEvent(new Event('mouseleave'));
    expect(tooltipCount()).toBe(0);
  });

  it('never shows two tooltips at once, even when a second host is triggered while the first is still up', () => {
    const first = host('#first');
    const second = host('#second');

    first.dispatchEvent(new Event('mouseenter'));
    jasmine.clock().tick(SHOW_DELAY + 1);
    expect(tooltipCount()).toBe(1);

    // The pointer moves to the second host without the first ever reporting mouseleave —
    // e.g. focus lands there via keyboard while the mouse is still over the first element.
    second.dispatchEvent(new Event('focusin'));
    jasmine.clock().tick(SHOW_DELAY + 1);

    expect(tooltipCount()).toBe(1);
    expect(document.querySelector(TOOLTIP_SELECTOR)?.textContent).toBe('Second host');
  });

  it('cleans up its tooltip when the host is destroyed while still showing it', () => {
    const el = host('#first');

    el.dispatchEvent(new Event('mouseenter'));
    jasmine.clock().tick(SHOW_DELAY + 1);
    expect(tooltipCount()).toBe(1);

    fixture.destroy();

    expect(tooltipCount()).toBe(0);
  });

  it('shows nothing until the delay has elapsed', () => {
    const el = host('#first');

    el.dispatchEvent(new Event('mouseenter'));
    jasmine.clock().tick(SHOW_DELAY - 1);
    expect(tooltipCount()).toBe(0);

    jasmine.clock().tick(1);
    expect(tooltipCount()).toBe(1);
  });

  it('shows the text on hover, marks it as a tooltip, and points the host at it', () => {
    const el = host('#first');

    el.dispatchEvent(new Event('mouseenter'));
    jasmine.clock().tick(SHOW_DELAY + 1);

    const bubble = tooltip();
    expect(bubble).not.toBeNull();
    expect(bubble?.textContent).toBe('First host');
    expect(bubble?.getAttribute('role')).toBe('tooltip');
    expect(el.getAttribute(DESCRIBED_BY)).toBe(bubble!.id);
  });

  it('shows on focus, so the tooltip is reachable from the keyboard', () => {
    const el = host('#first');

    el.dispatchEvent(new Event('focusin'));
    jasmine.clock().tick(SHOW_DELAY + 1);

    expect(tooltip()?.textContent).toBe('First host');
  });

  it('describes the host and never names it', () => {
    // The distinction this directive is regularly mistaken for handling. aria-describedby is
    // a description; it is not consulted when the accessible name is computed. An icon-only
    // button therefore still needs its own aria-label, which scripts/check-a11y-names.mjs
    // enforces. Asserting it here keeps the boundary explicit at the directive itself.
    const el = host('#first');

    el.dispatchEvent(new Event('mouseenter'));
    jasmine.clock().tick(SHOW_DELAY + 1);

    expect(el.getAttribute(DESCRIBED_BY)).toBeTruthy();
    expect(el.getAttribute('aria-label')).toBeNull();
  });

  it('drops the description as well as the bubble on mouseleave', () => {
    const el = host('#first');

    el.dispatchEvent(new Event('mouseenter'));
    jasmine.clock().tick(SHOW_DELAY + 1);
    el.dispatchEvent(new Event('mouseleave'));

    expect(tooltipCount()).toBe(0);
    expect(el.getAttribute(DESCRIBED_BY)).toBeNull();
  });

  it('dismisses on Escape', () => {
    const el = host('#first');

    el.dispatchEvent(new Event('mouseenter'));
    jasmine.clock().tick(SHOW_DELAY + 1);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(tooltipCount()).toBe(0);
  });

  it('cancels a pending tooltip when the pointer leaves within the delay', () => {
    const el = host('#first');

    el.dispatchEvent(new Event('mouseenter'));
    jasmine.clock().tick(SHOW_DELAY - 100);
    el.dispatchEvent(new Event('mouseleave'));
    jasmine.clock().tick(SHOW_DELAY);

    // A passing hover must not leave a tooltip behind after the timer would have fired.
    expect(tooltipCount()).toBe(0);
  });

  it('shows nothing when the text is empty', () => {
    fixture.componentInstance.text.set('');
    fixture.detectChanges();
    const el = host('#variable');

    el.dispatchEvent(new Event('mouseenter'));
    jasmine.clock().tick(SHOW_DELAY + 1);

    expect(tooltipCount()).toBe(0);
  });
});
