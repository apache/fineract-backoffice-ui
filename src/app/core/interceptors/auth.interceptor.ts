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

import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '../services/config.service';

/** True when the request already carries a tenant (e.g. login with user-entered tenant). */
function hasExplicitTenantHeaders(req: HttpRequest<unknown>): boolean {
  return (
    !!req.headers.get('Fineract-Platform-TenantId') ||
    !!req.headers.get('X-Mifos-Platform-TenantId') ||
    !!req.headers.get('fineract-platform-tenantid')
  );
}

/**
 * Whether a request is bound for the configured Fineract API.
 *
 * Credentials must not travel anywhere else. Nothing in the application calls a third party
 * today, which is exactly why this is cheap to add now: the first analytics pixel, error
 * reporter or vendor SDK that shares this `HttpClient` would otherwise send a `Basic` header
 * carrying banking credentials to that vendor, and nothing would report it.
 *
 * A relative URL is same-origin by construction and always allowed. An absolute one is compared
 * by origin, so a path change on the same host stays trusted and a different host does not.
 */
export function isApiRequest(url: string, apiUrl: string): boolean {
  // Relative: the browser resolves it against this document's origin.
  if (!/^https?:\/\//i.test(url)) return true;

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    // Not parseable as absolute, so it cannot name a foreign host.
    return true;
  }

  if (target.origin === window.location.origin) return true;

  // The configured API may itself be absolute and cross-origin, which is a supported
  // deployment. Trust that one origin, and only that one.
  try {
    return target.origin === new URL(apiUrl, window.location.origin).origin;
  } catch {
    return false;
  }
}

/**
 * Functional HTTP Interceptor that handles authentication and multi-tenancy.
 *
 * Injects the mandatory `Fineract-Platform-TenantId` header, the `Authorization` header (if an
 * active session exists) and the `Fineract-Platform-TFA-Token` header (if a second factor has been
 * validated) into every outgoing request.
 *
 * Requests that already specify tenant headers are left unchanged for those headers so
 * login can send the tenant from the form before `currentTenantId` is updated.
 *
 * @param req - The outgoing HTTP request
 * @param next - The next handler in the interceptor chain
 * @returns An observable of the intercepted HTTP event stream
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const authService = inject(AuthService);
  const config = inject(ConfigService);
  const token = authService.getAuthToken();
  const tenantId = authService.currentTenantId();

  // Anything not bound for the API leaves untouched — no credentials, no tenant, which would
  // otherwise disclose the institution's identity to a third party.
  if (!isApiRequest(req.url, config.apiUrl)) {
    return next(req);
  }

  let authReq = req;
  if (!hasExplicitTenantHeaders(req)) {
    authReq = req.clone({
      setHeaders: {
        'Fineract-Platform-TenantId': tenantId,
        'X-Mifos-Platform-TenantId': tenantId,
      },
    });
  }

  // Inject Basic Auth token if the user is logged in
  if (token) {
    authReq = authReq.clone({
      setHeaders: {
        Authorization: `Basic ${token}`,
      },
    });
  }

  // Where the platform runs with two-factor authentication, the Basic credential alone opens only
  // the `/twofactor` endpoints; everything else answers 403 until this accompanies it. Absent on
  // deployments that do not use it, and during the window between the password being accepted and
  // the one-time token being validated.
  const tfaToken = authService.getTfaToken();
  if (tfaToken) {
    authReq = authReq.clone({
      setHeaders: {
        'Fineract-Platform-TFA-Token': tfaToken,
      },
    });
  }

  return next(authReq);
};
