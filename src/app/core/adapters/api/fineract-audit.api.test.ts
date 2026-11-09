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

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';

import { AuditsService } from '../../../api';
import type { AuditQuery } from './audit.api';
import { FineractAuditApi, toIsoDateTime } from './fineract-audit.api';

/**
 * Positions of `AuditsService.getAudits`, which takes 23 positional parameters. Used by the
 * mapping tests below; the wire test at the end runs the real generated service, so a
 * regenerated client with a different order fails there even if this table drifts with it.
 */
/**
 * Where each value sits in `getAudits`'s forty-one positional parameters.
 *
 * The paging positions moved by eighteen in the November 2026 spec sync, which inserted
 * `productId`, `transactionId`, the `subresource*` and `*ExternalId` filters and the whole
 * `submitted*` family between `locale` and `offset`. This map is what caught it: the adapter
 * went on compiling until `limit` landed on a `string` parameter.
 */
const ARG = {
  actionName: 0,
  entityName: 1,
  resourceId: 2,
  makerId: 3,
  makerDateTimeFrom: 4,
  makerDateTimeTo: 5,
  checkerId: 6,
  status: 9,
  clientId: 10,
  loanId: 11,
  processingResult: 15,
  offset: 36,
  limit: 37,
  orderBy: 38,
  sortOrder: 39,
  paged: 40,
} as const;

const PAGE: AuditQuery = { offset: 20, limit: 10, orderBy: 'id', sortOrder: 'DESC' };

describe('FineractAuditApi', () => {
  let service: {
    getAudits: ReturnType<typeof vi.fn>;
    getAuditsAuditId: ReturnType<typeof vi.fn>;
    getAuditsSearchtemplate: ReturnType<typeof vi.fn>;
  };
  let api: FineractAuditApi;

  beforeEach(() => {
    service = {
      getAudits: vi.fn().mockReturnValue(of('{"totalFilteredRecords":0,"pageItems":[]}')),
      getAuditsAuditId: vi.fn(),
      getAuditsSearchtemplate: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AuditsService, useValue: service }],
    });
    api = TestBed.inject(FineractAuditApi);
  });

  function sentArgs(): unknown[] {
    return service.getAudits.mock.lastCall!;
  }

  describe('list', () => {
    it('asks for a sorted page', async () => {
      await firstValueFrom(api.list(PAGE));

      const args = sentArgs();
      expect(args[ARG.offset]).toBe(20);
      expect(args[ARG.limit]).toBe(10);
      expect(args[ARG.orderBy]).toBe('id');
      expect(args[ARG.sortOrder]).toBe('DESC');
      expect(args[ARG.paged]).toBe(true);
    });

    it('sends nothing for a filter that is not set', async () => {
      await firstValueFrom(api.list(PAGE));

      const args = sentArgs();
      for (const position of Object.values(ARG)) {
        if (position < ARG.offset) expect(args[position]).toBeUndefined();
      }
    });

    it('places each filter in its own parameter', async () => {
      await firstValueFrom(
        api.list({
          ...PAGE,
          actionName: 'APPROVE',
          entityName: 'LOAN',
          resourceId: 457,
          makerId: 3,
          checkerId: 4,
          clientId: 88,
          loanId: 457,
        }),
      );

      const args = sentArgs();
      expect(args[ARG.actionName]).toBe('APPROVE');
      expect(args[ARG.entityName]).toBe('LOAN');
      expect(args[ARG.resourceId]).toBe(457);
      expect(args[ARG.makerId]).toBe(3);
      expect(args[ARG.checkerId]).toBe(4);
      expect(args[ARG.clientId]).toBe(88);
      expect(args[ARG.loanId]).toBe(457);
    });

    it('widens the date range to cover the whole of both days', async () => {
      // Fineract compares the made-on timestamp against the string. A bare `2026-10-16` would be
      // midnight, and every entry made later that day would fall outside the range.
      await firstValueFrom(api.list({ ...PAGE, madeFrom: '2026-10-01', madeTo: '2026-10-16' }));

      const args = sentArgs();
      expect(args[ARG.makerDateTimeFrom]).toBe('2026-10-01 00:00:00');
      expect(args[ARG.makerDateTimeTo]).toBe('2026-10-16 23:59:59');
    });

    it('sends the status id under both names Fineract has read it from', async () => {
      await firstValueFrom(api.list({ ...PAGE, statusId: 0 }));

      const args = sentArgs();
      expect(args[ARG.status]).toBe('0');
      expect(args[ARG.processingResult]).toBe('0');
    });

    it('maps the page, reading the epoch-millisecond dates the list sends', async () => {
      service.getAudits.mockReturnValue(
        of(
          JSON.stringify({
            totalFilteredRecords: 31,
            pageItems: [
              {
                id: 12_873,
                actionName: 'APPROVE',
                entityName: 'LOAN',
                resourceId: 457,
                maker: 'officer1',
                madeOnDate: Date.UTC(2026, 9, 15, 10, 42),
                processingResult: 'processed',
                loanId: 457,
                loanAccountNo: '000000457',
              },
            ],
          }),
        ),
      );

      const page = await firstValueFrom(api.list(PAGE));

      expect(page.totalFilteredRecords).toBe(31);
      expect(page.items[0]).toMatchObject({
        id: 12_873,
        actionName: 'APPROVE',
        maker: 'officer1',
        madeOnDate: '2026-10-15T10:42:00.000Z',
        checker: '',
        checkedOnDate: null,
        loanId: 457,
        clientId: null,
        commandAsJson: null,
      });
    });
  });

  describe('get', () => {
    it('reads the entry with its payload and every linked id', async () => {
      service.getAuditsAuditId.mockReturnValue(
        of({
          id: 12_873,
          actionName: 'APPROVE',
          entityName: 'LOAN',
          maker: 'officer1',
          madeOnDate: '2026-10-15T10:42:00Z',
          checker: 'manager2',
          checkedOnDate: '2026-10-15T11:05:00Z',
          commandAsJson: '{"note":"ok"}',
          officeId: 1,
          officeName: 'Main Office',
          clientId: 88,
          clientName: 'Ada',
          loanId: 457,
          savingsAccountId: 9,
          savingsAccountNo: '000000009',
          groupId: 4,
          groupName: 'Weavers',
        }),
      );

      const entry = await firstValueFrom(api.get(12_873));

      expect(service.getAuditsAuditId).toHaveBeenCalledWith(12_873);
      expect(entry).toMatchObject({
        checker: 'manager2',
        checkedOnDate: '2026-10-15T11:05:00Z',
        commandAsJson: '{"note":"ok"}',
        officeId: 1,
        clientId: 88,
        loanId: 457,
        savingsAccountId: 9,
        groupId: 4,
      });
    });

    it('leaves the ids an older Fineract does not send as null', async () => {
      service.getAuditsAuditId.mockReturnValue(of({ id: 5, officeName: 'Main Office' }));

      const entry = await firstValueFrom(api.get(5));

      expect(entry.officeName).toBe('Main Office');
      expect(entry.officeId).toBeNull();
      expect(entry.groupId).toBeNull();
      expect(entry.savingsAccountId).toBeNull();
    });
  });

  describe('searchTemplate', () => {
    it('maps users, actions, entities and statuses', async () => {
      service.getAuditsSearchtemplate.mockReturnValue(
        of({
          appUsers: [{ id: 3, username: 'officer1' }, { username: 'no-id' }],
          actionNames: ['CREATE', 'APPROVE'],
          entityNames: ['CLIENT', 'LOAN'],
          statuses: [
            { id: 1, processingResult: 'processed' },
            { id: 2, processingResult: 'awaiting.approval' },
          ],
        }),
      );

      const template = await firstValueFrom(api.searchTemplate());

      expect(template).toEqual({
        users: [{ id: 3, username: 'officer1' }],
        actionNames: ['CREATE', 'APPROVE'],
        entityNames: ['CLIENT', 'LOAN'],
        statuses: [
          { id: 1, name: 'processed' },
          { id: 2, name: 'awaiting.approval' },
        ],
      });
    });

    it('answers empty lists for a template with nothing in it', async () => {
      service.getAuditsSearchtemplate.mockReturnValue(of({}));

      expect(await firstValueFrom(api.searchTemplate())).toEqual({
        users: [],
        actionNames: [],
        entityNames: [],
        statuses: [],
      });
    });
  });
});

