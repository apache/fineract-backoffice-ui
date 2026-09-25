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

import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../ui/button/button.component';
import { IconComponent } from '../../../ui/icon/icon.component';

/**
 * Persistent in-content state for a record or list that failed to load.
 *
 * A caller that swallows the failure into a null/empty value and renders nothing, or renders
 * an empty-state message, tells the user the data does not exist when in fact nobody knows —
 * see issue #223. This is the single place that state is rendered, so callers only decide the
 * copy and the action (retry the same request, or leave for a load that cannot succeed, such
 * as a 404).
 */
@Component({
  selector: 'app-load-error',
  standalone: true,
  imports: [ButtonComponent, IconComponent],
  template: `
    <div class="load-error" role="alert" [attr.data-testid]="testId()">
      <app-icon [name]="icon()" />
      <p class="load-error-text">{{ message() }}</p>
      @if (actionLabel(); as label) {
        <app-button
          type="button"
          [id]="testId() + '-action'"
          [attr.data-testid]="testId() + '-action'"
          (click)="action.emit()"
        >
          {{ label }}
        </app-button>
      }
    </div>
  `,
  styles: [
    `
      .load-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-3, 12px);
        padding: var(--space-6, 48px) var(--space-4, 16px);
        text-align: center;
      }
      .load-error app-icon {
        font-size: 2rem;
        color: var(--error-color);
      }
      .load-error-text {
        margin: 0;
        color: var(--text-muted);
        font-size: 0.9rem;
      }
    `,
  ],
})
export class LoadErrorComponent {
  /** Already-translated explanation of what failed. */
  readonly message = input.required<string>();
  /** Already-translated label for the action button; omit to render no button. */
  readonly actionLabel = input<string>('');
  /** Base for this instance's `data-testid`/`id`; the button appends `-action`. */
  readonly testId = input.required<string>();
  readonly icon = input<string>('alert-circle-outline');

  readonly action = output<void>();
}
