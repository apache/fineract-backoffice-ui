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

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { skipErrorToast } from '../http/http-context';

/** Somewhere Fineract will send a one-time token, as offered by `GET /v1/twofactor`. */
export interface OtpDeliveryMethod {
  /** Channel name, e.g. `email`. Passed back as the `deliveryMethod` query parameter. */
  name: string;
  /** Where it goes, already partially obscured by the platform where it chooses to. */
  target: string;
}

/** The platform's answer to a request for a one-time token. */
export interface OtpRequestResult {
  requestTime: number;
  /** How long the one-time token is good for. 300 on a default deployment. */
  tokenLiveTimeInSec: number;
  extendedAccessToken: boolean;
  deliveryMethod: OtpDeliveryMethod;
}

/** The validated second-factor token, which then accompanies every request. */
export interface TwoFactorToken {
  token: string;
  validFrom: number;
  validTo: number;
}

/**
 * The three calls that make up Fineract's second authentication factor.
 *
 * All of them are reachable on the Basic credential alone — they are the only thing that is, once
 * the platform has asked for a second factor — so they work in exactly the window where the rest
 * of the API does not.
 *
 * Written against `HttpClient` rather than the generated `TwoFactorService` because these need to
 * run while the session is half-established, and the shapes are three small objects that the
 * generated client types as bare `string`.
 */
@Injectable({ providedIn: 'root' })
export class TwoFactorAuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  /** Channels this user can receive a one-time token on. */
  deliveryMethods(): Observable<OtpDeliveryMethod[]> {
    return this.http.get<OtpDeliveryMethod[]>(`${this.config.apiUrl}/twofactor`);
  }

  /**
   * Asks the platform to send a one-time token.
   *
   * @param deliveryMethod - the `name` of a method from {@link deliveryMethods}
   * @param extendedToken - request a longer-lived second factor, for a trusted device
   */
  requestToken(deliveryMethod: string, extendedToken = false): Observable<OtpRequestResult> {
    const params = new URLSearchParams({
      deliveryMethod,
      extendedToken: String(extendedToken),
    });
    return this.http.post<OtpRequestResult>(
      `${this.config.apiUrl}/twofactor?${params.toString()}`,
      null,
    );
  }

  /**
   * Exchanges the one-time token for the session's second-factor token.
   *
   * A wrong or expired code comes back as a 403 whose body names the reason, which the error
   * interceptor surfaces; the caller only has to keep the user on the step.
   *
   * @param otp - the code the user received
   */
  validate(otp: string): Observable<TwoFactorToken> {
    const params = new URLSearchParams({ token: otp });
    return this.http.post<TwoFactorToken>(
      `${this.config.apiUrl}/twofactor/validate?${params.toString()}`,
      null,
      // The step renders the failure next to the field it belongs to; a toast as well would
      // report the same refusal twice. Mirrors how the password step handles a rejection.
      { context: skipErrorToast() },
    );
  }
}
