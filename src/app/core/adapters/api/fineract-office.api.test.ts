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

import { OfficesService } from '../../../api';
import { toIsoFineractDate } from './fineract-date';
import { FineractOfficeApi, mapOffice } from './fineract-office.api';

/**
 * Payloads copied from a running `apache/fineract:latest`, not written from the generated type.
 *
 * Both disagree with `GetOfficesResponse`: `openingDate` is a `[year, month, day]` array where
 * the spec says `string`, and `parentId`/`parentName` are not declared at all. Issue #653 has
 * the captured responses. Building the fixture from the generated type instead would reproduce
 * exactly the blind spots this adapter exists to close.
 */
const HEAD_OFFICE = {
  id: 1,
  name: 'Head Office',
  nameDecorated: 'Head Office',
  externalId: '1',
  openingDate: [2009, 1, 1],
  hierarchy: '.',
};

const BRANCH = {
  id: 2,
  name: 'Kampala Branch',
  nameDecorated: '....Kampala Branch',
  openingDate: [2026, 10, 2],
  hierarchy: '.2.',
  parentId: 1,
  parentName: 'Head Office',
};

describe('toIsoFineractDate', () => {
  it('converts the array form Fineract actually sends', () => {
    expect(toIsoFineractDate([2009, 1, 1])).toBe('2009-01-01');
  });

  it('zero-pads a single-digit month and day', () => {
    // The bug this prevents is string concatenation producing '2009-1-1', which sorts and
    // compares wrongly against a padded date.
    expect(toIsoFineractDate([2026, 3, 7])).toBe('2026-03-07');
  });

  it('treats the month as 1-based, as Fineract sends it', () => {
    // Not Date's 0-based month. [2026, 10, 2] is October, not November.
    expect(toIsoFineractDate([2026, 10, 2])).toBe('2026-10-02');
  });

  it('accepts the string form the spec claims, so a corrected spec needs no change here', () => {
    expect(toIsoFineractDate('2026-09-01')).toBe('2026-09-01');
    expect(toIsoFineractDate('2026-09-01T00:00:00Z')).toBe('2026-09-01');
  });

  it('returns null rather than a display placeholder when there is no usable date', () => {
    // formatArrayDate() returns '-' here, which is right for a table cell and wrong for a
    // model: a placeholder stored as data cannot be sorted or compared, and it hides the
    // difference between "no opening date" and "a date we could not read".
    expect(toIsoFineractDate(undefined)).toBeNull();
    expect(toIsoFineractDate('')).toBeNull();
    expect(toIsoFineractDate([2026, 10] as unknown as number[])).toBeNull();
    expect(toIsoFineractDate(['x', 'y', 'z'] as unknown as number[])).toBeNull();
  });
});

describe('mapOffice', () => {
  it('exposes the parent Fineract sends but the generated type does not declare', () => {
    const office = mapOffice(BRANCH);
    expect(office.parentId).toBe(1);
    expect(office.parentName).toBe('Head Office');
  });

  it('reports the head office as having no parent', () => {
    const office = mapOffice(HEAD_OFFICE);
    expect(office.parentId).toBeNull();
    expect(office.parentName).toBeNull();
  });

  it('maps a whole office', () => {
    expect(mapOffice(BRANCH)).toEqual({
      id: 2,
      name: 'Kampala Branch',
      nameDecorated: '....Kampala Branch',
      externalId: null,
      hierarchy: '.2.',
      parentId: 1,
      parentName: 'Head Office',
      openingDate: '2026-10-02',
    });
  });

  it('falls back to the plain name when there is no decorated one', () => {
    // A tree view renders nameDecorated; an empty cell is worse than an unindented name.
    const office = mapOffice({ ...BRANCH, nameDecorated: undefined });
    expect(office.nameDecorated).toBe('Kampala Branch');
  });

  it('refuses an office with no id rather than routing somewhere wrong', () => {
    expect(() => mapOffice({ ...BRANCH, id: undefined })).toThrow(/no id/);
  });
});

