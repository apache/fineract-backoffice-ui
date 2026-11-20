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

import { Component, ElementRef, HostListener, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { IonProgressBar } from '@ionic/angular/standalone';
import { HeaderComponent } from './header.component';
import { SidebarComponent } from './sidebar.component';
import { BreadcrumbComponent } from './breadcrumb.component';
import { GuidanceTourComponent } from '../shared';
import { TranslatePipe } from '../core/adapters';
import { LoadingService } from '../core/services/loading.service';
import { SidebarService } from '../core/services/sidebar.service';
import { GuidanceService } from '../core/services/guidance.service';
import { isTypingTarget, matchShortcut } from './keyboard-shortcuts';

/**
 * The primary application layout component (App Shell).
 *
 * Composes the `HeaderComponent` and `SidebarComponent` into a standard
 * business application layout with a scrollable main content area.
 */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterModule,
    IonProgressBar,
    HeaderComponent,
    SidebarComponent,
    BreadcrumbComponent,
    GuidanceTourComponent,
    TranslatePipe,
  ],
  template: `
    <div class="app-container" [class.sidebar-collapsed]="sidebarService.isCollapsed()">
      <!--
        The first stop in the tab order, so a keyboard user can pass over the header and the whole
        sidebar (over a hundred links) in one keystroke. WCAG 2.4.1.
      -->
      <a class="skip-link" href="#main-content" (click)="skipToMain($event)">{{
        'app.skipToMain' | appTranslate
      }}</a>
      @if (loadingService.isLoading()) {
        <ion-progress-bar type="indeterminate" class="global-loader"></ion-progress-bar>
      }
      <app-header />
      <div class="main-wrapper">
        @if (sidebarService.isDrawerOpen()) {
          <!--
            Dismisses the drawer on a press outside it. Not focusable and hidden from assistive
            technology: Escape and the drawer's own close control are the accessible routes out,
            and a backdrop in the tab order is a stop that announces nothing.
          -->
          <div
            class="drawer-backdrop"
            (click)="sidebarService.closeDrawer()"
            aria-hidden="true"
          ></div>
        }
        <app-sidebar />
        <main #main id="main-content" class="content-area" role="main" tabindex="-1">
          <app-breadcrumb />
          <router-outlet />
        </main>
      </div>
      <app-guidance-tour />
    </div>
  `,
  styles: [
    `
      .app-container {
        display: flex;
        flex-direction: column;
        /* dvh, not vh. Mobile browsers report vh against the viewport with the URL bar hidden,
           so 100vh is taller than what is actually on screen and the bottom of every page sits
           under the browser chrome. */
        height: 100dvh;
        overflow: hidden;
        position: relative;
      }
      .app-container.sidebar-collapsed {
        --sidebar-width: 64px;
      }
      /* Off screen until it takes focus. Not display: none or visibility: hidden, either of which
         would take it out of the tab order as well. */
      .skip-link {
        position: absolute;
        top: 0;
        inset-inline-start: 0;
        z-index: 1100;
        padding: 0.75rem 1rem;
        background-color: var(--primary-strong);
        color: #fff;
        font-weight: 600;
        text-decoration: none;
        transform: translateY(-100%);
      }
      .skip-link:focus {
        transform: none;
      }
      .global-loader {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1000;
        height: 3px;
      }
      .main-wrapper {
        display: flex;
        flex: 1;
        overflow: hidden;
      }
      .content-area {
        flex: 1;
        padding: var(--content-padding);
        background-color: var(--bg-color);
        overflow-y: auto;
        /* The drawer overlays this rather than displacing it, so the content keeps the full
           width and does not reflow when the drawer opens. */
        width: 100%;
      }
      /* main is focusable only as the place the skip link and a change of page land, not as a
         control, so a ring round the whole content area would mark nothing a user can operate. */
      .content-area:focus {
        outline: none;
      }
      .drawer-backdrop {
        position: fixed;
        inset: var(--header-height) 0 0;
        background: rgba(0, 0, 0, 0.45);
        z-index: 900;
      }
      @media (prefers-reduced-motion: no-preference) {
        .drawer-backdrop {
          animation: backdrop-in 0.15s ease-out;
        }
      }
      @keyframes backdrop-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
    `,
  ],
})
export class MainLayoutComponent {
  protected readonly loadingService = inject(LoadingService);
  protected readonly sidebarService = inject(SidebarService);
  private readonly guidanceService = inject(GuidanceService);
  private readonly router = inject(Router);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  constructor() {
    // A change of page moves focus to the new content. Without it, focus stays on the sidebar
    // link that was activated, or drops to the top of the document when the control that had it
    // was destroyed, and either way the next Tab starts in the navigation again.
    //
    // Only when the path changes. A query-string change is the same page updating its own state
    // (a paginator, a filter), and taking focus off the control that did it would be a bug. The
    // first navigation is skipped too: on a fresh load focus is already at the top of the
    // document, where the skip link is the first stop.
    let previousPath: string | null = null;
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        const path = event.urlAfterRedirects.split(/[?#]/, 1)[0];
        if (previousPath !== null && path !== previousPath) this.focusMain();
        previousPath = path;
      });
  }

  /**
   * The skip link's target is handled here rather than left to the browser. With `<base href>`
   * set, a bare `#main-content` resolves against the base, so following it would navigate to the
   * root of the app instead of moving within the page.
   */
  protected skipToMain(event: Event): void {
    event.preventDefault();
    this.focusMain();
  }

  /** Leaves focus alone when it is already inside `main`, e.g. a page that focuses its own heading. */
  private focusMain(): void {
    const main = this.main().nativeElement;
    if (main.contains(document.activeElement)) return;
    main.focus({ preventScroll: true });
  }

  /** Global navigation shortcuts (Alt+letter) — see `keyboard-shortcuts.ts` for the bindings. */
  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (isTypingTarget(event.target)) return;

    const shortcut = matchShortcut(event);
    if (!shortcut) return;

    event.preventDefault();
    if (shortcut.action === 'help') {
      this.guidanceService.startTour(this.router.url);
    } else if (shortcut.route) {
      this.router.navigate([shortcut.route]);
    }
  }
}
