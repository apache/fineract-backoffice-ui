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

import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { I18N } from '../adapters';
import { NotificationService } from '../services/notification.service';

/**
 * Angular error codes that describe a state the user cannot be in for real.
 *
 * NG0100 (`ExpressionChangedAfterItHasBeenCheckedError`) is a development-only assertion —
 * it never runs in a production build — and NG0911 is the router reporting a navigation the
 * app cancelled itself. Toasting either tells the user about a problem in the code as though
 * it were a problem with their work.
 */
const SILENT_CODES = ['NG0100', 'NG0911'];

function isSilent(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return SILENT_CODES.some((code) => message.includes(code));
}

/**
 * Last stop for errors nothing else caught.
 *
 * Angular's default handler logs to the console and stops there, which means an exception
 * thrown in a component method leaves the user looking at a button that did nothing, with no
 * indication that anything went wrong. The console is where a developer looks; it is not
 * where the user is.
 *
 * `HttpErrorResponse` is deliberately not reported here. `errorInterceptor` has already
 * shown it, with a message built from the Fineract response body, and reaches this handler
 * only because some subscriber left off an `error` callback. Reporting it again would put a
 * second, vaguer toast underneath the accurate one.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  /**
   * Resolved lazily rather than injected as fields. An `ErrorHandler` is constructed early
   * enough that eagerly pulling in `NotificationService` — and through it Ionic's
   * `ToastController` — would make a failure in that chain a failure to bootstrap at all.
   */
  private readonly injector = inject(Injector);

  handleError(error: unknown): void {
    // Unconditional: the stack is the only complete record of what happened, and it must
    // survive whatever the reporting below does.
    console.error(error);

    if (error instanceof HttpErrorResponse || isSilent(error)) {
      return;
    }

    try {
      const i18n = this.injector.get(I18N);
      const notifications = this.injector.get(NotificationService);
      void notifications.error(i18n.translate('COMMON.ERRORS.UNEXPECTED'));
    } catch (reportingFailure) {
      // Anything thrown from here would re-enter handleError and loop. The original error is
      // already on the console, which is what matters.
      console.error('Failed to report an error to the user', reportingFailure);
    }
  }
}
