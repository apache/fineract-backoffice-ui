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

import { AccountingClosureService } from '../../../api';
import type { GetGlClosureResponse } from '../../../api';
import {
  FineractAccountingClosureApi,
  mapAccountingClosure,
} from './fineract-accounting-closure.api';

/**
 * The payload Fineract actually returns for `GET /glclosures`, copied from a live response
 * rather than written from the generated type.
 *
 * That distinction is the reason this file exists. The generated type is derived from a spec
 * that under-describes the endpoint: it omits `allowedOffices`, which the real payload has, and
 * it has no `isClosed`, which the list screen nonetheless read. Fixtures built from the
 * generated type reproduce the spec's blind spots, so a test built on one can confirm a screen
 * works while the screen is broken in the browser.
 */
const LIVE_RESPONSE: GetGlClosureResponse = {
  id: 1,
  officeId: 1,
  officeName: 'Head Office',
  closingDate: '2026-09-01',
  deleted: false,
  createdDate: '2026-10-02',
  lastUpdatedDate: '2026-10-02',
  createdByUserId: 1,
  createdByUsername: 'mifos',
  lastUpdatedByUserId: 1,
  lastUpdatedByUsername: 'mifos',
};

describe('mapAccountingClosure', () => {
  it('reports a present closure as closed, which is what the row means', () => {
    // The defect this adapter was written for: the screen read `isClosed` off the generated
    // response, which has no such field, so every closed period rendered as "Open".
    expect(mapAccountingClosure(LIVE_RESPONSE).isClosed).toBe(true);
  });

  it('reports a deleted closure as not closed', () => {
    expect(mapAccountingClosure({ ...LIVE_RESPONSE, deleted: true }).isClosed).toBe(false);
  });

  it('treats an absent deleted flag as closed', () => {
    // Every field on the generated response is optional, so `deleted` may simply be missing.
    // A row Fineract returned is a closure; absence of the flag must not read as "open".
    expect(mapAccountingClosure({ ...LIVE_RESPONSE, deleted: undefined }).isClosed).toBe(true);
  });

  it('maps the fields the screens display', () => {
    expect(mapAccountingClosure(LIVE_RESPONSE)).toEqual({
      id: 1,
      officeId: 1,
      officeName: 'Head Office',
      closingDate: '2026-09-01',
      comments: null,
      isClosed: true,
    });
  });

  it('turns an absent optional field into null rather than undefined', () => {
    // `null` is deliberate: a template reading past an absent field gets an empty cell, where
    // `undefined` in an untyped template context is exactly how the isClosed bug stayed hidden.
    const mapped = mapAccountingClosure(LIVE_RESPONSE);
    expect(mapped.comments).toBeNull();
    expect(
      mapAccountingClosure({ ...LIVE_RESPONSE, closingDate: undefined }).closingDate,
    ).toBeNull();
  });

  it('keeps a comment when there is one', () => {
    expect(mapAccountingClosure({ ...LIVE_RESPONSE, comments: 'Year end' }).comments).toBe(
      'Year end',
    );
  });

  it('refuses a closure with no id rather than inventing one', () => {
    // An id is what the re-open action posts back. Defaulting it would send a delete for the
    // wrong period, so the mapper fails loudly instead.
    expect(() => mapAccountingClosure({ ...LIVE_RESPONSE, id: undefined })).toThrow(/no id/);
    expect(() => mapAccountingClosure({ ...LIVE_RESPONSE, officeId: undefined })).toThrow(
      /no officeId/,
    );
  });

  it('ignores fields the spec does not describe', () => {
    // The live payload carries `allowedOffices`, which the generated type omits. An unmodelled
    // field must not reach the application model.
    const withExtra = { ...LIVE_RESPONSE, allowedOffices: [] } as GetGlClosureResponse;
    expect(Object.keys(mapAccountingClosure(withExtra))).toEqual([
      'id',
      'officeId',
      'officeName',
      'closingDate',
      'comments',
      'isClosed',
    ]);
  });
});

describe('FineractAccountingClosureApi', () => {
  let generated: {
    getGlclosures: ReturnType<typeof vi.fn>;
    postGlclosures: ReturnType<typeof vi.fn>;
    deleteGlclosuresGlClosureId: ReturnType<typeof vi.fn>;
  };
  let api: FineractAccountingClosureApi;

  beforeEach(() => {
    generated = {
      getGlclosures: vi.fn().mockReturnValue(of([LIVE_RESPONSE])),
      postGlclosures: vi.fn().mockReturnValue(of({ officeId: 1, resourceId: 1 })),
      deleteGlclosuresGlClosureId: vi.fn().mockReturnValue(of({ officeId: 1, resourceId: 1 })),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: AccountingClosureService, useValue: generated }],
    });
    api = TestBed.inject(FineractAccountingClosureApi);
  });

  it('maps every closure it lists', async () => {
    const closures = await new Promise<unknown>((resolve) => api.list().subscribe(resolve));
    expect(closures).toEqual([
      {
        id: 1,
        officeId: 1,
        officeName: 'Head Office',
        closingDate: '2026-09-01',
        comments: null,
        isClosed: true,
      },
    ]);
  });

  it('supplies the date format and locale Fineract wants, so screens do not have to', () => {
    api.create({ officeId: 2, closingDate: '2026-09-30', comments: 'Q3' }).subscribe();

    expect(generated.postGlclosures).toHaveBeenCalledWith({
      officeId: 2,
      closingDate: '2026-09-30',
      comments: 'Q3',
      dateFormat: 'yyyy-MM-dd',
      locale: 'en',
    });
  });

  it('re-opens a period by deleting its closure', () => {
    api.remove(7).subscribe();
    expect(generated.deleteGlclosuresGlClosureId).toHaveBeenCalledWith(7);
  });

  it('completes create and remove without handing back the generated response', async () => {
    // The contract returns void: a resourceId that leaked through would be the generated shape
    // reaching application code by another route.
    await expect(
      new Promise((resolve) =>
        api.create({ officeId: 1, closingDate: '2026-09-30' }).subscribe(resolve),
      ),
    ).resolves.toBeUndefined();
    await expect(
      new Promise((resolve) => api.remove(1).subscribe(resolve)),
    ).resolves.toBeUndefined();
  });
});
