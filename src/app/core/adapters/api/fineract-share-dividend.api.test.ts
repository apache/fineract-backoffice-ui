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
  let service: {
    getShareproductProductIdDividend: ReturnType<typeof vi.fn>;
    getShareproductProductIdDividendDividendId: ReturnType<typeof vi.fn>;
    putShareproductProductIdDividendDividendId: ReturnType<typeof vi.fn>;
    deleteShareproductProductIdDividendDividendId: ReturnType<typeof vi.fn>;
  };
  let api: FineractShareDividendApi;

  beforeEach(() => {
    service = {
      getShareproductProductIdDividend: vi.fn(),
      getShareproductProductIdDividendDividendId: vi.fn(),
      putShareproductProductIdDividendDividendId: vi.fn(),
      deleteShareproductProductIdDividendDividendId: vi.fn(),
    };
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

  it('reports a queued approval that carries the dividend id as its resource id', async () => {
    // Fineract's answer to a maker-checker queued command (RollbackTransactionNotApprovedException).
    service.putShareproductProductIdDividendDividendId.mockReturnValue(
      of({ commandId: 31, resourceId: 4, rollbackTransaction: true }),
    );

    expect(await firstValueFrom(api.approve(2, 4))).toEqual({ pendingApproval: true });
  });

  it('reports an approval applied at once even when the audit command id comes back', async () => {
    service.putShareproductProductIdDividendDividendId.mockReturnValue(
      of({ commandId: 31, resourceId: 4, rollbackTransaction: false }),
    );

    expect(await firstValueFrom(api.approve(2, 4))).toEqual({ pendingApproval: false });
  });

  it('lists dividends from the JSON string page, with status and ISO period dates', async () => {
    service.getShareproductProductIdDividend.mockReturnValue(
      of(
        JSON.stringify({
          totalFilteredRecords: 2,
          pageItems: [
            {
              id: 4,
              amount: 1200,
              status: { id: 100, code: 'shareAccountDividendStatusType.initiated' },
              dividendPeriodStartDate: [2025, 1, 1],
              dividendPeriodEndDate: [2025, 12, 31],
            },
            { id: 5, amount: 900, status: { id: 300 } },
          ],
        }),
      ),
    );

    const rows = await firstValueFrom(api.list(2));

    expect(service.getShareproductProductIdDividend).toHaveBeenCalledWith(2);
    expect(rows).toEqual([
      {
        id: 4,
        amount: 1200,
        status: 'pending',
        periodStartDate: '2025-01-01',
        periodEndDate: '2025-12-31',
      },
      { id: 5, amount: 900, status: 'approved', periodStartDate: null, periodEndDate: null },
    ]);
  });

  it('reads INVALID and unseen dividend statuses as unknown', async () => {
    service.getShareproductProductIdDividend.mockReturnValue(
      of(JSON.stringify({ pageItems: [{ id: 1, status: { id: 0 } }, { id: 2 }] })),
    );

    const rows = await firstValueFrom(api.list(2));

    expect(rows.map((r) => r.status)).toEqual(['unknown', 'unknown']);
  });

  it('pages the payouts with the dividend id first and forwards accountNo', async () => {
    service.getShareproductProductIdDividendDividendId.mockReturnValue(
      of(
        JSON.stringify({
          totalFilteredRecords: 42,
          pageItems: [
            {
              id: 9,
              amount: 214.29,
              status: { id: 300 },
              accountData: { id: 7, accountNo: '000000101', clientName: 'Jane Doe' },
            },
          ],
        }),
      ),
    );

    const page = await firstValueFrom(
      api.get(2, 4, { offset: 20, limit: 10, accountNo: '000000101' }),
    );

    expect(service.getShareproductProductIdDividendDividendId).toHaveBeenCalledWith(
      4,
      2,
      20,
      10,
      undefined,
      undefined,
      '000000101',
    );
    expect(page).toEqual({
      totalFilteredRecords: 42,
      items: [
        {
          id: 9,
          accountId: 7,
          accountNo: '000000101',
          clientName: 'Jane Doe',
          amount: 214.29,
          status: 'posted',
        },
      ],
    });
  });

  it('leaves an empty accountNo off the payout request', async () => {
    service.getShareproductProductIdDividendDividendId.mockReturnValue(of(JSON.stringify({})));

    const page = await firstValueFrom(api.get(2, 4, { offset: 0, limit: 10, accountNo: '' }));

    expect(service.getShareproductProductIdDividendDividendId.mock.calls[0][6]).toBeUndefined();
    expect(page).toEqual({ items: [], totalFilteredRecords: 0 });
  });

  it('deletes with the product id first', async () => {
    service.deleteShareproductProductIdDividendDividendId.mockReturnValue(of({ resourceId: 4 }));

    await firstValueFrom(api.delete(2, 4));

    expect(service.deleteShareproductProductIdDividendDividendId).toHaveBeenCalledWith(2, 4);
  });
});
