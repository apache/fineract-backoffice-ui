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

import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18N, I18nAdapter } from '../adapters';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../services/auth.service';
import { SKIP_ERROR_TOAST } from '../http/http-context';

/** Query parameter the login page reads to explain an involuntary return to it. */
export const SESSION_EXPIRED_REASON = 'session-expired';

/**
 * True when this 401 means an established session stopped being valid, as opposed to
 * credentials being rejected at sign-in.
 *
 * The test is whether the request carried credentials. `authInterceptor` runs before this one
 * and only sets `Authorization` when a token exists, so a 401 on a request without that header
 * cannot be an expired session — there was nothing to expire. That distinction matters: the
 * login POST is the one request that legitimately 401s, and treating it as an expiry would log
 * the user out of a session they never had and redirect them to the page they are already on.
 */
function isExpiredSession(req: HttpRequest<unknown>, error: HttpErrorResponse): boolean {
  return error.status === 401 && req.headers.has('Authorization');
}

/** Fineract's globalisation code for "the request was understood and the rules say no". */
const DOMAIN_RULE_VIOLATION = 'validation.msg.domain.rule.violation';

/**
 * Whether a 403 is Fineract refusing on a business rule rather than on a permission.
 *
 * Either signal is enough. The globalisation code is the explicit one; a populated `errors[]`
 * is the practical one, because an authorization refusal has nothing to put in it.
 */
function isDomainRuleViolation(error: HttpErrorResponse): boolean {
  const body = error.error as { userMessageGlobalisationCode?: string; errors?: unknown } | null;
  return (
    body?.userMessageGlobalisationCode === DOMAIN_RULE_VIOLATION ||
    (Array.isArray(body?.errors) && body.errors.length > 0)
  );
}

/**
 * Builds the user-facing message for a failed request.
 *
 * Fineract returns validation failures as an `errors` array, each entry naming the parameter
 * it rejected; those are stacked into one message so the user sees every problem at once
 * rather than fixing them one round-trip at a time.
 */
function messageFor(error: HttpErrorResponse, i18n: I18nAdapter): string {
  if (error.error instanceof ErrorEvent) {
    return `Error: ${error.error.message}`;
  }

  // Fineract answers 403 for two unrelated things: the caller lacks the permission, and the
  // operation is not allowed in this state. Only the first is an authorization problem.
  //
  // For an authorization 403 the body describes the missing right in backend terms
  // ("NOT_ALLOWED", a permission code) which means nothing to the user; what they can act on
  // is that the account lacks the right, so the friendly message is the correct treatment.
  //
  // A domain-rule 403 is the opposite: the body carries the reason, and it is the only place
  // the reason exists. "Group cannot be closed because of active clients associated with it"
  // told as "you do not have permission" sends the user to an administrator to ask for a right
  // they already hold, while the thing they actually needed to do goes unsaid.
  //
  // The two are distinguishable without guessing — a domain-rule violation names itself, and
  // carries a populated `errors[]`. Anything that matches neither keeps the friendly message,
  // so nothing gets worse than it was.
  if (error.status === 403 && !isDomainRuleViolation(error)) {
    return i18n.translate('COMMON.ERRORS.FORBIDDEN');
  }

  if (error.error?.errors && Array.isArray(error.error.errors) && error.error.errors.length > 0) {
    const stacked = error.error.errors
      .map((err: Record<string, unknown>) => {
        const msg = err['developerMessage'] || err['defaultUserMessage'] || 'Validation error';
        const param = err['parameterName'] ? `[${err['parameterName']}] ` : '';
        return `• ${param}${msg}`;
      })
      .join('\n');

    if (error.error?.defaultUserMessage || error.error?.developerMessage) {
      return `${error.error.defaultUserMessage || error.error.developerMessage}\n\n${stacked}`;
    }
    return stacked;
  }

  if (error.error?.developerMessage) {
    return error.error.developerMessage;
  }
  if (error.error?.defaultUserMessage) {
    return error.error.defaultUserMessage;
  }
  if (error.status === 0) {
    return i18n.translate('COMMON.ERRORS.NETWORK');
  }
  return `Error Code: ${error.status}\nMessage: ${error.message}`;
}

/**
 * Functional HTTP Interceptor that catches API errors and displays all validation
 * errors in a stacked notification toast.
 *
 * It also ends the session on a 401. Credentials live in `sessionStorage` and are replayed on
 * every request, so without this a revoked or expired session keeps the user on a page that
 * silently fails and stacks a toast per request instead of sending them back to sign in.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);
  const i18n = inject(I18N);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isExpiredSession(req, error)) {
        // A page typically has several requests in flight, so this path runs once per failure.
        // `logout()` clears `isAuthenticated` synchronously, so the rest of the burst finds the
        // session already gone and does not re-navigate.
        if (auth.isAuthenticated()) {
          auth.logout();
          void router.navigate(['/login'], { queryParams: { reason: SESSION_EXPIRED_REASON } });
        }
        // No toast: the login page states the reason, and a toast over a full-page redirect
        // is the same news twice.
        return throwError(() => error);
      }

      // The caller renders this failure itself. Still rethrown, so its catchError runs.
      if (!req.context.get(SKIP_ERROR_TOAST)) {
        notifications.error(messageFor(error, i18n));
      }

      return throwError(() => error);
    }),
  );
};
