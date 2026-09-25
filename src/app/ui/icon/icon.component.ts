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

import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

/** What an icon's colour says about the state it represents, not which vendor palette it uses. */
export type UiIconTone = 'success' | 'warning' | 'danger' | 'neutral';

const TONE_COLOR: Record<UiIconTone, string> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  neutral: 'medium',
};

/**
 * An icon, named from the set registered in `src/app/core/icons.ts`. An unregistered name
 * renders as blank space with no error, which `scripts/check-icons.mjs` catches at build time.
 *
 * Decorative by default: without a `label` the icon is `aria-hidden`, because the common case
 * sits beside text that already says the same thing. A `label` makes it an announced image
 * under the `img` role the vendor already sets.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [IonIcon],
  template: `
    <ion-icon
      [name]="name()"
      [color]="color()"
      [attr.aria-label]="label() ?? null"
      [attr.aria-hidden]="label() ? null : 'true'"
    />
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
      }
      ion-icon {
        font-size: inherit;
      }
    `,
  ],
})
export class IconComponent {
  /** A name registered in `src/app/core/icons.ts`. */
  readonly name = input.required<string>();
  /** Semantic state colour. Omit to inherit the surrounding text colour. */
  readonly tone = input<UiIconTone>();
  /** Already-translated accessible name. Omit for an icon that repeats adjacent text. */
  readonly label = input<string>();

  protected readonly color = computed(() => {
    const tone = this.tone();
    return tone ? TONE_COLOR[tone] : undefined;
  });
}
