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
  let serviceMock: {
    getBusinessdate: ReturnType<typeof vi.fn>;
  };
  let api: FineractBusinessDateApi;

  beforeEach(() => {
    serviceMock = {
      getBusinessdate: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: BusinessDateManagementService, useValue: serviceMock }],
    });
    api = TestBed.inject(FineractBusinessDateApi);
  });

  it('maps business dates from generated service', async () => {
    serviceMock.getBusinessdate.mockReturnValue(
      of([
        { type: 'BUSINESS_DATE', date: '2026-10-08' },
        { type: 'COB_DATE', date: '2026-10-07' },
      ]),
    );

    const dates = await new Promise((resolve) => api.getBusinessDates().subscribe(resolve));
    expect(dates).toEqual([
      { type: 'BUSINESS_DATE', date: '2026-10-08' },
      { type: 'COB_DATE', date: '2026-10-07' },
    ]);
  });

  it('handles null dates or empty response gracefully', async () => {
    serviceMock.getBusinessdate.mockReturnValue(of(null));

    const dates = await new Promise((resolve) => api.getBusinessDates().subscribe(resolve));
    expect(dates).toEqual([]);
  });

  it('defaults missing type or date to fallback values', async () => {
    serviceMock.getBusinessdate.mockReturnValue(of([{ type: undefined, date: undefined }]));

    const dates = await new Promise((resolve) => api.getBusinessDates().subscribe(resolve));
    expect(dates).toEqual([{ type: '', date: null }]);
  });
});
