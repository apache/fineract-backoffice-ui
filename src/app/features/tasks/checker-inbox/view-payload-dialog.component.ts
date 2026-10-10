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

import { computed, input, Component } from '@angular/core';

import { ButtonComponent } from '../../../ui/button/button.component';
import { TranslatePipe } from '../../../core/adapters';

/**
 * Dialog to display the raw JSON command payload of a pending Maker-Checker task.
 */
@Component({
  selector: 'app-view-payload-dialog',
  standalone: true,
  imports: [ButtonComponent, TranslatePipe],
  template: `
    <h2 class="dialog-title">{{ 'CHECKER_INBOX.COMMAND_PAYLOAD' | appTranslate }}</h2>
    <div class="dialog-content">
      <pre class="payload-code">{{ formattedJson() }}</pre>
    </div>
    <div class="dialog-actions">
      <app-button type="button" intent="primary" emphasis="quiet">CLOSE</app-button>
    </div>
  `,
  styles: [
    `
      .payload-code {
        background-color: #f5f5f5;
        padding: 16px;
        border-radius: 4px;
        font-family: 'Courier New', Courier, monospace;
        font-size: 0.9rem;
        overflow: auto;
        max-height: 500px;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
    `,
  ],
})
export class ViewPayloadDialogComponent {
  readonly data = input.required<{ payload: string }>();

  /**
   * Pretty-printed when the payload parses as JSON, verbatim when it does not — a few audit
   * entries store a plain string.
   *
   * Derived rather than computed in the constructor. An input is not populated until after
   * construction, so the old constructor body read `undefined`, threw, and then threw a second
   * time inside its own `catch` — which escaped and stopped the dialog from opening at all.
   */
  readonly formattedJson = computed<string>(() => {
    const { payload } = this.data();
    try {
      return JSON.stringify(JSON.parse(payload), null, 2);
    } catch {
      return payload;
    }
  });
}
