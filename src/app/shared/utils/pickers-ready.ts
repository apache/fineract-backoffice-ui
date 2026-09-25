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

import { Signal, afterNextRender, signal } from '@angular/core';

/**
 * Guards `ion-datetime-button` against initializing before the `ion-datetime` it points at exists.
 *
 * The button resolves its target exactly once, in `componentWillLoad`, through a global
 * `getElementById`, and gives up for good when that lookup misses. Our pickers live inside
 * `ion-modal[keepContentsMounted]`, whose contents Angular mounts later in the change-detection
 * pass. On a first visit to a routed page the button's lazy Ionic chunk is still loading, which
 * delays it past that point; on a revisit the chunk is cached, so the button initializes first,
 * finds nothing, and renders a blank control that never opens.
 *
 * Hold the buttons behind this flag -- `@if (pickersReady()) { <ion-datetime-button ... }` -- so
 * they are created one render after the pickers they look for. Call it as a field initializer,
 * which runs inside the component's injection context:
 *
 * ```ts
 * readonly pickersReady = createPickersReady();
 * ```
 *
 * A page-level flag does not help pickers created later inside `@for` — by then it is already
 * true. Use `DeferredDatetimeButtonComponent` for those rows (see #548).
 *
 * See https://github.com/apache/fineract-backoffice-ui/issues/541.
 */
export function createPickersReady(): Signal<boolean> {
  const ready = signal(false);
  afterNextRender(() => ready.set(true));
  return ready.asReadonly();
}