describe('FineractOfficeApi', () => {
  let generated: {
    getOffices: ReturnType<typeof vi.fn>;
    getOfficesOfficeId: ReturnType<typeof vi.fn>;
    postOffices: ReturnType<typeof vi.fn>;
    putOfficesOfficeId: ReturnType<typeof vi.fn>;
  };
  let api: FineractOfficeApi;

  beforeEach(() => {
    generated = {
      getOffices: vi.fn().mockReturnValue(of([HEAD_OFFICE, BRANCH])),
      getOfficesOfficeId: vi.fn().mockReturnValue(of(BRANCH)),
      postOffices: vi.fn().mockReturnValue(of({ resourceId: 42, officeId: 42 })),
      putOfficesOfficeId: vi.fn().mockReturnValue(of({})),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: OfficesService, useValue: generated }],
    });
    api = TestBed.inject(FineractOfficeApi);
  });

  it('maps every office it lists', async () => {
    const offices = await new Promise<unknown>((resolve) => api.list().subscribe(resolve));
    expect(offices).toEqual([
      expect.objectContaining({ id: 1, openingDate: '2009-01-01', parentId: null }),
      expect.objectContaining({ id: 2, openingDate: '2026-10-02', parentId: 1 }),
    ]);
  });

  it('passes includeAllOffices through, because it changes which offices come back', () => {
    api.list(true).subscribe();
    expect(generated.getOffices).toHaveBeenCalledWith(true);
  });

  it('survives the empty body this endpoint has been seen to return', async () => {
    // HttpClient delivers an empty response body as null, and every previous call site guarded
    // for it. The guard belongs here now, once.
    generated.getOffices.mockReturnValue(of(null));
    const offices = await new Promise<unknown>((resolve) => api.list().subscribe(resolve));
    expect(offices).toEqual([]);
  });

  it('maps a single office through the same mapper as the list', async () => {
    // `GET /offices/{id}` sends the same disagreements as the collection — verified against a
    // running instance — so the parent fields and the array date are handled identically.
    const office = await new Promise<unknown>((resolve) => api.get(10).subscribe(resolve));
    expect(generated.getOfficesOfficeId).toHaveBeenCalledWith(10);
    expect(office).toEqual(
      expect.objectContaining({
        openingDate: '2026-10-02',
        parentId: 1,
        parentName: 'Head Office',
      }),
    );
  });

  it('sends the date format it tells Fineract to parse the opening date against', () => {
    // Fineract parses strictly against `dateFormat`, so a body carrying one without the other
    // answers 500 rather than a validation error. Both forms used to set this themselves.
    api.create({ name: 'Kampala Branch', openingDate: '2026-10-02', parentId: 1 }).subscribe();

    expect(generated.postOffices).toHaveBeenCalledWith({
      name: 'Kampala Branch',
      externalId: undefined,
      parentId: 1,
      openingDate: '2026-10-02',
      dateFormat: 'yyyy-MM-dd',
      locale: 'en',
    });
  });

  it('answers the new office id, which the create dialog hands back to its caller', async () => {
    // Not cosmetic: `create-office-dialog` dismisses with this value so that whatever opened it
    // — a client or group form — can select the office that was just made. Discarding it here
    // is invisible to the dialog's own spec, which mocks this contract.
    const officeId = await new Promise((resolve) =>
      api.create({ name: 'Kampala Branch', openingDate: '2026-10-02' }).subscribe(resolve),
    );
    expect(officeId).toBe(42);
  });

  it('refuses a create that answers no id rather than reporting a bogus one', async () => {
    generated.postOffices.mockReturnValue(of({}));
    await expect(
      new Promise((resolve, reject) =>
        api
          .create({ name: 'Kampala Branch', openingDate: '2026-10-02' })
          .subscribe({ next: resolve, error: reject }),
      ),
    ).rejects.toThrow(/no resourceId/);
  });

  it('omits parentId entirely when there is none, rather than sending null', () => {
    api.create({ name: 'Head Office', openingDate: '2009-01-01' }).subscribe();
    expect(generated.postOffices.mock.calls[0][0]).not.toHaveProperty('parentId');
  });

  it('does not send parentId on update, because the endpoint does not move an office', () => {
    api.update(10, { name: 'Renamed', openingDate: '2026-10-02' }).subscribe();

    expect(generated.putOfficesOfficeId).toHaveBeenCalledWith(10, {
      name: 'Renamed',
      externalId: undefined,
      openingDate: '2026-10-02',
      dateFormat: 'yyyy-MM-dd',
      locale: 'en',
    });
  });
});
