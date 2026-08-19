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

import { Directive, ElementRef, computed, effect, inject, input } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { ConfigService } from '../../core/services/config.service';
import { I18N } from '../../core/adapters';
import { summarisePermissions } from '../pipes/permission-summary.pipe';

/**
 * Disables a control the user lacks the permission for, and says which permission that is.
 *
 * The sibling {@link HasPermissionDirective} removes the element instead. Both are right, for
 * different things, and the difference is what the control does rather than how privileged it is:
 *
 *  - **Removed** — anything that navigates somewhere else: a sidebar entry, a "Create" button
 *    that opens a form. There is nothing to explain, the destination simply is not part of this
 *    user's application, and a list of greyed-out doors is worse than a shorter corridor.
 *  - **Disabled, with the reason** — an action on the record already on screen. The user is
 *    looking at the loan; that they cannot approve it is a fact about their role that they need
 *    to act on, and hiding the button leaves them to conclude the feature is missing.
 *
 * Naming the code is safe here precisely because the user already reached the screen: they hold
 * whatever the route required, and everybody on it is authenticated back-office staff. It is
 * also the only form an administrator can act on without translation.
 *
 * ```html
 * <ion-button appRequiresPermission="APPROVE_LOAN" (click)="approve()">Approve</ion-button>
 * <ion-item [appRequiresPermission]="['A', 'B']" [appRequiresPermissionMatchAll]="true">…</ion-item>
 * ```
 *
 * **This is presentation, not enforcement.** A disabled button stops a click, not a request;
 * Fineract refuses the operation regardless, and remains the authoritative boundary.
 */
/** Host-binding expression, shared by the pointer and keyboard paths. */
const BLOCK_WHEN_REFUSED = 'onClick($event)';

@Directive({
  selector: '[appRequiresPermission]',
  standalone: true,
  host: {
    '[attr.disabled]': 'granted() ? null : true',
    '[attr.aria-disabled]': 'granted() ? null : "true"',
    '[class.app-requires-permission]': '!granted()',
    '[attr.title]': 'granted() ? null : hint()',
    '[attr.aria-label]': 'granted() ? null : hint()',
    '(click)': BLOCK_WHEN_REFUSED,
    '(keydown.enter)': BLOCK_WHEN_REFUSED,
    '(keydown.space)': BLOCK_WHEN_REFUSED,
  },
})
export class RequiresPermissionDirective {
  private readonly authService = inject(AuthService);
  private readonly config = inject(ConfigService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly i18n = inject(I18N);

  /** Permission, or permissions, the action requires. */
  readonly appRequiresPermission = input<string | string[]>([]);
  /** AND semantics for an array. Default is OR — any one of them is enough. */
  readonly appRequiresPermissionMatchAll = input(false);

  protected readonly granted = computed(() => {
    // Reading the session registers the dependency; `hasPermission` reads it internally, but
    // not through a signal this computed would otherwise see.
    this.authService.currentUser();
    if (!this.config.rbacEnabled()) return true;
    const required = this.appRequiresPermission();
    if (!required || required.length === 0) return true;
    return this.authService.hasPermission(required, this.appRequiresPermissionMatchAll());
  });

  /** The text on the tooltip and the accessible name: what is missing, in both forms. */
  protected readonly hint = computed(() => {
    const required = this.appRequiresPermission();
    const codes = Array.isArray(required) ? required : [required];
    // Read the active language so the hint is rebuilt when it changes.
    this.i18n.currentLang();
    const summary = summarisePermissions(codes);
    const joined = codes.join(
      this.i18n.translate(
        this.appRequiresPermissionMatchAll() ? 'PERMISSIONS.JOIN_ALL' : 'PERMISSIONS.JOIN_ANY',
      ),
    );
    return this.i18n.translate('PERMISSIONS.REQUIRES', {
      codes: joined,
      summary: summary || joined,
    });
  });

  constructor() {
    // Ionic components own a `disabled` property that the host binding above cannot reach: the
    // attribute is read once at hydration, so a later change is ignored. Setting the property
    // keeps a refused control refused when permissions arrive after the first render.
    effect(() => {
      const element = this.host.nativeElement as HTMLElement & { disabled?: boolean };
      if ('disabled' in element) element.disabled = !this.granted();
    });
  }

  /**
   * Belt and braces. A disabled `ion-button` does not emit a click, but `ion-item` and a plain
   * `div` with a handler will, and an action that fires anyway would be the one failure mode
   * worth preventing.
   */
  protected onClick(event: Event): void {
    if (this.granted()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}
