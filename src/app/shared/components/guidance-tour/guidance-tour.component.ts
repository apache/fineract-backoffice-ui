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

import { TranslateModule } from '@ngx-translate/core';
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

/**
 * How long to keep looking for a step's target before giving up.
 *
 * A tour opened while the routed view is still fetching would otherwise find nothing and
 * silently skip the highlight — the copy talks about a table that has not rendered yet. Two
 * frames is not enough on a cold list; a short poll is.
 */
const TARGET_LOOKUP_TIMEOUT_MS = 1500;
const TARGET_LOOKUP_INTERVAL_MS = 100;

@Component({
  selector: 'app-guidance-tour',
  standalone: true,
  imports: [
    TranslateModule,
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
              {{ guidanceService.currentStep()?.titleKey | translate }}
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p id="guidance-description">
              {{ guidanceService.currentStep()?.descriptionKey | translate }}
            </p>
            <!--
              Announced rather than merely shown: Next replaces the card's text in place, and
              without a live region a screen reader gives no sign that anything changed.
            -->
            <div class="progress-info" aria-live="polite">
              {{
                'GUIDE.STEP_OF'
                  | translate
                    : {
                        current: guidanceService.currentStepIndex() + 1,
                        total: guidanceService.activeSteps().length,
                      }
              }}
            </div>
          </ion-card-content>
          <div class="guidance-actions">
            <ion-button fill="clear" color="medium" (click)="onExit()">
              {{ 'COMMON.EXIT' | translate }}
            </ion-button>
            <span class="guidance-spacer"></span>
            <ion-button
              fill="clear"
              [disabled]="guidanceService.currentStepIndex() === 0"
              (click)="onBack()"
            >
              {{ 'COMMON.BACK' | translate }}
            </ion-button>
            <ion-button color="primary" (click)="onNext()">
              {{ (guidanceService.isLastStep() ? 'COMMON.FINISH' : 'COMMON.NEXT') | translate }}
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
      }
    `,
  ],
})
export class GuidanceTourComponent {
  protected readonly guidanceService = inject(GuidanceService);
  private readonly renderer = inject(Renderer2);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly router = inject(Router);

  private activeTarget: HTMLElement | null = null;
  private lookupTimer: ReturnType<typeof setInterval> | null = null;
  /** What had focus when the tour opened, so Exit can hand it back. */
  private returnFocusTo: HTMLElement | null = null;

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
    if (this.activeTarget) {
      this.renderer.removeClass(this.activeTarget, 'guidance-highlight');
      this.activeTarget = null;
    }
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
