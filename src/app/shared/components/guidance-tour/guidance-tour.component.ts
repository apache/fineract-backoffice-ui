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

import {
  Component,
  ElementRef,
  Renderer2,
  ViewEncapsulation,
  effect,
  inject,
  viewChild,
} from '@angular/core';

import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
} from '@ionic/angular/standalone';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { GuidanceService } from '../../../core/services/guidance.service';
import { MOBILE_MEDIA_QUERY } from '../../../core/services/viewport.service';
import { TranslatePipe } from '../../../core/adapters';

/**
 * How long to keep looking for a step's target before giving up.
 *
 * A tour opened while the routed view is still fetching would otherwise find nothing and
 * silently skip the highlight — the copy talks about a table that has not rendered yet. Two
 * frames is not enough on a cold list; a short poll is.
 */
const TARGET_LOOKUP_TIMEOUT_MS = 1500;
const TARGET_LOOKUP_INTERVAL_MS = 100;

/**
 * How far the scrim's cutout extends beyond the target's own box.
 *
 * `.guidance-highlight` paints 3px outline-offset + 3px outline + 6px box-shadow spread beyond
 * the box edge (12px total). A couple more pixels keep the scrim from clipping that glow.
 */
const SCRIM_PAD_PX = 14;

/** Space kept between the repositioned card and the target it now sits beside. */
const CARD_TARGET_GAP_PX = 16;

/** Minimum space kept between the card and the viewport edge while repositioned. */
const CARD_VIEWPORT_MARGIN_PX = 24;

