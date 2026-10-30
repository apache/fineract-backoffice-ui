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
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';

import { SelfDividendService } from '../../../api';
import { FineractShareDividendApi } from './fineract-share-dividend.api';

describe('FineractShareDividendApi', () => {
  let service: { putShareproductProductIdDividendDividendId: ReturnType<typeof vi.fn> };
  let api: FineractShareDividendApi;

  beforeEach(() => {
    service = { putShareproductProductIdDividendDividendId: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: SelfDividendService, useValue: service }],
    });
    api = TestBed.inject(FineractShareDividendApi);
  });

  it('approves with the approve command, product id first', async () => {
    service.putShareproductProductIdDividendDividendId.mockReturnValue(of({ resourceId: 4 }));

    const outcome = await firstValueFrom(api.approve(2, 4));

    expect(service.putShareproductProductIdDividendDividendId).toHaveBeenCalledWith(
      2,
      4,
      'approve',
      '{}',
    );
    expect(outcome).toEqual({ pendingApproval: false });
  });

  it('reports an approval that maker-checker queued', async () => {
    service.putShareproductProductIdDividendDividendId.mockReturnValue(
      of({ commandId: 31, rollbackTransaction: false }),
    );

    expect(await firstValueFrom(api.approve(2, 4))).toEqual({ pendingApproval: true });
  });
});
