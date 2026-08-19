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

import { inject, input, Directive, ElementRef, OnDestroy, Renderer2 } from '@angular/core';
import { TooltipRegistryService } from './tooltip-registry.service';

/** Distance between the host and the tooltip, in pixels. */
const OFFSET = 8;
/** Matches the delay the app's contextual help had before, so it does not flicker on passing hovers. */
const SHOW_DELAY = 300;

/** Monotonic counter for tooltip ids. Not random — these only need to be unique per page. */
let nextId = 0;

/**
 * Tooltip for contextual help.
 *
 * Ionic ships no tooltip, and the native `title` attribute is not a substitute here: it does
 * not surface from the shadow host of an Ionic web component, it cannot be styled, and its
 * delay is set by the browser. This app leans on contextual help throughout — nearly every
 * table and form field carries a HELP.*_DESC key — so the affordance is worth owning.
 *
 * The tooltip is appended to the body rather than the host, so it is never clipped by a
 * card's overflow, and it is wired up with aria-describedby so screen readers announce it.
 * {@link TooltipRegistryService} guarantees at most one instance of it is visible at once,
 * even when hover and focus land on two different hosts in quick succession.
 *
 * Usage: `<ion-button [appTooltip]="'HELP.SEARCH_DESC' | translate">`
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true,
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hide()',
    '(focusin)': 'show()',
    '(focusout)': 'hide()',
    // Escape dismisses, matching every other transient surface in the app.
    '(keydown.escape)': 'hide()',
  },
})
export class TooltipDirective implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly registry = inject(TooltipRegistryService);

  private tooltip?: HTMLElement;
  private timer?: ReturnType<typeof setTimeout>;
  private id = '';

  /**
   * Help text to show, named by the directive's own selector.
   *
   * A signal input so the text stays correct when it is bound to an expression — the common
   * case here is `| translate`, which re-emits when the user switches language.
   */
  readonly text = input('', { alias: 'appTooltip' });

  show(): void {
    // `mouseenter` and `focusin` can both fire for the same interaction (e.g. clicking the
    // host focuses it right after the pointer enters). Without clearing the previous timer
    // here, the first one is orphaned: its callback still fires later, creates its own
    // element, and overwrites `this.tooltip`'s reference to it — leaking a bubble that
    // `hide()` can never find again, permanently stuck on `document.body`.
    clearTimeout(this.timer);
    if (!this.text() || this.tooltip) return;

    this.timer = setTimeout(() => {
      // Only one tooltip may be on screen at a time — showing this one dismisses whichever
      // other host (hovered, then left focused by a stray tab-through) still had one up.
      this.registry.activate(this);

      const el = this.renderer.createElement('div') as HTMLElement;
      this.id = `tooltip-${++nextId}`;

      el.className = 'app-tooltip';
      el.id = this.id;
      el.setAttribute('role', 'tooltip');
      el.textContent = this.text();
      this.renderer.appendChild(document.body, el);

      this.position(el);
      this.renderer.setAttribute(this.host.nativeElement, 'aria-describedby', this.id);
      // Added after positioning so the fade-in does not animate from the wrong place.
      el.classList.add('app-tooltip--visible');
      this.tooltip = el;
    }, SHOW_DELAY);
  }

  hide(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.registry.deactivate(this);
    if (!this.tooltip) return;

    this.renderer.removeChild(document.body, this.tooltip);
    this.renderer.removeAttribute(this.host.nativeElement, 'aria-describedby');
    this.tooltip = undefined;
  }

  ngOnDestroy(): void {
    this.hide();
  }

  /** Places the tooltip above the host, flipping below when there is no room. */
  private position(el: HTMLElement): void {
    const host = this.host.nativeElement.getBoundingClientRect();
    const { width, height } = el.getBoundingClientRect();

    const above = host.top - height - OFFSET;
    const top = above < 0 ? host.bottom + OFFSET : above;

    // Keep the tooltip on screen when the host sits near either edge.
    const centred = host.left + host.width / 2 - width / 2;
    const left = Math.max(OFFSET, Math.min(centred, window.innerWidth - width - OFFSET));

    el.style.top = `${top + window.scrollY}px`;
    el.style.left = `${left + window.scrollX}px`;
  }
}
