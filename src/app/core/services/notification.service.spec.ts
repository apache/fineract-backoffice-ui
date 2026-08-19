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

import { TestBed } from '@angular/core/testing';
import { FakeOverlayAdapter, provideFakeAdapters } from '../../testing/adapters';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let overlay: FakeOverlayAdapter;

  beforeEach(() => {
    // No `provideIonicTesting()` and no translation catalogue: the service sees only the
    // adapter contracts, so the test asserts on the toast it asked for rather than on the
    // element some component library built.
    const fakes = provideFakeAdapters();
    overlay = fakes.overlay;

    TestBed.configureTestingModule({ providers: fakes.providers });

    service = TestBed.inject(NotificationService);
  });

  it('requests a toast', async () => {
    await service.show('hello');

    expect(overlay.toasts).toHaveSize(1);
    expect(overlay.lastToast!.message).toBe('hello');
  });

  it('uses a short duration and success styling for success()', async () => {
    await service.success('saved');

    expect(overlay.lastToast).toEqual(
      jasmine.objectContaining({ message: 'saved', duration: 3000, cssClass: 'success-toast' }),
    );
  });

  it('uses a long duration and error styling for error()', async () => {
    await service.error('boom');

    expect(overlay.lastToast).toEqual(
      jasmine.objectContaining({ message: 'boom', duration: 10_000, cssClass: 'error-toast' }),
    );
  });

  it('preserves multi-line messages verbatim', async () => {
    const stacked = 'Validation failed\n\n• [username] already exists';
    await service.error(stacked);

    expect(overlay.lastToast!.message).toBe(stacked);
  });

  it('adds a translated dismiss button by default', async () => {
    await service.show('hello');

    expect(overlay.lastToast!.dismissLabel).toBe('COMMON.CLOSE');
  });

  it('omits the dismiss button when the label is empty', async () => {
    await service.show('hello', { dismissLabel: '' });

    expect(overlay.lastToast!.dismissLabel).toBe('');
  });
});
