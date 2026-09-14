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

import { FocusKeyManager } from '@angular/cdk/a11y';
import {
  Component,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  viewChildren,
} from '@angular/core';

/** Values are application identifiers; labels are already translated by the caller. */
export interface UiTab {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/** Manual-activation tabs: moving focus never fetches or replaces panel contents. */
@Component({
  selector: 'app-tabs',
  standalone: true,
  template: `
    <div role="tablist" [attr.aria-label]="label()" data-testid="ui-tabs">
      @for (tab of tabs(); track tab.value; let index = $index) {
        <button
          #tabButton
          type="button"
          role="tab"
          data-testid="ui-tab"
          [id]="tabId(tab.value)"
          [attr.aria-controls]="panelId()"
          [attr.aria-selected]="tab.value === value()"
          [attr.tabindex]="index === focusIndex() ? 0 : -1"
          [disabled]="tab.disabled"
          (focus)="focusIndex.set(index)"
          (keydown)="onKeydown($event)"
          (click)="select(tab)"
        >
          {{ tab.label }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      [role='tablist'] {
        display: flex;
        overflow-x: auto;
        border-bottom: 1px solid var(--border-color);
      }
      button {
        flex: 0 0 auto;
        min-height: 44px;
        padding: var(--space-3) var(--space-4);
        border: 0;
        border-bottom: 2px solid transparent;
        background: transparent;
        color: var(--text-secondary);
        font: inherit;
        cursor: pointer;
      }
      button[aria-selected='true'] {
        color: var(--primary-color);
        border-bottom-color: var(--primary-color);
      }
      button:hover {
        background: var(--hover-bg);
      }
      button:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: -2px;
      }
      button:disabled {
        color: var(--text-muted);
        cursor: default;
      }
    `,
  ],
})
export class TabsComponent {
  readonly tabs = input.required<readonly UiTab[]>();
  readonly value = input<string>();
  readonly label = input.required<string>();
  /** Stable, page-unique identifier; the same prefix binds the tablist and its shared panel. */
  readonly idPrefix = input.required<string>();
  readonly valueChange = output<string>();

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');
  protected readonly focusIndex = linkedSignal(() => {
    const selected = this.tabs().findIndex((tab) => tab.value === this.value() && !tab.disabled);
    return selected !== -1 ? selected : this.tabs().findIndex((tab) => !tab.disabled);
  });

  tabId(value: string): string {
    return `${this.idPrefix()}-tab-${encodeURIComponent(value)}`;
  }
  panelId(): string {
    return `${this.idPrefix()}-panel`;
  }

  protected select(tab: UiTab): void {
    if (!tab.disabled && tab.value !== this.value()) this.valueChange.emit(tab.value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Rebuild from the current view so removed/reordered/disabled tabs cannot leave stale
    // focus-manager entries. CDK owns wrapping, Home/End and horizontal RTL semantics.
    const items = this.buttons().map(({ nativeElement: button }) => ({
      disabled: button.disabled,
      focus: () => button.focus(),
    }));
    const direction =
      getComputedStyle(this.element.nativeElement).direction === 'rtl' ? 'rtl' : 'ltr';
    const manager = new FocusKeyManager(items)
      .withWrap()
      .withVerticalOrientation(false)
      .withHomeAndEnd()
      .withHorizontalOrientation(direction);
    manager.updateActiveItem(this.focusIndex());
    manager.onKeydown(event);
    manager.destroy();
  }
}
