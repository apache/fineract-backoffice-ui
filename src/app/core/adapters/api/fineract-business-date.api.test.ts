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
import { of } from 'rxjs';
import { vi } from 'vitest';

import { BusinessDateManagementService } from '../../../api';
import { FineractBusinessDateApi } from './fineract-business-date.api';

describe('FineractBusinessDateApi', () => {
  let service: FineractBusinessDateApi;
  let clientMock: { getBusinessdate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    clientMock = {
      getBusinessdate: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        FineractBusinessDateApi,
        { provide: BusinessDateManagementService, useValue: clientMock },
      ],
    });
    service = TestBed.inject(FineractBusinessDateApi);
  });

  it('maps business date entries from the generated client', async () => {
    clientMock.getBusinessdate.mockReturnValue(
      of([
        { type: 'BUSINESS_DATE', date: '2026-10-08' },
        { type: 'COB_DATE', date: [2026, 10, 7] as unknown as string },
      ]),
    );

    const entries = await new Promise<unknown>((resolve) =>
      service.getBusinessDates().subscribe(resolve),
    );

    expect(entries).toEqual([
      { type: 'BUSINESS_DATE', date: '2026-10-08' },
      { type: 'COB_DATE', date: [2026, 10, 7] },
    ]);
  });

  it('handles null or empty responses gracefully', async () => {
    clientMock.getBusinessdate.mockReturnValue(of(null as unknown as []));

    const entries = await new Promise<unknown>((resolve) =>
      service.getBusinessDates().subscribe(resolve),
    );

    expect(entries).toEqual([]);
  });
});