@Component({
  selector: 'app-guidance-tour',
  standalone: true,
  imports: [
    TranslatePipe,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
  ],
  // The highlight class is applied to elements in other components' templates, so its rule
  // cannot be scoped to this one.
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.active]': 'guidanceService.isPlaying()',
    // On `document`, not on the host. As a host binding this only fired for events bubbling
    // from inside the card — and the tour is non-modal by design, so a user who clicks the
    // thing the step is describing moves focus into the page and Escape then does nothing.
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    @if (guidanceService.isPlaying() && guidanceService.currentStep()) {
      <div
        class="guidance-overlay"
        role="dialog"
        aria-labelledby="guidance-title"
        aria-describedby="guidance-description"
        tabindex="-1"
        #panel
      >
        <ion-card class="guidance-card">
          <ion-card-header>
            <ion-card-title id="guidance-title">
              <ion-icon name="help-circle-outline" aria-hidden="true"></ion-icon>
              {{ guidanceService.currentStep()?.titleKey | appTranslate }}
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p id="guidance-description">
              {{ guidanceService.currentStep()?.descriptionKey | appTranslate }}
            </p>
            <!--
              Announced rather than merely shown: Next replaces the card's text in place, and
              without a live region a screen reader gives no sign that anything changed.
            -->
            <div class="progress-info" aria-live="polite">
              {{
                'GUIDE.STEP_OF'
                  | appTranslate
                    : {
                        current: guidanceService.currentStepIndex() + 1,
                        total: guidanceService.activeSteps().length,
                      }
              }}
            </div>
          </ion-card-content>
          <div class="guidance-actions">
            <ion-button fill="clear" color="medium" (click)="onExit()">
              {{ 'COMMON.EXIT' | appTranslate }}
            </ion-button>
            <span class="guidance-spacer"></span>
            <ion-button
              fill="clear"
              [disabled]="guidanceService.currentStepIndex() === 0"
              (click)="onBack()"
            >
              {{ 'COMMON.BACK' | appTranslate }}
            </ion-button>
            <ion-button color="primary" (click)="onNext()">
              {{ (guidanceService.isLastStep() ? 'COMMON.FINISH' : 'COMMON.NEXT') | appTranslate }}
            </ion-button>
          </div>
        </ion-card>
      </div>
    }
  `,
  styles: [
    `
      app-guidance-tour {
        display: none;
      }
      app-guidance-tour.active {
        display: block;
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 360px;
        max-width: calc(100vw - 48px);
        z-index: 10000;
      }
      /*
        A 360px card pinned bottom-right covers a good part of a phone screen, and what it
        covers is often the thing the step is describing. Full-width bottom sheet instead, and
        scrollTargetIntoView keeps the target in the space left above it.
      */
      @media (max-width: 768px) {
        app-guidance-tour.active {
          left: 0;
          right: 0;
          bottom: 0;
          width: auto;
          max-width: none;
        }
        .guidance-card {
          margin: 0;
          border-left: none !important;
          border-top: 4px solid var(--primary-color);
          border-radius: 12px 12px 0 0;
        }
      }
      /*
        Room to scroll a target clear of the card.

        scrollIntoView cannot move something that is already as far down as the document goes,
        so without this the last element on a screen ends up behind the card. Measured twice:
        the share-account form's final select sat 30px under the mobile sheet, and on the
        dashboard 77.6% of the System Status card was painted over at 1440x900 — that step's
        whole subject, with only its top 48px showing.

        Needed at both widths, which is why this is not inside the media query. The desktop
        card is a corner panel of a known size; the narrow one is a sheet over the lower third.
      */
      body.guidance-active .content-area {
        padding-bottom: 320px;
      }
      @media (max-width: 768px) {
        body.guidance-active .content-area {
          padding-bottom: 60vh;
        }
      }
      .guidance-overlay {
        animation: guidanceSlideUp 0.3s ease-out;
      }
      /*
        Four strips around the target rather than one full-screen scrim with a clip-path hole:
        a clip-path polygon can't cut a hole without an SVG mask, and this needs no z-index or
        position change on the target itself, which the highlight rule above deliberately avoids.

        pointer-events: none because the tour is non-modal (see the host binding comment below) —
        dimming the rest of the screen must not stop a click from reaching it.
      */
      .guidance-scrim {
        position: fixed;
        background: var(--guidance-scrim-color, rgba(0, 0, 0, 0.45));
        z-index: 9999;
        pointer-events: none;
        transition: opacity 0.2s ease-in-out;
      }
      .guidance-card {
        border-left: 4px solid var(--primary-color);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15) !important;
        background: var(--card-bg);
      }
      .guidance-card ion-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
        color: var(--secondary-color);
      }
      .guidance-card p {
        margin: 12px 0;
        font-size: 14px;
        color: var(--text-muted);
        line-height: 1.5;
      }
      .progress-info {
        font-size: 12px;
        /* Was a hardcoded #9aa0a6, which ignores the theme and is unreadable in dark mode. */
        color: var(--text-muted);
        font-weight: 500;
        margin-top: 8px;
      }
      .guidance-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 8px 16px;
      }
      .guidance-spacer {
        flex: 1 1 auto;
      }

      /*
        Applied to elements owned by other components, hence the encapsulation note above.

        Deliberately outline plus box-shadow and nothing else: this used to also set
        position: relative and z-index, which changes the stacking and offset parent of
        whatever it lands on — enough to move a grid or flex child while the tour is open.
        An outline paints outside the box without either.
      */
      .guidance-highlight {
        /*
          Fallbacks are load-bearing, not decoration: a var() that resolves to nothing makes
          the whole declaration invalid, so a deployment that unset the token would lose the
          outline altogether rather than get a default one.
        */
        outline: 3px solid var(--guidance-highlight-color, #b45309) !important;
        outline-offset: 3px;
        border-radius: 4px;
        /* Derived from the one token, so a deployment retinting the outline retints the glow. */
        box-shadow: 0 0 0 6px
          color-mix(in srgb, var(--guidance-highlight-color, #b45309) 18%, transparent);
        transition:
          outline-color 0.2s ease-in-out,
          box-shadow 0.2s ease-in-out;
      }

      @keyframes guidanceSlideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .guidance-overlay {
          animation: none;
        }
        .guidance-highlight {
          transition: none;
        }
        .guidance-scrim {
          transition: none;
        }
      }
    `,
  ],
})
export class GuidanceTourComponent {
  protected readonly guidanceService = inject(GuidanceService);
  private readonly renderer = inject(Renderer2);
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly router = inject(Router);

  private activeTarget: HTMLElement | null = null;
  private lookupTimer: ReturnType<typeof setInterval> | null = null;
  /** What had focus when the tour opened, so Exit can hand it back. */
  private returnFocusTo: HTMLElement | null = null;

  /** The four scrim strips, created once per highlighted target and reused across reflows. */
  private scrimEls: HTMLElement[] = [];
  private repositionRaf: number | null = null;
  /**
   * Bound once rather than per {@link armViewportTracking} call, so the exact same reference can
   * be passed to `removeEventListener` — an inline arrow there would never match and leak the
   * listener.
   */
  private readonly onViewportChange = (): void => this.scheduleReposition();

  constructor() {
    /**
     * A tour describes one screen, so it cannot outlive being on it.
     *
     * Navigating with the tour open used to carry it along: opening it on the dashboard and
     * clicking Clients left the dashboard card over the client list, and Next then talked about
     * Fineract environment health with nothing highlighted, because `.status-list` is not in
     * that view. That is the same wrongness as the old dashboard-tour fallback, reached by
     * navigating instead of by pressing the button.
     */
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.guidanceService.endTour());

    effect(() => {
      const step = this.guidanceService.currentStep();
      const isPlaying = this.guidanceService.isPlaying();

      this.cancelLookup();
      this.clearHighlight();

      // A class on `body` rather than a style on the target: the extra room belongs to the
      // scroll container, and the tour has no business writing to another component's element.
      this.renderer[isPlaying ? 'addClass' : 'removeClass'](document.body, 'guidance-active');

      if (!isPlaying) {
        this.restoreFocus();
        return;
      }

      this.captureFocusOrigin();
      // Reading the panel through viewChild rather than a querySelector: the card is this
      // component's own, and the tour is the one thing on screen that must not depend on
      // finding an element by class name.
      this.panel()?.nativeElement.focus({ preventScroll: true });

      if (step?.targetSelector) {
        this.findTarget(step.targetSelector, step.scope ?? 'content');
      }
    });
  }

  /**
   * Looks for a step's target, retrying while the view settles.
   *
   * Scoped by {@link StepScope}: a `'content'` step searches `main` only, so it cannot resolve
   * to the sidebar or header however loose its selector is. That is the structural half of the
   * fix for the dashboard step that highlighted the nav list.
   */
  private findTarget(selector: string, scope: 'content' | 'shell'): void {
    const root = (): ParentNode | null =>
      scope === 'shell' ? document.body : document.querySelector('main');

    // Presence, not visibility. `getClientRects()` and `offsetParent` were the obvious guards
    // and both are useless here: jsdom reports no layout for anything, so under test every
    // target reads as hidden and no step ever highlights. Nothing needs the check anyway — the
    // one step that used to point at a hidden element (the sidebar, collapsed into a drawer on
    // a narrow viewport) now points at the toggle that opens it, which is always on screen.
    const attempt = (): boolean => {
      const el = root()?.querySelector(selector) as HTMLElement | null;
      if (!el) return false;
      this.activeTarget = el;
      this.renderer.addClass(el, 'guidance-highlight');
      this.scrollTargetIntoView(el);
      this.armViewportTracking();
      this.scheduleReposition();
      return true;
    };

    if (attempt()) return;

    let waited = 0;
    this.lookupTimer = setInterval(() => {
      waited += TARGET_LOOKUP_INTERVAL_MS;
      if (attempt() || waited >= TARGET_LOOKUP_TIMEOUT_MS) this.cancelLookup();
    }, TARGET_LOOKUP_INTERVAL_MS);
  }

  /**
   * Brings the target into the part of the viewport the card is not covering.
   *
   * `block: 'center'` is right on a wide screen. On a phone the card is a bottom sheet over
   * roughly the lower third, so centring can put the highlight behind it — the one place a
   * tour must never leave its subject.
   */
  private scrollTargetIntoView(el: HTMLElement): void {
    const isNarrow = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
    el.scrollIntoView({ behavior: 'smooth', block: isNarrow ? 'start' : 'center' });
  }

  private cancelLookup(): void {
    if (this.lookupTimer !== null) {
      clearInterval(this.lookupTimer);
      this.lookupTimer = null;
    }
  }

  private clearHighlight(): void {
    this.disarmViewportTracking();
    this.hideScrim();
    this.clearCardPosition();
    if (this.activeTarget) {
      this.renderer.removeClass(this.activeTarget, 'guidance-highlight');
      this.activeTarget = null;
    }
  }

  /**
   * Keeps the card and scrim glued to the target while the page moves under it.
   *
   * `scroll` does not bubble, so a plain listener on `window` never sees one fired on
   * `.content-area` — the app's actual scroll container (`overflow-y: auto`), not the window.
   * Capture-phase listeners are dispatched top-down regardless of bubbling, so registering on
   * `window` with `capture: true` catches it as it passes through on its way to the target.
   */
  private armViewportTracking(): void {
    window.addEventListener('scroll', this.onViewportChange, { passive: true, capture: true });
    window.addEventListener('resize', this.onViewportChange, { passive: true });
  }

  private disarmViewportTracking(): void {
    window.removeEventListener('scroll', this.onViewportChange, true);
    window.removeEventListener('resize', this.onViewportChange);
    if (this.repositionRaf !== null) {
      cancelAnimationFrame(this.repositionRaf);
      this.repositionRaf = null;
    }
  }

  /** Throttled to one measurement per frame — `scroll` can fire far more often than that. */
  private scheduleReposition(): void {
    if (this.repositionRaf !== null) return;
    this.repositionRaf = requestAnimationFrame(() => {
      this.repositionRaf = null;
      const target = this.activeTarget;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      this.updateScrim(rect);
      this.repositionCard(rect);
    });
  }

  /**
   * Anchors the card beside its target on wide screens, trying right, left, below, then above,
   * and keeping the corner fallback for whichever fits first.
   *
   * Left untouched on a narrow viewport, where the CSS media query already turns the card into a
   * full-width bottom sheet — a position this fixed-size math has no business overriding.
   */
  private repositionCard(rect: DOMRect): void {
    if (window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
      this.clearCardPosition();
      return;
    }

    const hostEl = this.hostRef.nativeElement;
    const cardEl = hostEl.querySelector('.guidance-card') as HTMLElement | null;
    const cardWidth = cardEl?.offsetWidth || 360;
    const cardHeight = cardEl?.offsetHeight || 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = CARD_TARGET_GAP_PX;
    const margin = CARD_VIEWPORT_MARGIN_PX;

    const placements = [
      {
        left: rect.right + gap,
        top: this.clamp(rect.top, margin, vh - cardHeight - margin),
        fits: rect.right + gap + cardWidth + margin <= vw,
      },
      {
        left: rect.left - gap - cardWidth,
        top: this.clamp(rect.top, margin, vh - cardHeight - margin),
        fits: rect.left - gap - cardWidth >= margin,
      },
      {
        left: this.clamp(rect.left, margin, vw - cardWidth - margin),
        top: rect.bottom + gap,
        fits: rect.bottom + gap + cardHeight + margin <= vh,
      },
      {
        left: this.clamp(rect.left, margin, vw - cardWidth - margin),
        top: rect.top - gap - cardHeight,
        fits: rect.top - gap - cardHeight >= margin,
      },
    ];

    const chosen = placements.find((p) => p.fits);
    if (!chosen) {
      // No side has room — a target that fills most of a small window. The corner fallback is a
      // known, tested position rather than one guaranteed to run off the viewport.
      this.clearCardPosition();
      return;
    }

    this.renderer.setStyle(hostEl, 'top', `${chosen.top}px`);
    this.renderer.setStyle(hostEl, 'left', `${chosen.left}px`);
    this.renderer.setStyle(hostEl, 'right', 'auto');
    this.renderer.setStyle(hostEl, 'bottom', 'auto');
  }

  private clearCardPosition(): void {
    const hostEl = this.hostRef.nativeElement;
    for (const prop of ['top', 'left', 'right', 'bottom']) {
      this.renderer.removeStyle(hostEl, prop);
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private ensureScrimEls(): HTMLElement[] {
    if (this.scrimEls.length === 0) {
      this.scrimEls = Array.from({ length: 4 }, () => {
        const div = this.renderer.createElement('div') as HTMLElement;
        this.renderer.addClass(div, 'guidance-scrim');
        this.renderer.appendChild(document.body, div);
        return div;
      });
    }
    return this.scrimEls;
  }

  /** Dims everything except a `SCRIM_PAD_PX` margin around the target, as four fixed strips. */
  private updateScrim(rect: DOMRect): void {
    const [above, below, left, right] = this.ensureScrimEls();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const top = Math.max(rect.top - SCRIM_PAD_PX, 0);
    const bottom = Math.min(rect.bottom + SCRIM_PAD_PX, vh);
    const holeLeft = Math.max(rect.left - SCRIM_PAD_PX, 0);
    const holeRight = Math.min(rect.right + SCRIM_PAD_PX, vw);

    this.setStripRect(above, 0, 0, vw, top);
    this.setStripRect(below, bottom, 0, vw, Math.max(vh - bottom, 0));
    this.setStripRect(left, top, 0, holeLeft, bottom - top);
    this.setStripRect(right, top, holeRight, Math.max(vw - holeRight, 0), bottom - top);
  }

  private setStripRect(
    el: HTMLElement,
    top: number,
    left: number,
    width: number,
    height: number,
  ): void {
    this.renderer.setStyle(el, 'top', `${top}px`);
    this.renderer.setStyle(el, 'left', `${left}px`);
    this.renderer.setStyle(el, 'width', `${width}px`);
    this.renderer.setStyle(el, 'height', `${height}px`);
  }

  private hideScrim(): void {
    for (const el of this.scrimEls) {
      this.renderer.removeChild(document.body, el);
    }
    this.scrimEls = [];
  }

  private captureFocusOrigin(): void {
    if (this.returnFocusTo) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && !this.panel()?.nativeElement.contains(active)) {
      this.returnFocusTo = active;
    }
  }

  private restoreFocus(): void {
    this.returnFocusTo?.focus({ preventScroll: true });
    this.returnFocusTo = null;
  }

  onNext() {
    this.guidanceService.nextStep();
  }

  onBack() {
    this.guidanceService.previousStep();
  }

  /**
   * Guarded rather than unconditional: this listens on `document`, so without the check it
   * would answer every Escape in the application, including ones meant for a dialog above it.
   */
  onEscape() {
    if (this.guidanceService.isPlaying()) this.onExit();
  }

  onExit() {
    this.guidanceService.endTour();
  }
}
