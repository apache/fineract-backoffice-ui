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

import { createSpyObj, SpyObj } from '../../testing/mocks';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient, HttpHeaders } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { provideFakeAdapters } from '../../testing/adapters';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../services/auth.service';
import { errorInterceptor } from './error.interceptor';
import { skipErrorToast } from '../http/http-context';

describe('errorInterceptor', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  let notificationsSpy: SpyObj<NotificationService>;
  let routerSpy: SpyObj<Router>;
  let authSpy: SpyObj<AuthService>;
  const testUrl = '/api/test';
  const expectedErrorMsg = 'expected an error';

  /** Mirrors what `authInterceptor` puts on a request once a session exists. */
  const authorized = { headers: new HttpHeaders({ Authorization: 'Basic abc123' }) };

  beforeEach(() => {
    notificationsSpy = createSpyObj<NotificationService>(['success', 'error', 'show']);
    notificationsSpy.error.mockResolvedValue();

    routerSpy = createSpyObj<Router>(['navigate']);
    routerSpy.navigate.mockResolvedValue(true);

    authSpy = createSpyObj<AuthService>(['logout', 'isAuthenticated']);
    authSpy.isAuthenticated.mockReturnValue(true);
    // `logout()` flips the signal synchronously in the real service; the burst-dedupe in the
    // interceptor depends on that, so the double is wired to behave the same way.
    authSpy.logout.mockImplementation(() => authSpy.isAuthenticated.mockReturnValue(false));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notificationsSpy },
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authSpy },
        ...provideFakeAdapters().providers,
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should pass through successful requests', () => {
    httpClient.get(testUrl).subscribe((response) => {
      expect(response).toEqual({ data: 'ok' });
    });

    const req = httpTestingController.expectOne(testUrl);
    req.flush({ data: 'ok' });

    expect(notificationsSpy.error).not.toHaveBeenCalled();
  });

  it('should handle Client-side / Network Error Event', () => {
    const errorEvent = new ErrorEvent('Network error', { message: 'Failed to connect' });

    httpClient.get(testUrl).subscribe({
      next: () => {
        throw new Error(expectedErrorMsg);
      },
      error: (error) => {
        expect(error.status).toBe(0);
      },
    });

    const req = httpTestingController.expectOne(testUrl);
    req.error(errorEvent);

    expect(notificationsSpy.error).toHaveBeenCalledWith('Error: Failed to connect');
  });

  it('should handle validation errors array from API', () => {
    const mockValidationErrorResponse = {
      errors: [
        { parameterName: 'username', developerMessage: 'Username already exists' },
        { defaultUserMessage: 'Invalid email format' },
      ],
      defaultUserMessage: 'Validation failed',
    };

    httpClient.get(testUrl).subscribe({
      next: () => {
        throw new Error(expectedErrorMsg);
      },
      error: () => undefined,
    });

    const req = httpTestingController.expectOne(testUrl);
    req.flush(mockValidationErrorResponse, { status: 400, statusText: 'Bad Request' });

    const expectedMessage =
      'Validation failed\n\n• [username] Username already exists\n• Invalid email format';
    expect(notificationsSpy.error).toHaveBeenCalledWith(expectedMessage);
  });

  it('surfaces scalar args such as a refused date in validation errors', () => {
    const mockRefusalResponse = {
      errors: [
        {
          parameterName: 'submittedOnDate',
          defaultUserMessage: 'Submitted on date cannot be after the activation date',
          args: [{ value: '2026-08-16' }],
        },
      ],
    };

    httpClient.get(testUrl).subscribe({
      next: () => {
        throw new Error(expectedErrorMsg);
      },
      error: () => undefined,
    });

    const req = httpTestingController.expectOne(testUrl);
    req.flush(mockRefusalResponse, { status: 400, statusText: 'Bad Request' });

    const expectedMessage =
      '• [submittedOnDate] Submitted on date cannot be after the activation date (2026-08-16)';
    expect(notificationsSpy.error).toHaveBeenCalledWith(expectedMessage);
  });

  it('should handle single developerMessage or defaultUserMessage', () => {
    httpClient.get(testUrl).subscribe({
      next: () => {
        throw new Error(expectedErrorMsg);
      },
      error: () => undefined,
    });

    const req = httpTestingController.expectOne(testUrl);
    req.flush(
      { developerMessage: 'Custom dev message' },
      { status: 500, statusText: 'Server Error' },
    );

    expect(notificationsSpy.error).toHaveBeenCalledWith('Custom dev message');

    // Reset spy
    notificationsSpy.error.mockClear();

    httpClient.get('/api/test2').subscribe({
      next: () => {
        throw new Error(expectedErrorMsg);
      },
      error: () => undefined,
    });

    const req2 = httpTestingController.expectOne('/api/test2');
    req2.flush(
      { defaultUserMessage: 'Custom user message' },
      { status: 404, statusText: 'Not Found' },
    );

    expect(notificationsSpy.error).toHaveBeenCalledWith('Custom user message');
  });

  it('should handle status 0 when no message is present', () => {
    httpClient.get(testUrl).subscribe({
      next: () => {
        throw new Error(expectedErrorMsg);
      },
      error: () => undefined,
    });

    const req = httpTestingController.expectOne(testUrl);
    req.flush(null, { status: 0, statusText: '' });

    expect(notificationsSpy.error).toHaveBeenCalledWith('COMMON.ERRORS.NETWORK');
  });

  it('should fallback to status code and message description for other errors', () => {
    httpClient.get(testUrl).subscribe({
      next: () => {
        throw new Error(expectedErrorMsg);
      },
      error: () => undefined,
    });

    const req = httpTestingController.expectOne(testUrl);
    req.flush('Plain error body', { status: 503, statusText: 'Service Unavailable' });

    expect(notificationsSpy.error).toHaveBeenCalledWith(expect.stringMatching(/Error Code: 503/));
  });

  it('should not toast when the SKIP_ERROR_TOAST context is set, but still rethrow', () => {
    let received: unknown = null;
    httpClient.get(testUrl, { context: skipErrorToast() }).subscribe({
      next: () => {
        throw new Error(expectedErrorMsg);
      },
      error: (err) => (received = err),
    });

    const req = httpTestingController.expectOne(testUrl);
    req.flush('Plain error body', { status: 500, statusText: 'Server Error' });

    expect(notificationsSpy.error).not.toHaveBeenCalled();
    // Suppressing the toast must not swallow the failure — the caller still handles it.
    expect(received).toBeTruthy();
  });

  describe('401', () => {
    it('should end the session and redirect when a credentialed request is rejected', () => {
      let received: unknown = null;
      httpClient.get(testUrl, authorized).subscribe({
        next: () => {
          throw new Error(expectedErrorMsg);
        },
        error: (err) => (received = err),
      });

      httpTestingController
        .expectOne(testUrl)
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(authSpy.logout).toHaveBeenCalled();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { reason: 'session-expired' },
      });
      // The login page states the reason; a toast over the redirect repeats it.
      expect(notificationsSpy.error).not.toHaveBeenCalled();
      // The caller must still see the failure so it can stop its own loading state.
      expect(received).toBeTruthy();
    });

    it('should redirect once when several in-flight requests are rejected together', () => {
      const urls = ['/api/a', '/api/b', '/api/c'];
      for (const url of urls) {
        httpClient.get(url, authorized).subscribe({ error: () => undefined });
      }
      for (const url of urls) {
        httpTestingController
          .expectOne(url)
          .flush(null, { status: 401, statusText: 'Unauthorized' });
      }

      expect(authSpy.logout).toHaveBeenCalledTimes(1);
      expect(routerSpy.navigate).toHaveBeenCalledTimes(1);
    });

    it('should not end a session that never existed when sign-in credentials are rejected', () => {
      authSpy.isAuthenticated.mockReturnValue(false);

      // No Authorization header: this is the login POST, the one request that legitimately 401s.
      httpClient.post('/api/authentication', {}).subscribe({ error: () => undefined });

      httpTestingController
        .expectOne('/api/authentication')
        .flush(
          { defaultUserMessage: 'Bad credentials' },
          { status: 401, statusText: 'Unauthorized' },
        );

      expect(authSpy.logout).not.toHaveBeenCalled();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
      // Falls through to ordinary reporting — the caller may still opt out via context.
      expect(notificationsSpy.error).toHaveBeenCalledWith('Bad credentials');
    });
  });

  describe('403', () => {
    const FORBIDDEN_MESSAGE = 'COMMON.ERRORS.FORBIDDEN';
    it("should report a permission failure in the user's terms, keeping the session", () => {
      httpClient.get(testUrl, authorized).subscribe({ error: () => undefined });

      httpTestingController
        .expectOne(testUrl)
        .flush(
          { developerMessage: 'NOT_ALLOWED: permission READ_LOAN is required' },
          { status: 403, statusText: 'Forbidden' },
        );

      expect(notificationsSpy.error).toHaveBeenCalledWith(FORBIDDEN_MESSAGE);
      // A 403 means the user is known but unauthorized — logging them out would be wrong.
      expect(authSpy.logout).not.toHaveBeenCalled();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should stay silent when the caller opts out', () => {
      httpClient.get(testUrl, { context: skipErrorToast() }).subscribe({ error: () => undefined });

      httpTestingController
        .expectOne(testUrl)
        .flush(null, { status: 403, statusText: 'Forbidden' });

      expect(notificationsSpy.error).not.toHaveBeenCalled();
    });

    it("should report a business rule in the platform's words, not as a permission problem", () => {
      // Fineract answers 403 for "the rules say no" as well as for "you may not". Closing a
      // group that still has members is the first, and the reason exists only in this body —
      // reporting it as a permission failure sends the user to an administrator to ask for a
      // right they already hold, and leaves the actual remedy unsaid.
      httpClient.get(testUrl, authorized).subscribe({ error: () => undefined });

      httpTestingController.expectOne(testUrl).flush(
        {
          userMessageGlobalisationCode: 'validation.msg.domain.rule.violation',
          defaultUserMessage: 'Errors contain reason for domain rule violation.',
          errors: [
            {
              defaultUserMessage:
                'Group cannot be closed because of active clients associated with it.',
              userMessageGlobalisationCode: 'error.msg.Group.close.active.clients.exist',
              parameterName: 'id',
            },
          ],
        },
        { status: 403, statusText: 'Forbidden' },
      );

      const [message] = notificationsSpy.error.mock.lastCall! as [string];
      expect(message).toContain('Group cannot be closed because of active clients');
      expect(message).not.toContain(FORBIDDEN_MESSAGE);
    });

    it('should recognise a domain-rule violation by its errors array alone', () => {
      // Not every state-machine refusal carries the globalisation code, but they all populate
      // `errors[]` — and an authorization refusal has nothing to put in it.
      httpClient.get(testUrl, authorized).subscribe({ error: () => undefined });

      httpTestingController.expectOne(testUrl).flush(
        {
          errors: [{ defaultUserMessage: 'Loan is not in a state where it can be disbursed.' }],
        },
        { status: 403, statusText: 'Forbidden' },
      );

      const [message] = notificationsSpy.error.mock.lastCall! as [string];
      expect(message).toContain('Loan is not in a state where it can be disbursed.');
    });

    it('should unwrap a doubly-nested validation error to the reason it actually names', () => {
      // Captured verbatim from a live Fineract instance: PUT .../loans/{id}/approved-amount
      // with an amount above the applied principal. The outer `errors[0]` says only
      // "Validation errors exist." — the real reason is one level deeper, at `args[0].value`.
      httpClient.get(testUrl, authorized).subscribe({ error: () => undefined });

      httpTestingController.expectOne(testUrl).flush(
        {
          userMessageGlobalisationCode: 'validation.msg.domain.rule.violation',
          defaultUserMessage: 'Errors contain reason for domain rule violation.',
          errors: [
            {
              developerMessage: 'Validation errors exist.',
              defaultUserMessage: 'Validation errors exist.',
              userMessageGlobalisationCode: 'validation.msg.validation.errors.exist',
              parameterName: 'id',
              args: [
                {
                  value: {
                    developerMessage:
                      "Failed data validation due to: can't.be.greater.than.maximum.applied.loan.amount.calculation.",
                    defaultUserMessage:
                      "Failed data validation due to: can't.be.greater.than.maximum.applied.loan.amount.calculation.",
                    userMessageGlobalisationCode:
                      "validation.msg.loan.approved.amount.amount.can't.be.greater.than.maximum.applied.loan.amount.calculation",
                    parameterName: 'amount',
                    args: [],
                  },
                },
              ],
            },
          ],
        },
        { status: 403, statusText: 'Forbidden' },
      );

      const [message] = notificationsSpy.error.mock.lastCall! as [string];
      expect(message).toContain("can't.be.greater.than.maximum.applied.loan.amount.calculation");
      expect(message).toContain('[amount]');
      expect(message).not.toContain('Validation errors exist.');
    });

    it('should keep the permission message when the errors array is empty', () => {
      // Deliberately conservative: anything that is not recognisably a domain-rule violation
      // behaves exactly as it did before.
      httpClient.get(testUrl, authorized).subscribe({ error: () => undefined });

      httpTestingController
        .expectOne(testUrl)
        .flush(
          { developerMessage: 'NOT_ALLOWED', errors: [] },
          { status: 403, statusText: 'Forbidden' },
        );

      expect(notificationsSpy.error).toHaveBeenCalledWith(FORBIDDEN_MESSAGE);
    });
  });
});
