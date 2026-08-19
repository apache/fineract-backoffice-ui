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

import { Injectable } from '@angular/core';

/** The minimal surface {@link TooltipRegistryService} needs from a shown tooltip. */
export interface DismissableTooltip {
  hide(): void;
}

/**
 * Keeps track of the one {@link TooltipDirective} instance currently showing its tooltip.
 *
 * Hover and focus are independent DOM event streams: a mouse can be over one help icon while
 * keyboard focus sits on another (e.g. tabbing while the pointer hasn't moved), and each
 * `TooltipDirective` instance only knows about its own host element. Without a shared
 * arbiter, two directives can each legitimately believe they are the active one and both
 * leave a bubble appended to `document.body` — which is exactly what the login page's API
 * Endpoint field and a stale field-level tooltip stacking on top of it looked like.
 * Registering here before showing guarantees at most one tooltip is ever on screen.
 */
@Injectable({ providedIn: 'root' })
export class TooltipRegistryService {
  private active?: DismissableTooltip;

  /** Hides whichever tooltip is currently showing, then records `next` as the active one. */
  activate(next: DismissableTooltip): void {
    if (this.active && this.active !== next) {
      this.active.hide();
    }
    this.active = next;
  }

  /** Clears the active slot, but only if `tooltip` is still the one holding it. */
  deactivate(tooltip: DismissableTooltip): void {
    if (this.active === tooltip) {
      this.active = undefined;
    }
  }
}
