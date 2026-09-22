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

import { Component, HostListener, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NavigationStart, Router, RouterModule } from '@angular/router';
import { IonProgressBar } from '@ionic/angular/standalone';
import { HeaderComponent } from './header.component';
import { SidebarComponent } from './sidebar.component';
import { BreadcrumbComponent } from './breadcrumb.component';
import { GuidanceTourComponent } from '../shared';
import { LoadingService } from '../core/services/loading.service';
import { SidebarService } from '../core/services/sidebar.service';
import { GuidanceService } from '../core/services/guidance.service';
import { isTypingTarget, matchShortcut } from './keyboard-shortcuts';
import { filter } from 'rxjs';
import { OVERLAY } from '../core/adapters';

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
  ],
  template: `
    <div class="app-container" [class.sidebar-collapsed]="sidebarService.isCollapsed()">
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
        <main class="content-area" role="main">
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
  private readonly overlay = inject(OVERLAY);

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.overlay.dismissPopovers());
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
