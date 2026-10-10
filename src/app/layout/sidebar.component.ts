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
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { NgTemplateOutlet } from '@angular/common';

import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '../core/adapters';
import { IonIcon } from '@ionic/angular/standalone';
import { SidebarService } from '../core/services/sidebar.service';
import { ViewportService } from '../core/services/viewport.service';
import { AuthService } from '../core/services/auth.service';
import { summarisePermissions } from '../shared/pipes/permission-summary.pipe';
import { NavItemConfig, NavigationConfigService } from '../core/services/navigation-config.service';

/** `READ_GLACCOUNT` -> `GLACCOUNT`. Null when the code is not verb-and-entity shaped. */
function entityOf(code: string): string | null {
  const at = code.trim().indexOf('_');
  return at > 0 ? code.trim().slice(at + 1) : null;
}

/**
 * Responsive sidebar component for primary application navigation.
 *
 * Renders the navigation tree provided by {@link NavigationConfigService},
 * which is already filtered by the current user's permissions and
 * institution configuration. Supports active route highlighting.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, TranslatePipe, IonIcon, NgTemplateOutlet],
  template: `
    <!--
      One element, two components. Wide: a permanent navigation landmark. Narrow: a modal drawer,
      which is why it takes dialog semantics and a focus trap below the breakpoint — a panel that
      covers the page while the reading order still runs through what is behind it is a trap of
      the other kind.
    -->
    <nav
      #panel
      id="app-navigation"
      class="sidebar"
      [class.collapsed]="!viewport.isMobile() && sidebarService.isCollapsed()"
      [class.drawer]="viewport.isMobile()"
      [class.open]="sidebarService.isDrawerOpen()"
      [attr.role]="viewport.isMobile() ? 'dialog' : 'navigation'"
      [attr.aria-modal]="viewport.isMobile() ? 'true' : null"
      [attr.inert]="viewport.isMobile() && !sidebarService.isDrawerOpen() ? '' : null"
      [attr.aria-label]="'nav.main' | appTranslate"
    >
      @if (viewport.isMobile()) {
        <button
          type="button"
          class="drawer-close"
          (click)="sidebarService.closeDrawer()"
          [attr.aria-label]="'nav.closeMenu' | appTranslate"
        >
          <ion-icon name="close-outline" aria-hidden="true"></ion-icon>
        </button>
      }
      <ul class="nav-list">
        <ng-container
          *ngTemplateOutlet="
            itemList;
            context: { items: navigationConfig.filteredNavItems(), depth: 0 }
          "
        ></ng-container>
      </ul>
    </nav>

    <ng-template #itemList let-items="items" let-depth="depth">
      @for (item of items; track item.id ?? item.route ?? item.labelKey) {
        @if (item.divider) {
          <li class="nav-divider"></li>
        } @else if (item.children) {
          <li>
            <div class="nav-group">
              <span class="nav-group-header">{{ item.labelKey | appTranslate }}</span>
              <ul class="nav-sub-list">
                <ng-container
                  *ngTemplateOutlet="itemList; context: { items: item.children, depth: depth + 1 }"
                ></ng-container>
              </ul>
            </div>
          </li>
        } @else if (item.kind === 'external') {
          <li>
            <!--
              A deployment's link to a system that sits beside Fineract. 'rel' is not optional:
              'noopener' denies the opened page a handle on this one via window.opener, and
              'noreferrer' keeps the back-office URL — which carries entity ids — out of the
              third party's referrer log.
            -->
            <a
              [href]="item.url"
              target="_blank"
              rel="noopener noreferrer"
              class="nav-item"
              [class.sub-item]="depth > 0"
            >
              @if (item.icon) {
                <ion-icon class="nav-icon" [name]="item.icon"></ion-icon>
              }
              <span class="nav-text">{{ item.labelKey | appTranslate }}</span>
              <ion-icon class="nav-external" name="open-outline" aria-hidden="true"></ion-icon>
              <span class="sr-only">{{ 'nav.opensInNewTab' | appTranslate }}</span>
            </a>
          </li>
        } @else {
          <li>
            <a
              [routerLink]="item.route"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
              class="nav-item"
              [class.sub-item]="depth > 0"
              [attr.title]="capabilities(item)"
            >
              @if (item.icon) {
                <ion-icon class="nav-icon" [name]="item.icon"></ion-icon>
              }
              <span class="nav-text">{{ item.labelKey | appTranslate }}</span>
            </a>
          </li>
        }
      }
    </ng-template>
  `,
  styles: [
    `
      .sidebar {
        width: var(--sidebar-width);
        background-color: var(--secondary-color);
        color: #fff;
        height: calc(100vh - var(--header-height));
        padding-top: 1rem;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        transition: width 0.2s ease-in-out;
      }
      :host-context([data-theme='dark']) .sidebar {
        background-color: var(--card-bg);
        border-right: 1px solid var(--border-color);
      }
      .sidebar.collapsed {
        width: 64px;
      }
      .sidebar::-webkit-scrollbar {
        width: 6px;
      }
      .sidebar::-webkit-scrollbar-track {
        background: transparent;
      }
      .sidebar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }
      .sidebar::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.4);
      }
      .nav-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      /* ---- narrow viewport: the same panel as an off-canvas drawer ---- */
      .sidebar.drawer {
        position: fixed;
        top: var(--header-height);
        bottom: 0;
        left: 0;
        width: min(86vw, 320px);
        z-index: 950;
        transform: translateX(-100%);
        /* Width is fixed here, so the collapse transition would fight the slide. */
        transition: transform 0.2s ease-out;
        box-shadow: var(--shadow-md);
      }
      .sidebar.drawer.open {
        transform: translateX(0);
      }
      @media (prefers-reduced-motion: reduce) {
        .sidebar.drawer {
          transition: none;
        }
      }
      .drawer-close {
        display: flex;
        align-items: center;
        justify-content: center;
        /* 44px is the smallest reliable touch target; anything under it is a mis-tap waiting
           to happen and is what scripts/check-tap-targets.mjs enforces. */
        min-width: 44px;
        min-height: 44px;
        margin: 0 0.5rem 0.25rem auto;
        background: none;
        border: none;
        color: inherit;
        font-size: 22px;
        cursor: pointer;
        border-radius: var(--border-radius);
      }
      .drawer-close:hover {
        background-color: rgba(255, 255, 255, 0.12);
      }
      .nav-external {
        margin-left: auto;
        font-size: 0.85rem;
        opacity: 0.6;
        flex-shrink: 0;
      }
      .sidebar.collapsed .nav-external {
        display: none;
      }
      .nav-item {
        display: flex;
        align-items: center;
        /* Comfortably over the 44px floor once padding and line-height are counted; stated
           explicitly so a future padding change cannot quietly drop under it. */
        min-height: 44px;
        padding: 0.75rem 1.5rem;
        color: #bdc3c7;
        text-decoration: none;
        transition: all 0.2s;
      }
      :host-context([data-theme='dark']) .nav-item {
        color: rgba(255, 255, 255, 0.7);
      }
      .nav-item:hover {
        background-color: #34495e;
        color: #fff;
      }
      :host-context([data-theme='dark']) .nav-item:hover {
        background-color: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
      .nav-item.active {
        /* White on --primary-color is only 3.15:1; --primary-strong clears AA. */
        background-color: var(--primary-strong);
        color: #fff;
        border-left: 4px solid #fff;
      }
      :host-context([data-theme='dark']) .nav-item.active {
        border-left-color: var(--primary-color);
        background-color: rgba(52, 152, 219, 0.25);
        color: #fff;
      }
      .nav-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        margin-right: 0.75rem;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .sidebar.collapsed .nav-icon {
        margin-right: 0;
      }
      .nav-text {
        font-size: 0.9rem;
        font-weight: 500;
        transition: opacity 0.2s;
        white-space: nowrap;
      }
      .sidebar.collapsed .nav-text {
        display: none;
      }
      .nav-group {
        padding: 0.5rem 0;
        transition: padding 0.2s;
      }
      .sidebar.collapsed .nav-group {
        padding: 0;
      }
      .nav-group-header {
        display: block;
        padding: 0.5rem 1.5rem;
        font-size: 0.75rem;
        text-transform: uppercase;
        /* #7f8c8d on the #2c3e50 sidebar is 3.16:1 — these are 12px labels, so
           they need 4.5:1, not the 3:1 large-text allowance. This is 5.1:1. */
        color: #a3b4b5;
        font-weight: 700;
        letter-spacing: 1px;
        white-space: nowrap;
      }
      :host-context([data-theme='dark']) .nav-group-header {
        /* 0.4 alpha composites to roughly the same 3.2:1 as the light theme. */
        color: rgba(255, 255, 255, 0.7);
      }
      .sidebar.collapsed .nav-group-header {
        display: none;
      }
      .nav-sub-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .sub-item {
        padding-left: 2.5rem;
      }
      .sidebar.collapsed .sub-item {
        padding-left: 0.75rem;
        justify-content: center;
      }
      .nav-divider {
        height: 1px;
        background-color: rgba(255, 255, 255, 0.1);
        margin: 0.5rem 1.5rem;
      }
      .sidebar.collapsed .nav-divider {
        display: none;
      }
    `,
  ],
})
export class SidebarComponent {
  protected readonly sidebarService = inject(SidebarService);
  protected readonly navigationConfig = inject(NavigationConfigService);
  protected readonly viewport = inject(ViewportService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly injector = inject(Injector);

  /**
   * Escape closes the drawer.
   *
   * Bound on the document rather than on the panel, because a modal should close on Escape
   * wherever focus happens to be — including on the header button that opened it, which is
   * outside the panel. Ignored entirely when the drawer is not showing, so this never competes
   * with a dialog or a select that is handling its own Escape.
   */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.sidebarService.isDrawerOpen()) {
      this.sidebarService.closeDrawer();
    }
  }

  constructor() {
    // Following a link has to dismiss the drawer, or the destination renders underneath it and
    // the user has to close the menu to see what they chose.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.sidebarService.closeDrawer());

    // Focus moves into the drawer when it opens, because it is a dialog: without this the next
    // Tab continues from the header button, through content the drawer is covering.
    //
    // Deferred to after the render, not done in the effect body. The panel carries `inert` while
    // closed and the binding that removes it is applied during change detection, so focusing
    // from inside the effect targets a subtree that is still inert — and focusing an inert
    // element is silently a no-op, which is the worst way for this to fail.
    effect(() => {
      if (!this.sidebarService.isDrawerOpen()) return;
      afterNextRender(
        () => this.panel()?.nativeElement.querySelector<HTMLElement>('button, a')?.focus(),
        { injector: this.injector },
      );
    });
  }

  /**
   * What the signed-in user can do in the module a nav entry leads to, as a hover hint.
   *
   * Only entries the user can already reach are in the tree — a refused one is filtered out
   * rather than shown greyed, because a menu is a list of destinations and a destination that
   * is not theirs is not a destination. So this never has to say "you cannot"; it says what
   * they will find when they arrive, which is the part that is not obvious from a one-word
   * label like "Clients".
   *
   * Derived from the codes the user actually holds for that entity, not from the single code
   * the entry is gated on: holding `READ_CLIENT` and `CREATE_CLIENT` should read as both.
   */
  protected capabilities(item: NavItemConfig): string | null {
    const gate = item.requiredPermissions;
    if (!gate) return null;
    const entity = entityOf(Array.isArray(gate) ? gate[0] : gate);
    if (!entity) return null;

    const held = (this.authService.currentUser()?.permissions ?? []).filter(
      (code) => entityOf(code) === entity,
    );
    // A superuser holds ALL_FUNCTIONS rather than the individual codes, so there is nothing
    // specific to enumerate and a generic "you can do everything" is noise on every item.
    if (held.length === 0) return null;
    return summarisePermissions(held);
  }
}
