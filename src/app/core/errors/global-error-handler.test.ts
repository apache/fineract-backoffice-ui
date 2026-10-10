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
import { HttpErrorResponse } from '@angular/common/http';
import { I18N } from '../adapters';
import { NotificationService } from '../services/notification.service';
import { GlobalErrorHandler } from './global-error-handler';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let notificationsSpy: SpyObj<NotificationService>;

  beforeEach(() => {
    notificationsSpy = createSpyObj<NotificationService>(['error']);
    notificationsSpy.error.mockResolvedValue();

    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: NotificationService, useValue: notificationsSpy },
        {
          provide: I18N,
          useValue: { translate: (key: string) => key },
        },
      ],
    });

    handler = TestBed.inject(GlobalErrorHandler);
    vi.spyOn(console, 'error');
  });

  it('should tell the user when an uncaught error breaks an action', () => {
    handler.handleError(new Error('boom'));

    expect(notificationsSpy.error).toHaveBeenCalledWith('COMMON.ERRORS.UNEXPECTED');
  });

  it('should always log, so the stack survives whatever the reporting does', () => {
    const error = new Error('boom');
    handler.handleError(error);

    expect(console.error).toHaveBeenCalledWith(error);
  });

  it('should stay quiet about an HTTP failure errorInterceptor already reported', () => {
    handler.handleError(new HttpErrorResponse({ status: 500, url: '/api/test' }));

    expect(notificationsSpy.error).not.toHaveBeenCalled();
    // Still logged: reaching here means a subscriber left off its error callback.
    expect(console.error).toHaveBeenCalled();
  });

  it('should stay quiet about development-only framework assertions', () => {
    handler.handleError(new Error('NG0100: ExpressionChangedAfterItHasBeenCheckedError'));

    expect(notificationsSpy.error).not.toHaveBeenCalled();
  });

  it('should not rethrow when reporting itself fails, which would loop', () => {
    notificationsSpy.error.mockImplementation(() => {
      throw new Error('toast controller unavailable');
    });

    expect(() => handler.handleError(new Error('boom'))).not.toThrow();
  });
});
