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

import type { Mock } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TabsComponent } from './tabs.component';

describe('TabsComponent public contract', () => {
  let fixture: ComponentFixture<TabsComponent>;
  let changed: Mock<(value: string) => void>;
  const tabs = [
    { value: 'accounts', label: 'Accounts' },
    { value: 'disabled', label: 'Unavailable', disabled: true },
    { value: 'notes', label: 'Notes' },
  ];
  const buttons = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[role=tab]'));
  function key(button: HTMLButtonElement, value: string, keyCode: number) {
    button.dispatchEvent(
      new KeyboardEvent('keydown', { key: value, keyCode, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TabsComponent] }).compileComponents();
    fixture = TestBed.createComponent(TabsComponent);
    fixture.componentRef.setInput('tabs', tabs);
    fixture.componentRef.setInput('value', 'accounts');
    fixture.componentRef.setInput('label', 'Client records');
    fixture.componentRef.setInput('idPrefix', 'client-7');
    changed = vi.fn<(value: string) => void>();
    fixture.componentInstance.valueChange.subscribe(changed);
    fixture.detectChanges();
  });

  it('exposes a labelled tablist, stable panel links and exactly one tab stop without Ionic', () => {
    const list = fixture.nativeElement.querySelector('[role=tablist]') as HTMLElement;
    expect(list.getAttribute('aria-label')).toBe('Client records');
    expect(buttons().map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    expect(buttons()[0].getAttribute('aria-selected')).toBe('true');
    expect(buttons()[0].getAttribute('aria-controls')).toBe('client-7-panel');
    expect(buttons()[0].id).toBe('client-7-tab-accounts');
    expect(fixture.nativeElement.querySelector('ion-segment')).toBeNull();
  });

  it('moves focus with arrows, skips disabled tabs and wraps without changing selection', () => {
    buttons()[0].focus();
    key(buttons()[0], 'ArrowRight', 39);
    expect(document.activeElement).toBe(buttons()[2]);
    expect(buttons().map((tab) => tab.tabIndex)).toEqual([-1, -1, 0]);
    expect(changed).not.toHaveBeenCalled();
    expect(buttons()[0].getAttribute('aria-selected')).toBe('true');
    key(buttons()[2], 'ArrowRight', 39);
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('supports Home and End while allowing Tab to leave the strip', () => {
    buttons()[0].focus();
    key(buttons()[0], 'End', 35);
    expect(document.activeElement).toBe(buttons()[2]);
    key(buttons()[2], 'Home', 36);
    expect(document.activeElement).toBe(buttons()[0]);
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      keyCode: 9,
      bubbles: true,
      cancelable: true,
    });
    buttons()[0].dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves vertical arrows available for page scrolling in a horizontal tablist', () => {
    buttons()[0].focus();
    for (const [key, keyCode] of [
      ['ArrowUp', 38],
      ['ArrowDown', 40],
    ] as const) {
      const event = new KeyboardEvent('keydown', { key, keyCode, bubbles: true, cancelable: true });
      buttons()[0].dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(buttons()[0]);
    }
    expect(changed).not.toHaveBeenCalled();
  });

  it('honours RTL horizontal navigation inherited from the host', () => {
    fixture.nativeElement.style.direction = 'rtl';
    buttons()[0].focus();
    key(buttons()[0], 'ArrowLeft', 37);
    expect(document.activeElement).toBe(buttons()[2]);
  });

  it('emits only an enabled new value and waits for the caller to select it', () => {
    buttons()[0].click();
    buttons()[1].click();
    expect(changed).not.toHaveBeenCalled();
    buttons()[2].click();
    expect(changed).toHaveBeenCalledExactlyOnceWith('notes');
    expect(buttons()[0].getAttribute('aria-selected')).toBe('true');
    fixture.componentRef.setInput('value', 'notes');
    fixture.detectChanges();
    expect(buttons()[2].getAttribute('aria-selected')).toBe('true');
    expect(buttons()[2].tabIndex).toBe(0);
  });

  it('updates the keyboard inventory when tabs are removed or disabled', () => {
    fixture.componentRef.setInput('tabs', [{ value: 'new', label: 'New' }, tabs[2]]);
    fixture.componentRef.setInput('value', 'notes');
    fixture.detectChanges();
    buttons()[1].focus();
    key(buttons()[1], 'ArrowRight', 39);
    expect(document.activeElement).toBe(buttons()[0]);
    fixture.componentRef.setInput('tabs', [{ value: 'new', label: 'New', disabled: true }]);
    fixture.detectChanges();
    expect(buttons()[0].tabIndex).toBe(-1);
    expect(buttons()[0].disabled).toBe(true);
  });
});