describe('FineractAuditApi on the wire', () => {
  let api: FineractAuditApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(FineractAuditApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends every filter under the query parameter Fineract reads it from', () => {
    api
      .list({
        actionName: 'APPROVE',
        entityName: 'LOAN',
        resourceId: 457,
        makerId: 3,
        checkerId: 4,
        madeFrom: '2026-10-01',
        madeTo: '2026-10-16',
        statusId: 0,
        clientId: 88,
        loanId: 457,
        offset: 20,
        limit: 10,
        orderBy: 'madeOnDate',
        sortOrder: 'ASC',
      })
      .subscribe();

    const request = http.expectOne((candidate) => candidate.url.endsWith('/v1/audits'));
    // Read back from the URL as sent, so a value encoded twice would show up as `%20`.
    const sent = new URL(request.request.urlWithParams, 'https://fineract.test').searchParams;
    expect(Object.fromEntries(sent)).toEqual({
      actionName: 'APPROVE',
      entityName: 'LOAN',
      resourceId: '457',
      makerId: '3',
      checkerId: '4',
      makerDateTimeFrom: '2026-10-01 00:00:00',
      makerDateTimeTo: '2026-10-16 23:59:59',
      status: '0',
      processingResult: '0',
      clientId: '88',
      loanId: '457',
      offset: '20',
      limit: '10',
      orderBy: 'madeOnDate',
      sortOrder: 'ASC',
      paged: 'true',
    });
    request.flush('{"totalFilteredRecords":0,"pageItems":[]}');
  });

  it('reads one entry by id and the search template from their own paths', () => {
    api.get(12_873).subscribe();
    api.searchTemplate().subscribe();

    http.expectOne((candidate) => candidate.url.endsWith('/v1/audits/12873')).flush({});
    http.expectOne((candidate) => candidate.url.endsWith('/v1/audits/searchtemplate')).flush({});
  });
});

describe('toIsoDateTime', () => {
  it('reads epoch milliseconds as an instant', () => {
    expect(toIsoDateTime(Date.UTC(2026, 0, 2, 3, 4, 5))).toBe('2026-01-02T03:04:05.000Z');
  });

  it('passes an ISO string through', () => {
    expect(toIsoDateTime('2026-10-15T10:42:00Z')).toBe('2026-10-15T10:42:00Z');
  });

  it('reads the array form with a one-based month', () => {
    expect(toIsoDateTime([2026, 10, 15, 10, 42, 7])).toBe('2026-10-15T10:42:07');
  });

  it('answers null for nothing, and for an array it cannot read', () => {
    expect(toIsoDateTime(null)).toBeNull();
    expect(toIsoDateTime(undefined)).toBeNull();
    expect(toIsoDateTime('')).toBeNull();
    expect(toIsoDateTime([2026])).toBeNull();
  });
});
