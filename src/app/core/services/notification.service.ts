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

import { Injectable, inject } from '@angular/core';
import { I18N, OVERLAY } from '../adapters';

export interface NotificationOptions {
  /** Milliseconds before the toast auto-dismisses. */
  duration?: number;
  /** Label for the dismiss button. Pass an empty string to omit the button entirely. */
  dismissLabel?: string;
  /** Extra CSS classes applied to the toast element. */
  cssClass?: string | string[];
}

const SUCCESS_DURATION = 3000;
const ERROR_DURATION = 10_000;

/**
 * Application-wide toast notifications.
 *
 * Goes through {@link OVERLAY} rather than a component library directly, so call sites never
 * depend on the presentation layer and the duration/placement conventions stay consistent.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly overlay = inject(OVERLAY);
  private readonly i18n = inject(I18N);

  /** Shows a confirmation toast for a completed action. */
  success(message: string, options: NotificationOptions = {}): Promise<void> {
    return this.show(message, {
      duration: SUCCESS_DURATION,
      cssClass: 'success-toast',
      ...options,
    });
  }

  /**
   * Shows an error toast. Multi-line messages are preserved — the Fineract API returns
   * stacked validation errors separated by newlines.
   */
  error(message: string, options: NotificationOptions = {}): Promise<void> {
    return this.show(message, {
      duration: ERROR_DURATION,
      cssClass: 'error-toast',
      ...options,
    });
  }

  /** Shows a toast with no implied severity. */
  show(message: string, options: NotificationOptions = {}): Promise<void> {
    const { duration = SUCCESS_DURATION, dismissLabel, cssClass } = options;

    return this.overlay.toast({
      message,
      duration,
      position: 'bottom',
      cssClass,
      dismissLabel: dismissLabel ?? this.i18n.translate('COMMON.CLOSE'),
    });
  }
}
