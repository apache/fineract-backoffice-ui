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

import { Component, input } from '@angular/core';
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle } from '@ionic/angular/standalone';

import { TranslatePipe } from '../../core/adapters';

/**
 * A titled surface: the card every screen writes out as four Ionic elements.
 *
 * `ion-card` / `ion-card-header` / `ion-card-title` / `ion-card-content` appear together in
 * most of this application's screens, and ADR 0005 closes that vendor boundary to new code —
 * so a new screen either reaches past the boundary or hand-rolls its own panel markup. #847
 * did the latter, which is the gap #684 describes: the card and form primitives only pay off
 * as a set, because a form is a card with fields in it.
 *
 * The title is a translation key, as `app-form-field`'s label and `ColumnDef.label` are. Omit
 * it for a card that carries its own heading or none.
 */
@Component({
  selector: 'app-card',
  standalone: true,
  imports: [TranslatePipe, IonCard, IonCardContent, IonCardHeader, IonCardTitle],
  template: `
    <ion-card>
      @if (heading()) {
        <ion-card-header>
          <ion-card-title>{{ heading() | appTranslate }}</ion-card-title>
        </ion-card-header>
      }
      <ion-card-content>
        <ng-content></ng-content>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      ion-card {
        margin-inline: 0;
      }
    `,
  ],
})
export class CardComponent {
  /**
   * Translation key for the card's title, or empty for an untitled card.
   *
   * Named `heading` rather than `title`: a `title` input on a component also lands on the host
   * element as the HTML `title` attribute, which browsers render as a tooltip on hover.
   */
  readonly heading = input('');
}
