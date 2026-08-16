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
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TooltipDirective } from './tooltip.directive';

const TOOLTIP_TEXT = 'Saves the form';
const DESCRIBED_BY = 'aria-describedby';

@Component({
  template: `<button id="host" [appTooltip]="text()">Save</button>`,
  standalone: true,
  imports: [TooltipDirective],
})
class TestComponent {
  readonly text = signal(TOOLTIP_TEXT);
}

const HOST_SELECTOR = '#host';
const TOOLTIP_SELECTOR = '.app-tooltip';
/** Matches SHOW_DELAY in the directive. */
const SHOW_DELAY = 300;

describe('TooltipDirective', () => {
  let fixture: ComponentFixture<TestComponent>;
  let host: HTMLElement;

  const tooltip = () => document.querySelector<HTMLElement>(TOOLTIP_SELECTOR);
  const hover = () => host.dispatchEvent(new MouseEvent('mouseenter'));
  const leave = () => host.dispatchEvent(new MouseEvent('mouseleave'));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TestComponent] });
    fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    host = fixture.debugElement.query(By.css(HOST_SELECTOR)).nativeElement;
  });

  afterEach(() => {
    // A test that leaves the tooltip up would leak it into the next one: the element is
    // appended to document.body, which the fixture does not own and does not tear down.
    for (const stray of document.querySelectorAll(TOOLTIP_SELECTOR)) stray.remove();
  });

  it('should not show anything before the delay has elapsed', fakeAsync(() => {
    hover();
    tick(SHOW_DELAY - 1);

    expect(tooltip()).toBeNull();

    tick(1);
    expect(tooltip()).not.toBeNull();
  }));

  it('should show the text on hover and describe the host', fakeAsync(() => {
    hover();
    tick(SHOW_DELAY);

    const el = tooltip();
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe(TOOLTIP_TEXT);
    expect(el?.getAttribute('role')).toBe('tooltip');
    expect(host.getAttribute(DESCRIBED_BY)).toBe(el!.id);
  }));

  it('should show on focus, so the tooltip is reachable from the keyboard', fakeAsync(() => {
    host.dispatchEvent(new FocusEvent('focusin'));
    tick(SHOW_DELAY);

    expect(tooltip()?.textContent).toBe(TOOLTIP_TEXT);
  }));

  it('should describe the host and never name it', fakeAsync(() => {
    // The distinction this directive is regularly mistaken for handling. aria-describedby is
    // a description; it is not consulted when the accessible name is computed. An icon-only
    // button therefore still needs its own aria-label, which scripts/check-a11y-names.mjs
    // enforces. Asserting it here keeps the boundary explicit at the directive itself.
    hover();
    tick(SHOW_DELAY);

    expect(host.getAttribute(DESCRIBED_BY)).toBeTruthy();
    expect(host.getAttribute('aria-label')).toBeNull();
  }));

  it('should remove the tooltip and the description on mouseleave', fakeAsync(() => {
    hover();
    tick(SHOW_DELAY);
    leave();

    expect(tooltip()).toBeNull();
    expect(host.getAttribute(DESCRIBED_BY)).toBeNull();
  }));

  it('should dismiss on Escape', fakeAsync(() => {
    hover();
    tick(SHOW_DELAY);
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(tooltip()).toBeNull();
  }));

  it('should cancel a pending tooltip when the pointer leaves within the delay', fakeAsync(() => {
    hover();
    tick(SHOW_DELAY - 100);
    leave();
    tick(SHOW_DELAY);

    // A passing hover must not leave a tooltip behind after the timer would have fired.
    expect(tooltip()).toBeNull();
  }));

  it('should show nothing when the text is empty', fakeAsync(() => {
    fixture.componentInstance.text.set('');
    fixture.detectChanges();

    hover();
    tick(SHOW_DELAY);

    expect(tooltip()).toBeNull();
  }));

  it('should not open a second tooltip while one is already showing', fakeAsync(() => {
    hover();
    tick(SHOW_DELAY);
    hover();
    tick(SHOW_DELAY);

    expect(document.querySelectorAll(TOOLTIP_SELECTOR)).toHaveSize(1);
  }));

  it('should clean up on destroy', fakeAsync(() => {
    hover();
    tick(SHOW_DELAY);
    fixture.destroy();

    expect(tooltip()).toBeNull();
  }));
});
