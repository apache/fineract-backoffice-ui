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

import { Component, Directive, ElementRef, InjectionToken, inject, input } from '@angular/core';
import { IonDatetimeButton } from '@ionic/angular/standalone';
import { createPickersReady } from '../../shared/utils/pickers-ready';

const DATETIME_TARGET_ID = new InjectionToken<string>('DATETIME_TARGET_ID');

/**
 * Stamps `datetime` as a real attribute in the constructor, before Ionic's
 * `componentWillLoad` reads it. A `[datetime]` property binding is too late (#544).
 */
@Directive({
  selector: 'ion-datetime-button[appStampDatetime]',
  standalone: true,
})
export class StampDatetimeDirective {
  constructor() {
    inject(ElementRef<HTMLElement>).nativeElement.setAttribute(
      'datetime',
      inject(DATETIME_TARGET_ID),
    );
  }
}

/**
 * `ion-datetime-button` that is safe to create inside `@for` / `@if`.
 *
 * The button resolves its target `ion-datetime` exactly once, in `componentWillLoad`,
 * through `getElementById`. A page-level `createPickersReady()` does not help rows added
 * after first render — the flag is already true, so the button and its modal mount in the
 * same pass and the lookup misses. This wrapper holds its own ready flag, so each instance
 * waits for the render that mounts *its* picker.
 *
 * Lives under `src/app/ui/` per ADR 0005: naming Ionic is the primitive's job, not the
 * feature's. Consumers import `DeferredDatetimeButtonComponent` and never the vendor tag.
 *
 * See https://github.com/apache/fineract-backoffice-ui/issues/548.
 */
@Component({
  selector: 'app-deferred-datetime-button',
  standalone: true,
  imports: [IonDatetimeButton, StampDatetimeDirective],
  providers: [
    {
      provide: DATETIME_TARGET_ID,
      useFactory: () => inject(DeferredDatetimeButtonComponent).datetimeId(),
    },
  ],
  template: `
    @if (pickersReady()) {
      <ion-datetime-button appStampDatetime></ion-datetime-button>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class DeferredDatetimeButtonComponent {
  /** Id of the `ion-datetime` this button should open. Must be unique per instance. */
  readonly datetimeId = input.required<string>();

  /** See `createPickersReady` — deferred relative to this instance, not the page. */
  readonly pickersReady = createPickersReady();
}
